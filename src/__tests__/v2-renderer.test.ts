import { mockFigma } from './figma-mocks';

(global as any).figma = mockFigma;

import { generateDiagram } from '../diagram-renderer';
import { V2Graph } from '../types';

describe('v2 renderer layering', () => {
  beforeEach(() => {
    mockFigma.currentPage.children = [];
    mockFigma.ui.postMessage.mockClear();
    mockFigma.viewport.scrollAndZoomIntoView.mockClear();
  });

  it('keeps connectors behind node cards in stable layer order', async () => {
    const graph: V2Graph = {
      schemaVersion: 2,
      name: 'Layer Test',
      stages: [
        { id: 'inputs', label: 'Inputs' },
        { id: 'actions', label: 'Actions' },
        { id: 'outcomes', label: 'Outcomes' }
      ],
      lanes: [{ id: 'core', label: 'Core' }],
      nodes: [
        { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core' },
        { id: 'play', label: 'Play', stageId: 'actions', laneId: 'core' },
        { id: 'win', label: 'Win', kind: 'final_good', stageId: 'outcomes', laneId: 'core' }
      ],
      edges: [
        { from: 'time', to: 'play' },
        { from: 'play', to: 'win', type: 'final' }
      ]
    };

    await generateDiagram(graph);

    const topLevelNames = mockFigma.currentPage.children.map(node => node.name);
    const backgroundIndex = topLevelNames.indexOf('EconomyFlowChart Background');
    const connectorIndexes = topLevelNames
      .map((name, index) => name.startsWith('EconomyFlowChart Connector:') ? index : -1)
      .filter(index => index >= 0);
    const nodeIndex = topLevelNames.indexOf('EconomyFlowChart Nodes');

    expect(backgroundIndex).toBeGreaterThanOrEqual(0);
    expect(connectorIndexes).toHaveLength(2);
    connectorIndexes.forEach(connectorIndex => {
      expect(connectorIndex).toBeGreaterThan(backgroundIndex);
      expect(connectorIndex).toBeLessThan(nodeIndex);
    });
    expect(nodeIndex).toBeGreaterThan(backgroundIndex);
  });

  it('renders diagram and lane backgrounds with opaque white fills', async () => {
    const graph: V2Graph = {
      schemaVersion: 2,
      name: 'Background Fill Test',
      stages: [
        { id: 'inputs', label: 'Inputs' },
        { id: 'actions', label: 'Actions' }
      ],
      lanes: [
        { id: 'core', label: 'Core', color: '#2DD4BF' },
        { id: 'premium', label: 'Premium', color: '#A78BFA' }
      ],
      nodes: [
        { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core' },
        { id: 'play', label: 'Play', stageId: 'actions', laneId: 'core' },
        { id: 'money', label: 'Spend Money', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'premium' },
        { id: 'shop', label: 'Shop', stageId: 'actions', laneId: 'premium' }
      ],
      edges: [
        { from: 'time', to: 'play' },
        { from: 'money', to: 'shop' }
      ]
    };

    await generateDiagram(graph);

    const backgroundLayer = mockFigma.currentPage.children.find(
      node => node.name === 'EconomyFlowChart Background'
    ) as any;
    expect(backgroundLayer).toBeDefined();

    const backgroundRects = backgroundLayer.children.filter((node: any) => node.type === 'RECTANGLE');
    expect(backgroundRects).toHaveLength(3);
    backgroundRects.forEach((rect: any) => {
      expect(rect.fills).toHaveLength(1);
      expect(rect.fills[0]).toMatchObject({
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1 }
      });
    });
  });

  it('styles value, final, and cross-lane edges distinctly', async () => {
    const graph: V2Graph = {
      schemaVersion: 2,
      name: 'Edge Style Test',
      stages: [
        { id: 'inputs', label: 'Inputs' },
        { id: 'actions', label: 'Actions' },
        { id: 'outcomes', label: 'Outcomes' }
      ],
      lanes: [
        { id: 'core', label: 'Core' },
        { id: 'premium', label: 'Premium' }
      ],
      nodes: [
        { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core' },
        { id: 'play', label: 'Play', stageId: 'actions', laneId: 'core' },
        { id: 'shop', label: 'Shop', stageId: 'actions', laneId: 'premium' },
        { id: 'win', label: 'Win', kind: 'final_good', stageId: 'outcomes', laneId: 'core' }
      ],
      edges: [
        { from: 'time', to: 'play', type: 'value' },
        { from: 'time', to: 'shop', type: 'cross-lane' },
        { from: 'play', to: 'win', type: 'final' }
      ]
    };

    await generateDiagram(graph);

    const connectors = mockFigma.currentPage.findAll(node => node.type === 'CONNECTOR') as any[];
    const valueConnector = connectors.find(node => node.name.includes('time -> play'));
    const crossLaneConnector = connectors.find(node => node.name.includes('time -> shop'));
    const finalConnector = connectors.find(node => node.name.includes('play -> win'));

    expect(valueConnector.strokes[0].color).toEqual({ r: 236 / 255, g: 159 / 255, b: 83 / 255 });
    expect(crossLaneConnector.strokes[0].color).toEqual({ r: 78 / 255, g: 121 / 255, b: 167 / 255 });
    expect(finalConnector.dashPattern).toEqual([10, 10]);
  });
});
