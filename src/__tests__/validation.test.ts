import { validateGraphData, isValidColor, validateCustomColors } from '../validation';
import { V2Graph } from '../types';
import { COLOR } from '../constants';

function validGraph(): V2Graph {
  return {
    schemaVersion: 2,
    stages: [
      { id: 'inputs', label: 'Inputs' },
      { id: 'actions', label: 'Actions' },
      { id: 'outcomes', label: 'Outcomes' }
    ],
    lanes: [{ id: 'core', label: 'Core' }],
    nodes: [
      { id: 'time', label: 'Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core' },
      { id: 'play', label: 'Play Game', stageId: 'actions', laneId: 'core', sources: ['XP'], sinks: [] },
      { id: 'win', label: 'Win', kind: 'final_good', stageId: 'outcomes', laneId: 'core' }
    ],
    edges: [
      { from: 'time', to: 'play' },
      { from: 'play', to: 'win', type: 'final' }
    ]
  };
}

describe('validateGraphData', () => {
  it('validates a correct v2 graph structure', () => {
    expect(validateGraphData(validGraph())).toHaveLength(0);
  });

  it('catches missing schema version', () => {
    const invalidGraph: any = validGraph();
    delete invalidGraph.schemaVersion;

    expect(validateGraphData(invalidGraph)).toContain("'schemaVersion' must be 2.");
  });

  it('catches invalid edge references', () => {
    const invalidGraph = validGraph();
    invalidGraph.edges = [{ from: 'time', to: 'nonexistent' }];

    const errors = validateGraphData(invalidGraph);
    expect(errors.some(e => e.includes("'nonexistent' not found"))).toBe(true);
  });

  it('detects cycles in edges', () => {
    const graph = validGraph();
    graph.edges = [
      { from: 'time', to: 'play' },
      { from: 'play', to: 'time' }
    ];

    const errors = validateGraphData(graph);
    expect(errors.some(e => e.includes('cycle'))).toBe(true);
  });

  it('enforces snake_case ids', () => {
    const invalidGraph = validGraph();
    invalidGraph.nodes[0].id = 'TimeInput';

    const errors = validateGraphData(invalidGraph);
    expect(errors.some(e => e.includes('snake_case'))).toBe(true);
  });

  it('allows currencies reused across sources, sinks, and values', () => {
    const graph = validGraph();
    graph.nodes[1] = {
      id: 'play',
      label: 'Play Game',
      stageId: 'actions',
      laneId: 'core',
      sources: ['Gold'],
      sinks: ['Gold'],
      values: ['Gold']
    };

    expect(validateGraphData(graph)).toHaveLength(0);
  });
});

describe('isValidColor', () => {
  it('accepts valid hex colors', () => {
    expect(isValidColor('#FFFFFF')).toBe(true);
    expect(isValidColor('#000000')).toBe(true);
    expect(isValidColor('#4CAF50')).toBe(true);
    expect(isValidColor('#abc123')).toBe(true);
  });

  it('rejects invalid hex colors', () => {
    expect(isValidColor('#FFF')).toBe(false);
    expect(isValidColor('#GGGGGG')).toBe(false);
    expect(isValidColor('red')).toBe(false);
    expect(isValidColor('#12345')).toBe(false);
    expect(isValidColor('#1234567')).toBe(false);
  });
});

describe('validateCustomColors', () => {
  it('returns default colors when input is invalid', () => {
    const result = validateCustomColors(null);
    expect(result.sink).toBe(COLOR.INITIAL_SINK_NODE);
    expect(result.source).toBe(COLOR.SOURCE_GREEN);
  });

  it('uses custom colors when valid', () => {
    const customColors = {
      sink: '#FF0000',
      source: '#00FF00',
      xp: '#0000FF',
      final: '#FFFF00'
    };

    const result = validateCustomColors(customColors);
    expect(result).toEqual(customColors);
  });

  it('falls back to defaults for invalid custom colors', () => {
    const customColors = {
      sink: 'red',
      source: '#00FF00',
      xp: '#GGG',
      final: '#FFFF00'
    };

    const result = validateCustomColors(customColors);
    expect(result.sink).toBe(COLOR.INITIAL_SINK_NODE);
    expect(result.source).toBe('#00FF00');
    expect(result.xp).toBe(COLOR.XP_ORANGE);
    expect(result.final).toBe('#FFFF00');
  });
});
