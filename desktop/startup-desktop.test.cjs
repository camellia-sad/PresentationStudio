'use strict';
const {_electron:electron}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../core.js'),root=path.resolve(__dirname,'..'),data=path.join(root,'docs/test-runtime/startup-'+Date.now()),errors=[];
fs.mkdirSync(data,{recursive:true});let app;
async function launch(extra=[]){
 app=await electron.launch({executablePath:'D:/PresentationStudio/汇报工作台.exe',args:['--data-dir='+data,...extra]});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>state.ready);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()));return page;
}
(async()=>{
 let page=await launch();assert.equal(await page.evaluate(()=>state.home),true);await app.close();app=null;
 const projects=path.join(data,'projects');assert.equal(fs.existsSync(projects)?fs.readdirSync(projects).filter(n=>n.endsWith('.record.json')).length:0,0);
 const source=path.join(data,'import.studio.json');fs.writeFileSync(source,C.serialize(C.newProject('文件入口演练')));
 page=await launch(['--open='+source]);await page.waitForFunction(()=>state.hasProject,{},{polling:100});assert.equal(await page.evaluate(()=>state.project.title),'文件入口演练');assert.equal(await page.evaluate(()=>state.home),false);await app.close();app=null;
 page=await launch();assert.equal(await page.evaluate(()=>state.home),true);assert.equal(await page.locator('[data-welcome-project]').count(),1);assert.equal(await page.evaluate(async()=>(await studioDesktop.allRecords()).length),1);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'docs/qa/startup-desktop-result.json'),JSON.stringify({data,welcomeCloseNoProject:true,fileAssociationImport:true,restartHome:true,errors},null,2));console.log('PASS: closing first welcome creates no project; --open imports explicitly; restart shows one recent project');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await app?.close();});
