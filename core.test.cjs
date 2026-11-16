const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./core.js');

// Extending top/left changes only canvas bounds and preserves the opposite edge.
const legacyCanvas={width:800,height:600,background:'#f7f6f1',grid:true,snap:true};
assert.deepEqual(C.canvasBounds(legacyCanvas),{x:0,y:0,w:800,h:600});
const expanded=C.resizeCanvas(legacyCanvas,'nw',-120,-80);
assert.deepEqual(C.canvasBounds(expanded),{x:-120,y:-80,w:920,h:680});
assert.equal(expanded.x+expanded.width,800);
assert.equal(expanded.y+expanded.height,600);
assert.deepEqual(C.canvasBounds(C.resizeCanvas(expanded,'e',200,99)),{x:-120,y:-80,w:1120,h:680});
assert.deepEqual(C.canvasBounds(C.resizeCanvas(expanded,'s',99,200)),{x:-120,y:-80,w:920,h:880});
assert.deepEqual(C.canvasBounds(C.resizeCanvas(legacyCanvas,'nw',9999,9999)),{x:700,y:500,w:100,h:100});
assert.equal(C.resizeCanvas(legacyCanvas,'se',999999,999999).width,50000);
assert.deepEqual(legacyCanvas,{width:800,height:600,background:'#f7f6f1',grid:true,snap:true});

const project = C.newProject('Regression project');
const step = project.steps[0].id;
const a = C.node('text', 10, 20, step, {text:'A'});
const b = C.node('text', 500, 20, step, {text:'B'});
b.parentId = a.id;
project.nodes.push(a, b);
project.edges.push(C.edge(a.id, b.id, step));
C.group(project, [a.id, b.id], 'Pair');
const copied = C.duplicate(project, [a.id, b.id]);
assert.equal(copied.length, 2);
assert.equal(project.groups.length, 2);
assert.equal(project.edges.length, 2);
assert.equal(project.nodes.find(n=>n.id===copied[1]).parentId, copied[0]);
assert.equal(project.edges[1].from, copied[0]);
assert.equal(project.edges[1].to, copied[1]);
C.validate(project);
const originRoundTrip=C.copy(project);originRoundTrip.canvas=expanded;
assert.deepEqual(C.validate(JSON.parse(C.serialize(originRoundTrip))).canvas,expanded);

// Deleting an endpoint must clean connectors and group membership, while keeping unrelated copies.
C.remove(project, [a.id]);
assert.equal(project.edges.length, 1);
assert.equal(project.nodes.find(n=>n.id===b.id).parentId, null);
assert.equal(project.groups.length, 1);
C.validate(project);

// Reordering steps preserves stable references, and deletion moves objects to a valid step.
const next = {id:C.uid('step'), name:'Next', duration:5000, note:'', camera:null};
project.steps.push(next);
project.nodes[0].stepId = next.id;
project.steps.reverse();
assert.equal(project.nodes[0].stepId, project.steps[0].id);
C.deleteStep(project, next.id);
assert.equal(project.nodes[0].stepId, step);
C.validate(project);

const cyclic = C.copy(project);
cyclic.nodes[1].parentId = cyclic.nodes[2].id;
cyclic.nodes[2].parentId = cyclic.nodes[1].id;
assert.throws(()=>C.validate(cyclic), /循环/);

const invalid = C.copy(project);
invalid.edges[0].to = 'missing';
assert.throws(()=>C.validate(invalid), /连线/);

const hostile = C.copy(project);
hostile.nodes[0].text = '</script><script>unexpected()</script>';
const serialized = C.serialize(hostile);
assert(!serialized.includes('</script>'));
assert.equal(JSON.parse(serialized).nodes[0].text, hostile.nodes[0].text);

const sample = JSON.parse(fs.readFileSync(path.join(__dirname,'projects/Guess-Sketch.studio.json'),'utf8'));
C.validate(sample);
assert(sample.nodes.filter(n=>n.name.includes('小字')).length >= 7);
assert.equal(sample.steps.length, 14);
assert.equal(Object.keys(sample.assets).length, 7);
const standalone=fs.readFileSync(path.join(__dirname,'汇报工作台.html'),'utf8');
assert(!/<script\b[^>]*\bsrc\s*=/i.test(standalone));
assert(!/<link\b[^>]*\brel=["']stylesheet/i.test(standalone));
const embedded=JSON.parse(standalone.match(/<script id="seed-project" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded,sample);
assert(Object.values(embedded.assets).every(asset=>asset.data.startsWith('data:image/')));
assert.deepEqual(C.parseProjectFile(standalone),sample);
assert.deepEqual(C.parseProjectFile('\uFEFF'+C.serialize(hostile)),hostile);
assert.deepEqual(C.parseProjectFile('<html><script type="application/json" id="seed-project">'+C.serialize(hostile)+'</script><script>throw Error("must never execute")</script></html>'),hostile);
assert.throws(()=>C.parseProjectFile('<html><h1>普通网页</h1></html>'),/普通网页/);
assert.throws(()=>C.parseProjectFile('<script id="seed-project" type="application/json">{}</script>'),/格式|版本|项目/);
console.log('PASS: duplicate remapping, deletion cleanup, step references, cycle rejection, HTML-safe JSON, and starter project');
