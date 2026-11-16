/* Editor-only navigation and workflow tools. Project operations stay in StudioCore. */
(function(global){
  'use strict';
  function install(api) {
    const {C,state,$,escapeHtml:esc}=api;
    StudioSidebarLayout.install();
    const effectNames={none:'无动效',fade:'淡入',rise:'向上抬升',scale:'放大出现',pulse:'点亮',draw:'描线', 'slide-left':'从左滑入','slide-right':'从右滑入',drop:'从上落入','zoom-out':'缩小落定'};
    const typeNames={text:'文字',shape:'形状',image:'图片',icon:'图标',table:'表格',button:'按钮'};
    const guides=document.createElement('div');guides.id='alignment-guides';guides.dataset.editorTool='true';$('world').append(guides);
    let layerQuery='',layerType='',collapsed=new Set(),viewHistory=[],styleClipboard=null,paused=false,searchResults=[];
    const editing=target=>Boolean(target.closest('input,textarea,select,[contenteditable]'));
    const commitText=()=>{if(state.finishTextEdit)state.finishTextEdit();document.activeElement?.blur();};
    function button(id,label,handler,parent) {
      const el=document.createElement('button');el.id=id;el.textContent=label;el.dataset.editorTool='true';
      el.onclick=handler;parent.append(el);return el;
    }
    let nativeFullscreen=false;
    const fullscreenButton=api.desktop?null:button('editor-fullscreen','全屏编辑',()=>toggleFullscreen(),document.querySelector('.top-actions'));
    function fullscreenLabel(){if(!fullscreenButton)return;const active=api.desktop?nativeFullscreen:!!document.fullscreenElement;const label=active?'退出全屏':'全屏编辑';fullscreenButton.innerHTML=global.StudioEditorUI?global.StudioEditorUI.icon('fullscreen')+'<span>'+label+'</span>':label;fullscreenButton.setAttribute('aria-label',label);fullscreenButton.setAttribute('aria-pressed',String(active));fullscreenButton.title='切换全屏 · F11';}
    async function toggleFullscreen(force){
      try{
        if(api.desktop){const active=await api.desktop.getFullscreen();nativeFullscreen=await api.desktop.setFullscreen(typeof force==='boolean'?force:!active);}
        else {const active=!!document.fullscreenElement,next=typeof force==='boolean'?force:!active;if(next&&!active)await document.documentElement.requestFullscreen();else if(!next&&active)await document.exitFullscreen();}
      }catch{if(fullscreenButton)fullscreenButton.title='点击进入全屏；浏览器需要您主动点击';}
      fullscreenLabel();
    }
    document.addEventListener('fullscreenchange',fullscreenLabel);
    api.desktop?.onFullscreenChanged(active=>{nativeFullscreen=active;fullscreenLabel();});
    document.addEventListener('keydown',e=>{if(e.key==='F11'){e.preventDefault();e.stopImmediatePropagation();toggleFullscreen();}},true);
    const startWorkspace=async()=>{if(api.desktop)await api.desktop.maximizeWindow();fullscreenLabel();};
    const searchButton=button('quick-search','搜索',()=>search(),document.querySelector('.top-actions'));
    searchButton.title='搜索对象、步骤和功能 · Ctrl+K / Ctrl+F';
    const toolsBar=document.createElement('div');toolsBar.id='workflow-tools';toolsBar.dataset.editorTool='true';
    $('left-panel').prepend(toolsBar);
    button('motion-panel','动效编排',()=>animationPanel(),toolsBar);
    document.addEventListener('click',event=>{if(event.target.closest('[data-open-motion]'))animationPanel();});
    const filter=document.createElement('div');filter.id='layer-filter';filter.dataset.editorTool='true';
    filter.innerHTML='<input type="search" aria-label="搜索图层" placeholder="搜索图层或文字"><select aria-label="筛选组件类型"><option value="">全部类型</option>'+Object.entries(typeNames).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')+'<option value="edge">连线</option></select>';
    toolsBar.after(filter);
    filter.querySelector('input').oninput=event=>{layerQuery=event.target.value;decorateLeft();};
    filter.querySelector('select').onchange=event=>{layerType=event.target.value;decorateLeft();};
    button('previous-view','上一视野',()=>backView(),$('canvas-tools'));
    const pauseButton=button('pause-effects','暂停动效',()=>{
      api.stopAuto();paused=!paused;
      for(const animation of $('world').getAnimations({subtree:true}))paused?animation.pause():animation.play();
      pauseButton.textContent=paused?'继续动效':'暂停动效';
    },$('presentation-bar'));
    button('replay-step','重播本步',()=>{api.stopAuto();api.showStep(state.playIndex);},$('presentation-bar'));
    function resetAnimationPause(){paused=false;pauseButton.textContent='暂停动效';}
    function clearGuides(){guides.replaceChildren();}
    function snapDrag(pointer,dx,dy,disabled){
      clearGuides();if(disabled)return {dx,dy};
      const result=C.snapMove(pointer.originals.filter(n=>!n.locked),state.project.nodes.filter(n=>!state.selected.has(n.id)&&api.isVisible(n)),dx,dy,6/state.view.zoom);
      const view=$('viewport'),minX=-state.view.x/state.view.zoom,minY=-state.view.y/state.view.zoom;
      for(const guide of result.guides){const line=document.createElement('div');line.className='alignment-guide';Object.assign(line.style,guide.axis==='x'?{left:guide.value+'px',top:minY+'px',width:1/state.view.zoom+'px',height:view.clientHeight/state.view.zoom+'px'}:{left:minX+'px',top:guide.value+'px',height:1/state.view.zoom+'px',width:view.clientWidth/state.view.zoom+'px'});guides.append(line);}
      return result;
    }
    function decorateLibrary(){
      const field=document.createElement('input');field.type='search';field.placeholder='搜索项目名称';field.setAttribute('aria-label','搜索项目名称');field.className='project-search';
      field.oninput=()=>{$('dialog-content').querySelectorAll('.project-item').forEach(row=>row.hidden=!matches(row.querySelector('strong').textContent,field.value));};$('dialog-content').prepend(field);
    }
    function rememberView(){viewHistory.push({project:state.project.id,view:{...state.view}});if(viewHistory.length>30)viewHistory.shift();}
    function backView(){const previous=viewHistory.pop();if(!previous||previous.project!==state.project.id){viewHistory=[];api.toast('没有可返回的视野。');return;}state.view=previous.view;api.updateView();}
    function focus(ids,edgeId=null) {
      commitText();rememberView();api.setSelection(ids,edgeId);
      const nodes=ids.map(api.findNode).filter(Boolean);
      if(edgeId){const edge=state.project.edges.find(e=>e.id===edgeId);if(edge)nodes.push(...C.contentNodes({nodes:[],edges:[edge]}));if(edge&&!C.isFreeEdge(edge))nodes.push(...[api.findNode(edge.from),api.findNode(edge.to)].filter(Boolean));}
      if(nodes.length)api.fitBounds(C.bounds(nodes),true);
    }
    function matches(value,query){return query.toLocaleLowerCase().trim().split(/\s+/).every(term=>String(value).toLocaleLowerCase().includes(term));}
    const stepNavigation=StudioStepNavigation.install(api);
    function decorateLeft() {
      filter.hidden=state.tab!=='layers';
      if(state.tab!=='layers')return;
      const panel=$('left-content'),stepNumber=StudioStepNavigation.number(layerQuery),numbered=stepNumber!==null;
      for(const row of panel.querySelectorAll('[data-layer]')){
        const n=api.findNode(row.dataset.layer),group=state.project.groups.find(g=>g.nodeIds.includes(n.id));
        const step=state.project.steps.find(s=>s.id===n.stepId);
        row.hidden=Boolean(layerType&&layerType!==n.type)||!(numbered?state.project.steps[stepNumber-1]?.id===n.stepId:matches([n.name,n.text,(n.cells||[]).flat().join(' '),group?.name,step?.name].join(' '),layerQuery));
        row.title='单击选择；双击聚焦；Ctrl / Shift 追加选择';
      }
      for(const row of panel.querySelectorAll('[data-select-edge]')){const edge=state.project.edges.find(e=>e.id===row.dataset.selectEdge);row.hidden=Boolean(layerType&&layerType!=='edge')||!(numbered?state.project.steps[stepNumber-1]?.id===edge.stepId:matches(row.textContent+' '+edge.label+' '+state.project.steps.find(s=>s.id===edge.stepId)?.name,layerQuery));}
      for(const row of panel.querySelectorAll('[data-group]')) {
        const children=row.nextElementSibling;
        row.hidden=![...children.querySelectorAll('[data-layer]')].some(el=>!el.hidden);
        const foldKey=row.dataset.groupScope+':'+row.dataset.group;
        children.hidden=row.hidden||(!layerQuery&&!layerType&&collapsed.has(foldKey));
        let fold=row.querySelector('[data-fold-group]');
        if(!fold){fold=document.createElement('button');fold.dataset.foldGroup=row.dataset.group;row.prepend(fold);fold.onclick=event=>{event.stopPropagation();collapsed.has(foldKey)?collapsed.delete(foldKey):collapsed.add(foldKey);decorateLeft();};}
        fold.textContent=children.hidden?'▸':'▾';fold.setAttribute('aria-label',(children.hidden?'展开':'折叠')+'组合');fold.setAttribute('aria-expanded',String(!children.hidden));
      }
      api.layerTools.decorate(layerQuery,layerType);
    }
    function updateLayerSelection(){
      const panel=$('left-content');
      for(const row of panel.querySelectorAll('[data-layer],[data-group]')){
        const ids=row.dataset.layer?[row.dataset.layer]:api.layerTools.groupIds(row.dataset.group,row.dataset.groupScope);
        const all=ids.length>0&&ids.every(id=>state.selected.has(id)),some=ids.some(id=>state.selected.has(id));
        row.classList.toggle('active',all);const check=row.querySelector('input[data-layer-check]');if(check){check.checked=all;check.indeterminate=some&&!all;}
      }
      panel.querySelectorAll('[data-select-edge]').forEach(row=>row.classList.toggle('active',row.dataset.selectEdge===state.edgeId));
      const count=panel.querySelector('.layer-controls span');if(count)count.textContent=`已选 ${state.selected.size}`;
      api.layerTools.syncActions?.();
    }
    $('left-content').addEventListener('dblclick',event=>{
      if(state.tab!=='layers'||event.target.closest('button,input'))return;
      const row=event.target.closest('[data-layer],[data-group],[data-select-edge]');if(!row)return;
      if(row.dataset.layer)focus([row.dataset.layer]);
      else if(row.dataset.group)focus(api.layerTools.groupIds(row.dataset.group,row.dataset.groupScope));
      else focus([],row.dataset.selectEdge);
    });
    function revealLayers(id){
      const row=[...$('left-content').querySelectorAll('[data-layer]')].find(el=>el.dataset.layer===id),children=row?.closest('.group-children');
      if(children){const group=children.previousElementSibling;collapsed.delete(group.dataset.groupScope+':'+group.dataset.group);decorateLeft();}
    }
    function copyStyle(){const node=api.selectedNodes()[0];if(!node){api.toast('先选择一个组件。');return;}styleClipboard=C.copy(node.style);api.toast('已复制格式，选择其他组件后粘贴格式。');}
    function pasteStyle(){if(!styleClipboard){api.toast('请先复制格式。');return;}api.change(()=>api.selectedNodes().forEach(n=>{n.style=C.copy(styleClipboard);}));}
    function equalSize(axis){const nodes=api.selectedNodes();if(nodes.length<2)return;api.change(()=>nodes.slice(1).filter(n=>!n.locked).forEach(n=>n[axis]=nodes[0][axis]));}
    function commands(){return [
      ['从头演示 · F5',()=>api.enterPresentation(0)],['从当前步骤演示 · Shift+F5',()=>api.enterPresentation(state.project.steps.findIndex(s=>s.id===state.activeStep))],
      ['按编号跳转步骤 · Ctrl+J',stepNavigation.open],['动效编排',animationPanel],['返回上一视野',backView],['聚焦选中',()=>focus([...state.selected],state.edgeId)],
      ['编辑时隐藏所选 · Ctrl+H',()=>api.layerTools.action('hide')],['编辑时显示所选',()=>api.layerTools.action('show')],['编辑时仅看所选',()=>api.layerTools.action('only')],['恢复全部可见 · Ctrl+Shift+H',()=>api.layerTools.action('all')],
      ['复制格式 · Ctrl+Shift+C',copyStyle],['粘贴格式 · Ctrl+Shift+V',pasteStyle],['统一宽度',()=>equalSize('w')],['统一高度',()=>equalSize('h')],
      ['对齐：左对齐',()=>api.command('align-left')],['对齐：水平居中',()=>api.command('align-center')],['对齐：顶对齐',()=>api.command('align-top')],
      ['分布：水平等距',()=>api.command('distribute-x')],['分布：垂直等距',()=>api.command('distribute-y')],
      ['组合 · Ctrl+G',()=>api.command('group')],['取消组合 · Ctrl+Shift+G',()=>api.command('ungroup')],
      ['置顶',()=>api.command('front')],['置底',()=>api.command('back')],['锁定位置与尺寸',()=>api.change(()=>api.selectedNodes().forEach(n=>n.locked=true))],['解锁位置与尺寸',()=>api.change(()=>api.selectedNodes().forEach(n=>n.locked=false))],
      ['保存到本机 · Ctrl+S',()=>api.persistNow()],['导出项目 JSON · Ctrl+Shift+S',()=>api.exportProject()],['快捷键与使用说明',()=>api.showHelp()],
      ...Object.entries(typeNames).map(([kind,label])=>['插入'+label,()=>api.addComponent(kind)])
    ];}
    function search(query='') {
      commitText();api.openDialog('搜索与快速操作','<input id="search-everything" type="search" aria-label="搜索对象、步骤和功能" placeholder="文字、对象名、步骤编号（如 #3）或命令"><p class="hint">Enter 聚焦首项；方向键浏览结果。输入编号优先定位对应步骤；#3 / 第3步仅查步骤。</p><div id="search-results"></div>');
      const input=$('search-everything');input.value=query;
      function update(){
        const q=input.value,n=StudioStepNavigation.number(q),exact=n===null?null:state.project.steps[n-1],explicit=n!==null&&/^(#|第|步骤)/.test(q.normalize('NFKC').trim());
        searchResults=[...state.project.nodes.map(n=>({label:n.name,detail:[n.text,(n.cells||[]).flat().join(' ')].filter(Boolean).join(' '),kind:typeNames[n.type],run:()=>focus([n.id])})),
          ...state.project.steps.map((s,i)=>({label:`${i+1}. ${s.name}`,detail:s.note,kind:'步骤',stepId:s.id,run:()=>{rememberView();stepNavigation.go(s.id,true);}})),
          ...commands().map(([label,run])=>({label,detail:'',kind:'操作',run}))].filter(item=>n!==null&&item.kind==='步骤'?item.stepId===exact?.id:!explicit&&matches(item.label+' '+item.detail+' '+item.kind,q));
        if(exact)searchResults.sort((a,b)=>Number(b.stepId===exact.id)-Number(a.stepId===exact.id));
        const results=$('search-results');results.innerHTML=searchResults.slice(0,100).map((item,i)=>`<button class="search-result" data-search-result="${i}"><small>${esc(item.kind)}</small><strong>${esc(item.label)}</strong><span>${esc(item.detail.slice(0,100))}</span></button>`).join('')||'<p>没有找到结果，试试对象文字或步骤名称。</p>';
        if(searchResults.length>100)results.insertAdjacentHTML('beforeend','<p>显示前 100 项，请输入更多文字缩小范围。</p>');
        results.onclick=event=>{const el=event.target.closest('[data-search-result]');if(!el)return;const item=searchResults[Number(el.dataset.searchResult)];$('dialog').close();item.run();};
      }
      input.oninput=update;input.onkeydown=event=>{if(event.key==='Enter'&&searchResults.length){event.preventDefault();$('dialog').close();searchResults[0].run();}if(event.key==='ArrowDown'){event.preventDefault();$('search-results').querySelector('button')?.focus();}};
      $('search-results').onkeydown=event=>{if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();const buttons=[...$('search-results').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowDown'?1:-1)))]?.focus();};
      update();input.focus();
    }
    const motionEditor=StudioMotionEditor.install({...api,stepNavigation},effectNames);
    function animationPanel(stepId=state.activeStep){commitText();motionEditor.open(stepId);}
    // Clipboard events preserve OS text/image support and share components across windows.
    for(const kind of ['copy','cut'])document.addEventListener(kind,event=>{
      if(state.home||editing(event.target)||$('dialog').open||state.playing||(!state.selected.size&&!api.selectedEdge()))return;
      api.copySelected(false);if(!state.clipboard)return;
      event.preventDefault();event.clipboardData.setData('application/x-presentation-studio',JSON.stringify(state.clipboard));
      event.clipboardData.setData('text/plain',api.selectedNodes().map(n=>n.text||n.name).join('\n'));
      if(kind==='cut')api.command('delete');
    });
    document.addEventListener('paste',event=>{
      if(state.home||editing(event.target)||$('dialog').open||state.playing)return;
      const data=event.clipboardData,fragment=data.getData('application/x-presentation-studio');
      const images=[...data.items].filter(item=>item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean),text=data.getData('text/plain');
      event.preventDefault();
      try{if(fragment){const value=JSON.parse(fragment);if(!value||(!value.freeLine&&!Array.isArray(value.nodes)))throw Error('组件数据无效');if(value.freeLine){const draft=C.copy(state.project),line=C.copy(value.freeLine);line.id=C.uid('edge');line.stepId=state.activeStep;line.endStepId='';draft.edges.push(line);C.validate(draft);}state.clipboard=value;api.pasteSelected();}
        else if(images.length)api.importImages(images);
        else if(text){const point=state.pastePoint||api.viewportCenter(),node=C.node('text',point.x-150,point.y-45,state.activeStep);node.text=text;node.name=text.split('\n')[0].slice(0,40)||'粘贴文字';api.change(()=>{state.project.nodes.push(node);api.growCanvas();});api.setSelection([node.id]);}
        else api.pasteSelected();
      }catch(error){api.toast('无法粘贴：'+error.message);}
    });
    document.addEventListener('keydown',event=>{
      if(state.home||event.isComposing)return;
      const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
      if($('dialog').open)return;
      let action=null;
      if(mod&&key==='s')action=()=>{commitText();event.shiftKey?api.exportProject():api.persistNow();};
      else if(event.key==='F5')action=()=>{commitText();api.enterPresentation(event.shiftKey?state.project.steps.findIndex(s=>s.id===state.activeStep):0);};
      else if(!state.playing&&mod&&['k','f'].includes(key))action=()=>search();
      else if(!state.playing&&!editing(event.target)){
        if(mod&&event.shiftKey&&key==='c')action=copyStyle;
        if(mod&&event.shiftKey&&key==='v')action=pasteStyle;
        if(mod&&key==='b')action=()=>api.command('text-bold');
        if(mod&&key==='h')action=()=>api.layerTools.action(event.shiftKey?'all':'hide');
        if(event.altKey&&event.key==='ArrowLeft')action=backView;
      }
      if(action){event.preventDefault();event.stopImmediatePropagation();action();}
    },true);
    let closeContext=()=>{};
    $('viewport').addEventListener('contextmenu',event=>{
      if(state.playing||editing(event.target))return;event.preventDefault();commitText();
      closeContext();
      const rect=$('viewport').getBoundingClientRect();
      state.pastePoint={x:(event.clientX-rect.left-state.view.x)/state.view.zoom,y:(event.clientY-rect.top-state.view.y)/state.view.zoom};
      const menu=document.createElement('div');menu.id='canvas-context-menu';menu.setAttribute('role','menu');
      menu.style.left=Math.min(event.clientX,innerWidth-170)+'px';menu.style.top=Math.min(event.clientY,innerHeight-55)+'px';
      const button=document.createElement('button');button.setAttribute('role','menuitem');button.textContent='粘贴';button.disabled=!state.clipboard;
      const close=()=>{menu.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);};
      closeContext=close;
      const outside=e=>{if(!menu.contains(e.target))close();};
      const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();api.focusCanvas();}};
      button.onclick=()=>{close();api.pasteSelected();api.focusCanvas();};menu.append(button);document.body.append(menu);button.focus();
      document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);
    });
    document.addEventListener('click',event=>{
      const overlap=event.target.closest('[data-property-select]');if(overlap){api.setSelection([overlap.dataset.propertySelect]);return;}
      const action=event.target.closest('[data-property-tool]')?.dataset.propertyTool;
      const actions={copyStyle,pasteStyle,width:()=>equalSize('w'),height:()=>equalSize('h'),focus:()=>focus([...state.selected],state.edgeId)};
      if(actions[action])actions[action]();
    });
    return {stepNavigation,startWorkspace,toggleFullscreen,resumeMotionPreview:motionEditor.resume,resetMotionPreview:motionEditor.reset,decorateLeft,updateLayerSelection,revealLayers,decorateLibrary,resetAnimationPause,search,animationPanel,snapDrag,clearGuides};
  }
  global.StudioEditorTools={install};
})(globalThis);
