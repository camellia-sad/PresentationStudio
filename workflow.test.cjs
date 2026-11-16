const assert=require('node:assert/strict');
const {test}=require('node:test');
const C=require('./core.js');
function sample(){
  const p=C.newProject('Workflow regression'),step=p.steps[0].id;
  const a=C.node('text',10,20,step),b=C.node('shape',20,30,step),button=C.node('button',40,50,step);
  p.nodes.push(a,b,button);const g=C.group(p,[a.id,b.id]);button.action={type:'group',value:g.id};
  return {p,a,b,button,g,step};
}
test('duplicate redirects group interactions to the duplicated group and undo snapshot survives',()=>{
  const {p,button,g}=sample(),before=C.copy(p);
  const ids=C.duplicate(p,p.nodes.map(n=>n.id)),copy=p.nodes.find(n=>ids.includes(n.id)&&n.type==='button');
  assert.notEqual(copy.action.value,g.id);assert(p.groups.some(g=>g.id===copy.action.value));
  assert.equal(button.action.value,g.id);assert.equal(before.groups.length,1);C.validate(p);
});
test('cross-project paste remaps assets and clears links to unavailable external steps',()=>{
  const {p,a,b,button,step}=sample();p.assets.asset={name:'image',data:'data:image/png;base64,AA==',width:1,height:1};
  a.action={type:'image',value:'asset'};b.action={type:'step',value:step};
  const fragment=C.copyFragment(p,p.nodes.map(n=>n.id)),target=C.newProject('Target');
  target.assets.asset={name:'different',data:'data:image/png;base64,AQ==',width:1,height:1};
  const ids=C.pasteFragment(target,fragment,target.steps[0].id);
  assert.equal(target.assets.asset.name,'different');
  const pasted=target.nodes.find(n=>ids.includes(n.id)&&n.action.type==='image');
  assert.notEqual(pasted.action.value,'asset');assert.equal(target.assets[pasted.action.value].name,'image');
  assert.equal(target.nodes.find(n=>n.type==='shape').action.type,'none');
  assert(target.groups.some(g=>g.id===target.nodes.find(n=>n.type==='button').action.value));
});
test('invalid paste is atomic',()=>{
  const {p}=sample(),before=C.serialize(p),fragment=C.copyFragment(p,p.nodes.map(n=>n.id));fragment.nodes[0].w=-10;
  assert.throws(()=>C.pasteFragment(p,fragment,p.steps[0].id));assert.equal(C.serialize(p),before);
});
test('deleting target step redirects buttons; ungrouping removes obsolete group actions',()=>{
  const {p,a,button,g}=sample();const second={...C.copy(p.steps[0]),id:'second'};p.steps.push(second);a.action={type:'step',value:second.id};
  C.deleteStep(p,second.id);assert.equal(a.action.value,p.steps[0].id);
  C.ungroup(p,g.nodeIds);assert.deepEqual(button.action,{type:'none',value:''});C.validate(p);
});
test('animation dependencies, independent legacy delays and manual order survive roundtrip',()=>{
  const {p,a,b,button,step}=sample();a.animation={type:'fade',duration:600,delay:200};b.animation={type:'rise',duration:400,delay:100,start:'after'};button.animation={type:'slide-left',duration:300,delay:50,start:'with'};
  const plan=C.animationPlan(p,step);assert.deepEqual(plan.map(t=>[t.start,t.end]),[[200,800],[900,1300],[950,1250]]);
  p.steps[0].animationOrder=[button.id,b.id,a.id];
  const restored=C.parseProjectFile(C.serialize(p));assert.deepEqual(C.animationPlan(restored,step).map(t=>t.id),[button.id,b.id,a.id]);
  assert.equal(C.animationPlan(restored,step).at(-1).start,200);
});
test('smart alignment snaps within tolerance and ignores distant candidates',()=>{
  const p=C.newProject(),a=C.node('shape',0,0,p.steps[0].id),b=C.node('shape',200,200,p.steps[0].id);a.w=a.h=b.w=b.h=50;
  assert.equal(C.snapMove([a],[b],196,30,6).dx,200);
  assert.equal(C.snapMove([a],[b],190,30,6).dx,190);
  assert.equal(C.snapMove([a],[],196,30,6).guides.length,0);
});
test('malformed animation orders are rejected before playback',()=>{
  const {p}=sample();p.steps[0].animationOrder='invalid';assert.throws(()=>C.validate(p),/动效顺序/);
  p.steps[0].animationOrder=['a','a'];assert.throws(()=>C.validate(p),/动效顺序/);
});
