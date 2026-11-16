'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'docs/qa'),profile=path.join(root,'docs/test-runtime/browser');
fs.mkdirSync(qa,{recursive:true});fs.mkdirSync(profile,{recursive:true});
const entry=path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html');
const errors=[],checks=[];
let browser,server;
async function check(name,fn){await fn();checks.push(name);console.log('PASS:',name);}
(async()=>{
  server=http.createServer((request,response)=>{response.setHeader('Content-Type','text/html;charset=utf-8');response.end(fs.readFileSync(request.url==='/export.html'?path.join(qa,'export.html'):entry));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',viewport:{width:1440,height:960},acceptDownloads:true});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>state.ready);
  await page.evaluate(async()=>{
    const p=C.newProject('UI regression');p.canvas.snap=false;
    p.steps.push({id:'second',name:'第二步',duration:300,note:'',camera:null});
    const a=C.node('text',120,180,p.steps[0].id),b=C.node('shape',500,180,p.steps[0].id),c=C.node('button',120,400,p.steps[0].id);
    a.id='a';a.name='检索目标';a.text='查找这段文字';b.id='b';b.name='背景';c.id='c';c.name='切换组合';
    p.nodes.push(a,b,c);const group=C.group(p,['a','b'],'示例组合');c.action={type:'group',value:group.id};
    const edge=C.edge('a','b',p.steps[0].id);edge.id='ab';p.edges.push(edge);await loadProject(p);
  });
  await check('search locates text and restores the previous camera',async()=>{
    const before=await page.evaluate(()=>({...state.view}));await page.keyboard.press('Control+k');
    await page.getByRole('searchbox',{name:'搜索对象、步骤和功能'}).fill('查找这段文字');
    await page.getByRole('searchbox',{name:'搜索对象、步骤和功能'}).press('Enter');
    assert.deepEqual(await page.evaluate(()=>[...state.selected]),['a']);
    await page.locator('#previous-view').click();assert.deepEqual(await page.evaluate(()=>({...state.view})),before);
  });
  await check('layer filtering and selection do not move the camera; group folding works',async()=>{
    await page.locator('[data-tab=layers]').click();const before=await page.evaluate(()=>({...state.view}));
    await page.getByRole('searchbox',{name:'搜索图层'}).fill('检索目标');
    assert.equal(await page.locator('[data-layer]:visible').count(),1);
    await page.locator('[data-layer=a] .layer-name').click();assert.deepEqual(await page.evaluate(()=>({...state.view})),before);
    await page.getByRole('searchbox',{name:'搜索图层'}).fill('');
    await page.locator('[data-fold-group]').click();assert.equal(await page.locator('.group-children:visible').count(),0);
    await page.locator('[data-fold-group]').click();
    await page.locator('[data-layer=a] .layer-name').dblclick();
    assert.notDeepEqual(await page.evaluate(()=>({...state.view})),before);
    await page.locator('#previous-view').click();
  });
  await check('Ctrl+S from a property input saves without downloading or losing text',async()=>{
    await page.locator('[data-layer=a] .layer-name').click();
    const field=page.locator('#properties textarea[data-prop=text]');await field.fill('输入焦点保存验证');
    await field.press('Control+s');await page.waitForFunction(()=>$('save-state').textContent==='已自动保存');
    assert.equal(await page.evaluate(()=>state.project.nodes.find(n=>n.id==='a').text),'输入焦点保存验证');
  });
  await check('native clipboard copies a functional group and undo restores the document',async()=>{
    await page.evaluate(()=>{setSelection(['a','b','c']);focusCanvas();});
    await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
    await page.waitForFunction(()=>state.project.nodes.length===6);
    assert(await page.evaluate(()=>{const copied=selectedNodes().find(n=>n.type==='button');return copied.action.value!==findNode('c').action.value&&state.project.groups.some(g=>g.id===copied.action.value);}));
    await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>state.project.nodes.length),3);
  });
  await check('format shortcuts and explicit mode switches work without editing text',async()=>{
    await page.evaluate(()=>{findNode('a').style.fontSize=38;setSelection(['a']);focusCanvas();});
    await page.keyboard.press('Control+Shift+c');await page.evaluate(()=>{setSelection(['c']);focusCanvas();});await page.keyboard.press('Control+Shift+v');
    assert.equal(await page.evaluate(()=>findNode('c').style.fontSize),38);
    assert.equal(await page.locator('#editing-options,#edge-insert-toggle,#mindmap-keys').count(),0);
    await page.evaluate(()=>{setSelection(['a']);focusCanvas();});const count=await page.evaluate(()=>state.project.nodes.length);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>state.project.nodes.length),count+1);await page.keyboard.press('Control+z');
  });
  await check('project search narrows stored projects',async()=>{
    await page.locator('#library').click();await page.getByRole('searchbox',{name:'搜索项目名称'}).fill('this name cannot match');assert.equal(await page.locator('.project-item:visible').count(),0);await page.locator('#close-dialog').click();
  });
  await check('animation sequence produces increasing delays and can pause/replay',async()=>{
    await page.locator('#motion-panel').click();await page.locator('#motion-sequential').click();
    const rows=page.locator('.motion-row');assert.equal(await rows.count(),4);
    await rows.nth(0).locator('[data-motion-prop=type]').selectOption('slide-left');
    await page.locator('#motion-preview').click();
    assert.equal(await page.locator('[data-node=a] .node-body').evaluate(el=>el.style.getPropertyValue('--delay')),'0ms');
    assert.equal(await page.locator('[data-node=b] .node-body').evaluate(el=>el.style.getPropertyValue('--delay')),'600ms');
    await page.locator('#pause-effects').click();assert.equal(await page.locator('#pause-effects').textContent(),'继续动效');
    await page.locator('#replay-step').click();assert.equal(await page.locator('#pause-effects').textContent(),'暂停动效');
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>state.playing),false);
    assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);await page.locator('#close-dialog').click();
  });
  await check('F5 starts presentation from an input and Shift+F5 starts the selected step',async()=>{
    await page.locator('#project-title').focus();await page.keyboard.press('F5');assert.equal(await page.evaluate(()=>state.playIndex),0);
    await page.keyboard.press('Escape');await page.evaluate(()=>{state.activeStep='second';});
    await page.keyboard.press('Shift+F5');assert.equal(await page.evaluate(()=>state.playIndex),1);await page.keyboard.press('Escape');
  });
  await check('exported HTML opens with one toolset, correct animations and no script errors',async()=>{
    const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>exportHtml('edit'));const download=await downloadPromise;await download.saveAs(path.join(qa,'export.html'));
    const exported=await browser.newPage();exported.on('pageerror',error=>errors.push(error.message));await exported.goto(base+'/export.html');await exported.waitForFunction(()=>state.ready);
    assert.equal(await exported.locator('#quick-search').count(),1);assert.equal(await exported.locator('#workflow-tools').count(),1);
    assert.equal(await exported.locator('#step-number-open').count(),1);assert.equal(await exported.locator('#player-step-number').count(),1);
    await exported.keyboard.press('Control+j');await exported.locator('#step-number-dialog input').fill('2');await exported.locator('#step-number-dialog input').press('Enter');assert.equal(await exported.evaluate(()=>state.activeStep),'second');
    assert.equal(await exported.evaluate(()=>state.project.nodes.find(n=>n.id==='a').animation.type),'slide-left');
    await exported.close();
  });
  await page.evaluate(()=>persistNow());await page.reload();await page.waitForFunction(()=>state.ready);
  assert.equal(await page.evaluate(()=>state.project.nodes.find(n=>n.id==='a').text),'输入焦点保存验证');checks.push('autosave survives reload');
  await page.locator('#motion-panel').click();await page.screenshot({path:path.join(qa,'animation-panel.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(qa,'ui-result.json'),JSON.stringify({checks,errors},null,2));
})().catch(error=>{console.error(error);fs.writeFileSync(path.join(qa,'ui-failure.txt'),error.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
