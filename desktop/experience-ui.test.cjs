'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa'),checks=[],errors=[];
let browser,server;
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready);
 const title=async value=>page.waitForFunction(t=>document.getElementById('dialog-title').textContent===t,value);
 await page.evaluate(async()=>{const p=C.newProject('交互验收');const n=C.node('icon',100,320,p.steps[0].id);Object.assign(n,{id:'bulb',w:70,h:70});p.nodes.push(n);const e=C.freeEdge({x:80,y:80},{x:700,y:500},p.steps[0].id);e.id='diagonal';e.color='#cc4444';p.edges.push(e);await loadProject(p);state.view={x:40,y:30,zoom:.8};updateView();});
 await check('canvas redundancies hidden and brand returns home',async()=>{
  assert.equal(await page.locator('#home,#editing-options,#edge-insert-toggle,#mindmap-keys,[data-prop=snap]').count(),0);
  assert.equal(await page.locator('#deselect').isVisible(),false);assert.equal(await page.locator('[data-property-section="项目数据"]').count(),0);
  assert.equal(await page.locator('.palette-wide [data-command=add-child]').count(),0);
  await page.locator('#topbar .brand-symbol').click();await page.locator('#welcome-screen').waitFor({state:'visible'});await page.locator('[data-welcome-project]').filter({hasText:'交互验收'}).click();
 });
 await check('project manager closes; subpages Escape and buttons return to manager',async()=>{
  await page.locator('#library').click();await page.locator('.manager-search').waitFor();assert.equal(await page.locator('.manager-icon').count(),4);await page.keyboard.press('Escape');assert.equal(await page.locator('#dialog').evaluate(e=>e.open),false);
  await page.locator('#library').click();await page.locator('#library-trash').click();await title('项目回收站');assert.equal(await page.locator('#close-dialog').innerText(),'← 返回项目管理');await page.keyboard.press('Escape');await title('项目管理');
  await page.locator('#dialog-content [data-command=import-project]').click();assert.equal(await page.locator('#dialog-title').innerText(),'导入项目');await page.keyboard.press('Escape');await title('项目管理');
  await page.locator('#library-new').click();await page.locator('#close-dialog').click();await title('项目管理');await page.screenshot({path:path.join(qa,'experience-projects.png')});await page.locator('#close-dialog').click();
 });
 await check('clear trash confirms and preserves active projects across reload',async()=>{
  await page.evaluate(async()=>{const p=C.newProject('待清空合成项目');await putStoredRecord({id:p.id,project:p,writer:writerId,revision:1,updatedAt:Date.now(),deletedAt:Date.now(),view:{x:0,y:0,zoom:1}});});
  const count=await page.evaluate(async()=>(await allRecords()).filter(r=>!r.deletedAt).length);
  await page.locator('#library').click();await page.locator('#library-trash').click();await page.locator('#empty-project-trash').click();await page.locator('#trash-cancel').click();await page.locator('.project-item').first().waitFor();assert(await page.locator('.project-item').count());
  await page.locator('#empty-project-trash').click();await page.locator('#trash-confirm').click();await page.waitForFunction(()=>document.getElementById('empty-project-trash')?.disabled);
  assert.equal(await page.evaluate(async()=>(await allRecords()).filter(r=>!r.deletedAt).length),count);await page.locator('#close-dialog').click();await title('项目管理');await page.locator('#close-dialog').click();await page.reload();await page.waitForFunction(()=>state.ready);assert.equal(await page.evaluate(async()=>(await allRecords()).filter(r=>r.deletedAt).length),0);
 });
 await check('template matrix previews without touching document; shortcut list scrolls',async()=>{
  await page.locator('[data-component-action=manage]').click();const before=await page.evaluate(()=>JSON.stringify(state.project));
  await page.locator('.component-card').nth(1).click();assert(await page.locator('#component-preview .node').count());assert.equal(await page.evaluate(()=>JSON.stringify(state.project)),before);
  assert.equal(await page.locator('#dialog-content select').count(),0);assert(await page.locator('.component-thumbnail .node').count());await page.screenshot({path:path.join(qa,'experience-components.png')});
  await page.locator('#component-preview-actions [data-component-action=insert]').click();assert((await page.evaluate(()=>state.selected.size))>1);
  assert.equal(await page.locator('.library-shortcuts').evaluate(el=>getComputedStyle(el).maxHeight),'252px');
  assert.equal(await page.locator('#left-content > .section-label').evaluate(e=>getComputedStyle(e).fontWeight),'600');
 });
 await check('copy and cut paste around a clicked world point, retaining group geometry',async()=>{
  await page.evaluate(()=>{copySelected();state.view={x:0,y:0,zoom:.5};updateView();});
  const rect=await page.locator('#viewport').boundingBox();await page.mouse.click(rect.x+650,rect.y+600);const point=await page.evaluate(()=>state.pastePoint);
  await page.evaluate(()=>pasteSelected());const box=await page.evaluate(()=>C.visualBounds(selectedNodes()));assert(Math.abs(box.x+box.w/2-point.x)<.01);assert(Math.abs(box.y+box.h/2-point.y)<.01);
  const count=await page.evaluate(()=>state.project.nodes.length);await page.evaluate(()=>copySelected(true));assert((await page.evaluate(()=>state.project.nodes.length))<count);
  await page.mouse.click(rect.x+550,rect.y+620);await page.evaluate(()=>pasteSelected());assert.equal(await page.evaluate(()=>state.project.nodes.length),count);
 });
 await check('diagonal free line accepts off-center icon drop, follows it and undoes; Alt bypasses',async()=>{
  await page.evaluate(async()=>{const p=C.newProject('插线验收');const n=C.node('icon',100,350,p.steps[0].id);Object.assign(n,{id:'bulb',w:70,h:70});p.nodes.push(n);const e=C.freeEdge({x:80,y:80},{x:700,y:500},p.steps[0].id);e.id='diagonal';p.edges.push(e);await loadProject(p);state.view={x:0,y:0,zoom:1};updateView();});
  const view=await page.locator('#viewport').boundingBox();
  async function drag(alt){await page.evaluate(()=>setSelection(['bulb']));if(alt)await page.keyboard.down('Alt');await page.mouse.move(view.x+110,view.y+360);await page.mouse.down();await page.mouse.move(view.x+265,view.y+200,{steps:12});await page.mouse.up();if(alt)await page.keyboard.up('Alt');}
  await drag(false);assert.equal(await page.evaluate(()=>state.project.edges.length),2);
  assert(await page.evaluate(()=>state.project.edges.every(e=>C.edgeNodeIds(e).includes('bulb'))));
  await page.evaluate(()=>{findNode('bulb').x+=40;renderCanvas();});assert(await page.evaluate(()=>{const e=state.project.edges[0];return C.edgePoints(e,state.project.nodes)[1].x===C.anchor(findNode('bulb'),e.toAnchor).x;}));
  await page.evaluate(()=>travelHistory(-1));assert.equal(await page.evaluate(()=>state.project.edges.length),1);
  await drag(true);assert.equal(await page.evaluate(()=>state.project.edges.length),1);
 });
 await check('mindmap enabled only on canvas, Alt bypasses, input Tab remains navigation',async()=>{
  await page.evaluate(()=>{setSelection(['bulb']);focusCanvas();});const before=await page.evaluate(()=>state.project.nodes.length);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>state.project.nodes.length),before+1);
  await page.evaluate(()=>{setSelection(['bulb']);focusCanvas();});await page.keyboard.press('Alt+Enter');assert.equal(await page.evaluate(()=>state.project.nodes.length),before+1);
  await page.locator('#project-title').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>state.project.nodes.length),before+1);
 });
 await check('grid snap defaults on even for legacy disabled data; Alt gives precise drag',async()=>{
  await page.evaluate(async()=>{const p=C.newProject('网格测试');p.canvas.snap=false;const n=C.node('shape',100,100,p.steps[0].id);n.id='snap-test';p.nodes.push(n);await loadProject(p);state.view={x:0,y:0,zoom:1};updateView();});
  const view=await page.locator('#viewport').boundingBox();
  await page.mouse.move(view.x+120,view.y+120);await page.mouse.down();await page.mouse.move(view.x+133,view.y+127,{steps:5});await page.mouse.up();assert.deepEqual(await page.evaluate(()=>({x:findNode('snap-test').x,y:findNode('snap-test').y})),{x:120,y:100});
  await page.keyboard.down('Alt');await page.mouse.move(view.x+140,view.y+120);await page.mouse.down();await page.mouse.move(view.x+153,view.y+127,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');assert.deepEqual(await page.evaluate(()=>({x:findNode('snap-test').x,y:findNode('snap-test').y})),{x:133,y:107});
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'experience-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
