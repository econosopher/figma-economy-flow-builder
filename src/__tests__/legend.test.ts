import { mockFigma } from './figma-mocks';

// Provide figma global
(global as any).figma = mockFigma as any;

import { extractCurrenciesByType, createLegendSection } from '../legend';
import { Graph } from '../types';

describe('Legend helpers', () => {
  it('extractCurrenciesByType returns sorted, unique lists', () => {
    const graph: Graph = {
      inputs: [],
      nodes: [
        { id: 'a', label: 'A', sources: ['Gold', 'Wood'] },
        { id: 'b', label: 'B', sinks: ['Gold'] },
        { id: 'c', label: 'C', values: ['XP'] }
      ],
      edges: []
    };
    const res = extractCurrenciesByType(graph);
    expect(res.sources).toEqual(['Gold', 'Wood']);
    expect(res.sinks).toEqual(['Gold']);
    expect(res.values).toEqual(['XP']);
  });

  it('createLegendSection builds a group with background + items', () => {
    const group = createLegendSection(
      { sources: ['Gold'], sinks: ['Energy'], values: ['XP'] },
      0
    );
    expect(group).toBeTruthy();
    if (group) {
      expect(group.type).toBe('GROUP');
      expect(group.name).toBe('Legend');
      // Background + 3 headers + 3 items => >= 7 nodes
      expect((group as any).children.length).toBeGreaterThanOrEqual(7);
    }
  });
});
