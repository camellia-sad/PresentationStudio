const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa'),profile=path.join(root,'docs/test-runtime/layers-browser');
fs.mkdirSync(qa,{recursive:true});fs.mkdirSync(profile,{recursive:true});
const entry=path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html');
let browser,server;const errors=[],checks=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(req.url==='/export'?path.join(qa,'layers-export.html'):entry));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',viewport:{width:1440,height:960},acceptDownloads:true});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>state.ready);
 await page.evaluate(async()=>{
  const p=C.newProject('覆盖与退场验证');p.steps[0].id='first';p.steps[0].name='问题与遮盖';p.steps.push({id:'next',name:'揭示答案',duration:1000,note:'',camera:null});
  const below=C.node('text',150,180,'next',{id:'below',name:'下层答案',text:'被覆盖的答案',w:300,h:180});
  const cover=C.node('shape',150,180,'first',{id:'cover',name:'上层遮盖',w:300,h:180,endStepId:'next'});
  const other=C.node('text',600,180,'first',{id:'other',name:'旁边说明',text:'连接示意'});
  p.nodes.push(below,cover,other);p.edges.push(C.edge('cover','other','first',{id:'line'}));C.group(p,['cover','below'],'跨步骤组合');await loadProject(p);switchLeftTab('layers');fitBounds(C.bounds(p.nodes));
 });
 const eye=id=>page.locator(`[data-editor-eye="${id}"]`);
 const visible=id=>page.locator(`[data-node="${id}"]`).isVisible();
 await check('step tree contains each component once and splits groups by membership without changing the group',async()=>{
  assert.equal(await page.locator('[data-layer-step]').count(),2);assert.equal(await page.locator('[data-layer]').count(),3);
  assert.equal(await page.locator('[data-layer-step=first] [data-group] [data-eye-scope]').count(),1);
  await page.locator('[data-layer-step=first] [data-group] .layer-name').click();assert.deepEqual(await page.evaluate(()=>[...state.selected]),['cover']);
  assert.equal(await page.evaluate(()=>state.project.groups[0].nodeIds.length),2);
 });
 await check('eye removes cover and connected line, exposing the lower component without changing presentation hidden',async()=>{
  await eye('cover').click();assert.equal(await visible('cover'),false);assert.equal(await visible('below'),true);assert.equal(await page.locator('[data-edge=line]').count(),0);
  assert.equal(await page.evaluate(()=>findNode('cover').hidden),false);assert.equal(await page.locator('#selection').innerHTML(),'');
  await page.locator('[data-node=below] .node-body').click();assert.deepEqual(await page.evaluate(()=>[...state.selected]),['below']);
  assert.equal(await page.locator('#editor-visibility-notice').isVisible(),true);
 });
 await check('visibility undo/redo and content undo share chronological history',async()=>{
  await page.keyboard.press('Control+z');assert.equal(await visible('cover'),true);
  await page.keyboard.press('Control+y');assert.equal(await visible('cover'),false);
  await page.evaluate(()=>change(()=>findNode('other').text='changed'));
  await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>findNode('other').text),'连接示意');assert.equal(await visible('cover'),false);
  await page.keyboard.press('Control+z');assert.equal(await visible('cover'),true);
 });
 await check('whole-step eyes reflect partial visibility and restore all members',async()=>{
  await eye('cover').click();assert.equal(await page.locator('[data-editor-eye-step=first]').evaluate(el=>el.classList.contains('partial')),true);
  await page.locator('[data-editor-eye-step=first]').click();assert.equal(await visible('other'),false);
  await page.locator('[data-editor-eye-step=first]').click();assert.equal(await visible('cover'),true);assert.equal(await visible('other'),true);
 });
 await check('showing an attached line reveals its endpoints; canvas select-all excludes hidden objects',async()=>{
  await eye('cover').click();await page.evaluate(()=>{focusCanvas();selectAllComponents();});assert.equal(await page.evaluate(()=>state.selected.has('cover')),false);
  await eye('line').click();assert.equal(await visible('cover'),true);assert.equal(await page.locator('[data-edge=line]').count(),1);
 });
 await check('collapse and step-name search work together without losing objects',async()=>{
  await page.locator('[data-layer-fold-all=close]').click();assert.equal(await page.locator('[data-layer]:visible').count(),0);
  await page.getByRole('searchbox',{name:'搜索图层'}).fill('揭示答案');assert.equal(await page.locator('[data-layer]:visible').count(),1);
  await page.getByRole('searchbox',{name:'搜索图层'}).fill('');await page.locator('[data-layer-fold-all=open]').click();assert.equal(await page.locator('[data-layer]:visible').count(),3);
 });
 await check('step simulation applies retirement, supports individual override, and leaves real presentation intact',async()=>{
  await page.locator('[data-preview-step=next]').click();assert.equal(await visible('cover'),false);assert.equal(await visible('below'),true);assert.equal(await visible('other'),true);
  await eye('cover').click();assert.equal(await visible('cover'),true);
  await page.locator('[data-preview-step=first]').click();assert.equal(await visible('below'),false);assert.equal(await visible('cover'),true);
  await page.keyboard.press('F5');assert.equal(await visible('cover'),true);await page.locator('#next-step').click();assert.equal(await visible('cover'),false);assert.equal(await visible('below'),true);
  await page.keyboard.press('Escape');assert.equal(await visible('below'),true);assert.equal(await visible('cover'),false);assert.equal(await page.evaluate(()=>state.editorView.previewStep),'next');
  await page.locator('#editor-visibility-notice [data-editor-action=all]').click();
 });
 await check('canvas selection supports hide shortcut, isolate, restore and independent line hiding',async()=>{
  await page.evaluate(()=>{setSelection(['cover','other']);focusCanvas();});await page.keyboard.press('Control+h');assert.equal(await visible('cover'),false);assert.equal(await visible('other'),false);
  await page.keyboard.press('Control+Shift+h');assert.equal(await visible('cover'),true);assert.equal(await visible('other'),true);
  await page.evaluate(()=>setSelection(['below']));await page.locator('.layer-visibility-actions [data-editor-action=only]').click();assert.equal(await visible('below'),true);assert.equal(await visible('cover'),false);
  await page.locator('.layer-visibility-actions [data-editor-action=all]').click();await eye('line').click();assert.equal(await page.locator('[data-edge=line]').count(),0);assert.equal(await visible('cover'),true);await eye('line').click();assert.equal(await page.locator('[data-edge=line]').count(),1);
 });
 await check('deleting and undoing a hidden object or previewed step restores visibility history',async()=>{
  await eye('cover').click();await page.evaluate(()=>change(()=>C.remove(state.project,['cover'])));await page.evaluate(()=>travelHistory(-1));assert.equal(await visible('cover'),false);
  await page.locator('[data-preview-step=next]').click();await page.evaluate(()=>change(()=>C.deleteStep(state.project,'next')));assert.equal(await page.evaluate(()=>state.editorView.previewStep),null);
  await page.evaluate(()=>travelHistory(-1));assert.equal(await page.evaluate(()=>state.editorView.previewStep),'next');assert.equal(await visible('cover'),false);
  await page.locator('.layer-visibility-actions [data-editor-action=all]').click();
 });
 await check('temporary visibility survives local save/reload but never leaks into exported HTML or imported copies',async()=>{
  await eye('cover').click();await page.evaluate(()=>persistNow());await page.reload();await page.waitForFunction(()=>state.ready);assert.equal(await visible('cover'),false);
  const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>exportHtml('edit'));await (await downloadPromise).saveAs(path.join(qa,'layers-export.html'));
  const exported=await browser.newPage();exported.on('pageerror',e=>errors.push(e.message));await exported.goto(base+'/export');await exported.waitForFunction(()=>state.ready);
  assert.equal(await exported.locator('[data-node=cover]').isVisible(),true);assert.equal(await exported.locator('#editor-visibility-notice').count(),1);await exported.close();
  await page.evaluate(async()=>{const p=C.copy(state.project);p.id=C.uid('project');await loadProject(p);});assert.equal(await visible('cover'),true);
 });
 await page.locator('[data-tab=layers]').click();await page.locator('[data-preview-step=next]').click();await page.screenshot({path:path.join(qa,'step-layers.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'layers-ui-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(qa,'layers-ui-failure.txt'),e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
