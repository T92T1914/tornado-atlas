import {inverseProjection,geographicBounds,basemapRequest,basemapImage} from './geography-model.mjs';
export function mountGeography(svg,project,host) {
  const ns='http://www.w3.org/2000/svg',unproject=inverseProjection(project);
  const layer=document.createElementNS(ns,'g');layer.classList.add('basemap-layer');layer.setAttribute('aria-hidden','true');svg.prepend(layer);
  // WebKit does not consistently paint CSS filter functions on SVG groups.
  // Native SVG primitives affect only the modern image, never source geometry.
  const defs=document.createElementNS(ns,'defs'),ink=document.createElementNS(ns,'filter');
  ink.setAttribute('id',svg.id+'-reference-ink');ink.setAttribute('color-interpolation-filters','sRGB');
  const gray=document.createElementNS(ns,'feColorMatrix');gray.setAttribute('type','saturate');gray.setAttribute('values','0');ink.append(gray);
  const transfer=document.createElementNS(ns,'feComponentTransfer');
  for(const channel of ['R','G','B']){const fn=document.createElementNS(ns,'feFunc'+channel);fn.setAttribute('type','linear');fn.setAttribute('slope','-0.75');fn.setAttribute('intercept','0.87');transfer.append(fn);}
  ink.append(transfer);defs.append(ink);svg.prepend(defs);layer.setAttribute('filter',`url(#${svg.id}-reference-ink)`);
  const controls=document.createElement('div');controls.className='geography-controls';
  const label=document.createElement('label');label.textContent='Geography beneath the path ';
  const select=document.createElement('select');select.id=svg.id+'-geography';
  for(const [value,text] of [['streets','Roads and towns'],['terrain','Terrain'],['none','Historical evidence only']]) {
    const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
  }
  label.append(select);controls.append(label);
  const note=document.createElement('p');note.className='fineprint geography-note';note.textContent='Modern USGS reference map, not conditions on the tornado date.';
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Map sources and interpretation';details.append(summary);
  const explanation=document.createElement('p');explanation.textContent='Roads, buildings and terrain are modern reference geography from USGS The National Map. The historical outline covers the whole event. The center line interpolates between published observations; it is not the changing funnel boundary. ';
  const source=document.createElement('a');source.href='https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer';source.textContent='USGS sources and attribution';source.target='_blank';source.rel='noopener';explanation.append(source);details.append(explanation);
  const status=document.createElement('p');status.className='fineprint';status.setAttribute('role','status');controls.append(note,status,details);host.prepend(controls);
  let timer=null,controller=null,generation=0,visible=false,displayedMode=null,cancelImage=()=>{};
  const clear=()=>{layer.replaceChildren();svg.classList.remove('has-basemap');displayedMode=null;};
  async function refresh() {
    clearTimeout(timer);controller?.abort();cancelImage();const token=++generation,mode=select.value;
    note.hidden=mode==='none';
    if(mode==='none') {clear();status.textContent='Reference geography hidden. Historical evidence only.';return;}
    if(displayedMode!==mode)clear();
    if(!visible) return;
    controller=new AbortController();const requestController=controller,timeout=setTimeout(()=>requestController.abort(),15000);
    status.textContent='Loading USGS reference geography…';
    try {
      const b=svg.viewBox.baseVal,view=[b.x,b.y,b.width,b.height];
      const response=await fetch(basemapRequest(mode,geographicBounds(view,unproject)),{signal:controller.signal});
      if(!response.ok) throw new Error('Map response failed');
      const data=await response.json();
      if(token!==generation)return;
      const attributes=basemapImage(data,project);
      const img=document.createElementNS(ns,'image');
      for(const [k,v] of Object.entries(attributes)) img.setAttribute(k,v);
      let settled=false;
      const imageTimeout=setTimeout(()=>{settled=true;img.remove();if(token===generation){clear();status.textContent='USGS imagery timed out. Historical evidence only; change the layer to retry.';}},15000);
      cancelImage=()=>{settled=true;clearTimeout(imageTimeout);if(img.style.visibility==='hidden')img.remove();};
      img.addEventListener('load',()=>{clearTimeout(imageTimeout);if(settled||token!==generation){img.remove();return;}settled=true;layer.replaceChildren(img);img.style.removeProperty('visibility');displayedMode=mode;svg.classList.add('has-basemap');status.textContent=`Modern USGS ${mode==='streets'?'roads and towns':'terrain'} geography loaded.`;},{once:true});
      img.addEventListener('error',()=>{clearTimeout(imageTimeout);if(settled||token!==generation)return;settled=true;img.remove();clear();status.textContent='USGS imagery unavailable. Historical evidence only; change the layer to retry.';},{once:true});
      // Keep the preceding image visible until the new one has loaded.
      if(token===generation) {img.style.visibility='hidden';layer.append(img);} else clearTimeout(imageTimeout);
    } catch(error) {
      if(token!==generation)return;
      clear();status.textContent='USGS geography could not be loaded. Historical evidence only; change the layer to retry.';
    } finally {clearTimeout(timeout);}
  }
  select.addEventListener('change',refresh);
  svg.addEventListener('mapviewchange',()=>{clearTimeout(timer);controller?.abort();cancelImage();generation++;timer=setTimeout(refresh,350);});
  const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!visible){visible=true;refresh();}},{rootMargin:'200px'});observer.observe(svg);
}
