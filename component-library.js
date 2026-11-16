/* Personal component templates; separate from project content and undo history. */
(function(global){
  'use strict';
  const C=typeof module!=='undefined'&&module.exports?require('./core.js'):global.StudioCore;
  function capture(project,ids,edgeId=null){
    const f=C.copyFragment(project,ids),line=project.edges.find(e=>e.id===edgeId);
    if(line&&C.isFreeEdge(line)&&!f.edges.some(e=>e.id===line.id))f.edges.push(C.detachedEdge(line,project.nodes));
    if(!f.nodes.length&&!f.edges.length)throw new Error('请先选择要保存的组件或自由连线。');
    f.sourceProjectId='component-template';
    const p=C.newProject();C.pasteFragment(p,f,p.steps[0].id,0);
    const box=C.bounds(C.contentNodes(p));
    for(const n of p.nodes){n.x-=box.x;n.y-=box.y;n.locked=false;n.hidden=false;n.endStepId='';}
    for(const e of p.edges){if(C.isFreeEdge(e)){for(const point of [e.fromPoint,e.toPoint]){point.x-=box.x;point.y-=box.y;}}e.endStepId='';}
    p.canvas={...p.canvas,x:-40,y:-40,width:Math.max(100,box.w+80),height:Math.max(100,box.h+80)};
    return C.validate(p);
  }
  function insert(project,template,stepId,center){
    const source=C.copy(C.validate(template));source.id='component-template';
    const f=C.copyFragment(source,source.nodes.map(n=>n.id));
    f.edges.push(...source.edges.filter(e=>C.isFreeEdge(e)&&!f.edges.some(x=>x.id===e.id)).map(C.copy));
    const box=C.bounds(C.contentNodes(source)),oldEdges=new Set(project.edges.map(e=>e.id));
    const ids=C.pasteFragment(project,f,stepId,0),dx=center.x-(box.x+box.w/2),dy=center.y-(box.y+box.h/2);
    project.nodes.filter(n=>ids.includes(n.id)).forEach(n=>{n.x+=dx;n.y+=dy;n.hidden=false;n.locked=false;});
    const edges=project.edges.filter(e=>!oldEdges.has(e.id));
    for(const e of edges.filter(C.isFreeEdge))for(const pt of [e.fromPoint,e.toPoint]){pt.x+=dx;pt.y+=dy;}
    if(ids.length>1&&!project.groups.some(g=>g.nodeIds.some(id=>ids.includes(id))))C.group(project,ids,template.title);
    C.validate(project);return {ids,edgeId:ids.length?null:edges[0]?.id};
  }
  function defaults(){
    return [['title','标题与说明卡片','#fffefb','标题','在这里填写说明',null],['question','问题卡片','#fffefb','提出一个问题','在这里填写要讨论的问题','question'],['idea','灯泡创新点','#fff8e0','核心创新','用一句话说明新的做法','bulb'],['limitation','局限性卡片','#fae9e6','局限性','对齐不准、上下文不足时，局部修复仍可能失败',null]].map(([id,name,fill,title,body,icon])=>{
      const p=C.newProject();p.id='component-default-'+id;p.title=name;const step=p.steps[0].id;
      const bg=C.node('shape',0,0,step);Object.assign(bg,{w:640,h:190,name:name+'背景'});Object.assign(bg.style,{fill,border:'#e0dce5',borderWidth:1,radius:18});p.nodes.push(bg);
      const head=C.node('text',icon?110:26,22,step);Object.assign(head,{w:icon?500:588,h:52,text:title,name:title});Object.assign(head.style,{fontSize:32,fontWeight:700,padding:0});p.nodes.push(head);
      const desc=C.node('text',icon?110:26,90,step);Object.assign(desc,{w:icon?500:588,h:80,text:body,name:'说明'});Object.assign(desc.style,{fontSize:25,padding:0});p.nodes.push(desc);
      if(icon){const n=C.node('icon',24,32,step);Object.assign(n,{w:60,h:60,icon,name:icon==='bulb'?'灯泡':'问号'});n.style.color=icon==='bulb'?'#c19b2f':'#8064ad';p.nodes.push(n);}
      C.group(p,p.nodes.map(n=>n.id),name);return p;
    });
  }
  function install(api){
    const {state,$,escapeHtml:esc,desktop}=api;
    let records=[],loaded=false,error='',pending=Promise.resolve(),busy=false;
    const prefix='studio-component:';
    const sorted=()=>records.filter(r=>!r.deletedAt).sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||b.updatedAt-a.updatedAt);
    function record(project,category='我的组件'){return {id:project.id,project,category,revision:1,writer:'component-library',updatedAt:Date.now(),view:{x:0,y:0,zoom:1}};}
    function put(r){
      const next={...C.copy(r),revision:r.revision+1,updatedAt:Date.now()};
      pending=pending.catch(()=>{}).then(async()=>{
        C.validate(next.project);
        if(desktop)await desktop.putComponent(next);else localStorage.setItem(prefix+next.id,JSON.stringify(next));
        records=records.filter(x=>x.id!==next.id);records.push(next);api.renderLeft();return next;
      });return pending;
    }
    async function load(){
      try{
        if(desktop)records=await desktop.allComponents();else records=Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>JSON.parse(localStorage.getItem(k)));
        records.forEach(r=>C.validate(r.project));
        // Stable IDs initialize each starter once; deleting one never resurrects it.
        for(const p of defaults())if(!records.some(r=>r.id===p.id))await put(record(p,'常用卡片'));
        loaded=true;error='';
      }catch(e){error=e.message;loaded=false;}
      api.renderLeft();
    }
    function markup(){
      return '<section class="personal-library"><div class="library-heading"><strong>我的组件</strong><button data-component-action="manage">管理</button></div><button class="library-save" data-component-action="save">＋ 将选中内容存为组件</button>'+(loaded?'<div class="library-shortcuts">'+sorted().map(r=>`<button data-component-action="insert" data-template-id="${esc(r.id)}" title="${esc(r.category||'未分类')}" aria-label="${esc(r.project.title)}"><span class="shortcut-thumbnail" data-shortcut-preview="${esc(r.id)}" aria-hidden="true"></span><span class="component-shortcut-name">${r.favorite?'★ ':''}${esc(r.project.title)}</span></button>`).join('')+'</div>':`<p class="hint">${esc(error||'正在读取组件库…')}</p>${error?'<button data-component-action="reload">重试读取</button>':''}`)+'</section>';
    }
    let shortcutObserver=null;
    // Hovering a shortcut shows a larger isolated preview beside the panel; clicking still inserts.
    const hoverPreview=document.createElement('div');hoverPreview.id='component-hover-preview';hoverPreview.className='editor-chrome';hoverPreview.dataset.editorTool='true';hoverPreview.hidden=true;hoverPreview.setAttribute('aria-hidden','true');document.body.append(hoverPreview);
    let hoverTimer=0;
    function hideHover(){clearTimeout(hoverTimer);hoverPreview.hidden=true;}
    function showHover(button){
      const r=records.find(r=>r.id===button.dataset.templateId);if(!r||state.playing)return;
      hoverPreview.innerHTML=`<div class="hover-stage"></div><div><strong>${esc(r.project.title)}</strong><span>${esc(r.category||'未分类')}</span></div>`;
      hoverPreview.hidden=false;
      const panel=document.getElementById('left-panel').getBoundingClientRect(),b=button.getBoundingClientRect(),h=hoverPreview.offsetHeight;
      hoverPreview.style.left=Math.round(panel.right+8)+'px';hoverPreview.style.top=Math.round(Math.max(8,Math.min(innerHeight-h-8,b.top+b.height/2-h/2)))+'px';
      paint(hoverPreview.querySelector('.hover-stage'),r.project);
    }
    function decorate(){
      shortcutObserver?.disconnect();hideHover();
      const list=document.querySelector(".library-shortcuts");if(!list)return;
      const drawShortcuts=()=>list.querySelectorAll("[data-shortcut-preview]").forEach(el=>{const r=records.find(r=>r.id===el.dataset.shortcutPreview);if(r)paint(el,r.project);});
      drawShortcuts();shortcutObserver=new ResizeObserver(drawShortcuts);shortcutObserver.observe(list);
      list.addEventListener('pointerover',event=>{const b=event.target.closest('[data-template-id]');if(!b||event.pointerType==='touch')return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showHover(b),hoverPreview.hidden?450:80);});
      list.addEventListener('pointerleave',hideHover);list.addEventListener('pointerdown',hideHover);list.addEventListener('scroll',hideHover,{passive:true});
    }
    function selection(){return capture(state.project,[...state.selected],state.edgeId);}
    function doInsert(id){
      const r=records.find(r=>r.id===id&&!r.deletedAt);if(!r||state.playing)return;
      api.finishEditing();let result;
      api.change(()=>{result=insert(state.project,r.project,state.activeStep,api.viewportCenter());api.growCanvas();});
      $('dialog').close();api.setSelection(result.ids);if(result.edgeId){state.edgeId=result.edgeId;api.renderCanvas();api.renderInspector();}
      api.toast('已插入独立副本，可继续编辑；模板保持不变。');
    }
    function showSave(){
      api.finishEditing();const p=selection();
      api.openDialog('保存到我的组件','<label class="field">组件名称<input id="component-name" maxlength="80" value="新组件"></label><label class="field">分类<input id="component-category" maxlength="40" value="我的组件"></label><p class="hint">保留文字、图标、图片、样式和内部连线；插入时归入当前步骤。</p><button id="component-save-submit">保存组件</button>');
      $('component-save-submit').onclick=()=>run(async()=>{
        const name=$('component-name').value.trim();if(!name)throw new Error('请输入组件名称。');p.title=name;
        await put(record(p,$('component-category').value.trim()||'未分类'));$('dialog').close();api.toast('组件已保存，可在其他项目中使用。');
      });
    }
    let recycle=false,query='',selectedId=null,previewObserver=null;
    function filtered(){return records.filter(r=>Boolean(r.deletedAt)===recycle&&[r.project.title,r.category||''].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||b.updatedAt-a.updatedAt);}
    function rows(){
      return filtered().map(r=>`<button class="component-entry component-card ${r.id===selectedId?'active':''}" data-component-action="preview" data-template-id="${esc(r.id)}" aria-pressed="${r.id===selectedId}"><span class="component-thumbnail" aria-hidden="true" data-component-thumbnail="${esc(r.id)}"></span><strong>${esc(r.project.title)}</strong><span>${esc(r.category||'未分类')}${r.favorite?' · ★':''}</span></button>`).join('')||'<p>没有符合条件的组件。</p>';
    }
    function paint(container,project,view=null){return StudioPreview.paint({...api,C},container,project,view);}
    function draw(){
      const record=filtered().find(r=>r.id===selectedId);if(!record){selectedId=filtered()[0]?.id;}
      const r=filtered().find(r=>r.id===selectedId),preview=$('component-preview');if(!preview)return;
      if(r)paint(preview,r.project);else preview.innerHTML='<p>选择组件以预览</p>';
      $('component-preview-title').textContent=r?.project.title||'组件预览';
      $('component-preview-actions').innerHTML=r?(recycle?`<button data-component-action="restore" data-template-id="${esc(r.id)}">恢复</button>`:`<button class="primary" data-component-action="insert" data-template-id="${esc(r.id)}">插入画布</button><button data-component-action="edit" data-template-id="${esc(r.id)}">编辑</button><button data-component-action="star" data-template-id="${esc(r.id)}" aria-label="${r.favorite?'取消收藏':'收藏'}${esc(r.project.title)}">${r.favorite?'取消收藏':'收藏'}</button><button class="danger" data-component-action="delete" data-template-id="${esc(r.id)}">删除</button>`):'';
      $('component-results').querySelectorAll('[data-component-thumbnail]').forEach(el=>{const r=records.find(r=>r.id===el.dataset.componentThumbnail);paint(el,r.project);});
      $('component-results').querySelectorAll('.component-card').forEach(el=>{el.classList.toggle('active',el.dataset.templateId===selectedId);el.setAttribute('aria-pressed',String(el.dataset.templateId===selectedId));});
    }
    function manage(){
      previewObserver?.disconnect();
      api.openDialog('我的组件 · 管理',`<div class="component-manage-bar"><input id="component-search" type="search" placeholder="搜索名称或分类" aria-label="搜索我的组件" value="${esc(query)}"><button data-component-action="recycle">${recycle?'返回组件库':'回收站'}</button><button data-component-action="save">保存选中</button></div><div class="component-manager-layout"><section class="component-preview-panel"><h3 id="component-preview-title">组件预览</h3><div id="component-preview"></div><div id="component-preview-actions" class="property-buttons"></div></section><div id="component-results">${rows()}</div></div>`);
      $('dialog').classList.add('component-dialog');draw();
      previewObserver=new ResizeObserver(draw);previewObserver.observe($('component-preview'));
      $('component-search').oninput=e=>{query=e.target.value;$('component-results').innerHTML=rows();draw();};
    }
    $('dialog').addEventListener('close',()=>previewObserver?.disconnect());
    function edit(id){
      const r=records.find(r=>r.id===id);if(!r)return;
      previewObserver?.disconnect();
      StudioTemplateEditor.open({...api,paint,save:put,back:manage},r);
    }
    async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){api.toast('组件库：'+e.message);}finally{busy=false;}}
    document.addEventListener('click',event=>{
      const el=event.target.closest('[data-component-action]');if(!el)return;const action=el.dataset.componentAction,id=el.dataset.templateId;
      if(action==='reload'){load();return;}
      if(!loaded){api.toast(error||'组件库正在读取，请稍后。');return;}
      if(busy)return;
      run(async()=>{
        if(action==='preview'){selectedId=id;draw();}
        else if(action==='insert')doInsert(id);
        else if(action==='save')showSave();
        else if(action==='manage')manage();
        else if(action==='edit')edit(id);
        else if(action==='recycle'){recycle=!recycle;manage();}
        else {const r=C.copy(records.find(r=>r.id===id));if(!r)return;
          if(action==='star')r.favorite=!r.favorite;
          else if(action==='delete')r.deletedAt=Date.now();
          else if(action==='restore')delete r.deletedAt;else return;
          await put(r);manage();
        }
      });
    });
    return {load,markup,decorate,flush:async()=>{try{await pending;return true;}catch{return false;}}};
  }
  const api={capture,insert,defaults,install};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.StudioComponents=api;
})(typeof window!=='undefined'?window:globalThis);
