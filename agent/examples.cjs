'use strict';
// Run with Node.js; this script never writes the live desktop project store.
const fs=require('node:fs');
const path=require('node:path');
const C=require(fs.existsSync(path.join(__dirname,'core.js'))?'./core.js':'../core.js');

function buildDemo(){
  const p=C.newProject('Agent 教程 · 组件与步骤示例');
  p.id='agent-tutorial-demo';
  p.canvas={x:0,y:0,width:1200,height:1500,background:'#f7f6f1',grid:false,snap:false};
  p.steps=[{id:'intro',name:'提出问题',duration:6000,note:'标题、问题卡片和图标均可单独编辑。',camera:{cx:600,cy:180,zoom:.8}},
    {id:'method',name:'方法与证据',duration:7000,note:'两条入线汇合到方法节点。图片可点击放大。',camera:{cx:600,cy:700,zoom:.65}},
    {id:'summary',name:'结果与补充',duration:6000,note:'表格和按钮是独立组件。',camera:{cx:600,cy:1190,zoom:.75}}];
  function add(type,id,name,x,y,w,h,stepId,fields={},style={}){
    const n=C.node(type,x,y,stepId);
    Object.assign(n,{id,name,w,h},fields);Object.assign(n.style,style);p.nodes.push(n);return n;
  }
  add('text','title','主题',90,40,1020,90,'intro',{text:'如何把复杂工作讲清楚？'},{fontSize:42,fontWeight:700});
  add('shape','question-bg','问题背景',90,160,1020,160,'intro',{}, {fill:'#eee8f7',borderWidth:0,radius:20});
  add('icon','question-icon','问题图标',120,200,65,65,'intro',{icon:'question'});
  add('text','question-text','问题文字',210,190,850,100,'intro',{text:'先提出问题，再展示方法和证据。'},{fontSize:30,padding:12});
  C.group(p,['question-bg','question-icon','question-text'],'问题卡片').id='question-group';
  add('text','a','方向 A',130,400,390,100,'method',{text:'方向 A：模型生成候选'},{fill:'#ffffff',borderWidth:1,align:'center'});
  add('text','b','方向 B',680,400,390,100,'method',{text:'方向 B：约束检查行为'},{fill:'#ffffff',borderWidth:1,align:'center'});
  add('text','merge','汇合方法',380,620,440,100,'method',{text:'合并两类信息'},{fill:'#e8e0f4',fontWeight:700,align:'center'});
  p.edges.push(C.edge('a','merge','method',{id:'a-merge',label:'候选',color:'#805eb4'}),C.edge('b','merge','method',{id:'b-merge',label:'约束',color:'#398579',dash:true}));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240"><rect width="800" height="240" rx="20" fill="#e8edf4"/><text x="400" y="130" text-anchor="middle" font-size="40" fill="#425473">SOURCE → TARGET</text></svg>';
  p.assets['demo-figure']={name:'示例示意图（非论文原图）',width:800,height:240,data:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')};
  add('image','figure','图 1 · 示例示意图',200,790,800,240,'method',{assetId:'demo-figure',action:{type:'image',value:'demo-figure'}});
  add('table','results','结果表',130,1090,940,170,'summary',{cells:[['对照','结果'],['仅生成','需要进一步检查'],['加入约束','局部修复后再测试']]},{fontSize:23});
  add('button','details','补充说明按钮',130,1310,280,60,'summary',{text:'查看补充说明',action:{type:'note',value:'这是示例说明。文本直接保存在 action.value 中，不是 HTML。'}});
  add('button','back','回到问题按钮',450,1310,260,60,'summary',{text:'回到问题',action:{type:'step',value:'intro'}});
  add('button','toggle','切换问题卡片',750,1310,320,60,'summary',{text:'显示 / 隐藏问题卡片',action:{type:'group',value:p.groups[0].id}});
  p.nodes.filter(n=>n.stepId==='method').forEach((n,i)=>{n.animation={type:'rise',duration:600,delay:i*120};});
  return C.validate(p);
}

function audit(input){
  const p=C.validate(input),warnings=[];
  const steps=new Set(p.steps.map(s=>s.id)),groups=new Set(p.groups.map(g=>g.id));
  for(const n of p.nodes){
    const a=n.action;
    if(a.type==='step'&&!steps.has(a.value))throw new Error(n.id+': 跳转步骤不存在');
    if(a.type==='group'&&!groups.has(a.value))throw new Error(n.id+': 交互组合不存在');
    if(a.type==='image'&&!p.assets[a.value||n.assetId])throw new Error(n.id+': 放大图片素材不存在');
    if(a.type==='link'){const url=new URL(a.value);if(!['http:','https:'].includes(url.protocol))throw new Error(n.id+': 网页地址须为 http(s)');}
    if(n.type==='image'&&!n.assetId)warnings.push(n.id+': 图片框尚未指定素材');
  }
  const box=C.visualBounds(p.nodes),canvas=C.canvasBounds(p.canvas);
  if(p.nodes.length&&(box.x<canvas.x||box.y<canvas.y||box.x+box.w>canvas.x+canvas.w||box.y+box.h>canvas.y+canvas.h))warnings.push('部分组件超出画布范围，可调用 expandCanvas');
  return {title:p.title,nodes:p.nodes.length,edges:p.edges.length,steps:p.steps.map(s=>({id:s.id,name:s.name,nodes:p.nodes.filter(n=>n.stepId===s.id).length})),warnings};
}

function selfTest(){
  const assert=require('node:assert/strict'),p=buildDemo();
  assert.deepEqual(new Set(p.nodes.map(n=>n.type)),new Set(C.TYPES));
  assert.deepEqual(audit(p).warnings,[]);
  const modified=C.copy(p),s=C.insertStep(modified,'intro',['a','b']);
  C.reorderStep(modified,s,'method');audit(modified);
  C.insertSpace(modified,'y',600,100);audit(modified);
  const m=C.node('text',400,600,'method');modified.nodes.push(m);
  C.spliceJunction(modified,['a-merge','b-merge'],m.id);audit(modified);
  const broken=C.copy(p);broken.nodes.find(n=>n.id==='back').action.value='missing';assert.throws(()=>audit(broken),/不存在/);
  assert.deepEqual(C.parseProjectFile(C.serialize(p)),p);
  console.log('PASS: all six components, assets, actions, step/space/junction recipes, reference audit and roundtrip');
}

if(require.main===module){
  try{
    const [cmd,file]=process.argv.slice(2);
    if(cmd==='demo'&&file){const p=buildDemo();audit(p);fs.writeFileSync(path.resolve(file),C.serialize(p),{encoding:'utf8',flag:'wx'});console.log('Created '+path.resolve(file));}
    else if(cmd==='check'&&file)console.log(JSON.stringify(audit(C.parseProjectFile(fs.readFileSync(path.resolve(file),'utf8'))),null,2));
    else if(cmd==='self-test')selfTest();
    else {console.error('Usage: node examples.cjs demo NEW_FILE.json | check PROJECT.json-or-html | self-test');process.exitCode=1;}
  }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={buildDemo,audit};
