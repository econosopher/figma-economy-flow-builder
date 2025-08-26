/// <reference types="@figma/plugin-typings" />

import { Graph, Act, Input, Subsection } from './types';
import { TAG, BOX_SIZE } from './constants';
import { reply, isShapeWithText } from './utils';

export async function syncFromCanvas() {
  try {
    // First try to find a section containing our economy flow
    const section = figma.currentPage.findOne(n => 
      n.type === 'SECTION' && n.getPluginData("economyFlowSection") === "true"
    ) as SectionNode;
    
    let group: SceneNode | null = null;
    let searchContainer: BaseNode = figma.currentPage;
    
    if (section) {
      // Look for the group inside the section
      group = section.findOne(n => n.name === TAG);
      searchContainer = section; // Search for subsections within the main section
    } else {
      // Fallback: look for the group in the page (legacy support)
      group = figma.currentPage.findOne(n => n.name === TAG);
    }
    
    if (!group || !('children' in group)) {
      reply('No diagram found to sync. Please generate a diagram first.', false);
      return;
    }

    const graph: Graph = { inputs: [], nodes: [], edges: [] };
    const tempNodeData = new Map<string, {node: SceneNode, act: Act | Input}>();
    const figmaIdToStableId = new Map<string, string>();
    const ignoredNodes: string[] = [];

    const children = [...(group as GroupNode).children];

    // Pass 1: Reconstruct all nodes
    for (const child of children) {
      const id = child.getPluginData("id");
      if (!id) {
        // Skip attributes (they're handled in pass 2) and connectors
        if (child.type === 'CONNECTOR') continue;
        if (isShapeWithText(child) && child.width <= BOX_SIZE.ATTR.W) continue;
        
        // Track other non-conforming objects
        ignoredNodes.push(`${child.type}: ${child.name || 'Unnamed'}`);
        continue;
      }

      if (child.name.includes("Final Good")) {
        const finalGoodGroup = child as GroupNode;
        const body = finalGoodGroup.children.find(isShapeWithText);
        if (body) {
          const label = body.text.characters;
          const act: Act = { id, label, kind: 'final_good' };
          graph.nodes.push(act);
          tempNodeData.set(child.id, { node: child, act });
          figmaIdToStableId.set(child.id, id);
        }
      } else if (isShapeWithText(child) && child.width > BOX_SIZE.ATTR.W) {
        const node = child;
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
          tempNodeData.set(node.id, { node, act: input });
          figmaIdToStableId.set(node.id, id);
        } else {
          const act: Act = { id, label, sources: [], sinks: [], values: [] };
          graph.nodes.push(act);
          tempNodeData.set(node.id, { node, act });
          figmaIdToStableId.set(node.id, id);
        }
      }
    }

    // Pass 2: Find attributes
    for (const child of children) {
      if (isShapeWithText(child) && child.width <= BOX_SIZE.ATTR.W) {
        const attrNode = child;
        const fills = attrNode.fills;

        // Find parent by positional check
        let parentData: {node: SceneNode, act: Act | Input} | undefined;
        let minDistance = Infinity;

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
    }

    // Pass 3: Reconstruct edges
    for (const child of children) {
      if (child.type === 'CONNECTOR') {
        const connector = child as ConnectorNode;
        const startId = (connector.connectorStart as any).endpointNodeId;
        const endId = (connector.connectorEnd as any).endpointNodeId;
        
        const fromStableId = figmaIdToStableId.get(startId);
        const toStableId = figmaIdToStableId.get(endId);

        if (fromStableId && toStableId) {
          graph.edges.push([fromStableId, toStableId]);
        }
      }
    }

    // Pass 4: Reconstruct subsections
    const subsections: Subsection[] = [];
    // Look for subsections in the parent container (section or page), not in the group
    const subsectionParent = searchContainer as PageNode | SectionNode;
    if ('children' in subsectionParent) {
      for (const child of subsectionParent.children) {
        if (child.type === 'SECTION' && child.getPluginData("subsectionId")) {
        const subsectionId = child.getPluginData("subsectionId");
        const section = child as SectionNode;
        
        // Find all nodes within this subsection
        const nodeIdsInSubsection: string[] = [];
        const sectionBounds = {
          x: section.x,
          y: section.y,
          right: section.x + section.width,
          bottom: section.y + section.height
        };
        
        // Check which nodes are inside this subsection
        tempNodeData.forEach((data, figmaId) => {
          const node = data.node;
          if ('x' in node && 'y' in node) {
            const nodeCenter = {
              x: node.x + node.width / 2,
              y: node.y + node.height / 2
            };
            
            if (nodeCenter.x >= sectionBounds.x && 
                nodeCenter.x <= sectionBounds.right &&
                nodeCenter.y >= sectionBounds.y && 
                nodeCenter.y <= sectionBounds.bottom) {
              nodeIdsInSubsection.push(data.act.id);
            }
          }
        });
        
        if (nodeIdsInSubsection.length > 0) {
          const subsection: Subsection = {
            id: subsectionId,
            label: section.name,
            nodeIds: nodeIdsInSubsection
          };
          
          // Extract color if it has a custom fill
          const fills = section.fills;
          if (fills && typeof fills !== 'symbol' && fills.length > 0 && fills[0].type === 'SOLID') {
            const fill = fills[0] as SolidPaint;
            const r = Math.round(fill.color.r * 255);
            const g = Math.round(fill.color.g * 255);
            const b = Math.round(fill.color.b * 255);
            subsection.color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
          }
          
          subsections.push(subsection);
        }
      }
    }
    }
    
    if (subsections.length > 0) {
      graph.subsections = subsections;
    }

    // Validate the reconstructed graph
    if (graph.inputs.length === 0 && graph.nodes.length === 0) {
      console.error('Sync failed - no nodes found');
      console.error('Group children:', children.length);
      console.error('TempNodeData entries:', tempNodeData.size);
      reply('No valid nodes found in the diagram. Please check the console for debugging info.', false);
      return;
    }

    const json = JSON.stringify(graph, null, 2);
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
