/* Economy-Flow Builder – FigJam & Design (2025-05) */

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
};
const TAG = 'EconomyFlowChart';

const TEMPLATES = {
  basic: {
    "inputs": [
      { "id": "time", "label": "Spend Time", "kind": "SINK_RED" }
    ],
    "nodes": [
      { "id": "activity", "label": "Do Activity", "sources": ["Source A"], "sinks": ["Sink B"], "values": [] }
    ],
    "edges": [
      ["time", "activity"]
    ]
  },
  complex: {
    "inputs": [
      { "id": "input1", "label": "Input 1", "kind": "SINK_RED" },
      { "id": "input2", "label": "Input 2", "kind": "SINK_RED" }
    ],
    "nodes": [
      { "id": "node1", "label": "Activity 1", "sources": ["Source 1.1"], "sinks": [], "values": [] },
      { "id": "node2", "label": "Activity 2", "sources": [], "sinks": ["Sink 2.1"], "values": [] },
      { "id": "node3", "label": "Final Product", "kind": "finalGood", "sources": [], "sinks": [], "values": [] }
    ],
    "edges": [
      ["input1", "node1"],
      ["input2", "node2"],
      ["node1", "node3"],
      ["node2", "node3"]
    ]
  }
};

const isJam = figma.editorType === 'figjam';

/* ── helpers ── */
const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; };
async function fonts() {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
}

function makeBox(txt: string, w: number, h: number, fill: string): SceneNode {
  // White text on dark backgrounds (red, black), black text on light backgrounds
  const isDarkBG = fill === COLOR.SINK_RED || fill === COLOR.HEADER_BLACK;
  const textColor = isDarkBG ? hex(COLOR.MAIN_WHITE) : hex(COLOR.HEADER_BLACK);

  if (isJam) {
    const s = figma.createShapeWithText();
    s.shapeType = 'SQUARE';
    s.resize(w, h);
    s.fills = [{ type: 'SOLID', color: hex(fill) }];
    if (fill === COLOR.MAIN_WHITE) {
        s.strokes = [{type: 'SOLID', color: {r: 0.8, g: 0.8, b: 0.8}}];
        s.strokeWeight = 2;
    }
    s.text.characters = txt;
    s.text.fontSize = 12;
    s.text.fills = [{ type: 'SOLID', color: textColor }];
    // @ts-ignore - textAlignHorizontal exists but typings may be outdated.
    s.text.textAlignHorizontal = 'LEFT';
    return s;
  }
  
  const f = figma.createFrame();
  f.resize(w,h);
  f.fills=[{type:'SOLID',color:hex(fill)}];
  if (fill === COLOR.MAIN_WHITE) {
    f.strokes = [{ type: 'SOLID', color: {r: 0.8, g: 0.8, b: 0.8} }];
  }
  const t=figma.createText();
  t.characters=txt;
  t.fontSize=12;
  t.fills=[{type:'SOLID',color:textColor}];
  t.textAlignHorizontal='LEFT';
  t.textAlignVertical='CENTER';
  t.resize(w - 16, h);
  f.appendChild(t);
  t.x = 8;
  t.y = (h-t.height)/2;
  return f;
}

function makeFinalGoodBox(txt: string, w: number, h: number, bodyFill: string): SceneNode {
  const headerHeight = 24;
  const bodyHeight = h - headerHeight;

  const body = makeBox(txt, w, bodyHeight, bodyFill);
  
  const header = makeBox("", w, headerHeight, COLOR.HEADER_BLACK);
  header.y = bodyHeight;

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
figma.showUI(`
<style>
  body{margin:0;font-family:Inter,monospace;display:flex;flex-direction:column;height:100%}
  #templates{margin-bottom:8px}
  #colors { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; font-size: 12px; margin-bottom: 8px; }
  #colors > div { display: flex; align-items: center; justify-content: space-between; }
  #colors input { height: 24px; width: 40px; border: 1px solid #ccc; padding: 1px; }
  textarea{flex:1;border:1px solid #999;border-radius:4px;padding:6px;font-family:monospace}
  button{height:30px;margin-top:6px;border:none;border-radius:4px;font-weight:bold;color:#fff;cursor:pointer}
  #go{background:#18a058} #clear{background:#b71c1c} #status{font-size:11px;margin-top:4px}
  ul { padding-left: 20px; margin: 0; }
</style>
<div id="templates">
  <label for="template-select">Start with a template: </label>
  <select id="template-select">
    <option value="">--Select--</option>
  </select>
</div>
<div id="colors">
  <div><label for="color-sink">Input/Sink</label><input id="color-sink" type="color" value="${COLOR.SINK_RED}"></div>
  <div><label for="color-source">Source</label><input id="color-source" type="color" value="${COLOR.SOURCE_GREEN}"></div>
  <div><label for="color-xp">XP/Value</label><input id="color-xp" type="color" value="${COLOR.XP_ORANGE}"></div>
  <div><label for="color-final">Final Good</label><input id="color-final" type="color" value="${COLOR.FINAL_GOOD_YELLOW}"></div>
</div>
<textarea id="json"></textarea>
<button id="go">Generate ⌘/Ctrl+Enter</button>
<button id="clear">Clear Canvas</button>
<div id="status"></div>
<script>
 const t=document.getElementById('json'),s=document.getElementById('status'),tmpl=document.getElementById('template-select');
 const post=(cmd,obj={})=>parent.postMessage({pluginMessage:{cmd,...obj}},'*');
 document.getElementById('go').onclick=()=>{
   const colors = {
     sink: document.getElementById('color-sink').value,
     source: document.getElementById('color-source').value,
     xp: document.getElementById('color-xp').value,
     final: document.getElementById('color-final').value
   };
   post('draw',{json:t.value, colors});
 };
 document.getElementById('clear').onclick=()=>post('clear');
 t.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')document.getElementById('go').click();}
 onmessage=e=>{
  const m = e.data.pluginMessage as UIMessage;
  if (m.type === 'templates') {
    for (const key in m.templates) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      tmpl.appendChild(option);
    }
    tmpl.onchange = () => {
      if (t.value.trim() !== '' && !confirm('This will replace your current JSON. Are you sure?')) {
        tmpl.value = '';
        return;
      }
      const selected = tmpl.value;
      if (selected && m.templates[selected]) {
        t.value = JSON.stringify(m.templates[selected], null, 2);
      } else {
        t.value = '';
      }
    };
    return;
  }
  
  if (m.type === 'reply') {
    s.style.color=m.ok?'#2e7d32':'#c62828';
    if (Array.isArray(m.msg)) {
      s.innerHTML = '<ul>' + m.msg.map(item => '<li>' + item + '</li>').join('') + '</ul>';
    } else {
      s.textContent = m.msg;
    }
  }
 };
</script>`, { width: 620, height: 450 });

figma.ui.postMessage({ type: 'templates', templates: TEMPLATES });

/* ── types ── */
interface Input { id: string; label: string; kind: 'SINK_RED' }
interface Act { id: string; label: string; sources: string[]; sinks: string[]; values: string[]; kind?: string }
interface Graph { inputs: Input[]; nodes: Act[]; edges: [string, string][] }

// UI to Plugin messages
type DrawMessage = {
  cmd: 'draw';
  json: string;
  colors: { [key: string]: string };
};
type ClearMessage = { cmd: 'clear' };
type PluginMessage = DrawMessage | ClearMessage;

// Plugin to UI messages
type ReplyMessage = {
  type: 'reply';
  msg: string | string[];
  ok: boolean;
};
type TemplatesMessage = {
  type: 'templates';
  templates: any;
};
type UIMessage = ReplyMessage | TemplatesMessage;


function validateGraphData(data: any): string[] {
  const errors: string[] = [];
  if (!data) {
    errors.push("Data is null or undefined.");
    return errors;
  }

  const ids = new Set<string>();

  if (!Array.isArray(data.inputs)) {
    errors.push("'inputs' property must be an array.");
  } else {
    data.inputs.forEach((input: any, i: number) => {
      if (typeof input.id !== 'string') errors.push(`Input ${i}: 'id' is missing or not a string.`);
      else ids.add(input.id);
      if (typeof input.label !== 'string') errors.push(`Input ${i}: 'label' is missing or not a string.`);
      if (typeof input.kind !== 'string') errors.push(`Input ${i}: 'kind' is missing or not a string.`);
    });
  }

  if (!Array.isArray(data.nodes)) {
    errors.push("'nodes' property must be an array.");
  } else {
    data.nodes.forEach((node: any, i: number) => {
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
    data.edges.forEach((edge: any, i: number) => {
      if (!Array.isArray(edge) || edge.length !== 2 || typeof edge[0] !== 'string' || typeof edge[1] !== 'string') {
        errors.push(`Edge ${i}: must be an array of two strings.`);
      } else {
        if (!ids.has(edge[0])) errors.push(`Edge ${i}: 'from' id '${edge[0]}' not found in inputs or nodes.`);
        if (!ids.has(edge[1])) errors.push(`Edge ${i}: 'to' id '${edge[1]}' not found in inputs or nodes.`);
      }
    });
  }

  return errors;
}

/* ── main handler ── */
figma.ui.onmessage = async (m: PluginMessage) => {
  if (m.cmd === 'clear') { clear(); reply('Canvas cleared', true); return; }
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
  const PADDING = { X: 150, Y: 150 };
  const BOX_SIZE = { INPUT: { W: 160, H: 40 }, NODE: { W: 180, H: 60 }, ATTR: { W: 140, H: 24 } };
  const COLUMNS = 4;
  const customColors = m.colors || {
      sink: COLOR.SINK_RED,
      source: COLOR.SOURCE_GREEN,
      xp: COLOR.XP_ORANGE,
      final: COLOR.FINAL_GOOD_YELLOW,
  };

  data.inputs.forEach((inp, i) => {
    // Use the specific red color for inputs
    const box = makeBox(inp.label, BOX_SIZE.INPUT.W, BOX_SIZE.INPUT.H, customColors.sink);
    box.x = 0;
    box.y = i * (BOX_SIZE.INPUT.H + PADDING.Y + 100);
    nodes.set(inp.id, box);
    elementsToGroup.push(box);
  });

  data.nodes.forEach((node, i) => {
    let mainBox: SceneNode;
    if (node.kind === 'finalGood') {
      mainBox = makeFinalGoodBox(node.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H + 20, customColors.final);
    } else {
      mainBox = makeBox(node.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, COLOR.MAIN_WHITE);
    }

    const col = (i % COLUMNS) + 1;
    const row = Math.floor(i / COLUMNS);
    mainBox.x = col * (BOX_SIZE.NODE.W + PADDING.X);
    mainBox.y = row * (BOX_SIZE.NODE.H + PADDING.Y);

    nodes.set(node.id, mainBox);
    elementsToGroup.push(mainBox);

    let attrY = mainBox.height + 5;
    const addAttribute = (text: string, color: string) => {
      const attrBox = makeBox(text, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, color);
      attrBox.x = mainBox.x;
      attrBox.y = mainBox.y + attrY;
      elementsToGroup.push(attrBox);
      attrY += BOX_SIZE.ATTR.H + 5;
    };
    
    // Restore conditional coloring logic
    node.sources?.forEach(s => {
        let color = customColors.source;
        if (s.toLowerCase().includes('xp')) {
            color = customColors.xp;
        }
        addAttribute(s, color);
    });
    node.sinks?.forEach(s => {
        addAttribute(s, customColors.sink);
    });
  });

  data.edges.forEach(([fromId, toId]) => {
    const fromNode = nodes.get(fromId);
    const toNode = nodes.get(toId);
    if (fromNode && toNode) {
      const connector = connect(fromNode, toNode);
      elementsToGroup.unshift(connector);
    }
  });

  if (elementsToGroup.length > 0) {
    const group = figma.group(elementsToGroup, figma.currentPage);
    group.name = TAG;
    figma.viewport.scrollAndZoomIntoView(group.children);
    reply('Diagram created successfully', true);
  }
};

/* ── utils ── */
function clear() { figma.currentPage.findAll(n => n.name === TAG).forEach(n => n.remove()); }
function reply(msg: string | string[], ok: boolean) { figma.ui.postMessage({ type: 'reply', msg, ok }); }