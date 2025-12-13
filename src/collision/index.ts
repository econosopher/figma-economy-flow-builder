/**
 * Main collision module that provides a clean API for collision detection and resolution
 */

export * from './types';
export * from './detector';
export * from './resolver';

import { CollisionConfig, CollisionContext, Rectangle, Point, Line } from './types';
import { CollisionDetector } from './detector';
import { CollisionResolver } from './resolver';
import { SpatialGrid } from './spatial-grid';

export class CollisionEngine {
  private detector = CollisionDetector;
  private resolver: CollisionResolver;
  private config: CollisionConfig;
  private spatialGrid: SpatialGrid;

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
    this.spatialGrid = new SpatialGrid(100);
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

    // Populate spatial grid with existing nodes
    this.spatialGrid.clear();
    for (const [id, pos] of context.nodePositions) {
      if (id !== nodeId) {
        this.spatialGrid.insert(id, pos);
      }
    }

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
        // Use spatial grid to query potential collisions
        const queryRect = this.expandRect(nodeRect, this.config.margin);
        const potentialColliders = this.spatialGrid.query(queryRect);

        for (const id of potentialColliders) {
          const pos = context.nodePositions.get(id);
          if (!pos) continue;

          const collision = this.detector.rectanglesOverlap(nodeRect, pos, this.config.margin);
          if (collision.collides) {
            const safePaddingY = Number.isFinite(context.padding.y) ? context.padding.y : 0;
            const safeMargin = Number.isFinite(this.config.margin) ? Math.max(0, this.config.margin) : 0;
            const requiredY = pos.y + pos.height + safePaddingY + safeMargin;
            const nextY = requiredY > nodeRect.y ? requiredY : nodeRect.y + 1;
            if (nextY !== nodeRect.y) {
              nodeRect.y = nextY;
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
    let currentY = testRect.y;
    const maxPushDown = 500; // Maximum pixels to push down to find a path
    const step = 20; // Step size for searching
    let totalPush = 0;

    while (totalPush < maxPushDown) {
      let collisionFound = false;
      const currentRect = { ...testRect, y: currentY };

      for (const parentId of parentIds) {
        const parentPos = context.nodePositions.get(parentId);
        if (!parentPos) continue;

        const edgeStart = this.getNodeConnectionPoint(parentId, parentPos, 'output');
        const edgeEnd = this.getNodeConnectionPoint(nodeId, currentRect, 'input');

        // Use A* pathfinding to check if a valid path exists
        // We use a simplified check: if A* finds a path, we assume the elbow connector *might* work
        // or at least it's a better bet than a blocked straight line.
        // Ideally, we'd check if the specific elbow path is clear, but A* gives us a "reachability" check.
        // For strict elbow compliance, we can still use the segment check, but fallback to A* if needed?
        // Actually, let's stick to the segment check for strict visual compliance with Figma's default connectors,
        // BUT use the spatial grid for performance.

        const segments = this.buildElbowSegments(edgeStart, edgeEnd, orientation);

        // Check segments against obstacles using spatial grid would be ideal, 
        // but segments are lines, not rects. We can approximate segments as rects.

        for (const segment of segments) {
          // Create a bounding box for the segment
          const segmentRect: Rectangle = {
            x: Math.min(segment.start.x, segment.end.x),
            y: Math.min(segment.start.y, segment.end.y),
            width: Math.abs(segment.end.x - segment.start.x),
            height: Math.abs(segment.end.y - segment.start.y)
          };

          const queryRect = this.expandRect(segmentRect, this.config.margin);
          const potentialColliders = this.spatialGrid.query(queryRect);

          for (const id of potentialColliders) {
            if (id === nodeId || id === parentId) continue;
            const pos = context.nodePositions.get(id);
            if (pos && this.detector.lineIntersectsRectangle(segment, pos, this.config.margin).collides) {
              collisionFound = true;
              break;
            }
          }
          if (collisionFound) break;
        }

        if (collisionFound) break;
      }

      if (!collisionFound) {
        // Also check if the new node position itself collides with anything
        // This is a double-check because moving the node might create new node-to-node collisions
        let nodeCollision = false;
        if (this.config.nodeToNode) {
          const queryRect = this.expandRect(currentRect, this.config.margin);
          const potentialColliders = this.spatialGrid.query(queryRect);
          for (const id of potentialColliders) {
            if (id === nodeId) continue;
            const pos = context.nodePositions.get(id);
            if (pos && this.detector.rectanglesOverlap(currentRect, pos, this.config.margin).collides) {
              nodeCollision = true;
              break;
            }
          }
        }

        if (!nodeCollision) {
          return currentY;
        }
      }

      // If collision, push down and try again
      currentY += step;
      totalPush += step;
    }

    return null;
  }

  /**
   * Build elbow connector segments that better match Figma's actual routing.
   * Figma typically uses a 3-segment elbow: horizontal -> vertical -> horizontal
   * when connecting nodes left-to-right.
   */
  private buildElbowSegments(
    start: Point,
    end: Point,
    orientation: 'horizontal-first' | 'vertical-first'
  ): Line[] {
    // Handle degenerate cases
    if (Math.abs(start.x - end.x) < 1 && Math.abs(start.y - end.y) < 1) {
      return [];
    }

    // Straight horizontal line
    if (Math.abs(start.y - end.y) < 1) {
      return [{ start, end }];
    }

    // Straight vertical line
    if (Math.abs(start.x - end.x) < 1) {
      return [{ start, end }];
    }

    if (orientation === 'vertical-first') {
      // Two-segment L-shape: vertical then horizontal
      const turn: Point = { x: start.x, y: end.y };
      return [
        { start, end: turn },
        { start: turn, end }
      ];
    }

    // Default: 3-segment S-shape (Figma's typical left-to-right connector)
    // horizontal -> vertical -> horizontal
    const midX = start.x + (end.x - start.x) / 2;

    const segments: Line[] = [
      // First horizontal segment from start to midpoint X
      { start, end: { x: midX, y: start.y } },
      // Vertical segment at midpoint
      { start: { x: midX, y: start.y }, end: { x: midX, y: end.y } },
      // Final horizontal segment to end
      { start: { x: midX, y: end.y }, end }
    ];

    // Filter out zero-length segments
    return segments.filter(seg =>
      Math.abs(seg.start.x - seg.end.x) > 0.5 ||
      Math.abs(seg.start.y - seg.end.y) > 0.5
    );
  }

  private expandRect(rect: Rectangle, amount: number): Rectangle {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (safeAmount === 0) return rect;
    return {
      x: rect.x - safeAmount,
      y: rect.y - safeAmount,
      width: rect.width + safeAmount * 2,
      height: rect.height + safeAmount * 2
    };
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
   * Resolve overlaps between subsection bounds.
   * Returns adjusted bounds for each subsection.
   */
  resolveSubsectionOverlaps(
    subsections: Array<{ id: string; bounds: Rectangle }>
  ): Map<string, Rectangle> {
    const result = new Map<string, Rectangle>();

    // Sort subsections by their top-left position (top to bottom, left to right)
    const sorted = [...subsections].sort((a, b) => {
      if (Math.abs(a.bounds.x - b.bounds.x) > 50) {
        return a.bounds.x - b.bounds.x;
      }
      return a.bounds.y - b.bounds.y;
    });

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const adjustedBounds = { ...current.bounds };

      // Check against all previously placed subsections
      for (let j = 0; j < i; j++) {
        const other = result.get(sorted[j].id);
        if (!other) continue;

        const collision = this.detector.rectanglesOverlap(adjustedBounds, other, 20);
        if (collision.collides) {
          // Push current subsection down to avoid overlap
          const overlapBottom = other.y + other.height + 30; // 30px gap
          if (adjustedBounds.y < overlapBottom) {
            adjustedBounds.y = overlapBottom;
          }
        }
      }

      result.set(current.id, adjustedBounds);
    }

    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CollisionConfig>) {
    this.config = { ...this.config, ...config };
    this.resolver = new CollisionResolver(this.config);
  }
}
