/// <reference types="@figma/plugin-typings" />

import { Graph, Act, Input } from './types';
import { BOX_SIZE } from './constants';

interface NodePosition {
  x: number;
  y: number;
  height: number;
  width: number;
}

export class LayoutEngine {
  private nodeTotalHeights = new Map<string, number>();
  private nodeColumns = new Map<string, number>();
  private placedNodePositions = new Map<string, NodePosition>();

  calculateNodeHeights(nodes: (Input | Act)[]) {
    nodes.forEach(node => {
      let totalHeight = 0;
      if ('kind' in node && node.kind === 'SINK_RED') {
        totalHeight = BOX_SIZE.INPUT.H;
      } else if ('kind' in node && node.kind === 'finalGood') {
        totalHeight = BOX_SIZE.NODE.H;
      } else {
        totalHeight = BOX_SIZE.NODE.H;
        const act = node as Act;
        const attrCount = (act.sources?.length || 0) + (act.sinks?.length || 0) + (act.values?.length || 0);
        if (attrCount > 0) {
          totalHeight += (attrCount * (BOX_SIZE.ATTR.H + 5)) + 5;
        }
      }
      this.nodeTotalHeights.set(node.id, totalHeight);
    });
  }

  calculateColumns(graph: Graph): string[][] {
    const allNodeIds = [...graph.inputs.map(i => i.id), ...graph.nodes.map(n => n.id)];
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize adjacency list and in-degree
    allNodeIds.forEach(id => {
      adj.set(id, []);
      inDegree.set(id, 0);
    });

    // Build graph
    graph.edges.forEach(([from, to]) => {
      if (from && to && adj.has(from) && inDegree.has(to)) {
        adj.get(from)!.push(to);
        inDegree.set(to, inDegree.get(to)! + 1);
      }
    });

    // Topological sort to determine columns
    const queue: string[] = [];
    allNodeIds.forEach(id => {
      if (inDegree.get(id) === 0) {
        queue.push(id);
        this.nodeColumns.set(id, 0);
      }
    });

    let head = 0;
    while(head < queue.length) {
      const u = queue[head++];
      const u_col = this.nodeColumns.get(u)!;

      for (const v of adj.get(u)!) {
        const v_col = this.nodeColumns.get(v);
        if (v_col === undefined || v_col < u_col + 1) {
          this.nodeColumns.set(v, u_col + 1);
        }
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    // Group nodes by column
    const columns: string[][] = [];
    this.nodeColumns.forEach((col, id) => {
      if (!columns[col]) columns[col] = [];
      columns[col].push(id);
    });

    return columns;
  }

  findConflictFreeY(
    id: string, 
    colIndex: number, 
    y_initial: number,
    paddingX: number,
    paddingY: number,
    nodeData: Input | Act,
    revAdj: Map<string, string[]>
  ): number {
    const totalHeight = this.nodeTotalHeights.get(id) || 0;
    const boxWidth = ('kind' in nodeData && nodeData.kind === 'SINK_RED') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
    const x = colIndex * (BOX_SIZE.NODE.W + paddingX);
    let max_y = 0;

    // Check for direct node-on-node collision
    for (const pos of this.placedNodePositions.values()) {
      if (x < pos.x + pos.width + paddingX && x + boxWidth + paddingX > pos.x) {
        max_y = Math.max(max_y, pos.y + pos.height + paddingY);
      }
    }

    // Check for connector-on-node collision
    const parentIds = revAdj.get(id) || [];
    for (const pId of parentIds) {
      const parentPos = this.placedNodePositions.get(pId);
      const parentCol = this.nodeColumns.get(pId);
      if (!parentPos || parentCol === undefined) continue;

      const lineY_start = parentPos.y + parentPos.height / 2;
      const lineY_end = y_initial + totalHeight / 2;
      const lineY_min = Math.min(lineY_start, lineY_end);
      const lineY_max = Math.max(lineY_start, lineY_end);

      // Check against nodes in intermediate columns
      for (let i = parentCol + 1; i < colIndex; i++) {
        for (const [otherId, otherPos] of this.placedNodePositions.entries()) {
          if (this.nodeColumns.get(otherId) === i) {
            if (lineY_max > otherPos.y && lineY_min < otherPos.y + otherPos.height) {
              max_y = Math.max(max_y, otherPos.y + otherPos.height + paddingY);
            }
          }
        }
      }
    }

    return Math.max(y_initial, max_y);
  }

  recordNodePosition(id: string, x: number, y: number, width: number, height: number) {
    this.placedNodePositions.set(id, { x, y, height, width });
  }

  getNodeColumn(id: string): number | undefined {
    return this.nodeColumns.get(id);
  }

  getNodeHeight(id: string): number {
    return this.nodeTotalHeights.get(id) || 0;
  }
}