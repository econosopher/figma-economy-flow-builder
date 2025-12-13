import * as fs from 'fs';
import * as path from 'path';

import { LayoutEngine } from '../layout';
import { BOX_SIZE, INITIAL_X_OFFSET, INITIAL_Y_OFFSET, PADDING } from '../constants';
import { CollisionDetector, Rectangle } from '../collision';
import { Graph, Act, Input } from '../types';
import { validateGraphData } from '../validation';

const SAMPLE_FILES = (() => {
  const examplesDir = path.join(__dirname, '..', '..', 'examples');
  return fs
    .readdirSync(examplesDir)
    .filter(file => file.endsWith('.json'))
    .filter(file => file !== 'economy-flow-plugin.code-workspace')
    .map(file => `examples/${file}`);
})();

function loadGraph(filename: string): Graph {
  const filePath = path.join(__dirname, '..', '..', filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const errors = validateGraphData(parsed);
  expect(errors).toEqual([]);
  return parsed;
}

interface PositionedNode {
  rect: Rectangle;
  data: Act | Input;
}

function layoutGraph(graph: Graph): Map<string, PositionedNode> {
  const layout = new LayoutEngine();
  const allNodes = [...graph.inputs, ...graph.nodes];
  const nodeDataMap = new Map(allNodes.map(node => [node.id, node] as const));

  layout.calculateNodeHeights(allNodes);
  const columns = layout.calculateColumns(graph);

  const revAdj = new Map<string, string[]>();
  allNodes.forEach(node => revAdj.set(node.id, []));
  graph.edges.forEach(([from, to]) => {
    if (from && to && revAdj.has(to)) {
      revAdj.get(to)!.push(from);
    }
  });

  const placements = new Map<string, PositionedNode>();

  columns.forEach((nodeIdsInCol, colIndex) => {
    const yTargets = new Map<string, number>();

    nodeIdsInCol.forEach(id => {
      const parentIds = revAdj.get(id) || [];
      const parentYs = parentIds
        .map(parentId => {
          const pos = layout.getNodePosition(parentId);
          return pos ? pos.y - INITIAL_Y_OFFSET : undefined;
        })
        .filter((v): v is number => typeof v === 'number');
      const avgY = parentYs.length > 0 ? parentYs.reduce((sum, val) => sum + val, 0) / parentYs.length : 0;
      yTargets.set(id, avgY);
    });

    const ordered = [...nodeIdsInCol].sort((a, b) => (yTargets.get(a) || 0) - (yTargets.get(b) || 0));
    let prevNodeInColumn: { y: number; height: number } | undefined;

    ordered.forEach(id => {
      const nodeData = nodeDataMap.get(id);
      if (!nodeData) return;

      const yInitial = yTargets.get(id) || 0;
      const yFinal = layout.findConflictFreeY(
        id,
        colIndex,
        yInitial,
        PADDING.X,
        PADDING.Y,
        nodeData,
        revAdj,
        prevNodeInColumn
      );
      const x = INITIAL_X_OFFSET + (colIndex * (BOX_SIZE.NODE.W + PADDING.X));
      const totalHeight = layout.getNodeHeight(id);
      const width = ('kind' in nodeData && nodeData.kind === 'initial_sink_node') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
      const y = INITIAL_Y_OFFSET + yFinal;

      layout.recordNodePosition(id, x, y, width, totalHeight);
      placements.set(id, { rect: { x, y, width, height: totalHeight }, data: nodeData });
      prevNodeInColumn = { y: yFinal, height: totalHeight };
    });
  });

  return placements;
}

describe('layout regression', () => {
  test.each(SAMPLE_FILES)('diagram "%s" places nodes without overlap', filename => {
    const graph = loadGraph(filename);
    const placements = layoutGraph(graph);
    const nodes = Array.from(placements.values());

    // Node rectangles do not overlap
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const rectA = nodes[i].rect;
        const rectB = nodes[j].rect;
        const overlap = CollisionDetector.rectanglesOverlap(rectA, rectB, 0).collides;
        if (overlap) {
          throw new Error(
            `Overlap detected in ${filename}: ${nodes[i].data.id} (${rectA.x},${rectA.y},${rectA.width},${rectA.height}) ` +
              `and ${nodes[j].data.id} (${rectB.x},${rectB.y},${rectB.width},${rectB.height})`
          );
        }
      }
    }
  });
});
