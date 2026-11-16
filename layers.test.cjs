const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./core.js'),L=require('./layer-tools.js');
function fixture(){const p=C.newProject('layers');p.steps.push({id:'next',name:'next',duration:1000,note:'',camera:null});const a=C.node('shape',0,0,p.steps[0].id),b=C.node('text',0,0,'next');a.id='cover';a.endStepId='next';b.id='below';p.nodes.push(a,b);const e=C.edge('cover','below','next');e.id='line';p.edges.push(e);return p;}
test('temporary visibility does not mutate presentation content and follows attached edges',()=>{
 const p=fixture(),before=C.serialize(p),view=L.normalize(p,{hidden:['cover','cover','missing']});
 assert.deepEqual(view.hidden,['cover']);assert.equal(L.visible(p,p.nodes[0],view),false);assert.equal(L.visible(p,p.nodes[1],view),true);assert.equal(L.visible(p,p.edges[0],view),false);assert.equal(C.serialize(p),before);
});
test('step preview respects appearance and retirement; explicit visibility can override it',()=>{
 const p=fixture();let view=L.normalize(p,{previewStep:p.steps[0].id});assert.equal(L.visible(p,p.nodes[0],view),true);assert.equal(L.visible(p,p.nodes[1],view),false);
 view=L.normalize(p,{previewStep:'next'});assert.equal(L.visible(p,p.nodes[0],view),false);assert.equal(L.visible(p,p.nodes[1],view),true);
 view.shown.push('cover');assert.equal(L.visible(p,p.edges[0],view),true);view.hidden.push('cover');assert.equal(L.visible(p,p.nodes[0],view),false);
});
test('old records, deleted steps, permanent presentation hiding and free lines remain compatible',()=>{
 const p=fixture();p.nodes[0].hidden=true;const free=C.freeEdge({x:0,y:0},{x:10,y:10},p.steps[0].id);p.edges.push(free);
 assert.deepEqual(L.normalize(p,null),{hidden:[],shown:[],previewStep:null});assert.equal(L.visible(p,p.nodes[0],L.normalize(p)),true);
 assert.equal(L.visible(p,p.nodes[0],L.normalize(p,{previewStep:p.steps[0].id})),false);
 assert.equal(L.visible(p,free,L.normalize(p,{hidden:[free.id]})),false);assert.equal(L.normalize(p,{previewStep:'deleted'}).previewStep,null);
});
test('free lines attached by insertion follow editing visibility and step retirement',()=>{
 const p=fixture(),line=C.freeEdge({x:-100,y:50},{x:600,y:500},p.steps[0].id);p.edges.push(line);C.splitEdge(p,line.id,'cover');
 const attached=p.edges.filter(C.isFreeEdge),view=L.normalize(p,{hidden:['cover']});assert(attached.every(e=>!L.visible(p,e,view)));
 const preview=L.normalize(p,{previewStep:'next'});assert(attached.every(e=>!L.visible(p,e,preview)));assert(attached.every(e=>L.visible(p,e,L.normalize(p,{}))));
});
