/* Local editing visibility is view state, never presentation content. */
(function(global){
  'use strict';
  const C=typeof module==='object'&&module.exports?require('./core.js'):global.StudioCore;
  function normalize(project,value={}) {
    const ids=new Set([...project.nodes,...project.edges].map(n=>n.id));
    const list=key=>[...new Set(Array.isArray(value?.[key])?value[key].filter(id=>ids.has(id)):[])];
    return {hidden:list('hidden'),shown:list('shown'),previewStep:project.steps.some(s=>s.id===value?.previewStep)?value.previewStep:null};
  }
  function visible(project,item,view) {
    if(!item)return false;
    if(view.hidden.includes(item.id))return false;
    if(!view.shown.includes(item.id)&&view.previewStep&&!C.visibleAt(item,project.steps,project.steps.findIndex(s=>s.id===view.previewStep)))return false;
    if(C.edgeNodeIds(item).length)return C.edgeNodeIds(item).every(id=>visible(project,project.nodes.find(n=>n.id===id),view));
    return true;
  }
  function install(api) {
    const {state,$,escapeHtml:esc}=api;
    let collapsedSteps=new Set();
    const snapshot=()=>normalize(state.project,state.editorView);
    const restore=value=>{state.editorView=normalize(state.project,value);};
    const item=id=>state.project.nodes.find(n=>n.id===id)||state.project.edges.find(e=>e.id===id);
    const isVisible=n=>visible(state.project,n,state.editorView);
    const stepItems=id=>[...state.project.nodes,...state.project.edges].filter(n=>n.stepId===id);
    const groupIds=(id,scope)=>state.project.groups.find(g=>g.id===id)?.nodeIds.filter(id=>!scope||item(id)?.stepId===scope)||[];
    const selectedIds=()=>[...state.selected,...(state.edgeId?[state.edgeId]:[])];
    function apply(operation) {
      if(state.playing)return;
      if(state.finishTextEdit)state.finishTextEdit();
      const before=snapshot();restore(before);operation(state.editorView);
      const after=snapshot();restore(after);
      if(JSON.stringify(before)!==JSON.stringify(after))api.recordEditorChange(before);
      api.renderCanvas();api.renderLeft();api.renderInspector();
    }
    function setHidden(ids,hide) {
      ids=ids.filter(id=>item(id));if(!ids.length)return;
      // A connector cannot be shown without its two endpoints.
      if(!hide)ids=[...new Set(ids.flatMap(id=>{const n=item(id);return [id,...C.edgeNodeIds(n)];}))];
      apply(view=>{
        const hidden=new Set(view.hidden),shown=new Set(view.shown);
        for(const id of ids){hidden.delete(id);shown.delete(id);if(hide)hidden.add(id);else if(view.previewStep)shown.add(id);}
        view.hidden=[...hidden];view.shown=[...shown];
      });
    }
    function toggle(ids){setHidden(ids,ids.some(id=>isVisible(item(id))));}
    function action(name) {
      const ids=selectedIds();
      if(name==='hide')setHidden(ids,true);
      if(name==='show')setHidden(ids,false);
      if(name==='all')apply(view=>Object.assign(view,{hidden:[],shown:[],previewStep:null}));
      if(name==='only'&&ids.length){
        const keep=new Set(ids);
        for(const id of ids){const n=item(id);if(n?.from&&n?.to){keep.add(n.from);keep.add(n.to);}}
        for(const e of state.project.edges)if(keep.has(e.from)&&keep.has(e.to))keep.add(e.id);
        apply(view=>Object.assign(view,{hidden:[...state.project.nodes,...state.project.edges].filter(n=>!keep.has(n.id)).map(n=>n.id),shown:[],previewStep:null}));
      }
    }
    function preview(id){apply(view=>Object.assign(view,{hidden:[],shown:[],previewStep:view.previewStep===id?null:id}));}
    const icon=hidden=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${hidden?'<path d="m3 3 18 18M10 5c5-1 10 7 10 7s-1 2-3 4M6 6c-3 2-4 6-4 6s4 7 10 7l3-1"/>':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'}</svg>`;
    function eye(ids,attribute,label) {
      const count=ids.filter(id=>isVisible(item(id))).length,partial=count>0&&count<ids.length;
      const hint=`${count?'在编辑画布隐藏':'在编辑画布显示'}${label}${partial?'（部分可见）':''}，不改变正式演示`;
      return `<button ${attribute} ${ids.length?'':'disabled'} class="layer-eye ${partial?'partial':''}" title="${esc(hint)}" aria-label="${esc(hint)}" aria-pressed="${count===0}">${icon(count===0)}${partial?'<i></i>':''}</button>`;
    }
    const check=ids=>state.layerMulti?`<input type="checkbox" data-layer-check aria-label="选择组件" ${ids.every(id=>state.selected.has(id))?'checked':''} data-partial="${ids.some(id=>state.selected.has(id))&&!ids.every(id=>state.selected.has(id))}">`:'';
    const ui=key=>global.StudioEditorUI?global.StudioEditorUI.icon(key):'';
    function row(n) {
      return `<div class="layer ${state.selected.has(n.id)?'active':''} ${isVisible(n)?'':'editor-invisible'}" data-layer="${esc(n.id)}" tabindex="0">${check([n.id])}<span class="kind" title="${esc(n.type)}">${ui(n.type)}</span><span class="layer-name">${esc(n.name)}</span>${n.hidden?'<span class="layer-permanent" title="正式演示中始终隐藏；可在右侧取消">演示隐藏</span>':''}<button data-lock="${esc(n.id)}" class="${n.locked?'on':''}" title="${n.locked?'解锁位置与尺寸':'锁定位置与尺寸'}" aria-label="${n.locked?'解锁位置与尺寸':'锁定位置与尺寸'}" aria-pressed="${Boolean(n.locked)}">${ui(n.locked?'lock':'unlock')}</button>${eye([n.id],`data-editor-eye="${esc(n.id)}"`,n.name)}</div>`;
    }
    // Bulk visibility actions appear only when something is selected or hidden.
    function actionsMarkup() {
      const view=snapshot(),selected=selectedIds().length,hidden=[...state.project.nodes,...state.project.edges].filter(n=>!visible(state.project,n,view)).length;
      const restore=hidden||view.previewStep||view.shown.length;
      if(!selected&&!restore)return '';
      return `<span class="layer-action-summary">${selected?`已选 ${selected} 项`:view.previewStep?'正在模拟步骤画面':`${hidden} 项在编辑时隐藏`}</span>`+(selected?'<button data-editor-action="hide">隐藏所选</button><button data-editor-action="show">显示所选</button><button data-editor-action="only">仅看所选</button>':'')+(restore?'<button data-editor-action="all">恢复全部</button>':'');
    }
    function syncActions() {
      const bar=$('left-content').querySelector('.layer-visibility-actions');if(!bar)return;
      const html=actionsMarkup();bar.innerHTML=html;bar.hidden=!html;
    }
    function markup() {
      const grouped=new Set(state.project.groups.flatMap(g=>g.nodeIds));
      return state.project.steps.map((step,index)=>{
        const nodes=state.project.nodes.filter(n=>n.stepId===step.id),edges=state.project.edges.filter(e=>e.stepId===step.id),ids=[...nodes,...edges].map(n=>n.id);
        const groups=state.project.groups.map(g=>{
          const members=groupIds(g.id,step.id);if(!members.length)return '';
          return `<div class="layer group-row ${members.every(id=>state.selected.has(id))?'active':''}" data-group="${esc(g.id)}" data-group-scope="${esc(step.id)}" tabindex="0">${check(members)}<span class="kind">${ui('group')}</span><span class="layer-name">${esc(g.name)}</span>${eye(members,`data-editor-eye-group="${esc(g.id)}" data-eye-scope="${esc(step.id)}"`,g.name)}</div><div class="group-children">${members.map(item).map(row).join('')}</div>`;
        }).join('');
        const lines=edges.map(e=>`<div class="layer ${state.edgeId===e.id?'active':''} ${isVisible(e)?'':'editor-invisible'}" data-select-edge="${esc(e.id)}" tabindex="0"><span class="kind">${ui('connect')}</span><span class="layer-name">${esc(e.label||(C.isFreeEdge(e)?'自由线条':item(e.from)?.name+' → '+item(e.to)?.name))}</span>${eye([e.id],`data-editor-eye="${esc(e.id)}"`,'连线')}</div>`).join('');
        return `<section class="layer-step" data-layer-step="${esc(step.id)}"><div class="layer-step-heading"><button data-layer-fold-step="${esc(step.id)}" aria-expanded="${!collapsedSteps.has(step.id)}" title="${nodes.length} 组件 · ${edges.length} 线"><span class="step-fold">▾</span><span class="layer-step-name">${index+1}. ${esc(step.name)}</span><span class="layer-step-count">${ids.length}</span></button><button class="layer-step-tool" data-preview-step="${esc(step.id)}" aria-pressed="${state.editorView.previewStep===step.id}" title="模拟本步画面：编辑画布只显示到这一步，不影响正式演示" aria-label="模拟本步画面">${ui('canvas')}</button><button class="layer-step-tool" data-layer-select-step="${esc(step.id)}" title="选中本步组件" aria-label="选中本步组件">${ui('select')}</button>${eye(ids,`data-editor-eye-step="${esc(step.id)}"`,step.name)}</div><div class="layer-step-children">${nodes.filter(n=>!grouped.has(n.id)).map(row).join('')}${groups}${lines||''}${ids.length?'':'<p class="hint">此步没有新出现的对象</p>'}</div></section>`;
      }).join('')+(()=>{const html=actionsMarkup();return `<div class="layer-visibility-actions" ${html?'':'hidden'}>${html}</div>`;})();
    }
    function decorate(query='',type='') {
      for(const section of $('left-content').querySelectorAll('[data-layer-step]')){
        const filtered=Boolean(query.trim()||type),children=section.querySelector('.layer-step-children');
        const n=StudioStepNavigation.number(query),emptyMatch=n!==null&&state.project.steps[n-1]?.id===section.dataset.layerStep&&!type;
        section.hidden=filtered&&!emptyMatch&&![...children.querySelectorAll('[data-layer],[data-select-edge]')].some(row=>!row.hidden);
        children.hidden=section.hidden||(!filtered&&collapsedSteps.has(section.dataset.layerStep));
        const fold=section.querySelector('[data-layer-fold-step]');fold.setAttribute('aria-expanded',String(!children.hidden));fold.querySelector('.step-fold').textContent=children.hidden?'▸':'▾';
      }
      updateNotice();syncActions();
    }
    const notice=document.createElement('div');notice.id='editor-visibility-notice';notice.dataset.editorTool='true';$('viewport').append(notice);
    function updateNotice() {
      const view=snapshot(),count=[...state.project.nodes,...state.project.edges].filter(n=>!visible(state.project,n,view)).length;
      notice.hidden=state.playing||(!count&&!view.previewStep&&!view.shown.length);
      const step=state.project.steps.find(s=>s.id===view.previewStep);
      notice.innerHTML=`<span>编辑预览${step?' · '+esc(StudioStepNavigation.label(state.project,step.id)):''} · 隐藏 ${count} 项</span><button data-editor-action="all">恢复全部</button>`;
    }
    function reveal(id) {
      const n=item(id);if(!n)return;
      collapsedSteps.delete(n.stepId);
      const section=[...$('left-content').querySelectorAll('[data-layer-step]')].find(el=>el.dataset.layerStep===n.stepId);
      if(section){section.querySelector('.layer-step-children').hidden=false;const b=section.querySelector('[data-layer-fold-step]');b.setAttribute('aria-expanded','true');b.querySelector('.step-fold').textContent='▾';}
    }
    document.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b||state.playing)return;
      const d=b.dataset;let handled=true;
      if(d.editorEye)toggle([d.editorEye]);
      else if(d.editorEyeStep)toggle(stepItems(d.editorEyeStep).map(n=>n.id));
      else if(d.editorEyeGroup)toggle(groupIds(d.editorEyeGroup,d.eyeScope));
      else if(d.editorAction)action(d.editorAction);
      else if(d.previewStep)preview(d.previewStep);
      else if(d.layerSelectStep)api.selectLayerUnit(state.project.nodes.filter(n=>n.stepId===d.layerSelectStep).map(n=>n.id),event);
      else if(d.layerFoldStep){collapsedSteps.has(d.layerFoldStep)?collapsedSteps.delete(d.layerFoldStep):collapsedSteps.add(d.layerFoldStep);api.decorateLeft();api.scheduleSave();}
      else if(d.layerFoldAll){collapsedSteps=d.layerFoldAll==='close'?new Set(state.project.steps.map(s=>s.id)):new Set();api.decorateLeft();}
      else handled=false;
      if(handled){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    function reset(value){restore(value);collapsedSteps=new Set();}
    reset();
    return {snapshot,restore,reset,isVisible,markup,decorate,reveal,groupIds,action,setHidden,preview,updateNotice,syncActions};
  }
  const exports={normalize,visible,install};
  if(typeof module==='object'&&module.exports)module.exports=exports;else global.StudioLayers=exports;
})(globalThis);
