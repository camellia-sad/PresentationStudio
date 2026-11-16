/* Local workspace preferences only; never part of project data or undo history. */
(function(global){
  'use strict';
  const key='studio-sidebar-layout-v1',defaults={left:220,right:300},limits={left:[190,360],right:[260,420]},folds=new Map();
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function section(title,content){
    const current=document.querySelector(`[data-property-section="${title}"]`);
    if(current)folds.set(title,current.open);
    const collapsed=['对象','外观与排列','外观','格式与视野','重叠对象','点击交互（演示时）','动效','图层操作','项目数据','导图'].includes(title);
    const open=folds.has(title)?folds.get(title):!collapsed;
    const status=title==='图层操作'?(/data-prop="locked"[^>]* checked/.test(content)?' · 已锁定':'')+(/data-prop="hidden"[^>]* checked/.test(content)?' · 演示隐藏':''):'';
    return `<details class="property-section" data-property-section="${title}" ${open?'open':''}><summary>${title}${status}</summary><div class="property-section-body">${content}</div></details>`;
  }
  function install(){
    const workspace=document.querySelector('.workspace');let widths={...defaults},drag=null;
    // The icon rail is a fixed column outside the resizable panel.
    const usableWidth=()=>workspace.clientWidth-(document.getElementById('left-rail')?.offsetWidth||0);
    try{const saved=JSON.parse(localStorage.getItem(key));for(const side of ['left','right'])if(Number.isFinite(saved?.[side]))widths[side]=clamp(saved[side],...limits[side]);}catch{/* Storage can be unavailable in an exported file. */}
    const handles={};
    function save(){try{localStorage.setItem(key,JSON.stringify(widths));}catch{/* Current session remains usable. */}}
    function bounds(side){
      const narrow=innerWidth<=760,other=side==='left'?'right':'left';
      if(narrow)return side==='left'?[130,Math.max(130,Math.min(260,innerWidth-240))]:[260,Math.min(420,innerWidth-32)];
      return [limits[side][0],Math.min(limits[side][1],Math.max(limits[side][0],usableWidth()-360-limits[other][0]))];
    }
    function apply(){
      if(!workspace.clientWidth)return;
      let left=clamp(widths.left,...bounds('left')),right=clamp(widths.right,...bounds('right'));
      if(innerWidth>760){const overflow=left+right+360-usableWidth();if(overflow>0){const shrink=Math.min(left-limits.left[0],overflow);left-=shrink;right=Math.max(limits.right[0],right-(overflow-shrink));}}
      workspace.style.setProperty('--left-width',left+'px');workspace.style.setProperty('--right-width',right+'px');
      for(const side of ['left','right']){const [min,max]=bounds(side),handle=handles[side];handle.setAttribute('aria-valuemin',min);handle.setAttribute('aria-valuemax',max);handle.setAttribute('aria-valuenow',Math.round(side==='left'?left:right));handle.setAttribute('aria-valuetext',`${Math.round(side==='left'?left:right)} 像素`);}
    }
    function finish(cancel=false){
      if(!drag)return;const previous=drag;drag=null;
      if(cancel)widths=previous.before;else save();
      document.body.classList.remove('resizing-sidebar');
      if(previous.handle.hasPointerCapture(previous.id))previous.handle.releasePointerCapture(previous.id);
      apply();
    }
    for(const side of ['left','right']){
      const panel=document.getElementById(side==='left'?'left-panel':'inspector'),handle=document.createElement('div');
      handle.id=side+'-resize';handle.className='sidebar-resize '+side;handle.dataset.editorTool='true';handle.tabIndex=0;
      handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-controls',panel.id);
      handle.setAttribute('aria-label',side==='left'?'调整左侧栏宽度':'调整属性栏宽度');handle.title='拖动调整宽度；双击恢复默认；方向键微调，Home 恢复默认';
      handles[side]=handle;panel.append(handle);
      handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();handle.focus();drag={side,handle,id:event.pointerId,x:event.clientX,width:panel.getBoundingClientRect().width,before:{...widths}};handle.setPointerCapture(event.pointerId);document.body.classList.add('resizing-sidebar');});
      handle.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const other=side==='left'?'right':'left',[min,max]=bounds(side);const room=innerWidth<=760?max:usableWidth()-360-Number(handles[other].getAttribute('aria-valuenow'));widths[side]=clamp(drag.width+(event.clientX-drag.x)*(side==='left'?1:-1),min,Math.max(min,Math.min(max,room)));apply();});
      handle.addEventListener('pointerup',()=>finish());handle.addEventListener('pointercancel',()=>finish(true));handle.addEventListener('lostpointercapture',()=>finish());
      handle.addEventListener('dblclick',()=>{widths[side]=defaults[side];apply();save();});
      handle.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();event.stopPropagation();const [min,max]=bounds(side),other=side==='left'?'right':'left';
        const available=innerWidth<=760?max:Math.max(min,Math.min(max,usableWidth()-360-Number(handles[other].getAttribute('aria-valuenow'))));
        const delta=(event.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*(event.shiftKey?30:10);
        widths[side]=event.key==='Home'?defaults[side]:event.key==='End'?available:clamp(Number(handle.getAttribute('aria-valuenow'))+delta,min,available);apply();save();
      });
    }
    document.addEventListener('keydown',event=>{if(drag&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(true);}},true);
    window.addEventListener('blur',()=>finish(true));window.addEventListener('resize',()=>{finish(true);apply();});
    new ResizeObserver(apply).observe(workspace);
    document.addEventListener('toggle',event=>{const el=event.target;if(el.matches?.('[data-property-section]')&&el.isConnected)folds.set(el.dataset.propertySection,el.open);},true);
    apply();
  }
  function arrangeProperties(){
    const root=document.getElementById('properties');
    const order=['文字','形状','图标','图片','表格','排版','批量排版','共同外观','外观','组件对齐画布','对齐与组合','出现与退场','动效','点击交互（演示时）','外观与排列','对象','图层操作','导图'];
    const children=[...root.children];
    children.sort((a,b)=>{const rank=el=>{if(el.classList.contains('selection-step-button'))return 8.5;const i=order.indexOf(el.dataset.propertySection);return i<0?order.length:i;};return rank(a)-rank(b);});
    root.append(...children);
  }
  global.StudioSidebarLayout={install,section,arrangeProperties};
})(globalThis);
