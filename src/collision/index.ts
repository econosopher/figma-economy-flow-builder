/**
 * Main collision module that provides a clean API for collision detection and resolution
 */

export * from './types';
export * from './detector';
export * from './resolver';

import { CollisionConfig, CollisionContext, Rectangle, Point, Line } from './types';
import { CollisionDetector } from './detector';
import { CollisionResolver } from './resolver';

export class CollisionEngine {
  private detector = CollisionDetector;
  private resolver: CollisionResolver;
  private config: CollisionConfig;

  constructor(config?: Partial<CollisionConfig>) {
    this.config = {
      strategy: 'avoid',
      nodeToNode: true,
      edgeToNode: true,
      edgeToEdge: false,
      margin: 20, // Default margin for collision detection
      ...config
    };
    this.resolver = new CollisionResolver(this.config);
  }

  /**
   * Find a conflict-free Y position for a node
   */
  findConflictFreeY(
    nodeId: string,
    x: number,
    initialY: number,
    nodeWidth: number,
    nodeHeight: number,
    context: CollisionContext,
    parentIds: string[] = []
  ): number {
    const nodeRect: Rectangle = { x, y: initialY, width: nodeWidth, height: nodeHeight };

    // First resolve direct rectangle overlaps so we have a stable baseline
    const resolvedY = this.resolveNodeOverlaps(nodeId, nodeRect, context);

    // Then resolve edge collisions which may adjust the Y position further
    const edgeSafeY = this.config.edgeToNode && parentIds.length > 0
      ? this.resolveEdgeOverlaps(nodeId, parentIds, nodeRect, context)
      : resolvedY;

    // If edge resolution pushed us down into other nodes, run a final overlap pass
    if (edgeSafeY !== resolvedY) {
      nodeRect.y = edgeSafeY;
      return this.resolveNodeOverlaps(nodeId, nodeRect, context);
    }

    return edgeSafeY;
  }

  /**
   * Resolve rectangle overlaps between the candidate node and already placed nodes
   */
  private resolveNodeOverlaps(
    nodeId: string,
    nodeRect: Rectangle,
    context: CollisionContext
  ): number {
    let positionChanged = true;
    let iterations = 0;
    const maxIterations = 100;

    while (positionChanged && iterations < maxIterations) {
      positionChanged = false;
      iterations++;

      if (this.config.nodeToNode) {
        for (const [id, pos] of context.nodePositions) {
          if (id === nodeId) continue;
          const collision = this.detector.rectanglesOverlap(nodeRect, pos, this.config.margin);
          if (collision.collides) {
            const newY = pos.y + pos.height + context.padding.y + this.config.margin;
            if (newY > nodeRect.y) {
              nodeRect.y = newY;
              positionChanged = true;
            }
          }
        }
      }
    }

    return nodeRect.y;
  }

  /**
   * Resolve edge collisions by modelling the elbow connector path
   */
  private resolveEdgeOverlaps(
    nodeId: string,
    parentIds: string[],
    nodeRect: Rectangle,
    context: CollisionContext
  ): number {
    const orientations: Array<'horizontal-first' | 'vertical-first'> = ['horizontal-first', 'vertical-first'];
    const candidates: number[] = [];

    for (const orientation of orientations) {
      const candidate = this.resolveEdgeOverlapsForOrientation(
        nodeId,
        parentIds,
        { ...nodeRect },
        context,
        orientation
      );
      if (candidate !== null) {
        candidates.push(candidate);
      }
    }

    if (candidates.length === 0) {
      return nodeRect.y;
    }

    return Math.min(...candidates);
  }

  private resolveEdgeOverlapsForOrientation(
    nodeId: string,
    parentIds: string[],
    testRect: Rectangle,
    context: CollisionContext,
    orientation: 'horizontal-first' | 'vertical-first'
  ): number | null {
    let adjusted = true;
    let iterations = 0;
    const maxIterations = 50;

    while (adjusted && iterations < maxIterations) {
      adjusted = false;
      iterations++;

      for (const parentId of parentIds) {
        const parentPos = context.nodePositions.get(parentId);
        if (!parentPos) continue;

        const edgeStart = this.getNodeConnectionPoint(parentId, parentPos, 'output');
        const edgeEnd = this.getNodeConnectionPoint(nodeId, testRect, 'input');
        const segments = this.buildElbowSegments(edgeStart, edgeEnd, orientation);

        for (const [id, pos] of context.nodePositions) {
          if (id === nodeId || id === parentId) continue;
          if (this.pathIntersectsRectangle(segments, pos)) {
            const pushY = pos.y + pos.height + context.padding.y + this.config.margin * 2;
            if (pushY > testRect.y) {
              testRect.y = pushY;
              adjusted = true;
              break;
            }
          }
        }

        if (adjusted) {
          break;
        }
      }
    }

    // Ensure the final layout for this orientation is collision free
    for (const parentId of parentIds) {
      const parentPos = context.nodePositions.get(parentId);
      if (!parentPos) continue;
      const edgeStart = this.getNodeConnectionPoint(parentId, parentPos, 'output');
      const edgeEnd = this.getNodeConnectionPoint(nodeId, testRect, 'input');
      const segments = this.buildElbowSegments(edgeStart, edgeEnd, orientation);

      for (const [id, pos] of context.nodePositions) {
        if (id === nodeId || id === parentId) continue;
        if (this.pathIntersectsRectangle(segments, pos)) {
          return null;
        }
      }
    }

    return testRect.y;
  }

  private buildElbowSegments(
    start: Point,
    end: Point,
    orientation: 'horizontal-first' | 'vertical-first'
  ): Line[] {
    if (start.x === end.x || start.y === end.y) {
      return [{ start, end }];
    }

    if (orientation === 'vertical-first') {
      const verticalTurn: Point = { x: start.x, y: end.y };
      const segments: Line[] = [];
      if (start.x !== verticalTurn.x || start.y !== verticalTurn.y) {
        segments.push({ start, end: verticalTurn });
      }
      if (verticalTurn.x !== end.x || verticalTurn.y !== end.y) {
        segments.push({ start: verticalTurn, end });
      }
      return segments.length > 0 ? segments : [{ start, end }];
    }

    const midX = start.x + (end.x - start.x) / 2;
    const horizontal1End: Point = { x: midX, y: start.y };
    const verticalEnd: Point = { x: midX, y: end.y };

    const segments: Line[] = [];
    if (start.x !== horizontal1End.x || start.y !== horizontal1End.y) {
      segments.push({ start, end: horizontal1End });
    }
    if (horizontal1End.x !== verticalEnd.x || horizontal1End.y !== verticalEnd.y) {
      segments.push({ start: horizontal1End, end: verticalEnd });
    }
    if (verticalEnd.x !== end.x || verticalEnd.y !== end.y) {
      segments.push({ start: verticalEnd, end });
    }

    return segments.length > 0 ? segments : [{ start, end }];
  }

  private pathIntersectsRectangle(segments: Line[], rect: Rectangle): boolean {
    return segments.some(segment =>
      this.detector.lineIntersectsRectangle(segment, rect, this.config.margin).collides
    );
  }

  /**
   * Get the connection point for a node (handles special cases like final goods)
   */
  getNodeConnectionPoint(nodeId: string, rect: Rectangle, type: 'input' | 'output'): Point {
    // Special handling for final goods nodes
    if (nodeId.includes('final_good')) {
      if (type === 'input') {
        // For final goods, connect to the middle of the orange box, not the header
        // Assuming header is ~30px, connect to middle of remaining height
        const headerHeight = 30;
        const boxHeight = rect.height - headerHeight;
        return {
          x: rect.x,
          y: rect.y + headerHeight + boxHeight / 2
        };
      }
    }

    // Default connection points
    if (type === 'input') {
      return { x: rect.x, y: rect.y + rect.height / 2 };
    } else {
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    }
  }

  /**
   * Calculate subsection bounds with proper margins
   */
  calculateSubsectionBounds(
    nodes: Rectangle[],
    sectionPadding: { top: number; right: number; bottom: number; left: number }
  ): Rectangle {
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    // Apply padding with extra margins for initial boxes
    return {
      x: minX - sectionPadding.left,
      y: minY - sectionPadding.top,
      width: (maxX - minX) + sectionPadding.left + sectionPadding.right,
      height: (maxY - minY) + sectionPadding.top + sectionPadding.bottom
    };
  }

  /**
   * Check if nodes would overlap
   */
  checkOverlap(rect1: Rectangle, rect2: Rectangle): boolean {
    return this.detector.rectanglesOverlap(rect1, rect2, this.config.margin).collides;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CollisionConfig>) {
    this.config = { ...this.config, ...config };
    this.resolver = new CollisionResolver(this.config);
  }
}
