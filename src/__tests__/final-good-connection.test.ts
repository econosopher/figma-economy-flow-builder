import { CollisionEngine } from '../collision';

describe('CollisionEngine.getNodeConnectionPoint for final goods', () => {
  it('uses body (not header) for input connection on final goods', () => {
    const engine = new CollisionEngine();
    const headerHeight = 30; // engine assumes ~30
    const rect = { x: 100, y: 50, width: 144, height: 90 };

    const p = engine.getNodeConnectionPoint('some_final_good_node', rect as any, 'input');
    // y should be y + headerHeight + boxHeight/2
    const boxHeight = rect.height - headerHeight;
    const expectedY = rect.y + headerHeight + boxHeight / 2;
    expect(p.y).toBeCloseTo(expectedY);
    expect(p.x).toBe(rect.x);
  });
});

