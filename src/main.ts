/// <reference types="@figma/plugin-typings" />

import { Graph, PluginMessage, Act, Input, Subsection } from './types';
import { COLOR, TAG, BOX_SIZE, PADDING, SECTION_PADDING } from './constants';
import { loadFonts, clear, reply, hex } from './utils';
import { makeBox, makeFinalGoodBox, createConnector } from './node-creation';
import { validateGraphData, validateCustomColors, isValidColor } from './validation';
import { LayoutEngine } from './layout';
import { syncFromCanvas } from './sync';

declare const TEMPLATES: { [key: string]: any };

/* ── UI ── */
figma.showUI(__html__, { width: 400, height: 720 });
figma.ui.postMessage({ type: 'templates', templates: TEMPLATES, colors: COLOR });

/* ── main handler ── */
figma.ui.onmessage = async (m: PluginMessage) => {
  if (m.cmd === 'clear') { 
    clear(); 
    reply('Canvas cleared', true); 
    return; 
  }
  
  if (m.cmd === 'sync-from-canvas') { 
    syncFromCanvas(); 
    return; 
  }
  
  if (m.cmd !== 'draw') return;

  let data: Graph;
  try { 
    data = JSON.parse(m.json); 
  } catch (e: any) { 
    const errorMsg = [
      "JSON Parsing Error:",
      e.message,
      "This usually means there's a syntax error in your JSON.",
      "Common mistakes include:",
      "• A trailing comma (,) after the last item in an array or object.",
      "• Missing commas (,) between items.",
      "• Unmatched brackets [ ] or braces { }.",
      "• Using single quotes instead of double quotes for keys and string values.",
      "• Properties with no value (e.g. `\"sources\":,` should be `\"sources\": []`)."
    ];
    reply(errorMsg, false); 
    return; 
  }

  const errors = validateGraphData(data);
  if (errors.length > 0) {
    reply(errors, false);
    return;
  }

  try {
    await loadFonts();
  } catch (error) {
    reply(['Font loading error:', (error as Error).message], false);
    return;
  }
  
  clear();
  await generateDiagram(data, m.colors);
};

async function generateDiagram(data: Graph, customColorInput?: { [key: string]: string }) {
  const nodes = new Map<string, SceneNode>();
  const elementsToGroup: SceneNode[] = [];
  const customColors = validateCustomColors(customColorInput);
  
  // Layout calculation
  const layoutEngine = new LayoutEngine();
  const allNodesData = [...data.inputs, ...data.nodes];
  const nodeDataMap = new Map(allNodesData.map(n => [n.id, n]));
  
  layoutEngine.calculateNodeHeights(allNodesData);
  const columns = layoutEngine.calculateColumns(data);
  
  // Build reverse adjacency for layout
  const revAdj = new Map<string, string[]>();
  allNodesData.forEach(node => revAdj.set(node.id, []));
  data.edges.forEach(([from, to]) => {
    if (from && to && revAdj.has(to)) {
      revAdj.get(to)!.push(from);
    }
  });
  
  // Position and create nodes
  columns.forEach((nodeIdsInCol, colIndex) => {
    const yTargets = new Map<string, number>();
    nodeIdsInCol.forEach(id => {
      const parentIds = revAdj.get(id)!;
      const parentYs = parentIds
        .map(pId => {
          const col = layoutEngine.getNodeColumn(pId);
          if (col === undefined) return undefined;
          // This is a simplification - in the full implementation, 
          // we'd get the actual Y position from placedNodePositions
          return 0;
        })
        .filter(y => y !== undefined) as number[];
      const targetY = parentYs.length > 0 ? parentYs.reduce((s, y) => s + y, 0) / parentYs.length : 0;
      yTargets.set(id, targetY);
    });
    
    const sortedByYTarget = nodeIdsInCol.sort((a, b) => (yTargets.get(a) || 0) - (yTargets.get(b) || 0));

    sortedByYTarget.forEach(id => {
      const nodeData = nodeDataMap.get(id);
      if (!nodeData) return;

      const y_initial = yTargets.get(id) || 0;
      const y_final = layoutEngine.findConflictFreeY(id, colIndex, y_initial, PADDING.X, PADDING.Y, nodeData, revAdj);
      const x_pos = colIndex * (BOX_SIZE.NODE.W + PADDING.X);
      
      let mainBox: SceneNode;
      try {
        if ('kind' in nodeData && nodeData.kind === 'SINK_RED') {
          mainBox = makeBox(nodeData.label, BOX_SIZE.INPUT.W, BOX_SIZE.INPUT.H, customColors.sink);
        } else if ('kind' in nodeData && nodeData.kind === 'finalGood') {
          mainBox = makeFinalGoodBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, customColors.final);
        } else {
          mainBox = makeBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, COLOR.MAIN_WHITE);
        }
      } catch (error) {
        console.error('Failed to create node:', error);
        return;
      }
      
      mainBox.x = x_pos;
      mainBox.y = y_final;
      mainBox.setPluginData("id", id);

      const totalHeight = layoutEngine.getNodeHeight(id);
      const boxWidth = ('kind' in nodeData && nodeData.kind === 'SINK_RED') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
      layoutEngine.recordNodePosition(id, x_pos, y_final, boxWidth, totalHeight);
      
      nodes.set(id, mainBox);
      elementsToGroup.push(mainBox);

      // Add attributes
      if (!('kind' in nodeData && nodeData.kind === 'finalGood') && 
          ('sources' in nodeData || 'sinks' in nodeData || 'values' in nodeData)) {
        let attrY = mainBox.height + 5;
        const addAttribute = (text: string, color: string) => {
          try {
            const attrBox = makeBox(text, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, color, 'LEFT');
            attrBox.x = mainBox.x;
            attrBox.y = mainBox.y + attrY;
            elementsToGroup.push(attrBox);
            attrY += BOX_SIZE.ATTR.H + 5;
          } catch (error) {
            console.error(`Failed to create attribute box for "${text}":`, error);
          }
        };
        
        const act = nodeData as Act;
        act.sources?.forEach(s => addAttribute('+ ' + s, customColors.source));
        act.sinks?.forEach(s => addAttribute('- ' + s, customColors.sink));
        act.values?.forEach(v => addAttribute(v, customColors.xp));
      }
    });
  });

  // Draw edges
  const failedEdges: string[] = [];
  data.edges.forEach(([fromId, toId], index) => {
    try {
      if (!fromId || !toId) {
        failedEdges.push(`Edge ${index}: Missing from/to ID`);
        return;
      }
      const fromNode = nodes.get(fromId);
      const toNode = nodes.get(toId);
      if (!fromNode || !toNode) {
        failedEdges.push(`Edge ${index}: Node not found (${!fromNode ? fromId : toId})`);
        return;
      }
      const connector = createConnector(fromNode, toNode);
      elementsToGroup.unshift(connector);
    } catch (error) {
      failedEdges.push(`Edge ${index}: ${(error as Error).message}`);
    }
  });

  if (failedEdges.length > 0) {
    console.warn('Some edges failed to render:', failedEdges);
  }

  // Create section and group
  if (elementsToGroup.length > 0) {
    try {
      // Create subsections if defined
      const subsections: SectionNode[] = [];
      if (data.subsections && data.subsections.length > 0) {
        for (const subsectionData of data.subsections) {
          const subsectionNodes: SceneNode[] = [];
          
          // Collect nodes that belong to this subsection
          subsectionData.nodeIds.forEach(nodeId => {
            const node = nodes.get(nodeId);
            if (node) {
              subsectionNodes.push(node);
              // Also collect their attributes
              elementsToGroup.forEach(elem => {
                if (elem !== node && 'x' in elem && 'y' in elem && 
                    Math.abs(elem.x - node.x) < 5 && 
                    elem.y > node.y && elem.y < node.y + 200) {
                  subsectionNodes.push(elem);
                }
              });
            }
          });
          
          if (subsectionNodes.length > 0) {
            // Calculate subsection bounds
            let subMinX = Infinity, subMinY = Infinity, subMaxX = -Infinity, subMaxY = -Infinity;
            subsectionNodes.forEach(node => {
              subMinX = Math.min(subMinX, node.x);
              subMinY = Math.min(subMinY, node.y);
              subMaxX = Math.max(subMaxX, node.x + node.width);
              subMaxY = Math.max(subMaxY, node.y + node.height);
            });
            
            // Create subsection
            const subsection = figma.createSection();
            subsection.name = subsectionData.label;
            subsection.x = subMinX - 30;
            subsection.y = subMinY - 30;
            subsection.resizeWithoutConstraints(
              subMaxX - subMinX + 60,
              subMaxY - subMinY + 60
            );
            
            // Apply custom color if specified
            if (subsectionData.color && isValidColor(subsectionData.color)) {
              const rgb = hex(subsectionData.color);
              subsection.fills = [{ type: 'SOLID', color: rgb, opacity: 0.1 }];
            }
            
            subsection.setPluginData("subsectionId", subsectionData.id);
            subsections.push(subsection);
            elementsToGroup.push(subsection);
          }
        }
      }
      
      // Create main section to contain everything
      const section = figma.createSection();
      section.name = `${TAG} Section`;
      
      // Calculate bounds for the main section
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      elementsToGroup.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      });
      
      // Add padding to section bounds
      section.x = minX - SECTION_PADDING;
      section.y = minY - SECTION_PADDING;
      section.resizeWithoutConstraints(
        maxX - minX + (SECTION_PADDING * 2),
        maxY - minY + (SECTION_PADDING * 2)
      );
      
      // Create the group inside the section
      const group = figma.group(elementsToGroup, figma.currentPage);
      group.name = TAG;
      
      // Move the group into the section
      section.appendChild(group);
      figma.currentPage.appendChild(section);
      
      // Store section ID for sync purposes
      section.setPluginData("economyFlowSection", "true");
      
      figma.viewport.scrollAndZoomIntoView([section]);
      
      const messages = ['Diagram created successfully in section'];
      if (data.subsections && data.subsections.length > 0) {
        messages.push(`Created ${data.subsections.length} subsection(s)`);
      }
      if (failedEdges.length > 0) {
        messages.push(`Warning: ${failedEdges.length} edge(s) failed to render`);
      }
      reply(messages, failedEdges.length === 0);
    } catch (error) {
      console.error('Failed to create section/group:', error);
      reply(['Failed to create diagram:', (error as Error).message], false);
    }
  } else {
    reply('No elements to display. Check your JSON structure.', false);
  }
}