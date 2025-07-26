/// <reference types="@figma/plugin-typings" />

/* Economy-Flow Builder – FigJam & Design (2025-05) */

declare const TEMPLATES: { [key: string]: any };

const COLOR = {
  // Specific color palette as requested
  INITIAL_SINK_NODE: '#DA5433',
  XP_ORANGE: '#EC9F53',
  FINAL_GOOD_YELLOW: '#F5C95C',
  SOURCE_GREEN: '#4CAF50',
  
  // Default/Neutral colors
  MAIN_WHITE: '#FFFFFF',
  HEADER_BLACK: '#000000',
  CONNECTOR_GREY: '#757575',
  STROKE_GREY: '#CCCCCC',
};
const TAG = 'EconomyFlowChart';
const BOX_SIZE = { 
    INPUT: { W: 144, H: 72 }, // Matched to NODE size
    NODE: { W: 144, H: 72 }, 
    ATTR: { W: 112, H: 20 } 
};

const hex = (h: string) => {
  if (typeof h !== 'string' || !h.match(/^#[0-9A-Fa-f]{6}$/)) {
    console.warn(`Invalid color format: ${h}. Using default gray.`);
    return { r: 0.8, g: 0.8, b: 0.8 };
  }
  try {
    const n = parseInt(h.slice(1), 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  } catch (error) {
    console.error('Error parsing color:', error);
    return { r: 0.8, g: 0.8, b: 0.8 };
  }
};
async function fonts() {
  try {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  } catch (error) {
    console.error('Failed to load fonts:', error);
    throw new Error('Required fonts (Inter Regular/Medium) are not available. Please install them in Figma.');
  }
}

function makeBox(txt: string, w: number, h: number, fill: string, align: 'CENTER' | 'LEFT' = 'CENTER'): SceneNode {
  try {
    // Validate inputs
    if (!txt || typeof txt !== 'string') {
      console.warn('Invalid text for box, using empty string');
      txt = '';
    }
    if (w <= 0 || h <= 0) {
      throw new Error(`Invalid dimensions: width=${w}, height=${h}`);
    }

    // White text on dark backgrounds (red, black), black text on light backgrounds
    const isDarkBG = fill === COLOR.INITIAL_SINK_NODE || fill === COLOR.HEADER_BLACK;
    const textColor = isDarkBG ? hex(COLOR.MAIN_WHITE) : hex(COLOR.HEADER_BLACK);

    const s = figma.createShapeWithText();
    s.shapeType = 'SQUARE';
    s.resize(w, h);
    s.fills = [{ type: 'SOLID', color: hex(fill) }];
    if (fill === COLOR.MAIN_WHITE) {
        s.strokes = [{type: 'SOLID', color: hex(COLOR.STROKE_GREY)}];
        s.strokeWeight = 2;
    }
    s.text.characters = txt;

  let fontSize = 12;
  // Reduce font size for long labels to prevent overflow
  if (w > 120 && txt.length > 40) { // Main node
    fontSize = 10;
  } else if (w < 120 && txt.length > 20) { // Attribute node
      fontSize = 10;
  }
  s.text.fontSize = fontSize;
  s.text.fills = [{ type: 'SOLID', color: textColor }];

  // @ts-ignore
  s.text.textAlignHorizontal = align;
  if (align === 'LEFT') {
    // @ts-ignore
    s.text.paragraphIndent = 5;
  }
    return s;
  } catch (error) {
    console.error('Error creating box:', error);
    throw error;
  }
}

function makeFinalGoodBox(txt: string, w: number, h: number, bodyFill: string): SceneNode {
  try {
    // Validate inputs
    if (!txt || typeof txt !== 'string') {
      console.warn('Invalid text for final good box');
      txt = 'Final Good';
    }
    if (h < 30) {
      throw new Error('Final good box height too small for header + body');
    }

    const headerHeight = 24;
    const bodyHeight = h - headerHeight;

    const body = makeBox(txt, w, bodyHeight, bodyFill);
    body.y = headerHeight;
    
    const header = makeBox("Final Good", w, headerHeight, COLOR.HEADER_BLACK);
    header.y = 0;

    const finalGroup = figma.group([header, body], figma.currentPage);
    finalGroup.name = "Final Good: " + txt;
    return finalGroup;
  } catch (error) {
    console.error('Error creating final good box:', error);
    // Fallback to regular box
    return makeBox(txt, w, h, bodyFill);
  }
}


type ConnectorMagnet = 'NONE' | 'AUTO' | 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT' | 'CENTER';
interface EconomyFlowConnectorEndpoint {
  endpointNodeId: string;
  magnet: ConnectorMagnet;
}

function connect(A: SceneNode, B: SceneNode) {
  try {
    if (!A || !B || !A.id || !B.id) {
      throw new Error('Invalid nodes for connection');
    }

    const c = figma.createConnector();
    c.connectorLineType = 'ELBOWED';
    c.strokeWeight = 2;
    // Use default grey for connectors
    c.strokes = [{ type: 'SOLID', color: hex(COLOR.CONNECTOR_GREY) }];
    
    if (B.name.startsWith("Final Good")) {
      c.dashPattern = [10, 10];
    }

    // Force left-to-right connection points
    c.connectorStart = { endpointNodeId: A.id, magnet: 'RIGHT' } as EconomyFlowConnectorEndpoint;
    c.connectorEnd = { endpointNodeId: B.id, magnet: 'LEFT' } as EconomyFlowConnectorEndpoint;
    return c;
  } catch (error) {
    console.error('Error creating connector:', error);
    throw error;
  }
}

/* ── UI ── */
figma.showUI(__html__, { width: 400, height: 720 });

figma.ui.postMessage({ type: 'templates', templates: TEMPLATES, colors: COLOR });

/* ── types ── */
interface Input { id: string; label: string; kind: 'initial_sink_node' }
interface Act { id: string; label: string; sources?: string[]; sinks?: string[]; values?: string[]; kind?: string }
interface Graph { inputs: Input[]; nodes: Act[]; edges: ([string, string] | [string])[] }

// UI to Plugin messages
type DrawMessage = {
  cmd: 'draw';
  json: string;
  colors: { [key: string]: string };
};
type ClearMessage = { cmd: 'clear' };
type SyncMessage = { cmd: 'sync-from-canvas' };
type PluginMessage = DrawMessage | ClearMessage | SyncMessage;

// Plugin to UI messages
type ReplyMessage = {
  type: 'reply';
  msg: string | string[];
  ok: boolean;
};
type TemplatesMessage = {
  type: 'templates';
  templates: any;
  colors: any;
};
type SyncJSONMessage = {
    type: 'sync-json';
    json: string;
}
type UIMessage = ReplyMessage | TemplatesMessage | SyncJSONMessage;


function validateGraphData(data: Partial<Graph>): string[] {
  const errors: string[] = [];
  if (!data) {
    errors.push("Data is null or undefined.");
    return errors;
  }

  const ids = new Set<string>();

  if (!Array.isArray(data.inputs)) {
    errors.push("'inputs' property must be an array.");
  } else {
    data.inputs.forEach((input: Input, i: number) => {
      if (typeof input.id !== 'string') errors.push(`Input ${i}: 'id' is missing or not a string.`);
      else ids.add(input.id);
      if (typeof input.label !== 'string') errors.push(`Input ${i}: 'label' is missing or not a string.`);
      if (typeof input.kind !== 'string') errors.push(`Input ${i}: 'kind' is missing or not a string.`);
    });
  }

  if (!Array.isArray(data.nodes)) {
    errors.push("'nodes' property must be an array.");
  } else {
    data.nodes.forEach((node: Act, i: number) => {
      if (typeof node.id !== 'string') errors.push(`Node ${i}: 'id' is missing or not a string.`);
      else ids.add(node.id);
      if (typeof node.label !== 'string') errors.push(`Node ${i}: 'label' is missing or not a string.`);
      if (node.sources && !Array.isArray(node.sources)) errors.push(`Node ${i}: 'sources' must be an array of strings.`);
      if (node.sinks && !Array.isArray(node.sinks)) errors.push(`Node ${i}: 'sinks' must be an array of strings.`);
      if (node.values && !Array.isArray(node.values)) errors.push(`Node ${i}: 'values' must be an array of strings.`);
    });
  }

  if (!Array.isArray(data.edges)) {
    errors.push("'edges' property must be an array.");
  } else {
    data.edges.forEach((edge: [string, string] | [string], i: number) => {
      if (!Array.isArray(edge) || (edge.length !== 2 && edge.length !== 1) || typeof edge[0] !== 'string') {
        errors.push(`Edge ${i}: must be an array of one or two strings.`);
      } else {
        if (!ids.has(edge[0])) errors.push(`Edge ${i}: 'from' id '${edge[0]}' not found in inputs or nodes.`);
        if (edge.length === 2 && (typeof edge[1] !== 'string' || !ids.has(edge[1]))) errors.push(`Edge ${i}: 'to' id '${edge[1]}' not found in inputs or nodes.`);
      }
    });
  }

  return errors;
}

/* ── main handler ── */
figma.ui.onmessage = async (m: PluginMessage) => {
  if (m.cmd === 'clear') { clear(); reply('Canvas cleared', true); return; }
  if (m.cmd === 'sync-from-canvas') { syncFromCanvas(); return; }
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
    await fonts();
  } catch (error) {
    reply(['Font loading error:', (error as Error).message], false);
    return;
  }
  
  clear();
  const nodes = new Map<string, SceneNode>();
  const elementsToGroup: SceneNode[] = [];
  const PADDING = { X: 100, Y: 40 };
  
  // Validate custom colors
  const customColors = {
    sink: m.colors?.sink || COLOR.INITIAL_SINK_NODE,
    source: m.colors?.source || COLOR.SOURCE_GREEN,
    xp: m.colors?.xp || COLOR.XP_ORANGE,
    final: m.colors?.final || COLOR.FINAL_GOOD_YELLOW,
  };

  // --- Layout Algorithm ---
  const allNodesData = [...data.inputs, ...data.nodes];
  const nodeDataMap = new Map(allNodesData.map(n => [n.id, n]));
  
  // 1. Pre-calculate total height of each node (including attributes)
  const nodeTotalHeights = new Map<string, number>();
  allNodesData.forEach(node => {
      let totalHeight = 0;
      if (node.kind === 'initial_sink_node') {
          totalHeight = BOX_SIZE.INPUT.H;
      } else if (node.kind === 'finalGood') {
          totalHeight = BOX_SIZE.NODE.H;
      } else {
          totalHeight = BOX_SIZE.NODE.H;
          const act = node as Act;
          const attrCount = (act.sources?.length || 0) + (act.sinks?.length || 0) + (act.values?.length || 0);
          if (attrCount > 0) {
              totalHeight += (attrCount * (BOX_SIZE.ATTR.H + 5)) + 5;
          }
      }
      nodeTotalHeights.set(node.id, totalHeight);
  });

  // 2. Build graph representation for topological sort
  const adj = new Map<string, string[]>();
  const revAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const allNodeIds = [...data.inputs.map(i => i.id), ...data.nodes.map(n => n.id)];
  
  allNodeIds.forEach(id => {
      adj.set(id, []);
      revAdj.set(id, []);
      inDegree.set(id, 0);
  });

  data.edges.forEach(([from, to]) => {
      if (from && to && adj.has(from) && inDegree.has(to)) {
          adj.get(from)!.push(to);
          revAdj.get(to)!.push(from);
          inDegree.set(to, inDegree.get(to)! + 1);
      }
  });

  // 3. Perform topological sort to determine node columns
  const nodeColumns = new Map<string, number>();
  const queue: string[] = [];
  allNodeIds.forEach(id => {
      if (inDegree.get(id) === 0) {
          queue.push(id);
          nodeColumns.set(id, 0);
      }
  });

  let head = 0;
  while(head < queue.length) {
      const u = queue[head++];
      const u_col = nodeColumns.get(u)!;

      for (const v of adj.get(u)!) {
          const v_col = nodeColumns.get(v);
          if (v_col === undefined || v_col < u_col + 1) {
            nodeColumns.set(v, u_col + 1);
          }
          inDegree.set(v, inDegree.get(v)! - 1);
          if (inDegree.get(v) === 0) {
              queue.push(v);
          }
      }
  }

  // 4. Node Positioning
  const columns: string[][] = [];
  nodeColumns.forEach((col, id) => {
      if (!columns[col]) columns[col] = [];
      columns[col].push(id);
  });

  const placedNodePositions = new Map<string, {x: number, y: number, height: number, width: number}>();
  
  function findConflictFreeY(id: string, colIndex: number, y_initial: number): number {
      const nodeData = nodeDataMap.get(id);
      if (!nodeData) return y_initial;

      const totalHeight = nodeTotalHeights.get(id) || 0;
      const boxWidth = (nodeData.kind === 'initial_sink_node') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
      const x = colIndex * (BOX_SIZE.NODE.W + PADDING.X);
      let y_candidate = y_initial;

      let max_y = 0; // Find the highest "floor" to place the node on.

      // Check for direct node-on-node collision with ANY previously placed node
      for (const pos of placedNodePositions.values()) {
          // AABB check
          if (x < pos.x + pos.width + PADDING.X && x + boxWidth + PADDING.X > pos.x) {
              max_y = Math.max(max_y, pos.y + pos.height + PADDING.Y);
          }
      }

      // Check for connector-on-node collision
      const parentIds = revAdj.get(id) || [];
      for (const pId of parentIds) {
          const parentPos = placedNodePositions.get(pId);
          const parentCol = nodeColumns.get(pId);
          if (!parentPos || parentCol === undefined) continue;

          const lineY_start = parentPos.y + parentPos.height / 2;
          const lineY_end = y_candidate + totalHeight / 2; // Use candidate for temp check
          const lineY_min = Math.min(lineY_start, lineY_end);
          const lineY_max = Math.max(lineY_start, lineY_end);

          // Check against nodes in intermediate columns
          for (let i = parentCol + 1; i < colIndex; i++) {
              for (const [otherId, otherPos] of placedNodePositions.entries()) {
                  if (nodeColumns.get(otherId) === i) {
                      if (lineY_max > otherPos.y && lineY_min < otherPos.y + otherPos.height) {
                          max_y = Math.max(max_y, otherPos.y + otherPos.height + PADDING.Y);
                      }
                  }
              }
          }
      }

      // The final y position is the greater of its ideal target or the highest floor pushed by obstacles
      return Math.max(y_candidate, max_y);
  }
  
  columns.forEach((nodeIdsInCol, colIndex) => {
      const yTargets = new Map<string, number>();
      nodeIdsInCol.forEach(id => {
          const parentIds = revAdj.get(id)!;
          const parentYs = parentIds.map(pId => placedNodePositions.get(pId)?.y).filter(y => y !== undefined) as number[];
          const targetY = parentYs.length > 0 ? parentYs.reduce((s, y) => s + y, 0) / parentYs.length : 0;
          yTargets.set(id, targetY);
      });
      const sortedByYTarget = nodeIdsInCol.sort((a, b) => (yTargets.get(a) || 0) - (yTargets.get(b) || 0));

      sortedByYTarget.forEach(id => {
          const nodeData = nodeDataMap.get(id);
          if (!nodeData) return;

          const y_initial = yTargets.get(id) || 0;
          const y_final = findConflictFreeY(id, colIndex, y_initial);
          const x_pos = colIndex * (BOX_SIZE.NODE.W + PADDING.X);
          
          let mainBox: SceneNode;
          if (nodeData.kind === 'initial_sink_node') {
              mainBox = makeBox(nodeData.label, BOX_SIZE.INPUT.W, BOX_SIZE.INPUT.H, customColors.sink);
          } else if (nodeData.kind === 'finalGood') {
              try {
                  mainBox = makeFinalGoodBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, customColors.final);
              } catch (error) {
                  console.error('Failed to create final good box:', error);
                  mainBox = makeBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, COLOR.MAIN_WHITE);
              }
          } else {
              mainBox = makeBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, COLOR.MAIN_WHITE);
          }
          mainBox.x = x_pos;
          mainBox.y = y_final;
          mainBox.setPluginData("id", id); // Store the stable ID

          const totalHeight = nodeTotalHeights.get(id) || 0;
          const boxWidth = (nodeData.kind === 'initial_sink_node') ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
          placedNodePositions.set(id, { x: x_pos, y: y_final, height: totalHeight, width: boxWidth });
          nodes.set(id, mainBox);
          elementsToGroup.push(mainBox);

          // Attribute logic
          if (nodeData.kind !== 'finalGood' && ('sources' in nodeData || 'sinks' in nodeData || 'values' in nodeData)) {
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
              (nodeData as Act).sources?.forEach(s => {
                  addAttribute('+ ' + s, customColors.source);
              });
              (nodeData as Act).sinks?.forEach(s => {
                addAttribute('- ' + s, customColors.sink);
              });
              (nodeData as Act).values?.forEach(v => {
                addAttribute(v, customColors.xp);
              });
          }
      });
  });

  // --- Draw Edges ---
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
      const connector = connect(fromNode, toNode);
      elementsToGroup.unshift(connector);
    } catch (error) {
      failedEdges.push(`Edge ${index}: ${(error as Error).message}`);
    }
  });

  if (failedEdges.length > 0) {
    console.warn('Some edges failed to render:', failedEdges);
  }

  if (elementsToGroup.length > 0) {
    try {
      // Create a section to contain the economy flow
      const section = figma.createSection();
      section.name = `${TAG} Section`;
      
      // Calculate bounds for the section
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      elementsToGroup.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      });
      
      // Add padding to section bounds
      const sectionPadding = 50;
      section.x = minX - sectionPadding;
      section.y = minY - sectionPadding;
      section.resizeWithoutConstraints(
        maxX - minX + (sectionPadding * 2),
        maxY - minY + (sectionPadding * 2)
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
};

/* ── utils ── */
function clear() {
  try {
    // First try to find and remove sections
    const sectionsToRemove = figma.currentPage.findAll(n => 
      n.type === 'SECTION' && n.getPluginData("economyFlowSection") === "true"
    );
    
    sectionsToRemove.forEach(section => {
      try {
        section.remove();
      } catch (error) {
        console.error('Failed to remove section:', error);
      }
    });
    
    // Then remove any remaining nodes (legacy support)
    const nodesToRemove = figma.currentPage.findAll(n => n.name.includes(TAG));
    console.log(`Clearing ${sectionsToRemove.length} sections and ${nodesToRemove.length} nodes`);
    
    nodesToRemove.forEach(n => {
      try {
        n.remove();
      } catch (error) {
        console.error('Failed to remove node:', error);
      }
    });
  } catch (error) {
    console.error('Clear operation failed:', error);
  }
}

function reply(msg: string | string[], ok: boolean) {
  try {
    figma.ui.postMessage({ type: 'reply', msg, ok });
  } catch (error) {
    console.error('Failed to send message to UI:', error);
  }
}

function syncFromCanvas() {
    try {
        // First try to find a section containing our economy flow
        const section = figma.currentPage.findOne(n => 
            n.type === 'SECTION' && n.getPluginData("economyFlowSection") === "true"
        ) as SectionNode;
        
        let group: SceneNode | null = null;
        
        if (section) {
            // Look for the group inside the section
            group = section.findOne(n => n.name === TAG);
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
    const figmaIdToStableId = new Map<string, string>(); // Map Figma node IDs to stable plugin data IDs

    const children = [...(group as GroupNode).children];
    const isShapeWithText = (node: SceneNode): node is ShapeWithTextNode => 'text' in node;
    const ignoredNodes: string[] = [];

    // Pass 1: Reconstruct all nodes (Inputs, Actions, Final Goods) using the stable ID from pluginData
    for (const child of children) {
        const id = child.getPluginData("id");
        if (!id) {
            // Track non-conforming objects
            if (child.type !== 'CONNECTOR' && !isShapeWithText(child)) {
                ignoredNodes.push(`${child.type}: ${child.name || 'Unnamed'}`);
            }
            continue; // Skip attributes and connectors
        }

        if (child.name.includes("Final Good")) {
            const finalGoodGroup = child as GroupNode;
            const body = finalGoodGroup.children.find(isShapeWithText);
            if (body) {
                const label = body.text.characters;
                const act: Act = { id, label, kind: 'finalGood' };
                graph.nodes.push(act);
                tempNodeData.set(child.id, { node: child, act });
                figmaIdToStableId.set(child.id, id);
            }
        } else if (isShapeWithText(child) && child.width > BOX_SIZE.ATTR.W) { // Main box
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

    // Pass 2: Find attributes and associate them with their parent nodes
    for (const child of children) {
        if (isShapeWithText(child) && child.width <= BOX_SIZE.ATTR.W) { // Attribute box
            const attrNode = child;
            const fill = (attrNode.fills as readonly Paint[])[0] as SolidPaint;
            
            // Find parent by positional check (finds nearest node above it)
            let parentData: {node: SceneNode, act: Act | Input} | undefined;
            let minDistance = Infinity;

            for (const data of tempNodeData.values()) {
                const p = data.node;
                // Check if attribute is generally below the parent and in the same column
                if (Math.abs(p.x - attrNode.x) < 5 && attrNode.y > p.y) { // Allow small tolerance for x position
                    const distance = attrNode.y - (p.y + p.height);
                    if (distance >= 0 && distance < minDistance) {
                        minDistance = distance;
                        parentData = data;
                    }
                }
            }

            if (parentData && 'sources' in parentData.act) { // ensure it's an Act
                const text = attrNode.text.characters;
                const r = Math.round(fill.color.r * 255);
                const g = Math.round(fill.color.g * 255);

                // More flexible color matching with tolerance
                const isGreen = r >= 70 && r <= 80 && g >= 170 && g <= 180;
                const isRed = r >= 213 && r <= 223 && g >= 79 && g <= 89;
                const isOrange = r >= 231 && r <= 241 && g >= 154 && g <= 164;
                
                if (isGreen) { // SOURCE_GREEN
                    parentData.act.sources?.push(text.replace(/^\+\s*/, '').trim());
                } else if (isRed) { // initial_sink_node
                    parentData.act.sinks?.push(text.replace(/^-\s*/, '').trim());
                } else if (isOrange) { // XP_ORANGE
                    parentData.act.values?.push(text.trim());
                } else {
                    console.warn(`Unknown attribute color: rgb(${r}, ${g}, _) for text: ${text}`);
                }
            }
        }
    }

    // Pass 3: Reconstruct edges
    for (const child of children) {
        if (child.type === 'CONNECTOR') {
            const connector = child as ConnectorNode;
            const startId = (connector.connectorStart as EconomyFlowConnectorEndpoint).endpointNodeId;
            const endId = (connector.connectorEnd as EconomyFlowConnectorEndpoint).endpointNodeId;
            
            // Convert Figma node IDs to stable plugin data IDs
            const fromStableId = figmaIdToStableId.get(startId);
            const toStableId = figmaIdToStableId.get(endId);

            if (fromStableId && toStableId) {
                graph.edges.push([fromStableId, toStableId]);
            }
        }
    }

        // Validate the reconstructed graph
        if (graph.inputs.length === 0 && graph.nodes.length === 0) {
            reply('No valid nodes found in the diagram.', false);
            return;
        }

        const json = JSON.stringify(graph, null, 2);
        figma.ui.postMessage({ type: 'sync-json', json });
        
        const messages = ['Successfully synced diagram to JSON'];
        if (ignoredNodes.length > 0) {
            messages.push(`Ignored ${ignoredNodes.length} non-conforming object(s)`);
            console.log('Ignored objects:', ignoredNodes);
        }
        reply(messages, true);
    } catch (error) {
        console.error('Sync error:', error);
        reply(['Sync failed:', (error as Error).message], false);
    }
}