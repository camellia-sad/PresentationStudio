const assert=require('node:assert/strict'),C=require('./core.js');
const p=C.newProject();p.steps=[1,2,3].map(i=>({id:'s'+i,name:'步骤 '+i,duration:6000,note:'',camera:null}));
p.nodes=['a','b','c'].map((id,i)=>C.node('text',100+i*300,100,i===2?'s2':'s1',{id,text:id}));
p.nodes[1].endStepId='s2';
const visible=i=>p.nodes.filter(n=>C.visibleAt(n,p.steps,i)).map(n=>n.id);
assert.deepEqual(visible(0),['a','b']);assert.deepEqual(visible(1),['a','c']);assert.deepEqual(visible(0),['a','b']);
const line=C.edge('a','b','s1',{endStepId:'s2',color:'#d94137'});p.edges.push(line);
assert(C.visibleAt(line,p.steps,0));assert(!C.visibleAt(line,p.steps,1));
for(const edge of [line,C.freeEdge({x:0,y:0},{x:600,y:0},'s1')]) {
  const ends=C.copy(C.edgePoints(edge,p.nodes)),mid=C.edgeMidpoint(edge,p.nodes),desired={x:mid.x+20,y:mid.y-120};
  C.bendEdgeTo(edge,p.nodes,desired);
  const result=C.edgeMidpoint(edge,p.nodes);assert(Math.abs(result.x-desired.x)<1e-8&&Math.abs(result.y-desired.y)<1e-8);
  assert.deepEqual(C.edgePoints(edge,p.nodes),ends);assert(C.edgePath(edge,p.nodes).includes(' C '));
  assert.deepEqual(C.parseProjectFile(C.serialize({...p,edges:[edge]})).edges[0],edge);
}
const offset=C.copy(line.curveOffset);p.nodes[0].x+=80;p.nodes[1].x+=80;
assert.deepEqual(line.curveOffset,offset);assert.equal(line.color,'#d94137');
const invalid=C.copy(p);invalid.nodes[1].endStepId='missing';assert.throws(()=>C.validate(invalid),/退场步骤/);
invalid.nodes[1].endStepId='s2';invalid.edges[0].curveOffset.x=NaN;assert.throws(()=>C.validate(invalid),/曲线/);
const stage=C.insertStep(p,'s1');assert.equal(p.nodes[1].endStepId,'s2');assert(C.visibleAt(p.nodes[1],p.steps,1));
C.deleteStep(p,'s2');assert.equal(p.nodes[1].endStepId,'s3');assert.equal(p.edges[0].endStepId,'s3');C.validate(p);
C.deleteStep(p,'s3');assert.equal(p.nodes[1].endStepId,'');C.validate(p);
console.log('PASS: curve midpoint dragging, fixed endpoints, color/persistence, A+B to A+C, backward visibility and step deletion');
