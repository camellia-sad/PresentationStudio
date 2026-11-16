'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa/editor-shell');fs.mkdirSync(qa,{recursive:true});
let server,browser;const checks=[],errors=[],layouts=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready);
 async function fixture(empty=false){await page.evaluate(async empty=>{
  const p=C.newProject('产品策略 · 季度汇报');p.canvas={...p.canvas,width:1200,height:760,background:'#fffefa',grid:false};p.steps[0].name='发现问题，明确机会';p.steps.push({id:'plan',name:'下一阶段 · 从洞察走向行动',duration:6000,note:'用三个重点解释行动计划。',camera:null});
  if(!empty){
   const add=(type,id,text,x,y,w,h,style={})=>{const n=C.node(type,x,y,p.steps[0].id);Object.assign(n,{id,name:text,text,w,h});Object.assign(n.style,style);p.nodes.push(n);return n;};
   add('text','eyebrow','QUARTERLY REVIEW / 2026',64,46,600,30,{fontSize:17,color:'#687083',padding:0});
   add('text','title','把复杂问题，讲得清楚',64,102,1000,90,{fontSize:46,fontWeight:700,color:'#222b40',padding:0});
   add('text','subtitle','从用户洞察到行动，让每一个决策都有依据。',64,204,920,50,{fontSize:23,color:'#6b7280',padding:0});
   const colors=['#edeffe','#f9e2d0','#e4eee9'];['问题在哪里','我们学到了什么','下一步怎么做'].forEach((t,i)=>{const n=add('shape','card'+i,t,64+i*364,315,332,280,{fill:colors[i],borderWidth:0,radius:18});add('text','label'+i,t,90+i*364,348,278,50,{fontSize:27,fontWeight:700,padding:0});add('text','body'+i,['信息分散\n操作层级缺少重点','把内容、结构和属性\n放到各自清楚的位置','统一视觉规则\n聚焦当前任务'][i],90+i*364,430,278,100,{fontSize:22,padding:0});C.group(p,[n.id,'label'+i,'body'+i],t);});
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="280" height="90"><rect width="280" height="90" rx="12" fill="#eaf0f6"/><path d="M30 65 80 40 140 52 210 20" fill="none" stroke="#4d5be9" stroke-width="5"/><circle cx="210" cy="20" r="7" fill="#4d5be9"/></svg>';
   p.assets.chart={name:'趋势示意',mime:'image/svg+xml',width:280,height:90,data:'data:image/svg+xml;base64,'+btoa(svg)};const image=add('image','chart','趋势示意',840,630,280,90);image.assetId='chart';
  }
  await loadProject(p);switchLeftTab('add');fitBounds(C.canvasBounds(p.canvas));setSelection([]);
 },empty);}
 async function capture(name,width,height){await page.waitForTimeout(150);const layout=await page.evaluate(()=>{
   const box=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,overflow:e.scrollWidth>e.clientWidth+(id==='left-panel'?6:2)};};return {top:box('topbar'),left:box('left-panel'),right:box('inspector'),properties:box('properties'),viewport:box('viewport'),tools:box('canvas-tools'),body:document.documentElement.scrollWidth};
  });layouts.push({name,width,height,...layout});await page.screenshot({path:path.join(qa,`${width}-${name}.png`)});assert(layout.viewport.width>=650);assert(!layout.top.overflow&&!layout.left.overflow&&!layout.right.overflow&&!layout.properties.overflow,JSON.stringify(layout));assert(layout.body<=width);assert(await page.locator('#topbar').evaluate(e=>[...e.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width).every(b=>b.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom))); assert(layout.tools.x>=layout.viewport.x&&layout.tools.x+layout.tools.width<=layout.viewport.x+layout.viewport.width+1);await page.screenshot({path:path.join(qa,`${width}-${name}.png`)});}
 for(const [width,height] of [[1280,800],[1440,900]]){await page.setViewportSize({width,height});
  await check(`${width}×${height}: empty, populated, text, image, multiple, steps`,async()=>{
   await fixture(true);assert(await page.locator('#empty-hint').isVisible());await capture('empty',width,height);await page.locator('#empty-hint [data-add=heading]').click();assert.equal(await page.locator('#empty-hint').isVisible(),false);assert.equal(await page.evaluate(()=>state.project.nodes.length),1);
   await fixture();assert.equal(await page.locator('#left-content').evaluate(e=>e.scrollTop),0);await capture('workspace',width,height);assert.equal(await page.locator('.palette .ui-icon').count(),8);assert(await page.locator('.component-shortcut-name').evaluateAll(items=>items.every(e=>e.scrollWidth<=e.clientWidth+1))); assert.equal(await page.locator('.shortcut-thumbnail .component-preview-world').count(),4);
   await page.evaluate(()=>setSelection(['title']));assert.equal(await page.locator('#selection-kind').innerText(),'文字');await capture('text',width,height);
   await page.evaluate(()=>setSelection(['chart']));assert.equal(await page.locator('#selection-kind').innerText(),'图片');assert(await page.locator('[data-command=replace-image]').isVisible());await capture('image',width,height);
   await page.evaluate(()=>setSelection(['title','subtitle']));assert((await page.locator('#selection-kind').innerText()).includes('多选'));assert.equal(await page.locator('#properties [data-prop="style.fontSize"]').getAttribute('placeholder'),'混合值');assert.equal((await page.locator('.mixed-value').innerText()).trim(),'· 混合值');await capture('multiple',width,height);
   await page.evaluate(()=>{setSelection([]);switchLeftTab('steps');selectStep(state.project.steps[0].id);});assert.equal(await page.locator('.step-thumbnail').count(),2);await capture('steps',width,height);
   const before=await page.evaluate(()=>({...state.view}));await page.locator('.step-card').nth(1).click();assert.deepEqual(await page.evaluate(()=>({...state.view})),before);
  });
 }
 await check('theme and real previews preserve content, assets, history and camera',async()=>{
  await fixture();await page.evaluate(()=>setSelection(['card0','label0','body0']));assert.equal(await page.locator('#selection-kind').innerText(),'复合组件');assert.equal(await page.locator('.composite-contents button').count(),3);await capture('composite',1440,900);
  const snapshot=()=>page.evaluate(()=>({project:JSON.stringify(state.project),undo:state.undo.length,view:{...state.view},nodes:[...document.querySelectorAll('#nodes .node')].map(e=>[e.getAttribute('style'),e.innerHTML])}));const before=await snapshot();await page.locator('#editor-theme').click();assert.deepEqual(await snapshot(),before);assert.equal(await page.locator('body').getAttribute('data-editor-theme'),'dark');await capture('dark',1440,900);
  await page.locator('.composite-contents [data-property-select=label0]').click();assert.deepEqual(await page.evaluate(()=>[...state.selected]),['label0']);
  await page.locator('#editor-theme').click();await page.evaluate(()=>switchLeftTab('steps'));await page.evaluate(()=>{currentStep().camera={cx:600,cy:380,zoom:.65};renderLeft();});assert.equal(await page.locator('.step-thumbnail .component-preview-world').first().evaluate(e=>e.style.transform.includes('NaN')),false);
 });
 await check('playback and exported data are unaffected by local theme',async()=>{
  const data=await page.evaluate(()=>C.serialize(state.project));await page.evaluate(()=>enterPresentation(0));const light=await page.locator('#paper').evaluate(e=>getComputedStyle(e).backgroundColor);await page.evaluate(()=>exitPresentation());await page.locator('#editor-theme').click();await page.evaluate(()=>enterPresentation(0));assert.equal(await page.locator('#paper').evaluate(e=>getComputedStyle(e).backgroundColor),light);assert.equal(await page.evaluate(()=>C.serialize(state.project)),data);await page.evaluate(()=>exitPresentation());
  const download=page.waitForEvent('download');await page.evaluate(()=>exportHtml('edit'));const file=await download;const dest=path.join(qa,'theme-export.html');await file.saveAs(dest);const exported=fs.readFileSync(dest,'utf8');assert(!/<body[^>]*data-editor-theme/.test(exported));
  const exportedPage=await browser.newPage();await exportedPage.goto('file:///'+dest.replace(/\\/g,'/'));await exportedPage.waitForFunction(()=>state.ready);assert.equal(await exportedPage.locator('#editor-theme').count(),1);assert.equal(await exportedPage.locator('.sidebar-resize').count(),2);await exportedPage.close();
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'result.json'),JSON.stringify({checks,errors,layouts},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
