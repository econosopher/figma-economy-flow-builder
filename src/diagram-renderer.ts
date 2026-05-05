/// <reference types="@figma/plugin-typings" />

import { COLOR, SECTION_PADDING, TAG } from './constants';
import { createLegendSection, extractCurrenciesByType } from './legend';
import { createConnector, makeBox, makeFinalGoodBox } from './node-creation';
import { V2Graph, V2Node } from './types';
import { layoutV2Graph, routeV2Edges, V2_COMPACT_SIZE, V2LayoutResult, V2PositionedNode } from './v2-layout';
import { hex, reply } from './utils';
import { validateCustomColors } from './validation';

interface RenderedNode {
  sceneNode: SceneNode;
  connectorTarget: SceneNode;
}

function resolveFinalGoodTarget(node: SceneNode): SceneNode {
  if (node.type !== 'GROUP' || !('children' in node) || node.children.length < 2) {
    return node;
  }

  return node.children.find(child =>
    child.type === 'SHAPE_WITH_TEXT' && child.y > 0
  ) || node.children[1] || node;
}

function createRenderedNode(
  positionedNode: V2PositionedNode,
  colors: ReturnType<typeof validateCustomColors>
): RenderedNode | null {
  const nodeData = positionedNode.data;
  const rect = positionedNode.rect;
  let mainNode: SceneNode;
  let connectorTarget: SceneNode;

  try {
    if (nodeData.kind === 'initial_sink_node') {
      mainNode = makeBox(nodeData.label, V2_COMPACT_SIZE.INPUT.W, V2_COMPACT_SIZE.INPUT.H, colors.sink);
      connectorTarget = mainNode;
    } else if (nodeData.kind === 'final_good') {
      mainNode = makeFinalGoodBox(nodeData.label, V2_COMPACT_SIZE.FINAL_GOOD.W, V2_COMPACT_SIZE.FINAL_GOOD.H, colors.final);
      connectorTarget = resolveFinalGoodTarget(mainNode);
    } else {
      mainNode = makeBox(nodeData.label, V2_COMPACT_SIZE.NODE.W, V2_COMPACT_SIZE.NODE.H, COLOR.MAIN_WHITE);
      connectorTarget = mainNode;
    }
  } catch (error) {
    console.error('Failed to create node:', error);
    return null;
  }

  mainNode.x = rect.x;
  mainNode.y = rect.y;
  mainNode.setPluginData('id', nodeData.id);

  const nodeElements: SceneNode[] = [mainNode];
  if (nodeData.kind !== 'final_good' && hasAttributes(nodeData)) {
    let attrY = mainNode.height + 3;
    const addAttribute = (text: string, color: string, attrType: 'source' | 'sink' | 'value') => {
      const attrBox = makeBox(text, V2_COMPACT_SIZE.ATTR.W, V2_COMPACT_SIZE.ATTR.H, color, 'LEFT');
      attrBox.x = mainNode.x;
      attrBox.y = mainNode.y + attrY;
      attrBox.setPluginData('attrType', attrType);
      nodeElements.push(attrBox);
      attrY += V2_COMPACT_SIZE.ATTR.H + 3;
    };

    nodeData.sources?.forEach(source => addAttribute(`+ ${source}`, colors.source, 'source'));
    nodeData.sinks?.forEach(sink => addAttribute(`- ${sink}`, colors.sink, 'sink'));
    nodeData.values?.forEach(value => addAttribute(value, colors.xp, 'value'));
  }

  let sceneNode: SceneNode = mainNode;
  if (nodeElements.length > 1) {
    sceneNode = figma.group(nodeElements, figma.currentPage);
    sceneNode.name = `Node: ${nodeData.label}`;
    sceneNode.setPluginData('id', nodeData.id);
    connectorTarget = nodeElements[0];
  }

  return { sceneNode, connectorTarget };
}

function hasAttributes(nodeData: V2Node): boolean {
  return Boolean(nodeData.sources?.length || nodeData.sinks?.length || nodeData.values?.length);
}

function createBackgroundLayer(data: V2Graph, layout: V2LayoutResult): GroupNode {
  const backgroundNodes: SceneNode[] = [];

  const container = figma.createRectangle();
  container.name = data.name ? `${data.name} Economy` : `${TAG} Bounds`;
  container.x = layout.bounds.x - SECTION_PADDING;
  container.y = layout.bounds.y - SECTION_PADDING;
  container.resize(
    layout.bounds.width + (SECTION_PADDING * 2),
    layout.bounds.height + (SECTION_PADDING * 2)
  );
  container.fills = [];
  container.strokes = [{ type: 'SOLID', color: hex(COLOR.STROKE_GREY), opacity: 0.35 } as any];
  container.strokeWeight = 3;
  container.setPluginData('economyFlowContainer', 'true');
  backgroundNodes.push(container);

  layout.lanes.forEach(lane => {
    const laneRect = figma.createRectangle();
    laneRect.name = `Lane: ${lane.label}`;
    laneRect.x = layout.bounds.x - 40;
    laneRect.y = lane.activeY;
    laneRect.resize(layout.bounds.width + 80, lane.activeHeight);
    laneRect.fills = [];
    laneRect.strokes = [{
      type: 'SOLID',
      color: hex(lane.color || COLOR.STROKE_GREY),
      opacity: lane.color ? 0.24 : 0.18
    } as any];
    laneRect.strokeWeight = 2;
    backgroundNodes.push(laneRect);
  });

  const group = figma.group(backgroundNodes, figma.currentPage);
  group.name = `${TAG} Background`;
  group.setPluginData('economyFlowLayer', 'background');
  return group;
}

function createNodeLayer(layout: V2LayoutResult, colors: ReturnType<typeof validateCustomColors>): {
  nodeLayer: GroupNode;
  renderedNodes: Map<string, RenderedNode>;
} {
  const renderedNodes = new Map<string, RenderedNode>();
  const nodeSceneNodes: SceneNode[] = [];

  layout.nodes.forEach(positionedNode => {
    const renderedNode = createRenderedNode(positionedNode, colors);
    if (!renderedNode) return;
    renderedNodes.set(positionedNode.id, renderedNode);
    nodeSceneNodes.push(renderedNode.sceneNode);
  });

  const nodeLayer = figma.group(nodeSceneNodes, figma.currentPage);
  nodeLayer.name = `${TAG} Nodes`;
  nodeLayer.setPluginData('economyFlowLayer', 'nodes');
  return { nodeLayer, renderedNodes };
}

function createConnectorLayer(
  data: V2Graph,
  layout: V2LayoutResult,
  renderedNodes: Map<string, RenderedNode>
): { connectors: SceneNode[]; failedEdges: string[] } {
  const routes = routeV2Edges(data, layout);
  const connectors: SceneNode[] = [];
  const failedEdges: string[] = [];

  routes.forEach((route, index) => {
    try {
      const fromNode = renderedNodes.get(route.from);
      const toNode = renderedNodes.get(route.to);
      if (!fromNode || !toNode) {
        failedEdges.push(`Edge ${index}: Node not found (${!fromNode ? route.from : route.to})`);
        return;
      }

      const connector = createConnector(fromNode.connectorTarget, toNode.connectorTarget, {
        startMagnet: 'RIGHT',
        endMagnet: 'LEFT',
        dashPattern: getEdgeDashPattern(route.edge.type),
        strokeColor: getEdgeStrokeColor(route.edge.type),
        strokeOpacity: getEdgeStrokeOpacity(route.edge.type),
        mode: 'deterministic'
      });
      connector.name = `${TAG} Connector: ${route.from} -> ${route.to}`;
      connector.setPluginData('economyFlowConnector', 'true');
      figma.currentPage.appendChild(connector);
      connectors.push(connector);
    } catch (error) {
      failedEdges.push(`Edge ${index}: ${(error as Error).message}`);
    }
  });

  return { connectors, failedEdges };
}

function getEdgeStrokeColor(type?: string): string {
  if (type === 'value') return COLOR.XP_ORANGE;
  if (type === 'cross-lane') return COLOR.CROSS_LANE_BLUE;
  return COLOR.CONNECTOR_GREY;
}

function getEdgeStrokeOpacity(type?: string): number {
  if (type === 'final') return 0.72;
  if (type === 'cross-lane') return 0.82;
  return 1;
}

function getEdgeDashPattern(type?: string): number[] | undefined {
  if (type === 'final') return [10, 10];
  if (type === 'cross-lane') return [6, 4];
  return undefined;
}

function bringRenderedNodesToFront(renderedNodes: Map<string, RenderedNode>) {
  renderedNodes.forEach(renderedNode => {
    const parent = renderedNode.sceneNode.parent;
    if (parent && 'appendChild' in parent) {
      (parent as ChildrenMixin).appendChild(renderedNode.sceneNode);
    }
  });
}

function appendLayer(layer: SceneNode | null) {
  if (!layer) return;
  figma.currentPage.appendChild(layer);
}

function addLegend(
  data: V2Graph,
  backgroundLayer: SceneNode
): GroupNode | null {
  const currencies = extractCurrenciesByType(data);
  const legendSection = createLegendSection(currencies, 0);
  if (!legendSection) {
    return null;
  }

  legendSection.name = `${TAG} Legend`;
  legendSection.x = backgroundLayer.x - legendSection.width - 50;
  legendSection.y = backgroundLayer.y;
  figma.currentPage.appendChild(legendSection);
  return legendSection;
}

function buildStatusMessages(data: V2Graph, connectorCount: number, failedEdges: string[], normalized?: boolean): string[] {
  const messages = ['Diagram created successfully'];
  if (normalized) {
    messages.push('JSON was normalized (auto-repaired).');
  }
  messages.push(`Schema: v${data.schemaVersion}`);
  messages.push(`Stages: ${data.stages.length}, lanes: ${data.lanes?.length || 1}`);
  messages.push(`Connectors: ${connectorCount} created, ${failedEdges.length} failed`);
  if (failedEdges.length > 0) {
    messages.push(`Warning: ${failedEdges.length} edge(s) failed to render`);
  }
  return messages;
}

export async function generateDiagram(
  data: V2Graph,
  customColorInput?: { [key: string]: string },
  options: { normalized?: boolean } = {}
) {
  const colors = validateCustomColors(customColorInput);
  const layout = layoutV2Graph(data);

  if (layout.nodes.size === 0) {
    reply('No elements to display. Check your JSON structure.', false);
    return;
  }

  try {
    const backgroundLayer = createBackgroundLayer(data, layout);
    appendLayer(backgroundLayer);

    const { nodeLayer, renderedNodes } = createNodeLayer(layout, colors);
    const { connectors, failedEdges } = createConnectorLayer(data, layout, renderedNodes);
    bringRenderedNodesToFront(renderedNodes);

    appendLayer(nodeLayer);

    const legendSection = addLegend(data, backgroundLayer);
    const nodesToView: SceneNode[] = [backgroundLayer];
    if (legendSection) {
      nodesToView.push(legendSection);
    }
    figma.viewport.scrollAndZoomIntoView(nodesToView);

    reply(buildStatusMessages(data, connectors.length, failedEdges, options.normalized), failedEdges.length === 0);
  } catch (error) {
    console.error('Failed to create diagram:', error);
    reply(['Failed to create diagram:', (error as Error).message], false);
  }
}
