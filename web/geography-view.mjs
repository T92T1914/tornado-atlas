import {inverseProjection,geographicBounds,basemapRequest} from './geography-model.mjs';
export function mountGeography(svg,project,host) {
  const ns='http://www.w3.org/2000/svg',unproject=inverseProjection(project);
  const layer=document.createElementNS(ns,'g');layer.classList.add('basemap-layer');layer.setAttribute('aria-hidden','true');svg.prepend(layer);
  const controls=document.createElement('div');controls.className='geography-controls';
  const label=document.createElement('label');label.textContent='Geography beneath the path ';
  const select=document.createElement('select');select.id=svg.id+'-geography';
  for(const [value,text] of [['streets','Roads and towns · modern USGS map'],['terrain','Terrain · modern shaded relief'],['none','Historical evidence only']]) {
    const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
  }
  label.append(select);controls.append(label);
  const note=document.createElement('p');note.className='fineprint';note.textContent='Modern reference geography, not a reconstruction of roads or buildings in May 2013. Labels and terrain come from USGS The National Map. ';
  const source=document.createElement('a');source.href='https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer';source.textContent='Map sources and attribution';source.target='_blank';source.rel='noopener';note.append(source);
  const status=document.createElement('p');status.className='fineprint';status.setAttribute('role','status');controls.append(note,status);host.prepend(controls);
  let timer=null,controller=null,generation=0,visible=false;
  async function refresh() {
    clearTimeout(timer);controller?.abort();const token=++generation;
    if(select.value==='none') {layer.replaceChildren();svg.classList.remove('has-basemap');status.textContent='Reference geography hidden.';return;}
    if(!visible) return;
    controller=new AbortController();const requestController=controller,timeout=setTimeout(()=>requestController.abort(),15000);
    status.textContent='Loading USGS reference geography…';
    try {
      const b=svg.viewBox.baseVal,view=[b.x,b.y,b.width,b.height];
      const response=await fetch(basemapRequest(select.value,geographicBounds(view,unproject)),{signal:controller.signal});
      if(!response.ok) throw new Error('Map response failed');
      const data=await response.json();
      if(data.error || !data.href || !data.extent) throw new Error('Map service unavailable');
      const u=new URL(data.href);if(u.protocol!=='https:' || u.hostname!=='basemap.nationalmap.gov') throw new Error('Unexpected map image source');
      const e=data.extent,[x,y]=project([e.xmin,e.ymax]),[right,bottom]=project([e.xmax,e.ymin]);
      const img=document.createElementNS(ns,'image');
      for(const [k,v] of Object.entries({x,y,width:right-x,height:bottom-y,preserveAspectRatio:'none',href:u.href})) img.setAttribute(k,v);
      const imageTimeout=setTimeout(()=>{img.remove();if(token===generation)status.textContent='USGS imagery timed out. Historical evidence remains available; change the layer to retry.';},15000);
      img.addEventListener('load',()=>{clearTimeout(imageTimeout);if(token!==generation){img.remove();return;}layer.replaceChildren(img);img.style.removeProperty('visibility');svg.classList.add('has-basemap');status.textContent='Modern USGS geography loaded. Historical path and observations remain separate overlays.';},{once:true});
      img.addEventListener('error',()=>{clearTimeout(imageTimeout);img.remove();if(token!==generation)return;status.textContent='USGS imagery unavailable. The historical evidence map still works.';},{once:true});
      // Keep the preceding image visible until the new one has loaded.
      if(token===generation) {img.style.visibility='hidden';layer.append(img);} else clearTimeout(imageTimeout);
    } catch(error) {
      if(token!==generation)return;
      status.textContent='USGS geography could not be loaded. Historical evidence remains available; change the layer to retry.';
    } finally {clearTimeout(timeout);}
  }
  select.addEventListener('change',refresh);
  svg.addEventListener('mapviewchange',()=>{clearTimeout(timer);controller?.abort();generation++;timer=setTimeout(refresh,350);});
  const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting&&!visible){visible=true;refresh();}},{rootMargin:'200px'});observer.observe(svg);
}
