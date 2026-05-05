import { mockFigma, MockShapeWithTextNode } from './figma-mocks';

(global as any).figma = mockFigma;

import { buildConnectorRoutingSpec, countConnectorEndpoints } from '../connector-routing';
import { createConnector } from '../node-creation';

describe('createConnector', () => {
  beforeEach(() => {
    mockFigma.currentPage.children = [];
  });

  it('uses deterministic side magnets for simple edges', () => {
    const fromNode = new MockShapeWithTextNode() as unknown as SceneNode;
    const toNode = new MockShapeWithTextNode() as unknown as SceneNode;
    const routing = buildConnectorRoutingSpec(
      'from',
      'to',
      new Map([
        ['from', { id: 'from', label: 'From' }],
        ['to', { id: 'to', label: 'To' }]
      ]),
      countConnectorEndpoints([['from', 'to']])
    );

    const connector = createConnector(fromNode, toNode, routing);

    expect((connector as any).connectorStart.magnet).toBe('RIGHT');
    expect((connector as any).connectorEnd.magnet).toBe('LEFT');
  });

  it('uses auto magnets when overlap reduction is preferred', () => {
    const fromNode = new MockShapeWithTextNode() as unknown as SceneNode;
    const toNode = new MockShapeWithTextNode() as unknown as SceneNode;
    const routing = buildConnectorRoutingSpec(
      'from',
      'to',
      new Map([
        ['from', { id: 'from', label: 'From' }],
        ['to', { id: 'to', label: 'To' }],
        ['to-2', { id: 'to-2', label: 'To 2' }]
      ]),
      countConnectorEndpoints([
        ['from', 'to'],
        ['from', 'to-2']
      ])
    );

    const connector = createConnector(fromNode, toNode, routing);

    expect((connector as any).connectorStart.magnet).toBe('AUTO');
    expect((connector as any).connectorEnd.magnet).toBe('AUTO');
  });
});
