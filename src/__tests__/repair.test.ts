import { repairEconomyJSON } from '../research-bridge';

describe('repairEconomyJSON', () => {
  it('handles null or invalid input as an empty v2 graph', () => {
    expect(repairEconomyJSON(null)).toMatchObject({
      schemaVersion: 2,
      stages: [{ id: 'inputs', label: 'Inputs' }, { id: 'outcomes', label: 'Outcomes' }],
      lanes: [{ id: 'main', label: 'Main' }],
      nodes: [],
      edges: []
    });
    expect(repairEconomyJSON('invalid')).toMatchObject({
      schemaVersion: 2,
      nodes: [],
      edges: []
    });
  });

  it('repairs missing arrays', () => {
    expect(repairEconomyJSON({})).toMatchObject({
      schemaVersion: 2,
      name: 'Economy Graph',
      nodes: [],
      edges: []
    });
  });

  it('snake_cases IDs and migrates legacy inputs into v2 nodes', () => {
    const input = {
      inputs: [{ id: 'Raw Material', label: 'Raw Material' }],
      nodes: [{ id: 'Process A', label: 'Process A' }]
    };
    const result = repairEconomyJSON(input);

    expect(result.nodes[0].id).toBe('raw_material');
    expect(result.nodes[0].kind).toBe('initial_sink_node');
    expect(result.nodes[1].id).toBe('process_a');
  });

  it('repairs edges with object format', () => {
    const input = {
      inputs: [{ id: 'a' }],
      nodes: [{ id: 'b' }],
      edges: [{ from: 'a', to: 'b' }]
    };
    const result = repairEconomyJSON(input);
    expect(result.edges).toEqual([{ from: 'a', to: 'b' }]);
  });

  it('repairs edges with missing IDs', () => {
    const input = {
      inputs: [{ id: 'a' }],
      nodes: [{ id: 'b' }],
      edges: [['a', 'c']]
    };
    const result = repairEconomyJSON(input);
    expect(result.edges).toEqual([]);
  });

  it('handles edges with mixed formats', () => {
    const input = {
      inputs: [{ id: 'a' }],
      nodes: [{ id: 'b' }, { id: 'c' }],
      edges: [
        ['a', 'b'],
        { source: 'b', target: 'c' }
      ]
    };
    const result = repairEconomyJSON(input);
    expect(result.edges).toEqual([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }]);
  });

  it('enforces required v2 node fields', () => {
    const input = {
      inputs: [{ id: 'a' }],
      nodes: [{ id: 'b' }]
    };
    const result = repairEconomyJSON(input);
    expect(result.nodes[0].kind).toBe('initial_sink_node');
    expect(result.nodes[0].stageId).toBeDefined();
    expect(result.nodes[1].kind).toBe('action');
    expect(result.nodes[1].sources).toEqual([]);
  });
});
