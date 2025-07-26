/**
 * Main collision module that provides a clean API for collision detection and resolution
 */

export * from './types';
export * from './detector';
export * from './resolver';

import { CollisionConfig, CollisionContext, Rectangle, Point } from './types';
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
    let nodeRect: Rectangle = { x, y: initialY, width: nodeWidth, height: nodeHeight };
    let maxY = initialY;
    let positionChanged = true;

    // Keep checking collisions until no more position changes are needed
    while (positionChanged) {
      positionChanged = false;
      
      // Check node-to-node collisions
      if (this.config.nodeToNode) {
        for (const [id, pos] of context.nodePositions) {
          if (id !== nodeId) {
            const collision = this.detector.rectanglesOverlap(nodeRect, pos, this.config.margin);
            if (collision.collides) {
              // Push down below the colliding node with extra margin
              const newY = pos.y + pos.height + context.padding.y + this.config.margin;
              if (newY > maxY) {
                maxY = newY;
                nodeRect.y = maxY; // Update the node rectangle position
                positionChanged = true;
              }
            }
          }
        }
      }
    }

    // Check edge-to-node collisions
    if (this.config.edgeToNode && parentIds.length > 0) {
      for (const parentId of parentIds) {
        const parentPos = context.nodePositions.get(parentId);
        if (!parentPos) continue;

        // Calculate the edge line
        const edgeLine = {
          start: this.getNodeConnectionPoint(parentId, parentPos, 'output'),
          end: this.getNodeConnectionPoint(nodeId, { ...nodeRect, y: maxY }, 'input')
        };

        // Check if edge intersects with any intermediate nodes
        for (const [id, pos] of context.nodePositions) {
          if (id !== nodeId && id !== parentId) {
            const collision = this.detector.lineIntersectsRectangle(
              edgeLine, 
              pos, 
              this.config.margin
            );
            if (collision.collides) {
              // Push down with extra margin to avoid edge overlap
              maxY = Math.max(maxY, pos.y + pos.height + context.padding.y + this.config.margin * 2);
            }
          }
        }
      }
    }

    return maxY;
  }

  /**
   * Get the connection point for a node (handles special cases like final goods)
   */
  getNodeConnectionPoint(nodeId: string, rect: Rectangle, type: 'input' | 'output'): Point {
    // Special handling for final goods nodes
    if (nodeId.includes('finalGood') || nodeId.includes('final_good')) {
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