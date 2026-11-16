const assert=require('node:assert/strict');
const C=require('./core.js');
const p=C.newProject('布局验收'),s=p.steps[0].id;
p.canvas={width:800,height:900,background:'#f7f6f1',snap:false,grid:false};
const a=C.node('text',350,100,s,{text:'A',name:'A'}),b=C.node('text',350,650,s,{text:'B',name:'B'}),m=C.node('text',60,350,s,{text:'插入节点',name:'插入节点'});
for(const n of [a,b,m]){n.w=180;n.h=100;n.style.fill='#ffffff';n.style.borderWidth=1;n.style.align='center';}
p.nodes.push(a,b,m);b.parentId=a.id;
const line=C.edge(a.id,b.id,s,{label:'原连线标注',dash:true,color:'#915cc1',width:3});p.edges.push(line);
const initial=C.copy(p);

// Dragging past any boundary includes the object and keeps the old canvas.
for(const [x,y] of [[-130,300],[850,300],[200,-150],[200,1000]]){
  const n={...a,x,y};const canvas=C.expandCanvas(p.canvas,[n]);
  assert(canvas.x<=Math.min(0,x));assert(canvas.y<=Math.min(0,y));
  assert(canvas.x+canvas.width>=Math.max(800,x+n.w));assert(canvas.y+canvas.height>=Math.max(900,y+n.h));
}
const rotated={...a,x:-10,y:0,rotation:45};const rb=C.visualBounds([rotated]),rc=C.expandCanvas(p.canvas,[rotated]);assert(rc.x<=rb.x&&rc.y<=rb.y);
assert.deepEqual(C.expandCanvas(p.canvas,[a]),{...p.canvas,x:0,y:0});

// Crossing a group moves it as a unit and shifts saved presentation cameras.
C.group(p,[a.id,m.id],'整体卡片');p.steps[0].camera={cx:440,cy:700,zoom:1};
const gapBefore=C.copy(p);C.insertSpace(p,'y',300,120);
for(const n of p.nodes)assert.equal(n.y,gapBefore.nodes.find(o=>o.id===n.id).y+120);
assert.equal(p.canvas.height,1020);assert.equal(p.steps[0].camera.cy,820);assert.equal(p.edges[0].from,a.id);
p.nodes[0].locked=true;const lockedBefore=C.copy(p);
assert.throws(()=>C.insertSpace(p,'x',400,120),/锁定/);assert.deepEqual(p,lockedBefore);
assert.throws(()=>C.insertSpace(p,'y',100,-10),/只能/);
const tooLarge=C.copy(initial);assert.throws(()=>C.insertSpace(tooLarge,'y',300,50000),/50000/);assert.deepEqual(tooLarge,initial);

// Splicing retains identity/style/label once, updates tree ancestry, respects later steps.
const chain=C.copy(initial);chain.steps.push({...C.copy(chain.steps[0]),id:'later',name:'新组件'});chain.nodes[2].stepId='later';
const ids=C.splitEdge(chain,line.id,m.id);assert.equal(ids[0],line.id);assert.equal(chain.edges.length,2);
assert.deepEqual(chain.edges.map(e=>[e.from,e.to]),[[a.id,m.id],[m.id,b.id]]);
assert.equal(chain.edges[0].label,'原连线标注');assert.equal(chain.edges[1].label,'');
assert(chain.edges.every(e=>e.color===line.color&&e.dash===line.dash&&e.width===line.width&&e.stepId==='later'));
assert.equal(chain.nodes[1].parentId,m.id);assert.equal(chain.nodes[2].parentId,a.id);
C.validate(chain);assert.deepEqual(C.parseProjectFile(C.serialize(chain)),chain);
assert.throws(()=>C.splitEdge(chain,ids[0],a.id),/端点/);
const duplicate=C.copy(initial);duplicate.edges.push(C.edge(a.id,m.id,s));assert.throws(()=>C.splitEdge(duplicate,line.id,m.id),/相同方向/);
console.log('PASS: four-side growth, rotation, whole-group space insertion, locks, cameras, limits, edge splicing and roundtrip');
if(process.argv.includes('--fixture'))require('node:fs').writeFileSync(require('node:path').join(__dirname,'desktop/test-layout.json'),C.serialize(initial));
