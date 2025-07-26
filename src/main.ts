/// <reference types="@figma/plugin-typings" />

import { Graph, PluginMessage, Act, Input, Subsection } from './types';
import { COLOR, TAG, BOX_SIZE, PADDING, SECTION_PADDING, INITIAL_X_OFFSET, INITIAL_Y_OFFSET } from './constants';
import { loadFonts, clear, reply, hex } from './utils';
import { makeBox, makeFinalGoodBox, createConnector } from './node-creation';
import { validateGraphData, validateCustomColors, isValidColor } from './validation';
import { LayoutEngine } from './layout';
import { syncFromCanvas } from './sync';

// Extract unique currencies by type from the graph
function extractCurrenciesByType(graph: Graph): { sinks: string[], sources: string[], values: string[] } {
  const sinks = new Set<string>();
  const sources = new Set<string>();
  const values = new Set<string>();
  
  // Process all nodes
  graph.nodes.forEach(node => {
    if (node.sinks) {
      node.sinks.forEach(sink => sinks.add(sink));
    }
    if (node.sources) {
      node.sources.forEach(source => sources.add(source));
    }
    if (node.values) {
      node.values.forEach(value => values.add(value));
    }
  });
  
  return {
    sinks: Array.from(sinks).sort(),
    sources: Array.from(sources).sort(),
    values: Array.from(values).sort()
  };
}

// Create a legend section showing all currency types
function createLegendSection(currencies: { sinks: string[], sources: string[], values: string[] }, initialSectionX: number): SectionNode | null {
  const legendNodes: SceneNode[] = [];
  const HEADER_HEIGHT = BOX_SIZE.NODE.H; // Same as action boxes
  const ITEM_SPACING = 5;
  const HEADER_MARGIN_BOTTOM = 10;
  const LEGEND_SECTION_SPACING = 50; // Spacing between legend and main section
  const COLUMN_SPACING = BOX_SIZE.NODE.W + LEGEND_SECTION_SPACING; // Same spacing as between sections
  
  let currentX = INITIAL_X_OFFSET; // Start with same offset as main diagram
  let maxHeight = 0;
  
  // Create sections for each type
  const sections = [
    { type: 'Sinks', items: currencies.sinks, color: COLOR.INITIAL_SINK_NODE },
    { type: 'Sources', items: currencies.sources, color: COLOR.SOURCE_GREEN },
    { type: 'Stores of Value', items: currencies.values, color: COLOR.XP_ORANGE }
  ];
  
  sections.forEach((section, sectionIndex) => {
    if (section.items.length === 0) return;
    
    // Create header box (same size as action boxes)
    const headerBox = makeBox(section.type, BOX_SIZE.NODE.W, HEADER_HEIGHT, section.color);
    headerBox.x = currentX;
    headerBox.y = 0;
    legendNodes.push(headerBox);
    
    // Create item boxes (same style as attribute boxes)
    let currentY = HEADER_HEIGHT + HEADER_MARGIN_BOTTOM;
    section.items.forEach((item, itemIndex) => {
      const itemBox = makeBox(item, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, section.color);
      itemBox.x = currentX; // Left-align with header box
      itemBox.y = currentY;
      legendNodes.push(itemBox);
      
      currentY += BOX_SIZE.ATTR.H + ITEM_SPACING;
    });
    
    maxHeight = Math.max(maxHeight, currentY);
    currentX += COLUMN_SPACING;
  });
  
  if (legendNodes.length === 0) return null;
  
  // Calculate bounds with proper padding (same as initial section)
  const sectionPadding = { top: 80, right: 60, bottom: 60, left: 70 };
  const sectionWidth = currentX - INITIAL_X_OFFSET + sectionPadding.right;
  const sectionHeight = maxHeight + sectionPadding.top + sectionPadding.bottom; // Include top padding in height
  
  // Create subsection for the legend
  const legendSection = figma.createSection();
  legendSection.name = "Legend";
  legendSection.x = initialSectionX; // Align with initial section
  legendSection.y = 0; // Will be positioned later
  legendSection.resizeWithoutConstraints(sectionWidth, sectionHeight);
  
  // Add all nodes to the section with padding
  legendNodes.forEach(node => {
    node.y += sectionPadding.top;
    legendSection.appendChild(node);
  });
  
  return legendSection;
}

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
  const mainBoxes = new Map<string, SceneNode>(); // Store main boxes for connector endpoints
  const connectors: SceneNode[] = [];
  const nodesAndAttributes: SceneNode[] = [];
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
          if (col === undefined || col >= colIndex) return undefined;
          // Get actual Y position of parent node
          const parentPos = layoutEngine.getNodePosition(pId);
          return parentPos ? parentPos.y - INITIAL_Y_OFFSET : undefined;
        })
        .filter(y => y !== undefined) as number[];
      const targetY = parentYs.length > 0 ? parentYs.reduce((s, y) => s + y, 0) / parentYs.length : 0;
      yTargets.set(id, targetY);
    });
    
    const sortedByYTarget = nodeIdsInCol.sort((a, b) => (yTargets.get(a) || 0) - (yTargets.get(b) || 0));

    sortedByYTarget.forEach(id => {
      const nodeData = nodeDataMap.get(id);
      if (!nodeData) {
        return;
      }

      const y_initial = yTargets.get(id) || 0;
      const y_final = layoutEngine.findConflictFreeY(id, colIndex, y_initial, PADDING.X, PADDING.Y, nodeData, revAdj);
      const x_pos = INITIAL_X_OFFSET + (colIndex * (BOX_SIZE.NODE.W + PADDING.X));
      
      // Record position BEFORE creating the node so collision detection works for subsequent nodes
      const totalHeight = layoutEngine.getNodeHeight(id);
      const boxWidth = ('kind' in nodeData && nodeData.kind === 'initial_sink_node') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
      layoutEngine.recordNodePosition(id, x_pos, INITIAL_Y_OFFSET + y_final, boxWidth, totalHeight);
      
      let mainBox: SceneNode;
      let actualConnectorTarget: SceneNode; // The actual box to connect to
      try {
        if ('kind' in nodeData && nodeData.kind === 'initial_sink_node') {
          mainBox = makeBox(nodeData.label, BOX_SIZE.INPUT.W, BOX_SIZE.INPUT.H, customColors.sink);
          actualConnectorTarget = mainBox;
        } else if ('kind' in nodeData && nodeData.kind === 'final_good') {
          mainBox = makeFinalGoodBox(nodeData.label, BOX_SIZE.FINAL_GOOD.W, BOX_SIZE.FINAL_GOOD.H, customColors.final);
          // For final good, the main box is a group - find the body box inside it
          if (mainBox.type === 'GROUP' && 'children' in mainBox && mainBox.children.length > 1) {
            // Find the body box (the one with y > 0, as header is at y=0)
            const bodyBox = mainBox.children.find(child => 
              child.type === 'SHAPE_WITH_TEXT' && child.y > 0
            );
            if (bodyBox) {
              actualConnectorTarget = bodyBox;
              console.log(`Final good "${nodeData.label}" - using body box for connector`);
            } else {
              // Fallback to second child
              actualConnectorTarget = mainBox.children[1];
              console.warn(`Final good "${nodeData.label}" - couldn't find body by position, using second child`);
            }
          } else {
            console.warn(`Final good "${nodeData.label}" - couldn't find body box, using group`);
            actualConnectorTarget = mainBox;
          }
        } else {
          mainBox = makeBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, COLOR.MAIN_WHITE);
          actualConnectorTarget = mainBox;
        }
      } catch (error) {
        console.error('Failed to create node:', error);
        return;
      }
      
      mainBox.x = x_pos;
      mainBox.y = INITIAL_Y_OFFSET + y_final;
      mainBox.setPluginData("id", id);
      
      // Collect main box and its attributes for grouping
      const nodeElements: SceneNode[] = [mainBox];

      // Add attributes
      if (!('kind' in nodeData && nodeData.kind === 'final_good') && 
          ('sources' in nodeData || 'sinks' in nodeData || 'values' in nodeData)) {
        let attrY = mainBox.height + 5;
        const addAttribute = (text: string, color: string) => {
          try {
            const attrBox = makeBox(text, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, color, 'LEFT');
            attrBox.x = mainBox.x;
            attrBox.y = mainBox.y + attrY;
            nodeElements.push(attrBox);
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
      
      // Group the node with its attributes if there are attributes
      let nodeGroup: SceneNode;
      if (nodeElements.length > 1) {
        nodeGroup = figma.group(nodeElements, figma.currentPage);
        nodeGroup.name = `Node: ${nodeData.label}`;
        nodeGroup.setPluginData("id", id);
        // For regular nodes with attributes, ensure we're targeting the main box (first child)
        if (!('kind' in nodeData && nodeData.kind === 'final_good')) {
          actualConnectorTarget = nodeElements[0]; // The main box is always first
        }
      } else {
        nodeGroup = mainBox;
      }
      
      nodes.set(id, nodeGroup);
      mainBoxes.set(id, actualConnectorTarget); // Store the actual connector target
      nodesAndAttributes.push(nodeGroup);
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
      const fromNode = mainBoxes.get(fromId) || nodes.get(fromId);
      const toNode = mainBoxes.get(toId) || nodes.get(toId);
      if (!fromNode || !toNode) {
        failedEdges.push(`Edge ${index}: Node not found (${!fromNode ? fromId : toId})`);
        return;
      }
      const connector = createConnector(fromNode, toNode);
      connectors.push(connector);
    } catch (error) {
      failedEdges.push(`Edge ${index}: ${(error as Error).message}`);
    }
  });

  if (failedEdges.length > 0) {
    console.warn('Some edges failed to render:', failedEdges);
  }

  // Combine elements with connectors first (so they render behind nodes)
  const elementsToGroup = [...connectors, ...nodesAndAttributes];
  
  // Create section and group
  if (elementsToGroup.length > 0) {
    try {
      // Create subsections if defined
      const subsections: SectionNode[] = [];
      let initialSectionX = 0; // Track X position of initial section for legend alignment
      let legendSection: SectionNode | null = null;
      if (data.subsections && data.subsections.length > 0) {
        for (const subsectionData of data.subsections) {
          const subsectionNodes: SceneNode[] = [];
          
          // Collect nodes that belong to this subsection
          subsectionData.nodeIds.forEach(nodeId => {
            const node = nodes.get(nodeId);
            if (node) {
              subsectionNodes.push(node);
              // No need to collect attributes separately as they're now grouped with the node
            }
          });
          
          if (subsectionNodes.length > 0) {
            // Use layout engine to calculate subsection bounds with proper margins
            const bounds = layoutEngine.calculateSubsectionBounds(subsectionData.nodeIds, nodeDataMap);
            
            // Create subsection
            const subsection = figma.createSection();
            subsection.name = subsectionData.label;
            subsection.x = bounds.x;
            subsection.y = bounds.y;
            subsection.resizeWithoutConstraints(
              bounds.width,
              bounds.height
            );
            
            // Check if this is the initial section (contains initial_sink_nodes)
            const hasInitialNodes = subsectionData.nodeIds.some(id => {
              const nodeData = nodeDataMap.get(id);
              return nodeData && 'kind' in nodeData && nodeData.kind === 'initial_sink_node';
            });
            if (hasInitialNodes) {
              initialSectionX = bounds.x;
            }
            
            // Apply custom color if specified
            if (subsectionData.color && isValidColor(subsectionData.color)) {
              const rgb = hex(subsectionData.color);
              subsection.fills = [{ type: 'SOLID', color: rgb, opacity: 0.1 }];
            }
            
            subsection.setPluginData("subsectionId", subsectionData.id);
            subsections.push(subsection);
            // Don't add subsections to elementsToGroup - they should be siblings of the group
          }
        }
      }
      
      // Create main section to contain everything
      const section = figma.createSection();
      // Use the graph name if provided, otherwise use default
      section.name = data.name ? `${data.name} Economy` : `${TAG} Section`;
      
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
      
      // Ensure connectors are behind nodes by reordering within the group
      // In Figma, children are rendered in order (first child = back, last child = front)
      const groupChildren = [...group.children];
      const connectorsInGroup = groupChildren.filter(child => child.type === 'CONNECTOR');
      const nonConnectors = groupChildren.filter(child => child.type !== 'CONNECTOR');
      
      // Remove all children and re-add them in the correct order
      connectorsInGroup.forEach(connector => group.appendChild(connector));
      nonConnectors.forEach(node => group.appendChild(node));
      
      // Add subsections to the main section (as siblings of the group)
      subsections.forEach(subsection => {
        section.appendChild(subsection);
      });
      
      figma.currentPage.appendChild(section);
      
      // Create and add legend section OUTSIDE the main section
      const currencies = extractCurrenciesByType(data);
      legendSection = createLegendSection(currencies, section.x); // Use main section's X position
      if (legendSection) {
        // Position legend below the main section with spacing
        const sectionBounds = section.absoluteBoundingBox;
        if (sectionBounds) {
          legendSection.y = section.y + sectionBounds.height + 50; // 50px spacing between sections
        }
        figma.currentPage.appendChild(legendSection);
      }
      
      // Store section ID for sync purposes
      section.setPluginData("economyFlowSection", "true");
      
      const nodesToView = [section];
      if (legendSection) {
        nodesToView.push(legendSection);
      }
      figma.viewport.scrollAndZoomIntoView(nodesToView);
      
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