/* A detached template draft: never borrows the main editor's state or history. */
(function(global){
  'use strict';
  function open(api,record){
    const {C,$,escapeHtml:esc}=api;
    let draft=C.copy(record.project),selected=new Set(),edgeId=null,view=null,drag=null,undo=[],redo=[],closed=false;
    const snapshot=()=>C.copy(draft);
    const checkpoint=()=>{undo.push(snapshot());if(undo.length>60)undo.shift();redo=[];};
    const items=()=>draft.nodes.filter(n=>selected.has(n.id));
    function cleanup(){closed=true;observer.disconnect();$('dialog-content').onclick=null;$('dialog').removeEventListener('close',cleanup);$('dialog').removeEventListener('keydown',keys);}
    function cancel(){cleanup();api.back();}
    api.openDialog('编辑组件模板',`<div class="template-editor-toolbar"><label>名称<input id="component-name" maxlength="80" value="${esc(draft.title)}"></label><label>分类<input id="component-category" maxlength="40" value="${esc(record.category||'')}"></label><button id="template-save" class="primary">保存模板</button><button id="template-cancel">取消</button></div><div class="template-editor-layout"><section class="template-stage-panel"><div class="template-stage-tools"><button data-template-add="text">＋ 文字</button><button data-template-add="shape">＋ 形状</button><button data-template-add="icon">＋ 图标</button><span class="toolbar-spacer"></span><button id="template-undo">撤销</button><button id="template-redo">重做</button><button id="template-fit">适应画布</button></div><div id="template-stage" tabindex="0" aria-label="组件编辑画布"></div><div class="template-status">拖动移动 · 右下角缩放 · 双击编辑文字</div></section><aside class="template-properties"><h3>组件内容</h3><div id="template-layers"></div><div id="template-fields"></div></aside></div>`,cancel);
    $('dialog').classList.add('template-dialog');
    $('close-dialog').textContent='← 返回组件管理';
    const stage=$('template-stage');
    function draw(fit=false){
      if(closed)return;if(fit)view=null;
      view=api.paint(stage,draft,view);stage.querySelector('.component-preview-world').classList.add('template-world');
      stage.querySelectorAll('[data-template-node]').forEach(el=>{el.classList.toggle('template-selected',selected.has(el.dataset.templateNode));});
      const n=items()[0];
      if(n&&selected.size===1){const el=stage.querySelector(`[data-template-node="${CSS.escape(n.id)}"]`),handle=document.createElement('span');handle.className='template-resize';handle.dataset.templateResize='true';handle.setAttribute('aria-label','拖动缩放');el.append(handle);}
      stage.querySelectorAll('[data-template-edge]').forEach(el=>el.classList.toggle('template-edge-selected',el.dataset.templateEdge===edgeId));
      $('template-undo').disabled=!undo.length;$('template-redo').disabled=!redo.length;
    }
    function field(label,key,value,type='text'){return `<label class="field">${label}${type==='textarea'?`<textarea data-template-prop="${key}">${esc(value)}</textarea>`:`<input data-template-prop="${key}" type="${type}" value="${esc(value)}">`}</label>`;}
    function fields(){
      $('template-layers').innerHTML=[...draft.nodes].reverse().map(n=>`<button data-template-select="${esc(n.id)}" aria-pressed="${selected.has(n.id)}">${esc(n.name)}</button>`).join('')+draft.edges.map(e=>`<button data-template-line="${esc(e.id)}" aria-pressed="${edgeId===e.id}">${esc(e.label||'连线')}</button>`).join('');
      const n=items()[0],edge=draft.edges.find(e=>e.id===edgeId);let html='';
      if(edge)html=field('标注文字','label',edge.label)+field('颜色','color',edge.color,'color')+field('线宽','width',edge.width,'number');
      else if(n&&selected.size===1){
        html=field('图层名称','name',n.name);
        if(['text','button'].includes(n.type))html+=field('文字内容','text',n.text,'textarea');
        if(n.type==='table')html+=field('表格内容（Tab分列）','cells',n.cells.map(r=>r.join('\t')).join('\n'),'textarea');
        if(n.type==='icon')html+=`<div class="icons-grid">${Object.keys(C.ICONS).map(k=>`<button data-template-icon="${k}" aria-label="${C.ICON_NAMES[k]}" class="${n.icon===k?'active':''}"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2">${C.ICONS[k]}</svg></button>`).join('')}</div>`;
        html+=field('颜色','style.color',n.style.color,'color');
        if(['text','button','table'].includes(n.type))html+=field('字号','style.fontSize',n.style.fontSize,'number')+`<label class="check-field"><input type="checkbox" data-template-bold ${n.style.fontWeight>=600?'checked':''}>加粗</label>`;
        html+=field('填色','style.fill',n.style.fill==='transparent'?'#ffffff':n.style.fill,'color')+`<label class="check-field"><input type="checkbox" data-template-transparent ${n.style.fill==='transparent'?'checked':''}>背景透明</label>`+field('旋转 / °','rotation',n.rotation,'number');
      }else html=`<p class="hint">${selected.size?'已选择 '+selected.size+' 个对象':'选择画布上的对象开始编辑'}</p>`;
      if(n||edge)html+='<div class="property-buttons">'+(n?'<button data-template-action="duplicate">复制一份</button><button data-template-action="front">置顶</button><button data-template-action="back">置底</button>':'')+'<button class="danger" data-template-action="delete">删除</button></div>';
      $('template-fields').innerHTML=html;
    }
    function refresh(fit=false){draw(fit);fields();}
    function select(id,line=false,append=false){if(!append)selected.clear();edgeId=line?id:null;if(!line&&id){if(append&&selected.has(id))selected.delete(id);else selected.add(id);}refresh();}
    function action(name){
      if(name==='undo'||name==='redo'){
        const source=name==='undo'?undo:redo,target=name==='undo'?redo:undo;if(!source.length)return;target.push(snapshot());draft=source.pop();selected=new Set([...selected].filter(id=>draft.nodes.some(n=>n.id===id)));if(!draft.edges.some(e=>e.id===edgeId))edgeId=null;
      }else{
        if(!selected.size&&!edgeId)return;checkpoint();
        if(name==='delete'){C.remove(draft,[...selected,...(edgeId?[edgeId]:[])]);selected.clear();edgeId=null;}
        if(name==='duplicate')selected=new Set(C.duplicate(draft,[...selected],24));
        if(name==='front')draft.nodes=[...draft.nodes.filter(n=>!selected.has(n.id)),...items()];
        if(name==='back')draft.nodes=[...items(),...draft.nodes.filter(n=>!selected.has(n.id))];
      }refresh();
    }
    $('template-undo').onclick=()=>action('undo');$('template-redo').onclick=()=>action('redo');$('template-fit').onclick=()=>draw(true);$('template-cancel').onclick=cancel;
    $('template-save').onclick=async()=>{
      const name=$('component-name').value.trim();if(!name){$('component-name').focus();api.toast('请输入组件名称。');return;}
      if(!draft.nodes.length&&!draft.edges.length){api.toast('模板至少需要一个对象。');return;}
      const button=$('template-save');button.disabled=true;
      try{draft.title=name;C.validate(draft);await api.save({...C.copy(record),project:C.copy(draft),category:$('component-category').value.trim()||'未分类'});cleanup();api.back();api.toast('模板已保存，已插入的副本保持不变。');}
      catch(e){api.toast('保存失败：'+e.message);button.disabled=false;}
    };
    $('dialog-content').onclick=e=>{
      const el=e.target.closest('button');if(!el)return;
      if(el.dataset.templateSelect){select(el.dataset.templateSelect,false,e.ctrlKey||e.metaKey||e.shiftKey);return;}
      if(el.dataset.templateLine){select(el.dataset.templateLine,true);return;}
      if(el.dataset.templateAction){action(el.dataset.templateAction);return;}
      if(el.dataset.templateAdd){checkpoint();const n=C.node(el.dataset.templateAdd,(stage.clientWidth/2-view.x)/view.zoom-100,(stage.clientHeight/2-view.y)/view.zoom-40,draft.steps[0].id);if(n.type==='text')n.text='输入文字';draft.nodes.push(n);selected=new Set([n.id]);edgeId=null;refresh();return;}
      if(el.dataset.templateIcon&&items()[0]){checkpoint();items()[0].icon=el.dataset.templateIcon;refresh();}
    };
    $('template-fields').onchange=e=>{
      const n=items()[0],edge=draft.edges.find(e=>e.id===edgeId),target=edge||n;if(!target)return;
      const key=e.target.dataset.templateProp;
      if(key){let value=e.target.value;if(e.target.type==='number'){value=Number(value);if(!Number.isFinite(value))return;if(key!=='rotation')value=Math.max(1,Math.min(500,value));}checkpoint();if(key==='cells')target.cells=value.split('\n').map(r=>r.split('\t'));else if(key.startsWith('style.'))target.style[key.slice(6)]=value;else target[key]=value;}
      else if(n&&e.target.hasAttribute('data-template-bold')){checkpoint();n.style.fontWeight=e.target.checked?700:400;}
      else if(n&&e.target.hasAttribute('data-template-transparent')){checkpoint();n.style.fill=e.target.checked?'transparent':'#ffffff';}
      refresh();
    };
    stage.onpointerdown=e=>{
      if(e.button!==0)return;const el=e.target.closest('[data-template-node]'),line=e.target.closest('[data-template-edge]');
      if(!el){select(line?.dataset.templateEdge||null,Boolean(line));stage.focus();return;}
      const id=el.dataset.templateNode,resize=e.target.hasAttribute('data-template-resize');
      if(!resize&&(!selected.has(id)||e.ctrlKey||e.metaKey||e.shiftKey))select(id,false,e.ctrlKey||e.metaKey||e.shiftKey);
      if(!selected.has(id))return;
      e.preventDefault();stage.focus();drag={id:e.pointerId,x:e.clientX,y:e.clientY,before:snapshot(),nodes:items().map(C.copy),resize,changed:false};stage.setPointerCapture(e.pointerId);
    };
    stage.onpointermove=e=>{
      if(!drag)return;let dx=(e.clientX-drag.x)/view.zoom,dy=(e.clientY-drag.y)/view.zoom;
      if(!drag.changed&&Math.hypot(dx,dy)*view.zoom<3)return;drag.changed=true;
      for(const source of drag.nodes){const n=draft.nodes.find(n=>n.id===source.id);if(drag.resize){const a=source.rotation*Math.PI/180,localX=dx*Math.cos(a)+dy*Math.sin(a),localY=-dx*Math.sin(a)+dy*Math.cos(a);n.w=Math.max(16,source.w+localX);n.h=e.shiftKey?n.w*source.h/source.w:Math.max(16,source.h+localY);const dw=n.w-source.w,dh=n.h-source.h;n.x=source.x+(dw*Math.cos(a)-dh*Math.sin(a)-dw)/2;n.y=source.y+(dw*Math.sin(a)+dh*Math.cos(a)-dh)/2;}else{n.x=source.x+dx;n.y=source.y+dy;}}draw();
    };
    function finish(cancel=false){if(!drag)return;const last=drag;drag=null;if(cancel)draft=last.before;else if(last.changed){undo.push(last.before);redo=[];}if(stage.hasPointerCapture(last.id))stage.releasePointerCapture(last.id);refresh();}
    stage.onpointerup=()=>finish();stage.onpointercancel=()=>finish(true);
    stage.ondblclick=e=>{const el=e.target.closest('[data-template-node]');if(!el)return;select(el.dataset.templateNode);const input=$('template-fields').querySelector('[data-template-prop=text],[data-template-prop=cells]');input?.focus();input?.select();};
    function keys(e){
      if(e.isComposing)return;const editing=e.target.matches('input,textarea,select');
      if(drag&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true);return;}
      if(editing)return;const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
      if(mod&&['z','y','d'].includes(key)){e.preventDefault();e.stopPropagation();action(key==='d'?'duplicate':key==='y'||e.shiftKey?'redo':'undo');}
      else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();action('delete');}
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected.size){e.preventDefault();checkpoint();const d=e.shiftKey?10:1;items().forEach(n=>{n.x+=(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0);n.y+=(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0);});refresh();}
    }
    const observer=new ResizeObserver(()=>draw(true));observer.observe(stage);$('dialog').addEventListener('close',cleanup);$('dialog').addEventListener('keydown',keys);refresh(true);
  }
  global.StudioTemplateEditor={open};
})(globalThis);
