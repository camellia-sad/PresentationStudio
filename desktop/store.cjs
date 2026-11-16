'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const C=require(require('node:fs').existsSync(path.join(__dirname,'core.js'))?'./core.js':'../core.js');
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(id);
function validateRecord(record) {
  if(!record||!validId(record.id)||record.id!==record.project?.id)throw new Error('项目标识无效');
  const result=structuredClone(record);result.project=C.validate(record.project);
  if(!Number.isInteger(result.revision)||result.revision<1||!Number.isFinite(result.updatedAt)||typeof result.writer!=='string')throw new Error('项目记录无效');
  if(!result.view||!['x','y','zoom'].every(k=>Number.isFinite(result.view[k]))||result.view.zoom<=0)throw new Error('项目视角无效');
  if(result.deletedAt!==undefined&&(!Number.isFinite(result.deletedAt)||result.deletedAt<=0))throw new Error('回收站记录无效');
  return result;
}
class ProjectStore {
  constructor(directory){this.directory=directory;this.queue=Promise.resolve();}
  file(id){if(!validId(id))throw new Error('项目标识无效');return path.join(this.directory,id+'.record.json');}
  async readDirect(id) {
    const file=this.file(id);
    try {return validateRecord(JSON.parse(await fs.readFile(file,'utf8')));}
    catch(error) {
      if(error.code==='ENOENT')return null;
      try {return validateRecord(JSON.parse(await fs.readFile(file+'.bak','utf8')));}
      catch {throw new Error('项目文件损坏，无法读取：'+id);}
    }
  }
  async read(id){await this.queue;return this.readDirect(id);}
  async all() {
    await this.queue;await fs.mkdir(this.directory,{recursive:true});
    const names=await fs.readdir(this.directory),records=[];
    for(const name of names.filter(n=>n.endsWith('.record.json')))records.push(await this.readDirect(name.slice(0,-12)));
    return records.filter(Boolean);
  }
  put(input) {
    const record=validateRecord(input);
    const operation=this.queue.then(async()=>{
      await fs.mkdir(this.directory,{recursive:true});const file=this.file(record.id),temporary=file+'.tmp';
      // Flush before replacing. Keep the previous valid file as a recovery copy.
      const handle=await fs.open(temporary,'w');
      try {await handle.writeFile(JSON.stringify(record,null,2),'utf8');await handle.sync();}finally{await handle.close();}
      let previous=null;
      try {previous=validateRecord(JSON.parse(await fs.readFile(file,'utf8')));}
      catch(error){if(error.code&&error.code!=='ENOENT')throw error;}
      if(previous)await fs.copyFile(file,file+'.bak');
      await fs.rename(temporary,file);return true;
    });
    this.queue=operation.catch(()=>{});return operation;
  }
  purgeTrash(ids) {
    if(!Array.isArray(ids)||ids.length>10000||ids.some(id=>!validId(id)))throw new Error('回收站标识无效');
    const operation=this.queue.then(async()=>{
      const records=await Promise.all([...new Set(ids)].map(id=>this.readDirect(id)));
      if(records.some(r=>r&&!r.deletedAt))throw new Error('只能永久删除回收站项目');
      let count=0;
      for(const record of records.filter(Boolean)){
        const file=this.file(record.id);
        for(const suffix of ['.bak','.tmp',''])await fs.rm(file+suffix,{force:true});
        count++;
      }
      return count;
    });
    this.queue=operation.catch(()=>{});return operation;
  }
}
module.exports={ProjectStore,validateRecord};
