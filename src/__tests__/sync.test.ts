import { mockFigma, MockSectionNode, MockGroupNode, MockShapeWithTextNode, MockConnectorNode, isShapeWithText } from './figma-mocks';
import { TAG, BOX_SIZE } from '../constants';

// Mock the figma global
(global as any).figma = mockFigma;

// Import after setting up mocks
import { syncFromCanvas } from '../sync';

describe('syncFromCanvas', () => {
  beforeEach(() => {
    // Clear the page
    mockFigma.currentPage.children = [];
    jest.clearAllMocks();
  });

  it('should sync a basic diagram without subsections', () => {
    // Create the structure that the plugin would create
    const section = new MockSectionNode();
    section.name = `${TAG} Section`;
    section.setPluginData('economyFlowSection', 'true');
    
    const group = new MockGroupNode();
    group.name = TAG;
    
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
    
    // Add group to section
    section.appendChild(group);
    
    // Add section to page
    mockFigma.currentPage.appendChild(section);
    
    // Run sync
    syncFromCanvas();
    
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

  it('should handle the Helldivers example structure', () => {
    // This simulates what happens when we generate from the Helldivers example
    const section = new MockSectionNode();
    section.name = `${TAG} Section`;
    section.setPluginData('economyFlowSection', 'true');
    
    const group = new MockGroupNode();
    group.name = TAG;
    
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
    
    section.appendChild(group);
    mockFigma.currentPage.appendChild(section);
    
    // Run sync
    syncFromCanvas();
    
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

  it('should sync nodes nested inside subsections', () => {
    const section = new MockSectionNode();
    section.name = `${TAG} Section`;
    section.setPluginData('economyFlowSection', 'true');

    const subsection = new MockSectionNode();
    subsection.name = 'Sub';
    subsection.setPluginData('subsectionId', 'sub');

    const node = new MockShapeWithTextNode();
    node.width = BOX_SIZE.NODE.W;
    node.height = BOX_SIZE.NODE.H;
    node.text.characters = 'Nested Node';
    node.setPluginData('id', 'nested');

    subsection.appendChild(node);
    section.appendChild(subsection);
    mockFigma.currentPage.appendChild(section);

    syncFromCanvas();

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
    }
  });

  it('should read connectors from the dedicated connector group', () => {
    const section = new MockSectionNode();
    section.name = `${TAG} Section`;
    section.setPluginData('economyFlowSection', 'true');

    const nodeGroup = new MockGroupNode();
    nodeGroup.name = TAG;

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

    section.appendChild(connectorGroup);
    section.appendChild(nodeGroup);
    mockFigma.currentPage.appendChild(section);

    syncFromCanvas();

    const calls = mockFigma.ui.postMessage.mock.calls;
    const syncCall = calls.find(call => call[0].type === 'sync-json');
    expect(syncCall).toBeDefined();

    if (syncCall) {
      const result = JSON.parse(syncCall[0].json);
      expect(result.edges).toContainEqual(['from', 'to']);
    }
  });

  it('should fail gracefully when no diagram exists', () => {
    syncFromCanvas();
    
    const calls = mockFigma.ui.postMessage.mock.calls;
    const replyCall = calls.find(call => call[0].type === 'reply');
    
    expect(replyCall).toBeDefined();
    expect(replyCall[0].ok).toBe(false);
    expect(replyCall[0].msg).toContain('No diagram found');
  });
});
