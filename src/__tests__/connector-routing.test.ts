import { buildConnectorRoutingSpec, buildConnectorSegments, countConnectorEndpoints } from '../connector-routing';

describe('connector routing', () => {
  it('keeps simple one-to-one edges deterministic', () => {
    const nodeDataMap = new Map([
      ['a', { id: 'a', label: 'A' }],
      ['b', { id: 'b', label: 'B' }]
    ]);

    const routing = buildConnectorRoutingSpec('a', 'b', nodeDataMap as any, countConnectorEndpoints([['a', 'b']]));

    expect(routing.mode).toBe('deterministic');
    expect(routing.startMagnet).toBe('RIGHT');
    expect(routing.endMagnet).toBe('LEFT');
  });

  it('switches fan-out edges to auto routing', () => {
    const nodeDataMap = new Map([
      ['a', { id: 'a', label: 'A' }],
      ['b', { id: 'b', label: 'B' }],
      ['c', { id: 'c', label: 'C' }]
    ]);

    const routing = buildConnectorRoutingSpec(
      'a',
      'b',
      nodeDataMap as any,
      countConnectorEndpoints([
        ['a', 'b'],
        ['a', 'c']
      ])
    );

    expect(routing.mode).toBe('auto');
    expect(routing.startMagnet).toBe('AUTO');
    expect(routing.endMagnet).toBe('AUTO');
  });

  it('applies dashed styling for final goods', () => {
    const nodeDataMap = new Map([
      ['a', { id: 'a', label: 'A' }],
      ['b', { id: 'b', label: 'Final', kind: 'final_good' }]
    ]);

    const routing = buildConnectorRoutingSpec('a', 'b', nodeDataMap as any, countConnectorEndpoints([['a', 'b']]));

    expect(routing.dashPattern).toEqual([10, 10]);
  });

  it('builds stable elbow segments for horizontal-first routing', () => {
    const segments = buildConnectorSegments(
      { x: 0, y: 10 },
      { x: 100, y: 50 },
      'horizontal-first'
    );

    expect(segments).toEqual([
      { start: { x: 0, y: 10 }, end: { x: 50, y: 10 } },
      { start: { x: 50, y: 10 }, end: { x: 50, y: 50 } },
      { start: { x: 50, y: 50 }, end: { x: 100, y: 50 } }
    ]);
  });
});
