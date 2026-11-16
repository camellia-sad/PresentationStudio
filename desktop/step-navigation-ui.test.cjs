'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..');
let browser,server;const errors=[],checks=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launchPersistentContext(path.join(root,'docs/test-runtime/step-navigation'),{headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',viewport:{width:1440,height:960}});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready);
 await page.evaluate(async()=>{const p=C.newProject('编号跳转');p.steps=Array.from({length:14},(_,i)=>({id:'s'+(i+1),name:i===2||i===12?'同名步骤':'内容',duration:1000,note:'',camera:null}));for(let i=1;i<=13;i++){const n=C.node('text',i*500,200,'s'+i);n.id='n'+i;n.name='对象 '+i;n.text='数值3的说明';p.nodes.push(n);}await loadProject(p);});
 await check('step-number selection preserves camera; focus is separate; invalid input changes nothing',async()=>{
  await page.locator('[data-tab=steps]').click();const before=await page.evaluate(()=>({...state.view}));
  await page.locator('#editor-step-number input').fill('3');await page.locator('#editor-step-number input').press('Enter');
  assert.equal(await page.evaluate(()=>state.activeStep),'s3');assert.deepEqual(await page.evaluate(()=>({...state.view})),before);
  await page.locator('#editor-step-number input').fill('第13步');await page.locator('#editor-step-number [data-number-focus]').click();assert.equal(await page.evaluate(()=>state.activeStep),'s13');assert.notDeepEqual(await page.evaluate(()=>({...state.view})),before);
  for(const value of ['0','15','-1','2.5','abc','']){await page.locator('#editor-step-number input').fill(value);await page.locator('#editor-step-number input').press('Enter');assert.equal(await page.evaluate(()=>state.activeStep),'s13');assert.equal(await page.locator('#editor-step-number input').getAttribute('aria-invalid'),'true');}
 });
 await check('Ctrl+J accepts full-width digits and respects existing dialogs and IME',async()=>{
  await page.keyboard.press('Control+j');await page.locator('#step-number-dialog input').fill('３');await page.locator('#step-number-dialog input').press('Enter');assert.equal(await page.evaluate(()=>state.activeStep),'s3');
  await page.locator('#motion-panel').click();await page.keyboard.press('Control+j');assert.equal(await page.locator('#step-number-dialog').count(),0);await page.locator('#close-dialog').click();
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'j',ctrlKey:true,isComposing:true,bubbles:true})));assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false);
 });
 await check('search prioritizes exact step 3 and explicit aliases never match 13',async()=>{
  await page.keyboard.press('Control+k');const input=page.locator('#search-everything');await input.fill('3');assert.equal(await page.locator('.search-result').first().locator('strong').innerText(),'3. 同名步骤');
  assert.equal(await page.locator('.search-result').filter({hasText:'13. 同名步骤'}).count(),0);
  for(const value of ['#3','第3步','步骤3']){await input.fill(value);assert.equal(await page.locator('.search-result').count(),1);}
  await input.press('Enter');assert.equal(await page.evaluate(()=>state.activeStep),'s3');
 });
 await check('layer number filtering includes only that step, including empty steps',async()=>{
  await page.locator('[data-tab=layers]').click();const input=page.getByRole('searchbox',{name:'搜索图层'});
  await input.fill('3');assert.equal(await page.locator('[data-layer-step]:visible').count(),1);assert.equal(await page.locator('[data-layer-step]:visible').getAttribute('data-layer-step'),'s3');
  await input.fill('#14');assert.equal(await page.locator('[data-layer-step]:visible').getAttribute('data-layer-step'),'s14');await input.fill('');
 });
 await check('motion number switch and interaction target labels use current numbers',async()=>{
  await page.locator('#motion-panel').click();assert((await page.locator('#motion-step option').nth(12).textContent()).startsWith('13.'));
  await page.locator('#motion-step-number input').fill('13');await page.locator('#motion-step-number input').press('Enter');assert.equal(await page.locator('#motion-step').inputValue(),'s13');await page.locator('#close-dialog').click();
  await page.evaluate(()=>{findNode('n1').action={type:'step',value:'s3'};setSelection(['n1']);});await page.locator('[data-inspector-tab=show]').click();await page.locator('[data-property-section="点击交互（演示时）"] summary').click();assert((await page.locator('[data-prop="action.value"] option[value=s3]').textContent()).startsWith('3.'));
 });
 await check('reordering and undo change display numbers without changing object or button references',async()=>{
  await page.evaluate(()=>change(()=>C.reorderStep(state.project,'s13','s3')));await page.keyboard.press('Control+j');await page.locator('#step-number-dialog input').fill('3');await page.locator('#step-number-dialog input').press('Enter');assert.equal(await page.evaluate(()=>state.activeStep),'s13');
  assert.equal(await page.evaluate(()=>findNode('n1').action.value),'s3');assert.equal(await page.evaluate(()=>findNode('n3').stepId),'s3');
  await page.keyboard.press('Control+z');await page.keyboard.press('Control+j');await page.locator('#step-number-dialog input').fill('3');await page.locator('#step-number-dialog input').press('Enter');assert.equal(await page.evaluate(()=>state.activeStep),'s3');
 });
 await check('presentation jump stops autoplay, handles overview and returns to motion context',async()=>{
  await page.keyboard.press('F5');await page.locator('#auto-play').click();await page.locator('#player-step-number input').fill('13');await page.locator('#player-step-number input').press('Enter');assert.equal(await page.evaluate(()=>state.playIndex),12);assert.equal(await page.evaluate(()=>state.autoTimer),null);
  await page.setViewportSize({width:1000,height:720});const bar=await page.locator('#presentation-bar').boundingBox();assert(bar.x>=0&&bar.x+bar.width<=1000);const jump=await page.locator('#player-step-number').boundingBox();assert(jump.x>=0&&jump.x+jump.width<=1000);await page.screenshot({path:path.join(root,'docs/qa/step-number-player.png')});await page.setViewportSize({width:1440,height:960});
  await page.locator('#show-overview').click();await page.keyboard.press('Control+j');await page.locator('#step-number-dialog input').fill('3');await page.locator('#step-number-dialog input').press('Enter');assert.equal(await page.evaluate(()=>state.overview),false);assert.equal(await page.evaluate(()=>state.playIndex),2);await page.locator('#exit-presentation').click();
  await page.locator('#motion-panel').click();await page.locator('#motion-step-number input').fill('3');await page.locator('#motion-step-number input').press('Enter');await page.locator('#motion-preview').click();await page.locator('#player-step-number input').fill('13');await page.locator('#player-step-number input').press('Enter');await page.locator('#exit-presentation').click();assert.equal(await page.locator('#motion-step').inputValue(),'s3');await page.locator('#close-dialog').click();
 });
 await page.locator('[data-tab=steps]').click();await page.screenshot({path:path.join(root,'docs/qa/step-navigation.png')});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(root,'docs/qa/step-navigation-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
