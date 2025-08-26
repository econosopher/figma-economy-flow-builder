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

  it('createLegendSection builds a section with header + items', () => {
    const sec = createLegendSection(
      { sources: ['Gold'], sinks: ['Energy'], values: ['XP'] },
      0
    );
    expect(sec).toBeTruthy();
    if (sec) {
      expect(sec.type).toBe('SECTION');
      expect(sec.name).toBe('Legend');
      // Should have children added under section (headers + items)
      // At least 3 headers in columns; each with 1 item => >= 6 children
      expect((sec as any).children.length).toBeGreaterThanOrEqual(6);
    }
  });
});

