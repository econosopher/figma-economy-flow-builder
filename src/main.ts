/// <reference types="@figma/plugin-typings" />

import { Graph, PluginMessage, Act, Input } from './types';
import { COLOR, TAG, BOX_SIZE, PADDING, SECTION_PADDING, INITIAL_X_OFFSET, INITIAL_Y_OFFSET } from './constants';
import { loadFonts, clear, reply, hex } from './utils';
import { makeBox, makeFinalGoodBox, createConnector } from './node-creation';
import { validateGraphData, validateCustomColors, isValidColor } from './validation';
import { LayoutEngine } from './layout';
import { syncFromCanvas } from './sync';
import { reorderConnectorsBehind } from './grouping';
import { extractCurrenciesByType, createLegendSection } from './legend';
import { generateResearchCache, generateEconomyJSON, createResearchMarkdown } from './research-bridge';

// Repository URL used to draft PRs for presets
const REPO_URL = 'https://github.com/YOUR_USERNAME/economy_flow_plugin';

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

// Default config will be injected by build script
declare const DEFAULT_API_KEY: string;
declare const DEFAULT_VALIDATED: boolean;

// legend helpers moved to ./legend

declare const TEMPLATES: { [key: string]: any };

/* ── UI ── */
figma.showUI(__html__, { width: 400, height: 720 });
figma.ui.postMessage({ type: 'templates', templates: TEMPLATES, colors: COLOR });
// Restore last state from client storage
figma.clientStorage.getAsync('economyFlowState').then((state) => {
  if (state && typeof state === 'object') {
    figma.ui.postMessage({ type: 'restore', json: state.json, colors: state.colors });
  }
}).catch(() => {});

/* ── main handler ── */
figma.ui.onmessage = async (m: PluginMessage) => {
  // Handle API key storage
  if (m.cmd === 'save-api-key') {
    const { apiKey, validated } = m;
    if (apiKey) {
      await figma.clientStorage.setAsync('gemini-api-key', apiKey);
      if (validated) {
        await figma.clientStorage.setAsync('gemini-api-key-validated', 'true');
      }
      reply('API key saved securely', true);
    }
    return;
  }
  

  
  if (m.cmd === 'save-research-inputs') {
    const { gameName, depth } = m as any;
    await figma.clientStorage.setAsync('researchInputs', { gameName, depth });
    return;
  }
  if (m.cmd === 'load-research-inputs') {
    const inputs = (await figma.clientStorage.getAsync('researchInputs')) as any;
    figma.ui.postMessage({
      type: 'research-inputs-loaded',
      gameName: inputs?.gameName,
      depth: inputs?.depth
    });
    return;
  }
  if (m.cmd === 'load-api-key') {
    let apiKey = await figma.clientStorage.getAsync('gemini-api-key');
    let validated = await figma.clientStorage.getAsync('gemini-api-key-validated');
    
    // Try to load default config if no saved key
    if (!apiKey && DEFAULT_API_KEY) {
      apiKey = DEFAULT_API_KEY;
      validated = DEFAULT_VALIDATED ? 'true' : 'false';
      // Save it for future use
      await figma.clientStorage.setAsync('gemini-api-key', apiKey);
      if (validated === 'true') {
        await figma.clientStorage.setAsync('gemini-api-key-validated', 'true');
      }
    }
    
    figma.ui.postMessage({
      type: 'api-key-loaded',
      apiKey: apiKey || '',
      validated: validated === 'true'
    });
    return;
  }
  
  if (m.cmd === 'validate-api-key') {
    const { apiKey } = m;
    if (!apiKey) {
      figma.ui.postMessage({
        type: 'api-key-validation',
        valid: false,
        error: 'No API key provided'
      });
      return;
    }
    
    try {
      // Test the API key by making a simple request
      const testRequest = {
        gameName: 'Test',
        depth: 1,
        apiKey: apiKey,
        provider: 'gemini'
      };
      
      // Try to validate with a minimal request
      const response = await fetch('http://localhost:5001/api/research/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      }).catch(() => null);
      
      if (response && response.ok) {
        const result = await response.json();
        figma.ui.postMessage({
          type: 'api-key-validation',
          valid: result.valid,
          error: result.error
        });
      } else {
        // Fallback: check key format
        const isValidFormat = apiKey.startsWith('AIza') && apiKey.length >= 39;
        figma.ui.postMessage({
          type: 'api-key-validation',
          valid: isValidFormat,
          error: isValidFormat ? undefined : 'Invalid API key format. Ensure you copied the complete key.'
        });
      }
      
      if (response?.ok) {
        await figma.clientStorage.setAsync('gemini-api-key-validated', 'true');
      }
    } catch (error) {
      figma.ui.postMessage({
        type: 'api-key-validation',
        valid: false,
        error: `Validation failed: ${(error as Error).message}`
      });
    }
    
    return;
  }
  
  if (m.cmd === 'clear') { 
    clear(); 
    reply('Canvas cleared', true); 
    return; 
  }
  
  if (m.cmd === 'sync-from-canvas') { 
    syncFromCanvas(); 
    return; 
  }
  if (m.cmd === 'validate') {
    try {
      const data = JSON.parse(m.json);
      const errors = validateGraphData(data);
      if (errors.length > 0) reply(errors, false); else reply('JSON is valid.', true);
    } catch (e: any) {
      reply(['Invalid JSON:', e.message], false);
    }
    return;
  }
  
  if (m.cmd === 'save-research-inputs') {
    const { gameName, depth } = m as any;
    await figma.clientStorage.setAsync('researchInputs', { gameName, depth });
    return;
  }

  if (m.cmd === 'load-research-inputs') {
    const inputs = (await figma.clientStorage.getAsync('researchInputs')) as any;
    figma.ui.postMessage({
      type: 'research-inputs-loaded',
      gameName: inputs?.gameName,
      depth: inputs?.depth
    });
    return;
  }

  if (m.cmd === 'generate-cache') {
    const { gameName, depth } = m;
    // Persist inputs
    await figma.clientStorage.setAsync('researchInputs', { gameName, depth });
    
    try {
      // Generate the research cache
      const cache = await generateResearchCache({ gameName, depth });
      
      // Also generate the markdown for research
      const markdown = createResearchMarkdown(gameName, depth);
      
      // Send cache back to UI
      figma.ui.postMessage({
        type: 'cache-generated',
        cache: JSON.stringify(cache, null, 2),
        markdown: markdown
      });
      
    } catch (error) {
      console.error('Failed to generate cache:', error);
      figma.ui.postMessage({
        type: 'research-result',
        success: false,
        error: `Failed to generate cache: ${(error as Error).message}`
      });
    }
    
    return;
  }
  
  if (m.cmd === 'generate-economy') {
    const { gameName, depth, apiKey, provider } = m;
    // Persist inputs
    await figma.clientStorage.setAsync('researchInputs', { gameName, depth });
    
    if (!apiKey) {
      figma.ui.postMessage({
        type: 'research-result',
        success: false,
        error: 'API key is required to generate economy JSON'
      });
      return;
    }
    
    try {
      // Send progress updates
      figma.ui.postMessage({
        type: 'progress-update',
        step: 2,
        percent: 20,
        message: `Researching ${gameName} economy systems...`
      });
      
      // Simulate initial connection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      figma.ui.postMessage({
        type: 'progress-update',
        step: 3,
        percent: 40,
        message: 'AI is analyzing game mechanics and resource flows...'
      });
      
      // Generate full economy JSON using the API
      const economyJson = await generateEconomyJSON({ 
        gameName, 
        depth,
        apiKey,
        provider: provider || 'gemini'
      });
      // Validate economy JSON before posting to UI
      const validationErrors = validateGraphData(economyJson);
      if (validationErrors.length > 0) {
        figma.ui.postMessage({
          type: 'research-result',
          success: false,
          error: `Validation failed (first 10):\n` + validationErrors.slice(0, 10).join('\n')
        });
        return;
      }
      
      figma.ui.postMessage({
        type: 'progress-update',
        step: 4,
        percent: 80,
        message: 'Structuring economy model...'
      });
      
      // Small delay before finalizing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Send the economy JSON to UI
      figma.ui.postMessage({
        type: 'economy-generated', 
        json: JSON.stringify(economyJson, null, 2)
      });
      
    } catch (error) {
      console.error('Failed to generate economy:', error);
      figma.ui.postMessage({
        type: 'research-result',
        success: false,
        error: `Failed to generate economy: ${(error as Error).message}`
      });
    }
    
    return;
  }
  
  if (m.cmd === 'create-github-pr') {
    const { gameName, json, fileName, comment } = m as any;

    const safe = sanitizeFileName(gameName || 'new_preset');
    const finalFile = fileName && String(fileName).trim().length > 0 ? String(fileName).trim() : `${safe}.json`;
    const filePath = `examples/${finalFile}`;

    // Attempt to open a pre-filled GitHub new file page
    try {
      const draftUrl = `${REPO_URL}/new/main?filename=${encodeURIComponent(filePath)}&value=${encodeURIComponent(json)}`;
      figma.openURL(draftUrl);
    } catch {}

    const prInstructions = [
      'To submit this as a preset:',
      `1. Fork the repository: ${REPO_URL}`,
      `2. Create a new file: ${filePath}`,
      '3. Paste the JSON content',
      '4. Create a pull request with the title:',
      `   "Add ${gameName} economy preset"`,
    ];
    if (comment) {
      prInstructions.push('', '5. In your PR description, include:', `   "${comment}"`);
    }
    prInstructions.push('', 'A draft page has been opened in your browser (if allowed).');

    figma.ui.postMessage({ type: 'research-result', success: false, error: prInstructions.join('\n') });
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
  
  // Persist state on successful parse and validation
  try {
    await figma.clientStorage.setAsync('economyFlowState', { json: JSON.stringify(data), colors: m.colors });
  } catch {}
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
        const addAttribute = (text: string, color: string, attrType: 'source'|'sink'|'value') => {
          try {
            const attrBox = makeBox(text, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, color, 'LEFT');
            attrBox.x = mainBox.x;
            attrBox.y = mainBox.y + attrY;
            attrBox.setPluginData('attrType', attrType);
            nodeElements.push(attrBox);
            attrY += BOX_SIZE.ATTR.H + 5;
          } catch (error) {
            console.error(`Failed to create attribute box for "${text}":`, error);
          }
        };
        
        const act = nodeData as Act;
        act.sources?.forEach(s => addAttribute('+ ' + s, customColors.source, 'source'));
        act.sinks?.forEach(s => addAttribute('- ' + s, customColors.sink, 'sink'));
        act.values?.forEach(v => addAttribute(v, customColors.xp, 'value'));
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
      
      // Add subsections to the section FIRST (so they render behind the group)
      subsections.forEach(subsection => {
        section.appendChild(subsection);
      });
      
      // Create the group inside the section
      const group = figma.group(elementsToGroup, figma.currentPage);
      group.name = TAG;
      
      // Move the group into the section AFTER subsections (so it renders on top)
      section.appendChild(group);
      
      // Ensure connectors are behind nodes by reordering within the group
      reorderConnectorsBehind(group);
      
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
