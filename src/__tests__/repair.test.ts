import { repairEconomyJSON } from '../research-bridge';

describe('repairEconomyJSON', () => {
    it('should handle null or invalid input', () => {
        expect(repairEconomyJSON(null)).toEqual({ inputs: [], nodes: [], edges: [] });
        expect(repairEconomyJSON('invalid')).toEqual({ inputs: [], nodes: [], edges: [] });
    });

    it('should repair missing arrays', () => {
        const input = {};
        const expected = { name: 'Economy Graph', inputs: [], nodes: [], edges: [], subsections: [] };
        expect(repairEconomyJSON(input)).toEqual(expected);
    });

    it('should snake_case IDs and labels', () => {
        const input = {
            inputs: [{ id: 'Raw Material', label: 'Raw Material' }],
            nodes: [{ id: 'Process A', label: 'Process A' }]
        };
        const result = repairEconomyJSON(input);
        expect(result.inputs[0].id).toBe('raw_material');
        expect(result.nodes[0].id).toBe('process_a');
    });

    it('should repair edges with object format', () => {
        const input = {
            inputs: [{ id: 'a' }],
            nodes: [{ id: 'b' }],
            edges: [{ from: 'a', to: 'b' }]
        };
        const result = repairEconomyJSON(input);
        expect(result.edges).toEqual([['a', 'b']]);
    });

    it('should repair edges with missing IDs', () => {
        const input = {
            inputs: [{ id: 'a' }],
            nodes: [{ id: 'b' }],
            edges: [['a', 'c']] // 'c' does not exist
        };
        const result = repairEconomyJSON(input);
        expect(result.edges).toEqual([]);
    });

    it('should handle edges with mixed formats', () => {
        const input = {
            inputs: [{ id: 'a' }],
            nodes: [{ id: 'b' }, { id: 'c' }],
            edges: [
                ['a', 'b'],
                { source: 'b', target: 'c' }
            ]
        };
        const result = repairEconomyJSON(input);
        expect(result.edges).toEqual([['a', 'b'], ['b', 'c']]);
    });

    it('should enforce required fields', () => {
        const input = {
            inputs: [{ id: 'a' }], // missing kind
            nodes: [{ id: 'b' }] // missing kind, sources, etc
        };
        const result = repairEconomyJSON(input);
        expect(result.inputs[0].kind).toBe('initial_sink_node');
        expect(result.nodes[0].kind).toBe('node');
        expect(result.nodes[0].sources).toEqual([]);
    });
});
