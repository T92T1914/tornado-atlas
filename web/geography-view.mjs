import {inverseProjection,geographicBounds,basemapRasterSize,basemapRequest,basemapImage} from './geography-model.mjs';
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
  const imageSource=document.createElement('a');imageSource.textContent='Open displayed reference image';imageSource.target='_blank';imageSource.rel='noopener';imageSource.hidden=true;
  const imageSourceLine=document.createElement('p');imageSourceLine.append(imageSource);details.append(imageSourceLine);
  const status=document.createElement('p');status.className='fineprint';status.setAttribute('role','status');controls.append(note,status,details);host.prepend(controls);
  let timer=null,controller=null,generation=0,visible=false,displayedMode=null,displayedKey=null,pendingKey=null,cancelImage=()=>{};
  const clear=()=>{layer.replaceChildren();svg.classList.remove('has-basemap');displayedMode=null;displayedKey=null;imageSource.hidden=true;imageSource.href='';};
  const invalidate=()=>{controller?.abort();controller=null;cancelImage();cancelImage=()=>{};pendingKey=null;generation++;};
  function requestFor(mode) {
    // Real hidden elements have zero dimensions. Non-layout fixtures retain
    // the logical viewBox fallback used by the original consumer controls.
    if(svg.clientWidth===0||svg.clientHeight===0)return null;
    const b=svg.viewBox.baseVal,view=[b.x,b.y,b.width,b.height],bounds=geographicBounds(view,unproject);
    const size=basemapRasterSize(bounds,svg.clientWidth||view[2],svg.clientHeight||view[3],globalThis.devicePixelRatio||1);
    return {url:basemapRequest(mode,bounds,size.width),size};
  }
  const loaded=(mode,size)=>{status.textContent=`Modern USGS ${mode==='streets'?'roads and towns':'terrain'} geography loaded.`+(size.capped?' Reference image density is bounded; path overlays remain vector.':'');};
  async function refresh() {
    clearTimeout(timer);timer=null;const mode=select.value;
    note.hidden=mode==='none';
    if(mode==='none') {invalidate();clear();status.textContent='Reference geography hidden. Historical evidence only.';return;}
    if(!visible){invalidate();if(displayedMode!==mode)clear();return;}
    let request;
    try{request=requestFor(mode);}catch(error){invalidate();clear();status.textContent='USGS geography could not be loaded. Historical evidence only; change the layer to retry.';return;}
    if(!request){invalidate();if(displayedMode!==mode)clear();status.textContent='Reference geography waits until the map has a visible size.';return;}
    if(request.url===displayedKey&&displayedMode===mode){invalidate();loaded(mode,request.size);return;}
    if(request.url===pendingKey)return;
    invalidate();if(displayedMode!==mode)clear();const token=generation;pendingKey=request.url;
    controller=new AbortController();const requestController=controller,timeout=setTimeout(()=>requestController.abort(),15000);
    status.textContent='Loading USGS reference geography…';
    try {
      const response=await fetch(request.url,{signal:controller.signal});
      if(!response.ok) throw new Error('Map response failed');
      const data=await response.json();
      if(token!==generation)return;
      const attributes=basemapImage(data,project);
      const img=document.createElementNS(ns,'image');
      for(const [k,v] of Object.entries(attributes)) img.setAttribute(k,v);
      let settled=false;
      const imageTimeout=setTimeout(()=>{settled=true;img.remove();if(token===generation){pendingKey=null;clear();status.textContent='USGS imagery timed out. Historical evidence only; change the layer to retry.';}},15000);
      cancelImage=()=>{settled=true;clearTimeout(imageTimeout);if(img.style.visibility==='hidden')img.remove();};
      img.addEventListener('load',()=>{clearTimeout(imageTimeout);if(settled||token!==generation){img.remove();return;}settled=true;layer.replaceChildren(img);img.style.removeProperty('visibility');displayedMode=mode;displayedKey=request.url;pendingKey=null;imageSource.href=attributes.href;imageSource.hidden=false;svg.classList.add('has-basemap');loaded(mode,request.size);},{once:true});
      img.addEventListener('error',()=>{clearTimeout(imageTimeout);if(settled||token!==generation)return;settled=true;img.remove();pendingKey=null;clear();status.textContent='USGS imagery unavailable. Historical evidence only; change the layer to retry.';},{once:true});
      // Keep the preceding image visible until the new one has loaded.
      if(token===generation) {img.style.visibility='hidden';layer.append(img);} else clearTimeout(imageTimeout);
    } catch(error) {
      if(token!==generation)return;
      pendingKey=null;clear();status.textContent='USGS geography could not be loaded. Historical evidence only; change the layer to retry.';
    } finally {clearTimeout(timeout);}
  }
  select.addEventListener('change',refresh);
  svg.addEventListener('mapviewchange',()=>{
    clearTimeout(timer);timer=null;
    if(select.value==='none'){refresh();return;}
    try{
      const request=requestFor(select.value);
      if(!request){refresh();return;}
      if(request.url===displayedKey&&displayedMode===select.value){refresh();return;}
      if(request.url===pendingKey)return;
    }catch(error){refresh();return;}
    invalidate();timer=setTimeout(refresh,350);
  });
  const watchDensity=()=>{
    const query=globalThis.matchMedia?.(`(resolution:${globalThis.devicePixelRatio||1}dppx)`);
    query?.addEventListener('change',()=>{
      if(svg.clientWidth>0&&svg.clientHeight>0)svg.dispatchEvent(new CustomEvent('mapviewchange'));
      watchDensity();
    },{once:true});
  };
  watchDensity();
  const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!visible){visible=true;refresh();}},{rootMargin:'200px'});observer.observe(svg);
}
