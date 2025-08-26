import { validateGraphData, isValidColor, validateCustomColors } from '../validation';
import { Graph } from '../types';
import { COLOR } from '../constants';

describe('validateGraphData', () => {
  it('should validate a correct graph structure', () => {
    const validGraph: Graph = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [{ id: 'play', label: 'Play Game', sources: ['XP'], sinks: [] }],
      edges: [['time', 'play']]
    };

    const errors = validateGraphData(validGraph);
    expect(errors).toHaveLength(0);
  });

  it('should catch missing inputs array', () => {
    const invalidGraph: any = {
      nodes: [{ id: 'play', label: 'Play Game' }],
      edges: []
    };

    const errors = validateGraphData(invalidGraph);
    expect(errors).toContain("'inputs' property must be an array.");
  });

  it('should catch invalid edge references', () => {
    const invalidGraph: Graph = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [{ id: 'play', label: 'Play Game' }],
      edges: [['time', 'nonexistent']]
    };

    const errors = validateGraphData(invalidGraph);
    expect(errors.some(e => e.includes("'nonexistent' not found"))).toBe(true);
  });

  it('should validate node properties', () => {
    const invalidGraph: any = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [{ label: 'Missing ID' }], // Missing id
      edges: []
    };

    const errors = validateGraphData(invalidGraph);
    expect(errors.some(e => e.includes("'id' is missing"))).toBe(true);
  });

  it('should detect cycles in edges', () => {
    const graph: Graph = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' }
      ],
      edges: [
        ['time', 'a'],
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a']
      ]
    };

    const errors = validateGraphData(graph);
    expect(errors.some(e => e.includes('cycle'))).toBe(true);
  });
});

describe('isValidColor', () => {
  it('should accept valid hex colors', () => {
    expect(isValidColor('#FFFFFF')).toBe(true);
    expect(isValidColor('#000000')).toBe(true);
    expect(isValidColor('#4CAF50')).toBe(true);
    expect(isValidColor('#abc123')).toBe(true);
  });

  it('should reject invalid hex colors', () => {
    expect(isValidColor('#FFF')).toBe(false);
    expect(isValidColor('#GGGGGG')).toBe(false);
    expect(isValidColor('red')).toBe(false);
    expect(isValidColor('#12345')).toBe(false);
    expect(isValidColor('#1234567')).toBe(false);
  });
});

describe('validateCustomColors', () => {
  it('should return default colors when input is invalid', () => {
    const result = validateCustomColors(null);
    expect(result.sink).toBe(COLOR.INITIAL_SINK_NODE);
    expect(result.source).toBe(COLOR.SOURCE_GREEN);
  });

  it('should use custom colors when valid', () => {
    const customColors = {
      sink: '#FF0000',
      source: '#00FF00',
      xp: '#0000FF',
      final: '#FFFF00'
    };

    const result = validateCustomColors(customColors);
    expect(result).toEqual(customColors);
  });

  it('should fallback to defaults for invalid custom colors', () => {
    const customColors = {
      sink: 'red', // Invalid
      source: '#00FF00', // Valid
      xp: '#GGG', // Invalid
      final: '#FFFF00' // Valid
    };

    const result = validateCustomColors(customColors);
    expect(result.sink).toBe(COLOR.INITIAL_SINK_NODE); // Default
    expect(result.source).toBe('#00FF00'); // Custom
    expect(result.xp).toBe(COLOR.XP_ORANGE); // Default
    expect(result.final).toBe('#FFFF00'); // Custom
  });
});

describe('subsections validation', () => {
  it('should validate correct subsections', () => {
    const graph: Graph = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [
        { id: 'play', label: 'Play Game' },
        { id: 'win', label: 'Win' }
      ],
      edges: [['time', 'play']],
      subsections: [
        { id: 'gameplay', label: 'Core Gameplay', nodeIds: ['play', 'win'] }
      ]
    };

    const errors = validateGraphData(graph);
    expect(errors).toHaveLength(0);
  });

  it('should catch invalid subsection node references', () => {
    const graph: Graph = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [{ id: 'play', label: 'Play Game' }],
      edges: [],
      subsections: [
        { id: 'sub1', label: 'Subsection 1', nodeIds: ['play', 'nonexistent'] }
      ]
    };

    const errors = validateGraphData(graph);
    expect(errors.some(e => e.includes("'nonexistent' not found"))).toBe(true);
  });

  it('should validate subsection colors', () => {
    const graph: Graph = {
      inputs: [],
      nodes: [{ id: 'node1', label: 'Node 1' }],
      edges: [],
      subsections: [
        { id: 'sub1', label: 'Valid Color', nodeIds: ['node1'], color: '#FF00FF' },
        { id: 'sub2', label: 'Invalid Color', nodeIds: ['node1'], color: 'purple' }
      ]
    };

    const errors = validateGraphData(graph);
    expect(errors.some(e => e.includes("Invalid color format 'purple'"))).toBe(true);
  });

  it('should catch duplicate subsection IDs', () => {
    const graph: Graph = {
      inputs: [],
      nodes: [{ id: 'node1', label: 'Node 1' }],
      edges: [],
      subsections: [
        { id: 'sub1', label: 'First', nodeIds: ['node1'] },
        { id: 'sub1', label: 'Duplicate', nodeIds: ['node1'] }
      ]
    };

    const errors = validateGraphData(graph);
    expect(errors.some(e => e.includes("Duplicate subsection id 'sub1'"))).toBe(true);
  });
});
  it('should enforce snake_case ids', () => {
    const invalidGraph: any = {
      inputs: [{ id: 'TimeInput', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [{ id: 'PlayGame', label: 'Play' }],
      edges: []
    };

    const errors = validateGraphData(invalidGraph);
    expect(errors.some(e => e.includes("snake_case"))).toBe(true);
  });

  it('should enforce currency type consistency', () => {
    const graph: Graph = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [
        { id: 'a', label: 'A', sources: ['Gold'] },
        { id: 'b', label: 'B', sinks: ['Gold'] }
      ],
      edges: [['time', 'a'], ['a', 'b']]
    };
    const errors = validateGraphData(graph);
    expect(errors.some(e => e.includes("both source and sink"))).toBe(true);
  });
