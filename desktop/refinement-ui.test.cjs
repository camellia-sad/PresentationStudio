'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa'),checks=[],errors=[];
let browser,server;
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready);
 await page.evaluate(async()=>{const p=C.newProject('年度经营回顾');p.steps[0].name='经营表现与关键进展';p.steps.push({id:'next',name:'下一阶段的完整行动计划：加强产品交付、客户服务与团队协作，推进季度目标',duration:6000,note:'',camera:null});const n=C.node('text',120,130,p.steps[0].id,{id:'source',text:'年度经营回顾'});n.style.fontSize=32;p.nodes.push(n);await loadProject(p);state.view={x:20,y:20,zoom:1};updateView();setSelection(['source']);});
 await check('paste-only context menu preserves selection and places paste at right-click',async()=>{
  await page.evaluate(()=>copySelected());const box=await page.locator('#viewport').boundingBox();const pt={x:box.x+430,y:box.y+310};await page.mouse.click(pt.x,pt.y,{button:'right'});
  assert.equal(await page.locator('#canvas-context-menu button').count(),1);assert.equal(await page.locator('#canvas-context-menu button').innerText(),'粘贴');assert.deepEqual(await page.evaluate(()=>[...state.selected]),['source']);await page.locator('#canvas-context-menu button').click();
  const center=await page.evaluate(()=>{const b=C.bounds(selectedNodes());return {x:b.x+b.w/2,y:b.y+b.h/2};});assert.deepEqual(center,{x:410,y:290});assert.equal(await page.locator('#canvas-context-menu').count(),0);
  await page.mouse.click(pt.x,pt.y,{button:'right'});await page.keyboard.press('Escape');assert.equal(await page.locator('#canvas-context-menu').count(),0);
  await page.locator('[data-property-section="格式与视野"] summary').click();await page.locator('[data-property-tool=copyStyle]').click();assert(await page.locator('[data-property-tool=pasteStyle]').isVisible());
 });
 await check('full step names shown beside numbers and click navigates without moving camera',async()=>{
  const before=await page.evaluate(()=>({...state.view}));await page.locator('#step-number-open').click();assert.equal(await page.locator('.step-jump-row').count(),2);assert((await page.locator('.step-jump-row').nth(1).innerText()).includes('推进季度目标'));await page.screenshot({path:path.join(qa,'refinement-steps.png')});await page.locator('.step-jump-row').nth(1).click();assert.equal(await page.evaluate(()=>state.activeStep),'next');assert.deepEqual(await page.evaluate(()=>({...state.view})),before);
 });
 let original,templateId,beforeMain;
 async function openEditor(){await page.getByRole('button',{name:'管理',exact:true}).click();await page.locator('#component-search').fill('标题与说明');await page.locator('#component-preview-actions [data-component-action=edit]').click();await page.locator('#template-stage .node').first().waitFor();}
 await check('template drag, resize, edit and undo remain isolated; cancel discards',async()=>{
  await page.evaluate(()=>switchLeftTab('add'));await openEditor();
  original=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('studio-component:')).map(k=>JSON.parse(localStorage.getItem(k))).find(r=>r.project.title==='标题与说明卡片'));templateId=original.id;beforeMain=await page.evaluate(()=>JSON.stringify(state.project));
  const node=page.locator('#template-stage .node').first(),pos=await node.boundingBox();await page.mouse.move(pos.x+10,pos.y+10);await page.mouse.down();await page.mouse.move(pos.x+10+45,pos.y+10+30,{steps:6});await page.mouse.up();const after=await node.boundingBox();assert(Math.abs(after.x-pos.x-45)<2);
  await page.locator('#template-undo').click();assert(Math.abs((await node.boundingBox()).x-pos.x)<2);await page.locator('#template-redo').click();
  await page.locator('#template-fit').click();const baseWidth=(await node.boundingBox()).width;const handle=page.locator('.template-resize'),h=await handle.boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+25,h.y+h.height/2+20,{steps:5});await page.mouse.up();assert((await node.boundingBox()).width>baseWidth+20);
  const ratioBefore=await node.boundingBox(),h2=await handle.boundingBox();await page.keyboard.down('Shift');await page.mouse.move(h2.x+h2.width/2,h2.y+h2.height/2);await page.mouse.down();await page.mouse.move(h2.x+h2.width/2-20,h2.y+h2.height/2-15,{steps:4});await page.mouse.up();await page.keyboard.up('Shift');const ratioAfter=await node.boundingBox();assert(Math.abs(ratioBefore.width/ratioBefore.height-ratioAfter.width/ratioAfter.height)<.01);
  await page.locator('#template-layers button').filter({hasText:/^标题$/}).click();await page.locator('[data-template-prop=text]').fill('取消后不应保存');await page.locator('[data-template-prop=text]').press('Tab');assert.equal(await page.evaluate(()=>JSON.stringify(state.project)),beforeMain);await page.locator('#template-cancel').click();
  assert.deepEqual(await page.evaluate(id=>JSON.parse(localStorage.getItem('studio-component:'+id)),templateId),original);await page.locator('#close-dialog').click();
 });
 await check('template saves visual edits and additions; existing copies stay unchanged',async()=>{
  await openEditor();await page.locator('#template-layers button').filter({hasText:'说明'}).first().click();
  await page.locator('[data-template-prop=text]').fill('已保存的模板内容');await page.locator('[data-template-prop=text]').press('Tab');await page.locator('[data-template-prop="style.fontSize"]').fill('36');await page.locator('[data-template-prop="style.fontSize"]').press('Tab');
  await page.locator('[data-template-add=icon]').click();await page.locator('[data-template-icon=check]').click();const icon=await page.locator('#template-stage .type-icon').boundingBox(),stage=await page.locator('#template-stage').boundingBox();await page.mouse.move(icon.x+icon.width/2,icon.y+icon.height/2);await page.mouse.down();await page.mouse.move(stage.x+stage.width-125,stage.y+stage.height/2,{steps:6});await page.mouse.up();await page.screenshot({path:path.join(qa,'refinement-template-editor.png')});await page.locator('#template-save').click();await page.locator('#component-results').waitFor();
  const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('studio-component:'+id)),templateId);assert(saved.project.nodes.some(n=>n.text==='已保存的模板内容'&&n.style.fontSize===36));assert.equal(saved.project.nodes.length,original.project.nodes.length+1);assert.equal(await page.evaluate(()=>JSON.stringify(state.project)),beforeMain);
  await page.locator('#component-preview-actions [data-component-action=insert]').click();assert(await page.evaluate(()=>selectedNodes().some(n=>n.text==='已保存的模板内容')));
 });
 await check('Escape returns from draft without saving and metadata persists after reload',async()=>{
  await openEditor();await page.locator('#component-name').fill('不保存名称');await page.keyboard.press('Escape');await page.locator('#component-results').waitFor();assert.equal(await page.locator('#dialog-title').innerText(),'我的组件 · 管理');await page.locator('#close-dialog').click();
  await page.reload();await page.waitForFunction(()=>state.ready);const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('studio-component:'+id)),templateId);assert.equal(saved.project.title,'标题与说明卡片');assert(saved.project.nodes.some(n=>n.text==='已保存的模板内容'));
 });
 await check('surface hierarchy and responsive panels do not change artwork',async()=>{
  await page.evaluate(()=>{setSelection([state.project.nodes[0].id]);switchLeftTab('add');});
  const surfaces=await page.evaluate(()=>['left-panel','inspector','properties'].map(id=>getComputedStyle(document.getElementById(id)).backgroundColor));assert.equal(surfaces[0],'rgb(255, 255, 255)');assert.equal(surfaces[1],'rgb(255, 255, 255)');
  await page.screenshot({path:path.join(qa,'refinement-workspace.png')});await page.setViewportSize({width:900,height:720});assert(await page.locator('#viewport').evaluate(el=>el.clientWidth>=350));await page.setViewportSize({width:700,height:800});await page.getByRole('button',{name:'管理',exact:true}).click();await page.locator('#component-preview-actions [data-component-action=edit]').click();assert(await page.locator('#template-stage').evaluate(el=>el.clientWidth>250));await page.locator('#template-cancel').click();await page.locator('#close-dialog').click();
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'refinement-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
