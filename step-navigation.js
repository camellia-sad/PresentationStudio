/* Display numbers follow current order; references always remain stable step IDs. */
(function(global){
  'use strict';
  function number(value){
    const text=String(value).normalize('NFKC').trim(),match=text.match(/^(?:#\s*|第\s*|步骤\s*)?(\d+)\s*(?:步)?$/);
    return match?Number(match[1]):null;
  }
  function label(project,id){const index=project.steps.findIndex(s=>s.id===id);return index<0?'':`${index+1}. ${project.steps[index].name}`;}
  function install(api){
    const {state,$}=api;
    function markup(id,action='选择',focus=true){
      return `<form id="${id}" class="step-number-nav"><label>步骤编号 <input type="text" inputmode="numeric" autocomplete="off" aria-label="步骤编号" placeholder="1–${state.project.steps.length}" value=""></label><button type="submit">${action}</button>${focus?'<button type="submit" data-number-focus="true">聚焦</button>':''}<span class="step-number-status" aria-live="polite">共 ${state.project.steps.length} 步</span></form>`;
    }
    function bind(id,run){
      const form=$(id);if(!form)return;const input=form.querySelector('input'),hint=form.querySelector('.step-number-status');
      input.oninput=()=>{input.removeAttribute('aria-invalid');const n=number(input.value),step=state.project.steps[n-1];hint.textContent=step?label(state.project,step.id):`请输入 1–${state.project.steps.length} 的编号`;};
      form.onsubmit=event=>{
        event.preventDefault();const n=number(input.value),step=state.project.steps[n-1];
        if(!Number.isSafeInteger(n)||!step){input.setAttribute('aria-invalid','true');hint.textContent=`编号无效，请输入 1–${state.project.steps.length}`;input.focus();return;}
        if(state.finishTextEdit)state.finishTextEdit();
        run(step.id,Boolean(event.submitter?.dataset.numberFocus));
      };
      input.onkeydown=event=>{if(event.isComposing&&event.key==='Enter'){event.preventDefault();event.stopPropagation();}};
    }
    function go(id,focus=false){
      const index=state.project.steps.findIndex(s=>s.id===id);if(index<0)return;
      if(state.playing){api.stopAuto();api.showStep(index);api.focusCanvas();return;}
      api.switchLeftTab('steps');api.selectStep(id);api.revealLeftSelection();
      if(focus)api.command('focus-step');api.focusCanvas();
    }
    function open(){
      if(state.finishTextEdit)state.finishTextEdit();
      api.openDialog('跳转步骤',markup('step-number-dialog',state.playing?'前往':'选择',!state.playing)+`<div class="step-jump-list" aria-label="全部步骤">${state.project.steps.map((s,i)=>`<button type="button" data-jump-step="${i+1}" class="step-jump-row"><span>${i+1}</span><strong>${api.escapeHtml(s.name)}</strong></button>`).join('')}</div>`);
      bind('step-number-dialog',(id,focus)=>{$('dialog').close();go(id,focus);});
      const input=$('step-number-dialog').querySelector('input');input.value=String((state.playing?state.playIndex:state.project.steps.findIndex(s=>s.id===state.activeStep))+1);input.oninput();input.focus();input.select();
      const highlight=()=>document.querySelectorAll('[data-jump-step]').forEach(el=>{const active=Number(el.dataset.jumpStep)===number(input.value);el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
      input.addEventListener('input',highlight);highlight();
      document.querySelector('.step-jump-list').onclick=e=>{const row=e.target.closest('[data-jump-step]');if(!row)return;input.value=row.dataset.jumpStep;input.oninput();highlight();$('step-number-dialog').requestSubmit($('step-number-dialog').querySelector('button'));};
    }
    document.addEventListener('keydown',event=>{
      if(state.home||event.isComposing||$('dialog').open)return;
      if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='j'){event.preventDefault();event.stopImmediatePropagation();open();}
    },true);
    const entry=document.createElement('button');entry.id='step-number-open';entry.dataset.editorTool='true';entry.textContent='跳转步骤';entry.title='按编号跳转步骤 · Ctrl+J';entry.onclick=open;$('workflow-tools').append(entry);
    const player=document.createElement('div');player.dataset.editorTool='true';player.innerHTML=markup('player-step-number','前往',false);$('presentation-bar').append(player);bind('player-step-number',go);
    function syncPlayer(){const form=$('player-step-number');if(!form)return;const input=form.querySelector('input');input.value='';input.placeholder=`1–${state.project.steps.length}`;input.removeAttribute('aria-invalid');form.querySelector('.step-number-status').textContent=`共 ${state.project.steps.length} 步`;}
    return {markup,bind,go,open,syncPlayer};
  }
  global.StudioStepNavigation={number,label,install};
  if(typeof module!=='undefined')module.exports={number,label};
})(globalThis);
