/// <reference types="@figma/plugin-typings" />

import { Graph, Act, Input, Subsection, V2Edge, V2Graph, V2Node } from './types';
import { TAG, BOX_SIZE } from './constants';
import { reply, isShapeWithText } from './utils';

export async function syncFromCanvas() {
  try {
    // Prefer the current structure: a page-level group named TAG (no SECTION nodes).
    // Keep legacy support for older diagrams that used SECTION containers.
    const legacySection = figma.currentPage.findOne(n =>
      n.type === 'SECTION' && n.getPluginData("economyFlowSection") === "true"
    ) as SectionNode | null;

    let group: SceneNode | null = null;
    let searchContainer: BaseNode = figma.currentPage;

    if (legacySection) {
      group = legacySection.findOne(n => n.name === TAG);
      searchContainer = legacySection;
    } else {
      group = figma.currentPage.findOne(n => n.name === `${TAG} Nodes`) ||
        figma.currentPage.findOne(n => n.name === TAG);
    }
    
    const graph: Graph = { inputs: [], nodes: [], edges: [] };
    const tempNodeData = new Map<string, {node: SceneNode, act: Act | Input}>();
    const stableIdToNodeData = new Map<string, {node: SceneNode, act: Act | Input}>();
    const figmaIdToStableId = new Map<string, string>();
    const ignoredNodes: string[] = [];

    const connectorNodes: ConnectorNode[] = [];
    // First choice: scan the page for connectors created by this plugin.
    for (const n of figma.currentPage.findAll(node =>
      node.type === 'CONNECTOR' && node.getPluginData('economyFlowConnector') === 'true'
    ) as ConnectorNode[]) {
      connectorNodes.push(n);
    }

    if (connectorNodes.length === 0) {
      // Legacy fallback: connectors were grouped under a tagged connector group.
      const connectorGroup = searchContainer.findOne(n => n.getPluginData('economyFlowConnectorGroup') === 'true');
      if (connectorGroup && 'children' in connectorGroup) {
        for (const child of (connectorGroup as GroupNode).children) {
          if (child.type === 'CONNECTOR') {
            connectorNodes.push(child as ConnectorNode);
          }
        }
      }
    }

    if (connectorNodes.length === 0) {
      // Last resort: scan the container directly for connectors.
      if (group && 'children' in group) {
        for (const child of (group as GroupNode).children) {
          if (child.type === 'CONNECTOR') connectorNodes.push(child as ConnectorNode);
        }
      }
      if (connectorNodes.length === 0 && 'children' in searchContainer) {
        for (const child of (searchContainer as PageNode | SectionNode).children) {
          if (child.type === 'CONNECTOR') connectorNodes.push(child as ConnectorNode);
        }
      }
    }

    const seenNodeIds = new Set<string>();
    const nodeCandidates: SceneNode[] = [];
    const pushNode = (node: SceneNode) => {
      if (!seenNodeIds.has(node.id)) {
        seenNodeIds.add(node.id);
        nodeCandidates.push(node);
      }
    };

    if (group && 'children' in group) {
      for (const child of (group as GroupNode).children) {
        if (child.type !== 'CONNECTOR') {
          pushNode(child);
        }
      }
    }

    if (legacySection && 'children' in legacySection) {
      for (const child of legacySection.children) {
        if (child.getPluginData && child.getPluginData('economyFlowConnectorGroup') === 'true') {
          continue;
        }
        if (child.type === 'SECTION' && child.getPluginData("subsectionId") && 'children' in child) {
          for (const grandChild of (child as SectionNode).children) {
            if (grandChild.type !== 'CONNECTOR') {
              pushNode(grandChild as SceneNode);
            }
          }
          continue;
        }
        if (child.type !== 'CONNECTOR') {
          pushNode(child as SceneNode);
        }
      }
    }

    const attributeCandidates: SceneNode[] = [];
    const seenAttributeIds = new Set<string>();
    const collectAttributeNodes = (node: SceneNode) => {
      if (isShapeWithText(node) && node.width <= BOX_SIZE.ATTR.W) {
        if (!seenAttributeIds.has(node.id)) {
          seenAttributeIds.add(node.id);
          attributeCandidates.push(node);
        }
      }
      if ('children' in node) {
        for (const child of (node as GroupNode).children) {
          collectAttributeNodes(child as SceneNode);
        }
      }
    };

    nodeCandidates.forEach(node => collectAttributeNodes(node));

    if (nodeCandidates.length === 0) {
      reply('No diagram found to sync. Please generate a diagram first.', false);
      return;
    }

    // Pass 1: Reconstruct all nodes
    for (const child of nodeCandidates) {
      const id = child.getPluginData("id");
      if (!id) {
        // Skip attributes (they're handled in pass 2) and connectors
        if (child.type === 'CONNECTOR') continue;
        if (isShapeWithText(child) && child.width <= BOX_SIZE.ATTR.W) continue;
        
        // Track other non-conforming objects
        ignoredNodes.push(`${child.type}: ${child.name || 'Unnamed'}`);
        continue;
      }

      const mainShape = findMainShape(child);
      if (child.name.includes("Final Good")) {
        const finalGoodGroup = child as GroupNode;
        const body = findFinalGoodBody(finalGoodGroup);
        if (body) {
          const label = body.text.characters;
          const act: Act = { id, label, kind: 'final_good' };
          graph.nodes.push(act);
          tempNodeData.set(child.id, { node: child, act });
          stableIdToNodeData.set(id, { node: child, act });
          figmaIdToStableId.set(child.id, id);
          figmaIdToStableId.set(body.id, id);
        }
      } else if (mainShape) {
        const node = mainShape;
        const fills = node.fills as readonly Paint[];
        if (!fills || fills.length === 0 || fills[0].type !== 'SOLID') {
          console.warn('Skipping node with invalid fill');
          continue;
        }
        const fill = fills[0] as SolidPaint;
        const label = node.text.characters;
        
        const r = Math.round(fill.color.r * 255);
        if (r >= 213 && r <= 223) { // initial_sink_node with tolerance
          const input: Input = { id, label, kind: 'initial_sink_node' };
          graph.inputs.push(input);
          tempNodeData.set(child.id, { node, act: input });
          stableIdToNodeData.set(id, { node, act: input });
          figmaIdToStableId.set(child.id, id);
          figmaIdToStableId.set(node.id, id);
        } else {
          const act: Act = { id, label, sources: [], sinks: [], values: [] };
          graph.nodes.push(act);
          tempNodeData.set(child.id, { node, act });
          stableIdToNodeData.set(id, { node, act });
          figmaIdToStableId.set(child.id, id);
          figmaIdToStableId.set(node.id, id);
        }
      }
    }

    // Pass 2: Find attributes
    for (const attrNode of attributeCandidates) {
      if (!isShapeWithText(attrNode)) continue;
      const fills = attrNode.fills;

      // Find parent by positional check
      const ancestorStableId = findAncestorStableId(attrNode);
      let parentData: {node: SceneNode, act: Act | Input} | undefined = ancestorStableId
        ? stableIdToNodeData.get(ancestorStableId)
        : undefined;
      let minDistance = Infinity;

      if (!parentData) {
        for (const data of tempNodeData.values()) {
          const p = data.node;
          if (Math.abs(p.x - attrNode.x) < 5 && attrNode.y > p.y) {
            const distance = attrNode.y - (p.y + p.height);
            if (distance >= 0 && distance < minDistance) {
              minDistance = distance;
              parentData = data;
            }
          }
        }
      }

      if (parentData && 'sources' in parentData.act) {
        const text = attrNode.text.characters;
        const tag = attrNode.getPluginData('attrType');
        const normalized = text.replace(/^[+-]\s*/, '').trim();

        if (tag === 'source') {
          parentData.act.sources?.push(normalized);
          continue;
        } else if (tag === 'sink') {
          parentData.act.sinks?.push(normalized);
          continue;
        } else if (tag === 'value') {
          parentData.act.values?.push(normalized);
          continue;
        }

        // Fallback: use prefix, then color
        if (/^\+\s*/.test(text)) {
          parentData.act.sources?.push(normalized);
          continue;
        } else if (/^-\s*/.test(text)) {
          parentData.act.sinks?.push(normalized);
          continue;
        }

        // Last resort: color heuristic
        if (fills && typeof fills !== 'symbol' && fills.length > 0 && fills[0].type === 'SOLID') {
          const fill = fills[0] as SolidPaint;
          const r = Math.round(fill.color.r * 255);
          const g = Math.round(fill.color.g * 255);
          const b = Math.round(fill.color.b * 255);
          const isGreen = r >= 70 && r <= 80 && g >= 170 && g <= 180;
          const isRed = r >= 213 && r <= 223 && g >= 79 && g <= 89;
          const isOrange = r >= 231 && r <= 241 && g >= 154 && g <= 164;
          if (isGreen) parentData.act.sources?.push(normalized);
          else if (isRed) parentData.act.sinks?.push(normalized);
          else if (isOrange) parentData.act.values?.push(normalized);
          else console.warn(`Unknown attribute color: rgb(${r}, ${g}, ${b}) for text: ${text}`);
        }
      }
    }

    // Pass 3: Reconstruct edges (de-duplicated)
    const edgeKeys = new Set<string>();
    for (const connector of connectorNodes) {
      const startId = (connector.connectorStart as any).endpointNodeId;
      const endId = (connector.connectorEnd as any).endpointNodeId;

      const fromStableId = figmaIdToStableId.get(startId);
      const toStableId = figmaIdToStableId.get(endId);

      if (fromStableId && toStableId) {
        const key = `${fromStableId}→${toStableId}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          graph.edges.push([fromStableId, toStableId]);
        }
      }
    }

    // Pass 4: Reconstruct subsections
    const subsections: Subsection[] = [];
    // Look for subsections in the parent container (legacy: section, current: page).
    const subsectionParent = searchContainer as PageNode | SectionNode;
    const paintToHex = (paint: Paint | undefined): string | undefined => {
      if (!paint || paint.type !== 'SOLID') return undefined;
      const solid = paint as SolidPaint;
      const r = Math.round(solid.color.r * 255);
      const g = Math.round(solid.color.g * 255);
      const b = Math.round(solid.color.b * 255);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    };

    if ('children' in subsectionParent) {
      for (const child of subsectionParent.children) {
        const subsectionId = child.getPluginData?.("subsectionId");
        if (!subsectionId) continue;
        if (!('x' in child && 'y' in child && 'width' in child && 'height' in child)) continue;

        const bounds = {
          x: child.x,
          y: child.y,
          right: child.x + child.width,
          bottom: child.y + child.height
        };

        // Find all nodes whose centers are inside the subsection bounds.
        const nodeIdsInSubsection: string[] = [];
        tempNodeData.forEach(({ node, act }) => {
          if (!('x' in node && 'y' in node && 'width' in node && 'height' in node)) return;
          const nodeCenter = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
          if (
            nodeCenter.x >= bounds.x &&
            nodeCenter.x <= bounds.right &&
            nodeCenter.y >= bounds.y &&
            nodeCenter.y <= bounds.bottom
          ) {
            nodeIdsInSubsection.push(act.id);
          }
        });

        if (nodeIdsInSubsection.length === 0) continue;

        const subsection: Subsection = {
          id: subsectionId,
          label: child.name || 'Subsection',
          nodeIds: nodeIdsInSubsection
        };

        // Extract color: legacy sections use fills; current rectangles use strokes.
        if (child.type === 'SECTION') {
          const fills = (child as SectionNode).fills;
          if (fills && typeof fills !== 'symbol' && fills.length > 0) {
            subsection.color = paintToHex(fills[0] as any);
          }
        } else if (child.type === 'RECTANGLE') {
          const strokes = (child as RectangleNode).strokes;
          if (strokes && typeof strokes !== 'symbol' && strokes.length > 0) {
            subsection.color = paintToHex(strokes[0] as any);
          }
        }

        subsections.push(subsection);
      }
    }
    
    if (subsections.length > 0) {
      graph.subsections = subsections;
    }

    // Validate the reconstructed graph
    if (graph.inputs.length === 0 && graph.nodes.length === 0) {
      console.error('Sync failed - no nodes found');
      console.error('Node candidates:', nodeCandidates.length);
      console.error('TempNodeData entries:', tempNodeData.size);
      reply('No valid nodes found in the diagram. Please check the console for debugging info.', false);
      return;
    }

    const storedV2Graph = await loadStoredV2Graph();
    const outputGraph = storedV2Graph ? mergeCanvasIntoV2Graph(storedV2Graph, graph) : graph;
    const json = JSON.stringify(outputGraph, null, 2);
    figma.ui.postMessage({ type: 'sync-json', json });
    try {
      const prev = await figma.clientStorage.getAsync('economyFlowState');
      const colors = prev && typeof prev === 'object' ? (prev as any).colors : undefined;
      await figma.clientStorage.setAsync('economyFlowState', { json, colors });
    } catch {}
    
    const messages = ['Successfully synced diagram to JSON'];
    if (subsections.length > 0) {
      messages.push(`Found ${subsections.length} subsection(s)`);
    }
    reply(messages, true);
  } catch (error) {
    console.error('Sync error:', error);
    reply(['Sync failed:', (error as Error).message], false);
  }
}

function findAncestorStableId(node: SceneNode): string | undefined {
  let current: BaseNode | null = node.parent;
  while (current && current.type !== 'PAGE') {
    const id = (current as SceneNode).getPluginData?.('id');
    if (id) return id;
    current = current.parent;
  }
  return undefined;
}

function findMainShape(node: SceneNode): (SceneNode & { text: { characters: string }, fills: readonly Paint[] }) | null {
  if (isShapeWithText(node) && node.width > BOX_SIZE.ATTR.W) {
    return node as any;
  }

  if (!('children' in node)) {
    return null;
  }

  return (node as GroupNode).children.find(child =>
    isShapeWithText(child) &&
    child.width > BOX_SIZE.ATTR.W &&
    !/^Final Good$/i.test(child.text.characters)
  ) as any || null;
}

function findFinalGoodBody(group: GroupNode): (SceneNode & { text: { characters: string } }) | null {
  const textChildren = group.children.filter(isShapeWithText);
  return textChildren.find(child => !/^Final Good$/i.test(child.text.characters)) as any ||
    textChildren.find(child => child.y > group.y) as any ||
    null;
}

async function loadStoredV2Graph(): Promise<V2Graph | null> {
  try {
    const state = await figma.clientStorage.getAsync('economyFlowState') as any;
    if (!state || typeof state !== 'object' || typeof state.json !== 'string') return null;
    const parsed = JSON.parse(state.json);
    if (parsed?.schemaVersion === 2 && Array.isArray(parsed.stages) && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return parsed as V2Graph;
    }
  } catch {}
  return null;
}

function mergeCanvasIntoV2Graph(base: V2Graph, canvas: Graph): V2Graph {
  const baseNodes = new Map(base.nodes.map(node => [node.id, node]));
  const baseEdges = new Map(base.edges.map(edge => [`${edge.from}->${edge.to}`, edge]));
  const fallbackLaneId = base.lanes?.[0]?.id;
  const fallbackStageId = base.stages[0]?.id || 'inputs';
  const terminalStageId = base.stages[base.stages.length - 1]?.id || fallbackStageId;

  const inputNodes: V2Node[] = canvas.inputs.map(input => {
    const existing = baseNodes.get(input.id);
    return {
      id: input.id,
      label: input.label,
      kind: 'initial_sink_node',
      stageId: existing?.stageId || fallbackStageId,
      laneId: existing?.laneId || fallbackLaneId,
      sources: [],
      sinks: [],
      values: []
    };
  });

  const actionNodes: V2Node[] = canvas.nodes.map(node => {
    const existing = baseNodes.get(node.id);
    const isFinalGood = node.kind === 'final_good' || existing?.kind === 'final_good';
    return {
      id: node.id,
      label: node.label,
      kind: isFinalGood ? 'final_good' : (existing?.kind || 'action'),
      stageId: isFinalGood ? terminalStageId : (existing?.stageId || fallbackStageId),
      laneId: existing?.laneId || fallbackLaneId,
      sources: node.sources || [],
      sinks: node.sinks || [],
      values: node.values || []
    };
  });

  const nodeIds = new Set([...inputNodes, ...actionNodes].map(node => node.id));
  const edges: V2Edge[] = canvas.edges
    .filter(([from, to]) => nodeIds.has(from) && nodeIds.has(to))
    .map(([from, to]) => {
      const existing = baseEdges.get(`${from}->${to}`);
      const target = [...inputNodes, ...actionNodes].find(node => node.id === to);
      const type = existing?.type || (target?.kind === 'final_good' ? 'final' : undefined);
      return type ? { from, to, type } : { from, to };
    });

  return {
    schemaVersion: 2,
    name: base.name,
    stages: base.stages,
    lanes: base.lanes,
    nodes: [...inputNodes, ...actionNodes],
    edges
  };
}
