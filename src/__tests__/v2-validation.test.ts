import { validateGraphData } from '../validation';
import { V2Graph } from '../types';

const validV2Graph: V2Graph = {
  schemaVersion: 2,
  name: 'V2 Test',
  stages: [
    { id: 'inputs', label: 'Inputs' },
    { id: 'actions', label: 'Actions' },
    { id: 'outcomes', label: 'Outcomes' }
  ],
  lanes: [
    { id: 'core', label: 'Core' }
  ],
  nodes: [
    { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core' },
    { id: 'play', label: 'Play', stageId: 'actions', laneId: 'core', values: ['XP'] },
    { id: 'mastery', label: 'Mastery', kind: 'final_good', stageId: 'outcomes', laneId: 'core' }
  ],
  edges: [
    { from: 'time', to: 'play' },
    { from: 'play', to: 'mastery', type: 'final' }
  ]
};

describe('v2 graph validation', () => {
  it('accepts a valid stage/lane graph', () => {
    expect(validateGraphData(validV2Graph)).toEqual([]);
  });

  it('rejects legacy v1 graph shapes', () => {
    const legacyGraph = {
      inputs: [{ id: 'time', label: 'Time', kind: 'initial_sink_node' }],
      nodes: [{ id: 'play', label: 'Play' }],
      edges: [['time', 'play']]
    };

    expect(validateGraphData(legacyGraph as any)).toContain("'schemaVersion' must be 2.");
  });

  it('rejects missing stage, lane, and node edge references', () => {
    const graph: V2Graph = {
      ...validV2Graph,
      nodes: [
        { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'missing_stage', laneId: 'missing_lane' },
        { id: 'play', label: 'Play', stageId: 'actions', laneId: 'core' }
      ],
      edges: [
        { from: 'time', to: 'unknown' }
      ]
    };

    const errors = validateGraphData(graph);

    expect(errors).toEqual(expect.arrayContaining([
      "Node 0: stageId 'missing_stage' not found in stages.",
      "Node 0: laneId 'missing_lane' not found in lanes.",
      "Edge 0: 'to' id 'unknown' not found in nodes."
    ]));
  });

  it('rejects final goods outside the terminal stage', () => {
    const graph: V2Graph = {
      ...validV2Graph,
      nodes: [
        { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core' },
        { id: 'mastery', label: 'Mastery', kind: 'final_good', stageId: 'actions', laneId: 'core' }
      ],
      edges: [{ from: 'time', to: 'mastery', type: 'final' }]
    };

    expect(validateGraphData(graph)).toContain("Node 1: final_good nodes must use terminal stage 'outcomes'.");
  });
});
