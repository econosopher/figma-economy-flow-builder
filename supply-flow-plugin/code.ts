/* Supply-Flow Builder – FigJam & Design (2025-05) */

const COLOR = {
  inputTime : '#b71c1c', inputMoney:'#b71c1c', mainBox:'#111111',
  source:'#4caf50', sink:'#b71c1c', value:'#ff9800'
} as const;
type ColorKey = keyof typeof COLOR;
const TAG = 'SupplyFlowChart';
const isJam = figma.editorType === 'figjam';

/* ── helpers ── */
const hex = (h:string)=>{const n=parseInt(h.slice(1),16);return{r:((n>>16)&255)/255,g:((n>>8)&255)/255,b:(n&255)/255};};
async function fonts(){
  await figma.loadFontAsync({family:'Inter',style:'Regular'});
  await figma.loadFontAsync({family:'Inter',style:'Medium'}); // FigJam default
}
function makeBox(txt:string,w:number,h:number,fill:string):SceneNode{
  if(isJam){
    const s=figma.createShapeWithText();
    s.shapeType='ROUNDED_RECTANGLE';
    s.resize(w,h);
    s.fills=[{type:'SOLID',color:hex(fill)}];
    s.text.characters=txt; s.text.fontSize=12;
    s.text.fontName={family:'Inter',style:'Medium'};
    s.text.fills=[{type:'SOLID',color:hex('#FFF')}];
    return s;
  }
  const f=figma.createFrame(); f.resize(w,h); f.fills=[{type:'SOLID',color:hex(fill)}];
  const t=figma.createText();  t.characters=txt; t.fontSize=12;
  t.fills=[{type:'SOLID',color:hex('#FFF')}]; f.appendChild(t);
  t.x=(w-t.width)/2; t.y=(h-t.height)/2;
  return f;
}
function connect(A:SceneNode,B:SceneNode){
  const c=figma.createConnector();
  /* @ts-ignore endpoints */
  c.connectorStart={endpointNodeId:A.id,position:{x:A.width,y:A.height/2}};
  /* @ts-ignore */
  c.connectorEnd  ={endpointNodeId:B.id,position:{x:0,      y:B.height/2}};
  c.connectorLineType='ELBOWED';
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
</script>`,{width:620,height:360});

/* ── types ── */
interface Input {id:string;label:string;kind:ColorKey}
interface Act   {id:string;label:string;sources:string[];sinks:string[];values:string[]}
interface Graph {inputs:Input[];nodes:Act[];edges:[string,string][]}

/* ── main handler ── */
figma.ui.onmessage=async(m:any)=>{
  if(m.cmd==='clear'){clear();reply('Canvas cleared',true);return;}
  if(m.cmd!=='draw')return;

  let data:Graph;try{data=JSON.parse(m.json);}catch{reply('Invalid JSON',false);return;}

  await fonts(); clear();
  const out:SceneNode[]=[]; const map=new Map<string,SceneNode>();

  /* inputs */
  data.inputs.forEach((inp,i)=>{
    const b=makeBox(inp.label,160,40,COLOR[inp.kind]); b.x=0; b.y=i*120;
    out.push(b); map.set(inp.id,b);
  });

  /* nodes */
  data.nodes.forEach((n,i)=>{
    const main=makeBox(n.label,180,60,COLOR.mainBox); main.x=320; main.y=i*220;
    out.push(main); map.set(n.id,main);
    let y=60;
    const add=(txt:string,col:string)=>{const t=makeBox(txt,140,24,col); t.x=main.x+20; t.y=main.y+y; y+=30; out.push(t);};
    n.sources?.forEach(s=>add(s,COLOR.source));
    n.sinks  ?.forEach(s=>add(s,COLOR.sink));
    n.values ?.forEach(v=>add(v,COLOR.value));
  });

  /* edges */
  data.edges.forEach(([a,b])=>{const A=map.get(a),B=map.get(b); if(A&&B) out.push(connect(A,B));});

  if(out.length){
    const g=figma.group(out,figma.currentPage); g.name=TAG;
    figma.viewport.scrollAndZoomIntoView([g]);      // ←  ensure visible
  }
  reply('Diagram created',true);
};

/* ── utils ── */
function clear(){figma.currentPage.findAll(n=>n.name===TAG).forEach(n=>n.remove());}
function reply(msg:string,ok:boolean){figma.ui.postMessage({msg,ok});}
