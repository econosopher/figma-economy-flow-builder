/// <reference types="@figma/plugin-typings" />

import { Graph, Act, Input, Subsection } from './types';
import { BOX_SIZE, INITIAL_X_OFFSET, PADDING } from './constants';
import { CollisionEngine, Rectangle, CollisionContext } from './collision';

interface NodePosition {
  x: number;
  y: number;
  height: number;
  width: number;
}

interface SubsectionBand {
  id: string;
  nodeIds: Set<string>;
  minY: number;
  maxY: number;
  bandIndex: number;
}

export class LayoutEngine {
  private nodeTotalHeights = new Map<string, number>();
  private nodeColumns = new Map<string, number>();
  private placedNodePositions = new Map<string, NodePosition>();
  private collisionEngine: CollisionEngine;
  private subsectionBands = new Map<string, SubsectionBand>();
  private nodeToSubsection = new Map<string, string>();

  constructor() {
    // Initialize collision engine with custom config
    this.collisionEngine = new CollisionEngine({
      strategy: 'avoid',
      nodeToNode: true,
      edgeToNode: true,
      edgeToEdge: false,
      margin: 14 // Further reduced margin by 30% for tighter vertical spacing
    });
  }

  /**
   * Initialize subsection bands for vertical layout grouping.
   * This assigns each subsection a vertical "band" to prevent overlap.
   */
  initializeSubsectionBands(subsections: Subsection[] | undefined, allNodes: (Input | Act)[]): void {
    this.subsectionBands.clear();
    this.nodeToSubsection.clear();

    if (!subsections || subsections.length === 0) return;

    // Map nodes to their subsections
    subsections.forEach(sub => {
      sub.nodeIds.forEach(nodeId => {
        this.nodeToSubsection.set(nodeId, sub.id);
      });
    });

    // Calculate the total height needed for each subsection
    const subsectionHeights = new Map<string, number>();
    subsections.forEach(sub => {
      let totalHeight = 0;
      sub.nodeIds.forEach(nodeId => {
        const nodeHeight = this.nodeTotalHeights.get(nodeId) || BOX_SIZE.NODE.H;
        totalHeight += nodeHeight + PADDING.Y;
      });
      // Add padding for subsection header and borders
      totalHeight += 80;
      subsectionHeights.set(sub.id, totalHeight);
    });

    // Sort subsections by their minimum column (leftmost node position)
    // This helps place subsections that start earlier at the top
    const subsectionMinCol = new Map<string, number>();
    subsections.forEach(sub => {
      let minCol = Infinity;
      sub.nodeIds.forEach(nodeId => {
        const col = this.nodeColumns.get(nodeId);
        if (col !== undefined && col < minCol) {
          minCol = col;
        }
      });
      subsectionMinCol.set(sub.id, minCol === Infinity ? 0 : minCol);
    });

    const sortedSubsections = [...subsections].sort((a, b) => {
      const colA = subsectionMinCol.get(a.id) || 0;
      const colB = subsectionMinCol.get(b.id) || 0;
      return colA - colB;
    });

    // Assign vertical bands - subsections at the same column level get stacked
    let currentY = 0;
    const columnBands = new Map<number, number>(); // column -> next available Y

    sortedSubsections.forEach((sub, index) => {
      const minCol = subsectionMinCol.get(sub.id) || 0;
      const height = subsectionHeights.get(sub.id) || 200;

      // Find the Y position for this subsection
      // It should start after any subsection in the same or overlapping columns
      let startY = 0;
      sub.nodeIds.forEach(nodeId => {
        const col = this.nodeColumns.get(nodeId);
        if (col !== undefined) {
          const bandY = columnBands.get(col) || 0;
          startY = Math.max(startY, bandY);
        }
      });

      // Create the band
      this.subsectionBands.set(sub.id, {
        id: sub.id,
        nodeIds: new Set(sub.nodeIds),
        minY: startY,
        maxY: startY + height,
        bandIndex: index
      });

      // Update column bands for all columns this subsection spans
      sub.nodeIds.forEach(nodeId => {
        const col = this.nodeColumns.get(nodeId);
        if (col !== undefined) {
          const newY = startY + height + 40; // 40px gap between subsections
          columnBands.set(col, Math.max(columnBands.get(col) || 0, newY));
        }
      });
    });
  }

  /**
   * Get the Y offset for a node based on its subsection band
   */
  getSubsectionYOffset(nodeId: string): number {
    const subsectionId = this.nodeToSubsection.get(nodeId);
    if (!subsectionId) return 0;

    const band = this.subsectionBands.get(subsectionId);
    if (!band) return 0;

    return band.minY;
  }

  calculateNodeHeights(nodes: (Input | Act)[]) {
    nodes.forEach(node => {
      let totalHeight = 0;
      if ('kind' in node && node.kind === 'initial_sink_node') {
        totalHeight = BOX_SIZE.INPUT.H;
      } else if ('kind' in node && node.kind === 'final_good') {
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
    while (head < queue.length) {
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
    revAdj: Map<string, string[]>,
    prevNodeInColumn?: { y: number, height: number }
  ): number {
    let totalHeight = this.nodeTotalHeights.get(id) || 0;
    if (totalHeight === 0) {
      if ('kind' in nodeData && nodeData.kind === 'initial_sink_node') {
        totalHeight = BOX_SIZE.INPUT.H;
      } else if ('kind' in nodeData && nodeData.kind === 'final_good') {
        totalHeight = BOX_SIZE.FINAL_GOOD.H;
      } else {
        totalHeight = BOX_SIZE.NODE.H;
      }
    }
    const boxWidth = ('kind' in nodeData && nodeData.kind === 'initial_sink_node') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
    const x = INITIAL_X_OFFSET + (colIndex * (BOX_SIZE.NODE.W + paddingX));

    // Apply subsection band offset to ensure nodes stay within their subsection's vertical space
    const subsectionOffset = this.getSubsectionYOffset(id);
    let startY = Math.max(y_initial, subsectionOffset);

    // Enforce minimum distance from previous node in same subsection
    if (prevNodeInColumn) {
      // Only apply previous node constraint if in the same subsection
      const prevSubsection = this.nodeToSubsection.get(id);
      const minY = prevNodeInColumn.y + prevNodeInColumn.height + paddingY;
      if (startY < minY) {
        startY = minY;
      }
    }

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
      startY,
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
   * Post-layout optimization pass to reduce edge crossings.
   * This adjusts node positions within their bands to minimize connector overlaps.
   */
  optimizeLayout(edges: [string, string][], paddingY: number): void {
    // Count crossings for each node pair
    const crossings = this.countEdgeCrossings(edges);

    if (crossings === 0) return; // Already optimal

    // Try swapping nodes within the same column to reduce crossings
    const nodesByColumn = new Map<number, string[]>();
    this.nodeColumns.forEach((col, nodeId) => {
      if (!nodesByColumn.has(col)) {
        nodesByColumn.set(col, []);
      }
      nodesByColumn.get(col)!.push(nodeId);
    });

    let improved = true;
    let iterations = 0;
    const maxIterations = 10;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      nodesByColumn.forEach((nodesInCol, col) => {
        if (nodesInCol.length < 2) return;

        // Sort nodes by Y position
        const sortedNodes = [...nodesInCol].sort((a, b) => {
          const posA = this.placedNodePositions.get(a);
          const posB = this.placedNodePositions.get(b);
          return (posA?.y || 0) - (posB?.y || 0);
        });

        // Try swapping adjacent pairs
        for (let i = 0; i < sortedNodes.length - 1; i++) {
          const nodeA = sortedNodes[i];
          const nodeB = sortedNodes[i + 1];

          // Only swap if they're in the same subsection (or both have no subsection)
          const subA = this.nodeToSubsection.get(nodeA);
          const subB = this.nodeToSubsection.get(nodeB);
          if (subA !== subB) continue;

          const crossingsBefore = this.countEdgeCrossings(edges);

          // Swap positions
          const posA = this.placedNodePositions.get(nodeA);
          const posB = this.placedNodePositions.get(nodeB);
          if (!posA || !posB) continue;

          // Swap Y positions
          const tempY = posA.y;
          posA.y = posB.y;
          posB.y = tempY;

          // Adjust to maintain proper spacing
          if (posA.y > posB.y) {
            posA.y = posB.y + posB.height + paddingY;
          } else {
            posB.y = posA.y + posA.height + paddingY;
          }

          const crossingsAfter = this.countEdgeCrossings(edges);

          if (crossingsAfter < crossingsBefore) {
            improved = true;
            // Keep the swap
            sortedNodes[i] = nodeB;
            sortedNodes[i + 1] = nodeA;
          } else {
            // Revert the swap
            const revertY = posA.y;
            posA.y = posB.y;
            posB.y = revertY;
            if (posA.y > posB.y) {
              posA.y = posB.y + posB.height + paddingY;
            } else {
              posB.y = posA.y + posA.height + paddingY;
            }
          }
        }
      });
    }
  }

  /**
   * Count the number of edge crossings in the current layout
   */
  private countEdgeCrossings(edges: [string, string][]): number {
    let crossings = 0;

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        if (this.edgesCross(edges[i], edges[j])) {
          crossings++;
        }
      }
    }

    return crossings;
  }

  /**
   * Check if two edges cross each other
   */
  private edgesCross(edge1: [string, string], edge2: [string, string]): boolean {
    const [from1, to1] = edge1;
    const [from2, to2] = edge2;

    const pos1From = this.placedNodePositions.get(from1);
    const pos1To = this.placedNodePositions.get(to1);
    const pos2From = this.placedNodePositions.get(from2);
    const pos2To = this.placedNodePositions.get(to2);

    if (!pos1From || !pos1To || !pos2From || !pos2To) return false;

    // Get columns
    const col1From = this.nodeColumns.get(from1) || 0;
    const col1To = this.nodeColumns.get(to1) || 0;
    const col2From = this.nodeColumns.get(from2) || 0;
    const col2To = this.nodeColumns.get(to2) || 0;

    // Edges only cross if they span overlapping column ranges
    const minCol1 = Math.min(col1From, col1To);
    const maxCol1 = Math.max(col1From, col1To);
    const minCol2 = Math.min(col2From, col2To);
    const maxCol2 = Math.max(col2From, col2To);

    if (maxCol1 <= minCol2 || maxCol2 <= minCol1) return false;

    // Check if the edges actually cross in Y space
    const y1From = pos1From.y + pos1From.height / 2;
    const y1To = pos1To.y + pos1To.height / 2;
    const y2From = pos2From.y + pos2From.height / 2;
    const y2To = pos2To.y + pos2To.height / 2;

    // Edges cross if one starts above and ends below the other
    const edge1GoesDown = y1To > y1From;
    const edge2GoesDown = y2To > y2From;

    if (edge1GoesDown === edge2GoesDown) {
      // Both going same direction - check if they cross
      if (edge1GoesDown) {
        return (y1From < y2From && y1To > y2To) || (y2From < y1From && y2To > y1To);
      } else {
        return (y1From > y2From && y1To < y2To) || (y2From > y1From && y2To < y1To);
      }
    } else {
      // Going opposite directions - likely to cross
      return true;
    }
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
