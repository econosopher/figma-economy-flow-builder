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

  it('lineIntersectsRectangle detects intersections', () => {
    const rect = { x: 10, y: 10, width: 10, height: 10 };
    const line = { start: { x: 0, y: 15 }, end: { x: 30, y: 15 } };
    const result = CollisionDetector.lineIntersectsRectangle(line as any, rect, 0);
    expect(result.collides).toBe(true);

    const miss = { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } };
    expect(CollisionDetector.lineIntersectsRectangle(miss as any, rect, 0).collides).toBe(false);
  });
});

