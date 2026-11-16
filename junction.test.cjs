const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('./core.js');
const p=C.newProject('汇合点与图层多选验收'),s=p.steps[0].id;
p.canvas={width:1200,height:1000,background:'#f7f6f1',snap:false,grid:false};
p.steps.push({...C.copy(p.steps[0]),id:'later',name:'稍后出现的分支'});
const make=(id,text,x,y,step=s)=>{const n=C.node('text',x,y,step,{text,name:text});Object.assign(n,{id,w:220,h:90});Object.assign(n.style,{fill:'#ffffff',borderWidth:1,align:'center',fontSize:28});return n;};
p.nodes=[make('a','方向 A',180,100),make('b','方向 B',730,100,'later'),make('c','共同终点',455,700),make('m','待插入组件',40,410)];
p.nodes[2].parentId='a';
p.edges=[C.edge('a','c',s,{id:'ac',label:'证据 A',color:'#7655b4',toAnchor:'top',route:'straight'}),C.edge('b','c','later',{id:'bc',label:'证据 B',color:'#248477',dash:true,toAnchor:'top',route:'straight'})];
const original=C.copy(p),ids=C.spliceJunction(p,['ac','bc'],'m');
assert.equal(ids.length,3);assert.equal(p.edges.length,3);
assert.deepEqual(p.edges.map(e=>[e.from,e.to]),[['a','m'],['b','m'],['m','c']]);
for(let i=0;i<2;i++){assert.equal(p.edges[i].id,original.edges[i].id);assert.equal(p.edges[i].color,original.edges[i].color);assert.equal(p.edges[i].label,original.edges[i].label);assert.equal(p.edges[i].dash,original.edges[i].dash);}
assert.equal(p.edges[2].label,'');assert.equal(p.edges[2].stepId,s);assert.equal(p.edges[1].stepId,'later');
assert.equal(p.nodes[2].parentId,'m');assert.equal(p.nodes[3].parentId,'a');
assert.deepEqual(C.parseProjectFile(C.serialize(p)),p);
for(const kind of ['endpoint','different-port','duplicate','missing','single']){
  const bad=C.copy(original);let node='m',edges=['ac','bc'];
  if(kind==='endpoint')node='a';
  if(kind==='different-port')bad.edges[1].toAnchor='left';
  if(kind==='duplicate')bad.edges.push(C.edge('a','m',s));
  if(kind==='missing')edges.push('missing');
  if(kind==='single')edges=['ac'];
  const before=C.copy(bad);assert.throws(()=>C.spliceJunction(bad,edges,node));assert.deepEqual(bad,before);
}
const ports=C.copy(original);ports.edges[1].toAnchor='left';assert.equal(C.junctionEdges(ports,'ac').length,1);
const late=C.copy(original);late.nodes[3].stepId='later';C.spliceJunction(late,['ac','bc'],'m');assert(late.edges.every(e=>e.stepId==='later'));
const three=C.copy(original);three.nodes.push(make('d','第三分支',450,100));three.edges.push(C.edge('d','c',s,{id:'dc',toAnchor:'top'}));C.spliceJunction(three,['ac','bc','dc'],'m');assert.equal(three.edges.length,4);
console.log('PASS: junction fan-in, styles, labels, steps, ancestry, atomic rejection, same-port detection, three branches, JSON roundtrip');
if(process.argv.includes('--fixture')){
  for(let i=0;i<20;i++){const step={...C.copy(original.steps[0]),id:'step-'+i,name:'步骤 '+(i+3)};original.steps.push(step);original.nodes.push(make('extra-'+i,'附加组件 '+(i+1),1400+i*260,200,step.id));}
  C.group(original,['extra-0','extra-1'],'示例组合');
  fs.mkdirSync(__dirname+'/desktop/qa-output',{recursive:true});fs.writeFileSync(__dirname+'/desktop/qa-output/junction.json',C.serialize(original));
}
