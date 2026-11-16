/* Project dialogs and irreversible trash clearing; storage remains behind the API. */
(function(global){
  'use strict';
  const paths={search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',import:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',plus:'M12 4v16M4 12h16',folder:'M3 6h7l2 3h9v12H3z',back:'M19 12H5m6-6-6 6 6 6'};
  const icon=name=>`<svg class="manager-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
  function install(api){
    const {$,state,escapeHtml:esc}=api;
    let busy=false;
    async function show(trash=false){
      if(state.finishTextEdit)state.finishTextEdit();
      if(!await api.persistNow())return;
      try{
        const all=await api.allRecords(),records=all.filter(r=>Boolean(r.deletedAt)===trash).sort((a,b)=>b.updatedAt-a.updatedAt);
        const rows=records.map(r=>`<div class="project-item"><div><strong>${esc(r.project.title)}${r.id===state.project.id?' <small>当前项目</small>':''}</strong><small>${r.project.nodes.length} 个组件 · ${new Date(r.updatedAt).toLocaleString()}</small></div><div class="project-actions">${trash?`<button data-restore-project="${esc(r.id)}">恢复</button>`:`<button data-open-project="${esc(r.id)}">打开</button><button class="danger" data-delete-project="${esc(r.id)}">删除</button>`}</div></div>`).join('');
        api.openDialog(trash?'项目回收站':'项目管理',`<label class="manager-search">${icon('search')}<input class="project-search" type="search" aria-label="搜索项目名称" placeholder="搜索项目名称"></label><div class="project-list">${rows||`<p>${trash?'回收站为空':'暂无项目'}</p>`}</div><p class="project-no-results" hidden>没有匹配的项目</p><div class="dialog-actions">${trash?`<button id="empty-project-trash" class="danger" ${records.length?'':'disabled'}>${icon('trash')}清空回收站</button>`:`<button id="library-trash">${icon('trash')}回收站（${all.filter(r=>r.deletedAt).length}）</button><button data-command="import-project">${icon('import')}导入项目</button><button id="library-new">${icon('plus')}新建项目</button>${api.desktop?`<button id="open-data-folder">${icon('folder')}项目文件夹</button>`:''}`}</div>`,trash?()=>show():null);
        $('dialog-content').querySelector('.project-search').oninput=e=>{
          let count=0;$('dialog-content').querySelectorAll('.project-item').forEach(row=>{row.hidden=!row.querySelector('strong').textContent.toLocaleLowerCase().includes(e.target.value.toLocaleLowerCase());if(!row.hidden)count++;});
          $('dialog-content').querySelector('.project-no-results').hidden=Boolean(count)||!records.length;
        };
        if(trash)$('empty-project-trash').onclick=()=>confirmClear(records.map(r=>r.id));
      }catch(error){api.toast('无法读取项目列表：'+error.message);}
    }
    function confirmClear(ids){
      api.openDialog('清空项目回收站',`<p>永久删除回收站中的 ${ids.length} 个项目？此操作无法撤销。</p><p>正常项目、个人组件库和已导出的文件不会删除。</p><div class="dialog-actions"><button id="trash-cancel">返回回收站</button><button id="trash-confirm" class="danger">永久删除 ${ids.length} 个项目</button></div>`,()=>show());
      $('trash-cancel').onclick=()=>show(true);
      $('trash-confirm').onclick=async()=>{
        if(busy)return;busy=true;$('trash-confirm').disabled=true;
        try{const count=await api.purgeTrash(ids);await show(true);api.toast(`已永久删除 ${count} 个项目`);}
        catch(error){await show(true);api.toast('清空未完成：'+error.message);}finally{busy=false;}
      };
    }
    function importPage(){
      api.openDialog('导入项目',`<p>选择项目 JSON 或工作台导出的 HTML。</p><button id="choose-project-file" class="primary">${icon('import')}选择文件</button>`,()=>show());
      $('choose-project-file').onclick=api.chooseImportFile;
    }
    return {show,importPage};
  }
  global.StudioProjectManager={install,icon};
})(globalThis);
