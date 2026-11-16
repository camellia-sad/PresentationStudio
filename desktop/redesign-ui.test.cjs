'use strict';
// 1.11 layout: step track, inspector pages, on-demand layer actions, local accent color, component hover and home covers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa/redesign');fs.mkdirSync(qa,{recursive:true});
let server,browser;const checks=[],errors=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;await page.goto(base);await page.waitForFunction(()=>state.ready);
 async function fixture(){await page.evaluate(async()=>{
  const p=C.newProject('季度复盘 · 数据管线迁移');p.canvas={...p.canvas,width:1200,height:760,background:'#ffffff',grid:false};
  p.steps[0].name='背景与问题';p.steps.push({id:'s2',name:'迁移方案',duration:6000,note:'',camera:null},{id:'s3',name:'结果与下一步',duration:6000,note:'',camera:null});
  const add=(id,text,x,y,w,h,step,style={})=>{const n=C.node('text',x,y,step);Object.assign(n,{id,name:text,text,w,h});Object.assign(n.style,style);p.nodes.push(n);return n;};
  add('title','迁移前后耗时对比',64,60,900,80,p.steps[0].id,{fontSize:44,fontWeight:700,color:'#14263a'});
  const card=(i,step,head,body)=>{const box=C.node('shape',64+i*372,220,step);Object.assign(box,{id:'box'+i,name:head+'背景',w:340,h:300});Object.assign(box.style,{fill:'#f4f6f9',borderWidth:0,radius:8});p.nodes.push(box);add('head'+i,head,90+i*372,250,290,50,step,{fontSize:28,fontWeight:700,color:'#14263a'});add('body'+i,body,90+i*372,320,290,120,step,{fontSize:21,color:'#4a5562'});C.group(p,['box'+i,'head'+i,'body'+i],head);};
  card(0,p.steps[0].id,'问题','夜间任务经常超时');card(1,'s2','方案','按依赖拆分并行执行');card(2,'s3','结果','总耗时下降 42%');
  await loadProject(p);switchLeftTab('add');fitBounds(C.canvasBounds(p.canvas));setSelection([]);
 });}
 await fixture();
 await check('step track: one item per step, click selects without rebuilding, double click focuses',async()=>{
  assert.equal(await page.locator('#step-track [data-track-step]').count(),3);
  const second=page.locator('#step-track [data-track-step=s2]');await second.evaluate(el=>{window.trackItem=el;});
  await second.click();assert.equal(await page.evaluate(()=>state.activeStep),'s2');assert.equal(await page.evaluate(()=>state.inspectorMode),'step');
  assert.equal(await second.evaluate(el=>el===window.trackItem&&el.classList.contains('current')),true);
  assert.equal(await page.locator('#inspector-tabs').isVisible(),false);
  const before=await page.evaluate(()=>JSON.stringify(state.view));await page.locator('#step-track [data-track-step=s3]').dblclick();await page.waitForTimeout(700);
  assert.notEqual(await page.evaluate(()=>JSON.stringify(state.view)),before);assert.equal(await page.evaluate(()=>state.activeStep),'s3');
 });
 await check('track hover shows a real preview and step simulation stays local',async()=>{
  await page.evaluate(()=>{fitBounds(C.canvasBounds(state.project.canvas));});
  await page.locator('#step-track [data-track-step=s2]').hover();await page.locator('#step-track-popover').waitFor({state:'visible'});
  assert(await page.locator('#step-track-popover .track-preview .node').count()>=4);await page.screenshot({path:path.join(qa,'track-popover.png')});
  const data=await page.evaluate(()=>C.serialize(state.project));
  await page.locator('#step-track-popover [data-preview-step=s2]').click();assert.equal(await page.evaluate(()=>state.editorView.previewStep),'s2');
  assert.equal(await page.locator('#step-track [data-track-step=s2]').evaluate(el=>el.classList.contains('simulated')),true);
  assert.equal(await page.evaluate(()=>C.serialize(state.project)),data);
  await page.evaluate(()=>layerTools.action('all'));assert.equal(await page.evaluate(()=>state.editorView.previewStep),null);
 });
 await check('inspector splits design and presentation settings for objects only',async()=>{
  await page.evaluate(()=>setSelection(['head1']));assert(await page.locator('#inspector-tabs').isVisible());
  assert.equal(await page.locator('[data-property-section="动效"]').isVisible(),false);assert(await page.locator('[data-property-section="排版"]').isVisible());
  await page.screenshot({path:path.join(qa,'inspector-design.png')});
  await page.locator('[data-inspector-tab=show]').click();assert(await page.locator('[data-property-section="出现与退场"]').isVisible());assert.equal(await page.locator('[data-property-section="排版"]').isVisible(),false);
  assert(await page.locator('.selection-step-button').isVisible());await page.screenshot({path:path.join(qa,'inspector-show.png')});
  await page.evaluate(()=>setSelection(['head0']));assert.equal(await page.locator('[data-inspector-tab=show]').getAttribute('aria-selected'),'true');
  await page.locator('[data-inspector-tab=design]').click();await page.evaluate(()=>setSelection([]));assert.equal(await page.locator('#inspector-tabs').isVisible(),false);
  const heading=await page.locator('#inspector-heading').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),weight:+getComputedStyle(e).fontWeight}));
  const summary=await page.locator('#properties .property-section > summary').first().evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),weight:+getComputedStyle(e).fontWeight,color:getComputedStyle(e).color}));
  assert(heading.size>summary.size+3&&heading.weight>summary.weight,JSON.stringify({heading,summary}));
 });
 await check('layers show names first; bulk visibility actions appear only when needed',async()=>{
  await page.evaluate(()=>{setSelection([]);switchLeftTab('layers');});
  assert.equal(await page.locator('.layer-visibility-actions').isVisible(),false);assert.equal(await page.locator('.layer-explanation').count(),0);
  assert.equal(await page.locator('[data-layer-fold-all=close]').count(),1);
  assert.equal(await page.locator('[data-layer=title] [data-lock]').evaluate(e=>getComputedStyle(e).opacity),'0');
  await page.locator('[data-layer=title] .layer-name').click();assert(await page.locator('.layer-visibility-actions [data-editor-action=only]').isVisible());
  await page.locator('[data-editor-eye=title]').click();await page.evaluate(()=>setSelection([]));
  assert(await page.locator('.layer-visibility-actions [data-editor-action=all]').isVisible());assert.equal(await page.locator('[data-editor-eye=title]').evaluate(e=>getComputedStyle(e).opacity),'1');
  await page.locator('[data-layer=head1]').hover();await page.screenshot({path:path.join(qa,'layers.png')});
  await page.locator('.layer-visibility-actions [data-editor-action=all]').click();assert.equal(await page.locator('.layer-visibility-actions').isVisible(),false);
 });
 await check('personal components keep thumbnails and show a hover preview without inserting',async()=>{
  await page.evaluate(()=>switchLeftTab('add'));await page.waitForFunction(()=>document.querySelectorAll('.library-shortcuts button').length>0);
  const count=await page.evaluate(()=>state.project.nodes.length);
  await page.locator('.library-shortcuts button').first().hover();await page.locator('#component-hover-preview').waitFor({state:'visible'});
  assert(await page.locator('#component-hover-preview .hover-stage .node').count());assert.equal(await page.evaluate(()=>state.project.nodes.length),count);
  await page.screenshot({path:path.join(qa,'component-hover.png')});await page.mouse.move(700,450);
 });
 await check('accent color is local, persists after reload and never reaches exports or artwork',async()=>{
  const paper=await page.locator('#paper').evaluate(e=>getComputedStyle(e).backgroundColor);
  await page.locator('#editor-accent').click();await page.locator('#accent-popover').waitFor({state:'visible'});
  await page.locator('#accent-popover [data-accent-preset="#1d5e54"]').click();
  assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--ui-accent-base')),'#1d5e54');
  await page.waitForTimeout(300);// buttons ease their background over 120ms
  assert.equal(await page.locator('#present').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(29, 94, 84)');
  await page.screenshot({path:path.join(qa,'accent-popover.png')});
  await page.locator('#accent-custom').evaluate(e=>{e.value='#8a5a1f';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>localStorage.getItem('studio-editor-accent-v1')),'#8a5a1f');
  assert.equal(await page.locator('#paper').evaluate(e=>getComputedStyle(e).backgroundColor),paper);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#accent-popover').isVisible(),false);
  await page.evaluate(()=>persistNow());await page.reload();await page.waitForFunction(()=>state.ready);
  assert.equal(await page.evaluate(()=>document.body.style.getPropertyValue('--ui-accent-base')),'#8a5a1f');
  const download=page.waitForEvent('download');await page.evaluate(()=>exportHtml('edit'));const file=path.join(qa,'accent-export.html');await (await download).saveAs(file);
  const html=fs.readFileSync(file,'utf8');assert(!/<body[^>]*style=/.test(html));assert(!html.includes('id="accent-popover"'));assert(!html.includes('id="inspector-tabs"'));
  await page.locator('#editor-accent').click();await page.locator('#accent-reset').click();assert.equal(await page.evaluate(()=>localStorage.getItem('studio-editor-accent-v1')),null);await page.keyboard.press('Escape');
 });
 await check('home shows two entries and cover previews of recent projects',async()=>{
  await page.evaluate(()=>persistNow());await page.locator('#topbar .brand').click();await page.locator('#welcome-screen').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelectorAll('#welcome-recent [data-welcome-project]').length>0);
  await page.waitForFunction(()=>document.querySelector('.welcome-thumb .component-preview-world'));
  assert.equal(await page.locator('.welcome-start button').count(),2);assert.equal(await page.locator('.welcome-footer').count(),0);
  await page.screenshot({path:path.join(qa,'home.png')});
  await page.locator('#editor-theme').evaluate(e=>e.click());await page.screenshot({path:path.join(qa,'home-dark.png')});
  await page.locator('#welcome-appearance').click();assert(await page.locator('#accent-popover').isVisible());await page.keyboard.press('Escape');
  await page.setViewportSize({width:720,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:900});
  await page.locator('[data-welcome-project]').first().click();await page.waitForFunction(()=>!state.home);
  await page.evaluate(()=>{switchLeftTab('steps');selectStep(state.project.steps[1].id);});await page.screenshot({path:path.join(qa,'editor-dark-steps.png')});
  await page.locator('#editor-theme').click();
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
