import { LayoutEngine } from '../layout';
import { Graph } from '../types';

describe('LayoutEngine', () => {
  let engine: LayoutEngine;

  beforeEach(() => {
    engine = new LayoutEngine();
  });

  describe('calculateNodeHeights', () => {
    it('should calculate correct height for input nodes', () => {
      const nodes = [
        { id: 'time', label: 'Time', kind: 'initial_sink_node' as const }
      ];

      engine.calculateNodeHeights(nodes);
      expect(engine.getNodeHeight('time')).toBe(90); // BOX_SIZE.INPUT.H is same as NODE.H
    });

    it('should calculate correct height for nodes with attributes', () => {
      const nodes = [
        { 
          id: 'play', 
          label: 'Play Game', 
          sources: ['XP', 'Gold'],
          sinks: ['Energy'],
          values: ['Score']
        }
      ];

      engine.calculateNodeHeights(nodes);
      // Base height (90) + 4 attributes * (20 + 5) + 5 = 195
      expect(engine.getNodeHeight('play')).toBe(195);
    });

    it('should calculate correct height for final good nodes', () => {
      const nodes = [
        { id: 'win', label: 'Victory', kind: 'final_good' }
      ];

      engine.calculateNodeHeights(nodes);
      expect(engine.getNodeHeight('win')).toBe(90); // BOX_SIZE.NODE.H
    });
  });

  describe('calculateColumns', () => {
    it('should place nodes with no dependencies in column 0', () => {
      const graph: Graph = {
        inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
        nodes: [{ id: 'play', label: 'Play' }],
        edges: []
      };

      const columns = engine.calculateColumns(graph);
      expect(columns[0]).toContain('time');
      expect(columns[0]).toContain('play');
    });

    it('should place dependent nodes in subsequent columns', () => {
      const graph: Graph = {
        inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
        nodes: [
          { id: 'play', label: 'Play' },
          { id: 'win', label: 'Win' }
        ],
        edges: [
          ['time', 'play'],
          ['play', 'win']
        ]
      };

      const columns = engine.calculateColumns(graph);
      expect(columns[0]).toContain('time');
      expect(columns[1]).toContain('play');
      expect(columns[2]).toContain('win');
    });

    it('should handle multiple dependencies correctly', () => {
      const graph: Graph = {
        inputs: [
          { id: 'time', label: 'Time', kind: 'initial_sink_node' },
          { id: 'money', label: 'Money', kind: 'initial_sink_node' }
        ],
        nodes: [
          { id: 'buy', label: 'Buy Item' },
          { id: 'equip', label: 'Equip Item' }
        ],
        edges: [
          ['money', 'buy'],
          ['time', 'equip'],
          ['buy', 'equip']
        ]
      };

      const columns = engine.calculateColumns(graph);
      expect(columns[0]).toContain('time');
      expect(columns[0]).toContain('money');
      expect(columns[1]).toContain('buy');
      expect(columns[2]).toContain('equip');
    });

    it('should place reconverging nodes in appropriate later columns', () => {
      const graph: Graph = {
        inputs: [
          { id: 'time', label: 'Time', kind: 'initial_sink_node' }
        ],
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' }
        ],
        edges: [
          ['time', 'a'],
          ['time', 'b'],
          ['a', 'c'],
          ['b', 'c']
        ]
      };

      const columns = engine.calculateColumns(graph);
      expect(columns[0]).toContain('time');
      // A and B can both be in column 1
      expect(columns[1]).toEqual(expect.arrayContaining(['a', 'b']));
      // C should be in column 2
      expect(columns[2]).toContain('c');
    });
  });

  describe('findConflictFreeY', () => {
    it('should return initial Y when no conflicts', () => {
      const result = engine.findConflictFreeY(
        'node1',
        0,
        100,
        100,
        40,
        { id: 'node1', label: 'Node 1' },
        new Map()
      );

      expect(result).toBe(100);
    });

    it('should avoid overlapping nodes', () => {
      // Record an existing node position
      engine.recordNodePosition('existing', 0, 50, 144, 72);

      const result = engine.findConflictFreeY(
        'new',
        0, // Same column
        60, // Would overlap
        100,
        40,
        { id: 'new', label: 'New Node' },
        new Map()
      );

      // Should be pushed down: 50 + 72 + 40 + 14 = 176 (using collision margin of 14)
      expect(result).toBe(176);
    });
  });

});
