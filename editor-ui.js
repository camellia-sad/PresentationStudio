/* Editor-only presentation rules. Theme, accent, previews and the step track never enter project data. */
(function(global){
  'use strict';
  const paths={
    text:'M4 5h16M12 5v15M8 20h8',heading:'M5 4v16M19 4v16M5 12h14',
    shape:'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
    icon:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',
    image:'M4 4h16v16H4ZM4 17l5-6 4 4 3-3 4 5M15 8h.01',
    table:'M3 4h18v16H3ZM3 9h18M3 14h18M9 4v16',
    button:'M13 6H4v14h14v-9M12 12 21 3M15 3h6v6',
    connect:'M4 18h6V6h10m-4-4 4 4-4 4',
    search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM15 15l6 6',
    theme:'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z',
    palette:'M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H17a4 4 0 0 0 4-4c0-4.5-4-8.2-9-8.2ZM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01',
    pan:'M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 4-3 6-7 6-3 0-5-2-6-4l-3-5a2 2 0 0 1 3-2l1 2',
    fit:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8Z',
    focus:'M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
    back:'M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6',
    fullscreen:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
    add:'M4 4h7v7H4ZM13 4h7v7h-7ZM4 13h7v7H4ZM16.5 13.5v6M13.5 16.5h6',
    layers:'M12 4 3 9l9 5 9-5ZM3 14l9 5 9-5',
    steps:'M5 6h14M5 12h10M5 18h6',
    help:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01',
    group:'M4 4h11v11H4ZM9 9h11v11H9Z',
    canvas:'M4 5h16v12H4ZM9 21h6M12 17v4',
    play:'M7 5v14l11-7Z',
    eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    plus:'M12 5v14M5 12h14',
    upload:'M12 15V4M7 9l5-5 5 5M5 15v5h14v-5',
    download:'M12 4v11M7 10l5 5 5-5M5 15v5h14v-5',
    select:'M5 3l6 16 2-7 7-2Z',lock:'M6 11h12v9H6ZM8.5 11V8a3.5 3.5 0 0 1 7 0v3',unlock:'M6 11h12v9H6ZM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2'
  };
  const icon=key=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[key]||paths.shape}"/></svg>`;
  const ACCENTS=[['墨蓝','#1f4e79'],['松绿','#1d5e54'],['酒红','#7a2e3e'],['石墨','#2b333d'],['铜棕','#7c5428'],['海青','#146a7c']];
  const DEFAULT_ACCENT=ACCENTS[0][1];
  function luminance(hex){
    const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);
    return .2126*v[0]+.7152*v[1]+.0722*v[2];
  }
  const mixWhite=(hex,amount)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*amount+255*(1-amount)).toString(16).padStart(2,'0')).join('');
  const validHex=value=>/^#[0-9a-f]{6}$/i.test(value||'');
  // Text on an accent fill: whichever of white or near-black has the higher contrast ratio.
  const onColor=hex=>{const l=luminance(hex);return (l+.05)/(.0065+.05)>1.05/(l+.05)?'#10141a':'#ffffff';};
  function install(api){
    const {C,state,$,escapeHtml:esc}=api;
    const themeKey='studio-editor-theme-v1',accentKey='studio-editor-accent-v1';
    let theme='light';try{theme=localStorage.getItem(themeKey)==='dark'?'dark':'light';}catch{}
    let accent=DEFAULT_ACCENT;try{const saved=localStorage.getItem(accentKey);if(validHex(saved))accent=saved.toLowerCase();}catch{}
    const actions=$('topbar').querySelector('.top-actions');
    const toggle=document.createElement('button');toggle.id='editor-theme';toggle.dataset.editorTool='true';
    const accentButton=document.createElement('button');accentButton.id='editor-accent';accentButton.dataset.editorTool='true';
    accentButton.innerHTML=icon('palette');accentButton.setAttribute('aria-label','界面强调色');accentButton.title='界面强调色';accentButton.setAttribute('aria-expanded','false');
    actions.insertBefore(accentButton,$('export'));actions.insertBefore(toggle,$('export'));
    function applyTheme(){document.body.dataset.editorTheme=theme;toggle.innerHTML=icon('theme');toggle.setAttribute('aria-label',theme==='light'?'切换深色界面':'切换浅色界面');toggle.title=toggle.getAttribute('aria-label');toggle.setAttribute('aria-pressed',String(theme==='dark'));}
    function setTheme(next){theme=next==='dark'?'dark':'light';applyTheme();try{localStorage.setItem(themeKey,theme);}catch{}renderAccentPopover();}
    applyTheme();toggle.onclick=()=>setTheme(theme==='light'?'dark':'light');
    function applyAccent(){
      const body=document.body.style;
      body.setProperty('--ui-accent-base',accent);
      body.setProperty('--ui-on-accent-light',onColor(accent));
      body.setProperty('--ui-on-accent-dark',onColor(mixWhite(accent,.52)));
    }
    function setAccent(value,persist=true){if(!validHex(value))return;accent=value.toLowerCase();applyAccent();if(persist){try{accent===DEFAULT_ACCENT?localStorage.removeItem(accentKey):localStorage.setItem(accentKey,accent);}catch{}}}
    applyAccent();

    // Accent popover is shared by the editor top bar and the home header.
    const popover=document.createElement('div');popover.id='accent-popover';popover.className='editor-chrome';popover.dataset.editorTool='true';popover.hidden=true;popover.setAttribute('role','dialog');popover.setAttribute('aria-label','界面外观');
    document.body.append(popover);let popoverAnchor=null;
    function renderAccentPopover(){
      if(popover.hidden)return;
      const preset=ACCENTS.find(([,hex])=>hex===accent);
      popover.innerHTML=`<div><h3>界面主题</h3></div><div class="accent-theme" role="group" aria-label="界面主题"><button data-ui-theme="light" aria-pressed="${theme==='light'}">浅色</button><button data-ui-theme="dark" aria-pressed="${theme==='dark'}">深色</button></div><h3>强调色</h3><div class="accent-swatches">${ACCENTS.map(([name,hex])=>`<button data-accent-preset="${hex}" title="${name}" aria-label="${name}" aria-pressed="${hex===accent}" style="background:${hex}"></button>`).join('')}<label class="${preset?'':'active'}" title="自选颜色"><input id="accent-custom" type="color" value="${accent}" aria-label="自选强调色"></label></div><div class="accent-current"><i></i><span>${preset?preset[0]:'自选'}</span><code>${accent.toUpperCase()}</code></div>${accent===DEFAULT_ACCENT?'':'<button id="accent-reset">恢复默认墨蓝</button>'}`;
    }
    function placePopover(){
      if(popover.hidden||!popoverAnchor)return;
      const r=popoverAnchor.getBoundingClientRect(),w=popover.offsetWidth||276;
      popover.style.top=Math.round(r.bottom+8)+'px';popover.style.left=Math.round(Math.max(8,Math.min(innerWidth-w-8,r.right-w)))+'px';
    }
    function toggleAccent(anchor){
      const open=popover.hidden||popoverAnchor!==anchor;
      document.querySelectorAll('[data-accent-anchor],#editor-accent').forEach(b=>b.setAttribute('aria-expanded','false'));
      popover.hidden=!open;popoverAnchor=open?anchor:null;
      if(open){anchor.setAttribute('aria-expanded','true');renderAccentPopover();placePopover();}
    }
    accentButton.onclick=event=>{event.stopPropagation();toggleAccent(accentButton);};
    popover.addEventListener('click',event=>{
      event.stopPropagation();const b=event.target.closest('button');if(!b)return;
      if(b.dataset.uiTheme)setTheme(b.dataset.uiTheme);
      else if(b.dataset.accentPreset){setAccent(b.dataset.accentPreset);renderAccentPopover();}
      else if(b.id==='accent-reset'){setAccent(DEFAULT_ACCENT);renderAccentPopover();}
    });
    popover.addEventListener('input',event=>{if(event.target.id==='accent-custom'){setAccent(event.target.value,false);const code=popover.querySelector('.accent-current code');if(code)code.textContent=accent.toUpperCase();}});
    popover.addEventListener('change',event=>{if(event.target.id==='accent-custom'){setAccent(event.target.value);renderAccentPopover();}});
    // While open, Escape closes the popover first, wherever focus is.
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popover.hidden&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();const a=popoverAnchor;toggleAccent(a);a?.focus();}},true);
    document.addEventListener('pointerdown',event=>{if(!popover.hidden&&!popover.contains(event.target)&&event.target!==popoverAnchor&&!popoverAnchor?.contains(event.target)){toggleAccent(popoverAnchor);}},true);
    window.addEventListener('resize',placePopover);

    function iconButton(id,key,label,compact=false){const el=$(id);if(!el)return;el.innerHTML=icon(key)+`<span>${label}</span>`;el.setAttribute('aria-label',label);el.title=el.title||label;if(compact)el.classList.add('icon-only');}
    for(const id of ['undo','redo']){$(id).classList.add('icon-only');$(id).setAttribute('aria-label',id==='undo'?'撤销':'重做');}
    iconButton('quick-search','search','搜索');$('quick-search')?.classList.remove('icon-only');
    iconButton('editor-fullscreen','fullscreen','全屏编辑',true);
    iconButton('pan-tool','pan','平移');iconButton('fit','fit','适应画布');iconButton('fit-selection','focus','聚焦选中');iconButton('previous-view','back','上一视野',true);
    $('select-all').title='全选组件 · Ctrl+Shift+A';
    $('fit').title='缩放视野以查看整张画布，不改变画布尺寸';
    $('zoom-label').title='恢复实际大小 · 100%';
    $('statusbar').lastElementChild.textContent='';
    // Left rail: icon above a short label; tab ids and data-tab stay unchanged.
    const railLabels={add:['add','组件'],layers:['layers','图层'],steps:['steps','步骤']};
    document.querySelectorAll('#left-rail [data-tab]').forEach(el=>{const [key,label]=railLabels[el.dataset.tab];el.innerHTML=icon(key)+`<span>${label}</span>`;});
    $('help').innerHTML=icon('help')+'<span>帮助</span>';$('help').setAttribute('aria-label','快捷键与使用说明');

    const kinds={text:'文字',image:'图片',shape:'形状',icon:'图标',button:'交互按钮',table:'表格'};
    // Inspector identity band and the design / presentation split.
    const titleBar=document.querySelector('.inspector-title');
    let tile=titleBar.querySelector('.inspector-tile');
    if(!tile){tile=document.createElement('span');tile.className='inspector-tile';tile.dataset.editorTool='true';tile.setAttribute('aria-hidden','true');titleBar.prepend(tile);}
    let tabs=$('inspector-tabs');
    if(!tabs){tabs=document.createElement('div');tabs.id='inspector-tabs';tabs.dataset.editorTool='true';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','属性分类');tabs.innerHTML='<button role="tab" data-inspector-tab="design" aria-selected="true">设计</button><button role="tab" data-inspector-tab="show" aria-selected="false">演示</button>';titleBar.after(tabs);}
    let inspectorTab='design';
    const SHOW_SECTIONS=new Set(['出现与退场','动效','点击交互（演示时）']);
    function applyInspectorTabs(){
      const root=$('properties'),objectMode=Boolean(api.selectedNodes().length||api.selectedEdge());
      const items=[...root.children].map(el=>({el,tab:el.classList.contains('selection-step-button')||SHOW_SECTIONS.has(el.dataset.propertySection)?'show':'design'}));
      const split=objectMode&&items.some(i=>i.tab==='show')&&items.some(i=>i.tab==='design');
      tabs.hidden=!split;
      for(const {el,tab} of items)el.hidden=split&&tab!==inspectorTab;
      tabs.querySelectorAll('[data-inspector-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.inspectorTab===inspectorTab)));
    }
    tabs.addEventListener('click',event=>{const b=event.target.closest('[data-inspector-tab]');if(!b)return;inspectorTab=b.dataset.inspectorTab;applyInspectorTabs();$('properties').scrollTop=0;});
    function decorateInspector(){
      const nodes=api.selectedNodes(),group=api.selectedGroup(),edge=api.selectedEdge();
      const label=edge?'连线':nodes.length>1?(group?'复合组件':`多选 · ${nodes.length} 个对象`):nodes.length?(kinds[nodes[0].type]||'组件'):state.inspectorMode==='step'?'演示编排':'画布';
      $('selection-kind').textContent=label;
      tile.innerHTML=icon(edge?'connect':group||nodes.length>1?'group':nodes.length?nodes[0].type:state.inspectorMode==='step'?'steps':'canvas');
      if(group)$('inspector-heading').textContent=group.name;
      $('inspector-heading').title=$('inspector-heading').textContent;
      if(group){
        $('properties').insertAdjacentHTML('afterbegin',StudioSidebarLayout.section('组合内容','<div class="composite-contents">'+nodes.map(n=>`<button data-property-select="${esc(n.id)}">${icon(n.type)}<span>${esc(n.name)}</span><span aria-hidden="true">›</span></button>`).join('')+'</div>'));
      }
      for(const input of $('properties').querySelectorAll('[data-scope="node"][data-prop]')){
        const path=input.dataset.prop.split('.'),values=nodes.map(n=>path.reduce((v,k)=>v?.[k],n));
        if(nodes.length>1&&values.some(v=>v!==values[0])){
          input.title='混合值；修改后应用到全部选中对象';
          if(input.tagName==='SELECT'){const mixed=new Option('混合值','',true,true);mixed.disabled=true;input.prepend(mixed);}
          else if(input.type==='checkbox')input.indeterminate=true;
          else if(input.type==='color')input.closest('.field')?.querySelector('span')?.insertAdjacentHTML('beforeend','<small class="mixed-value"> · 混合值</small>');
          else {input.value='';input.placeholder='混合值';}
        }
      }
      applyInspectorTabs();renderTrack();
    }

    // Real step previews: automatic cameras show the step's new objects; recorded cameras keep their framing.
    function paintStep(thumb,i){
      const step=state.project.steps[i];if(!step||!thumb.clientWidth)return;
      const nodes=state.project.nodes.filter(n=>C.visibleAt(n,state.project.steps,i));
      const ids=new Set(nodes.map(n=>n.id));
      const edges=state.project.edges.filter(e=>C.visibleAt(e,state.project.steps,i)&&C.edgeNodeIds(e).every(id=>ids.has(id)));
      const project={...state.project,nodes,edges};
      let view=null;
      if(step.camera){const z=Math.min(thumb.clientWidth/$('viewport').clientWidth,thumb.clientHeight/$('viewport').clientHeight);const zoom=step.camera.zoom*z;view={x:thumb.clientWidth/2-step.camera.cx*zoom,y:thumb.clientHeight/2-step.camera.cy*zoom,zoom};}
      else {const fresh=nodes.filter(n=>n.stepId===step.id);if(fresh.length){const b=C.visualBounds(fresh),z=Math.min((thumb.clientWidth-20)/Math.max(b.w,1),(thumb.clientHeight-20)/Math.max(b.h,1));view={x:thumb.clientWidth/2-(b.x+b.w/2)*z,y:thumb.clientHeight/2-(b.y+b.h/2)*z,zoom:z};}}
      thumb.style.background=state.project.canvas.background;
      if(nodes.length||edges.length)StudioPreview.paint(api,thumb,project,view);else thumb.replaceChildren();
    }
    let previewObserver=null;
    function decorateLeft(){
      document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.tab===state.tab)));
      $('left-content').querySelectorAll('.palette [data-add]').forEach(el=>{const key=el.dataset.add;const old=el.querySelector('span');if(old)old.outerHTML=icon(key);});
      renderTrack();
      previewObserver?.disconnect();if(state.tab!=='steps')return;
      const draw=()=>{
        $('left-content').querySelectorAll('[data-select-step]').forEach(el=>{
          const i=state.project.steps.findIndex(s=>s.id===el.dataset.selectStep),step=state.project.steps[i];if(!step)return;
          let thumb=el.querySelector('.step-thumbnail');
          if(!thumb){thumb=document.createElement('div');thumb.className='step-thumbnail';thumb.setAttribute('aria-hidden','true');el.prepend(thumb);el.querySelector('strong').innerHTML=`<span class="step-number">${String(i+1).padStart(2,'0')}</span><span class="step-title">${esc(step.name)}</span><span class="step-grip" aria-hidden="true">⠿</span>`;}
          paintStep(thumb,i);
          el.setAttribute('aria-current',String(step.id===state.activeStep));
        });
      };draw();previewObserver=new ResizeObserver(draw);previewObserver.observe($('left-content'));
    }

    // Step track under the canvas: single click selects, double click focuses, hover previews.
    const track=$('step-track'),trackList=track.querySelector('.track-steps');
    track.querySelector('.track-present').innerHTML=icon('play')+'<span>从本步演示</span>';
    let trackSignature='';
    function renderTrack(){
      if(!state.project)return;
      const steps=state.project.steps,signature=JSON.stringify(steps.map(s=>[s.id,s.name]));
      if(signature!==trackSignature){
        trackSignature=signature;
        trackList.innerHTML=steps.map((s,i)=>`<button class="track-step" role="listitem" data-track-step="${esc(s.id)}" title="${esc(s.name)} · 单击选择，双击聚焦"><span class="track-number">${i+1}</span><span class="track-name">${esc(s.name)}</span></button>`).join('');
      }
      const active=steps.findIndex(s=>s.id===state.activeStep),preview=state.editorView?.previewStep;
      let current=null;
      trackList.querySelectorAll('[data-track-step]').forEach((el,i)=>{
        el.classList.toggle('current',i===active);el.classList.toggle('done',i<active);el.classList.toggle('simulated',el.dataset.trackStep===preview);
        el.setAttribute('aria-current',String(i===active));if(i===active)current=el;
      });
      if(current&&current.dataset.trackStep!==track.dataset.revealed){track.dataset.revealed=current.dataset.trackStep;const l=current.offsetLeft,r=l+current.offsetWidth;if(l<trackList.scrollLeft||r>trackList.scrollLeft+trackList.clientWidth)trackList.scrollLeft=l-trackList.clientWidth/2+current.offsetWidth/2;}
    }
    trackList.addEventListener('click',event=>{const b=event.target.closest('[data-track-step]');if(!b||state.playing)return;hideTrackPopover();api.selectStep(b.dataset.trackStep);});
    trackList.addEventListener('dblclick',event=>{const b=event.target.closest('[data-track-step]');if(!b||state.playing)return;api.selectStep(b.dataset.trackStep);api.focusStep(b.dataset.trackStep);});
    trackList.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){trackList.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});
    const trackPopover=document.createElement('div');trackPopover.id='step-track-popover';trackPopover.className='editor-chrome';trackPopover.dataset.editorTool='true';trackPopover.hidden=true;document.body.append(trackPopover);
    let hoverTimer=0,leaveTimer=0;
    function hideTrackPopover(){clearTimeout(hoverTimer);clearTimeout(leaveTimer);trackPopover.hidden=true;}
    function showTrackPopover(button){
      const i=state.project.steps.findIndex(s=>s.id===button.dataset.trackStep),step=state.project.steps[i];if(!step||state.playing)return;
      trackPopover.innerHTML=`<header><span>${i+1}</span><strong>${esc(step.name)}</strong></header><div class="track-preview" aria-hidden="true"></div><div class="track-actions"><button data-preview-step="${esc(step.id)}" aria-pressed="${state.editorView?.previewStep===step.id}" title="编辑画布只显示到这一步，不影响正式演示">模拟本步</button><button data-step-focus="${esc(step.id)}">聚焦</button><button data-step-play="${esc(step.id)}" class="primary">播放</button></div>`;
      trackPopover.hidden=false;
      const r=button.getBoundingClientRect(),w=trackPopover.offsetWidth,h=trackPopover.offsetHeight;
      trackPopover.style.left=Math.round(Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2)))+'px';
      trackPopover.style.top=Math.round(track.getBoundingClientRect().top-h-8)+'px';
      paintStep(trackPopover.querySelector('.track-preview'),i);
    }
    trackList.addEventListener('pointerover',event=>{const b=event.target.closest('[data-track-step]');if(!b||event.pointerType==='touch')return;clearTimeout(leaveTimer);clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showTrackPopover(b),trackPopover.hidden?380:60);});
    const scheduleHide=()=>{clearTimeout(hoverTimer);leaveTimer=setTimeout(()=>{trackPopover.hidden=true;},180);};
    trackList.addEventListener('pointerleave',scheduleHide);
    trackPopover.addEventListener('pointerenter',()=>clearTimeout(leaveTimer));trackPopover.addEventListener('pointerleave',scheduleHide);
    trackPopover.addEventListener('click',event=>{if(event.target.closest('button'))setTimeout(hideTrackPopover);});
    trackList.addEventListener('scroll',hideTrackPopover,{passive:true});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!trackPopover.hidden)hideTrackPopover();},true);

    // Home cards: the first step of each project, rendered without touching the open project.
    function paintCover(container,project){
      if(!container||!project)return;
      container.style.background=project.canvas?.background||'#fff';
      const nodes=project.nodes.filter(n=>C.visibleAt(n,project.steps,0)),shown=nodes.length?nodes:project.nodes;
      if(!shown.length){container.replaceChildren();return;}
      const ids=new Set(shown.map(n=>n.id));
      const edges=project.edges.filter(e=>C.edgeNodeIds(e).every(id=>ids.has(id))&&(!nodes.length||C.visibleAt(e,project.steps,0)));
      StudioPreview.paint(api,container,{...project,nodes:shown,edges});
    }
    return {decorateInspector,decorateLeft,renderTrack,paintCover,toggleAccent,icon};
  }
  global.StudioEditorUI={install,icon};
})(window);
