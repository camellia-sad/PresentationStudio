'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..'),checks=[],errors=[];
let browser,server;
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});
 await context.addInitScript(()=>{
  const read=(key,id)=>JSON.parse(localStorage.getItem(key+id)||'null'),all=key=>Object.keys(localStorage).filter(k=>k.startsWith(key)).map(k=>JSON.parse(localStorage.getItem(k)));
  window.nativeCalls=[];window.pendingImport=null;
  window.studioDesktop={maximizeWindow:async()=>nativeCalls.push('maximize'),getFullscreen:async()=>false,setFullscreen:async v=>nativeCalls.push('fullscreen:'+v),onFullscreenChanged:()=>{},
   allRecords:async()=>all('test-record:'),readRecord:async id=>read('test-record:',id),putRecord:async r=>localStorage.setItem('test-record:'+r.id,JSON.stringify(r)),
   allComponents:async()=>all('test-component:'),putComponent:async r=>localStorage.setItem('test-component:'+r.id,JSON.stringify(r)),
   openProjectFile:async()=>pendingImport,saveFile:async()=>true,openDataFolder:async()=>{},onImportFile:cb=>window.fileCallback=cb,onBeforeClose:cb=>window.closeCallback=cb,ready:()=>window.desktopReady=true};
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready&&window.desktopReady);
 await check('clean launch shows welcome, requests maximize only, and never creates a project',async()=>{
  assert(await page.locator('#welcome-screen').isVisible());assert.equal(await page.evaluate(()=>state.project.nodes.length),0);assert.equal(await page.evaluate(()=>state.hasProject),false);
  assert.deepEqual(await page.evaluate(()=>nativeCalls),['maximize']);assert.equal(await page.locator('#editor-fullscreen').count(),0);
  await page.evaluate(()=>persistNow());await page.keyboard.press('Control+s');await page.keyboard.press('F5');await page.keyboard.press('Control+j');
  assert.equal(await page.evaluate(async()=>(await studioDesktop.allRecords()).length),0);assert.equal(await page.evaluate(()=>state.playing),false);assert.equal(await page.locator('#dialog').evaluate(e=>e.open),false);
  assert.equal(await page.evaluate(()=>closeCallback()),true);
  await page.screenshot({path:path.join(root,'docs/qa/welcome-empty.png')});
 });
 await check('cancelled create/import keep home empty; creating opens a blank editable project',async()=>{
  await page.locator('#welcome-new').click();assert.equal(await page.locator('#create-sample').count(),0);await page.locator('#close-dialog').click();await page.locator('#library-trash').waitFor();await page.locator('#close-dialog').click();await page.locator('#welcome-import').click();await page.locator('#choose-project-file').click();assert(await page.locator('#welcome-screen').isVisible());await page.locator('#close-dialog').click();await page.locator('#library-trash').waitFor();await page.locator('#close-dialog').click();
  await page.locator('#welcome-new').click();await page.locator('#new-title').fill('季度经营汇报');await page.locator('#create-blank').click();assert.equal(await page.evaluate(()=>state.project.nodes.length),0);assert.equal(await page.locator('#welcome-screen').isVisible(),false);
  await page.evaluate(()=>{addComponent('text');findNode([...state.selected][0]).text='已保存内容';return persistNow();});assert.equal(await page.evaluate(async()=>(await studioDesktop.allRecords()).length),1);
 });
 await check('return home saves, recent projects reopen, reload does not implicitly open or overwrite them',async()=>{
  await page.locator('#topbar .brand').click();assert.equal(await page.locator('[data-welcome-project]').count(),1);const id=await page.locator('[data-welcome-project]').getAttribute('data-welcome-project');
  await page.screenshot({path:path.join(root,'docs/qa/welcome-recent.png')});await page.reload();await page.waitForFunction(()=>window.desktopReady);
  assert(await page.locator('#welcome-screen').isVisible());assert.equal(await page.evaluate(()=>state.hasProject),false);assert.equal(await page.evaluate(async()=>(await studioDesktop.allRecords()).length),1);
  await page.locator('[data-welcome-project]').click();assert.equal(await page.evaluate(()=>state.project.id),id);assert.equal(await page.evaluate(()=>state.project.nodes[0].text),'已保存内容');
 });
 await check('import from welcome opens a copy; invalid input retains home and data; narrow home remains usable',async()=>{
  await page.locator('#topbar .brand').click();await page.evaluate(()=>{pendingImport={content:'bad input'};});await page.locator('#welcome-import').click();await page.locator('#choose-project-file').click();await page.waitForFunction(()=>document.getElementById('dialog-title').textContent==='无法导入项目');assert(await page.locator('#welcome-screen').isVisible());assert.equal(await page.evaluate(async()=>(await studioDesktop.allRecords()).length),1);await page.locator('#close-dialog').click();await page.locator('#library-trash').waitFor();await page.locator('#close-dialog').click();
  await page.evaluate(()=>{const p=C.newProject('导入演练');p.nodes.push(C.node('shape',100,100,p.steps[0].id));pendingImport={content:C.serialize(p)};});await page.locator('#welcome-import').click();await page.locator('#choose-project-file').click();await page.waitForFunction(()=>state.project.title==='导入演练');await page.locator('#topbar .brand').click();assert.equal(await page.locator('[data-welcome-project]').count(),2);
  await page.setViewportSize({width:720,height:800});assert(await page.locator('#welcome-new').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 });
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'docs/qa/welcome-ui-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
