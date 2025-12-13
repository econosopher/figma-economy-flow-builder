/**
 * Collision detection algorithms
 */

import { Rectangle, Point, Line, CollisionResult } from './types';

export class CollisionDetector {
  /**
   * Check if two rectangles overlap
   */
  static rectanglesOverlap(rect1: Rectangle, rect2: Rectangle, margin: number = 0): CollisionResult {
    const safeMargin = Number.isFinite(margin) ? Math.max(0, margin) : 0;
    const halfMargin = safeMargin / 2;

    // Treat margin as required separation between rectangles by expanding both by half the margin.
    // This preserves existing "touching counts as collision" semantics via strict `<` comparisons.
    const rect1Left = rect1.x - halfMargin;
    const rect1Right = rect1.x + rect1.width + halfMargin;
    const rect1Top = rect1.y - halfMargin;
    const rect1Bottom = rect1.y + rect1.height + halfMargin;

    const rect2Left = rect2.x - halfMargin;
    const rect2Right = rect2.x + rect2.width + halfMargin;
    const rect2Top = rect2.y - halfMargin;
    const rect2Bottom = rect2.y + rect2.height + halfMargin;

    const overlap = !(
      rect1Right < rect2Left ||
      rect2Right < rect1Left ||
      rect1Bottom < rect2Top ||
      rect2Bottom < rect1Top
    );

    if (!overlap) {
      return { collides: false };
    }

    // Calculate overlap/penetration depth for the expanded rectangles.
    // This stays non-negative even when the collision is caused purely by `margin`.
    const xPenetration = Math.min(rect1Right, rect2Right) - Math.max(rect1Left, rect2Left);
    const yPenetration = Math.min(rect1Bottom, rect2Bottom) - Math.max(rect1Top, rect2Top);

    return {
      collides: true,
      penetration: { x: xPenetration, y: yPenetration }
    };
  }

  /**
   * Check if a line intersects with a rectangle
   */
  static lineIntersectsRectangle(line: Line, rect: Rectangle, margin: number = 0): CollisionResult {
    const safeMargin = Number.isFinite(margin) ? Math.max(0, margin) : 0;
    // Expand rectangle by margin
    const expandedRect: Rectangle = {
      x: rect.x - safeMargin,
      y: rect.y - safeMargin,
      width: rect.width + 2 * safeMargin,
      height: rect.height + 2 * safeMargin
    };

    // Check if either endpoint is inside the rectangle
    if (this.pointInRectangle(line.start, expandedRect) || 
        this.pointInRectangle(line.end, expandedRect)) {
      return { collides: true };
    }

    // Check line intersection with all four edges of the rectangle
    const edges: Line[] = [
      { start: { x: expandedRect.x, y: expandedRect.y }, 
        end: { x: expandedRect.x + expandedRect.width, y: expandedRect.y } },
      { start: { x: expandedRect.x + expandedRect.width, y: expandedRect.y }, 
        end: { x: expandedRect.x + expandedRect.width, y: expandedRect.y + expandedRect.height } },
      { start: { x: expandedRect.x + expandedRect.width, y: expandedRect.y + expandedRect.height }, 
        end: { x: expandedRect.x, y: expandedRect.y + expandedRect.height } },
      { start: { x: expandedRect.x, y: expandedRect.y + expandedRect.height }, 
        end: { x: expandedRect.x, y: expandedRect.y } }
    ];

    for (const edge of edges) {
      if (this.linesIntersect(line, edge)) {
        return { collides: true };
      }
    }

    return { collides: false };
  }

  /**
   * Check if a point is inside a rectangle
   */
  static pointInRectangle(point: Point, rect: Rectangle): boolean {
    return point.x >= rect.x && 
           point.x <= rect.x + rect.width &&
           point.y >= rect.y && 
           point.y <= rect.y + rect.height;
  }

  /**
   * Check if two lines intersect
   */
  static linesIntersect(line1: Line, line2: Line): boolean {
    const det = (line1.end.x - line1.start.x) * (line2.end.y - line2.start.y) - 
                (line2.end.x - line2.start.x) * (line1.end.y - line1.start.y);
    
    if (det === 0) return false; // Lines are parallel

    const lambda = ((line2.end.y - line2.start.y) * (line2.end.x - line1.start.x) + 
                   (line2.start.x - line2.end.x) * (line2.end.y - line1.start.y)) / det;
    const gamma = ((line1.start.y - line1.end.y) * (line2.end.x - line1.start.x) + 
                  (line1.end.x - line1.start.x) * (line2.end.y - line1.start.y)) / det;

    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  }

  /**
   * Find the minimum distance between two rectangles
   */
  static rectangleDistance(rect1: Rectangle, rect2: Rectangle): number {
    const xDist = Math.max(0, Math.max(rect1.x - (rect2.x + rect2.width), rect2.x - (rect1.x + rect1.width)));
    const yDist = Math.max(0, Math.max(rect1.y - (rect2.y + rect2.height), rect2.y - (rect1.y + rect1.height)));
    return Math.sqrt(xDist * xDist + yDist * yDist);
  }

  /**
   * Check collision between a horizontal line and multiple rectangles in a range
   */
  static horizontalLineCollidesInRange(
    y: number, 
    xStart: number, 
    xEnd: number, 
    rectangles: Rectangle[], 
    margin: number = 0
  ): Rectangle[] {
    const line: Line = {
      start: { x: Math.min(xStart, xEnd), y },
      end: { x: Math.max(xStart, xEnd), y }
    };

    return rectangles.filter(rect => 
      this.lineIntersectsRectangle(line, rect, margin).collides
    );
  }
}
