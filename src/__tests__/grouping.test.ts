import { mockFigma, MockGroupNode, MockConnectorNode, MockShapeWithTextNode } from './figma-mocks';

(global as any).figma = mockFigma as any;

import { reorderConnectorsBehind } from '../grouping';

describe('reorderConnectorsBehind', () => {
  it('moves connectors behind other nodes (connectors first in child order)', () => {
    const group = new MockGroupNode();

    const a = new MockShapeWithTextNode(); a.name = 'A';
    const c1 = new MockConnectorNode(); c1.name = 'C1';
    const b = new MockShapeWithTextNode(); b.name = 'B';
    const c2 = new MockConnectorNode(); c2.name = 'C2';

    group.appendChild(a);
    group.appendChild(c1);
    group.appendChild(b);
    group.appendChild(c2);

    // Initial order: A, C1, B, C2
    expect(group.children.map(ch => ch.name)).toEqual(['A', 'C1', 'B', 'C2']);

    reorderConnectorsBehind(group as any);

    // After reorder: C1, C2, A, B
    expect(group.children.map(ch => ch.name)).toEqual(['C1', 'C2', 'A', 'B']);
  });

  it('does not duplicate children when appending existing nodes', () => {
    const group = new MockGroupNode();
    const c = new MockConnectorNode(); c.name = 'C';
    const n = new MockShapeWithTextNode(); n.name = 'N';
    group.appendChild(c);
    group.appendChild(n);

    reorderConnectorsBehind(group as any);
    reorderConnectorsBehind(group as any); // idempotent on content / reorders only

    const names = group.children.map(ch => ch.name);
    expect(names).toEqual(['C', 'N']);
  });
});

