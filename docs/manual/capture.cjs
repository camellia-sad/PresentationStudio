// Reproducible teaching fixture and screenshots; never reads user project data.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),C=require('../../core.js');
const dir=__dirname,root=path.resolve(dir,'../..'),images=path.join(dir,'images');
fs.mkdirSync(images,{recursive:true});
const p=C.newProject('教程练习：从问题到答案');p.canvas.width=1300;p.canvas.height=850;p.canvas.snap=false;
p.steps=[{id:'question',name:'提出问题',duration:3500,note:'先请听众想一想：怎样说明这套流程？',camera:{cx:650,cy:425,zoom:.66}},{id:'solution',name:'展示方案',duration:5000,note:'遮盖退场，露出三个步骤；说明数据只是练习。',camera:{cx:650,cy:425,zoom:.66}},{id:'conclusion',name:'结论与互动',duration:4000,note:'点击按钮查看说明，或返回问题步骤。',camera:{cx:650,cy:425,zoom:.66}}];
function node(type,id,name,x,y,w,h,step,extra={}){const n=C.node(type,x,y,step);Object.assign(n,{id,name,w,h},extra);p.nodes.push(n);return n;}
const title=node('text','title','汇报标题',80,45,1100,75,'question',{text:'从问题到答案',style:{...C.node('text',0,0,'question').style,fontSize:42,fontWeight:700}});
node('text','subtitle','练习提示',80,125,1100,48,'question',{text:'先提问，再揭示方案，最后用按钮补充说明。'});
const answer=node('text','answer','下层方案',100,250,1060,110,'solution',{text:'收集素材   →   整理组件   →   分步讲解',style:{...title.style,fontSize:30,fontWeight:600}});
const cover=node('shape','cover','上层遮盖',80,225,1140,180,'question',{endStepId:'solution'});cover.style.fill='#eee8fa';cover.style.border='#b29acb';cover.style.radius=14;
node('text','question-label','遮盖上的问题',130,275,1040,75,'question',{text:'如何把复杂内容讲清楚？',endStepId:'solution',style:{...title.style,fontSize:34,align:'center'}});
C.group(p,['cover','question-label'],'问题遮盖卡片');
const table=node('table','table','练习数据表',80,455,460,190,'solution',{cells:[['环节','检查点'],['编辑','文字与布局'],['演示','步骤与动效']]});table.style.fontSize=24;
const icon=node('icon','icon','提示图标',610,420,75,75,'solution');icon.style.color='#6d52ae';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="360" height="160" viewBox="0 0 360 160"><rect width="360" height="160" rx="12" fill="#e9f2f0"/><path d="M40 120L100 80L170 100L240 40L315 25" fill="none" stroke="#247b6b" stroke-width="7"/><path d="M40 20V130H325" fill="none" stroke="#71928c" stroke-width="2"/></svg>';
p.assets['practice-image']={name:'练习示意图.svg',data:'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),width:360,height:160};
node('image','image','练习示意图',760,450,420,190,'solution',{assetId:'practice-image',action:{type:'image',value:'practice-image'}});
node('button','note-button','打开说明按钮',80,710,310,65,'conclusion',{text:'查看补充说明',action:{type:'note',value:'这是教程练习项目，表格和图形仅作操作演练。你可以替换成自己的内容。'}});
node('button','back-button','返回问题按钮',430,710,310,65,'conclusion',{text:'回到问题',action:{type:'step',value:'question'}});
const edge=C.edge('table','image','solution',{id:'practice-edge',label:'配图说明',route:'curve',fromAnchor:'right',toAnchor:'left'});edge.animation.type='draw';p.edges.push(edge);
for(const step of p.steps){const items=[...p.nodes,...p.edges].filter(n=>n.stepId===step.id);step.animationOrder=items.map(n=>n.id);items.forEach((n,i)=>{n.animation.start=i?'after':'step';n.animation.duration=500;n.animation.delay=0;});}
C.validate(p);fs.writeFileSync(path.join(dir,'练习项目.studio.json'),C.serialize(p));
let server,browser;const errors=[];
(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(root,'release/汇报工作台-Windows-x64/resources/app/汇报工作台.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launchPersistentContext(path.join(root,'docs/test-runtime/manual-capture'),{headless:true,executablePath:process.env.STUDIO_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>state.ready);
 await page.evaluate(async project=>{await loadProject(project);fitBounds(C.canvasBounds(state.project.canvas));},p);
 await page.screenshot({path:path.join(images,'01-workspace.png')});
 await page.locator('[data-tab=layers]').click();await page.locator('[data-preview-step=solution]').click();await page.evaluate(()=>{state.inspectorMode='canvas';renderInspector();});
 await page.screenshot({path:path.join(images,'02-layers.png')});
 await page.locator('.layer-visibility-actions [data-editor-action=all]').click();assert.equal(await page.evaluate(()=>state.editorView.previewStep),null);await page.locator('[data-tab=steps]').click();await page.locator('[data-select-step=solution]').click();
 await page.screenshot({path:path.join(images,'03-steps.png')});
 await page.locator('#motion-panel').click();await page.screenshot({path:path.join(images,'04-motion.png')});
 await page.locator('#close-dialog').click();await page.keyboard.press('F5');
 assert.equal(await page.locator('[data-node=cover]').isVisible(),true);assert.equal(await page.locator('[data-node=answer]').isVisible(),false);
 await page.locator('#next-step').click();assert.equal(await page.locator('[data-node=cover]').isVisible(),false);assert.equal(await page.locator('[data-node=answer]').isVisible(),true);
 await page.locator('[data-node=image]').click();assert.equal(await page.locator('#dialog-content img').count(),1);await page.locator('#close-dialog').click();
 await page.locator('#next-step').click();await page.locator('[data-node=note-button]').click();assert((await page.locator('#dialog-content').innerText()).includes('这是教程练习项目'));await page.locator('#close-dialog').click();
 await page.locator('[data-node=back-button]').click();assert.equal(await page.evaluate(()=>state.playIndex),0);await page.keyboard.press('Escape');
 if(errors.length)throw Error(errors.join('\n'));console.log('Created practice project and 4 real application screenshots; verified retirement, image, note and step actions.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.close();});
