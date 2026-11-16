/* Canvas editor. Rendering is derived entirely from the versioned project data. */
"use strict";
const C = StudioCore;
const $ = id => document.getElementById(id);
$("viewport").append($("text-toolbar"));
const spaceGuide=document.createElement('div');spaceGuide.id='space-guide';spaceGuide.hidden=true;spaceGuide.innerHTML='<div class="space-gap"></div><div class="space-line"></div><span></span>';$("viewport").append(spaceGuide);
const dropHint=document.createElement('div');dropHint.id='edge-drop-hint';dropHint.hidden=true;$("viewport").append(dropHint);
const toolbarIcons={
  library:['项目','<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z"/>'],
  'new-project':['新建','<path d="M12 4v16M4 12h16"/>'],
  import:['导入','<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>'],
  undo:['撤销','<path d="m8 5-5 5 5 5M3 10h11a7 7 0 0 1 7 7v2"/>'],
  redo:['重做','<path d="m16 5 5 5-5 5M21 10H10a7 7 0 0 0-7 7v2"/>'],
  export:['导出','<path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8"/>'],
  present:['演示','<path d="m7 4 13 8-13 8Z"/>']
};
for(const [id,[label,paths]] of Object.entries(toolbarIcons))$(id).innerHTML=`<svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg><span>${label}</span>`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const seed = C.validate(JSON.parse($("seed-project").textContent));
const writerId = C.uid("window");
const desktop=window.studioDesktop||null;
let componentLibrary=null,welcome=null,projectManager=null,editorUI=null;
const initialProject=desktop?C.newProject('未命名汇报'):C.copy(seed);
if(desktop)document.body.classList.add('home-open');
const documentKey = desktop?'presentation-studio-desktop-current':"presentation-studio-current:" + document.documentElement.dataset.documentId + ":" + location.pathname;
const state = {
  project: initialProject, selected: new Set(), edgeId: null, activeStep: initialProject.steps[0].id,
  home:Boolean(desktop),hasProject:false,
  tab: "add", inspectorMode: "canvas", view: {x:0,y:0,zoom:.6},
  undo: [], redo: [], pointer: null, space: false, panMode: false, scrollDragging: false, suppressCanvasClick: false, connectFrom: null, clipboard: null,
  editingText: false, finishTextEdit: null, liveProperty: null, playing: false, overview: false, playIndex: 0, autoTimer: null, editView: null,
  toggledGroups: new Set(), saveTimer: null, saveQueue: Promise.resolve(), revisions: new Map(),
  toastTimer: null, uploadTarget: null, focusedCell: null, clickToEdit: null, canvasEditing: false, ready: false,
  spaceTool: null, dropEdgeId: null, insertEdgeId: null,
  layerMulti: false, selectionFocus: null, leftScroll: {}, dropJunctionIds: []
};
let database = null;
let editorTools = null;
let layerTools = null;
let lastViewport = {width:0,height:0};
const selectedNodes = () => state.project.nodes.filter(n => state.selected.has(n.id));
const selectedEdge = () => state.project.edges.find(e => e.id === state.edgeId);
const selectedGroup = () => state.project.groups.find(g => g.nodeIds.length === state.selected.size && g.nodeIds.every(id => state.selected.has(id)));
const findNode = id => state.project.nodes.find(n => n.id === id);
const stepIndex = id => state.project.steps.findIndex(s => s.id === id);
const currentStep = () => state.project.steps.find(s => s.id === state.activeStep) || state.project.steps[0];

function toast(message) {
  clearTimeout(state.toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  state.toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4000);
}
function markSave(text, error=false) {
  $("save-state").textContent = text;
  $("save-state").dataset.error=String(error);$("save-state").style.removeProperty("color");
}
function readRecord(id) {
  if(desktop)return desktop.readRecord(id);
  if (!database) {
    try { return Promise.resolve(JSON.parse(localStorage.getItem("studio-project:" + id))); }
    catch { return Promise.resolve(null); }
  }
  return new Promise((resolve,reject) => {
    const request = database.transaction("projects").objectStore("projects").get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
function allRecords() {
  if(desktop)return desktop.allRecords();
  if (!database) {
    const records = [];
    try { for (let i=0;i<localStorage.length;i++) { const key=localStorage.key(i); if(key.startsWith("studio-project:")) records.push(JSON.parse(localStorage.getItem(key))); } } catch { /* Export still works. */ }
    return Promise.resolve(records.filter(Boolean));
  }
  return new Promise((resolve,reject) => {
    const request=database.transaction("projects").objectStore("projects").getAll();
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });
}
function writeRecord(snapshot, view) {
  const expected=state.revisions.get(snapshot.id)||0;
  function prepare(existing) {
    if(existing && (existing.deletedAt||existing.revision!==expected && existing.writer!==writerId)) {
      const originalId=snapshot.id;
      snapshot.id=C.uid("project"); snapshot.title += " · 并行编辑副本";
      if(state.project.id===originalId) { state.project.id=snapshot.id; state.project.title=snapshot.title; $("project-title").value=snapshot.title; }
      toast("另一窗口已更新原项目，当前修改已保存为独立副本。");
    }
    return {id:snapshot.id, project:snapshot, view, writer:writerId, revision:(existing?.revision||0)+1, updatedAt:Date.now()};
  }
  function completed(record) {
    state.revisions.set(record.id,record.revision);
    try { localStorage.setItem(documentKey,state.project.id); } catch { /* Project itself may still save to IndexedDB. */ }
    markSave("已自动保存");
  }
  if(desktop)return readRecord(snapshot.id).then(async existing=>{const record=prepare(existing);await desktop.putRecord(record);completed(record);});
  if(!database) {
    return readRecord(snapshot.id).then(existing=>{
      const record=prepare(existing); localStorage.setItem("studio-project:"+record.id,JSON.stringify(record)); completed(record);
    });
  }
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction("projects","readwrite");
    const store=transaction.objectStore("projects"); let record;
    const request=store.get(snapshot.id);
    request.onsuccess=()=>{ record=prepare(request.result); store.put(record); };
    transaction.oncomplete=()=>{completed(record);resolve();};
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error||new Error("保存中断"));
  });
}
function persistNow() {
  clearTimeout(state.saveTimer);
  if(!state.hasProject)return Promise.resolve(true);
  const snapshot=C.copy(state.project),view={...(state.editView||state.view),editor:layerTools?.snapshot()};
  state.saveQueue=state.saveQueue.then(()=>writeRecord(snapshot,view)).then(()=>true).catch(()=>{
    markSave("自动保存失败，请导出",true); toast("本机存储不可用或已满，请导出项目 JSON 或 HTML 保留修改。");return false;
  });
  return state.saveQueue;
}
function scheduleSave() {
  if(!state.hasProject)return;
  markSave("保存中…"); clearTimeout(state.saveTimer);
  state.saveTimer=setTimeout(persistNow,500);
}
function recordChange(before) {
  if(JSON.stringify(before)===JSON.stringify(state.project))return;
  state.undo.push({project:before,editor:StudioLayers.normalize(before,state.editorView)}); if(state.undo.length>45)state.undo.shift();
  state.redo=[]; scheduleSave(); updateHistoryButtons();
}
function change(operation, options={}) {
  state.liveProperty=null;
  const before=C.copy(state.project);
  operation(); recordChange(before);
  renderCanvas(); renderLeft();
  if(options.inspector!==false)renderInspector();
}
function updateHistoryButtons() { $("undo").disabled=!state.undo.length; $("redo").disabled=!state.redo.length; }
function recordEditorChange(before) {
  state.liveProperty=null;state.undo.push({project:C.copy(state.project),editor:before});
  if(state.undo.length>45)state.undo.shift();state.redo=[];scheduleSave();updateHistoryButtons();
}
function travelHistory(direction) {
  if(state.editingText)return;
  const from=direction<0?state.undo:state.redo;
  const to=direction<0?state.redo:state.undo;
  if(!from.length)return;
  to.push({project:C.copy(state.project),editor:layerTools?.snapshot()});
  const id=state.project.id;
  const entry=from.pop();state.project=entry.project;state.project.id=id;layerTools?.restore(entry.editor);
  state.selected=new Set([...state.selected].filter(id=>findNode(id)));
  if(!state.project.steps.some(s=>s.id===state.activeStep))state.activeStep=state.project.steps[0].id;
  scheduleSave();renderAll();
}
function setSelection(ids, edgeId=null,options={}) {
  state.liveProperty=null;
  state.selected=new Set(ids);state.edgeId=edgeId;state.inspectorMode=ids.length||edgeId?"node":"canvas";
  syncSelectionNavigation(options.focusId);
  document.body.classList.toggle("show-properties",Boolean(ids.length||edgeId));
  renderSelection();renderInspector();
  if(options.preserveLeft&&state.tab==='layers'&&editorTools)editorTools.updateLayerSelection();else renderLeft();
  updateStatus();
  if(options.reveal!==false)revealLeftSelection();
}
function syncSelectionNavigation(focusId=null) {
  state.selectionFocus=state.selected.has(focusId)?focusId:state.selected.has(state.selectionFocus)?state.selectionFocus:[...state.selected].at(-1)||null;
  const step=findNode(state.selectionFocus)?.stepId||selectedEdge()?.stepId;
  if(step)state.activeStep=step;
}
function revealLeftSelection() {
  const panel=$("left-content");let target=null;
  if(state.tab==='layers') {
    layerTools?.reveal(state.selectionFocus||state.edgeId);
    editorTools?.revealLayers(state.selectionFocus||state.edgeId);
    const group=selectedGroup();
    if(group)target=[...panel.querySelectorAll('[data-group]')].find(el=>el.dataset.group===group.id);
    else if(state.selectionFocus)target=[...panel.querySelectorAll('[data-layer]')].find(el=>el.dataset.layer===state.selectionFocus);
    else if(state.edgeId)target=[...panel.querySelectorAll('[data-select-edge]')].find(el=>el.dataset.selectEdge===state.edgeId);
  }else if(state.tab==='steps')target=[...panel.querySelectorAll('[data-select-step]')].find(el=>el.dataset.selectStep===state.activeStep);
  if(!target)return;
  const rect=target.getBoundingClientRect(),bounds=panel.getBoundingClientRect();
  const top=bounds.top+(panel.querySelector('.layer-controls,.step-controls')?.offsetHeight||0)+8,bottom=bounds.bottom-8;
  if(rect.top<top)panel.scrollTop+=rect.top-top;
  else if(rect.bottom>bottom)panel.scrollTop+=rect.bottom-bottom;
}
function switchLeftTab(tab) {
  state.leftScroll[state.tab]=$("left-content").scrollTop;state.tab=tab;
  renderLeft();$("left-content").scrollTop=state.leftScroll[tab]||0;revealLeftSelection();
}
function selectLayerUnit(ids,event) {
  focusCanvas();stopSpaceTool();
  const multi=state.layerMulti||event.shiftKey||event.ctrlKey||event.metaKey||event.target.matches('[data-layer-check]');
  const selected=new Set(multi?state.selected:[]);
  const remove=multi&&ids.every(id=>selected.has(id));
  ids.forEach(id=>remove?selected.delete(id):selected.add(id));
  setSelection([...selected],null,{focusId:ids.at(-1),reveal:false,preserveLeft:true});
  // Layer selection is independent from camera focus.
}
function updateStatus(message) {
  $("status").textContent=message|| (state.edgeId?"已选择连线":state.selected.size?`已选择 ${state.selected.size} 个组件`:`${state.project.nodes.length} 个组件 · ${state.project.edges.length} 条连线 · ${state.project.steps.length} 个演示步骤`);
}

function worldPoint(clientX,clientY) {
  const rect=$("viewport").getBoundingClientRect();
  return {x:(clientX-rect.left-state.view.x)/state.view.zoom,y:(clientY-rect.top-state.view.y)/state.view.zoom};
}
function viewportCenter() {
  const rect=$("viewport").getBoundingClientRect();return worldPoint(rect.left+rect.width/2,rect.top+rect.height/2);
}
function updateView(animate=false) {
  $("world").classList.toggle("camera-move",animate);
  $("world").style.transform=`translate(${state.view.x}px,${state.view.y}px) scale(${state.view.zoom})`;
  $("zoom-label").textContent=Math.round(state.view.zoom*100)+"%";
  renderSelection();
  renderCanvasFrame();
  updateHorizontalScroll();
}
function updateHorizontalScroll() {
  const slider=$("horizontal-scroll"),viewport=$("viewport"),z=state.view.zoom;
  const center=(viewport.clientWidth/2-state.view.x)/z;
  if(!state.scrollDragging) {
    const canvas=C.canvasBounds(state.project.canvas);
    const objects=C.contentNodes(state.project),content=objects.length?C.bounds(objects):canvas;
    const padding=viewport.clientWidth/(2*z);
    slider.min=Math.min(canvas.x,content.x,center)-padding;
    slider.max=Math.max(canvas.x+canvas.w,content.x+content.w,center)+padding;
    slider.step=10/z;
  }
  slider.value=center;
  slider.setAttribute('aria-valuetext',`视野中心 X ${Math.round(center)}`);
}
function updatePanMode() {
  $("viewport").classList.toggle('pan-mode',state.panMode);
  $("pan-tool").setAttribute('aria-pressed',String(state.panMode));
}
function setCamera(camera, animate=false) {
  const viewport=$("viewport");
  state.view.zoom=Math.max(.04,Math.min(4,camera.zoom));
  state.view.x=viewport.clientWidth/2-camera.cx*state.view.zoom;
  state.view.y=viewport.clientHeight/2-camera.cy*state.view.zoom;
  lastViewport={width:viewport.clientWidth,height:viewport.clientHeight};
  updateView(animate);
}
function fitBounds(box, animate=false) {
  const viewport=$("viewport");
  const padding=state.playing?140:80;
  const zoom=Math.max(.04,Math.min(1.6,(viewport.clientWidth-padding)/Math.max(box.w,100),(viewport.clientHeight-padding)/Math.max(box.h,100)));
  setCamera({cx:box.x+box.w/2,cy:box.y+box.h/2,zoom},animate);
}
function zoomBy(factor,clientX,clientY) {
  const rect=$("viewport").getBoundingClientRect();
  const x=clientX??rect.left+rect.width/2,y=clientY??rect.top+rect.height/2;
  const before=worldPoint(x,y);
  state.view.zoom=Math.max(.04,Math.min(4,state.view.zoom*factor));
  state.view.x=x-rect.left-before.x*state.view.zoom;state.view.y=y-rect.top-before.y*state.view.zoom;
  updateView();
}
function isVisible(node) {
  if(!state.playing)return layerTools?layerTools.isVisible(node):true;
  if(state.overview)return !node.hidden;
  if(!C.visibleAt(node,state.project.steps,state.playIndex))return false;
  return !state.project.groups.some(g=>state.toggledGroups.has(g.id)&&g.nodeIds.includes(node.id));
}
function nodeBody(node,project=state.project) {
  if(["text","button"].includes(node.type))return escapeHtml(node.text);
  if(node.type==="shape") {
    const fill=escapeHtml(node.style.fill),stroke=escapeHtml(node.style.border),width=node.style.borderWidth;
    let shape=`<rect x="${width/2}" y="${width/2}" width="${Math.max(1,node.w-width)}" height="${Math.max(1,node.h-width)}" rx="${node.style.radius}"/>`;
    if(node.shape==="ellipse")shape=`<ellipse cx="${node.w/2}" cy="${node.h/2}" rx="${Math.max(1,(node.w-width)/2)}" ry="${Math.max(1,(node.h-width)/2)}"/>`;
    if(node.shape==="diamond")shape=`<polygon points="${node.w/2},${width} ${node.w-width},${node.h/2} ${node.w/2},${node.h-width} ${width},${node.h/2}"/>`;
    return `<svg width="100%" height="100%" viewBox="0 0 ${node.w} ${node.h}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" aria-hidden="true">${shape}</svg>`;
  }
  if(node.type==="icon")return `<svg viewBox="0 0 48 48" preserveAspectRatio="none" fill="${node.style.fill==='transparent'?'none':escapeHtml(node.style.fill)}" stroke="${escapeHtml(node.style.color)}" stroke-width="${node.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-label="${escapeHtml(C.ICON_NAMES[node.icon])}">${C.ICONS[node.icon]}</svg>`;
  if(node.type==="image") {
    const asset=project.assets[node.assetId];
    return asset?`<img src="${escapeHtml(asset.data)}" alt="${escapeHtml(node.name)}" draggable="false" style="object-fit:${node.fit};object-position:${node.positionX}% ${node.positionY}%">`:'<div class="image-empty">在右侧替换图片</div>';
  }
  if(node.type==="table")return `<table>${node.cells.map((row,r)=>`<tr>${row.map((value,c)=>`<td data-row="${r}" data-col="${c}" style="border-color:${escapeHtml(node.style.border)};border-width:${node.style.borderWidth}px;background:${r===0?escapeHtml(node.headerFill):'transparent'};height:${100/node.cells.length}%">${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</table>`;
  if(StudioEffects.handles(node.type))return StudioEffects.body(node,project,escapeHtml);
  return "";
}
function applyNodeStyles(element,node) {
  Object.assign(element.style,{left:node.x+"px",top:node.y+"px",width:node.w+"px",height:node.h+"px",transform:`rotate(${node.rotation}deg)`,opacity:node.style.opacity});
  const body=element.firstElementChild;
  // Flip cards paint fill and border on each face so the back can differ.
  const vector=["shape","icon","flip"].includes(node.type);
  Object.assign(body.style,{
    background:vector?"transparent":node.style.fill,color:node.style.color,
    border:vector?"none":`${node.style.borderWidth}px solid ${node.style.border}`,borderRadius:node.style.radius+"px",
    fontSize:node.style.fontSize+"px",fontFamily:`"${node.style.fontFamily}",sans-serif`,fontWeight:node.style.fontWeight,
    lineHeight:node.style.lineHeight,textAlign:node.style.align,padding:vector||['image','table','compare','chart'].includes(node.type)?"0":node.style.padding+"px",
    boxShadow:node.style.shadow?`0 ${node.style.shadow/3}px ${node.style.shadow}px #20304022`:"none",
    backdropFilter:node.style.glass?`blur(${node.style.glass}px) saturate(1.3)`:""
  });
}
function renderPaper() {
  const canvas=state.project.canvas;
  Object.assign($("paper").style,{left:(canvas.x??0)+"px",top:(canvas.y??0)+"px",width:canvas.width+"px",height:canvas.height+"px",backgroundColor:canvas.background});
  $("paper").classList.toggle("grid",canvas.grid&&!state.playing);
  $("viewport").style.backgroundColor=state.playing?canvas.background:'';
  renderCanvasFrame();
}
function renderCanvasFrame() {
  state.canvasEditing=false;$("canvas-frame").hidden=true;$("canvas-frame").replaceChildren();
}
function renderCanvas(animateIds=new Set()) {
  layerTools?.restore(state.editorView);
  renderPaper();
  updateHorizontalScroll();
  const fragment=document.createDocumentFragment();
  state.project.nodes.forEach(node=>{
    const element=document.createElement('div');
    element.className=`node type-${node.type}${node.locked?' locked':''}${node.hidden&&!state.playing?' node-hidden':''}${node.action.type!=='none'?' has-action':''}`;
    element.dataset.node=node.id;element.setAttribute('aria-label',node.name);element.hidden=!isVisible(node);
    element.innerHTML=`<div class="node-body">${nodeBody(node)}</div>`;
    applyNodeStyles(element,node);effects?.decorate(element,node);
    const delay=state.motionDelays?.get(node.id)??node.animation.delay,entering=animateIds.has(node.id);
    if(entering){
      // A typewriter only applies to text; other objects fall back to a fade.
      const animation=node.animation.type==='type'&&!['text','button'].includes(node.type)?{...node.animation,type:'fade'}:node.animation;
      animateElement(element.firstElementChild,{...animation,delay});StudioEffects.enter(element,node,delay);
    }
    if(state.playing)StudioEffects.loop(element,node,entering?delay+(node.animation.type==='none'?0:node.animation.duration):0);
    fragment.append(element);
  });
  $("nodes").replaceChildren(fragment);
  renderEdges(animateIds);renderSelection();updateStatus();
  if(state.playing)effects?.afterRender();
  layerTools?.updateNotice();
  $("empty-hint").hidden=Boolean(state.project.nodes.length||state.project.edges.length)||state.playing;
}
function renderEdges(animateIds=new Set()) {
  const markup=item=>{
    if(!state.playing&&layerTools&&!layerTools.isVisible(item))return '';
    const from=findNode(item.from),to=findNode(item.to);
    if(C.edgeNodeIds(item).some(id=>!isVisible(findNode(id)))||state.playing&&!state.overview&&!C.visibleAt(item,state.project.steps,state.playIndex))return"";
    const color=escapeHtml(item.color),path=C.edgePath(item,state.project.nodes),id=escapeHtml(item.id);
    const middle=C.edgeMidpoint(item,state.project.nodes);
    const delay=state.motionDelays?.get(item.id)??item.animation.delay;
    const effect=animateIds.has(item.id)?(item.animation.type==='none'&&delay>0?'fade':item.animation.type):'none',drawing=effect==='draw';
    const timing=`--duration:${item.animation.type==='none'?0:item.animation.duration}ms;--delay:${delay}ms`;
    // A connection is one visual object: shaft, tip and label share its clock.
    // Drawing reveals the label mid-stroke and the tip as the stroke arrives.
    return `<g data-edge="${id}" class="edge-visual ${effect!=='none'&&!drawing?'motion-'+effect:''}" style="${timing}"><defs><marker id="arrow-${id}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path class="${drawing?'edge-draw-tip':''}" style="${timing};stroke-dasharray:none;stroke-dashoffset:0" d="M1 1L7 4L1 7" fill="none" stroke="${color}" stroke-width="1.5"/></marker></defs><path class="edge-hit" d="${path}"/><path class="edge-line ${drawing?'motion-draw':''}" d="${path}" pathLength="1" stroke="${color}" stroke-width="${item.width}" ${item.arrow?`marker-end="url(#arrow-${id})"`:''} ${item.dash?'data-dashed="true"':''} ${item.dash&&!drawing?'stroke-dasharray=".014 .01"':''}/>${StudioEffects.edgeFlow(item,path,color,effect!=='none')}${item.label?`<text class="edge-label ${drawing?'edge-draw-label':''}" x="${middle.x}" y="${middle.y-10}" text-anchor="middle" font-size="${item.labelSize}" fill="${color}">${escapeHtml(item.label)}</text>`:''}</g>`;
  };
  $("edges").innerHTML=state.project.edges.filter(e=>!C.isFreeEdge(e)).map(markup).join('');
  $("free-edges").innerHTML=state.project.edges.filter(C.isFreeEdge).map(markup).join('');
  for(const layer of [$("edges"),$("free-edges")])for(const line of layer.querySelectorAll('.motion-draw[data-dashed]')) {
    line.addEventListener('animationend',()=>{line.classList.remove('motion-draw');line.setAttribute('stroke-dasharray','.014 .01');},{once:true});
  }
}
function animateElement(element,animation) {
  const type=animation.type==='draw'||animation.type==='none'&&animation.delay>0?'fade':animation.type;
  if(type==='none'||type==='type')return;// typing is driven by StudioEffects.enter
  element.style.setProperty('--duration',(animation.type==='none'?0:animation.duration)+'ms');element.style.setProperty('--delay',animation.delay+'ms');
  element.classList.add('motion-'+type);
}
// Screen-space breathing room for editing; keep the document's text layout intact.
function textEditGutter() {return 8/state.view.zoom;}
function renderTextGutters(nodes) {
  const active=!state.playing&&nodes.length===1&&nodes[0].type==='text'?nodes[0]:null;
  for(const element of $("nodes").querySelectorAll('.type-text')) {
    const node=findNode(element.dataset.node),body=element.firstElementChild;
    const gutter=active?.id===node.id?textEditGutter():0;
    body.dataset.editGutter=String(gutter);
    Object.assign(body.style,{
      position:gutter?'relative':'',left:gutter?-gutter+'px':'',top:gutter?-gutter+'px':'',
      width:gutter?node.w+2*gutter+'px':'100%',height:gutter?node.h+2*gutter+'px':'100%',
      padding:node.style.padding+gutter+'px'
    });
  }
}
function renderSelection() {
  const nodes=selectedNodes().filter(isVisible);
  renderTextGutters(nodes);
  renderTextToolbar(nodes);
  if(state.playing){$("selection").innerHTML='';return;}
  const line=selectedEdge();
  if(line&&(!layerTools||layerTools.isVisible(line))) {
    const size=14/state.view.zoom;
    const linePoints=C.edgePoints(line,state.project.nodes);
    let handles=C.isFreeEdge(line)?['fromPoint','toPoint'].map((key,index)=>`<span class="free-endpoint" data-line-end="${key}" title="拖动${key==='fromPoint'?'起点':'终点'}" style="left:${linePoints[index].x-size/2}px;top:${linePoints[index].y-size/2}px;width:${size}px;height:${size}px"></span>`).join(''):'';
    if(line.route!=='elbow') {
      const mid=C.edgeMidpoint(line,state.project.nodes),radius=18/state.view.zoom;
      handles+=`<span class="curve-handle" data-curve-handle title="拖动中点调整弯曲" style="left:${mid.x-radius/2}px;top:${mid.y-radius/2}px;width:${radius}px;height:${radius}px;border-color:${escapeHtml(line.color)}"></span>`;
    }
    $("selection").innerHTML=handles;return;
  }
  if(!nodes.length){$("selection").innerHTML='';return;}
  const box=C.bounds(nodes),size=8/state.view.zoom;
  if(nodes.length===1&&nodes[0].type==='text') {
    const gutter=textEditGutter();
    box.x-=gutter;box.y-=gutter;box.w+=2*gutter;box.h+=2*gutter;
  }
  const handles={nw:[0,0],n:[.5,0],ne:[1,0],e:[1,.5],se:[1,1],s:[.5,1],sw:[0,1],w:[0,.5]};
  let html=nodes.length>1?nodes.map(n=>`<div class="selection-outline" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;transform:rotate(${n.rotation}deg)"></div>`).join(''):'';
  html+=`<div class="selection-box ${nodes.length>1?'multiple':''}" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px">`;
  if(nodes.some(n=>!n.locked)) {
    const z=state.view.zoom;
    for(const side of ['n','e','s','w']) {
      const horizontal=side==='n'||side==='s';
      html+=`<span class="resize-edge" data-resize="${side}" title="${horizontal?'只调整高度':'只调整宽度'}" style="${horizontal?`left:${12/z}px;right:${12/z}px;height:${12/z}px;${side==='n'?'top':'bottom'}:${-6/z}px`:`top:${12/z}px;bottom:${12/z}px;width:${12/z}px;${side==='w'?'left':'right'}:${-6/z}px`};cursor:${horizontal?'ns':'ew'}-resize"></span>`;
    }
    html+=Object.entries(handles).map(([key,[x,y]])=>{
      const width=(key==='n'||key==='s'?36:12)/z,height=(key==='e'||key==='w'?36:12)/z;
      return `<span class="resize-handle" data-resize="${key}" title="${key.length===2?'同时调整宽高':key==='e'||key==='w'?'只调整宽度':'只调整高度'}" style="width:${width}px;height:${height}px;left:calc(${x*100}% - ${width/2}px);top:calc(${y*100}% - ${height/2}px);cursor:${key}-resize"></span>`;
    }).join('');
  }
  if(nodes.length===1)html+=Object.entries({top:[.5,0],right:[1,.5],bottom:[.5,1],left:[0,.5]}).map(([key,[x,y]])=>`<span class="port" data-port="${key}" title="拖动连线（外侧圆点）" style="width:${size*1.35}px;height:${size*1.35}px;left:calc(${x*100}% - ${size*.675}px + ${(key==='right'?20:key==='left'?-20:0)/state.view.zoom}px);top:calc(${y*100}% - ${size*.675}px + ${(key==='bottom'?20:key==='top'?-20:0)/state.view.zoom}px)"></span>`).join('');
  $("selection").innerHTML=html+'</div>';
}
function renderTextToolbar(nodes) {
  const toolbar=$("text-toolbar"),node=nodes[0];
  toolbar.hidden=state.playing||nodes.length!==1||node.type!=='text';
  if(toolbar.hidden)return;
  toolbar.querySelector('[data-command="text-bold"]').setAttribute('aria-pressed',String(node.style.fontWeight>=600));
  for(const input of toolbar.querySelectorAll('[data-prop]')) {
    if(document.activeElement!==input)input.value=getNested(node,input.dataset.prop);
  }
  for(const button of toolbar.querySelectorAll('[data-command^="text-align-"]'))button.setAttribute('aria-pressed',String(button.dataset.command==='text-align-'+node.style.align));
  const element=[...$("nodes").children].find(el=>el.dataset.node===node.id);
  if(!element)return;
  const rect=element.getBoundingClientRect(),viewport=$("viewport").getBoundingClientRect();
  if(rect.bottom<viewport.top||rect.top>viewport.bottom||rect.right<viewport.left||rect.left>viewport.right){toolbar.hidden=true;return;}
  const left=Math.max(8,Math.min(viewport.width-toolbar.offsetWidth-8,rect.right-viewport.left-toolbar.offsetWidth));
  let top=rect.top-viewport.top-toolbar.offsetHeight-18;
  if(top<8)top=Math.min(viewport.height-toolbar.offsetHeight-88,rect.bottom-viewport.top+20);
  toolbar.style.left=left+'px';toolbar.style.top=Math.max(8,top)+'px';
}
function updateDraggedNodes() {
  selectedNodes().forEach(node=>{
    const element=[...$("nodes").children].find(el=>el.dataset.node===node.id);
    if(element){applyNodeStyles(element,node);if(node.type==='shape')element.firstElementChild.innerHTML=nodeBody(node);}
  });
  renderEdges();renderSelection();
}

function field(label,key,value,type='text',options=null,scope='node') {
  let input;
  const attr=`data-prop="${escapeHtml(key)}" data-scope="${scope}" aria-label="${escapeHtml(label)}"`;
  if(options)input=`<select ${attr}>${options.map(option=>{const [v,name]=Array.isArray(option)?option:[option,option];return`<option value="${escapeHtml(v)}" ${String(v)===String(value)?'selected':''}>${escapeHtml(name)}</option>`;}).join('')}</select>`;
  else if(type==='textarea')input=`<textarea ${attr}>${escapeHtml(value??'')}</textarea>`;
  else input=`<input ${attr} type="${type}" value="${escapeHtml(value??'')}" ${type==='number'?'step="any"':''}>`;
  return `<label class="field"><span>${escapeHtml(label)}</span>${input}</label>`;
}
function checkField(label,key,value,scope='node') {return `<label class="check-field"><input type="checkbox" data-prop="${key}" data-scope="${scope}" ${value?'checked':''}>${escapeHtml(label)}</label>`;}
const section=(title,content)=>StudioSidebarLayout.section(title,content);
const pair=(a,b)=>`<div class="two-fields">${a}${b}</div>`;
function animationFields(item,scope='node') {
  return section('出现与退场',field('出现步骤','stepId',item.stepId,'text',state.project.steps.map((s,i)=>[s.id,`${i+1}. ${s.name}`]),scope)+field('退场步骤','endStepId',item.endStepId||'','text',[['','不退场 · 继续显示'],...state.project.steps.map((s,i)=>[s.id,`${i+1}. ${s.name}`])],scope))+section('动效',field('进入效果','animation.type',item.animation.type,'text',[['none','无动效'],['fade','淡入'],['rise','向上抬升'],['scale','放大出现'],['pulse','点亮 / 脉冲'],['draw','描线（连线）'],['slide-left','从左滑入'],['slide-right','从右滑入'],['drop','从上落入'],['zoom-out','缩小落定']],scope)+pair(field('时长 / ms','animation.duration',item.animation.duration,'number',null,scope),field('延迟 / ms','animation.delay',item.animation.delay,'number',null,scope))+'<button data-command="preview-animation">预览选中动效</button><button data-open-motion>编排本步动效</button>');
}
function renderInspector() {
  const panel=$("properties"),kind=selectedGroup()?"group":selectedNodes().length>1?"multi":selectedNodes()[0]?.type||(state.edgeId?"edge":state.inspectorMode),scroll=panel.dataset.kind===kind?panel.scrollTop:0;
  renderInspectorContent();editorUI?.decorateInspector();panel.dataset.kind=kind;panel.scrollTop=scroll;
}
function renderInspectorContent() {
  const nodes=selectedNodes(),edge=selectedEdge();
  $("deselect").hidden=!nodes.length&&!edge&&state.inspectorMode!=="step";
  if(state.inspectorMode==='step'&&!nodes.length&&!edge){renderStepInspector();return;}
  if(edge) {
    $("inspector-heading").textContent='连线属性';
    $("properties").innerHTML=section('连线',field('标注文字','label',edge.label,'textarea',null,'edge')+field('路径','route',edge.route,'text',[['curve','曲线'],['elbow','折线'],['straight','直线']],'edge')+pair(field('颜色','color',edge.color,'color',null,'edge'),field('线宽','width',edge.width,'number',null,'edge'))+pair(field('标注字号','labelSize',edge.labelSize,'number',null,'edge'),field('起点','fromAnchor',edge.fromAnchor,'text',['top','right','bottom','left'],'edge'))+field('终点','toAnchor',edge.toAnchor,'text',['top','right','bottom','left'],'edge')+checkField('显示箭头','arrow',edge.arrow,'edge')+checkField('虚线','dash',edge.dash,'edge'))+animationFields(edge,'edge')+'<div class="property-buttons"><button data-command="delete" class="danger">删除连线</button></div>';
    if(edge.route!=='elbow')$("properties").insertAdjacentHTML('beforeend','<button data-command="reset-curve" title="拖动线条中间圆点可调整弯曲">恢复默认弯曲</button>');
    $("properties").insertAdjacentHTML('beforeend',section('图层操作','<div class="property-buttons"><button data-property-tool="focus">聚焦选中</button><button data-editor-action="hide">编辑时隐藏所选</button><button data-editor-action="show">编辑时显示所选</button><button data-editor-action="only">仅看所选</button><button data-editor-action="all">恢复全部可见</button></div>'));
    if(C.isFreeEdge(edge)) {
      return;
    }
    $("properties").insertAdjacentHTML('beforeend','<div class="property-buttons"><button data-command="insert-edge">在箭头中间插入组件</button></div>');
    const incoming=C.junctionEdges(state.project,edge.id);
    if(incoming.length>1)$("properties").insertAdjacentHTML('beforeend',`<button data-command="insert-junction">在汇合处插入组件（${incoming.length} 条）</button>`);
    return;
  }
  if(!nodes.length) {
    $("inspector-heading").textContent='画布设置';
    const canvas=state.project.canvas;
    $("properties").innerHTML=section('项目',field('名称','title',state.project.title,'text',null,'project'))+section('画布',field('背景','background',canvas.background,'color',null,'canvas')+checkField('显示网格','grid',canvas.grid,'canvas')+'<div class="property-buttons"><button data-command="canvas-fit-content">画布包住全部内容</button></div>');
    $("properties").insertAdjacentHTML('beforeend',section('图层操作','<button data-editor-action="all">恢复全部可见</button>'));
    return;
  }
  const node=nodes[0],box=C.bounds(nodes),group=selectedGroup();
  $("inspector-heading").textContent=nodes.length===1?node.name:`${nodes.length} 个组件`;
  let html=section('对象',group?field('组合名称','groupName',group.name):nodes.length===1?field('图层名称','name',node.name):'');
  html+=`<button class="selection-step-button" data-command="step-from-selection" title="在当前步骤后新建，并把所选组件移入新步骤">用所选 ${nodes.length} 个组件创建步骤</button>`;
  html+=section('外观与排列',(nodes.length===1?pair(field('旋转 / °','rotation',node.rotation,'number'),field('透明度 0–1','style.opacity',node.style.opacity,'number')):'')+'<div class="property-buttons"><button data-command="front">置顶</button><button data-command="back">置底</button><button data-command="duplicate">复制一份</button></div>');
  html+=section('格式与视野','<div class="property-buttons"><button data-property-tool="copyStyle">复制格式</button><button data-property-tool="pasteStyle">粘贴格式</button><button data-property-tool="focus">聚焦选中</button>'+(nodes.length>1?'<button data-property-tool="width">统一宽度</button><button data-property-tool="height">统一高度</button>':'')+'</div>');
  const overlapping=state.project.nodes.filter(n=>isVisible(n)&&n.x<box.x+box.w&&n.x+n.w>box.x&&n.y<box.y+box.h&&n.y+n.h>box.y);
  if(overlapping.length>1)html+=section('重叠对象','<div class="property-buttons">'+overlapping.map(n=>`<button data-property-select="${escapeHtml(n.id)}">${escapeHtml(n.name)}</button>`).join('')+'</div>');
  if(nodes.length===1)html+=section('组件对齐画布','<div class="property-buttons"><button data-command="align-left">居左</button><button data-command="align-center">水平居中</button><button data-command="align-right">居右</button></div>');
  if(nodes.length>1) {

    html+=section('共同外观',field('透明度 0–1','style.opacity',node.style.opacity,'number'));
    html+=section('对齐与组合','<div class="property-buttons">'+[['align-left','左对齐'],['align-center','水平居中'],['align-right','右对齐'],['align-top','顶对齐'],['align-middle','垂直居中'],['align-bottom','底对齐'],['distribute-x','水平分布'],['distribute-y','垂直分布'],['group','组合'],['ungroup','取消组合']].map(([cmd,label])=>`<button data-command="${cmd}">${label}</button>`).join('')+'</div>');
    if(nodes.every(n=>['text','button','table'].includes(n.type)))html+=section('批量排版',`<p class="hint">修改应用于全部 ${nodes.length} 项，差异显示为混合值</p>`+pair(field('字号','style.fontSize',node.style.fontSize,'number'),field('字重','style.fontWeight',node.style.fontWeight,'text',[[400,'常规'],[500,'中等'],[600,'半粗'],[700,'加粗']]))+field('字体','style.fontFamily',node.style.fontFamily,'text',['Microsoft YaHei','Inter','Consolas','Arial','Georgia','SimSun'])+field('文字颜色','style.color',node.style.color,'color')+'<div class="property-buttons"><button data-command="text-bold">切换加粗</button><button data-command="text-align-left">文字居左</button><button data-command="text-align-center">文字居中</button><button data-command="text-align-right">文字居右</button></div>');
  } else {
    if(['text','button'].includes(node.type))html+=section('文字',field('内容','text',node.text,'textarea')+'<button data-command="edit-text">在画布编辑</button>');
    if(['text','button','table'].includes(node.type))html+=section('排版',pair(field('字号','style.fontSize',node.style.fontSize,'number'),field('字重','style.fontWeight',node.style.fontWeight,'text',[[400,'常规'],[500,'中等'],[600,'半粗'],[700,'加粗']]))+field('字体','style.fontFamily',node.style.fontFamily,'text',['Microsoft YaHei','Inter','Consolas','Arial','Georgia','SimSun'])+pair(field('行高','style.lineHeight',node.style.lineHeight,'number'),field('对齐','style.align',node.style.align,'text',[['left','左对齐'],['center','居中'],['right','右对齐']]))+field('文字颜色','style.color',node.style.color,'color')+(node.type!=='table'?'<button data-command="fit-text">按文字调整高度</button>':''));
    if(node.type==='shape')html+=section('形状',field('形状','shape',node.shape,'text',[['rect','矩形'],['ellipse','椭圆'],['diamond','菱形']]));
    if(node.type==='icon')html+=section('图标',`<div class="icons-grid">${Object.keys(C.ICONS).map(key=>`<button data-icon="${key}" title="${C.ICON_NAMES[key]}" aria-label="${C.ICON_NAMES[key]}" class="${node.icon===key?'active':''}"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">${C.ICONS[key]}</svg></button>`).join('')}</div>`+pair(field('线条颜色','style.color',node.style.color,'color'),field('线条宽度','strokeWidth',node.strokeWidth,'number')));
    if(node.type==='image')html+=section('图片',`<button data-command="replace-image">替换图片 / 导入 SVG</button>`+field('适配方式','fit',node.fit,'text',[['contain','完整显示'],['cover','填满并裁切'],['fill','拉伸']])+pair(field('裁切水平位置 %','positionX',node.positionX,'number'),field('裁切垂直位置 %','positionY',node.positionY,'number'))+'<button data-command="image-ratio">恢复原图比例</button>');
    if(node.type==='table')html+=section('表格',field('单元格内容（Tab 分列，换行分行）','tableData',node.cells.map(row=>row.join('\t')).join('\n'),'textarea')+field('表头底色','headerFill',node.headerFill,'color')+'<div class="property-buttons"><button data-command="row-add">增加行</button><button data-command="row-remove">减少行</button><button data-command="column-add">增加列</button><button data-command="column-remove">减少列</button></div>');
    html+=section('外观',pair(field('背景填色','style.fill',node.style.fill==='transparent'?'#ffffff':node.style.fill,'color'),field('边框颜色','style.border',node.style.border,'color'))+checkField('背景透明','transparent',node.style.fill==='transparent')+pair(field('边框宽度','style.borderWidth',node.style.borderWidth,'number'),field('圆角','style.radius',node.style.radius,'number'))+pair(field('内边距','style.padding',node.style.padding,'number'),field('阴影强度','style.shadow',node.style.shadow,'number')));
    html+=section('点击交互（演示时）',field('点击后','action.type',node.action.type,'text',[['none','无操作'],['note','打开文字说明'],['image','放大图片'],['link','打开网页'],['step','跳到步骤'],['group','切换组合显示']])+actionValueField(node));
  }
  html+=animationFields(node);
  html+=section('图层操作',(nodes.length===1?checkField('锁定位置与尺寸','locked',node.locked)+checkField('正式演示中始终隐藏','hidden',node.hidden):'')+'<div class="property-buttons"><button data-editor-action="hide">编辑时隐藏所选</button><button data-editor-action="show">编辑时显示所选</button><button data-editor-action="only">仅看所选</button><button data-editor-action="all">恢复全部可见</button></div>');
  html+=section('导图','<div class="property-buttons"><button data-command="add-child">添加子节点</button><button data-command="layout-tree">整理子树</button></div>')+'<div class="property-buttons"><button data-command="delete" class="danger">删除组件</button></div>';
  $("properties").innerHTML=html;
  StudioSidebarLayout.arrangeProperties();
}
function actionValueField(node) {
  if(node.action.type==='none')return'';
  if(node.action.type==='step')return field('目标步骤','action.value',node.action.value,'text',state.project.steps.map(s=>[s.id,StudioStepNavigation.label(state.project,s.id)]));
  if(node.action.type==='group')return field('目标组合','action.value',node.action.value,'text',state.project.groups.map(g=>[g.id,g.name]));
  if(node.action.type==='image')return field('图片（留空使用组件自身图片）','action.value',node.action.value,'text',[['','当前图片'],...Object.entries(state.project.assets).map(([id,a])=>[id,a.name])]);
  return field(node.action.type==='link'?'网页地址（https://）':'说明内容','action.value',node.action.value,'textarea');
}
function renderStepInspector() {
  const step=currentStep();$("inspector-heading").textContent='演示步骤';
  $("properties").innerHTML=section('步骤',field('名称','name',step.name,'text',null,'step')+field('自动播放停留 / ms','duration',step.duration,'number',null,'step')+field('讲解备注','note',step.note,'textarea',null,'step'))+section('镜头设置',`<div class="camera-mode property-buttons"><button data-command="clear-camera" aria-pressed="${!step.camera}">自动取景</button><button data-command="record-camera" aria-pressed="${!!step.camera}">记录当前视角</button></div><p class="hint">${step.camera?'已记录镜头；再次点击可更新。':'演示时自动聚焦本步骤新出现的组件。'}</p>`)+section('快速查看','<button class="camera-peek" data-command="focus-step" title="仅移动编辑视野，不改变镜头设置">⌖ 聚焦本步组件</button>')+section('演示','<button class="primary step-present" data-command="present-step"><span aria-hidden="true">▶</span> 从本步演示</button>')+section('顺序','<div class="property-buttons"><button data-command="step-up">前移</button><button data-command="step-down">后移</button><button data-command="step-delete" class="danger">删除步骤</button></div>');
}
function renderLeft() {
  const oldScroll=$("left-content").scrollTop;
  document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===state.tab));
  if(state.tab==='add') {
    $("left-content").innerHTML='<p class="section-label">基础组件</p><div class="palette">'+[['text','T','文字'],['heading','H','标题'],['shape','▢','形状'],['icon','♧','图标'],['image','▧','图片'],['table','▦','表格'],['button','↗','按钮'],['connect','⌁','连线']].map(([kind,icon,label])=>`<button data-add="${kind}" ${kind==='connect'?`aria-pressed="${Boolean(state.connectionMode)}"`:""}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')+'</div>';
    $("left-content").insertAdjacentHTML('beforeend',`<section class="space-tool-panel"><button class="space-tool-button" data-command="space-tool" aria-pressed="${Boolean(state.spaceTool)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 9h18M3 15h18M12 2v4m-3-3 3 3 3-3M12 22v-4m-3 3 3-3 3 3"/></svg>插入空间</button>${state.spaceTool?`<div class="property-buttons"><button data-space-axis="y" aria-pressed="${state.spaceTool==='y'}">向下留空</button><button data-space-axis="x" aria-pressed="${state.spaceTool==='x'}">向右留空</button></div><p>在画布上拖出间距；橙色预览整体移动的组件。Esc 取消。</p>`:''}</section>`);
    if(componentLibrary)$("left-content").insertAdjacentHTML('beforeend',componentLibrary.markup());
  } else if(state.tab==='layers') {
    $("left-content").innerHTML=layerTools.markup();
  } else {
    $("left-content").innerHTML=`<div class="step-controls"><button data-command="step-from-selection" ${state.selected.size?'':'disabled'} title="在当前步骤后新建，并移入所选组件">用所选 ${state.selected.size} 个组件创建步骤</button></div>`+state.project.steps.map((step,i)=>`<div class="step-card ${step.id===state.activeStep?'active':''}" data-select-step="${step.id}" draggable="false" title="双击聚焦；拖动调整步骤顺序"><strong><span class="step-grip" aria-hidden="true">⠿</span>${i+1}. ${escapeHtml(step.name)}</strong><small>${state.project.nodes.filter(n=>n.stepId===step.id).length} 个组件 · ${step.duration/1000} 秒${step.camera?' · 已设镜头':''}</small><div class="step-actions"><button data-step-focus="${step.id}">聚焦</button><button data-step-play="${step.id}">播放</button></div></div><button class="step-insert" data-step-insert="${step.id}" title="在「${escapeHtml(step.name)}」之后插入空白步骤">＋ 在此下方插入步骤</button>`).join('')+'<button data-command="step-add">＋ 在末尾添加步骤</button>';
  }
  if(state.tab==='layers'){
    $("left-content").insertAdjacentHTML('afterbegin',`<div class="layer-controls"><button data-command="layer-multi" aria-pressed="${state.layerMulti}">☑ 多选</button><span>已选 ${state.selected.size}</span><button data-command="layer-all">全选</button><button data-command="layer-clear">清空</button><button data-layer-fold-all="close" title="折叠全部步骤" aria-label="折叠全部步骤">⊟</button><button data-layer-fold-all="open" title="展开全部步骤" aria-label="展开全部步骤">⊞</button></div>`);
    $("left-content").querySelectorAll('[data-partial="true"]').forEach(el=>el.indeterminate=true);
  }
  if(state.tab==='steps')$("left-content").querySelectorAll('[data-select-step]').forEach(el=>{
    const count=selectedNodes().filter(n=>n.stepId===el.dataset.selectStep).length;
    if(count)el.insertAdjacentHTML('beforeend',`<small class="step-selection">含 ${count} 个选中组件</small>`);
  });
  $("left-content").scrollTop=oldScroll;
  if(state.tab==='steps'&&editorTools){
    const controls=$("left-content").querySelector('.step-controls');
    controls.insertAdjacentHTML('afterbegin',editorTools.stepNavigation.markup('editor-step-number'));
    editorTools.stepNavigation.bind('editor-step-number',editorTools.stepNavigation.go);
  }
  editorTools?.decorateLeft();componentLibrary?.decorate();editorUI?.decorateLeft();$("left-content").scrollTop=oldScroll;
}
function renderAll() {
  updatePanMode();editorTools?.stepNavigation.syncPlayer();
  $("project-title").value=state.project.title;renderCanvas();renderLeft();renderInspector();updateHistoryButtons();updateView();
}

function setNested(object,path,value) {
  const keys=path.split('.');const last=keys.pop();
  const target=keys.reduce((current,key)=>current[key],object);target[last]=value;
}
function getNested(object,path) {return path.split('.').reduce((current,key)=>current?.[key],object);}
function resizeNodes(nodes,oldBox,newBox) {
  const sx=newBox.w/oldBox.w,sy=newBox.h/oldBox.h;
  nodes.forEach(node=>{
    if(node.locked)return;
    node.x=newBox.x+(node.x-oldBox.x)*sx;node.y=newBox.y+(node.y-oldBox.y)*sy;
    node.w=Math.max(5,node.w*sx);node.h=Math.max(5,node.h*sy);
    if(nodes.length>1&&['text','button','table'].includes(node.type))node.style.fontSize=Math.max(4,node.style.fontSize*Math.min(sx,sy));
  });
}
function applyProperty(input,live=false) {
  const key=input.dataset.prop,scope=input.dataset.scope;
  let value=input.type==='checkbox'?input.checked:input.value;
  const nodes=selectedNodes(),edge=selectedEdge();
  const target=scope==='canvas'?state.project.canvas:scope==='project'?state.project:scope==='step'?currentStep():scope==='edge'?edge:nodes[0];
  if(!target)return;
  const old=getNested(target,key);
  if(input.type==='number'||typeof old==='number') {
    if(value===''||!Number.isFinite(Number(value))){if(!live)renderInspector();return;}
    value=Number(value);
  }
  const before=C.copy(state.project);
  try {
    if(scope==='canvas'||scope==='project'||scope==='step'||scope==='edge')setNested(target,key,value);
    else if(key==='groupName'){const group=selectedGroup();if(group)group.name=value;}
    else if(key==='transparent')nodes.forEach(n=>n.style.fill=value?'transparent':'#ffffff');
    else if(key==='tableData') {
      const rows=value.replace(/\r/g,'').split('\n').map(row=>row.split('\t'));
      const columns=Math.max(...rows.map(row=>row.length));
      target.cells=rows.map(row=>[...row,...Array(columns-row.length).fill('')]);
    } else if(['x','y','w','h'].includes(key)&&nodes.length>1) {
      const box=C.bounds(nodes);const next={...box,[key]:value};
      if(next.w<5||next.h<5)throw new Error('尺寸必须大于 5');
      resizeNodes(nodes,box,next);
    } else {
      nodes.forEach(node=>{
        if(node.locked&&['x','y','w','h','rotation'].includes(key))return;
        setNested(node,key,value);
        if(key==='action.type') {
          node.action.value=value==='step'?state.project.steps[0].id:value==='group'?state.project.groups[0]?.id||'':'';
        }
      });
    }
    C.validate(state.project);
    // A focused text field is one undoable edit, not one undo entry per key.
    if(JSON.stringify(before)===JSON.stringify(state.project)){if(!live)state.liveProperty=null;return;}
    if(!live||state.liveProperty!==input)recordChange(before);
    else {state.redo=[];scheduleSave();updateHistoryButtons();}
    state.liveProperty=live?input:null;
    renderCanvas();renderLeft();
    if(key==='stepId'){syncSelectionNavigation();renderLeft();revealLeftSelection();}
    if(!live&&['action.type','icon','shape','tableData','transparent','locked','route'].includes(key))renderInspector();
    if(key==='title')$("project-title").value=state.project.title;
  } catch(error) {state.project=before;if(!live||input.type!=='number')toast(error.message);if(!live)renderInspector();}
}

function addComponent(kind,point=null) {
  if(state.playing)return;
  stopSpaceTool();
  if(kind==='connect') {
    if(state.connectionMode){cancelConnect();return;}
    if(state.finishTextEdit)state.finishTextEdit();
    state.connectFrom=null;state.panMode=false;state.canvasEditing=false;updatePanMode();renderCanvasFrame();setSelection([]);
    state.connectionMode=true;$("viewport").classList.add('connecting');renderLeft();
    updateStatus('拖拽自由画线（可覆盖图片）；依次点击两个组件可连接组件。Esc 退出');return;
  }
  cancelConnect();
  if(kind==='image'){state.uploadTarget=null;$("image-upload").click();return;}
  const center=point||viewportCenter();const position={x:Math.max(0,center.x-150),y:Math.max(0,center.y-80)};
  let ids=[];
  change(()=>{
    if(['card','question','idea'].includes(kind)) {
      const x=position.x,y=position.y,stage=state.activeStep;
      const elements=[];
      if(kind!=='idea') {
        const background=C.node('shape',x,y,stage);background.w=kind==='question'?620:390;background.h=kind==='question'?185:245;background.style.fill='#fffefb';background.name='卡片背景';elements.push(background);
      }
      const icon=C.node('icon',x+22,y+22,stage);icon.w=60;icon.h=60;icon.icon=kind==='question'?'question':'bulb';icon.name='可编辑图标';elements.push(icon);
      const title=C.node('text',x+(kind==='question'?110:22),y+(kind==='question'?24:100),stage,{text:kind==='question'?'在这里提出问题':'在这里写标题'});
      title.w=kind==='question'?470:340;title.h=55;title.style.fontSize=30;title.style.fontWeight=600;title.name='标题';elements.push(title);
      const body=C.node('text',title.x,title.y+65,stage,{text:'这行小字也是独立组件，可以修改字体、颜色、位置和动效。'});
      body.w=title.w;body.h=85;body.style.fontSize=20;body.style.color='#82909d';body.name='说明小字';elements.push(body);
      state.project.nodes.push(...elements);ids=elements.map(n=>n.id);C.group(state.project,ids,kind==='question'?'问题卡片':kind==='idea'?'灯泡创新点':'说明卡片');
    } else {
      const type=kind==='heading'?'text':kind;
      const n=C.node(type,position.x,position.y,state.activeStep);
      if(kind==='heading'){n.text='新的标题';n.name='标题';n.w=480;n.h=85;n.style.fontSize=42;n.style.fontWeight=650;}
      state.project.nodes.push(n);ids=[n.id];
    }
    growCanvas();
  });
  setSelection(ids);
}
function growCanvas(base=state.project.canvas) {
  state.project.canvas=C.expandCanvas(base,C.contentNodes(state.project));
}
function toggleSpaceTool(axis='y') {
  focusCanvas();cancelConnect();state.spaceTool=state.spaceTool===axis?null:axis;
  state.panMode=false;state.canvasEditing=false;setSelection([]);updatePanMode();renderCanvasFrame();renderLeft();
  $("viewport").classList.toggle('spacing',Boolean(state.spaceTool));clearSpacePreview();
  $("viewport").dataset.spaceAxis=axis;
  if(state.spaceTool)toast(axis==='y'?'在需要留空的位置向下拖动；橙色组件将整体下移，Esc 取消。':'在需要留空的位置向右拖动；橙色组件将整体右移，Esc 取消。');
}
function stopSpaceTool() {
  if(!state.spaceTool)return;
  state.spaceTool=null;clearSpacePreview();$("viewport").classList.remove('spacing');renderLeft();
}
function clearSpacePreview() {
  spaceGuide.hidden=true;$("nodes").querySelectorAll('.space-affected').forEach(el=>el.classList.remove('space-affected'));
}
function spacePreview(axis,cut,amount,plan) {
  const vertical=axis==='y',position=(vertical?state.view.y:state.view.x)+cut*state.view.zoom;
  const extent=amount*state.view.zoom;spaceGuide.hidden=false;spaceGuide.className=vertical?'horizontal':'vertical';
  Object.assign(spaceGuide.style,{left:vertical?'0':position+'px',top:vertical?position+'px':'0',width:vertical?'100%':extent+'px',height:vertical?extent+'px':'100%'});
  spaceGuide.querySelector('span').textContent=plan.locked.length?'含锁定组件：请先解锁':`插入 ${Math.round(amount)} px · 整体移动 ${plan.ids.length} 个组件`;
  const affected=new Set(plan.ids);
  for(const el of $("nodes").children)el.classList.toggle('space-affected',affected.has(el.dataset.node));
}
function insertionNode() {
  const nodes=selectedNodes();
  if(!nodes.length||nodes.some(n=>n.locked))return null;
  if(nodes.length===1)return nodes[0];
  if(!selectedGroup())return null;
  return [...nodes].sort((a,b)=>(b.type==='shape'?1:0)-(a.type==='shape'?1:0)||b.w*b.h-a.w*a.h)[0];
}
function clearEdgeDrop() {
  state.dropEdgeId=null;state.dropJunctionIds=[];dropHint.hidden=true;
  $("world").querySelectorAll('.edge-drop-target').forEach(el=>el.classList.remove('edge-drop-target'));
}
function previewEdgeDrop(event) {
  clearEdgeDrop();if(event.altKey)return;
  const node=insertionNode();if(!node)return;
  const point=worldPoint(event.clientX,event.clientY),box=C.visualBounds(selectedNodes()),center={x:box.x+box.w/2,y:box.y+box.h/2},limit=14/state.view.zoom;
  let nearest=limit,best=null;
  for(const el of $("world").querySelectorAll('[data-edge]')) {
    const edge=state.project.edges.find(e=>e.id===el.dataset.edge);
    if(C.edgeNodeIds(edge).some(id=>state.selected.has(id)))continue;
    if(state.project.edges.some(e=>e.id!==edge.id&&(e.from===edge.from&&e.to===node.id||e.from===node.id&&e.to===edge.to)))continue;
    const path=el.querySelector('.edge-line'),length=path.getTotalLength();
    const samples=Math.max(2,Math.min(2000,Math.ceil(length*state.view.zoom/6)));
    for(let i=0;i<=samples;i++) {
      const p=path.getPointAtLength(length*i/samples),distance=Math.min(Math.hypot(p.x-point.x,p.y-point.y),Math.hypot(p.x-center.x,p.y-center.y));
      if(distance<nearest){nearest=distance;best=edge;}
    }
  }
  if(!best)return;
  state.dropEdgeId=best.id;
  const el=[...$("world").querySelectorAll("[data-edge]")].find(el=>el.dataset.edge===best.id);el?.classList.add('edge-drop-target');
  dropHint.textContent=`松开插入：${findNode(best.from)?.name||'线条起点'} → ${selectedGroup()?.name||node.name} → ${findNode(best.to)?.name||'线条终点'}（Alt 跳过）`;
  const endpoint=C.edgePoints(best,state.project.nodes)[1],incoming=C.junctionEdges(state.project,best.id);
  if(incoming.length>1&&Math.hypot(point.x-endpoint.x,point.y-endpoint.y)*state.view.zoom<32&&incoming.every(e=>!state.selected.has(e.from)&&!state.selected.has(e.to))){
    try{
      C.spliceJunction(C.copy(state.project),incoming.map(e=>e.id),node.id);
      state.dropJunctionIds=incoming.map(e=>e.id);
      $("edges").querySelectorAll('[data-edge]').forEach(el=>el.classList.toggle('edge-drop-target',state.dropJunctionIds.includes(el.dataset.edge)));
      dropHint.textContent=`松开接入 ${incoming.length} 条汇合箭头 → ${selectedGroup()?.name||node.name} → ${findNode(best.to)?.name||'线条终点'}（Alt 跳过）`;
    }catch{}
  }
  const rect=$("viewport").getBoundingClientRect();dropHint.hidden=false;
  dropHint.style.left=Math.max(8,Math.min(rect.width-dropHint.offsetWidth-8,event.clientX-rect.left+18))+'px';
  dropHint.style.top=Math.max(8,event.clientY-rect.top-44)+'px';
}
function showInsertEdge(junction=false) {
  const edge=selectedEdge();if(!edge)return;state.insertEdgeId=edge.id;
  openDialog('在箭头中间插入组件',`<p>${escapeHtml(findNode(edge.from).name)} → 新组件 → ${escapeHtml(findNode(edge.to).name)}</p><label class="field"><span>新组件类型</span><select id="insert-edge-kind"><option value="text">文字卡片</option><option value="shape">形状</option><option value="icon">图标</option><option value="table">表格</option><option value="button">按钮</option></select></label><button id="insert-edge-new" class="primary">在箭头中间新建</button><label class="field"><span>或接入已有组件（保留当前位置）</span><select id="insert-edge-existing">${state.project.nodes.filter(n=>![edge.from,edge.to].includes(n.id)).map(n=>`<option value="${escapeHtml(n.id)}">${escapeHtml(n.name)}</option>`).join('')}</select></label><button id="insert-edge-use">接入已有组件</button><p class="hint">也可直接把组件拖到箭头上，出现绿色高亮后松开。空间不足时，先使用左侧“插入空间”。</p>`);
  const incoming=C.junctionEdges(state.project,edge.id);
  if(incoming.length>1)$("insert-edge-kind").closest('label').insertAdjacentHTML('beforebegin',`<label class="junction-option"><input type="checkbox" id="insert-junction" ${junction?'checked':''}>同时接入汇向「${escapeHtml(findNode(edge.to).name)}」的 ${incoming.length} 条箭头</label><p class="hint">保留每条入线的样式与标注，新组件到原终点只增加一条出线。</p>`);
  updateInsertOptions();
  $("insert-junction")?.addEventListener('change',updateInsertOptions);
}
function updateInsertOptions(){
  const edge=state.project.edges.find(e=>e.id===state.insertEdgeId),junction=Boolean($("insert-junction")?.checked);
  const lines=junction?C.junctionEdges(state.project,edge.id):[edge];
  $("dialog-title").textContent=junction?'在多箭头汇合处插入组件':'在箭头中间插入组件';
  $("dialog-content").querySelector('p').textContent=junction?`${lines.length} 条入线 → 新组件 → ${findNode(edge.to).name}`:`${findNode(edge.from).name} → 新组件 → ${findNode(edge.to).name}`;
  $("insert-edge-new").textContent=junction?'在汇合处新建':'在箭头中间新建';
  const select=$("insert-edge-existing");
  [...select.options].forEach(option=>{option.disabled=lines.some(e=>e.from===option.value||e.to===option.value);});
  if(select.selectedOptions[0]?.disabled)select.value=[...select.options].find(o=>!o.disabled)?.value||'';
  $("insert-edge-use").disabled=![...select.options].some(o=>!o.disabled);
}
function insertIntoEdge(create) {
  const edge=state.project.edges.find(e=>e.id===state.insertEdgeId);if(!edge)return;
  const before=C.copy(state.project),junction=Boolean($("insert-junction")?.checked),incoming=C.junctionEdges(state.project,edge.id);let node;
  try {
    if(create) {
      const path=[...$("edges").querySelectorAll('[data-edge]')].find(el=>el.dataset.edge===edge.id)?.querySelector('.edge-line');
      const a=C.anchor(findNode(edge.from),edge.fromAnchor),b=C.anchor(findNode(edge.to),edge.toAnchor);
      const p=path?path.getPointAtLength(path.getTotalLength()/2):{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      node=C.node($("insert-edge-kind").value,0,0,edge.stepId);
      if(node.type==='text'){node.text='新节点';node.name='新节点';node.w=240;node.h=100;Object.assign(node.style,{fill:'#ffffff',borderWidth:1,align:'center',padding:18});}
      if(junction){const vectors={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]},v=vectors[edge.toAnchor];p.x=b.x+v[0]*(node.w/2+70);p.y=b.y+v[1]*(node.h/2+70);}
      node.x=p.x-node.w/2;node.y=p.y-node.h/2;state.project.nodes.push(node);
    }else node=findNode($("insert-edge-existing").value);
    if(junction)C.spliceJunction(state.project,incoming.map(e=>e.id),node?.id);else C.splitEdge(state.project,edge.id,node?.id);
    growCanvas();C.validate(state.project);recordChange(before);
    $("dialog").close();renderAll();setSelection([node.id]);toast(junction?`已接入 ${incoming.length} 条汇合箭头，可一次撤销。`:'已将一条连线拆为两条，可一次撤销。');
  }catch(error){state.project=before;toast(error.message);}
}
function addChild(sibling=false) {
  const selected=selectedNodes();
  if(selected.length!==1){toast('先选择一个组件，再添加子节点。');return;}
  const original=selected[0];const parent=sibling&&original.parentId?findNode(original.parentId):original;
  const siblings=state.project.nodes.filter(n=>n.parentId===parent.id);
  const child=C.node('text',parent.x+parent.w+110,parent.y+siblings.length*120,state.activeStep,{text:'新分支',name:'新分支'});
  child.w=240;child.h=80;child.parentId=parent.id;
  Object.assign(child.style,{fill:'#ffffff',borderWidth:1,padding:15,fontSize:24,radius:10});
  change(()=>{state.project.nodes.push(child);state.project.edges.push(C.edge(parent.id,child.id,child.stepId,{fromAnchor:'right',toAnchor:'left'}));growCanvas();});
  setSelection([child.id]);fitBounds(C.bounds([parent,child]),true);
}
function layoutTree() {
  const nodes=selectedNodes();if(nodes.length!==1){toast('选择一个父节点后整理子树。');return;}
  const root=nodes[0];
  const children=id=>state.project.nodes.filter(n=>n.parentId===id);
  if(!children(root.id).length){toast('该节点还没有子分支，可按 Tab 添加。');return;}
  change(()=>{
    let cursor=root.y;
    function place(node,x) {
      const descendants=children(node.id);node.x=x;
      if(!descendants.length){node.y=cursor;cursor+=node.h+55;return;}
      descendants.forEach(child=>place(child,x+node.w+120));
      node.y=(descendants[0].y+descendants.at(-1).y+descendants.at(-1).h-node.h)/2;
    }
    place(root,root.x);growCanvas();
  });
}
function alignSelected(command) {
  const all=selectedNodes(),group=selectedGroup();
  if(group&&all.some(n=>n.locked)){toast('组合中有锁定组件，请先解锁再整组对齐。');return;}
  const nodes=all.filter(n=>!n.locked);if(!nodes.length)return;
  const box=C.bounds(nodes);
  change(()=>{
    if(command.startsWith('distribute')) {
      if(nodes.length<3)return;
      const horizontal=command.endsWith('x'),key=horizontal?'x':'y',size=horizontal?'w':'h';
      nodes.sort((a,b)=>a[key]-b[key]);
      const gap=(nodes.at(-1)[key]+nodes.at(-1)[size]-nodes[0][key]-nodes.reduce((sum,n)=>sum+n[size],0))/(nodes.length-1);
      let cursor=nodes[0][key];nodes.forEach(n=>{n[key]=cursor;cursor+=n[size]+gap;});
    } else if(group||nodes.length===1) {
      const canvas=state.project.canvas;
      let dx=0,dy=0;
      if(command==='align-left')dx=(canvas.x??0)-box.x;
      if(command==='align-center')dx=(canvas.x??0)+(canvas.width-box.w)/2-box.x;
      if(command==='align-right')dx=(canvas.x??0)+canvas.width-box.w-box.x;
      if(command==='align-top')dy=(canvas.y??0)-box.y;
      if(command==='align-middle')dy=(canvas.y??0)+(canvas.height-box.h)/2-box.y;
      if(command==='align-bottom')dy=(canvas.y??0)+canvas.height-box.h-box.y;
      nodes.forEach(n=>{n.x+=dx;n.y+=dy;});
    } else nodes.forEach(n=>{
      if(command==='align-left')n.x=box.x;
      if(command==='align-center')n.x=box.x+(box.w-n.w)/2;
      if(command==='align-right')n.x=box.x+box.w-n.w;
      if(command==='align-top')n.y=box.y;
      if(command==='align-middle')n.y=box.y+(box.h-n.h)/2;
      if(command==='align-bottom')n.y=box.y+box.h-n.h;
    });
  });
}
function fitText() {
  const nodes=selectedNodes();
  change(()=>nodes.forEach(n=>{
    if(!['text','button'].includes(n.type))return;
    const el=[...$("nodes").children].find(element=>element.dataset.node===n.id)?.firstElementChild;
    if(el){el.style.height='auto';n.h=Math.max(n.style.fontSize*n.style.lineHeight+n.style.padding*2,el.scrollHeight-2*Number(el.dataset.editGutter||0)+2);}
  }));
}
function command(name) {
  const nodes=selectedNodes(),one=nodes[0],group=selectedGroup();
  if(name.startsWith('align-')||name.startsWith('distribute-')){alignSelected(name);return;}
  if(name.startsWith('text-align-')){change(()=>nodes.filter(n=>['text','button','table'].includes(n.type)).forEach(n=>n.style.align=name.slice(11)));return;}
  switch(name) {
    case 'reset-curve':change(()=>{if(selectedEdge())delete selectedEdge().curveOffset;});break;
    case 'text-bold':{
      const textNodes=nodes.filter(n=>['text','button','table'].includes(n.type));
      if(!textNodes.length)return;
      const weight=textNodes.every(n=>n.style.fontWeight>=600)?400:700;
      change(()=>textNodes.forEach(n=>n.style.fontWeight=weight));break;
    }
    case 'space-tool':toggleSpaceTool(state.spaceTool||'y');break;
    case 'insert-edge':showInsertEdge();break;
    case 'insert-junction':showInsertEdge(true);break;
    case 'layer-multi':state.layerMulti=!state.layerMulti;renderLeft();break;
    case 'layer-all':setSelection(state.project.nodes.map(n=>n.id),null,{reveal:false});break;
    case 'layer-clear':setSelection([],null,{reveal:false});break;
    case 'delete':change(()=>C.remove(state.project,[...state.selected,...(state.edgeId?[state.edgeId]:[])]));setSelection([]);break;
    case 'duplicate':{
      if(selectedEdge()&&C.isFreeEdge(selectedEdge())){const clipboard=state.clipboard;state.clipboard={freeLine:C.detachedEdge(selectedEdge(),state.project.nodes)};pasteSelected();state.clipboard=clipboard;break;}
      let ids=[];change(()=>{ids=C.duplicate(state.project,[...state.selected]);growCanvas();});setSelection(ids);break;
    }
    case 'group':change(()=>C.group(state.project,[...state.selected]));break;
    case 'ungroup':change(()=>C.ungroup(state.project,[...state.selected]));break;
    case 'front':change(()=>{state.project.nodes=[...state.project.nodes.filter(n=>!state.selected.has(n.id)),...nodes];});break;
    case 'back':change(()=>{state.project.nodes=[...nodes,...state.project.nodes.filter(n=>!state.selected.has(n.id))];});break;
    case 'add-child':addChild();break;
    case 'layout-tree':layoutTree();break;
    case 'fit-text':fitText();break;
    case 'edit-text':editSelectedText();break;

    case 'canvas-fit-content': {
      if(!state.project.nodes.length)return;
      const box=C.bounds(C.contentNodes(state.project));
      change(()=>Object.assign(state.project.canvas,{x:box.x-100,y:box.y-100,width:Math.min(50000,Math.max(100,box.w+200)),height:Math.min(50000,Math.max(100,box.h+200))}));
      state.canvasEditing=true;fitBounds(C.canvasBounds(state.project.canvas),true);break;
    }
    case 'replace-image':if(one){state.uploadTarget=one.id;$("image-upload").click();}break;
    case 'image-ratio':if(one&&state.project.assets[one.assetId])change(()=>{const a=state.project.assets[one.assetId];one.h=one.w*a.height/a.width;one.fit='contain';});break;
    case 'row-add':if(one?.type==='table')change(()=>{one.cells.push(Array(one.cells[0].length).fill(''));one.h+=50;});break;
    case 'row-remove':if(one?.type==='table'&&one.cells.length>1)change(()=>{one.cells.pop();one.h=Math.max(40,one.h-50);});break;
    case 'column-add':if(one?.type==='table')change(()=>one.cells.forEach(row=>row.push('')));break;
    case 'column-remove':if(one?.type==='table'&&one.cells[0].length>1)change(()=>one.cells.forEach(row=>row.pop()));break;
    case 'preview-animation':{
      state.motionDelays=null;const ids=new Set([...state.selected,...(state.edgeId?[state.edgeId]:[])]);renderCanvas(ids);break;
    }
    case 'step-add':createStep(state.project.steps.at(-1).id);break;
    case 'step-from-selection':if(state.selected.size)createStep(state.activeStep,[...state.selected]);break;
    case 'step-up':moveStep(-1);break;
    case 'step-down':moveStep(1);break;
    case 'step-delete':change(()=>C.deleteStep(state.project,state.activeStep));state.activeStep=state.project.steps[0].id;renderLeft();renderInspector();break;
    case 'record-camera':change(()=>{const center=viewportCenter();currentStep().camera={cx:center.x,cy:center.y,zoom:state.view.zoom};});toast('当前视角已记录到此步骤。');break;
    case 'clear-camera':change(()=>currentStep().camera=null);break;
    case 'focus-step':focusStep(state.activeStep);break;
    case 'present-step':enterPresentation(stepIndex(state.activeStep));break;

    case 'import-project':requestImport();break;
  }
}
function moveStep(offset) {
  const index=stepIndex(state.activeStep),next=index+offset;
  if(next<0||next>=state.project.steps.length)return;
  change(()=>C.reorderStep(state.project,state.activeStep,offset<0?state.project.steps[next].id:state.project.steps[next+1]?.id||null));revealLeftSelection();
}
function focusStep(id) {
  const nodes=state.project.nodes.filter(n=>n.stepId===id&&!n.hidden);
  if(nodes.length)fitBounds(C.bounds(nodes),true);
}

function startTextEdit(node,element,cell=null,point=null) {
  if(node.locked||state.playing)return;
  const before=C.copy(state.project);let done=false;
  state.editingText=true;
  state.finishTextEdit=finish;
  element.setAttribute('contenteditable','plaintext-only');element.focus();
  const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
  if(point) {
    const caret=document.caretPositionFromPoint?.(point.x,point.y);
    const caretRange=caret?null:document.caretRangeFromPoint?.(point.x,point.y);
    const anchor=caret?.offsetNode||caretRange?.startContainer;
    if(anchor&&element.contains(anchor)){range.setStart(anchor,caret?.offset??caretRange.startOffset);range.collapse(true);}
    else range.collapse(false);
    selection.removeAllRanges();selection.addRange(range);
  }
  function finish(cancel=false) {
    if(done)return;done=true;state.editingText=false;state.finishTextEdit=null;
    if(!cancel) {
      if(cell)node.cells[cell.row][cell.col]=element.innerText;
      else {
        node.text=element.innerText;
        if(element.scrollHeight>element.clientHeight)node.h=Math.max(node.h,element.scrollHeight-2*Number(element.dataset.editGutter||0)+node.style.borderWidth*2);
      }
      recordChange(before);
    }
    element.removeAttribute('contenteditable');renderCanvas();renderInspector();renderLeft();
  }
  element.addEventListener('blur',()=>finish(),{once:true});
  element.addEventListener('keydown',event=>{
    if(state.home||event.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true);focusCanvas();}
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();event.stopPropagation();finish();focusCanvas();}
  });
  updateStatus('文字编辑中 · Ctrl+A 选择当前文字 · Esc 取消并返回选择 · Ctrl+Enter 完成');
}

function focusCanvas() {
  if(state.finishTextEdit)state.finishTextEdit();
  $("viewport").focus({preventScroll:true});
  window.getSelection()?.removeAllRanges();
}
function selectAllComponents() {
  if(state.playing||$("dialog").open)return;
  focusCanvas();
  setSelection(state.project.nodes.filter(isVisible).map(node=>node.id));
}
function editSelectedText() {
  const nodes=selectedNodes();
  if(nodes.length!==1||!['text','button','table'].includes(nodes[0].type))return;
  const node=nodes[0];
  if(!isVisible(node)){toast('该组件在编辑画布中隐藏，请先显示它。');return;}
  fitBounds(C.bounds([node]));
  const element=[...$("nodes").children].find(el=>el.dataset.node===node.id);
  if(node.type==='table') {
    const cell=state.focusedCell?.id===node.id?state.focusedCell:{row:0,col:0};
    const td=element.querySelector(`td[data-row="${cell.row}"][data-col="${cell.col}"]`);
    startTextEdit(node,td||element.querySelector('td'),td?cell:{row:0,col:0});
  }
  else startTextEdit(node,element.firstElementChild);
}

function onPointerDown(event) {
  state.clickToEdit=null;
  state.suppressCanvasClick=false;
  if(event.button===2||event.target.closest('#canvas-tools,#horizontal-navigation,#text-toolbar,#empty-hint'))return;
  if(event.target.closest('[contenteditable]'))return;
  const port=event.target.closest('[data-port]'),handle=event.target.closest('[data-resize]'),canvasHandle=event.target.closest('[data-canvas-resize]');
  const nodeElement=event.target.closest('[data-node]'),edgeElement=event.target.closest('[data-edge]');
  const point=worldPoint(event.clientX,event.clientY);
  // Drawing takes priority over panning, selection, handles and image actions.
  if(state.connectionMode&&!state.playing&&event.button===0&&!state.space) {
    focusCanvas();state.pointer={kind:'draw-line',point,clientX:event.clientX,clientY:event.clientY,nodeId:nodeElement?.dataset.node,moved:false};
    $("viewport").setPointerCapture(event.pointerId);event.preventDefault();return;
  }
  const lineEnd=event.target.closest('[data-line-end]');
  const curveHandle=event.target.closest('[data-curve-handle]');
  if(curveHandle&&!state.playing&&!state.space&&!state.panMode&&event.button===0) {
    focusCanvas();state.pointer={kind:'curve-bend',point,middle:C.edgeMidpoint(selectedEdge(),state.project.nodes),before:C.copy(state.project)};
    $("viewport").setPointerCapture(event.pointerId);event.preventDefault();return;
  }
  if(lineEnd&&!state.playing&&!state.space&&event.button===0) {
    focusCanvas();state.pointer={kind:'free-endpoint',key:lineEnd.dataset.lineEnd,point,before:C.copy(state.project),original:C.detachedEdge(selectedEdge(),state.project.nodes)};
    $("viewport").setPointerCapture(event.pointerId);event.preventDefault();return;
  }
  if(state.spaceTool&&!state.playing&&event.button===0&&!state.space) {
    focusCanvas();const axis=state.spaceTool,cut=point[axis],plan=C.spacePlan(state.project,axis,cut);
    if(plan.locked.length){spacePreview(axis,cut,0,plan);toast('受影响的组件含有锁定对象，请先解锁。');return;}
    state.pointer={kind:'space-insert',point,axis,cut,plan,amount:0,before:C.copy(state.project)};
    $("viewport").setPointerCapture(event.pointerId);event.preventDefault();return;
  }
  const blank=!nodeElement&&!edgeElement&&!port&&!handle&&!canvasHandle;
  const wantsPan=state.space||event.button===1||state.overview||(!state.playing&&state.panMode)||(blank&&!event.shiftKey);
  if(state.playing&&!wantsPan)return;
  // preventDefault below would otherwise leave a sidebar input focused.
  focusCanvas();
  if(wantsPan) {
    if(blank&&!state.playing&&!event.shiftKey)setSelection([]);
    state.pointer={kind:'pan',clientX:event.clientX,clientY:event.clientY,view:{...state.view},moved:false};
    $("viewport").classList.add('panning');
  } else if(canvasHandle) {
    setSelection([]);
    state.pointer={kind:'canvas-resize',point,handle:canvasHandle.dataset.canvasResize,before:C.copy(state.project),canvas:C.copy(state.project.canvas)};
  } else if(port&&state.selected.size===1) {
    state.pointer={kind:'connect',from:[...state.selected][0],anchor:port.dataset.port};
  } else if(handle) {
    state.pointer={kind:'resize',point,handle:handle.dataset.resize,before:C.copy(state.project),box:C.bounds(selectedNodes().filter(isVisible)),originals:C.copy(selectedNodes().filter(isVisible))};
  } else if(nodeElement) {
    const node=findNode(nodeElement.dataset.node);
    const alreadySingle=state.selected.size===1&&state.selected.has(node.id);
    const clickGroup=state.project.groups.find(g=>g.nodeIds.includes(node.id));
    const unit=clickGroup&&!event.altKey&&!alreadySingle?clickGroup.nodeIds.filter(id=>isVisible(findNode(id))):[node.id];
    const cell=event.target.closest('td');
    if(cell)state.focusedCell={id:node.id,row:Number(cell.dataset.row),col:Number(cell.dataset.col)};
    if(state.connectionMode) {
      if(!state.connectFrom){state.connectFrom={id:node.id,anchor:'bottom'};updateStatus('再点击一个组件作为连线终点');}
      else if(state.connectFrom.id!==node.id){const from=state.connectFrom;change(()=>state.project.edges.push(C.edge(from.id,node.id,node.stepId,{fromAnchor:from.anchor})));cancelConnect();}
      return;
    }
    if(event.shiftKey||event.ctrlKey||event.metaKey) {
      const ids=new Set(state.selected),remove=unit.every(id=>ids.has(id));
      unit.forEach(id=>remove?ids.delete(id):ids.add(id));setSelection([...ids]);
    } else if(!state.selected.has(node.id)) {
      setSelection(unit);
    }
    const clickSelection=event.shiftKey||event.ctrlKey||event.metaKey?null:unit;
    const editCandidate=alreadySingle&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&['text','button','table'].includes(node.type)?node.id:null;
    state.pointer={kind:'move',point,before:C.copy(state.project),originals:C.copy(selectedNodes().filter(isVisible)),moved:false,clickSelection,editCandidate};
  } else if(edgeElement) {
    setSelection([],edgeElement.dataset.edge);renderEdges();
    const line=selectedEdge(),middle=C.edgeMidpoint(line,state.project.nodes);
    if(line.route!=='elbow'&&Math.hypot(point.x-middle.x,point.y-middle.y)*state.view.zoom<24)state.pointer={kind:'curve-bend',point,middle,before:C.copy(state.project)};
    else if(C.isFreeEdge(line))state.pointer={kind:'free-move',point,before:C.copy(state.project),original:C.detachedEdge(line,state.project.nodes)};
    else return;
  }
  else {
    if(!event.shiftKey)setSelection([]);
    state.pointer={kind:'marquee',point,base:new Set(state.selected)};
    $("marquee").hidden=false;
  }
  if(state.pointer){
    event.preventDefault();
    if(state.pointer.kind!=='move')$("viewport").setPointerCapture(event.pointerId);
  }
}
function onPointerMove(event) {
  const pointer=state.pointer;
  if(!pointer){
    if(state.spaceTool&&!state.playing&&!event.target.closest('#canvas-tools,#horizontal-navigation,#text-toolbar,#empty-hint')){
      const cut=worldPoint(event.clientX,event.clientY)[state.spaceTool];spacePreview(state.spaceTool,cut,0,C.spacePlan(state.project,state.spaceTool,cut));
    }
    return;
  }
  const point=worldPoint(event.clientX,event.clientY);
  if(pointer.kind==='curve-bend') {
    const dx=point.x-pointer.point.x,dy=point.y-pointer.point.y;
    if(Math.hypot(dx,dy)*state.view.zoom<2)return;
    C.bendEdgeTo(selectedEdge(),state.project.nodes,{x:pointer.middle.x+dx,y:pointer.middle.y+dy});
    growCanvas(pointer.before.canvas);renderPaper();renderEdges();renderSelection();return;
  }
  if(pointer.kind==='draw-line') {
    pointer.moved ||= Math.hypot(event.clientX-pointer.clientX,event.clientY-pointer.clientY)>4;
    const end=drawEnd(pointer.point,point,event.shiftKey);
    $("connection-preview").innerHTML=`<path d="M${pointer.point.x} ${pointer.point.y}L${end.x} ${end.y}" fill="none" stroke="#805ec0" stroke-width="2.5"/>`;return;
  }
  if(pointer.kind==='free-endpoint'||pointer.kind==='free-move') {
    const line=selectedEdge();if(!line)return;
    if(pointer.kind==='free-endpoint'){delete line[pointer.key==='fromPoint'?'fromAttachment':'toAttachment'];line[pointer.key]=drawEnd(pointer.original[pointer.key==='fromPoint'?'toPoint':'fromPoint'],point,event.shiftKey);}
    else {delete line.fromAttachment;delete line.toAttachment;for(const key of ['fromPoint','toPoint'])line[key]={x:pointer.original[key].x+point.x-pointer.point.x,y:pointer.original[key].y+point.y-pointer.point.y};}
    growCanvas(pointer.before.canvas);renderPaper();renderEdges();renderSelection();return;
  }
  if(pointer.kind==='pan') {
    pointer.moved ||= Math.abs(event.clientX-pointer.clientX)+Math.abs(event.clientY-pointer.clientY)>3;
    state.view.x=pointer.view.x+event.clientX-pointer.clientX;state.view.y=pointer.view.y+event.clientY-pointer.clientY;updateView();return;
  }
  if(pointer.kind==='connect') {
    const n=findNode(pointer.from),a=C.anchor(n,pointer.anchor);
    $("connection-preview").innerHTML=`<path d="M${a.x} ${a.y}L${point.x} ${point.y}" fill="none" stroke="#805ec0" stroke-width="2" stroke-dasharray="6 4"/>`;return;
  }
  if(pointer.kind==='marquee') {
    const box={x:Math.min(point.x,pointer.point.x),y:Math.min(point.y,pointer.point.y),w:Math.abs(point.x-pointer.point.x),h:Math.abs(point.y-pointer.point.y)};
    Object.assign($("marquee").style,{left:box.x+'px',top:box.y+'px',width:box.w+'px',height:box.h+'px'});
    state.selected=new Set([...pointer.base,...state.project.nodes.filter(n=>isVisible(n)&&n.x<box.x+box.w&&n.x+n.w>box.x&&n.y<box.y+box.h&&n.y+n.h>box.y).map(n=>n.id)]);
    renderSelection();return;
  }
  const snap=!event.altKey;
  let dx=point.x-pointer.point.x,dy=point.y-pointer.point.y;
  if(snap){dx=Math.round(dx/20)*20;dy=Math.round(dy/20)*20;}
  if(pointer.kind==='space-insert') {
    const amount=Math.max(0,pointer.axis==='x'?dx:dy);
    try {
      const preview=C.copy(pointer.before);C.insertSpace(preview,pointer.axis,pointer.cut,amount);
      state.project=preview;pointer.amount=amount;pointer.error=null;
      renderCanvas();spacePreview(pointer.axis,pointer.cut,amount,pointer.plan);
    }catch(error){pointer.error=error.message;updateStatus(error.message);}
    return;
  }
  if(pointer.kind==='canvas-resize') {
    state.project.canvas=C.resizeCanvas(pointer.canvas,pointer.handle,dx,dy);
    renderPaper();return;
  }
  if(pointer.kind==='move') {
    if(!pointer.moved&&Math.hypot(point.x-pointer.point.x,point.y-pointer.point.y)*state.view.zoom<4)return;
    if(editorTools){const snapped=editorTools.snapDrag(pointer,dx,dy,event.altKey);dx=snapped.dx;dy=snapped.dy;}
    if(Math.abs(dx)+Math.abs(dy)<1)return;
    if(!pointer.moved)$("viewport").setPointerCapture(event.pointerId);
    pointer.moved=true;
    pointer.originals.forEach(original=>{const n=findNode(original.id);if(n&&!n.locked){n.x=original.x+dx;n.y=original.y+dy;}});
  } else if(pointer.kind==='resize') {
    const box={...pointer.box},direction=pointer.handle;
    if(direction.includes('e'))box.w=Math.max(20,box.w+dx);
    if(direction.includes('s'))box.h=Math.max(20,box.h+dy);
    if(direction.includes('w')){box.w=Math.max(20,pointer.box.w-dx);box.x=pointer.box.x+pointer.box.w-box.w;}
    if(direction.includes('n')){box.h=Math.max(20,pointer.box.h-dy);box.y=pointer.box.y+pointer.box.h-box.h;}
    if(event.shiftKey&&direction.length===2){const ratio=pointer.box.w/pointer.box.h;box.h=box.w/ratio;}
    pointer.originals.forEach(original=>Object.assign(findNode(original.id),C.copy(original)));
    resizeNodes(selectedNodes().filter(n=>pointer.originals.some(o=>o.id===n.id)),pointer.box,box);
  }
  growCanvas(pointer.before.canvas);renderPaper();updateHorizontalScroll();updateDraggedNodes();
  if(pointer.kind==='move')previewEdgeDrop(event);
}
function onPointerUp(event) {
  editorTools?.clearGuides();
  const pointer=state.pointer;if(!pointer)return;
  if(!state.playing&&event.button===0&&!pointer.moved&&['pan','move'].includes(pointer.kind))state.pastePoint=worldPoint(event.clientX,event.clientY);
  state.pointer=null;$("viewport").classList.remove('panning');
  if($("viewport").hasPointerCapture(event.pointerId))$("viewport").releasePointerCapture(event.pointerId);
  if(pointer.kind==='draw-line') {
    $("connection-preview").innerHTML='';state.suppressCanvasClick=true;
    if(pointer.moved) {
      const end=drawEnd(pointer.point,worldPoint(event.clientX,event.clientY),event.shiftKey);
      if(Math.hypot(end.x-pointer.point.x,end.y-pointer.point.y)*state.view.zoom<4)return;
      const line=C.freeEdge(pointer.point,end,state.activeStep);
      change(()=>{state.project.edges.push(line);growCanvas();});cancelConnect();setSelection([],line.id);renderEdges();
    } else if(pointer.nodeId) {
      if(!state.connectFrom){state.connectFrom={id:pointer.nodeId,anchor:'bottom'};updateStatus('再点击一个组件完成连接，或拖拽自由画线');}
      else if(state.connectFrom.id!==pointer.nodeId) {
        const from=state.connectFrom,line=C.edge(from.id,pointer.nodeId,findNode(pointer.nodeId).stepId,{fromAnchor:from.anchor});
        change(()=>state.project.edges.push(line));cancelConnect();setSelection([],line.id);renderEdges();
      }
    }
    return;
  }
  if(pointer.kind==='move'&&pointer.moved&&state.dropEdgeId&&!event.altKey) {
    const node=insertionNode();
    if(node)try{
      if(state.dropJunctionIds.length>1){
        const line=state.project.edges.find(e=>e.id===state.dropJunctionIds[0]),port=C.anchor(findNode(line.to),line.toAnchor),box=C.visualBounds(selectedNodes());
        const dx=line.toAnchor==='left'?Math.min(0,port.x-50-box.x-box.w):line.toAnchor==='right'?Math.max(0,port.x+50-box.x):0;
        const dy=line.toAnchor==='top'?Math.min(0,port.y-50-box.y-box.h):line.toAnchor==='bottom'?Math.max(0,port.y+50-box.y):0;
        C.spliceJunction(state.project,state.dropJunctionIds,node.id);
        selectedNodes().forEach(n=>{n.x+=dx;n.y+=dy;});
        toast(`已接入 ${state.dropJunctionIds.length} 条汇合箭头，可一次撤销。`);
      }
      else{C.splitEdge(state.project,state.dropEdgeId,node.id);toast('已插入箭头：原连线拆为两条，可一次撤销。');}
    }catch(error){toast(error.message);}
  }
  clearEdgeDrop();
  if(pointer.kind==='space-insert') {
    clearSpacePreview();state.suppressCanvasClick=true;
    if(pointer.amount>0){state.spaceTool=null;$("viewport").classList.remove('spacing');renderLeft();}
    if(pointer.error)toast(pointer.error);
  }
  if(pointer.kind==='connect') {
    $("connection-preview").innerHTML='';
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-node]');
    if(target&&target.dataset.node!==pointer.from) {
      const id=target.dataset.node;
      change(()=>state.project.edges.push(C.edge(pointer.from,id,findNode(id).stepId,{fromAnchor:pointer.anchor})));
    }
  } else if(pointer.before) {
    // A plain click must not replace the DOM node: the browser needs it for
    // the following click/double-click, and selecting is not a project edit.
    if(JSON.stringify(pointer.before)!==JSON.stringify(state.project)) {
      if(pointer.kind!=='canvas-resize')growCanvas();
      recordChange(pointer.before);renderCanvas();renderInspector();renderLeft();
    } else if(pointer.clickSelection&&!pointer.moved) {
      // A click narrows a previous multi-selection; a drag moves it together.
      setSelection(pointer.clickSelection);
      state.clickToEdit=pointer.editCandidate;
    }
  }
  else if(pointer.kind==='marquee') {$("marquee").hidden=true;setSelection([...state.selected]);}
  else if(pointer.kind==='pan'){state.suppressCanvasClick=pointer.moved;scheduleSave();}
}
function cancelPointer() {
  editorTools?.clearGuides();
  if(state.pointer?.before)state.project=state.pointer.before;
  state.pointer=null;clearEdgeDrop();clearSpacePreview();$("marquee").hidden=true;$("connection-preview").innerHTML='';$("viewport").classList.remove('panning');renderCanvas();
}
function drawEnd(start,end,constrain) {
  if(!constrain)return {...end};
  const length=Math.hypot(end.x-start.x,end.y-start.y),angle=Math.round(Math.atan2(end.y-start.y,end.x-start.x)/(Math.PI/4))*Math.PI/4;
  return {x:start.x+length*Math.cos(angle),y:start.y+length*Math.sin(angle)};
}
function cancelConnect() {const active=state.connectionMode;state.connectionMode=false;state.connectFrom=null;$("viewport").classList.remove('connecting');if(active)renderLeft();updateStatus();}

function selectStep(id) {
  stopSpaceTool();
  state.activeStep=id;state.selected.clear();state.edgeId=null;state.inspectorMode='step';
  renderSelection();
  if(state.tab==='steps'&&$("left-content").querySelector('[data-select-step]')){
    $("left-content").querySelectorAll('[data-select-step]').forEach(card=>{card.classList.toggle('active',card.dataset.selectStep===id);card.setAttribute('aria-current',String(card.dataset.selectStep===id));card.querySelector('.step-selection')?.remove();});
    const create=$("left-content").querySelector('.step-controls [data-command="step-from-selection"]');
    if(create){create.disabled=true;create.textContent='用所选 0 个组件创建步骤';}
  }else renderLeft();
  renderInspector();document.body.classList.add('show-properties');
}
function createStep(afterId,nodeIds=[]) {
  if(state.finishTextEdit)state.finishTextEdit();
  let id;change(()=>{id=C.insertStep(state.project,afterId,nodeIds);state.activeStep=id;});
  switchLeftTab('steps');selectStep(id);revealLeftSelection();updateStatus();
  toast(nodeIds.length?`已将 ${nodeIds.length} 个组件移入新步骤，可在右侧修改步骤名称。`:'已插入空白步骤，可在右侧修改名称。');
}
function stopAuto() {clearTimeout(state.autoTimer);state.autoTimer=null;$("auto-play").textContent='自动播放';}
function enterPresentation(index=0) {
  cancelConnect();
  if(state.pointer)cancelPointer();state.spaceTool=null;clearSpacePreview();clearEdgeDrop();$("viewport").classList.remove('spacing');
  if(state.editingText)document.activeElement.blur();
  if(!state.playing){state.editView={...state.view};effects?.reset();}
  state.playing=true;state.toggledGroups.clear();state.selected.clear();state.edgeId=null;
  document.body.classList.add('presenting');$("presentation-bar").hidden=false;
  showStep(Math.max(0,index));
}
function showOverview() {
  if(!state.playing)enterPresentation(state.playIndex);
  stopAuto();state.overview=true;state.toggledGroups.clear();renderCanvas();
  const visible=C.contentNodes({...state.project,nodes:state.project.nodes.filter(n=>!n.hidden)});
  fitBounds(visible.length?C.bounds(visible):C.canvasBounds(state.project.canvas),true);
  $("presentation-name").textContent='全部展开';$("presentation-progress").textContent='拖动平移 · Ctrl+滚轮缩放 · 点击图片查看原图';
  $("show-overview").textContent='回到步骤';$("show-overview").setAttribute('aria-pressed','true');
  $("previous-step").disabled=false;$("next-step").disabled=false;
}
function exitPresentation() {
  const center=viewportCenter(),zoom=state.view.zoom;
  stopAuto();effects?.reset();state.motionDelays=null;state.playing=false;state.overview=false;document.body.classList.remove('presenting');$("presentation-bar").hidden=true;
  state.editView=null;state.activeStep=state.project.steps[state.playIndex].id;
  if(state.editorView.previewStep)state.editorView.previewStep=state.activeStep;
  setCamera({cx:center.x,cy:center.y,zoom});
  renderAll();revealLeftSelection();editorTools?.resumeMotionPreview();scheduleSave();
}
function showStep(index) {
  state.overview=false;$("show-overview").textContent='全部展开';$("show-overview").setAttribute('aria-pressed','false');
  state.playIndex=Math.max(0,Math.min(state.project.steps.length-1,index));
  const step=state.project.steps[state.playIndex];state.activeStep=step.id;
  state.motionDelays=new Map(C.animationPlan(state.project,step.id).map(t=>[t.id,t.start]));
  editorTools?.resetAnimationPause();
  const newcomers=C.contentNodes({...state.project,nodes:state.project.nodes.filter(n=>n.stepId===step.id&&!n.hidden),edges:state.project.edges.filter(e=>e.stepId===step.id)});
  const animateIds=new Set([...newcomers.map(n=>n.id),...state.project.edges.filter(e=>e.stepId===step.id).map(e=>e.id)]);
  renderCanvas(animateIds);
  // Camera transition: smooth glide (default), warp through a blurred overview, or an instant cut.
  const transition=step.transition||'smooth',from={...state.view};
  if(step.camera)setCamera(step.camera,transition==='smooth');
  else if(newcomers.length)fitBounds(C.bounds(newcomers),transition==='smooth');
  if(transition==='warp'&&(from.x!==state.view.x||from.y!==state.view.y||from.zoom!==state.view.zoom))effects?.warp(from,{...state.view});
  editorTools?.stepNavigation.syncPlayer();$("presentation-name").textContent=StudioStepNavigation.label(state.project,step.id);$("presentation-progress").textContent=`${state.playIndex+1} / ${state.project.steps.length}`;
  $("previous-step").disabled=state.playIndex===0;$("next-step").disabled=state.playIndex===state.project.steps.length-1;
}
function playAutomatic() {
  if(state.overview)showStep(state.playIndex);
  if(state.autoTimer){stopAuto();return;}
  $("auto-play").textContent='暂停';
  function tick() {
    if(state.playIndex>=state.project.steps.length-1){stopAuto();return;}
    showStep(state.playIndex+1);state.autoTimer=setTimeout(tick,stepPlaybackDuration());
  }
  state.autoTimer=setTimeout(tick,stepPlaybackDuration());
}
function stepPlaybackDuration() {
  const step=state.project.steps[state.playIndex];
  return Math.max(step.duration,...C.animationPlan(state.project,step.id).map(t=>t.end));
}
function executeAction(node) {
  if(node.action.type==='none')return;
  stopAuto();
  if(node.action.type==='note')openDialog(node.text||node.name,`<div style="white-space:pre-wrap">${escapeHtml(node.action.value)}</div>`);
  if(node.action.type==='image') {
    const asset=state.project.assets[node.action.value||node.assetId];
    if(asset)openDialog(asset.name,`<img class="image-view" src="${escapeHtml(asset.data)}" alt="${escapeHtml(asset.name)}">`);
    else toast('请在交互设置中选择要展示的图片。');
  }
  if(node.action.type==='step'){const index=stepIndex(node.action.value);if(index>=0)showStep(index);}
  if(node.action.type==='group') {
    if(state.toggledGroups.has(node.action.value))state.toggledGroups.delete(node.action.value);else state.toggledGroups.add(node.action.value);
    renderCanvas();
  }
  if(node.action.type==='link') {
    try {const url=new URL(node.action.value);if(!['https:','http:'].includes(url.protocol))throw new Error();window.open(url.href,'_blank','noopener,noreferrer');}
    catch {toast('请填写完整的 http:// 或 https:// 网页地址。');}
  }
}

function openDialog(title,html,back=null) {
  $("dialog")._back=back;$("close-dialog").textContent=back?"← 返回项目管理":"关闭 ×";
  $("dialog").classList.remove("component-dialog");
  $("dialog").classList.remove("template-dialog");
  $("dialog").classList.remove('motion-dialog');
  if(state.playing)stopAuto();
  $("dialog-title").textContent=title;$("dialog-content").innerHTML=html;
  if(!$("dialog").open)$("dialog").showModal();
  $("dialog-content").scrollTop=0;
}
async function download(content,filename,type) {
  if(desktop) {
    try {return await desktop.saveFile({content,filename,type});}
    catch(error){toast('导出失败：'+error.message);return false;}
  }
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  return true;
}
const safeFilename=title=>title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100)||'汇报项目';
async function exportProject() {
  if(state.editingText)document.activeElement.blur();
  if(await download(C.serialize(state.project),safeFilename(state.project.title)+'.studio.json','application/json'))toast('已导出包含组件、素材、连线和步骤的项目 JSON。');
}
async function exportHtml(mode='edit') {
  if(state.editingText)document.activeElement.blur();
  const project=C.validate(state.project);
  const clone=document.documentElement.cloneNode(true);
  clone.dataset.documentId=C.uid('document');clone.dataset.startMode=mode;
  clone.querySelector('title').textContent=project.title+' · 汇报工作台';
  clone.querySelector('#seed-project').textContent=C.serialize(project);
  clone.querySelector('body').className='';delete clone.querySelector('body').dataset.editorTheme;clone.querySelector('body').removeAttribute('style');
  ['nodes','edges','free-edges','selection','properties','left-content','dialog-content','connection-preview','canvas-frame'].forEach(id=>{clone.querySelector('#'+id).innerHTML='';});
  clone.querySelector('#dialog').removeAttribute('open');clone.querySelector('#dialog').classList.remove('motion-dialog','component-dialog','template-dialog');clone.querySelector('#canvas-context-menu')?.remove();clone.querySelector('#toast').hidden=true;clone.querySelector('#presentation-bar').hidden=true;
  clone.querySelector('#text-toolbar').hidden=true;
  clone.querySelector('#space-guide')?.remove();clone.querySelector('#edge-drop-hint')?.remove();clone.querySelector('#viewport').classList.remove('spacing');
  clone.querySelectorAll('[data-editor-tool]').forEach(el=>el.remove());
  clone.querySelector('.workspace').removeAttribute('style');
  clone.querySelector('#world').removeAttribute('style');clone.querySelector('#world').className='';
  clone.querySelector('#marquee').hidden=true;
  const suffix={present:'_演示版',overview:'_全部展开',edit:'_可编辑工作台'}[mode];
  if(await download('<!doctype html>\n'+clone.outerHTML,safeFilename(project.title)+suffix+'.html','text/html;charset=utf-8'))toast('HTML 已包含全部项目数据、图片和编辑器，可独立打开，也可重新导入。');
}
function exportMenu() {
  openDialog('保存与分享','<p>项目 JSON 用于备份与继续编辑；独立 HTML 内嵌全部图片，无需安装工作台即可打开。</p><div class="dialog-actions"><button id="download-project">项目 JSON</button><button id="download-player" class="primary">演示版 HTML</button><button id="download-overview">全部展开 HTML</button><button id="download-editor">可编辑 HTML</button></div><p class="hint">HTML 内可随时切换“逐步演示”和“全部展开”，也可返回编辑。以上 HTML 均可重新导入工作台，恢复所有组件。</p>');
}
async function showLibrary(trash=false) {return projectManager.show(trash);}
async function purgeProjectTrash(ids) {
  const records=await Promise.all(ids.map(readRecord));
  if(records.some(r=>r&&!r.deletedAt))throw new Error('只能清空回收站项目');
  let count=records.filter(Boolean).length;
  if(desktop)count=await desktop.purgeTrash(ids);
  else if(database)await new Promise((resolve,reject)=>{
    const tx=database.transaction('projects','readwrite'),store=tx.objectStore('projects');
    for(const id of ids){const req=store.get(id);req.onsuccess=()=>{if(req.result&&!req.result.deletedAt)tx.abort();else store.delete(id);};}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(new Error('回收站已变化，请重试'));
  });
  else for(const id of ids)localStorage.removeItem('studio-project:'+id);
  for(const id of ids){localStorage.removeItem('studio-recovery:'+id);state.revisions.delete(id);}
  return count;
}
async function putStoredRecord(record) {
  if(desktop)return desktop.putRecord(record);
  if(!database){localStorage.setItem('studio-project:'+record.id,JSON.stringify(record));return;}
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction('projects','readwrite');transaction.objectStore('projects').put(record);
    transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });
}
async function askDeleteProject(id) {
  const record=await readRecord(id);if(!record||record.deletedAt)return;
  openDialog('删除项目',`<p>将“${escapeHtml(record.project.title)}”移入回收站？</p><p class="hint">可随时从项目回收站恢复。已经导出的 JSON 和 HTML 文件不会被删除。</p><div class="dialog-actions"><button id="library-back">返回项目管理</button><button class="danger" data-confirm-delete="${escapeHtml(id)}">移入回收站</button></div>`,()=>showLibrary());
}
async function changeProjectTrash(id,deleted) {
  try {
    if(!await persistNow())throw new Error('当前项目尚未保存，请先导出备份。');
    const record=await readRecord(id);if(!record)return;
    if(deleted)record.deletedAt=Date.now();else delete record.deletedAt;
    record.updatedAt=Date.now();record.revision++;record.writer=writerId;
    await putStoredRecord(record);state.revisions.set(id,record.revision);
    localStorage.removeItem('studio-recovery:'+id);
    if(deleted&&state.project.id===id) {
      clearTimeout(state.saveTimer);
      const next=(await allRecords()).filter(r=>!r.deletedAt).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
      await loadProject(next?.project||C.newProject('未命名汇报'),next?.view,next,true);
    }
    await showLibrary(!deleted);toast(deleted?'项目已移入回收站，可随时恢复。':'项目已恢复。');
  } catch(error){toast('操作失败：'+error.message);}
}
async function importProjectText(text) {
  try {const project=C.parseProjectFile(text);project.id=C.uid('project');await loadProject(project);toast('项目已导入，文字、素材、连线与步骤均可继续编辑。');}
  catch(error){openDialog('无法导入项目',`<p class="error">${escapeHtml(error.message)}</p><p>支持项目 JSON 和本工作台导出的 HTML；普通 HTML 无法自动还原为编辑组件。</p>`,()=>showLibrary());}
}
function requestImport(){return projectManager.importPage();}
async function chooseImportFile() {
  if(!desktop){$("project-upload").click();return;}
  try {const file=await desktop.openProjectFile();if(file)await importProjectText(file.content);}
  catch(error){toast('读取失败：'+error.message);}
}
async function loadProject(project,view=null,record=null,skipPreviousSave=false) {
  editorTools?.resetMotionPreview();
  state.spaceTool=null;clearSpacePreview();clearEdgeDrop();$("viewport").classList.remove('spacing');
  if(state.finishTextEdit)state.finishTextEdit();
  if(state.ready&&!skipPreviousSave&&!await persistNow())throw new Error('当前项目保存失败，请先导出备份。');
  stopAuto();state.playing=false;state.overview=false;document.body.classList.remove('presenting');$("presentation-bar").hidden=true;
  state.project=C.validate(project);state.pastePoint=null;state.hasProject=true;welcome?.hide();state.selected.clear();state.edgeId=null;state.undo=[];state.redo=[];
  state.activeStep=state.project.steps[0].id;state.inspectorMode='canvas';state.editingText=false;state.tab='add';
  state.layerMulti=false;state.selectionFocus=null;state.leftScroll={};$("left-content").scrollTop=0;$("properties").scrollTop=0;
  state.editView=null;layerTools?.reset(view?.editor);
  if(record)state.revisions.set(project.id,record.revision);
  renderAll();
  if(view){state.view={...view};updateView();}
  else if(state.project.nodes.length)fitBounds({...C.canvasBounds(state.project.canvas),w:Math.min(state.project.canvas.width,1500),h:Math.min(state.project.canvas.height,1450)});
  else fitBounds({...C.canvasBounds(state.project.canvas),h:Math.min(state.project.canvas.height,1200)});
  $("dialog").close();state.ready=true;scheduleSave();
}
function showNewProject() {
  openDialog('新建汇报','<label class="field"><span>项目名称</span><input id="new-title" value="我的汇报"></label><div class="dialog-actions"><button id="create-blank" class="primary">创建</button></div>',()=>showLibrary());
}
function showDataEditor() {
  openDialog('项目数据 · JSON',`<p class="hint">所有画布内容都由这些数据生成。应用前会检查引用关系、组件尺寸和素材格式。修改可以撤销。</p><textarea id="project-data" class="data-editor" spellcheck="false">${escapeHtml(JSON.stringify(state.project,null,2))}</textarea><div class="dialog-actions"><button id="apply-json" class="primary">检查并应用</button><button id="download-project">导出 JSON</button></div><p id="json-error" class="error" role="status"></p>`);
}
function showHelp() {
  openDialog('使用工作台','<div class="notice">画布上的标题、说明、图注、标签、图标和连线都是项目对象。卡片背景与文字可以组合移动，也可以分开修改。论文原图属于图片素材，可缩放、替换或裁切；图片内部的文字可通过叠加文字组件重绘。</div><div class="shortcuts"><p><kbd>Ctrl+H / Ctrl+Shift+H</kbd> 编辑时隐藏所选 / 恢复全部</p><p><kbd>图层步骤眼睛</kbd> 隐藏整步；模拟本步画面查看退场后的布局</p><p><kbd>Ctrl+K / Ctrl+F</kbd> 搜索对象、步骤和功能</p><p><kbd>Ctrl+S</kbd> 保存到本机；Ctrl+Shift+S 导出 JSON</p><p><kbd>F5 / Shift+F5</kbd> 从头 / 当前步骤演示</p><p><kbd>Ctrl+Shift+C / V</kbd> 复制 / 粘贴格式</p><p><kbd>图层单击 / 双击</kbd> 选择 / 聚焦对象</p><p><kbd>拖入连线</kbd> 默认开启，按住Alt临时跳过</p><p><kbd>单击</kbd> 选择整个组合，拖动可移动整组</p><p><kbd>双击</kbd> 选择组合内部的文字或其他组件</p><p><kbd>选中文字后再单击</kbd> 直接编辑文字</p><p><kbd>F2</kbd> 明确进入画布文字编辑；Esc 返回选择</p><p><kbd>Ctrl + A</kbd> 画布上全选可见组件，输入框中全选文字</p><p><kbd>Ctrl + Shift + A</kbd> 从任何输入框全选画布组件</p><p><kbd>Ctrl / Shift + 单击</kbd> 多选；Shift 拖动空白处框选</p><p><kbd>拖动空白处</kbd> 左右、上下平移视野</p><p><kbd>拖动画布按钮</kbd> 开启手形模式，在组件上也能平移</p><p><kbd>底部横拉条</kbd> 左右移动视野；Shift + 滚轮也可横移</p><p><kbd>空格 + 拖动</kbd> 临时平移画布</p><p><kbd>Ctrl + 滚轮</kbd> 以鼠标位置缩放</p><p><kbd>Alt + 拖动</kbd> 暂时关闭网格、对象吸附与插线</p><p><kbd>Ctrl + G</kbd> 组合；加 Shift 取消组合</p><p><kbd>Ctrl + D</kbd> 复制选中对象</p><p><kbd>Ctrl + Z</kbd> 撤销；Ctrl + Shift + Z 重做</p><p><kbd>方向键</kbd> 微调位置；加 Shift 移动 10px</p><p><kbd>画布选中单个组件</kbd> Tab 添加子节点；Enter 添加兄弟节点</p><p><kbd>Delete</kbd> 删除；可撤销恢复</p></div><p>选中单个对象后，拖动紫色连接点到另一个对象创建连线。在组件库选择“连线”后，拖拽可在空白处、组件或图片上方绘制自由线条，Shift 限制方向，Esc 退出。自由线条可拖动整条或两端圆点；依次点击两个组件则创建随组件移动的连线。</p><p>“步骤”面板管理出现顺序和镜头。选中对象后设置进入动效、时长、延迟与出现步骤。演示时可点击图片放大，或使用按钮打开说明。</p><p>项目会自动保存在本机；桌面版使用项目文件，HTML 版使用浏览器存储。通过“导出”得到含素材的项目 JSON 或独立 HTML，便于长期备份、离线打开及继续编辑。</p>');
}

function showAgentGuide(){
  const guide=JSON.parse($("agent-guide").textContent);
  openDialog('Agent 教程 · 操作与项目数据',`<p>把这份教程与项目 JSON 一起交给模型。包含组件字段、效果、代码编辑配方、UI 操作路径和校验方法。</p><div class="dialog-actions"><button id="download-agent-guide" class="primary">导出教程 Markdown</button><button id="download-agent-example">导出组件示例 JSON</button></div><p class="hint">可运行脚本和配套 core.js 位于程序文件夹的“Agent教程”目录。这里的文本可全选复制；查看或导出不会修改当前项目。</p><textarea class="data-editor" aria-label="Agent 教程正文" readonly spellcheck="false">${escapeHtml(guide)}</textarea>`);
}
async function readImage(file) {
  let blob=file;
  if(file.type==='image/svg+xml'||file.name.toLowerCase().endsWith('.svg')) {
    blob=new Blob([C.sanitizeSvg(await file.text())],{type:'image/svg+xml'});
  }
  if(!['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'].includes(blob.type))throw new Error('请选择 PNG、JPEG、WebP、GIF 或 SVG 图片');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(blob);});
  const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片格式无法解码'));image.src=data;});
  return {name:file.name,data,width:image.naturalWidth||300,height:image.naturalHeight||150};
}
async function importImages(files,targetId=null) {
  const projectId=state.project.id,center=state.pastePoint||viewportCenter();
  try {
    const assets=await Promise.all([...files].map(readImage));
    if(state.project.id!==projectId){toast('项目已切换，请在当前项目重新选择图片。');return;}
    const ids=[];
    change(()=>{
      assets.forEach((asset,index)=>{
        const assetId=C.uid('asset');state.project.assets[assetId]=asset;
        if(targetId&&index===0&&findNode(targetId)) {
          const node=findNode(targetId);node.assetId=assetId;node.name=asset.name;ids.push(node.id);
        } else {
          const node=C.node('image',Math.max(0,center.x-210+index*30),Math.max(0,center.y-130+index*30),state.activeStep);
          node.assetId=assetId;node.h=node.w*asset.height/asset.width;node.name=asset.name;
          state.project.nodes.push(node);ids.push(node.id);
        }
      });growCanvas();
    });setSelection(ids);
    toast('图片已内嵌到项目，导出时会一起保存。');
  } catch(error){toast(error.message);}
}
function copySelected(cut=false) {
  state.pastePoint=null;
  const line=selectedEdge();
  if(line&&C.isFreeEdge(line)) {state.clipboard={freeLine:C.detachedEdge(line,state.project.nodes)};if(cut)command('delete');toast('线条已复制，可在工作台内粘贴。');return;}
  if(!state.selected.size)return;
  const ids=new Set(state.selected);
  state.clipboard=C.copyFragment(state.project,[...ids]);
  if(cut)command('delete');
  toast('组件已复制，可在工作台内粘贴。');
}
function pasteSelected() {
  if(!state.clipboard)return;
  if(state.clipboard.freeLine) {
    const line=C.copy(state.clipboard.freeLine);line.id=C.uid('edge');line.stepId=state.activeStep;
    if(line.endStepId&&!state.project.steps.some(s=>s.id===line.endStepId))line.endStepId='';
    const center=state.pastePoint,box=C.bounds([line.fromPoint,line.toPoint].map(p=>({...p,w:0,h:0})));
    for(const key of ['fromPoint','toPoint']){line[key].x+=center?center.x-box.x-box.w/2:40;line[key].y+=center?center.y-box.y-box.h/2:40;}
    change(()=>{state.project.edges.push(line);growCanvas();});setSelection([],line.id);renderEdges();return;
  }
  let ids=[];
  change(()=>{
    const oldEdges=new Set(state.project.edges.map(e=>e.id));
    ids=C.pasteFragment(state.project,state.clipboard,state.activeStep,state.pastePoint?0:40);
    if(state.pastePoint){const nodes=state.project.nodes.filter(n=>ids.includes(n.id)),box=C.visualBounds(nodes),dx=state.pastePoint.x-box.x-box.w/2,dy=state.pastePoint.y-box.y-box.h/2;
      nodes.forEach(n=>{n.x+=dx;n.y+=dy;});for(const e of state.project.edges.filter(e=>!oldEdges.has(e.id)&&C.isFreeEdge(e)))for(const pt of [e.fromPoint,e.toPoint]){pt.x+=dx;pt.y+=dy;}}
    growCanvas();
  });setSelection(ids);
}

$("viewport").addEventListener('pointerdown',onPointerDown);
$("viewport").addEventListener('pointermove',onPointerMove);
$("viewport").addEventListener('pointerup',onPointerUp);
$("viewport").addEventListener('pointercancel',cancelPointer);
// Drill into a group without entering text editing on the same double-click.
$("viewport").addEventListener('dblclick',event=>{
  if(state.playing||state.space||state.panMode||state.connectionMode||event.target.closest('[contenteditable]')||event.shiftKey)return;
  const element=event.target.closest('[data-node]');if(!element)return;
  event.preventDefault();state.clickToEdit=null;focusCanvas();setSelection([element.dataset.node]);
});
$("viewport").addEventListener('click',event=>{
  if(state.suppressCanvasClick){state.suppressCanvasClick=false;return;}
  if(state.panMode&&!state.playing)return;
  if(state.space||event.target.closest('[contenteditable]'))return;
  const element=event.target.closest('[data-node]');
  if(state.playing){if(element){const node=findNode(element.dataset.node);effects?.click(element,node);executeAction(node);}return;}
  const id=state.clickToEdit;state.clickToEdit=null;
  if(!element||element.dataset.node!==id||event.detail!==1)return;
  const node=findNode(id),cell=event.target.closest('td');
  if(node.type==='table'&&!cell)return;
  startTextEdit(node,cell||element.firstElementChild,cell?{row:Number(cell.dataset.row),col:Number(cell.dataset.col)}:null,{x:event.clientX,y:event.clientY});
});
$("viewport").addEventListener('wheel',event=>{
  if(event.target.closest('[contenteditable],#horizontal-navigation'))return;
  event.preventDefault();
  if(event.ctrlKey||event.metaKey)zoomBy(Math.exp(-event.deltaY*.002),event.clientX,event.clientY);
  else {state.view.x-=event.shiftKey?event.deltaY:event.deltaX;state.view.y-=event.shiftKey?0:event.deltaY;updateView();}
},{passive:false});
$("viewport").addEventListener('dragover',event=>{event.preventDefault();});
$("viewport").addEventListener('drop',event=>{
  event.preventDefault();if(state.playing)return;
  const files=[...event.dataTransfer.files].filter(file=>file.type.startsWith('image/')||file.name.endsWith('.svg'));
  if(files.length)importImages(files);
});
const isLiveField=input=>input.matches('textarea,input[type="text"],input[type="number"]')&&Boolean(input.dataset.prop);
$("properties").addEventListener('input',event=>{if(isLiveField(event.target))applyProperty(event.target,true);});
$("properties").addEventListener('change',event=>{
  if(event.target.dataset.prop&&(!isLiveField(event.target)||event.target.type==='number'))applyProperty(event.target);
});
$("properties").addEventListener('focusout',event=>{
  if(event.target.type==='number'&&event.target.dataset.prop&&event.target.isConnected)applyProperty(event.target);
  state.liveProperty=null;
});
$("properties").addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopPropagation();focusCanvas();}
});
$("text-toolbar").addEventListener('pointerdown',()=>{if(state.finishTextEdit)state.finishTextEdit();});
$("text-toolbar").addEventListener('input',event=>{
  if(event.target.matches('[data-prop]')){applyProperty(event.target,true);renderInspector();}
});
$("text-toolbar").addEventListener('change',()=>{state.liveProperty=null;});
$("text-toolbar").addEventListener('focusout',()=>{state.liveProperty=null;});
$("project-title").addEventListener('input',event=>applyProperty(event.target,true));
$("project-title").addEventListener('blur',()=>{state.liveProperty=null;});
let draggingStep=null,suppressStepClick=false,stepScrollFrame=null;
function clearStepDrop(){
  $("left-content").querySelectorAll('.step-drop-before,.step-drop-after').forEach(el=>el.classList.remove('step-drop-before','step-drop-after'));
}
function stepDropTarget(event){
  const hit=document.elementFromPoint(event.clientX,event.clientY);
  const card=hit?.closest('[data-select-step]'),gap=hit?.closest('[data-step-insert]');
  if(!card&&!gap)return null;
  const id=card?.dataset.selectStep||gap.dataset.stepInsert;
  const after=Boolean(gap)||event.clientY>card.getBoundingClientRect().top+card.getBoundingClientRect().height/2;
  return {element:card||gap,after,beforeId:after?state.project.steps[stepIndex(id)+1]?.id||null:id};
}
$("left-content").addEventListener('dragstart',event=>{if(event.target.closest('[data-select-step]'))event.preventDefault();});
$("left-content").addEventListener('pointerdown',event=>{
  const card=event.target.closest('[data-select-step]');
  if(event.button!==0||!card||event.target.closest('button,input'))return;
  draggingStep={id:card.dataset.selectStep,x:event.clientX,y:event.clientY,clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId,moved:false};
});
function updateStepDrop(){
  if(!draggingStep?.moved)return;clearStepDrop();
  const panel=$("left-content"),rect=panel.getBoundingClientRect(),toolbar=panel.querySelector('.step-controls');
  const top=rect.top+(toolbar?.offsetHeight||0);
  if(draggingStep.clientX>=rect.left&&draggingStep.clientX<=rect.right){
    if(draggingStep.clientY<top+22)panel.scrollTop-=5;else if(draggingStep.clientY>rect.bottom-22)panel.scrollTop+=5;
  }
  const target=stepDropTarget(draggingStep);if(target)target.element.classList.add(target.after?'step-drop-after':'step-drop-before');
  stepScrollFrame=requestAnimationFrame(updateStepDrop);
}
document.addEventListener('pointermove',event=>{
  if(!draggingStep||draggingStep.pointerId!==event.pointerId)return;
  draggingStep.clientX=event.clientX;draggingStep.clientY=event.clientY;
  if(!draggingStep.moved&&Math.hypot(event.clientX-draggingStep.x,event.clientY-draggingStep.y)>5){
    draggingStep.moved=true;$("left-content").setPointerCapture(event.pointerId);
    [...$("left-content").querySelectorAll('[data-select-step]')].find(el=>el.dataset.selectStep===draggingStep.id)?.classList.add('step-dragging');
    updateStepDrop();
  }
  if(draggingStep.moved)event.preventDefault();
});
function finishStepDrag(event,cancel=false){
  if(!draggingStep)return;
  const {id,moved,pointerId}=draggingStep,target=!cancel&&moved?stepDropTarget(event):null;
  draggingStep=null;cancelAnimationFrame(stepScrollFrame);clearStepDrop();
  if($("left-content").hasPointerCapture(pointerId))$("left-content").releasePointerCapture(pointerId);
  $("left-content").querySelectorAll('.step-dragging').forEach(el=>el.classList.remove('step-dragging'));
  if(moved){suppressStepClick=true;setTimeout(()=>suppressStepClick=false,0);}
  if(target){change(()=>C.reorderStep(state.project,id,target.beforeId));selectStep(id);revealLeftSelection();updateStatus();}
}
document.addEventListener('pointerup',event=>finishStepDrag(event));
document.addEventListener('pointercancel',event=>finishStepDrag(event,true));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&draggingStep){finishStepDrag(event,true);event.preventDefault();event.stopImmediatePropagation();}
});
document.addEventListener('click',async event=>{
  if(suppressStepClick)return;
  const button=event.target.closest('button');
  if(button?.dataset.spaceAxis){if(state.spaceTool!==button.dataset.spaceAxis)toggleSpaceTool(button.dataset.spaceAxis);return;}
  if(button?.dataset.tab){switchLeftTab(button.dataset.tab);return;}
  if(button?.dataset.add){addComponent(button.dataset.add);return;}
  if(button?.dataset.command){command(button.dataset.command);return;}
  if(button?.dataset.icon){change(()=>selectedNodes().filter(n=>n.type==='icon').forEach(n=>n.icon=button.dataset.icon));return;}
  if(button?.dataset.lock){const n=findNode(button.dataset.lock);change(()=>n.locked=!n.locked);return;}
  if(button?.dataset.stepFocus){selectStep(button.dataset.stepFocus);focusStep(button.dataset.stepFocus);return;}
  if(button?.dataset.stepInsert){createStep(button.dataset.stepInsert);return;}
  if(button?.dataset.stepPlay){enterPresentation(stepIndex(button.dataset.stepPlay));return;}
  const layer=event.target.closest('[data-layer]');
  if(layer){selectLayerUnit([layer.dataset.layer],event);return;}
  const group=event.target.closest('[data-group]');
  if(group){selectLayerUnit(layerTools.groupIds(group.dataset.group,group.dataset.groupScope),event);return;}
  const line=event.target.closest('[data-select-edge]');if(line){setSelection([],line.dataset.selectEdge);renderEdges();return;}
  const step=event.target.closest('[data-select-step]');if(step){selectStep(step.dataset.selectStep);return;}
  if(button?.dataset.openProject) {
    const record=await readRecord(button.dataset.openProject);if(record&&!record.deletedAt)await loadProject(record.project,record.view,record);return;
  }
  if(button?.dataset.deleteProject){await askDeleteProject(button.dataset.deleteProject);return;}
  if(button?.dataset.confirmDelete){await changeProjectTrash(button.dataset.confirmDelete,true);return;}
  if(button?.dataset.restoreProject){await changeProjectTrash(button.dataset.restoreProject,false);return;}
  switch(button?.id) {
    case 'show-agent-guide':showAgentGuide();break;
    case 'download-agent-guide':await download(JSON.parse($("agent-guide").textContent),'AGENT_GUIDE.md','text/markdown;charset=utf-8');break;
    case 'download-agent-example':await download(C.serialize(C.validate(JSON.parse($("agent-example").textContent))),'Agent组件示例.studio.json','application/json');break;
    case 'insert-edge-new':insertIntoEdge(true);break;
    case 'insert-edge-use':insertIntoEdge(false);break;
    case 'download-project':exportProject();break;
    case 'download-editor':exportHtml('edit');break;
    case 'download-player':exportHtml('present');break;
    case 'download-overview':exportHtml('overview');break;
    case 'library-trash':showLibrary(true);break;
    case 'library-back':showLibrary(false);break;
    case 'open-data-folder':desktop?.openDataFolder();break;
    case 'library-new':showNewProject();break;
    case 'create-blank':await loadProject(C.newProject($("new-title").value||'我的汇报'));break;
    case 'create-sample':{const project=C.copy(seed);project.id=C.uid('project');project.title=$("new-title").value||seed.title;await loadProject(project);break;}
    case 'apply-json':{
      try {
        const updated=C.validate(JSON.parse($("project-data").value));updated.id=state.project.id;
        change(()=>{state.project=updated;state.selected.clear();state.edgeId=null;state.activeStep=updated.steps[0].id;});
        $("dialog").close();$("project-title").value=state.project.title;toast('数据已应用，可使用撤销返回。');
      } catch(error){$("json-error").textContent=error.message;}
      break;
    }
  }
});
$("undo").onclick=()=>travelHistory(-1);$("redo").onclick=()=>travelHistory(1);
$("deselect").onclick=()=>{setSelection([]);document.body.classList.remove('show-properties');};
$("zoom-in").onclick=()=>zoomBy(1.2);$("zoom-out").onclick=()=>zoomBy(1/1.2);
$("zoom-label").onclick=()=>zoomBy(1/state.view.zoom);
$("fit").onclick=()=>fitBounds(C.canvasBounds(state.project.canvas),true);

$("pan-tool").onclick=()=>{focusCanvas();stopSpaceTool();cancelConnect();state.panMode=!state.panMode;updatePanMode();};
$("horizontal-scroll").addEventListener('pointerdown',()=>{state.scrollDragging=true;});
$("horizontal-scroll").addEventListener('input',event=>{
  state.view.x=$("viewport").clientWidth/2-Number(event.target.value)*state.view.zoom;
  updateView();scheduleSave();
});
const finishHorizontalScroll=()=>{if(state.scrollDragging){state.scrollDragging=false;updateHorizontalScroll();}};
document.addEventListener('pointerup',finishHorizontalScroll);
document.addEventListener('pointercancel',finishHorizontalScroll);
$("horizontal-scroll").addEventListener('blur',finishHorizontalScroll);
$("scroll-left").onclick=()=>{state.view.x+=Math.max(80,$("viewport").clientWidth*.2);updateView();scheduleSave();};
$("scroll-right").onclick=()=>{state.view.x-=Math.max(80,$("viewport").clientWidth*.2);updateView();scheduleSave();};
$("fit-selection").onclick=()=>{if(state.selected.size)fitBounds(C.bounds(selectedNodes()),true);else if(selectedEdge()&&C.isFreeEdge(selectedEdge()))fitBounds(C.bounds(C.contentNodes({nodes:[],edges:[selectedEdge()]})),true);};
$("world").addEventListener('transitionend',event=>{if(event.target===$("world"))renderTextToolbar(selectedNodes());});
$("toggle-grid").onclick=()=>change(()=>state.project.canvas.grid=!state.project.canvas.grid,{inspector:false});
$("library").onclick=()=>showLibrary();$("new-project").onclick=showNewProject;$("export").onclick=exportMenu;$("help").onclick=()=>{showHelp();$("dialog-content").insertAdjacentHTML('afterbegin','<div class="notice"><strong>给模型的教程</strong><p>让 Agent 理解组件、步骤、动效和项目 JSON，按代码编辑可继续使用的项目。</p><button id="show-agent-guide">查看 / 导出 Agent 教程</button></div>');};
$("import").onclick=requestImport;
$("close-dialog").onclick=()=>$("dialog")._back?$("dialog")._back():$("dialog").close();
$("dialog").addEventListener("cancel",event=>{if($("dialog")._back){event.preventDefault();$("dialog")._back();}});
$("present").onclick=()=>enterPresentation(0);$("exit-presentation").onclick=exitPresentation;
$("show-overview").onclick=()=>{if(state.overview)showStep(state.playIndex);else showOverview();};
$("previous-step").onclick=()=>{stopAuto();showStep(state.playIndex-1);};$("next-step").onclick=()=>{stopAuto();showStep(state.playIndex+1);};
$("auto-play").onclick=playAutomatic;
$("presenter-notes").onclick=()=>{const step=state.project.steps[state.playIndex];openDialog(step.name+' · 备注',`<div style="white-space:pre-wrap">${escapeHtml(step.note||'此步骤尚未填写备注。可返回编辑，在步骤属性中添加。')}</div>`);};
$("fullscreen").onclick=()=>editorTools.toggleFullscreen();
$("image-upload").onchange=event=>{const files=[...event.target.files];event.target.value='';if(files.length)importImages(files,state.uploadTarget);state.uploadTarget=null;};
$("project-upload").onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try {if(file.size>100*1024*1024)throw new Error('文件超过 100 MB，请缩小图片后重试。');await importProjectText(await file.text());}
  catch(error){toast('导入失败：'+error.message);}
};
document.addEventListener('keydown',event=>{
  if(state.home||event.isComposing)return;
  if(['Enter',' '].includes(event.key)&&event.target.matches('[data-layer],[data-group]')){event.preventDefault();event.target.click();return;}
  if(event.target.closest('input,textarea,select,[contenteditable],summary,[role=separator]')||$("dialog").open)return;
  const modifier=event.ctrlKey||event.metaKey;
  if(state.playing) {
    if(['ArrowRight','ArrowLeft',' '].includes(event.key)){event.preventDefault();stopAuto();showStep(state.playIndex+(event.key==='ArrowLeft'?-1:1));}
    if(event.key==='Escape'){event.preventDefault();exitPresentation();}return;
  }
  if(event.key===' '){event.preventDefault();state.space=true;$("viewport").style.cursor='grab';return;}
  if(event.key==='Escape'){cancelConnect();if(state.pointer)cancelPointer();if(state.spaceTool){state.spaceTool=null;clearSpacePreview();$("viewport").classList.remove('spacing');renderLeft();}else if(state.panMode){state.panMode=false;updatePanMode();}else setSelection([]);return;}
  if(event.key==='F2'){event.preventDefault();editSelectedText();return;}
  if(modifier) {
    const key=event.key.toLowerCase();
    if(['z','y','d','g','a','s'].includes(key))event.preventDefault();
    if(key==='z')travelHistory(event.shiftKey?1:-1);
    if(key==='y')travelHistory(1);
    if(key==='d')command('duplicate');
    if(key==='g')command(event.shiftKey?'ungroup':'group');
    if(key==='a')selectAllComponents();
    // Native copy/cut/paste events are handled by the efficiency tools.
    if(key==='s')persistNow();
    return;
  }
  if(['Delete','Backspace'].includes(event.key)){event.preventDefault();command('delete');}
   if(event.key==='Tab'&&state.selected.size===1&&event.target===$("viewport")&&!event.altKey&&!event.shiftKey){event.preventDefault();addChild();}
   if(event.key==='Enter'&&state.selected.size===1&&event.target===$("viewport")){event.preventDefault();!event.altKey?addChild(true):editSelectedText();}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selectedEdge()&&C.isFreeEdge(selectedEdge())) {
    event.preventDefault();const delta=event.shiftKey?10:1;
    change(()=>{const line=selectedEdge();Object.assign(line,C.detachedEdge(line,state.project.nodes));delete line.fromAttachment;delete line.toAttachment;for(const key of ['fromPoint','toPoint']){const p=line[key];if(event.key==='ArrowLeft')p.x-=delta;if(event.key==='ArrowRight')p.x+=delta;if(event.key==='ArrowUp')p.y-=delta;if(event.key==='ArrowDown')p.y+=delta;}growCanvas();});return;
  }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&state.selected.size) {
    event.preventDefault();const delta=event.shiftKey?10:1;
    change(()=>selectedNodes().filter(n=>!n.locked).forEach(n=>{if(event.key==='ArrowLeft')n.x-=delta;if(event.key==='ArrowRight')n.x+=delta;if(event.key==='ArrowUp')n.y-=delta;if(event.key==='ArrowDown')n.y+=delta;}));
  }
});
// This explicit shortcut selects canvas objects even when an input has focus.
document.addEventListener('keydown',event=>{
  if(!event.isComposing&&(event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='a'&&!$("dialog").open&&!state.playing) {
    event.preventDefault();event.stopImmediatePropagation();selectAllComponents();
  }
},true);
$("select-all").onclick=selectAllComponents;
document.addEventListener('keyup',event=>{if(event.key===' '){state.space=false;$("viewport").style.cursor='';}});
window.addEventListener('blur',()=>{state.space=false;$("viewport").style.cursor='';});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAuto();if(state.ready)persistNow();}});
window.addEventListener('beforeunload',()=>{
  if(!state.ready||desktop)return;
  try {localStorage.setItem('studio-recovery:'+state.project.id,JSON.stringify({project:state.project,view:{...(state.editView||state.view),editor:layerTools?.snapshot()},updatedAt:Date.now()}));localStorage.setItem(documentKey,state.project.id);}catch{/* Completed autosaves and manual exports remain available. */}
});
new ResizeObserver(entries=>{
  const rect=entries[0].contentRect;
  if(lastViewport.width&&state.ready&&!state.home) {
    state.view.x+=(rect.width-lastViewport.width)/2;state.view.y+=(rect.height-lastViewport.height)/2;updateView();
  }
  lastViewport={width:rect.width,height:rect.height};
}).observe($("viewport"));

async function initialize() {
  try {if(!desktop) {
    database=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('presentation-studio-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('projects',{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('存储升级被阻塞'));
    });}
  } catch {database=null;}
  if(desktop){
    await componentLibrary.load();await editorTools.startWorkspace();await welcome.open();state.ready=true;
    document.title='汇报工作台';
    desktop.onBeforeClose(async()=>{if(state.finishTextEdit)state.finishTextEdit();return await componentLibrary.flush()&&await persistNow();});
    desktop.onImportFile(file=>importProjectText(file.content));desktop.ready();return;
  }
  let record=null,recovery=null;
  try {
    const id=localStorage.getItem(documentKey);
    if(id){record=await readRecord(id);if(!desktop)recovery=JSON.parse(localStorage.getItem('studio-recovery:'+id));}
    if(record?.deletedAt){record=null;recovery=null;}
  } catch { /* Start from the embedded project when browser storage is unavailable. */ }
  try {
    if(recovery&&(!record||recovery.updatedAt>record.updatedAt))await loadProject(C.validate(recovery.project),recovery.view,record);
    else if(record)await loadProject(record.project,record.view,record);
    else {const project=C.copy(seed);project.id=C.uid('project');await loadProject(project);}
  } catch {
    const project=C.copy(seed);project.id=C.uid('project');await loadProject(project);toast('草稿无法读取，已打开 HTML 内嵌项目。');
  }
  await componentLibrary.load();
  await editorTools.startWorkspace();
  if(document.documentElement.dataset.startMode==='present')enterPresentation(0);
  if(document.documentElement.dataset.startMode==='overview')showOverview();
}
layerTools=StudioLayers.install({C,state,$,escapeHtml,recordEditorChange,renderCanvas,renderLeft,renderInspector,selectLayerUnit,scheduleSave,decorateLeft:()=>editorTools?.decorateLeft()});
editorTools=StudioEditorTools.install({C,state,$,desktop,nodeBody,applyNodeStyles,escapeHtml,layerTools,isVisible,selectedNodes,selectedEdge,findNode,currentStep,change,setSelection,renderLeft,renderCanvas,renderInspector,fitBounds,updateView,focusCanvas,enterPresentation,exitPresentation,showStep,stopAuto,openDialog,toast,command,addComponent,selectStep,copySelected,pasteSelected,importImages,viewportCenter,growCanvas,persistNow,exportProject,showHelp,clearEdgeDrop,switchLeftTab,revealLeftSelection});
componentLibrary=StudioComponents.install({C,state,$,desktop,escapeHtml,change,setSelection,renderLeft,renderCanvas,renderInspector,viewportCenter,growCanvas,openDialog,toast,nodeBody,applyNodeStyles,finishEditing:()=>{if(state.finishTextEdit)state.finishTextEdit();}});
editorUI=StudioEditorUI.install({C,state,$,escapeHtml,nodeBody,applyNodeStyles,selectedNodes,selectedEdge,selectedGroup,currentStep,selectStep,focusStep});
projectManager=StudioProjectManager.install({state,$,desktop,escapeHtml,persistNow,allRecords,purgeTrash:purgeProjectTrash,openDialog,toast,chooseImportFile});
welcome=StudioWelcome.install({state,$,escapeHtml,showNewProject,requestImport,showHelp,showLibrary,allRecords,readRecord,loadProject,persistNow,stopAuto,toast,paintCover:editorUI.paintCover,toggleAppearance:editorUI.toggleAccent,icon:editorUI.icon});
initialize().catch(error=>{markSave('启动失败',true);openDialog('无法打开项目',`<p class="error">${escapeHtml(error.message)}</p><p>请导入已备份的项目 JSON 或工作台 HTML。</p>`);});

$("left-content").addEventListener('dblclick',event=>{
  if(event.target.closest('button,input,select'))return;
  const card=event.target.closest('[data-select-step]');if(card){selectStep(card.dataset.selectStep);focusStep(card.dataset.selectStep);}
});
