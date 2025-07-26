/// <reference types="@figma/plugin-typings" />

import { Graph, Act, Input } from './types';
import { BOX_SIZE, INITIAL_X_OFFSET } from './constants';
import { CollisionEngine, Rectangle, CollisionContext } from './collision';

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
  private collisionEngine: CollisionEngine;

  constructor() {
    // Initialize collision engine with custom config
    this.collisionEngine = new CollisionEngine({
      strategy: 'avoid',
      nodeToNode: true,
      edgeToNode: true,
      edgeToEdge: false,
      margin: 20 // Reduced margin for tighter vertical spacing
    });
  }

  calculateNodeHeights(nodes: (Input | Act)[]) {
    nodes.forEach(node => {
      let totalHeight = 0;
      if ('kind' in node && node.kind === 'initial_sink_node') {
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
    const boxWidth = ('kind' in nodeData && nodeData.kind === 'initial_sink_node') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
    const x = INITIAL_X_OFFSET + (colIndex * (BOX_SIZE.NODE.W + paddingX));
    
    // Create collision context
    const context: CollisionContext = {
      nodePositions: new Map(this.placedNodePositions.entries()),
      edges: [],
      padding: { x: paddingX, y: paddingY }
    };

    // Get parent IDs for edge collision detection
    const parentIds = revAdj.get(id) || [];

    // Use collision engine to find conflict-free Y position
    return this.collisionEngine.findConflictFreeY(
      id,
      x,
      y_initial,
      boxWidth,
      totalHeight,
      context,
      parentIds
    );
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

  getNodePosition(id: string): NodePosition | undefined {
    return this.placedNodePositions.get(id);
  }

  /**
   * Get the connection point for a node (handles special cases like final goods)
   */
  getNodeConnectionPoint(nodeId: string, nodeData: Input | Act | null, type: 'input' | 'output'): { x: number; y: number } | null {
    const pos = this.placedNodePositions.get(nodeId);
    if (!pos) return null;

    return this.collisionEngine.getNodeConnectionPoint(nodeId, pos, type);
  }

  /**
   * Calculate subsection bounds with proper margins
   */
  calculateSubsectionBounds(nodeIds: string[], nodeDataMap: Map<string, Input | Act>): Rectangle {
    const nodes: Rectangle[] = [];
    
    for (const id of nodeIds) {
      const pos = this.placedNodePositions.get(id);
      if (pos) {
        nodes.push(pos);
      }
    }

    // Use larger padding for initial boxes
    const isInitialSection = nodeIds.some(id => {
      const nodeData = nodeDataMap.get(id);
      return nodeData && 'kind' in nodeData && nodeData.kind === 'initial_sink_node';
    });

    const sectionPadding = isInitialSection
      ? { top: 80, right: 60, bottom: 60, left: 70 } // Extra margin for initial boxes
      : { top: 40, right: 40, bottom: 40, left: 40 };

    return this.collisionEngine.calculateSubsectionBounds(nodes, sectionPadding);
  }
}