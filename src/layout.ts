/// <reference types="@figma/plugin-typings" />

import { Graph, Act, Input, Subsection } from './types';
import { buildConnectorSegments } from './connector-routing';
import { BOX_SIZE, INITIAL_X_OFFSET, PADDING } from './constants';
import { CollisionEngine, CollisionDetector, Rectangle, CollisionContext } from './collision';

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
  private nodeKinds = new Map<string, string>();
  private collisionEngine: CollisionEngine;
  private nodeToSubsection = new Map<string, string>();

  constructor() {
    // Initialize collision engine with custom config
    this.collisionEngine = new CollisionEngine({
      strategy: 'avoid',
      nodeToNode: true,
      edgeToNode: true,
      margin: 14 // Further reduced margin by 30% for tighter vertical spacing
    });
  }

  /**
   * Index subsection membership so layout constraints can respect group boundaries.
   */
  setSubsections(subsections: Subsection[] | undefined): void {
    this.nodeToSubsection.clear();

    if (!subsections || subsections.length === 0) return;

    // Map nodes to their subsections (used for bounds/grouping and any future constraints).
    subsections.forEach(sub => {
      sub.nodeIds.forEach(nodeId => {
        this.nodeToSubsection.set(nodeId, sub.id);
      });
    });

  }

  calculateNodeHeights(nodes: (Input | Act)[]) {
    nodes.forEach(node => {
      let totalHeight = 0;
      const nodeKind = ('kind' in node && typeof node.kind === 'string') ? node.kind : 'node';
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
      this.nodeKinds.set(node.id, nodeKind);
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

    // Base columns via topological order (DAG depth)
    const baseColumns = new Map<string, number>();
    const queue: string[] = [];
    allNodeIds.forEach(id => {
      if (inDegree.get(id) === 0) {
        queue.push(id);
        baseColumns.set(id, 0);
      }
    });

    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      const uCol = baseColumns.get(u) ?? 0;

      for (const v of adj.get(u)!) {
        const vCol = baseColumns.get(v);
        if (vCol === undefined || vCol < uCol + 1) {
          baseColumns.set(v, uCol + 1);
        }
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    // Ensure all nodes have a column (fallback to 0 for any disconnected nodes).
    allNodeIds.forEach(id => {
      if (!baseColumns.has(id)) baseColumns.set(id, 0);
    });

    // Encourage terminal "final_good" nodes to appear at the far right.
    const maxBaseCol = Math.max(...Array.from(baseColumns.values()));
    graph.nodes.forEach(node => {
      if (node.kind === 'final_good' && baseColumns.has(node.id)) {
        baseColumns.set(node.id, maxBaseCol + 1);
      }
    });

    // Apply subsection-based horizontal separation (left-to-right, dependency-aware).
    const nodeToSubsection = new Map<string, string>();
    const subsectionOrderIndex = new Map<string, number>();
    (graph.subsections || []).forEach((sub, index) => {
      subsectionOrderIndex.set(sub.id, index);
      sub.nodeIds.forEach(nodeId => nodeToSubsection.set(nodeId, sub.id));
    });

    const subsectionRanges = new Map<string, { min: number; max: number }>();
    (graph.subsections || []).forEach(sub => {
      let min = Infinity;
      let max = -Infinity;
      sub.nodeIds.forEach(nodeId => {
        const col = baseColumns.get(nodeId);
        if (typeof col === 'number') {
          min = Math.min(min, col);
          max = Math.max(max, col);
        }
      });
      if (min !== Infinity && max !== -Infinity) {
        subsectionRanges.set(sub.id, { min, max });
      }
    });

    const subsectionIds = Array.from(subsectionRanges.keys());

    const subAdj = new Map<string, Set<string>>();
    const subInDegree = new Map<string, number>();
    subsectionIds.forEach(id => {
      subAdj.set(id, new Set());
      subInDegree.set(id, 0);
    });

    graph.edges.forEach(([from, to]) => {
      const fromSub = nodeToSubsection.get(from);
      const toSub = nodeToSubsection.get(to);
      if (!fromSub || !toSub || fromSub === toSub) return;
      if (!subAdj.has(fromSub) || !subAdj.has(toSub)) return;
      const edges = subAdj.get(fromSub)!;
      if (!edges.has(toSub)) {
        edges.add(toSub);
        subInDegree.set(toSub, (subInDegree.get(toSub) || 0) + 1);
      }
    });

    const compareSub = (a: string, b: string) => {
      const rangeA = subsectionRanges.get(a);
      const rangeB = subsectionRanges.get(b);
      const minA = rangeA ? rangeA.min : 0;
      const minB = rangeB ? rangeB.min : 0;
      if (minA !== minB) return minA - minB;
      const idxA = subsectionOrderIndex.get(a) ?? 0;
      const idxB = subsectionOrderIndex.get(b) ?? 0;
      return idxA - idxB;
    };

    const subQueue = subsectionIds.filter(id => (subInDegree.get(id) || 0) === 0).sort(compareSub);
    const orderedSubsections: string[] = [];
    while (subQueue.length > 0) {
      const current = subQueue.shift()!;
      orderedSubsections.push(current);
      for (const next of subAdj.get(current) || []) {
        subInDegree.set(next, (subInDegree.get(next) || 0) - 1);
        if ((subInDegree.get(next) || 0) === 0) {
          subQueue.push(next);
          subQueue.sort(compareSub);
        }
      }
    }

    // If subsection meta-graph had a cycle due to grouping, fall back to stable ordering by min column.
    const finalSubsectionOrder =
      orderedSubsections.length === subsectionIds.length
        ? orderedSubsections
        : [...subsectionIds].sort(compareSub);

    const subsectionShift = new Map<string, number>();
    const gapCols = 1;
    let cursorCol = -1;

    finalSubsectionOrder.forEach(subId => {
      const range = subsectionRanges.get(subId);
      if (!range) return;
      const shift = Math.max(0, cursorCol + gapCols - range.min);
      subsectionShift.set(subId, shift);
      cursorCol = Math.max(cursorCol, range.max + shift);
    });

    // Compute final columns (base + optional subsection shift), then compress to contiguous indices.
    const finalColumns = new Map<string, number>();
    allNodeIds.forEach(id => {
      const base = baseColumns.get(id) ?? 0;
      const subId = nodeToSubsection.get(id);
      const shift = subId ? subsectionShift.get(subId) || 0 : 0;
      finalColumns.set(id, base + shift);
    });

    // Spread independent nodes horizontally within subsections
    // Nodes in the same subsection and same column with no inter-dependencies should spread left-to-right
    (graph.subsections || []).forEach(sub => {
      // Group nodes by their current column
      const nodesByColumn = new Map<number, string[]>();
      sub.nodeIds.forEach(nodeId => {
        const col = finalColumns.get(nodeId);
        if (col !== undefined) {
          if (!nodesByColumn.has(col)) nodesByColumn.set(col, []);
          nodesByColumn.get(col)!.push(nodeId);
        }
      });

      // For each column with multiple nodes, check if they can be spread horizontally
      nodesByColumn.forEach((nodesInCol, col) => {
        if (nodesInCol.length <= 1) return;

        // Check which nodes have no dependencies on each other (can be parallel)
        const canSpread: string[] = [];
        nodesInCol.forEach(nodeId => {
          // A node can be spread if it has no dependencies to/from other nodes in this group
          const hasInternalDep = nodesInCol.some(otherId => {
            if (otherId === nodeId) return false;
            // Check if there's an edge between these nodes
            return graph.edges.some(([from, to]) =>
              (from === nodeId && to === otherId) || (from === otherId && to === nodeId)
            );
          });
          if (!hasInternalDep) {
            canSpread.push(nodeId);
          }
        });

        // Spread independent nodes across columns
        if (canSpread.length > 1) {
          // Find the max column shift needed to avoid collision with next subsection
          let colOffset = 0;
          canSpread.forEach((nodeId, index) => {
            if (index > 0) {
              // Assign to a new column (spreading horizontally)
              finalColumns.set(nodeId, col + index);
              colOffset = Math.max(colOffset, index);
            }
          });

          // Update the subsection shift for subsequent subsections
          if (colOffset > 0) {
            // Update cursor position for any following subsections
            const subIndex = finalSubsectionOrder.indexOf(sub.id);
            if (subIndex >= 0) {
              for (let i = subIndex + 1; i < finalSubsectionOrder.length; i++) {
                const nextSubId = finalSubsectionOrder[i];
                const currentShift = subsectionShift.get(nextSubId) || 0;
                subsectionShift.set(nextSubId, currentShift + colOffset);
                // Update all nodes in the next subsection
                const nextSub = (graph.subsections || []).find(s => s.id === nextSubId);
                if (nextSub) {
                  nextSub.nodeIds.forEach(nid => {
                    const currentCol = finalColumns.get(nid);
                    if (currentCol !== undefined) {
                      finalColumns.set(nid, currentCol + colOffset);
                    }
                  });
                }
              }
            }
          }
        }
      });
    });

    // Subsection spreading can push regular nodes to the right after the initial
    // terminal placement pass. Re-anchor final goods after every horizontal shift
    // so terminal outcome connectors do not run backward across the chart.
    const finalGoodIds = graph.nodes
      .filter(node => node.kind === 'final_good' && finalColumns.has(node.id))
      .map(node => node.id);

    if (finalGoodIds.length > 0) {
      const finalGoodIdSet = new Set(finalGoodIds);
      const furthestNonFinalColumn = Math.max(
        ...Array.from(finalColumns.entries())
          .filter(([id]) => !finalGoodIdSet.has(id))
          .map(([, col]) => col)
      );

      if (Number.isFinite(furthestNonFinalColumn)) {
        finalGoodIds.forEach(id => {
          finalColumns.set(id, Math.max(finalColumns.get(id) || 0, furthestNonFinalColumn + 1));
        });
      }
    }

    const uniqueCols = Array.from(new Set(finalColumns.values())).sort((a, b) => a - b);
    const colRemap = new Map<number, number>();
    uniqueCols.forEach((col, index) => colRemap.set(col, index));

    this.nodeColumns.clear();
    finalColumns.forEach((col, id) => {
      this.nodeColumns.set(id, colRemap.get(col) ?? col);
    });

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
    prevNodeInColumn?: { id: string, y: number, height: number }
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

    let startY = y_initial;

    // Enforce minimum distance from the previous node only when both nodes belong
    // to the same subsection grouping context.
    if (prevNodeInColumn) {
      const currentSubsection = this.nodeToSubsection.get(id);
      const previousSubsection = this.nodeToSubsection.get(prevNodeInColumn.id);
      if (currentSubsection === previousSubsection) {
        const minY = prevNodeInColumn.y + prevNodeInColumn.height + paddingY;
        if (startY < minY) {
          startY = minY;
        }
      }
    }

    // Create collision context
    const context: CollisionContext = {
      nodePositions: new Map(this.placedNodePositions.entries()),
      nodeKinds: new Map(this.nodeKinds.entries()),
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

    const kind = this.nodeKinds.get(nodeId);
    return this.collisionEngine.getNodeConnectionPoint(nodeId, pos, type, kind);
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

          const originalAY = posA.y;
          const originalBY = posB.y;

          // Swap Y positions
          posA.y = originalBY;
          posB.y = originalAY;

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
            // Revert exactly (the spacing "adjust" above can drift otherwise).
            posA.y = originalAY;
            posB.y = originalBY;
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

    if (from1 === from2 || from1 === to2 || to1 === from2 || to1 === to2) {
      return false;
    }

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

    const start1 = this.getNodeConnectionPoint(from1, null, 'output');
    const end1 = this.getNodeConnectionPoint(to1, null, 'input');
    const start2 = this.getNodeConnectionPoint(from2, null, 'output');
    const end2 = this.getNodeConnectionPoint(to2, null, 'input');

    if (!start1 || !end1 || !start2 || !end2) return false;

    const segments1 = buildConnectorSegments(start1, end1, 'horizontal-first');
    const segments2 = buildConnectorSegments(start2, end2, 'horizontal-first');

    return segments1.some(segment1 =>
      segments2.some(segment2 => this.segmentsIntersectMeaningfully(segment1, segment2))
    );
  }

  private segmentsIntersectMeaningfully(segment1: { start: { x: number; y: number }; end: { x: number; y: number } }, segment2: { start: { x: number; y: number }; end: { x: number; y: number } }): boolean {
    if (!CollisionDetector.linesIntersect(segment1, segment2)) {
      return false;
    }

    return !this.linesShareEndpoint(segment1, segment2);
  }

  private linesShareEndpoint(segment1: { start: { x: number; y: number }; end: { x: number; y: number } }, segment2: { start: { x: number; y: number }; end: { x: number; y: number } }): boolean {
    return this.pointsEqual(segment1.start, segment2.start) ||
      this.pointsEqual(segment1.start, segment2.end) ||
      this.pointsEqual(segment1.end, segment2.start) ||
      this.pointsEqual(segment1.end, segment2.end);
  }

  private pointsEqual(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
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
