/* Isolated artwork previews. Never mutate the source project or editor selection. */
(function(global){
  'use strict';
    function paint(api,container,project,view=null){
      const {C,escapeHtml:esc}=api;
      if(!container)return;
      const box=C.visualBounds(C.contentNodes(project)),width=container.clientWidth,height=container.clientHeight,padding=container.id==='template-stage'?80:container.classList.contains('shortcut-thumbnail')?10:24;
      const zoom=view?.zoom||Math.max(.01,Math.min(2,(width-padding)/Math.max(1,box.w),(height-padding)/Math.max(1,box.h)));
      view=view||{x:width/2-(box.x+box.w/2)*zoom,y:height/2-(box.y+box.h/2)*zoom,zoom};
      const world=document.createElement('div');world.className='component-preview-world';world.style.transform=`translate(${view.x}px,${view.y}px) scale(${zoom})`;
      const prefix=C.uid('preview');
      function lines(free){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('component-preview-lines');
        svg.innerHTML=project.edges.filter(e=>C.isFreeEdge(e)===free).map((e,i)=>{const mid=C.edgeMidpoint(e,project.nodes),id=prefix+'-'+free+'-'+i;return `<defs><marker id="${id}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="${esc(e.color)}" stroke-width="1.5"/></marker></defs><path data-template-edge="${esc(e.id)}" d="${esc(C.edgePath(e,project.nodes))}" fill="none" stroke="${esc(e.color)}" stroke-width="${e.width}" ${e.dash?'stroke-dasharray="8 6"':''} ${e.arrow?`marker-end="url(#${id})"`:''}/>${e.label?`<text x="${mid.x}" y="${mid.y-10}" text-anchor="middle" fill="${esc(e.color)}" font-size="${e.labelSize}">${esc(e.label)}</text>`:''}`;}).join('');return svg;
      }
      world.append(lines(false));
      for(const node of project.nodes){const el=document.createElement('div');el.className='node type-'+node.type;el.dataset.templateNode=node.id;el.innerHTML='<div class="node-body">'+api.nodeBody(node,project)+'</div>';api.applyNodeStyles(el,node);world.append(el);}
      world.append(lines(true));container.replaceChildren(world);return view;
    }
  global.StudioPreview={paint};
})(window);
