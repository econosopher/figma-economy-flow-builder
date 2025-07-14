/// <reference types="@figma/plugin-typings" />

/* Economy-Flow Builder – FigJam & Design (2025-05) */

declare const TEMPLATES: { [key: string]: any };

const COLOR = {
  // Specific color palette as requested
  SINK_RED: '#DA5433',
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

const hex = (h: string) => {
  if (typeof h !== 'string') {
    // Return a default color if the input is invalid
    return { r: 0.8, g: 0.8, b: 0.8 };
  }
  const n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};
async function fonts() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
}

function makeBox(txt: string, w: number, h: number, fill: string, align: 'CENTER' | 'LEFT' = 'CENTER'): SceneNode {
  // White text on dark backgrounds (red, black), black text on light backgrounds
  const isDarkBG = fill === COLOR.SINK_RED || fill === COLOR.HEADER_BLACK;
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
  s.text.fontSize = 12;
  s.text.fills = [{ type: 'SOLID', color: textColor }];
  return s;
}

function makeFinalGoodBox(txt: string, w: number, h: number, bodyFill: string): SceneNode {
  const headerHeight = 24;
  const bodyHeight = h - headerHeight;

  const body = makeBox(txt, w, bodyHeight, bodyFill);
  body.y = headerHeight;
  
  const header = makeBox("Final Good", w, headerHeight, COLOR.HEADER_BLACK);
  header.y = 0;

  const finalGroup = figma.group([header, body], figma.currentPage);
  finalGroup.name = "Final Good: " + txt;
  return finalGroup;
}


type ConnectorMagnet = 'NONE' | 'AUTO' | 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT' | 'CENTER';
interface EconomyFlowConnectorEndpoint {
  endpointNodeId: string;
  magnet: ConnectorMagnet;
}

function connect(A: SceneNode, B: SceneNode) {
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
}

/* ── UI ── */
figma.showUI(__html__, { width: 400, height: 720 });

figma.ui.postMessage({ type: 'templates', templates: TEMPLATES, colors: COLOR });

/* ── types ── */
interface Input { id: string; label: string; kind: 'SINK_RED' }
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
  try { data = JSON.parse(m.json); } catch (e: any) { reply(e.message, false); return; }

  const errors = validateGraphData(data);
  if (errors.length > 0) {
    reply(errors, false);
    return;
  }

  await fonts(); clear();
  const nodes = new Map<string, SceneNode>();
  const elementsToGroup: SceneNode[] = [];
  const PADDING = { X: 100, Y: 40 };
  const BOX_SIZE = { 
      INPUT: { W: 144, H: 72 }, // Matched to NODE size
      NODE: { W: 144, H: 72 }, 
      ATTR: { W: 112, H: 20 } 
  };
  const customColors = m.colors || {
      sink: COLOR.SINK_RED,
      source: COLOR.SOURCE_GREEN,
      xp: COLOR.XP_ORANGE,
      final: COLOR.FINAL_GOOD_YELLOW,
  };

  // --- Layout Algorithm ---
  const allNodesData = [...data.inputs, ...data.nodes];
  const nodeDataMap = new Map(allNodesData.map(n => [n.id, n]));
  
  // 1. Pre-calculate total height of each node (including attributes)
  const nodeTotalHeights = new Map<string, number>();
  allNodesData.forEach(node => {
      let totalHeight = 0;
      if (node.kind === 'SINK_RED') {
          totalHeight = BOX_SIZE.INPUT.H;
      } else if (node.kind === 'finalGood') {
          totalHeight = BOX_SIZE.NODE.H;
      } else {
          totalHeight = BOX_SIZE.NODE.H;
          const act = node as Act;
          const attrCount = (act.sources?.length || 0) + (act.sinks?.length || 0);
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
  
  columns.forEach((nodeIdsInCol, colIndex) => {
    // Sort nodes by their parents' average y-position to maintain vertical coherence
    const yTargets = new Map<string, number>();
    nodeIdsInCol.forEach(id => {
        const parentIds = revAdj.get(id)!;
        const parentYs = parentIds.map(pId => placedNodePositions.get(pId)?.y).filter(y => y !== undefined) as number[];
        yTargets.set(id, parentYs.length > 0 ? parentYs.reduce((s, y) => s + y, 0) / parentYs.length : 0);
    });
    const sortedByYTarget = nodeIdsInCol.sort((a,b) => (yTargets.get(a) || 0) - (yTargets.get(b) || 0));

    // Place nodes in the column, avoiding all overlaps
    sortedByYTarget.forEach(id => {
        const nodeData = nodeDataMap.get(id);
        if (!nodeData) return;
        
        const totalHeight = nodeTotalHeights.get(id) || 0;
        const boxWidth = nodeData.kind === 'SINK_RED' ? BOX_SIZE.INPUT.W : BOX_SIZE.NODE.W;
        let y_candidate = yTargets.get(id) || 0;

        // Iteratively find a conflict-free vertical position
        while (true) {
            let conflict = false;
            const x = colIndex * (BOX_SIZE.NODE.W + PADDING.X);

            // 1. Check for conflicts with ALL previously placed nodes, regardless of column
            for (const otherPos of placedNodePositions.values()) {
                // AABB collision detection (Axis-Aligned Bounding Box)
                if (x < otherPos.x + otherPos.width + PADDING.X &&
                    x + boxWidth + PADDING.X > otherPos.x &&
                    y_candidate < otherPos.y + otherPos.height + PADDING.Y &&
                    y_candidate + totalHeight + PADDING.Y > otherPos.y)
                {
                    // Conflict! Adjust y_candidate to be below the conflicting node.
                    y_candidate = otherPos.y + otherPos.height + PADDING.Y;
                    conflict = true;
                    // Restart checks with the new y_candidate against all other nodes
                    break;
                }
            }
            if (conflict) continue;


            // 2. Check for conflicts with lines from parent nodes crossing intermediate nodes
            const parentIds = revAdj.get(id)!;
            for (const pId of parentIds) {
                const parentPos = placedNodePositions.get(pId);
                const parentCol = nodeColumns.get(pId);
                if (!parentPos || parentCol === undefined) continue;

                // Define the vertical "lane" of the connector
                const lineY_start = parentPos.y + (parentPos.height / 2);
                const lineY_end = y_candidate + (totalHeight / 2);
                const lineY_min = Math.min(lineY_start, lineY_end);
                const lineY_max = Math.max(lineY_start, lineY_end);

                // Check all intermediate columns for crossing nodes
                for (let i = parentCol + 1; i < colIndex; i++) {
                    for(const [otherId, otherPos] of placedNodePositions.entries()){
                        if(nodeColumns.get(otherId) === i){
                             const obstacleY_min = otherPos.y;
                             const obstacleY_max = otherPos.y + otherPos.height;
                             
                             if (lineY_max > obstacleY_min && lineY_min < obstacleY_max){
                                y_candidate = obstacleY_max + PADDING.Y;
                                conflict = true;
                                break;
                             }
                        }
                    }
                    if (conflict) break;
                }
                if (conflict) break;
            }

            if (!conflict) break; // Found a valid spot
        }
        
        // Place the node
        let mainBox: SceneNode;
        
        if (nodeData.kind === 'SINK_RED') {
            mainBox = makeBox(nodeData.label, BOX_SIZE.INPUT.W, BOX_SIZE.INPUT.H, customColors.sink);
        } else if (nodeData.kind === 'finalGood') {
            mainBox = makeFinalGoodBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, customColors.final);
        } else {
            mainBox = makeBox(nodeData.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, COLOR.MAIN_WHITE);
        }
        
        const x_pos = colIndex * (BOX_SIZE.NODE.W + PADDING.X);
        mainBox.x = x_pos;
        mainBox.y = y_candidate;

        placedNodePositions.set(id, {x: x_pos, y: y_candidate, height: totalHeight, width: boxWidth});
        nodes.set(id, mainBox);
        elementsToGroup.push(mainBox);

        // Attribute logic
        if ('sources' in nodeData || 'sinks' in nodeData) {
            let attrY = mainBox.height + 5;
            const addAttribute = (text: string, color: string) => {
              const attrBox = makeBox(text, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, color);
              attrBox.x = mainBox.x;
              attrBox.y = mainBox.y + attrY;
              elementsToGroup.push(attrBox);
              attrY += BOX_SIZE.ATTR.H + 5;
            };
            (nodeData as Act).sources?.forEach(s => {
                let color = customColors.source;
                if (s.toLowerCase().includes('xp')) color = customColors.xp;
                addAttribute(s, color);
            });
            (nodeData as Act).sinks?.forEach(s => addAttribute(s, customColors.sink));
        }
    });
  });

  // --- Draw Edges ---
  data.edges.forEach(([fromId, toId]) => {
    if (fromId && toId) {
        const fromNode = nodes.get(fromId);
        const toNode = nodes.get(toId);
        if (fromNode && toNode) {
          const connector = connect(fromNode, toNode);
          elementsToGroup.unshift(connector);
        }
    }
  });

  if (elementsToGroup.length > 0) {
    const group = figma.group(elementsToGroup, figma.currentPage);
    group.name = TAG;
    figma.currentPage.appendChild(group); // Bring the newly created group to the front
    figma.viewport.scrollAndZoomIntoView(group.children);
    reply('Diagram created successfully', true);
  }
};

/* ── utils ── */
function clear() { figma.currentPage.findAll(n => n.name.includes(TAG)).forEach(n => n.remove()); }
function reply(msg: string | string[], ok: boolean) { figma.ui.postMessage({ type: 'reply', msg, ok }); }

function syncFromCanvas() {
    const group = figma.currentPage.findOne(n => n.name === TAG);
    if (!group || !('children' in group)) {
        reply('No diagram found to sync.', false);
        return;
    }

    const nodes = new Map<string, SceneNode>();
    const graph: Graph = { inputs: [], nodes: [], edges: [] };

    // Pass 1: Reconstruct all nodes and map their IDs
    for (const child of group.children) {
        if (child.name.includes('Final Good')) {
            const finalGoodGroup = child as GroupNode;
            const body = finalGoodGroup.children.find(c => 'text' in c) as ShapeWithTextNode;
            if (body) {
                const id = body.text.characters.toLowerCase().replace(/\s+/g, '_');
                 graph.nodes.push({
                    id,
                    label: body.text.characters,
                    kind: 'finalGood',
                    sources: [], sinks: [], values: []
                });
                nodes.set(child.id, { ...child, name: id } as SceneNode);
            }
        } else if ('text' in child) {
            const node = child as ShapeWithTextNode;
            const id = node.text.characters.toLowerCase().replace(/\s+/g, '_');
            const fill = (node.fills as readonly Paint[])[0];

            if (fill && 'color' in fill) {
                // Approximate color matching
                const isInput = Math.round(fill.color.r * 255) === 218;
                if (isInput) {
                    graph.inputs.push({ id, label: node.text.characters, kind: 'SINK_RED' });
                } else {
                    graph.nodes.push({
                        id,
                        label: node.text.characters,
                        sources: [], sinks: [], values: []
                    });
                }
            }
            nodes.set(child.id, { ...child, name: id } as SceneNode);
        }
    }

    // Pass 2: Reconstruct edges
    for (const child of group.children) {
        if (child.type === 'CONNECTOR') {
            const connector = child as ConnectorNode;
            const startNodeId = (connector.connectorStart as EconomyFlowConnectorEndpoint).endpointNodeId;
            const endNodeId = (connector.connectorEnd as EconomyFlowConnectorEndpoint).endpointNodeId;

            const fromNode = nodes.get(startNodeId);
            const toNode = nodes.get(endNodeId);

            if (fromNode && toNode) {
                graph.edges.push([fromNode.name, toNode.name]);
            }
        }
    }

    const json = JSON.stringify(graph, null, 2);
    figma.ui.postMessage({ type: 'sync-json', json });
}