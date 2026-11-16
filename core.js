/* Project data and reversible document operations. All canvas content lives here. */
(function (global) {
  "use strict";
  const uid = (prefix = "n") => prefix + "_" + (global.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const copy = (value) => structuredClone(value);
  const TYPES = ["text", "shape", "icon", "image", "table", "button", "compare", "counter", "flip", "chart"];
  const ANIMATIONS = ["none", "fade", "rise", "scale", "pulse", "draw", "slide-left", "slide-right", "drop", "zoom-out", "type"];
  // Optional presentation extras (1.12). Missing fields keep older projects valid.
  const LOOPS = ["none", "breathe", "float", "blink", "spin", "kenburns"];
  const FLOWS = ["none", "dash", "dots"];
  const TRANSITIONS = ["smooth", "warp", "cut"];
  const ICONS = {
    question: '<circle cx="24" cy="24" r="19"/><path d="M18 17a6 6 0 0 1 12 0c0 5-6 5-6 10M24 33v1"/>',
    bulb: '<path d="M14 20a10 10 0 1 1 20 0c0 5-5 7-6 13h-8c-1-6-6-8-6-13ZM20 38h8M22 42h4M24 2v3M5 18h4M39 18h4M9 6l4 4M35 10l4-4"/>',
    code: '<path d="m16 12-12 12 12 12m16-24 12 12-12 12M28 6l-8 36"/>',
    chip: '<rect x="12" y="12" width="24" height="24" rx="3"/><rect x="18" y="18" width="12" height="12"/><path d="M18 5v7M30 5v7M18 36v7M30 36v7M5 18h7M5 30h7M36 18h7M36 30h7"/>',
    check: '<circle cx="24" cy="24" r="19"/><path d="m14 24 7 7 14-15"/>',
    warning: '<path d="M24 5 3 41h42ZM24 17v11M24 34v1"/>',
    spark: '<path d="m24 3 5 15 16 6-16 6-5 15-5-15-16-6 16-6Z"/>',
    star: '<path d="m24 3 6 14 15 2-11 11 3 15-13-8-13 8 3-15L3 19l15-2Z"/>',
    book: '<path d="M24 11C17 5 8 6 3 8v31c7-3 14-2 21 3 7-5 14-6 21-3V8c-5-2-14-3-21 3ZM24 11v31"/>',
    chart: '<path d="M7 5v36h36M14 33V21M24 33V12M34 33V5"/>',
    target: '<circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="3"/>',
    arrow: '<path d="M5 24h36M28 11l13 13-13 13"/>',
    branch: '<path d="M24 3v15M8 33V18h32v15"/><rect x="2" y="33" width="12" height="10" rx="2"/><rect x="34" y="33" width="12" height="10" rx="2"/>',
    search: '<circle cx="20" cy="20" r="13"/><path d="m30 30 13 13"/>',
    file: '<path d="M11 3h18l9 10v32H11ZM29 3v11h9M17 22h15M17 29h15M17 36h10"/>',
    play: '<circle cx="24" cy="24" r="19"/><path d="m19 14 15 10-15 10Z"/>',
    pin: '<path d="M24 45S9 27 9 18a15 15 0 0 1 30 0c0 9-15 27-15 27Z"/><circle cx="24" cy="18" r="5"/>',
    quote: '<path d="M6 13h13v15H9c0 6 5 8 10 8M29 13h13v15H32c0 6 5 8 10 8"/>',
    network: '<circle cx="24" cy="24" r="6"/><circle cx="7" cy="7" r="4"/><circle cx="41" cy="7" r="4"/><circle cx="7" cy="41" r="4"/><circle cx="41" cy="41" r="4"/><path d="m10 10 10 10m8 0 10-10M10 38l10-10m8 0 10 10"/>',
    heart: '<path d="M24 42 7 25C-6 12 12 0 24 14 36 0 54 12 41 25Z"/>'
  };
  const ICON_NAMES = {question:"问号",bulb:"灯泡",code:"代码",chip:"芯片",check:"完成",warning:"提醒",spark:"灵感",star:"星形",book:"文献",chart:"图表",target:"目标",arrow:"箭头",branch:"分支",search:"查找",file:"文件",play:"播放",pin:"定位",quote:"引用",network:"网络",heart:"心形"};
  const baseStyle = () => ({fill:"transparent",color:"#27313d",border:"#cbd2d9",borderWidth:0,radius:8,opacity:1,fontSize:24,fontFamily:"Microsoft YaHei",fontWeight:400,lineHeight:1.5,align:"left",padding:8,shadow:0});
  function newProject(title="未命名汇报") {
    return {schemaVersion:1,id:uid("project"),title,canvas:{width:1600,height:1800,background:"#f7f6f1",grid:true,snap:true},nodes:[],edges:[],groups:[],steps:[{id:uid("step"),name:"开场",duration:6000,note:"",camera:null}],assets:{}};
  }
  function node(type,x,y,stepId,extra={}) {
    const item={id:uid(),type,name:{text:"文字",shape:"形状",icon:"图标",image:"图片",table:"表格",button:"按钮",compare:"前后对比",counter:"数字滚动",flip:"翻转卡片",chart:"图表"}[type],x,y,w:300,h:90,rotation:0,locked:false,hidden:false,parentId:null,stepId,animation:{type:"fade",duration:600,delay:0},style:baseStyle(),action:{type:"none",value:""},...extra};
    if(type==="text") item.text=extra.text??"在右侧修改文字，或按 F2 编辑";
    if(type==="shape") { item.shape="rect";item.style.fill="#ffffff";item.style.borderWidth=1;item.w=320;item.h=180; }
    if(type==="icon") { item.icon="bulb";item.w=80;item.h=80;item.strokeWidth=2;item.style.color="#765cb1"; }
    if(type==="image") {item.assetId="";item.fit="contain";item.positionX=50;item.positionY=50;item.w=420;item.h=260;item.action={type:"image",value:""};}
    if(type==="table") {item.cells=[["项目","内容"],["设置","选中单元格后按 F2 编辑"]];item.w=550;item.h=180;item.headerFill="#e7e6f3";item.style.fill="#ffffff";item.style.fontSize=20;item.style.borderWidth=1;}
    if(type==="compare") {item.assetId="";item.afterAssetId="";item.split=50;item.labelBefore="修复前";item.labelAfter="修复后";item.fit="cover";item.w=520;item.h=320;item.style.padding=0;}
    if(type==="counter") {item.value=42;item.from=0;item.decimals=0;item.prefix="";item.suffix="%";item.grouping=true;item.countDuration=1600;item.w=260;item.h=110;item.style.fontSize=72;item.style.fontWeight=700;item.style.color="#1f4e79";item.style.align="center";item.style.padding=0;}
    if(type==="flip") {item.text="提出一个问题";item.backText="点击翻面后显示的答案";item.backFill="#1f4e79";item.backColor="#ffffff";item.w=320;item.h=200;item.style.fill="#f4f6f9";item.style.radius=12;item.style.fontSize=26;item.style.fontWeight=600;item.style.align="center";item.style.padding=20;}
    if(type==="chart") {item.chartType="bar";item.data=[{label:"一月",value:32},{label:"二月",value:48},{label:"三月",value:41},{label:"四月",value:67}];item.unit="";item.chartColor="#1f4e79";item.showValues=true;item.w=520;item.h=300;item.style.fontSize=18;item.style.color="#47525f";item.style.border="#cbd2d9";item.style.padding=0;}
    if(type==="button") {item.text="查看补充说明";item.w=200;item.h=56;item.style.fill="#ece8f6";item.style.color="#674d9c";item.style.fontSize=20;item.style.align="center";item.action={type:"note",value:"在属性面板填写点击后显示的说明。"};}
    return item;
  }
  function edge(from,to,stepId,extra={}) {return {id:uid("edge"),from,to,fromAnchor:"bottom",toAnchor:"top",route:"curve",color:"#917bb4",width:2,arrow:true,dash:false,label:"",labelSize:16,stepId,animation:{type:"draw",duration:800,delay:0},...extra};}
  const isFreeEdge = e => e.from===null&&e.to===null;
  const edgeNodeIds=e=>[e.from,e.to,e.fromAttachment,e.toAttachment].filter(Boolean);
  function detachedEdge(e,nodes){const next=copy(e),points=edgePoints(e,nodes);next.from=next.to=null;[next.fromPoint,next.toPoint]=points.map(p=>({...p}));delete next.fromAttachment;delete next.toAttachment;return next;}
  function freeEdge(a,b,stepId) {return edge(null,null,stepId,{fromPoint:{...a},toPoint:{...b},route:'straight'});}
  function edgePoints(e,nodes) {
    if(isFreeEdge(e))return ['from','to'].map(key=>e[key+'Attachment']?anchor(nodes.find(n=>n.id===e[key+'Attachment']),e[key+'Anchor']):e[key+'Point']);
    return [anchor(nodes.find(n=>n.id===e.from),e.fromAnchor),anchor(nodes.find(n=>n.id===e.to),e.toAnchor)];
  }
  function contentNodes(project) {
    return [...project.nodes,...project.edges.flatMap(e=>{
      const points=isFreeEdge(e)?edgePoints(e,project.nodes):[];
      if(e.route==='curve'&&e.curveOffset&&(isFreeEdge(e)||[e.from,e.to].every(id=>project.nodes.some(n=>n.id===id))))points.push(...curveControls(e,project.nodes));
      return points.map(p=>({...p,w:1,h:1,rotation:0}));
    })];
  }
  function visibleAt(item,steps,index) {
    const start=steps.findIndex(s=>s.id===item.stepId),end=item.endStepId?steps.findIndex(s=>s.id===item.endStepId):steps.length;
    return !item.hidden&&start>=0&&index>=start&&index<end;
  }
  function bounds(nodes) {
    if(!nodes.length)return{x:0,y:0,w:100,h:100};
    const left=Math.min(...nodes.map(n=>n.x)),top=Math.min(...nodes.map(n=>n.y));
    return{x:left,y:top,w:Math.max(...nodes.map(n=>n.x+n.w))-left,h:Math.max(...nodes.map(n=>n.y+n.h))-top};
  }
  function canvasBounds(canvas) {return {x:canvas.x??0,y:canvas.y??0,w:canvas.width,h:canvas.height};}
  function visualBounds(nodes) {
    return bounds(nodes.map(n=>{
      const angle=n.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
      const w=n.w*c+n.h*s,h=n.w*s+n.h*c;
      return {x:n.x+(n.w-w)/2,y:n.y+(n.h-h)/2,w,h};
    }));
  }
  function expandCanvas(canvas,nodes,margin=80) {
    if(!nodes.length)return {...canvas};
    const box=visualBounds(nodes),old=canvasBounds(canvas);
    const left=box.x<old.x?Math.floor((box.x-margin)/20)*20:old.x;
    const top=box.y<old.y?Math.floor((box.y-margin)/20)*20:old.y;
    const right=box.x+box.w>old.x+old.w?Math.ceil((box.x+box.w+margin)/20)*20:old.x+old.w;
    const bottom=box.y+box.h>old.y+old.h?Math.ceil((box.y+box.h+margin)/20)*20:old.y+old.h;
    return {...canvas,x:left,y:top,width:Math.min(50000,right-left),height:Math.min(50000,bottom-top)};
  }
  function spacePlan(project,axis,cut) {
    if(!['x','y'].includes(axis)||!Number.isFinite(cut))throw new Error('插入空间的位置无效');
    const grouped=new Set(project.groups.flatMap(g=>g.nodeIds));
    const units=[...project.groups.map(g=>project.nodes.filter(n=>g.nodeIds.includes(n.id))),...project.nodes.filter(n=>!grouped.has(n.id)).map(n=>[n])];
    const affected=units.filter(nodes=>{const b=visualBounds(nodes);return b[axis]+b[axis==='x'?'w':'h']>cut;}).flat();
    return {ids:affected.map(n=>n.id),locked:affected.filter(n=>n.locked).map(n=>n.id)};
  }
  function insertSpace(project,axis,cut,amount) {
    if(!Number.isFinite(amount)||amount<0)throw new Error('插入空间只能向下或向右增加');
    const plan=spacePlan(project,axis,cut);
    if(plan.locked.length)throw new Error('受影响的组件含有锁定对象，请先解锁');
    if(amount===0)return plan.ids;
    const next=copy(project),ids=new Set(plan.ids);
    next.nodes.forEach(n=>{if(ids.has(n.id))n[axis]+=amount;});
    next.edges.filter(isFreeEdge).forEach(e=>{for(const p of [e.fromPoint,e.toPoint])if(p[axis]>=cut)p[axis]+=amount;});
    const key=axis==='x'?'cx':'cy';
    next.steps.forEach(s=>{if(s.camera&&s.camera[key]>=cut)s.camera[key]+=amount;});
    const size=axis==='x'?'width':'height';next.canvas[size]+=amount;
    if(next.canvas[size]>50000)throw new Error('画布尺寸不能超过 50000');
    next.canvas=expandCanvas(next.canvas,contentNodes(next));
    if(next.canvas[size]>50000)throw new Error('画布尺寸不能超过 50000');
    validate(next);Object.assign(project,next);return plan.ids;
  }
  function splitEdge(project,edgeId,nodeId) {
    const original=project.edges.find(e=>e.id===edgeId),middle=project.nodes.find(n=>n.id===nodeId);
    if(original&&isFreeEdge(original)){
      if(!middle||edgeNodeIds(original).includes(nodeId))throw new Error('请选择线条端点以外的组件');
      const [a,b]=edgePoints(original,project.nodes),horizontal=Math.abs(b.x-a.x)>Math.abs(b.y-a.y);
      const entry=horizontal?(b.x>=a.x?'left':'right'):(b.y>=a.y?'top':'bottom'),exit={left:'right',right:'left',top:'bottom',bottom:'top'}[entry];
      const next=copy(original);next.id=uid('edge');next.label='';
      original.toAttachment=nodeId;original.toAnchor=entry;original.toPoint=anchor(middle,entry);
      next.fromAttachment=nodeId;next.fromAnchor=exit;next.fromPoint=anchor(middle,exit);
      const stage=project.steps[Math.max(project.steps.findIndex(s=>s.id===original.stepId),project.steps.findIndex(s=>s.id===middle.stepId))].id;
      original.stepId=next.stepId=stage;project.edges.splice(project.edges.indexOf(original)+1,0,next);
      return [original.id,next.id];
    }
    if(!original||!middle||[original.from,original.to].includes(nodeId))throw new Error('请选择连线端点以外的组件');
    if(project.edges.some(e=>e.id!==edgeId&&(e.from===original.from&&e.to===nodeId||e.from===nodeId&&e.to===original.to)))throw new Error('该组件已通过相同方向的连线连接');
    const from=project.nodes.find(n=>n.id===original.from),to=project.nodes.find(n=>n.id===original.to);
    const a=anchor(from,original.fromAnchor),b=anchor(to,original.toAnchor);
    const horizontal=Math.abs(b.x-a.x)>Math.abs(b.y-a.y);
    const entry=horizontal?(b.x>=a.x?'left':'right'):(b.y>=a.y?'top':'bottom');
    const exit={left:'right',right:'left',top:'bottom',bottom:'top'}[entry];
    const next=copy(original);next.id=uid('edge');next.from=nodeId;next.fromAnchor=exit;next.label='';
    original.to=nodeId;original.toAnchor=entry;
    // Each half becomes visible when both its endpoints and the old edge exist.
    const stage=(...ids)=>project.steps[Math.max(...ids.map(id=>project.steps.findIndex(s=>s.id===id)))].id;
    original.stepId=stage(original.stepId,from.stepId,middle.stepId);next.stepId=stage(next.stepId,middle.stepId,to.stepId);
    project.edges.splice(project.edges.indexOf(original)+1,0,next);
    if(to.parentId===from.id&&!middle.parentId) {
      let ancestor=from;const seen=new Set();
      while(ancestor&&!seen.has(ancestor.id)){seen.add(ancestor.id);ancestor=project.nodes.find(n=>n.id===ancestor.parentId);}
      if(!seen.has(middle.id)){middle.parentId=from.id;to.parentId=middle.id;}
    }
    return [original.id,next.id];
  }
  function junctionEdges(project,edgeId) {
    const edge=project.edges.find(e=>e.id===edgeId);
    return edge&&!isFreeEdge(edge)?project.edges.filter(e=>e.to===edge.to&&e.toAnchor===edge.toAnchor):[];
  }
  function spliceJunction(project,edgeIds,nodeId) {
    const next=copy(project),ids=new Set(edgeIds),lines=next.edges.filter(e=>ids.has(e.id));
    const middle=next.nodes.find(n=>n.id===nodeId),first=lines[0];
    if(ids.size<2||lines.length!==ids.size||lines.some(isFreeEdge)||!lines.every(e=>e.to===first.to&&e.toAnchor===first.toAnchor))throw new Error('请选择接入同一终点接口的至少两条箭头');
    if(!middle||lines.some(e=>[e.from,e.to].includes(nodeId)))throw new Error('请选择连线端点以外的组件');
    if(next.edges.some(e=>!ids.has(e.id)&&(e.from===nodeId&&e.to===first.to||lines.some(line=>e.from===line.from&&e.to===nodeId))))throw new Error('该组件已通过相同方向的连线连接');
    const target=next.nodes.find(n=>n.id===first.to);
    const stage=(...steps)=>next.steps[Math.max(...steps.map(id=>next.steps.findIndex(s=>s.id===id)))].id;
    const bridge=copy(first);bridge.id=uid('edge');bridge.from=nodeId;bridge.label='';
    bridge.fromAnchor={top:'bottom',bottom:'top',left:'right',right:'left'}[first.toAnchor];
    // The shared outgoing edge can appear as soon as any original branch can.
    const earliest=next.steps[Math.min(...lines.map(e=>next.steps.findIndex(s=>s.id===e.stepId)))].id;
    bridge.stepId=stage(earliest,middle.stepId,target.stepId);
    lines.forEach(e=>{e.to=nodeId;e.stepId=stage(e.stepId,middle.stepId,next.nodes.find(n=>n.id===e.from).stepId);});
    next.edges.push(bridge);
    if(lines.some(e=>e.from===target.parentId)&&!middle.parentId){
      let ancestor=next.nodes.find(n=>n.id===target.parentId);const seen=new Set();
      while(ancestor&&!seen.has(ancestor.id)){seen.add(ancestor.id);ancestor=next.nodes.find(n=>n.id===ancestor.parentId);}
      if(!seen.has(middle.id)){middle.parentId=target.parentId;target.parentId=middle.id;}
    }
    validate(next);Object.assign(project,next);return [...lines.map(e=>e.id),bridge.id];
  }
  function resizeCanvas(canvas,handle,dx,dy) {
    const box=canvasBounds(canvas),next={...canvas,x:box.x,y:box.y};
    const clamp=value=>Math.max(100,Math.min(50000,value));
    if(handle.includes('e'))next.width=clamp(box.w+dx);
    if(handle.includes('s'))next.height=clamp(box.h+dy);
    if(handle.includes('w')){next.width=clamp(box.w-dx);next.x=box.x+box.w-next.width;}
    if(handle.includes('n')){next.height=clamp(box.h-dy);next.y=box.y+box.h-next.height;}
    return next;
  }
  function anchor(n,side) {
    const points={top:[n.w/2,0],right:[n.w,n.h/2],bottom:[n.w/2,n.h],left:[0,n.h/2]};
    const [dx,dy]=points[side]||points.bottom;
    const angle=n.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    return{x:n.x+n.w/2+(dx-n.w/2)*c-(dy-n.h/2)*s,y:n.y+n.h/2+(dx-n.w/2)*s+(dy-n.h/2)*c};
  }
  function edgePath(item,nodes) {
    const from=nodes.find(n=>n.id===item.from),to=nodes.find(n=>n.id===item.to);
    if(!isFreeEdge(item)&&(!from||!to))return"";
    const [a,b]=edgePoints(item,nodes);
    if(item.route==="straight")return`M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    const vertical=["top","bottom"].includes(item.fromAnchor);
    if(item.route==="elbow")return vertical?`M ${a.x} ${a.y} V ${(a.y+b.y)/2} H ${b.x} V ${b.y}`:`M ${a.x} ${a.y} H ${(a.x+b.x)/2} V ${b.y} H ${b.x}`;
    const [c,d]=curveControls(item,nodes);
    return`M ${a.x} ${a.y} C ${c.x} ${c.y},${d.x} ${d.y},${b.x} ${b.y}`;
  }
  function curveControls(item,nodes) {
    const [a,b]=edgePoints(item,nodes),distance=Math.max(50,Math.hypot(a.x-b.x,a.y-b.y)*.4);
    const vectors={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]};
    const av=vectors[item.fromAnchor],bv=vectors[item.toAnchor],offset=item.curveOffset||{x:0,y:0};
    return [{x:a.x+av[0]*distance+offset.x*4/3,y:a.y+av[1]*distance+offset.y*4/3},{x:b.x+bv[0]*distance+offset.x*4/3,y:b.y+bv[1]*distance+offset.y*4/3}];
  }
  function edgeMidpoint(item,nodes) {
    const [a,b]=edgePoints(item,nodes);
    if(item.route!=='curve')return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const [c,d]=curveControls(item,nodes);
    return {x:(a.x+b.x)/8+(c.x+d.x)*3/8,y:(a.y+b.y)/8+(c.y+d.y)*3/8};
  }
  function bendEdgeTo(item,nodes,point) {
    const base=edgeMidpoint({...item,route:'curve',curveOffset:{x:0,y:0}},nodes);
    item.route='curve';item.curveOffset={x:point.x-base.x,y:point.y-base.y};
  }
  function remove(project,ids) {
    const set=new Set(ids);
    project.nodes=project.nodes.filter(n=>!set.has(n.id));
    project.nodes.forEach(n=>{if(set.has(n.parentId))n.parentId=null;});
    project.edges=project.edges.filter(e=>!set.has(e.id)&&!edgeNodeIds(e).some(id=>set.has(id)));
    project.groups.forEach(g=>g.nodeIds=g.nodeIds.filter(id=>!set.has(id)));
    project.groups=project.groups.filter(g=>g.nodeIds.length>1);
    repairActions(project);
  }
  function duplicate(project,ids,offset=35) {
    return pasteFragment(project,copyFragment(project,ids),project.steps[0].id,offset);
  }
  function repairActions(project) {
    for(const n of project.nodes) {
      const a=n.action;
      if(a.type==='step'&&!project.steps.some(s=>s.id===a.value)||a.type==='group'&&!project.groups.some(g=>g.id===a.value)||a.type==='image'&&a.value&&!project.assets[a.value])n.action={type:'none',value:''};
    }
  }
  function copyFragment(project,ids) {
    const set=new Set(ids),nodes=project.nodes.filter(n=>set.has(n.id));
    const assetIds=new Set(nodes.flatMap(n=>[n.assetId,n.afterAssetId,n.action.type==='image'?n.action.value:null]).filter(Boolean));
    return copy({sourceProjectId:project.id,nodes,edges:project.edges.filter(e=>edgeNodeIds(e).length&&edgeNodeIds(e).every(id=>set.has(id))),groups:project.groups.filter(g=>g.nodeIds.every(id=>set.has(id))),assets:Object.fromEntries([...assetIds].filter(id=>project.assets[id]).map(id=>[id,project.assets[id]]))});
  }
  function pasteFragment(project,fragment,stepId,offset=40) {
    const draft=copy(project),content=copy(fragment),same=content.sourceProjectId===project.id;
    const nodeIds=new Map(content.nodes.map(n=>[n.id,uid()])),groupIds=new Map(content.groups.map(g=>[g.id,uid('group')])),assetIds=new Map();
    for(const [id,asset] of Object.entries(content.assets||{})) {
      const next=draft.assets[id]&&JSON.stringify(draft.assets[id])!==JSON.stringify(asset)?uid('asset'):id;
      assetIds.set(id,next);draft.assets[next]=asset;
    }
    function timing(item) {
      item.stepId=same&&draft.steps.some(s=>s.id===item.stepId)?item.stepId:stepId;
      if(!same||!draft.steps.some(s=>s.id===item.endStepId))item.endStepId='';
    }
    for(const n of content.nodes) {
      n.id=nodeIds.get(n.id);n.x+=offset;n.y+=offset;n.parentId=nodeIds.get(n.parentId)||null;timing(n);
      if(n.assetId)n.assetId=assetIds.get(n.assetId)||n.assetId;
      if(n.afterAssetId)n.afterAssetId=assetIds.get(n.afterAssetId)||n.afterAssetId;
      if(n.action.type==='image'&&n.action.value)n.action.value=assetIds.get(n.action.value)||n.action.value;
      if(n.action.type==='group') {
        if(groupIds.has(n.action.value))n.action.value=groupIds.get(n.action.value);
        else if(!same)n.action={type:'none',value:''};
      }
      if(n.action.type==='step'&&!same)n.action={type:'none',value:''};
    }
    for(const e of content.edges){
      e.id=uid('edge');
      if(isFreeEdge(e))for(const end of ['from','to']){e[end+'Point'].x+=offset;e[end+'Point'].y+=offset;if(e[end+'Attachment'])e[end+'Attachment']=nodeIds.get(e[end+'Attachment']);}
      else{e.from=nodeIds.get(e.from);e.to=nodeIds.get(e.to);}
      timing(e);
    }
    for(const g of content.groups){g.id=groupIds.get(g.id);g.nodeIds=g.nodeIds.map(id=>nodeIds.get(id));}
    draft.nodes.push(...content.nodes);draft.edges.push(...content.edges);draft.groups.push(...content.groups);
    repairActions(draft);validate(draft);Object.assign(project,draft);return content.nodes.map(n=>n.id);
  }
  function animationPlan(project,stepId) {
    const items=[...project.nodes,...project.edges].filter(n=>n.stepId===stepId);
    const order=project.steps.find(s=>s.id===stepId)?.animationOrder||[];
    const rank=new Map(order.map((id,i)=>[id,i]));
    items.sort((a,b)=>(rank.get(a.id)??order.length)-(rank.get(b.id)??order.length));
    let previousStart=0,previousEnd=0;
    return items.map(item=>{
      const animation=item.animation,mode=animation.start||'step';
      const start=(mode==='after'?previousEnd:mode==='with'?previousStart:0)+animation.delay;
      const end=start+(animation.type==='none'?0:animation.duration);
      previousStart=start;previousEnd=end;return {id:item.id,start,end};
    });
  }
  function snapMove(moving,targets,dx,dy,tolerance) {
    if(!moving.length||!targets.length)return {dx,dy,guides:[]};
    const box=visualBounds(moving),guides=[];
    for(const [axis,size] of [['x','w'],['y','h']]) {
      let best=tolerance,correction=0,guide=null;
      const delta=axis==='x'?dx:dy;
      for(const target of targets){const other=visualBounds([target]);
        for(const a of [box[axis],box[axis]+box[size]/2,box[axis]+box[size]])for(const b of [other[axis],other[axis]+other[size]/2,other[axis]+other[size]]){
          const distance=b-(a+delta);
          if(Math.abs(distance)<best){best=Math.abs(distance);correction=distance;guide={axis,value:b};}
        }
      }
      if(axis==='x')dx+=correction;else dy+=correction;if(guide)guides.push(guide);
    }
    return {dx,dy,guides};
  }
  function group(project,ids,name="组合") {
    const set=new Set(ids);if(set.size<2)return null;
    project.groups.forEach(g=>g.nodeIds=g.nodeIds.filter(id=>!set.has(id)));
    project.groups=project.groups.filter(g=>g.nodeIds.length>1);
    const item={id:uid("group"),name,nodeIds:[...set]};project.groups.push(item);repairActions(project);return item;
  }
  function ungroup(project,ids) {const set=new Set(ids);project.groups=project.groups.filter(g=>!g.nodeIds.some(id=>set.has(id)));repairActions(project);}
  function insertStep(project,afterId,nodeIds=[]) {
    const index=project.steps.findIndex(s=>s.id===afterId),selected=new Set(nodeIds);
    if(index<0)throw new Error('插入位置对应的步骤不存在');
    if([...selected].some(id=>!project.nodes.some(n=>n.id===id)))throw new Error('所选组件不存在');
    const next=copy(project),step={id:uid('step'),name:'新步骤',duration:6000,note:'',camera:null};
    next.steps.splice(index+1,0,step);
    next.nodes.forEach(n=>{if(selected.has(n.id))n.stepId=step.id;});
    const stage=id=>next.steps.findIndex(s=>s.id===id);
    // Internal lines belong to the new step; external lines must wait for both endpoints.
    next.edges.forEach(e=>{
      if(selected.has(e.from)&&selected.has(e.to))e.stepId=step.id;
      else if(selected.has(e.from)||selected.has(e.to)){
        const from=next.nodes.find(n=>n.id===e.from),to=next.nodes.find(n=>n.id===e.to);
        e.stepId=next.steps[Math.max(stage(e.stepId),stage(from.stepId),stage(to.stepId))].id;
      }
    });
    validate(next);Object.assign(project,next);return step.id;
  }
  function reorderStep(project,id,beforeId=null) {
    const index=project.steps.findIndex(s=>s.id===id);
    if(index<0||beforeId!==null&&!project.steps.some(s=>s.id===beforeId))throw new Error('要移动的步骤或插入位置不存在');
    if(id===beforeId)return;
    const [step]=project.steps.splice(index,1);
    project.steps.splice(beforeId===null?project.steps.length:project.steps.findIndex(s=>s.id===beforeId),0,step);
  }
  function deleteStep(project,id) {
    if(project.steps.length===1)return;
    const index=project.steps.findIndex(s=>s.id===id);if(index<0)return;
    const replacement=project.steps[index===0?1:index-1].id;
    const next=project.steps[index+1]?.id||'';
    [...project.nodes,...project.edges].forEach(n=>{if(n.stepId===id)n.stepId=replacement;if(n.endStepId===id)n.endStepId=next;});
    project.steps.splice(index,1);
    project.nodes.forEach(n=>{if(n.action.type==='step'&&n.action.value===id)n.action.value=replacement;});
  }
  function sanitizeSvg(source) {
    const doc=new DOMParser().parseFromString(source,"image/svg+xml");
    if(doc.querySelector("parsererror")||doc.documentElement.localName!=="svg")throw new Error("SVG 文件无法解析");
    doc.querySelectorAll("script,style,foreignObject,iframe,audio,video,animate,set,animateTransform").forEach(n=>n.remove());
    doc.querySelectorAll("*").forEach(el=>[...el.attributes].forEach(attr=>{
      if(/^on/i.test(attr.name)||/href$/i.test(attr.name)&&!attr.value.startsWith("#")||/url\(\s*[^#]/i.test(attr.value))el.removeAttribute(attr.name);
    }));
    return new XMLSerializer().serializeToString(doc.documentElement);
  }
  function validate(input) {
    const p=copy(input);
    const require=(condition,message)=>{if(!condition)throw new Error(message);};
    const finite=(value)=>typeof value==="number"&&Number.isFinite(value);
    const color=value=>typeof value==="string"&&(value==="transparent"||/^#[a-f\d]{3,8}$/i.test(value));
    require(p&&p.schemaVersion===1,"不支持的项目版本");
    require(typeof p.id==="string"&&typeof p.title==="string","项目标识或名称缺失");
    require(p.canvas&&finite(p.canvas.width)&&finite(p.canvas.height)&&p.canvas.width>=100&&p.canvas.height>=100&&p.canvas.width<=50000&&p.canvas.height<=50000,"画布宽高须为 100–50000");
    require([p.canvas.x??0,p.canvas.y??0].every(v=>finite(v)&&Math.abs(v)<=100000),"画布起点须为有效坐标");
    require(color(p.canvas.background),"画布颜色无效");
    require(Array.isArray(p.nodes)&&Array.isArray(p.edges)&&Array.isArray(p.groups)&&Array.isArray(p.steps)&&p.steps.length>0,"项目组件结构缺失");
    require(p.assets&&typeof p.assets==="object"&&!Array.isArray(p.assets),"素材结构无效");
    const unique=items=>new Set(items.map(i=>i.id)).size===items.length&&items.every(i=>typeof i.id==="string");
    require(unique(p.nodes)&&unique(p.edges)&&unique(p.groups)&&unique(p.steps),"组件、连线、组合和步骤的 ID 须各自唯一");
    const nodeIds=new Set(p.nodes.map(n=>n.id)),stepIds=new Set(p.steps.map(s=>s.id));
    p.steps.forEach(s=>{require(typeof s.name==="string"&&typeof s.note==="string"&&finite(s.duration)&&s.duration>=300&&s.duration<=3600000,"步骤内容或时长无效");if(s.camera)require([s.camera.cx,s.camera.cy,s.camera.zoom].every(finite)&&s.camera.zoom>0,"步骤视角无效");});
    p.steps.forEach(s=>require(s.transition==null||TRANSITIONS.includes(s.transition),'镜头过渡方式无效'));
    p.steps.forEach(s=>require(s.animationOrder==null||Array.isArray(s.animationOrder)&&s.animationOrder.every(id=>typeof id==='string')&&new Set(s.animationOrder).size===s.animationOrder.length,'动效顺序须为不重复的对象 ID 列表'));
    Object.values(p.assets).forEach(a=>require(a&&typeof a.name==="string"&&typeof a.data==="string"&&/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[a-z\d+/=]+$/i.test(a.data)&&finite(a.width)&&finite(a.height)&&a.width>0&&a.height>0,"素材必须是含宽高的内嵌图片"));
    const animation=a=>a&&ANIMATIONS.includes(a.type)&&[a.duration,a.delay].every(finite)&&a.duration>=0&&a.duration<=60000&&a.delay>=0&&a.delay<=60000&&(a.start==null||['step','with','after'].includes(a.start));
    p.nodes.forEach(n=>{
      require(TYPES.includes(n.type)&&typeof n.name==="string"&&stepIds.has(n.stepId),"组件类型、名称或步骤无效");
      require([n.x,n.y,n.w,n.h,n.rotation].every(finite)&&n.w>=1&&n.h>=1&&Math.abs(n.x)<=100000&&Math.abs(n.y)<=100000&&n.w<=50000&&n.h<=50000,"组件位置或尺寸无效");
      require(n.style&&[n.style.fill,n.style.color,n.style.border].every(color),"组件颜色无效");
      require([n.style.borderWidth,n.style.radius,n.style.opacity,n.style.fontSize,n.style.fontWeight,n.style.lineHeight,n.style.padding,n.style.shadow].every(finite)&&n.style.fontSize>0&&n.style.opacity>=0&&n.style.opacity<=1,"组件样式数值无效");
      require(typeof n.style.fontFamily==="string"&&["left","center","right"].includes(n.style.align),"字体或对齐方式无效");
      require(animation(n.animation),"动画参数无效");
      require(n.action&&["none","note","image","link","step","group"].includes(n.action.type)&&typeof n.action.value==="string","交互设置无效");
      if(n.parentId)require(nodeIds.has(n.parentId)&&n.parentId!==n.id,"父节点无效");
      if(["text","button","flip"].includes(n.type))require(typeof n.text==="string","文字内容缺失");
      require(n.loop==null||Boolean(n.loop)&&LOOPS.includes(n.loop.type)&&(n.loop.duration==null||finite(n.loop.duration)&&n.loop.duration>=300&&n.loop.duration<=60000),"持续动效参数无效");
      require(n.hint==null||typeof n.hint==="string","悬停说明须为文字");
      require(n.style.glass==null||finite(n.style.glass)&&n.style.glass>=0&&n.style.glass<=60,"毛玻璃模糊须为 0–60");
      if(n.type==="compare")require([n.assetId,n.afterAssetId].every(id=>typeof id==="string"&&(!id||Object.hasOwn(p.assets,id)))&&finite(n.split)&&n.split>=0&&n.split<=100&&[n.labelBefore,n.labelAfter].every(v=>typeof v==="string")&&["contain","cover","fill"].includes(n.fit),"前后对比的图片、标签或分割位置无效");
      if(n.type==="counter")require([n.value,n.from,n.decimals,n.countDuration].every(finite)&&Number.isInteger(n.decimals)&&n.decimals>=0&&n.decimals<=6&&n.countDuration>=0&&n.countDuration<=60000&&[n.prefix,n.suffix].every(v=>typeof v==="string")&&typeof n.grouping==="boolean","数字滚动参数无效");
      if(n.type==="flip")require(typeof n.backText==="string"&&color(n.backFill)&&color(n.backColor),"翻转卡片背面设置无效");
      if(n.type==="chart")require(["bar","line"].includes(n.chartType)&&Array.isArray(n.data)&&n.data.length>=1&&n.data.length<=40&&n.data.every(d=>d&&typeof d.label==="string"&&finite(d.value))&&typeof n.unit==="string"&&color(n.chartColor)&&typeof n.showValues==="boolean","图表数据须为 1–40 组“标签 + 数值”");
      if(n.type==="shape")require(["rect","ellipse","diamond"].includes(n.shape),"形状无效");
      if(n.type==="icon")require(Object.hasOwn(ICONS,n.icon)&&finite(n.strokeWidth)&&n.strokeWidth>0,"图标无效");
      if(n.type==="image")require((!n.assetId||Object.hasOwn(p.assets,n.assetId))&&["contain","cover","fill"].includes(n.fit)&&[n.positionX,n.positionY].every(finite),"图片素材或裁切参数无效");
      if(n.type==="table")require(Array.isArray(n.cells)&&n.cells.length>0&&n.cells.every(row=>Array.isArray(row)&&row.length===n.cells[0].length&&row.length>0&&row.every(cell=>typeof cell==="string"))&&color(n.headerFill),"表格需为列数一致的文字数组");
    });
    p.nodes.forEach(n=>{const seen=new Set([n.id]);let parent=n.parentId;while(parent){require(!seen.has(parent),"父子节点存在循环");seen.add(parent);parent=p.nodes.find(item=>item.id===parent)?.parentId;}});
    const point=p=>p&&[p.x,p.y].every(v=>finite(v)&&Math.abs(v)<=100000);
    [...p.nodes,...p.edges].forEach(item=>require(item.endStepId==null||item.endStepId===''||stepIds.has(item.endStepId),'退场步骤不存在'));
    p.edges.forEach(e=>{for(const key of ['fromAttachment','toAttachment'])require(!e[key]||(isFreeEdge(e)&&nodeIds.has(e[key])),"自由线关联组件无效");});
    p.edges.forEach(e=>require(e.curveOffset==null||point(e.curveOffset),'曲线弯曲参数无效'));
    p.edges.forEach(e=>{for(const key of ['fromAttachment','toAttachment'])require(!e[key]||(isFreeEdge(e)&&nodeIds.has(e[key])),"自由线关联组件无效");});
    p.edges.forEach(e=>require((isFreeEdge(e)?point(e.fromPoint)&&point(e.toPoint):nodeIds.has(e.from)&&nodeIds.has(e.to)&&e.from!==e.to)&&stepIds.has(e.stepId)&&["top","right","bottom","left"].includes(e.fromAnchor)&&["top","right","bottom","left"].includes(e.toAnchor)&&["straight","elbow","curve"].includes(e.route)&&color(e.color)&&finite(e.width)&&e.width>0&&typeof e.label==="string"&&finite(e.labelSize)&&animation(e.animation)&&(e.flow==null||FLOWS.includes(e.flow)),"连线数据无效"));
    const grouped=new Set();p.groups.forEach(g=>{require(typeof g.name==="string"&&Array.isArray(g.nodeIds)&&g.nodeIds.length>1,"组合数据无效");g.nodeIds.forEach(id=>{require(nodeIds.has(id)&&!grouped.has(id),"组合包含重复或不存在的组件");grouped.add(id);});});
    return p;
  }
  function serialize(project) {return JSON.stringify(project,null,2).replaceAll("<","\\u003c");}
  function parseProjectFile(text) {
    text=String(text).replace(/^\uFEFF/,'').trim();
    if(text.startsWith('{'))return validate(JSON.parse(text));
    // Extract data only. Never load or execute the supplied HTML.
    const matches=[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(m=>/\bid\s*=\s*(["'])seed-project\1/i.test(m[1])&&/\btype\s*=\s*(["'])application\/json\1/i.test(m[1]));
    if(matches.length!==1)throw new Error('请选择项目 JSON 或本工作台导出的 HTML。普通网页没有可编辑项目数据，无法还原为组件。');
    return validate(JSON.parse(matches[0][2]));
  }
  const api={uid,copy,TYPES,ANIMATIONS,LOOPS,FLOWS,TRANSITIONS,ICONS,ICON_NAMES,newProject,node,edge,isFreeEdge,edgeNodeIds,detachedEdge,freeEdge,edgePoints,curveControls,edgeMidpoint,bendEdgeTo,contentNodes,visibleAt,bounds,visualBounds,canvasBounds,expandCanvas,spacePlan,insertSpace,splitEdge,junctionEdges,spliceJunction,resizeCanvas,anchor,edgePath,remove,duplicate,copyFragment,pasteFragment,repairActions,animationPlan,snapMove,group,ungroup,insertStep,reorderStep,deleteStep,validate,serialize,parseProjectFile,sanitizeSvg};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else global.StudioCore=api;
})(globalThis);
