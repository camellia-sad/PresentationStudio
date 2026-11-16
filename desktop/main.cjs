'use strict';
const {app,BrowserWindow,ipcMain,dialog,shell,Menu}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const {ProjectStore}=require('./store.cjs');
const customData=process.argv.find(a=>a.startsWith('--data-dir='))?.slice(11);
app.setPath('userData',customData?path.resolve(customData):path.join(app.getPath('appData'),'PresentationStudio'));
app.setName('汇报工作台');app.setAppUserModelId('local.presentation.studio');
const store=new ProjectStore(path.join(app.getPath('userData'),'projects'));
const componentStore=new ProjectStore(path.join(app.getPath('userData'),'component-library'));
const html=path.join(__dirname,'汇报工作台.html'),trustedURL=pathToFileURL(html).href;
let win,ready=false,closing=false,closeToken=null,closeTimer=null;
let pendingFile=process.argv.find(a=>a.startsWith('--open='))?.slice(7)||null;
function trusted(event){if(!win||event.sender!==win.webContents||event.senderFrame?.url!==trustedURL)throw new Error('不允许的窗口请求');}
function handle(channel,fn){ipcMain.handle(channel,async(event,...args)=>{trusted(event);return fn(...args);});}
async function readProjectFile(filename) {
  if(!/\.(json|html?)$/i.test(filename))throw new Error('仅支持 JSON 或工作台 HTML');
  if((await fs.stat(filename)).size>100*1024*1024)throw new Error('项目文件超过 100 MB');
  return {name:path.basename(filename),content:await fs.readFile(filename,'utf8')};
}
async function deliverFile() {
  if(!ready||!pendingFile)return;
  const file=pendingFile;pendingFile=null;
  try{win.webContents.send('studio:file',await readProjectFile(file));}
  catch(error){dialog.showErrorBox('无法导入',error.message);}
}
async function closeFailure() {
  clearTimeout(closeTimer);closeToken=null;
  const {response}=await dialog.showMessageBox(win,{type:'warning',title:'项目尚未保存',message:'自动保存未完成。请返回工作台导出 JSON，或重试关闭。',buttons:['返回工作台','重试保存并关闭'],defaultId:0,cancelId:0});
  if(response===1)win.close();
}
if(!app.requestSingleInstanceLock()){app.quit();}
else {
  app.on('second-instance',(_event,argv)=>{
    pendingFile=argv.find(a=>a.startsWith('--open='))?.slice(7)||null;
    if(win){if(win.isMinimized())win.restore();win.setFullScreen(false);win.maximize();win.show();win.focus();deliverFile();}
  });
  app.whenReady().then(async()=>{
    Menu.setApplicationMenu(null);
    win=new BrowserWindow({title:'汇报工作台',width:1440,height:960,minWidth:1000,minHeight:700,backgroundColor:'#f7f6f1',icon:path.join(__dirname,'studio.ico'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
    win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//i.test(url))shell.openExternal(url);return {action:'deny'};});
    win.webContents.on('will-navigate',(event,url)=>{if(url!==trustedURL)event.preventDefault();});
    win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    win.webContents.session.setPermissionCheckHandler(()=>false);
    handle('studio:components-list',()=>componentStore.all());handle('studio:components-put',record=>componentStore.put(record));
    handle('studio:maximize',()=>{win.setFullScreen(false);win.maximize();return win.isMaximized();});
    handle('studio:fullscreen-get',()=>win.isFullScreen());
    handle('studio:fullscreen-set',value=>{if(typeof value!=='boolean')throw new Error('全屏状态无效');win.setFullScreen(value);return win.isFullScreen();});
    win.on('enter-full-screen',()=>win.webContents.send('studio:fullscreen-changed',true));
    win.on('leave-full-screen',()=>win.webContents.send('studio:fullscreen-changed',false));
    handle('studio:read',id=>store.read(id));handle('studio:list',()=>store.all());handle('studio:put',record=>store.put(record));
    handle('studio:purge-trash',ids=>store.purgeTrash(ids));
    handle('studio:folder',async()=>{await fs.mkdir(store.directory,{recursive:true});return shell.openPath(store.directory);});
    handle('studio:import',async()=>{
      const result=await dialog.showOpenDialog(win,{title:'导入项目 JSON 或工作台 HTML',properties:['openFile'],filters:[{name:'工作台项目',extensions:['json','html','htm']}]});
      return result.canceled?null:readProjectFile(result.filePaths[0]);
    });
    handle('studio:export',async file=>{
      if(!file||typeof file.content!=='string'||Buffer.byteLength(file.content)>150*1024*1024||typeof file.filename!=='string'||!['.json','.html','.md'].some(ext=>file.filename.endsWith(ext)))throw new Error('导出内容无效');
      const ext=path.extname(file.filename).slice(1),label={json:'项目 JSON',html:'离线 HTML',md:'Agent 教程 Markdown'}[ext];
      const result=await dialog.showSaveDialog(win,{title:'导出'+label,defaultPath:path.join(app.getPath('documents'),path.basename(file.filename)),filters:[{name:label,extensions:[ext]}]});
      if(result.canceled)return false;
      await fs.writeFile(result.filePath,file.content,'utf8');return true;
    });
    ipcMain.on('studio:ready',event=>{trusted(event);ready=true;deliverFile();});
    ipcMain.on('studio:closed',(event,token,saved)=>{
      trusted(event);if(token!==closeToken)return;clearTimeout(closeTimer);
      if(saved){closing=true;win.close();}else closeFailure();
    });
    win.on('close',event=>{
      if(closing||!ready)return;event.preventDefault();if(closeToken)return;
      closeToken=randomUUID();win.webContents.send('studio:close',closeToken);closeTimer=setTimeout(closeFailure,15000);
    });
    win.on('closed',()=>{win=null;});
    win.once('ready-to-show',()=>{win.setFullScreen(false);win.maximize();win.show();});await win.loadFile(html);
  }).catch(error=>{dialog.showErrorBox('工作台无法启动',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
}
