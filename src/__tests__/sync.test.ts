import { mockFigma, MockGroupNode, MockShapeWithTextNode, MockConnectorNode, MockRectangleNode } from './figma-mocks';
import { TAG, BOX_SIZE } from '../constants';

// Mock the figma global
(global as any).figma = mockFigma;

// Import after setting up mocks
import { syncFromCanvas } from '../sync';

describe('syncFromCanvas', () => {
  beforeEach(() => {
    // Clear the page
    mockFigma.currentPage.children = [];
    mockFigma.clientStorage.values.clear();
    jest.clearAllMocks();
  });

  it('should sync a basic diagram without subsections', async () => {
    // Create the structure that the plugin would create
    const group = new MockGroupNode();
    group.name = TAG;
    group.setPluginData('economyFlowContainer', 'true');
    
    // Create an input node
    const inputNode = new MockShapeWithTextNode();
    inputNode.text.characters = 'Time';
    inputNode.width = BOX_SIZE.INPUT.W;
    inputNode.height = BOX_SIZE.INPUT.H;
    inputNode.x = 0;
    inputNode.y = 0;
    inputNode.fills = [{ type: 'SOLID', color: { r: 218/255, g: 84/255, b: 51/255 } }]; // SINK_RED
    inputNode.setPluginData('id', 'time');
    
    // Create a regular node
    const playNode = new MockShapeWithTextNode();
    playNode.text.characters = 'Play Game';
    playNode.width = BOX_SIZE.NODE.W;
    playNode.height = BOX_SIZE.NODE.H;
    playNode.x = 200;
    playNode.y = 0;
    playNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // WHITE
    playNode.setPluginData('id', 'play');
    
    // Create attribute nodes (no plugin data)
    const xpAttr = new MockShapeWithTextNode();
    xpAttr.text.characters = '+ XP';
    xpAttr.width = BOX_SIZE.ATTR.W;
    xpAttr.height = BOX_SIZE.ATTR.H;
    xpAttr.x = playNode.x;
    xpAttr.y = playNode.y + playNode.height + 5;
    xpAttr.fills = [{ type: 'SOLID', color: { r: 76/255, g: 175/255, b: 80/255 } }]; // SOURCE_GREEN
    
    // Add nodes to group
    group.appendChild(inputNode);
    group.appendChild(playNode);
    group.appendChild(xpAttr);
    
    // Add group to page
    mockFigma.currentPage.appendChild(group);
    
    // Run sync
    await syncFromCanvas();
    
    // Check the result
    const calls = mockFigma.ui.postMessage.mock.calls;
    const syncCall = calls.find(call => call[0].type === 'sync-json');
    
    expect(syncCall).toBeDefined();
    
    const result = JSON.parse(syncCall[0].json);
    expect(result.inputs).toHaveLength(1);
    expect(result.inputs[0]).toEqual({
      id: 'time',
      label: 'Time',
      kind: 'initial_sink_node'
    });
    
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toEqual({
      id: 'play',
      label: 'Play Game',
      sources: ['XP'],
      sinks: [],
      values: []
    });
  });

  it('should handle the Helldivers example structure', async () => {
    // This simulates what happens when we generate from the Helldivers example
    const group = new MockGroupNode();
    group.name = TAG;
    group.setPluginData('economyFlowContainer', 'true');
    
    // Add some Helldivers nodes
    const timeInput = new MockShapeWithTextNode();
    timeInput.text.characters = 'Time';
    timeInput.width = BOX_SIZE.INPUT.W;
    timeInput.fills = [{ type: 'SOLID', color: { r: 218/255, g: 84/255, b: 51/255 } }];
    timeInput.setPluginData('id', 'time');
    
    const moneyInput = new MockShapeWithTextNode();
    moneyInput.text.characters = 'Money';
    moneyInput.width = BOX_SIZE.INPUT.W;
    moneyInput.fills = [{ type: 'SOLID', color: { r: 218/255, g: 84/255, b: 51/255 } }];
    moneyInput.setPluginData('id', 'money');
    
    group.appendChild(timeInput);
    group.appendChild(moneyInput);
    
    mockFigma.currentPage.appendChild(group);
    
    // Run sync
    await syncFromCanvas();
    
    // Check if sync succeeded
    const calls = mockFigma.ui.postMessage.mock.calls;
    const replyCall = calls.find(call => call[0].type === 'reply');
    
    // Log any error messages for debugging
    if (replyCall && !replyCall[0].ok) {
      console.error('Sync failed with message:', replyCall[0].msg);
    }
    
    const syncCall = calls.find(call => call[0].type === 'sync-json');
    expect(syncCall).toBeDefined();
    
    if (syncCall) {
      const result = JSON.parse(syncCall[0].json);
      expect(result.inputs).toHaveLength(2);
    }
  });

  it('should sync subsections from subsection border rectangles', async () => {
    const group = new MockGroupNode();
    group.name = TAG;
    group.setPluginData('economyFlowContainer', 'true');

    const subsectionBorder = new MockRectangleNode();
    subsectionBorder.name = 'Sub';
    subsectionBorder.x = 0;
    subsectionBorder.y = 0;
    subsectionBorder.width = 400;
    subsectionBorder.height = 400;
    subsectionBorder.setPluginData('subsectionId', 'sub');

    const node = new MockShapeWithTextNode();
    node.width = BOX_SIZE.NODE.W;
    node.height = BOX_SIZE.NODE.H;
    node.text.characters = 'Nested Node';
    node.setPluginData('id', 'nested');
    node.x = 50;
    node.y = 50;

    group.appendChild(node);
    mockFigma.currentPage.appendChild(subsectionBorder);
    mockFigma.currentPage.appendChild(group);

    await syncFromCanvas();

    const calls = mockFigma.ui.postMessage.mock.calls;
    const syncCall = calls.find(call => call[0].type === 'sync-json');
    expect(syncCall).toBeDefined();

    if (syncCall) {
      const result = JSON.parse(syncCall[0].json);
      expect(result.nodes).toEqual([
        {
          id: 'nested',
          label: 'Nested Node',
          sources: [],
          sinks: [],
          values: []
        }
      ]);
      expect(result.subsections).toEqual([
        {
          id: 'sub',
          label: 'Sub',
          nodeIds: ['nested']
        }
      ]);
    }
  });

  it('should read connectors from the dedicated connector group', async () => {
    const nodeGroup = new MockGroupNode();
    nodeGroup.name = TAG;
    nodeGroup.setPluginData('economyFlowContainer', 'true');

    const fromNode = new MockShapeWithTextNode();
    fromNode.text.characters = 'From';
    fromNode.setPluginData('id', 'from');
    fromNode.resize(BOX_SIZE.NODE.W, BOX_SIZE.NODE.H);
    nodeGroup.appendChild(fromNode);

    const toNode = new MockShapeWithTextNode();
    toNode.text.characters = 'To';
    toNode.setPluginData('id', 'to');
    toNode.resize(BOX_SIZE.NODE.W, BOX_SIZE.NODE.H);
    nodeGroup.appendChild(toNode);

    const connectorGroup = new MockGroupNode();
    connectorGroup.name = `${TAG} Connectors`;
    connectorGroup.setPluginData('economyFlowConnectorGroup', 'true');

    const connector = new MockConnectorNode();
    connector.connectorStart = { endpointNodeId: fromNode.id } as any;
    connector.connectorEnd = { endpointNodeId: toNode.id } as any;
    connectorGroup.appendChild(connector);

    mockFigma.currentPage.appendChild(connectorGroup);
    mockFigma.currentPage.appendChild(nodeGroup);

    await syncFromCanvas();

    const calls = mockFigma.ui.postMessage.mock.calls;
    const syncCall = calls.find(call => call[0].type === 'sync-json');
    expect(syncCall).toBeDefined();

    if (syncCall) {
      const result = JSON.parse(syncCall[0].json);
      expect(result.edges).toContainEqual(['from', 'to']);
    }
  });

  it('should fail gracefully when no diagram exists', async () => {
    await syncFromCanvas();
    
    const calls = mockFigma.ui.postMessage.mock.calls;
    const replyCall = calls.find(call => call[0].type === 'reply');
    
    expect(replyCall).toBeDefined();
    expect(replyCall[0].ok).toBe(false);
    expect(replyCall[0].msg).toContain('No diagram found');
  });

  it('syncs compact v2 grouped cards back into the stored stage/lane schema', async () => {
    const storedGraph = {
      schemaVersion: 2,
      name: 'Sync v2',
      stages: [
        { id: 'inputs', label: 'Inputs' },
        { id: 'actions', label: 'Actions' },
        { id: 'outcomes', label: 'Outcomes' }
      ],
      lanes: [{ id: 'core', label: 'Core' }],
      nodes: [
        { id: 'time', label: 'Spend Time', kind: 'initial_sink_node', stageId: 'inputs', laneId: 'core', sources: [], sinks: [], values: [] },
        { id: 'play', label: 'Play Game', kind: 'action', stageId: 'actions', laneId: 'core', sources: ['XP'], sinks: [], values: [] },
        { id: 'win', label: 'Win', kind: 'final_good', stageId: 'outcomes', laneId: 'core', sources: [], sinks: [], values: [] }
      ],
      edges: [
        { from: 'time', to: 'play' },
        { from: 'play', to: 'win', type: 'final' as const }
      ]
    };
    mockFigma.clientStorage.values.set('economyFlowState', {
      json: JSON.stringify(storedGraph),
      colors: {}
    });

    const nodeGroup = new MockGroupNode();
    nodeGroup.name = `${TAG} Nodes`;

    const input = new MockShapeWithTextNode();
    input.text.characters = 'Spend Time';
    input.resize(126, 74);
    input.fills = [{ type: 'SOLID', color: { r: 218 / 255, g: 84 / 255, b: 51 / 255 } }];
    input.setPluginData('id', 'time');
    nodeGroup.appendChild(input);

    const actionGroup = new MockGroupNode();
    actionGroup.name = 'Node: Play Game Edited';
    actionGroup.setPluginData('id', 'play');
    const actionMain = new MockShapeWithTextNode();
    actionMain.text.characters = 'Play Game Edited';
    actionMain.resize(126, 74);
    actionMain.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    actionGroup.appendChild(actionMain);
    const xp = new MockShapeWithTextNode();
    xp.text.characters = '+ Player XP';
    xp.resize(104, 16);
    xp.x = actionMain.x;
    xp.y = actionMain.y + actionMain.height + 3;
    xp.setPluginData('attrType', 'source');
    actionGroup.appendChild(xp);
    nodeGroup.appendChild(actionGroup);

    const finalGroup = new MockGroupNode();
    finalGroup.name = 'Final Good: Win';
    finalGroup.setPluginData('id', 'win');
    const header = new MockShapeWithTextNode();
    header.text.characters = 'Final Good';
    header.resize(126, 24);
    const finalBody = new MockShapeWithTextNode();
    finalBody.text.characters = 'Win Edited';
    finalBody.y = 24;
    finalBody.resize(126, 50);
    finalGroup.appendChild(header);
    finalGroup.appendChild(finalBody);
    nodeGroup.appendChild(finalGroup);

    const firstConnector = new MockConnectorNode();
    firstConnector.setPluginData('economyFlowConnector', 'true');
    firstConnector.connectorStart = { endpointNodeId: input.id } as any;
    firstConnector.connectorEnd = { endpointNodeId: actionMain.id } as any;

    const finalConnector = new MockConnectorNode();
    finalConnector.setPluginData('economyFlowConnector', 'true');
    finalConnector.dashPattern = [10, 10];
    finalConnector.connectorStart = { endpointNodeId: actionMain.id } as any;
    finalConnector.connectorEnd = { endpointNodeId: finalBody.id } as any;

    nodeGroup.appendChild(firstConnector);
    nodeGroup.appendChild(finalConnector);
    mockFigma.currentPage.appendChild(nodeGroup);

    await syncFromCanvas();

    const calls = mockFigma.ui.postMessage.mock.calls;
    const syncCall = calls.find(call => call[0].type === 'sync-json');
    expect(syncCall).toBeDefined();
    const result = JSON.parse(syncCall[0].json);

    expect(result.schemaVersion).toBe(2);
    expect(result.stages).toEqual(storedGraph.stages);
    expect(result.lanes).toEqual(storedGraph.lanes);
    expect(result.nodes.find((node: any) => node.id === 'play')).toMatchObject({
      label: 'Play Game Edited',
      stageId: 'actions',
      laneId: 'core',
      sources: ['Player XP']
    });
    expect(result.nodes.find((node: any) => node.id === 'win')).toMatchObject({
      label: 'Win Edited',
      kind: 'final_good',
      stageId: 'outcomes'
    });
    expect(result.edges).toContainEqual({ from: 'time', to: 'play' });
    expect(result.edges).toContainEqual({ from: 'play', to: 'win', type: 'final' });
  });
});
