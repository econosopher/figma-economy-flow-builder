"use strict";
/* Supply-Flow Builder – FigJam & Design (2025-05) */
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
const TAG = 'SupplyFlowChart';
const isJam = figma.editorType === 'figjam';
/* ── helpers ── */
const hex = (h) => { const n = parseInt(h.slice(1), 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; };
async function fonts() {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
}
function makeBox(txt, w, h, fill) {
    // White text on dark backgrounds (red, black), black text on light backgrounds
    const isDarkBG = fill === COLOR.SINK_RED || fill === COLOR.HEADER_BLACK;
    const textColor = isDarkBG ? hex(COLOR.MAIN_WHITE) : hex(COLOR.HEADER_BLACK);
    if (isJam) {
        const s = figma.createShapeWithText();
        s.shapeType = 'SQUARE';
        s.resize(w, h);
        s.fills = [{ type: 'SOLID', color: hex(fill) }];
        if (fill === COLOR.MAIN_WHITE) {
            s.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
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
    f.resize(w, h);
    f.fills = [{ type: 'SOLID', color: hex(fill) }];
    if (fill === COLOR.MAIN_WHITE) {
        f.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
    }
    const t = figma.createText();
    t.characters = txt;
    t.fontSize = 12;
    t.fills = [{ type: 'SOLID', color: textColor }];
    t.textAlignHorizontal = 'LEFT';
    t.textAlignVertical = 'CENTER';
    t.resize(w - 16, h);
    f.appendChild(t);
    t.x = 8;
    t.y = (h - t.height) / 2;
    return f;
}
function makeFinalGoodBox(txt, w, h) {
    const headerHeight = 24;
    const bodyHeight = h - headerHeight;
    const body = makeBox(txt, w, bodyHeight, COLOR.FINAL_GOOD_YELLOW);
    const header = makeBox("", w, headerHeight, COLOR.HEADER_BLACK);
    header.y = bodyHeight;
    const finalGroup = figma.group([header, body], figma.currentPage);
    finalGroup.name = "Final Good: " + txt;
    return finalGroup;
}
function connect(A, B) {
    const c = figma.createConnector();
    c.connectorLineType = 'ELBOWED';
    c.strokeWeight = 2;
    // Use default grey for connectors
    c.strokes = [{ type: 'SOLID', color: hex(COLOR.CONNECTOR_GREY) }];
    if (B.name.startsWith("Final Good")) {
        c.dashPattern = [10, 10];
    }
    // Force left-to-right connection points
    c.connectorStart = { endpointNodeId: A.id, magnet: 'RIGHT' };
    c.connectorEnd = { endpointNodeId: B.id, magnet: 'LEFT' };
    return c;
}
/* ── UI ── */
figma.showUI(`
<style>body{margin:0;font-family:Inter,monospace;display:flex;flex-direction:column;height:100%}
textarea{flex:1;border:1px solid #999;border-radius:4px;padding:6px;font-family:monospace}
button{height:30px;margin-top:6px;border:none;border-radius:4px;font-weight:bold;color:#fff;cursor:pointer}
#go{background:#18a058} #clear{background:#b71c1c} #status{font-size:11px;margin-top:4px}</style>
<textarea id="json"></textarea>
<button id="go">Generate ⌘/Ctrl+Enter</button>
<button id="clear">Clear Canvas</button>
<div id="status"></div>
<script>
 const t=document.getElementById('json'),s=document.getElementById('status');
 const post=(cmd,obj={})=>parent.postMessage({pluginMessage:{cmd,...obj}},'*');
 document.getElementById('go').onclick=()=>post('draw',{json:t.value});
 document.getElementById('clear').onclick=()=>post('clear');
 t.onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')document.getElementById('go').click();}
 onmessage=e=>{const m=e.data.pluginMessage;s.textContent=m.msg;s.style.color=m.ok?'#2e7d32':'#c62828';};
</script>`, { width: 620, height: 450 });
/* ── main handler ── */
figma.ui.onmessage = async (m) => {
    if (m.cmd === 'clear') {
        clear();
        reply('Canvas cleared', true);
        return;
    }
    if (m.cmd !== 'draw')
        return;
    let data;
    try {
        data = JSON.parse(m.json);
    }
    catch (e) {
        reply(e.message, false);
        return;
    }
    await fonts();
    clear();
    const nodes = new Map();
    const elementsToGroup = [];
    const PADDING = { X: 150, Y: 150 };
    const BOX_SIZE = { INPUT: { W: 160, H: 40 }, NODE: { W: 180, H: 60 }, ATTR: { W: 140, H: 24 } };
    const COLUMNS = 4;
    data.inputs.forEach((inp, i) => {
        // Use the specific red color for inputs
        const box = makeBox(inp.label, BOX_SIZE.INPUT.W, BOX_SIZE.INPUT.H, COLOR[inp.kind]);
        box.x = 0;
        box.y = i * (BOX_SIZE.INPUT.H + PADDING.Y + 100);
        nodes.set(inp.id, box);
        elementsToGroup.push(box);
    });
    data.nodes.forEach((node, i) => {
        var _a, _b;
        let mainBox;
        if (node.kind === 'finalGood') {
            mainBox = makeFinalGoodBox(node.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H + 20);
        }
        else {
            mainBox = makeBox(node.label, BOX_SIZE.NODE.W, BOX_SIZE.NODE.H, COLOR.MAIN_WHITE);
        }
        const col = (i % COLUMNS) + 1;
        const row = Math.floor(i / COLUMNS);
        mainBox.x = col * (BOX_SIZE.NODE.W + PADDING.X);
        mainBox.y = row * (BOX_SIZE.NODE.H + PADDING.Y);
        nodes.set(node.id, mainBox);
        elementsToGroup.push(mainBox);
        let attrY = mainBox.height + 5;
        const addAttribute = (text, color) => {
            const attrBox = makeBox(text, BOX_SIZE.ATTR.W, BOX_SIZE.ATTR.H, color);
            attrBox.x = mainBox.x;
            attrBox.y = mainBox.y + attrY;
            elementsToGroup.push(attrBox);
            attrY += BOX_SIZE.ATTR.H + 5;
        };
        // Restore conditional coloring logic
        (_a = node.sources) === null || _a === void 0 ? void 0 : _a.forEach(s => {
            let color = COLOR.SOURCE_GREEN;
            if (s.toLowerCase().includes('xp')) {
                color = COLOR.XP_ORANGE;
            }
            addAttribute(s, color);
        });
        (_b = node.sinks) === null || _b === void 0 ? void 0 : _b.forEach(s => {
            addAttribute(s, COLOR.SINK_RED);
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
function reply(msg, ok) { figma.ui.postMessage({ msg, ok }); }
