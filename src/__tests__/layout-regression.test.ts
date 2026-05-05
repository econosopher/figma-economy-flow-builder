import * as fs from 'fs';
import * as path from 'path';

import { CollisionDetector } from '../collision';
import { V2Graph } from '../types';
import { layoutV2Graph, routeV2Edges } from '../v2-layout';
import { validateGraphData } from '../validation';

const SAMPLE_FILES = (() => {
  const examplesDir = path.join(__dirname, '..', '..', 'examples');
  return fs
    .readdirSync(examplesDir)
    .filter(file => file.endsWith('.json'))
    .map(file => `examples/${file}`);
})();

function loadGraph(filename: string): V2Graph {
  const filePath = path.join(__dirname, '..', '..', filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const errors = validateGraphData(parsed);
  expect(errors).toEqual([]);
  return parsed;
}

describe('v2 layout regression', () => {
  test.each(SAMPLE_FILES)('diagram "%s" places nodes without overlap', filename => {
    const graph = loadGraph(filename);
    const layout = layoutV2Graph(graph);
    const nodes = Array.from(layout.nodes.values());

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const rectA = nodes[i].rect;
        const rectB = nodes[j].rect;
        const overlap = CollisionDetector.rectanglesOverlap(rectA, rectB, 0).collides;
        if (overlap) {
          throw new Error(`Overlap detected in ${filename}: ${nodes[i].id} and ${nodes[j].id}`);
        }
      }
    }
  });

  test.each(SAMPLE_FILES)('diagram "%s" routes lines away from non-endpoint boxes', filename => {
    const graph = loadGraph(filename);
    const layout = layoutV2Graph(graph);
    const routes = routeV2Edges(graph, layout);

    routes.forEach(route => {
      const endpoints = new Set([route.from, route.to]);
      layout.nodes.forEach(node => {
        if (endpoints.has(node.id)) return;
        const intersects = route.segments.some(segment =>
          CollisionDetector.lineIntersectsRectangle(segment, node.rect, 0).collides
        );
        if (intersects) {
          throw new Error(`Route ${route.from} -> ${route.to} intersects ${node.id} in ${filename}`);
        }
      });
    });
  });

  test.each(SAMPLE_FILES)('diagram "%s" has no backward final-good edges', filename => {
    const graph = loadGraph(filename);
    const layout = layoutV2Graph(graph);
    const finalGoodIds = new Set(graph.nodes.filter(node => node.kind === 'final_good').map(node => node.id));
    const backwardFinalEdges = graph.edges.filter(edge => {
      const from = layout.nodes.get(edge.from);
      const to = layout.nodes.get(edge.to);
      return finalGoodIds.has(edge.to) && from && to && to.rect.x < from.rect.x;
    });

    expect(backwardFinalEdges).toEqual([]);
  });
});
