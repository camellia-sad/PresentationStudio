'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa'),runtime=path.join(root,'docs/test-runtime');
fs.mkdirSync(qa,{recursive:true});fs.mkdirSync(runtime,{recursive:true});
let browser,server;const errors=[],checks=[];
async function check(name,run){await run();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready);
 await page.evaluate(async()=>{const p=C.newProject('边栏体验验收');const n=C.node('text',100,100,p.steps[0].id);n.id='sample';n.name='汇报标题';n.text='让想法清晰呈现';p.nodes.push(n);await loadProject(p);setSelection(['sample']);fitBounds(C.bounds(p.nodes));});
 if(process.env.STUDIO_CAPTURE_BEFORE){await page.screenshot({path:path.join(qa,'sidebar-before.png')});return;}
 const size=async id=>Math.round((await page.locator(id).boundingBox()).width);
 const drag=async(side,delta)=>{const box=await page.locator('#'+side+'-resize').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+150);await page.mouse.down();await page.mouse.move(box.x+box.width/2+delta,box.y+150,{steps:10});await page.mouse.up();};
 await check('content first, advanced settings collapsed, readable labels',async()=>{
  assert.equal(await page.locator('#properties > :first-child').getAttribute('data-property-section'),'文字');
  assert.equal(await page.locator('[data-property-section="图层操作"]').getAttribute('open'),null);
  assert.equal(await page.locator('#editing-options').count(),0);
  assert.equal(await page.locator('#properties .field').first().evaluate(el=>getComputedStyle(el).fontSize),'13px');
  await page.locator('[data-property-section="外观"] > summary').click();
  await page.locator('[data-property-section="外观"] > summary').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('[data-property-section="外观"]').evaluate(el=>el.open),false);await page.keyboard.press('Space');
  await page.evaluate(()=>renderInspector());
  assert(await page.locator('[data-property-section="外观"]').evaluate(el=>el.open));
  await page.locator('[data-property-section="外观"] > summary').click();
  await page.locator('#properties [data-prop=text]').fill('内容即时同步');
  assert.equal(await page.evaluate(()=>findNode('sample').text),'内容即时同步');
 });
 await check('both drag handles obey limits without editing project or undo',async()=>{
  await page.locator('#viewport').click({position:{x:20,y:20}});await page.evaluate(()=>{setSelection(['sample']);window.beforeProject=JSON.stringify(state.project);window.beforeUndo=state.undo.length;});
  await drag('left',900);assert.equal(await size('#left-panel'),360);
  await drag('left',-900);assert.equal(await size('#left-panel'),190);
  await drag('right',-900);assert.equal(await size('#inspector'),420);
  await drag('right',900);assert.equal(await size('#inspector'),260);
  assert.equal(await page.evaluate(()=>JSON.stringify(state.project)===window.beforeProject),true);
  assert.equal(await page.evaluate(()=>state.undo.length===window.beforeUndo),true);
  await page.locator('#left-resize').dblclick();await page.locator('#right-resize').dblclick();
  assert.equal(await size('#left-panel'),220);assert.equal(await size('#inspector'),300);
 });
 await check('keyboard changes width, Escape cancels drag, reload remembers widths',async()=>{
  await page.locator('#left-resize').focus();await page.keyboard.press('ArrowRight');assert.equal(await size('#left-panel'),230);
  await page.locator('#right-resize').focus();await page.keyboard.press('ArrowLeft');assert.equal(await size('#inspector'),310);
  const box=await page.locator('#left-resize').boundingBox();await page.mouse.move(box.x+5,box.y+200);await page.mouse.down();await page.mouse.move(box.x+90,box.y+200);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await size('#left-panel'),230);
  await page.evaluate(()=>persistNow());const saved=await page.evaluate(()=>JSON.stringify(state.project));await page.reload();await page.waitForFunction(()=>state.ready);
  assert.equal(await size('#left-panel'),230);assert.equal(await size('#inspector'),310);
  assert.equal(await page.evaluate(()=>JSON.stringify(state.project)),saved);
 });
 await check('responsive layout preserves canvas and narrow overlay',async()=>{
  await page.setViewportSize({width:900,height:800});await page.waitForTimeout(150);
  assert((await size('#viewport'))>=359);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:700,height:800});await page.evaluate(()=>setSelection(['sample']));
  assert(await page.locator('#inspector').isVisible());assert((await size('#viewport'))>=240);
  await page.screenshot({path:path.join(qa,'sidebar-narrow.png')});
  await page.setViewportSize({width:1440,height:960});await page.waitForTimeout(150);
  assert.equal(await size('#left-panel'),230);assert.equal(await size('#inspector'),310);
 });
 await check('hidden editing switches stay absent while tabs preserve width',async()=>{
  assert.equal(await page.locator('#editing-options,#edge-insert-toggle,#mindmap-keys').count(),0);
  for(const tab of ['layers','steps','add'])await page.locator('[data-tab='+tab+']').click();
  assert(await page.locator('#left-resize').isVisible());assert.equal(await size('#left-panel'),230);
 });
 await check('folded animation and layer actions remain functional',async()=>{
  await page.evaluate(()=>setSelection(['sample']));
  // Presentation settings live on the inspector's second page; design settings stay on the first.
  assert.equal(await page.locator('[data-property-section="动效"]').isVisible(),false);
  await page.locator('[data-inspector-tab=show]').click();await page.locator('[data-property-section="动效"] > summary').click();
  await page.locator('#properties [data-prop="animation.type"]').selectOption('fade');
  assert.equal(await page.evaluate(()=>findNode('sample').animation.type),'fade');
  assert.equal(await page.locator('[data-inspector-tab=show]').getAttribute('aria-selected'),'true');
  await page.locator('[data-inspector-tab=design]').click();await page.locator('[data-property-section="图层操作"] > summary').click();await page.locator('#properties [data-editor-action=hide]').click();
  assert(await page.evaluate(()=>state.editorView.hidden.includes('sample')));
  await page.locator('#properties [data-editor-action=all]').click();
  await page.keyboard.press('F5');assert.equal(await page.locator('#left-resize').isVisible(),false);
  await page.locator('#exit-presentation').click();assert(await page.locator('#left-resize').isVisible());
 });
 await check('exported editable HTML reinstalls a single pair of handles under CSP',async()=>{
  const waiting=page.waitForEvent('download');await page.evaluate(()=>exportHtml('edit'));const file=path.join(qa,'sidebar-export.html');await (await waiting).saveAs(file);
  const exported=await context.newPage();exported.on('pageerror',e=>errors.push(e.message));await exported.goto('file:///'+file.replaceAll('\\','/'));await exported.waitForFunction(()=>state.ready);
  assert.equal(await exported.locator('.sidebar-resize').count(),2);assert.equal(await exported.locator('#editing-options').count(),0);
  await exported.locator('#left-resize').focus();await exported.keyboard.press('ArrowRight');assert.equal(await exported.locator('#left-resize').getAttribute('aria-valuenow'),'230');await exported.close();
 });
 await page.locator('#left-resize').dblclick();await page.locator('#right-resize').dblclick();await page.evaluate(()=>setSelection(['sample']));
 for(const name of ['图层操作','动效']){const el=page.locator('[data-property-section="'+name+'"]');await el.evaluate(e=>{e.open=false;});}
 await page.locator('#properties').evaluate(el=>el.scrollTop=0);await page.waitForFunction(()=>document.getElementById('toast').hidden);await page.screenshot({path:path.join(qa,'sidebar-after.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'sidebar-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
