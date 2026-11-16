/* Desktop home: no implicit project creation, no tutorial or sample import. */
(function(global){
  'use strict';
  function install(api){
    const {state,$,escapeHtml:esc}=api;
    const icon=key=>api.icon?api.icon(key):'';
    const screen=document.createElement('main');screen.id='welcome-screen';screen.dataset.editorTool='true';screen.hidden=true;
    screen.innerHTML='<header class="welcome-header"><div class="welcome-brand"><svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4zM8.5 16v-3M12 16v-6M15.5 16V7.5"/></svg><strong>汇报工作台</strong></div><div class="welcome-header-actions"><button id="welcome-appearance" data-accent-anchor aria-expanded="false" aria-label="界面外观" title="界面外观">'+icon('palette')+'</button><button id="welcome-help">帮助</button></div></header>'
      +'<div class="welcome-content"><h1>开始一份汇报</h1><section class="welcome-start" aria-label="开始"><button id="welcome-new" class="welcome-primary"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>新建汇报</span></button><button id="welcome-import"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 15v5h14v-5"/></svg><span>导入项目</span></button></section>'
      +'<section class="welcome-projects"><header><h2>最近项目</h2><button id="welcome-library">全部项目</button></header><div id="welcome-recent" aria-live="polite"></div></section></div>';
    document.body.append(screen);
    const home=document.querySelector('#topbar .brand');home.title='返回主页';
    home.onclick=()=>open();$('welcome-new').onclick=api.showNewProject;$('welcome-import').onclick=api.requestImport;$('welcome-help').onclick=api.showHelp;$('welcome-library').onclick=()=>api.showLibrary();
    $('welcome-appearance').onclick=event=>{event.stopPropagation();api.toggleAppearance?.($('welcome-appearance'));};
    $('dialog').addEventListener('close',()=>{if(state.home)refresh();});
    let opening=false;
    async function refresh(){
      const list=$('welcome-recent');list.textContent='正在读取…';
      try{
        const records=(await api.allRecords()).filter(r=>!r.deletedAt).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,8);
        list.innerHTML=records.length?records.map(r=>`<button class="welcome-project" data-welcome-project="${esc(r.id)}" title="${esc(r.project.title)}"><span class="welcome-thumb" data-welcome-thumb="${esc(r.id)}" aria-hidden="true"></span><span class="welcome-project-name">${esc(r.project.title)}</span><span class="welcome-project-meta">${r.project.steps.length} 步骤<span>·</span>${new Date(r.updatedAt).toLocaleDateString()}</span></button>`).join(''):'<div class="welcome-empty"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 5h17l8 8v30H12ZM29 5v9h8M18 23h13M18 30h13"/></svg><p>暂无项目</p></div>';
        // Covers render after layout so each preview knows its size; a broken project only loses its cover.
        requestAnimationFrame(()=>{for(const r of records){const el=list.querySelector(`[data-welcome-thumb="${CSS.escape(r.id)}"]`);try{api.paintCover?.(el,r.project);}catch{el?.replaceChildren();}}});
      }catch(error){list.innerHTML='<p class="welcome-error">项目列表读取失败</p><button id="welcome-retry">重试</button>';$('welcome-retry').onclick=refresh;}
    }
    screen.addEventListener('click',async event=>{
      const button=event.target.closest('[data-welcome-project]');if(!button||opening)return;opening=true;button.disabled=true;
      try{const record=await api.readRecord(button.dataset.welcomeProject);if(!record||record.deletedAt){await refresh();return;}await api.loadProject(record.project,record.view,record);}
      catch(error){api.toast('无法打开：'+error.message);}finally{opening=false;button.disabled=false;}
    });
    async function open(){
      if(state.finishTextEdit)state.finishTextEdit();
      if(!await api.persistNow())return;
      api.stopAuto();state.home=true;document.body.classList.add('home-open');screen.hidden=false;$('dialog').close();
      await refresh();$('welcome-new').focus();
    }
    function hide(){state.home=false;document.body.classList.remove('home-open');screen.hidden=true;}
    return {open,hide,refresh};
  }
  global.StudioWelcome={install};
})(globalThis);
