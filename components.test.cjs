const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./core'),L=require('./component-library');
test('starters have editable text, icons and pale-red limitation',()=>{const all=L.defaults();assert.equal(all.length,4);all.forEach(p=>C.validate(p));assert(all[1].nodes.some(n=>n.icon==='question'));assert(all[2].nodes.some(n=>n.icon==='bulb'));assert(all[3].nodes.some(n=>n.style.fill==='#fae9e6'));});
test('capture drops project timing and external jumps; insertion remaps internal references and keeps assets',()=>{
 const p=L.defaults()[0];p.steps.push({id:'later',name:'later',duration:100,note:'',camera:null});
 p.assets.pic={name:'pixel',data:'data:image/png;base64,AAAA',width:1,height:1};
 p.nodes[0].locked=true;p.nodes[0].hidden=true;p.nodes[0].endStepId='later';p.nodes[1].action={type:'step',value:'later'};
 p.nodes[2].action={type:'group',value:p.groups[0].id};
 const image=C.node('image',700,0,p.steps[0].id);image.assetId='pic';image.action={type:'image',value:'pic'};p.nodes.push(image);
 const e=C.edge(p.nodes[0].id,p.nodes[1].id,p.steps[0].id);p.edges.push(e);
 const tpl=L.capture(p,p.nodes.map(n=>n.id));assert(!tpl.nodes.some(n=>n.locked||n.hidden||n.endStepId));assert.equal(tpl.nodes[1].action.type,'none');assert(tpl.assets.pic);
 const out=C.newProject(),step=out.steps[0].id;const first=L.insert(out,tpl,step,{x:-400,y:600}),second=L.insert(out,tpl,step,{x:800,y:600});
 assert(!first.ids.some(id=>second.ids.includes(id)));assert(out.nodes.every(n=>n.stepId===step&&!n.endStepId));
 const button=out.nodes.find(n=>n.id===first.ids[2]);assert(out.groups.some(g=>g.id===button.action.value));
 out.nodes[0].text='edited';assert.notEqual(tpl.nodes[0].text,'edited');
 const b=C.bounds(out.nodes.filter(n=>first.ids.includes(n.id)));assert.equal(b.x+b.w/2,-400);assert.equal(b.y+b.h/2,600);C.validate(out);
});
test('free curve capture and insertion preserves endpoints, label, styling',()=>{const p=C.newProject(),e=C.freeEdge({x:900,y:1200},{x:1200,y:1200},p.steps[0].id);e.route='curve';e.label='success';e.color='#347760';p.edges.push(e);const tpl=L.capture(p,[],e.id),out=C.newProject();const r=L.insert(out,tpl,out.steps[0].id,{x:500,y:500});assert(r.edgeId);assert.equal(out.edges[0].label,'success');assert.equal(out.edges[0].color,'#347760');assert.equal(out.edges[0].toPoint.x-out.edges[0].fromPoint.x,300);C.validate(out);});
test('free-line attachments survive template capture and insertion with new node IDs',()=>{
 const p=C.newProject(),n=C.node('icon',200,200,p.steps[0].id);p.nodes.push(n);const line=C.freeEdge({x:0,y:0},{x:500,y:500},p.steps[0].id);p.edges.push(line);C.splitEdge(p,line.id,n.id);
 const template=L.capture(p,[n.id]),out=C.newProject(),result=L.insert(out,template,out.steps[0].id,{x:700,y:800});
 assert.equal(out.edges.length,2);assert(out.edges.every(e=>C.edgeNodeIds(e).includes(result.ids[0])));assert(out.edges.every(e=>!C.edgeNodeIds(e).includes(n.id)));C.validate(out);
 const before=C.edgePoints(out.edges[0],out.nodes)[1];out.nodes[0].x+=50;assert.equal(C.edgePoints(out.edges[0],out.nodes)[1].x,before.x+50);
});
