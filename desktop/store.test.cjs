const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {ProjectStore}=require('./store.cjs'),C=require('../core.js');
(async()=>{
  const tempRoot=path.resolve(__dirname,'../docs/test-runtime');await fs.mkdir(tempRoot,{recursive:true});
  const folder=await fs.mkdtemp(path.join(tempRoot,'studio-store-test-'));
  try {
    const store=new ProjectStore(folder),project=C.newProject('保存与回收测试');
    const record={id:project.id,project,writer:'test',revision:1,updatedAt:Date.now(),view:{x:0,y:0,zoom:1}};
    await store.put(record);assert.deepEqual((await store.read(project.id)).project,project);
    record.deletedAt=Date.now();record.revision++;await store.put(record);
    assert.equal((await new ProjectStore(folder).all()).filter(r=>!r.deletedAt).length,0);
    delete record.deletedAt;record.revision++;await store.put(record);
    assert.equal((await new ProjectStore(folder).all()).filter(r=>!r.deletedAt).length,1);
    await assert.rejects(()=>store.read('../outside'),/标识/);
    await fs.writeFile(store.file(project.id),'{broken');
    assert((await store.read(project.id)).deletedAt,'previous version recovers after corruption');
    await store.put(record);assert.equal((await store.read(project.id)).revision,3);
    await assert.rejects(()=>store.purgeTrash([project.id]),/回收站/);
    const active=C.newProject('保留项目');await store.put({...record,id:active.id,project:active});
    record.deletedAt=Date.now();record.revision++;await store.put(record);
    assert.equal(await store.purgeTrash([project.id]),1);
    assert.equal(await new ProjectStore(folder).read(project.id),null);
    assert.equal((await store.all()).length,1);assert(await store.read(active.id));
    await assert.rejects(()=>fs.access(store.file(project.id)+'.bak'));
    assert.throws(()=>store.purgeTrash(['../outside']),/标识/);
    console.log('PASS: disk persistence, trash/restore across restart, path validation, backup recovery');
  }finally{await fs.rm(folder,{recursive:true,force:true});}
})();
