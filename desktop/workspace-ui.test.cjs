'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa');
let browser,server;const errors=[],checks=[];
async function check(name,run){await run();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launchPersistentContext(path.join(root,'docs/test-runtime/workspace'),{headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',viewport:{width:1440,height:960}});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.fullscreenRequests=0;Element.prototype.requestFullscreen=async()=>{window.fullscreenRequests++;throw new DOMException('User activation required');};});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready);
 await check('browser never auto-enters fullscreen; explicit entry and F11 remain',async()=>{
  assert.equal(await page.evaluate(()=>window.fullscreenRequests),0);
  assert.equal(await page.locator('#editor-fullscreen').getAttribute('aria-label'),'全屏编辑');const n=await page.evaluate(()=>window.fullscreenRequests);
  await page.locator('#editor-fullscreen').click();await page.keyboard.press('F11');assert.equal(await page.evaluate(()=>window.fullscreenRequests),n+2);
 });
 await page.evaluate(async()=>{
  const p=C.newProject('空间操作测试');p.canvas.snap=false;p.steps.push({id:'next',name:'第二步',duration:1000,note:'',camera:null});
  for(let i=0;i<12;i++){const n=C.node(i===1?'image':'shape',i*370,100,p.steps[0].id);n.id='n'+i;n.name='测试对象 '+i;p.nodes.push(n);}
  p.assets.pic={name:'pic',width:20,height:20,data:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>')};p.nodes[1].assetId='pic';
  const f=C.freeEdge({x:400,y:450},{x:900,y:600},p.steps[0].id);f.id='free';p.edges.push(f);await loadProject(p);
 });
 await check('numeric geometry and direct canvas editing entries removed',async()=>{
  assert.equal(await page.locator('#edit-canvas,[data-command=json-data],input[data-scope=canvas][type=number]').count(),0);
  await page.evaluate(()=>setSelection(['n0']));
  assert.equal(await page.locator('#properties [data-prop=x],#properties [data-prop=y],#properties [data-prop=w],#properties [data-prop=h]').count(),0);
  assert.equal(await page.locator('#properties [data-prop=rotation]').count(),1);
  await page.evaluate(()=>setSelection([], 'free'));
  assert.equal(await page.locator('#properties [data-prop="fromPoint.x"]').count(),0);
 });
 await check('step double-click focuses without overwriting a saved camera',async()=>{
  await page.locator('[data-tab=steps]').click();
  await page.evaluate(()=>{state.project.steps[0].camera={cx:11,cy:22,zoom:.5};state.view={x:123,y:456,zoom:.6};updateView();window.stepCard=$('left-content').querySelector('[data-select-step]');});
  await page.locator('[data-select-step]').first().click();assert(await page.evaluate(()=>window.stepCard.isConnected));
  assert(await page.locator('.step-controls [data-command=step-from-selection]').isDisabled());
  assert.equal(await page.evaluate(()=>state.view.x),123);
  await page.locator('[data-select-step]').first().dblclick();assert.notEqual(await page.evaluate(()=>state.view.x),123);
  assert.deepEqual(await page.evaluate(()=>state.project.steps[0].camera),{cx:11,cy:22,zoom:.5});
  assert.equal(await page.locator('.camera-mode button').count(),2);assert.equal(await page.locator('.camera-peek').count(),1);assert((await page.locator('.step-present').innerText()).includes('▶'));
 });
 await check('action selection renders objects, image and line without changing project data',async()=>{
  await page.evaluate(()=>{layerTools.setHidden(['n1'],true);window.projectBefore=JSON.stringify(state.project);});
  await page.locator('#motion-panel').click();await page.locator('[data-motion-id=n1] .motion-select').click();
  assert.equal(await page.locator('#motion-canvas [data-motion-pick=n1] img').count(),1);assert.equal(await page.locator('.motion-outline').count(),1);
  assert.deepEqual(await page.evaluate(()=>[...state.selected]),['n1']);assert.equal(await page.evaluate(()=>JSON.stringify(state.project)===window.projectBefore),true);
  await page.locator('[data-motion-id=free] .motion-select').click();assert.equal(await page.evaluate(()=>state.edgeId),'free');assert.equal(await page.locator('#motion-canvas [data-motion-pick=free]').count(),1);
 });
 await check('preview returns original action, step, local visibility and list scroll',async()=>{
  await page.locator('[data-motion-id=n10] .motion-select').click();await page.locator('[data-motion-id=n10] [data-motion-prop=duration]').fill('1.4');await page.locator('[data-motion-id=n10] [data-motion-prop=duration]').press('Tab');
  const scroll=await page.locator('.motion-list').evaluate(el=>el.scrollTop);
  await page.locator('#motion-preview').click();assert.equal(await page.locator('#exit-presentation').innerText(),'返回动效编排');
  await page.locator('#next-step').click();await page.keyboard.press('Escape');
  assert(await page.locator('#dialog').evaluate(el=>el.open));assert.equal(await page.locator('.motion-row.active').getAttribute('data-motion-id'),'n10');
  assert.equal(await page.locator('.motion-list').evaluate(el=>el.scrollTop),scroll);assert.equal(await page.evaluate(()=>findNode('n10').animation.duration),1400);
  assert(await page.evaluate(()=>state.editorView.hidden.includes('n1')));
  await page.locator('#motion-preview').click();await page.locator('#exit-presentation').click();assert(await page.locator('#dialog').evaluate(el=>el.open));
  await page.screenshot({path:path.join(qa,'workspace-motion.png')});
  await page.locator('#close-dialog').click();await page.keyboard.press('F5');await page.locator('#exit-presentation').click();assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false);
  await page.locator('#motion-panel').click();await page.locator('#motion-step').selectOption('next');assert.equal(await page.evaluate(()=>state.activeStep),'next');assert.equal(await page.locator('.motion-row').count(),0);
  await page.locator('#motion-preview').click();await page.locator('#exit-presentation').click();assert.equal(await page.locator('#motion-step').inputValue(),'next');await page.locator('#close-dialog').click();
 });
 await check('resizing and dragging components remain available without numeric inputs',async()=>{
  await page.evaluate(()=>{setSelection(['n0']);fitBounds(C.visualBounds([findNode('n0')]));});
  const rect=await page.locator('#nodes [data-node=n0]').boundingBox(),before=await page.evaluate(()=>({x:findNode('n0').x,w:findNode('n0').w}));
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+80,rect.y+rect.height/2+40,{steps:8});await page.mouse.up();
  assert.notEqual(await page.evaluate(()=>findNode('n0').x),before.x);
  const handle=page.locator('#selection [data-resize=se]');const h=await handle.boundingBox();assert(h);
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+60,h.y+40,{steps:8});await page.mouse.up();assert.notEqual(await page.evaluate(()=>findNode('n0').w),before.w);
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'workspace-ui-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
