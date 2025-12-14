/// <reference types="@figma/plugin-typings" />

import { Graph, PluginMessage, Act, Input } from './types';
import { COLOR, TAG, BOX_SIZE, PADDING, SECTION_PADDING, INITIAL_X_OFFSET, INITIAL_Y_OFFSET } from './constants';
import { loadFonts, clear, reply, hex } from './utils';
import { makeBox, makeFinalGoodBox, createConnector } from './node-creation';
import { validateGraphData, validateCustomColors, isValidColor } from './validation';
import { LayoutEngine } from './layout';
import { syncFromCanvas } from './sync';
import { extractCurrenciesByType, createLegendSection } from './legend';
import {
  generateResearchCache,
  generateEconomyJSON,
  createResearchMarkdown,
  parseResearchOutput,
  repairEconomyJSON
} from './research-bridge';

// Repository URL used to draft PRs for presets
const REPO_URL = 'https://github.com/YOUR_USERNAME/economy_flow_plugin';

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function parsePossiblyWrappedJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return parseResearchOutput(raw);
  }
}

function isGraphLike(value: unknown): boolean {
  return !!value && typeof value === 'object' && ('inputs' in value || 'nodes' in value || 'edges' in value);
}

// Default config will be injected by build script
declare const DEFAULT_API_KEY: string;
declare const DEFAULT_VALIDATED: boolean;

// legend helpers moved to ./legend

declare const TEMPLATES: { [key: string]: any };

/* ── UI ── */
figma.showUI(__html__, { width: 400, height: 720 });
figma.ui.postMessage({ type: 'templates', templates: TEMPLATES, colors: COLOR });
// Restore only colors from client storage, not the JSON (start with empty/template selection)
figma.clientStorage.getAsync('economyFlowState').then((state) => {
  if (state && typeof state === 'object') {
    // Only restore colors, not the JSON - user should select a template or paste their own
    figma.ui.postMessage({ type: 'restore', colors: state.colors });
  }
}).catch(() => { });

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
      const parsed = parsePossiblyWrappedJson(m.json);
      const errors = validateGraphData(parsed as any);

      if (errors.length === 0) {
        reply('JSON is valid.', true);
        return;
      }

      if (!isGraphLike(parsed)) {
        reply(errors, false);
        return;
      }

      const repaired = repairEconomyJSON(parsed);
      const repairedErrors = validateGraphData(repaired);
      if (repairedErrors.length > 0) {
        reply(errors, false);
        return;
      }

      figma.ui.postMessage({ type: 'sync-json', json: JSON.stringify(repaired, null, 2) });
      reply('JSON was normalized and is now valid.', true);
    } catch (e: any) {
      reply(['Invalid JSON:', e.message], false);
    }
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
        provider: (provider as any) || 'gemini'
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
      // @ts-ignore
      figma.openExternal(draftUrl);
    } catch { }

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
  let normalized = false;
  try {
    data = parsePossiblyWrappedJson(m.json) as Graph;
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
    if (!isGraphLike(data)) {
      reply(errors, false);
      return;
    }

    const repaired = repairEconomyJSON(data);
    const repairedErrors = validateGraphData(repaired);
    if (repairedErrors.length > 0) {
      reply(errors, false);
      return;
    }

    data = repaired;
    normalized = true;
    figma.ui.postMessage({ type: 'sync-json', json: JSON.stringify(repaired, null, 2) });
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
  } catch { }
  clear();
  await generateDiagram(data, m.colors, { normalized });
};

async function generateDiagram(
  data: Graph,
  customColorInput?: { [key: string]: string },
  options: { normalized?: boolean } = {}
) {
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

  // Initialize subsection bands for vertical grouping (prevents subsection overlap)
  layoutEngine.initializeSubsectionBands(data.subsections, allNodesData);

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

    let prevNodeInColumn: { y: number, height: number } | undefined;

    sortedByYTarget.forEach(id => {
      const nodeData = nodeDataMap.get(id);
      if (!nodeData) {
        return;
      }

      const y_initial = yTargets.get(id) || 0;
      const y_final = layoutEngine.findConflictFreeY(id, colIndex, y_initial, PADDING.X, PADDING.Y, nodeData, revAdj, prevNodeInColumn);
      const x_pos = INITIAL_X_OFFSET + (colIndex * (BOX_SIZE.NODE.W + PADDING.X));

      // Record position BEFORE creating the node so collision detection works for subsequent nodes
      const totalHeight = layoutEngine.getNodeHeight(id);
      const boxWidth = ('kind' in nodeData && nodeData.kind === 'initial_sink_node') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
      layoutEngine.recordNodePosition(id, x_pos, INITIAL_Y_OFFSET + y_final, boxWidth, totalHeight);

      // Update prevNodeInColumn for the next iteration
      prevNodeInColumn = { y: y_final, height: totalHeight };

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
        const addAttribute = (text: string, color: string, attrType: 'source' | 'sink' | 'value') => {
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

  // Run post-layout optimization to reduce edge crossings
  // This may adjust node positions to minimize connectors crossing through nodes
  layoutEngine.optimizeLayout(data.edges as [string, string][], PADDING.Y);

  // Update node positions after optimization
  nodes.forEach((node, id) => {
    const optimizedPos = layoutEngine.getNodePosition(id);
    if (optimizedPos) {
      node.x = optimizedPos.x;
      node.y = optimizedPos.y;
    }
  });

  // Draw edges
  const failedEdges: string[] = [];
  const pendingEdges = data.edges.map(([fromId, toId], index) => ({ fromId, toId, index }));

  // Combine elements to determine section bounds
  const layoutElements = [...nodesAndAttributes];

  // Create section and group
  if (layoutElements.length > 0) {
    try {
      // Create subsections if defined
      const subsections: SectionNode[] = [];
      const nodesPlacedInSubsections = new Set<SceneNode>();
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

            // Move nodes into the subsection so the hierarchy reflects visual grouping
            // When appending to a section, node positions become relative to the section
            subsectionNodes.forEach(node => {
              // Store the absolute position before reparenting
              const absX = node.x;
              const absY = node.y;

              subsection.appendChild(node);

              // After appendChild, position becomes relative to subsection
              // We need to adjust the position to maintain visual placement
              node.x = absX - bounds.x;
              node.y = absY - bounds.y;

              nodesPlacedInSubsections.add(node);
            });
          }
        }
      }

      // Create main section to contain everything
      const section = figma.createSection();
      // Use the graph name if provided, otherwise use default
      section.name = data.name ? `${data.name} Economy` : `${TAG} Section`;

      // Calculate bounds for the main section
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      layoutElements.forEach(node => {
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

      // Add subsections to the section FIRST (so they render behind other groups)
      subsections.forEach(subsection => {
        section.appendChild(subsection);
      });

      // Group any nodes not assigned to a subsection for easier manipulation
      const looseNodes = nodesAndAttributes.filter(node => !nodesPlacedInSubsections.has(node));
      let nodeGroup: GroupNode | null = null;
      if (looseNodes.length > 0) {
        nodeGroup = figma.group(looseNodes, figma.currentPage);
        nodeGroup.name = TAG;
      }

      if (nodeGroup) {
        section.appendChild(nodeGroup);
      }

      figma.currentPage.appendChild(section);

      // Helper function to find the best connector target for a node
      const findConnectorTarget = (nodeId: string): SceneNode | null => {
        // First try the mainBoxes map
        const mainBox = mainBoxes.get(nodeId);
        if (mainBox) {
          // Verify the node is still valid by checking if it has a parent
          try {
            if (mainBox.parent) {
              return mainBox;
            }
          } catch {
            // Node reference is invalid
          }
        }

        // Fallback: find the node and traverse to find connector target
        const nodeGroup = nodes.get(nodeId);
        if (!nodeGroup) return null;

        // For groups with children, find the main box (first SHAPE_WITH_TEXT child)
        if (nodeGroup.type === 'GROUP' && 'children' in nodeGroup) {
          // Check if this is a Final Good group
          if (nodeGroup.name.startsWith('Final Good')) {
            // Find the body box (y > 0)
            const bodyBox = nodeGroup.children.find(child =>
              child.type === 'SHAPE_WITH_TEXT' && child.y > 0
            );
            if (bodyBox) return bodyBox;
            if (nodeGroup.children.length > 1) return nodeGroup.children[1];
          } else {
            // Regular node group - first child is the main box
            const mainBox = nodeGroup.children.find(child => child.type === 'SHAPE_WITH_TEXT');
            if (mainBox) return mainBox;
          }
        }

        // Fallback to the node itself
        return nodeGroup;
      };

      pendingEdges.forEach(({ fromId, toId, index }) => {
        try {
          if (!fromId || !toId) {
            failedEdges.push(`Edge ${index}: Missing from/to ID`);
            return;
          }

          // Use fresh lookups to get valid connector targets
          const fromNode = findConnectorTarget(fromId);
          const toNode = findConnectorTarget(toId);

          if (!fromNode || !toNode) {
            failedEdges.push(`Edge ${index}: Node not found (${!fromNode ? fromId : toId})`);
            return;
          }

          // Create connector at page level first (Figma connectors work best at page level)
          const connector = createConnector(fromNode, toNode);
          connector.name = `${TAG} Connector`;
          connector.setPluginData('economyFlowConnector', 'true');

          // Keep connector at page level - don't move into section
          // This ensures the connector can reference nodes in any subsection
          connectors.push(connector);
        } catch (error) {
          failedEdges.push(`Edge ${index}: ${(error as Error).message}`);
        }
      });

      // Move all connectors to the back (bottom of z-order) so they render BEHIND the boxes
      // In Figma, lower index = renders behind, higher index = renders in front
      connectors.forEach(connector => {
        // Insert at index 0 to put connectors at the very back
        figma.currentPage.insertChild(0, connector);
      });

      // Append section AFTER connectors are moved to back - this ensures section renders on top
      // Re-appending moves it to the end (highest z-index = renders in front)
      figma.currentPage.appendChild(section);

      if (failedEdges.length > 0) {
        console.warn('Some edges failed to render:', failedEdges);
      }

      // Create and add legend section OUTSIDE the main section, to the LEFT of the diagram
      const currencies = extractCurrenciesByType(data);

      // Create legend first to know its width
      legendSection = createLegendSection(currencies, 0); // Temporary X position
      if (legendSection) {
        // Position legend to the left of the diagram with 50px gap
        legendSection.x = section.x - legendSection.width - 50;
        // Align legend vertically with the top of the main section
        legendSection.y = section.y;
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
      if (options.normalized) {
        messages.push('JSON was normalized (auto-repaired).');
      }
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
