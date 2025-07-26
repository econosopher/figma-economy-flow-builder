/**
 * Collision resolution strategies
 */

import { Rectangle, Point, CollisionConfig, CollisionContext } from './types';
import { CollisionDetector } from './detector';

export class CollisionResolver {
  private config: CollisionConfig;

  constructor(config: CollisionConfig) {
    this.config = config;
  }

  /**
   * Find a collision-free position for a node
   */
  findCollisionFreePosition(
    nodeId: string,
    initialPosition: Point,
    nodeSize: Rectangle,
    context: CollisionContext
  ): Point {
    if (this.config.strategy === 'allow') {
      return initialPosition;
    }

    let position = { ...initialPosition };
    const step = 10; // Adjustment step size
    const maxIterations = 100;
    let iterations = 0;

    while (iterations < maxIterations) {
      const collisions = this.detectAllCollisions(nodeId, position, nodeSize, context);
      
      if (collisions.length === 0) {
        return position;
      }

      // Move position based on collision resolution strategy
      if (this.config.strategy === 'avoid') {
        position = this.resolveByAvoiding(position, nodeSize, collisions, step);
      } else if (this.config.strategy === 'minimize') {
        position = this.resolveByMinimizing(position, nodeSize, collisions, step);
      }

      iterations++;
    }

    return position;
  }

  /**
   * Detect all collisions for a node at a given position
   */
  private detectAllCollisions(
    nodeId: string,
    position: Point,
    nodeSize: Rectangle,
    context: CollisionContext
  ): Rectangle[] {
    const collisions: Rectangle[] = [];
    const testRect: Rectangle = {
      x: position.x,
      y: position.y,
      width: nodeSize.width,
      height: nodeSize.height
    };

    // Check node-to-node collisions
    if (this.config.nodeToNode) {
      for (const [id, rect] of context.nodePositions) {
        if (id !== nodeId && 
            CollisionDetector.rectanglesOverlap(testRect, rect, this.config.margin).collides) {
          collisions.push(rect);
        }
      }
    }

    return collisions;
  }

  /**
   * Resolve collisions by completely avoiding overlap
   */
  private resolveByAvoiding(
    position: Point,
    nodeSize: Rectangle,
    collisions: Rectangle[],
    step: number
  ): Point {
    // Find the direction with least resistance
    const directions = [
      { x: 0, y: step },   // Down
      { x: step, y: 0 },   // Right
      { x: 0, y: -step },  // Up
      { x: -step, y: 0 }   // Left
    ];

    let bestDirection = directions[0];
    let minCollisionDepth = Infinity;

    for (const dir of directions) {
      const testPos = { x: position.x + dir.x, y: position.y + dir.y };
      const testRect: Rectangle = {
        x: testPos.x,
        y: testPos.y,
        width: nodeSize.width,
        height: nodeSize.height
      };

      let totalDepth = 0;
      for (const collision of collisions) {
        const result = CollisionDetector.rectanglesOverlap(testRect, collision, this.config.margin);
        if (result.collides && result.penetration) {
          totalDepth += result.penetration.x + result.penetration.y;
        }
      }

      if (totalDepth < minCollisionDepth) {
        minCollisionDepth = totalDepth;
        bestDirection = dir;
      }
    }

    return { x: position.x + bestDirection.x, y: position.y + bestDirection.y };
  }

  /**
   * Resolve collisions by minimizing overlap
   */
  private resolveByMinimizing(
    position: Point,
    nodeSize: Rectangle,
    collisions: Rectangle[],
    step: number
  ): Point {
    // Push away from the center of mass of colliding rectangles
    let centerX = 0;
    let centerY = 0;

    for (const rect of collisions) {
      centerX += rect.x + rect.width / 2;
      centerY += rect.y + rect.height / 2;
    }

    centerX /= collisions.length;
    centerY /= collisions.length;

    const nodeCenter = {
      x: position.x + nodeSize.width / 2,
      y: position.y + nodeSize.height / 2
    };

    const pushDirection = {
      x: nodeCenter.x - centerX,
      y: nodeCenter.y - centerY
    };

    const magnitude = Math.sqrt(pushDirection.x ** 2 + pushDirection.y ** 2);
    if (magnitude > 0) {
      pushDirection.x = (pushDirection.x / magnitude) * step;
      pushDirection.y = (pushDirection.y / magnitude) * step;
    }

    return { x: position.x + pushDirection.x, y: position.y + pushDirection.y };
  }

  /**
   * Check if an edge would collide with any nodes
   */
  checkEdgeCollisions(
    fromNode: Rectangle,
    toNode: Rectangle,
    nodePositions: Map<string, Rectangle>,
    excludeIds: Set<string> = new Set()
  ): string[] {
    const collidingNodes: string[] = [];
    
    if (!this.config.edgeToNode) {
      return collidingNodes;
    }

    // Create line from center of fromNode to center of toNode
    const line = {
      start: { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 },
      end: { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 }
    };

    for (const [nodeId, rect] of nodePositions) {
      if (!excludeIds.has(nodeId) && 
          CollisionDetector.lineIntersectsRectangle(line, rect, this.config.margin).collides) {
        collidingNodes.push(nodeId);
      }
    }

    return collidingNodes;
  }
}