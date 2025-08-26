import { CollisionEngine } from '../collision';

describe('CollisionEngine.findConflictFreeY - edge to node avoidance', () => {
  it('pushes node down to avoid crossing an intermediate node', () => {
    const engine = new CollisionEngine({ margin: 10, edgeToNode: true });

    // Parent at (0, 0), size 144x90
    const parentId = 'parent';
    const parentRect = { x: 0, y: 0, width: 144, height: 90 };

    // Intermediate node in-between columns that an edge could cross
    const blockerId = 'blocker';
    const blockerRect = { x: 150, y: 40, width: 144, height: 90 };

    const context = {
      nodePositions: new Map<string, any>([
        [parentId, parentRect],
        [blockerId, blockerRect]
      ]),
      edges: [],
      padding: { x: 100, y: 21 }
    };

    const nodeId = 'child';
    const x = 300; // next column
    const initialY = 0; // would route through blocker
    const nodeWidth = 144;
    const nodeHeight = 90;

    const y = engine.findConflictFreeY(
      nodeId,
      x,
      initialY,
      nodeWidth,
      nodeHeight,
      context as any,
      [parentId]
    );

    // Expect y to be pushed below blocker bottom + padding + margin*2
    const expectedMinY = blockerRect.y + blockerRect.height + context.padding.y + 10 * 2;
    expect(y).toBeGreaterThanOrEqual(expectedMinY);
  });
});

