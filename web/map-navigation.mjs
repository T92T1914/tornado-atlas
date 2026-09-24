import {constrainView, zoomView, panView, wheelFactor} from './map-navigation-model.mjs';

export function mountMapNavigation(svg, {extent, minWidth = extent[2] / 16, getView, setView}) {
  svg.classList.add('explorable-map');
  svg.setAttribute('tabindex', '0');
  for(const path of svg.querySelectorAll('.map-path,.map-outline')) {
    const casing=document.createElementNS(svg.namespaceURI,'path');
    casing.setAttribute('d',path.getAttribute('d'));
    casing.setAttribute('class',path.classList.contains('map-path')?'map-path-casing':'map-outline-casing');
    casing.setAttribute('aria-hidden','true');path.before(casing);
  }
  const read = getView || (() => svg.getAttribute('viewBox').split(/\s+/).map(Number));
  const write = view => {
    const next = constrainView(view, extent, minWidth);
    if (setView) setView(next); else svg.setAttribute('viewBox', next.join(' '));
    const scale=next[2]/(svg.clientWidth || extent[2]);
    for(const element of svg.querySelectorAll('[data-map-radius]')) element.setAttribute('r',Number(element.dataset.mapRadius)*scale);
    for(const element of svg.querySelectorAll('[data-map-symbol]')) {
      const [x,y,size]=element.dataset.mapSymbol.split(',').map(Number),r=size*scale;
      element.setAttribute('d',`M ${x} ${y-r} l ${r} ${r} l ${-r} ${r} l ${-r} ${-r} Z`);
    }
    for(const element of svg.querySelectorAll('[data-map-label]')) {
      const [x,y]=element.dataset.mapLabel.split(',').map(Number);
      element.setAttribute('x',x);element.setAttribute('y',y-14*scale);
      element.setAttribute('font-size',10*scale);
      element.style.strokeWidth=2.5*scale;
    }
    svg.dispatchEvent(new CustomEvent('mapviewchange', {detail:next}));
  };
  const point = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
  const center = () => {const [x,y,w,h] = read(); return [x+w/2, y+h/2];};
  const zoom = (factor, anchor = center()) => write(zoomView(read(), factor, anchor, extent, minWidth));
  const reset = () => write(extent);
  const centerOn = ([x,y]) => {const view=read();write([x-view[2]/2,y-view[3]/2,view[2],view[3]]);};
  for(const element of svg.querySelectorAll('.map-position,.selected-halo,.selected-core,.survey-selected')) element.dataset.mapRadius=element.getAttribute('r');
  // Keep points readable on a narrow screen as well as after zooming.
  const resize=new ResizeObserver(()=>write(read()));resize.observe(svg);
  svg.addEventListener('wheel', event => {
    // Leave browser accessibility zoom (Ctrl + wheel) available.
    if (event.ctrlKey) return;
    event.preventDefault();
    const p=point(event.clientX,event.clientY);
    zoom(wheelFactor(event.deltaY,event.deltaMode,svg.clientHeight),[p.x,p.y]);
  }, {passive:false});
  svg.addEventListener('keydown', event => {
    if (event.target !== svg) return;
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if (directions[event.key]) {
      event.preventDefault();const v=read(),d=directions[event.key];
      write([v[0]+d[0]*v[2]*.15,v[1]+d[1]*v[3]*.15,v[2],v[3]]);
    } else if (['+','=','-','Home'].includes(event.key)) {
      event.preventDefault();if(event.key==='Home') reset();else zoom(event.key==='-'?1.4:1/1.4);
    }
  });
  const pointers=new Map(); let gesture=null, suppressClick=false;
  const geometry = () => {
    const points=[...pointers.values()];
    return points.length>1 ? {x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2,
      distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)} : {...points[0],distance:0};
  };
  const begin = () => {
    if (!pointers.size) {gesture=null;svg.classList.remove('is-dragging');return;}
    const g=geometry();gesture={...g,view:[...read()],inverse:svg.getScreenCTM().inverse(),moved:suppressClick};
  };
  svg.addEventListener('pointerdown', event => {
    if (event.button!==0) return;
    if (!pointers.size) suppressClick=false;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});begin();
    if (pointers.size>1) suppressClick=true;
  });
  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const g=geometry();
    if (!gesture.moved && Math.hypot(g.x-gesture.x,g.y-gesture.y)<5
        && Math.abs(g.distance-gesture.distance)<5) return;
    gesture.moved=true;suppressClick=true;svg.classList.add('is-dragging');
    if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
    const from=new DOMPoint(gesture.x,gesture.y).matrixTransform(gesture.inverse);
    const to=new DOMPoint(g.x,g.y).matrixTransform(gesture.inverse);
    const factor=g.distance>0 && gesture.distance>0 ? gesture.distance/g.distance : 1;
    const zoomed=zoomView(gesture.view,factor,[from.x,from.y],extent,minWidth);
    const ratio=zoomed[2]/gesture.view[2];
    write(panView(zoomed,[(to.x-from.x)*ratio,(to.y-from.y)*ratio],extent,minWidth));
  });
  const end = event => {if(pointers.delete(event.pointerId)) begin();};
  for (const event of ['pointerup','pointercancel','lostpointercapture']) svg.addEventListener(event,end);
  // A pointer released outside the SVG before capture must not leave a drag armed.
  window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  svg.addEventListener('click', event => {
    if (suppressClick && event.detail!==0) {event.preventDefault();event.stopImmediatePropagation();}
    suppressClick=false;
  }, true);
  return {zoom,reset,centerOn,read,minWidth};
}
