import { CollisionDetector } from '../collision/detector';

describe('CollisionDetector', () => {
  it('rectanglesOverlap detects overlap and margin', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 9, y: 9, width: 10, height: 10 };
    const noMargin = CollisionDetector.rectanglesOverlap(a, b, 0);
    expect(noMargin.collides).toBe(true);

    const separated = { x: 25, y: 0, width: 10, height: 10 };
    const withMargin = CollisionDetector.rectanglesOverlap(a, separated, 5);
    expect(withMargin.collides).toBe(false);
  });

  it('rectanglesOverlap returns non-negative penetration when colliding due to margin', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 25, y: 0, width: 10, height: 10 }; // 15px gap in X
    const result = CollisionDetector.rectanglesOverlap(a, b, 20); // margin > gap => collision
    expect(result.collides).toBe(true);
    expect(result.penetration).toBeDefined();
    expect(result.penetration!.x).toBeGreaterThanOrEqual(0);
    expect(result.penetration!.y).toBeGreaterThanOrEqual(0);
  });

  it('lineIntersectsRectangle detects intersections', () => {
    const rect = { x: 10, y: 10, width: 10, height: 10 };
    const line = { start: { x: 0, y: 15 }, end: { x: 30, y: 15 } };
    const result = CollisionDetector.lineIntersectsRectangle(line as any, rect, 0);
    expect(result.collides).toBe(true);

    const miss = { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } };
    expect(CollisionDetector.lineIntersectsRectangle(miss as any, rect, 0).collides).toBe(false);
  });
});
