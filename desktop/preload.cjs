'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studioDesktop',{
  maximizeWindow:()=>ipcRenderer.invoke('studio:maximize'),
  getFullscreen:()=>ipcRenderer.invoke('studio:fullscreen-get'),
  setFullscreen:value=>ipcRenderer.invoke('studio:fullscreen-set',value),
  onFullscreenChanged:callback=>ipcRenderer.on('studio:fullscreen-changed',(_event,value)=>callback(value)),
  allComponents:()=>ipcRenderer.invoke('studio:components-list'),
  putComponent:record=>ipcRenderer.invoke('studio:components-put',record),
  readRecord:id=>ipcRenderer.invoke('studio:read',id),
  allRecords:()=>ipcRenderer.invoke('studio:list'),
  putRecord:record=>ipcRenderer.invoke('studio:put',record),
  purgeTrash:ids=>ipcRenderer.invoke('studio:purge-trash',ids),
  openProjectFile:()=>ipcRenderer.invoke('studio:import'),
  saveFile:file=>ipcRenderer.invoke('studio:export',file),
  openDataFolder:()=>ipcRenderer.invoke('studio:folder'),
  ready:()=>ipcRenderer.send('studio:ready'),
  onImportFile:callback=>ipcRenderer.on('studio:file',(_event,file)=>callback(file)),
  onBeforeClose:callback=>ipcRenderer.on('studio:close',async(_event,token)=>{
    let saved=false;try{saved=await callback();}catch{}
    ipcRenderer.send('studio:closed',token,Boolean(saved));
  })
});
