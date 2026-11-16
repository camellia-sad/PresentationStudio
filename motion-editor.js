/* Visual animation authoring; preview state never changes saved step cameras. */
(function(global){
  'use strict';
  function install(api,effectNames){
    const {C,state,$,escapeHtml:esc}=api;
    let selectedId=null,stepId=null,mode='focus',returnContext=null;
    const items=()=>new Map([...state.project.nodes,...state.project.edges].map(n=>[n.id,n]));
    const list=()=>$('dialog-content').querySelector('.motion-list');
    function boundsFor(item){
      if(state.project.nodes.includes(item))return C.visualBounds([item]);
      const ends=C.edgePoints(item,state.project.nodes),middle=C.edgeMidpoint(item,state.project.nodes);
      return C.bounds([...ends,middle].map(p=>({x:p.x,y:p.y,w:1,h:1})));
    }
    function choose(id,focus=true){
      if(!C.animationPlan(state.project,stepId).some(t=>t.id===id))return;
      selectedId=id;if(focus)mode='focus';
      const item=items().get(id),node=state.project.nodes.includes(item);
      api.setSelection(node?[id]:[],node?null:id,{reveal:false});
      api.fitBounds(boundsFor(item),false);
      $('dialog-content').querySelectorAll('[data-motion-id]').forEach(row=>{const active=row.dataset.motionId===id;row.classList.toggle('active',active);row.querySelector('.motion-select').setAttribute('aria-pressed',String(active));});
      renderScene();
    }
    function renderScene(){
      const scene=$('motion-canvas');if(!scene||!$('dialog').open)return;
      const byId=items(),selected=byId.get(selectedId),index=state.project.steps.findIndex(s=>s.id===stepId);
      const forced=new Set(selected?[selected.id]:[]);
      if(selected?.from&&selected?.to){forced.add(selected.from);forced.add(selected.to);}
      const nodes=state.project.nodes.filter(n=>forced.has(n.id)||C.visibleAt(n,state.project.steps,index));
      const nodeIds=new Set(nodes.map(n=>n.id));
      const edges=state.project.edges.filter(e=>(forced.has(e.id)||C.visibleAt(e,state.project.steps,index))&&(C.isFreeEdge(e)||nodeIds.has(e.from)&&nodeIds.has(e.to)));
      const allBounds=nodes.map(n=>C.visualBounds([n])).concat(edges.map(boundsFor));
      const box=mode==='focus'&&selected?boundsFor(selected):allBounds.length?C.bounds(allBounds):C.canvasBounds(state.project.canvas);
      const width=scene.clientWidth,height=scene.clientHeight,pad=mode==='focus'?110:50;
      const zoom=Math.max(.01,Math.min(2,(width-40)/(box.w+pad),(height-40)/(box.h+pad)));
      const world=document.createElement('div');world.className='motion-world';world.style.transform=`translate(${width/2-(box.x+box.w/2)*zoom}px,${height/2-(box.y+box.h/2)*zoom}px) scale(${zoom})`;
      const canvas=C.canvasBounds(state.project.canvas),paper=document.createElement('div');paper.className='motion-paper';Object.assign(paper.style,{left:canvas.x+'px',top:canvas.y+'px',width:canvas.w+'px',height:canvas.h+'px',background:state.project.canvas.background});world.append(paper);
      function lines(free){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('motion-edges');
        svg.innerHTML=edges.filter(e=>C.isFreeEdge(e)===free).map(e=>{const path=esc(C.edgePath(e,state.project.nodes)),mid=C.edgeMidpoint(e,state.project.nodes),marker='motion-arrow-'+e.id;
          return `<g data-motion-pick="${esc(e.id)}"><defs><marker id="${esc(marker)}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="${esc(e.color)}" stroke-width="1.5"/></marker></defs><path d="${path}" fill="none" stroke="transparent" stroke-width="${18/zoom}" class="motion-hit"/>${e.id===selectedId?`<path d="${path}" fill="none" stroke="#a875df" stroke-width="${7/zoom}" opacity=".4"/>`:''}<path d="${path}" fill="none" stroke="${esc(e.color)}" stroke-width="${e.width}" ${e.arrow?`marker-end="url(#${esc(marker)})"`:''} ${e.dash?'stroke-dasharray="8 6"':''}/>${e.label?`<text x="${mid.x}" y="${mid.y-10}" text-anchor="middle" font-size="${e.labelSize}" fill="${esc(e.color)}">${esc(e.label)}</text>`:''}</g>`;
        }).join('');world.append(svg);
      }
      lines(false);
      nodes.forEach(n=>{const el=document.createElement('div');el.className='node type-'+n.type;el.dataset.motionPick=n.id;el.innerHTML=`<div class="node-body">${api.nodeBody(n)}</div>`;api.applyNodeStyles(el,n);world.append(el);});
      lines(true);
      if(selected){const rect=boundsFor(selected),outline=document.createElement('div');outline.className='motion-outline';Object.assign(outline.style,{left:(rect.x-5/zoom)+'px',top:(rect.y-5/zoom)+'px',width:(rect.w+10/zoom)+'px',height:(rect.h+10/zoom)+'px',borderWidth:2/zoom+'px'});world.append(outline);}
      scene.replaceChildren(world);
      $('motion-selection-label').textContent=selected?'已选：'+(selected.name||selected.label||'连线')+(selected.hidden?' · 正式演示中隐藏':''):'此步骤没有新动作';
      scene.setAttribute('aria-label',selected?'画布预览：'+(selected.name||selected.label||'连线'):'画布预览');
    }
    function open(id=state.activeStep,options={}){
      if(state.finishTextEdit)state.finishTextEdit();
      const step=state.project.steps.find(s=>s.id===id);if(!step)return;
      if(stepId!==id){selectedId=null;mode='focus';}stepId=id;
      state.activeStep=id;
      const plan=C.animationPlan(state.project,id),byId=items();
      selectedId=plan.some(t=>t.id===(options.selectedId||selectedId))?(options.selectedId||selectedId):plan[0]?.id||null;
      const option=(values,value)=>Object.entries(values).map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${esc(t)}</option>`).join('');
      api.openDialog('动效编排',`<div class="motion-layout"><div class="motion-visual"><div class="motion-view-tools"><button id="motion-focus">聚焦当前动作</button><button id="motion-overview">查看本步全貌</button></div><div id="motion-canvas"></div><strong id="motion-selection-label"></strong><p class="hint">点选右侧动作或画布对象联动定位。这里显示静态布局，忽略编辑隐藏；不会修改已保存的步骤镜头。</p></div><div class="motion-controls"><div class="motion-toolbar"><label>步骤 <select id="motion-step">${state.project.steps.map(s=>`<option value="${esc(s.id)}" ${s.id===id?'selected':''}>${esc(StudioStepNavigation.label(state.project,s.id))}</option>`).join('')}</select></label><button id="motion-preview" class="primary">▶ 预览本步</button><button id="motion-sequential">依次播放</button><button id="motion-together">同时播放</button></div>${api.stepNavigation.markup('motion-step-number','切换',false)}<p class="hint">时长与间隔以秒计；预览结束后返回这里继续编排。</p><div class="motion-list">${plan.map((entry,i)=>{const item=byId.get(entry.id),a=item.animation;
        return `<section class="motion-row" data-motion-id="${esc(item.id)}"><div class="motion-name"><button class="motion-select" aria-pressed="false">${i+1}. ${esc(item.name||item.label||'连线')}</button><span>${(entry.start/1000).toFixed(2)}–${(entry.end/1000).toFixed(2)} 秒</span><button data-motion-move="-1" ${i===0?'disabled':''} aria-label="上移动效">↑</button><button data-motion-move="1" ${i===plan.length-1?'disabled':''} aria-label="下移动效">↓</button></div><div class="motion-fields"><label>效果<select data-motion-prop="type">${option(effectNames,a.type)}</select></label><label>开始<select data-motion-prop="start">${option({step:'本步开始',with:'与上一项同时',after:'上一项之后'},a.start||'step')}</select></label><label>时长 / 秒<input type="number" min="0" max="60" step="0.1" data-motion-prop="duration" value="${a.duration/1000}"></label><label>间隔 / 秒<input type="number" min="0" max="60" step="0.1" data-motion-prop="delay" value="${a.delay/1000}"></label></div></section>`;
      }).join('')||'<p>此步骤没有新出现的组件或连线。</p>'}</div></div></div>`);
      $('dialog').classList.add('motion-dialog');
      const redraw=()=>open(id,{selectedId,scroll:list().scrollTop});
      $('motion-step').onchange=e=>open(e.target.value);
      api.stepNavigation.bind('motion-step-number',id=>open(id));
      $('motion-focus').onclick=()=>{mode='focus';renderScene();};$('motion-overview').onclick=()=>{mode='step';renderScene();};
      $('motion-canvas').onclick=e=>{const picked=e.target.closest('[data-motion-pick]');if(picked){choose(picked.dataset.motionPick);list().querySelector('.active')?.scrollIntoView({block:'nearest'});}};
      $('motion-preview').onclick=()=>{
        returnContext={projectId:state.project.id,stepId:id,selectedId,mode,scroll:list().scrollTop,view:{...state.view},editor:api.layerTools.snapshot(),tab:state.tab};
        $('dialog').close();api.enterPresentation(state.project.steps.findIndex(s=>s.id===id));$('exit-presentation').textContent='返回动效编排';
      };
      for(const [button,trigger] of [['motion-sequential','after'],['motion-together','step']])$(button).onclick=()=>{api.change(()=>{plan.forEach((entry,i)=>Object.assign(byId.get(entry.id).animation,{start:i?trigger:'step',delay:0}));step.animationOrder=plan.map(t=>t.id);});redraw();};
      list().onchange=e=>{
        const key=e.target.dataset.motionProp;if(!key)return;const item=byId.get(e.target.closest('[data-motion-id]').dataset.motionId),numeric=['duration','delay'].includes(key),value=numeric?Number(e.target.value)*1000:e.target.value;
        if(numeric&&(e.target.value===''||!Number.isFinite(value)||value<0||value>60000)){api.toast('时长和间隔请填写 0–60 秒。');redraw();return;}
        selectedId=item.id;api.change(()=>{item.animation[key]=value;});redraw();
      };
      list().onclick=e=>{
        const row=e.target.closest('[data-motion-id]');if(!row)return;const move=e.target.closest('[data-motion-move]');
        if(move){selectedId=row.dataset.motionId;const index=plan.findIndex(t=>t.id===selectedId),next=index+Number(move.dataset.motionMove);if(next<0||next>=plan.length)return;api.change(()=>{const order=plan.map(t=>t.id);[order[index],order[next]]=[order[next],order[index]];step.animationOrder=order;});redraw();}
        else if(e.target.closest('.motion-select')||!e.target.closest('input,select,label'))choose(row.dataset.motionId);
      };
      list().onfocusin=e=>{const row=e.target.closest('[data-motion-id]');if(row&&selectedId!==row.dataset.motionId)choose(row.dataset.motionId);};
      if(selectedId)choose(selectedId,false);else {api.setSelection([]);renderScene();}
      list().scrollTop=options.scroll||0;
    }
    function resume(){
      const context=returnContext;returnContext=null;$('exit-presentation').textContent='返回编辑';
      if(!context||context.projectId!==state.project.id||!state.project.steps.some(s=>s.id===context.stepId))return false;
      state.activeStep=context.stepId;state.tab=context.tab;api.layerTools.restore(context.editor);state.view={...context.view};api.renderCanvas();api.updateView();
      mode=context.mode;stepId=context.stepId;open(context.stepId,context);return true;
    }
    function reset(){returnContext=null;selectedId=null;stepId=null;$('exit-presentation').textContent='返回编辑';}
    new ResizeObserver(()=>{if($('dialog').classList.contains('motion-dialog'))renderScene();}).observe($('dialog'));
    $('dialog').addEventListener('close',()=>{if(!$('dialog').open)$('dialog').classList.remove('motion-dialog');});
    return {open,resume,reset};
  }
  global.StudioMotionEditor={install};
})(globalThis);
