import { LayoutEngine } from '../layout';
import { BOX_SIZE, INITIAL_X_OFFSET } from '../constants';

describe('Spacing effects on layout', () => {
  it('larger vertical padding yields larger Y', () => {
    const parentY = 0;
    const paddingX = 100;
    const engine1 = new LayoutEngine();
    const engine2 = new LayoutEngine();

    const col = 0;
    const x = INITIAL_X_OFFSET + (col * (BOX_SIZE.NODE.W + paddingX));
    engine1.recordNodePosition('n1', x, parentY, BOX_SIZE.NODE.W, 90);
    engine2.recordNodePosition('n1', x, parentY, BOX_SIZE.NODE.W, 90);

    const ySmall = engine1.findConflictFreeY('n2', col, 10, paddingX, 10, { id: 'n2', label: 'N2' }, new Map());
    const yLarge = engine2.findConflictFreeY('n3', col, 10, paddingX, 60, { id: 'n3', label: 'N3' }, new Map());

    expect(yLarge).toBeGreaterThan(ySmall);
  });

  it('many attributes increase node height and prevent overlap', () => {
    const engine = new LayoutEngine();

    // Place an existing node in column 1
    const paddingX = 100;
    const paddingY = 21;
    const col = 1;
    const x = INITIAL_X_OFFSET + (col * (BOX_SIZE.NODE.W + paddingX));
    engine.recordNodePosition('top', x, 0, BOX_SIZE.NODE.W, 90);

    // Calculate height for node with many attributes
    engine.calculateNodeHeights([
      { id: 'with_attrs', label: 'N', sources: ['A','B','C','D','E'], sinks: ['S1','S2'], values: ['V1','V2'] }
    ]);

    const y = engine.findConflictFreeY('with_attrs', col, 10, paddingX, paddingY, { id: 'with_attrs', label: 'N', sources: [], sinks: [], values: [] } as any, new Map());

    // Even if the node's own height is large, the engine should place its top below the top node's bottom + padding
    expect(y).toBeGreaterThanOrEqual(90 + paddingY);
  });
});

