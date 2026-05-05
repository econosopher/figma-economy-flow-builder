import { CollisionEngine } from '../collision';

describe('CollisionEngine.getNodeConnectionPoint for final goods', () => {
  it('uses body (not header) for input connection on final goods', () => {
    const engine = new CollisionEngine();
    const headerHeight = 24;
    const rect = { x: 100, y: 50, width: 144, height: 90 };

    const p = engine.getNodeConnectionPoint('win', rect as any, 'input', 'final_good');
    // y should be y + headerHeight + boxHeight/2
    const boxHeight = rect.height - headerHeight;
    const expectedY = rect.y + headerHeight + boxHeight / 2;
    expect(p.y).toBeCloseTo(expectedY);
    expect(p.x).toBe(rect.x);
  });
});
