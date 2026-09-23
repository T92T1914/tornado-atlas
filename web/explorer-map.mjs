import {screenGroups,compactCount,usablePoints,positionStatus} from './explorer-model.mjs';

export function mountExplorerMap(host,{onSelect,onGroup,onView,onCount,onStatus}) {
  const L=window.L;
  if(!L) throw new Error('Map controls could not load. Use the record list.');
  const map=L.map(host,{minZoom:0,maxZoom:16,zoomControl:false,zoomSnap:.25,
    worldCopyJump:false,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1,
    zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,inertia:false,
    scrollWheelZoom:!matchMedia('(pointer:coarse)').matches,
    dragging:!matchMedia('(max-width:760px)').matches});
  // Leaflet's keyboard handler uses panBy without animation options. Apply
  // the reader's motion preference at that public API boundary as well.
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)'),panBy=map.panBy;
  map.panBy=function(offset,options){return panBy.call(this,offset,reducedMotion.matches?{...options,animate:false}:options);};
  host.setAttribute('aria-label','Source record map. Arrow keys pan. Plus and minus zoom. Use the result list to choose a record.');
  L.control.scale({imperial:true,metric:true}).addTo(map);
  map.attributionControl.setPrefix('Leaflet');
  map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a> | NOAA records');
  const markers=L.layerGroup().addTo(map),selection=L.layerGroup().addTo(map);
  let records=[],selected=null,revealDisputed=false,tiles=null,layer='local',tileGeneration=0,cancelTileWait=()=>{};
  const narrow=matchMedia('(max-width:760px)');
  let explicitDragging=null;
  narrow.addEventListener('change',()=>{
    if(explicitDragging===null){if(narrow.matches)map.dragging.disable();else map.dragging.enable();}
  });
  map.createPane('localGeography');map.getPane('localGeography').style.zIndex=150;
  fetch('land.json').then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>{
    L.geoJSON(data,{pane:'localGeography',interactive:false,style:{className:'context-land',weight:1}}).addTo(map);
  }).catch(()=>onStatus('Local geography unavailable. Records remain available in the list.'));

  function renderSelection() {
    selection.clearLayers();
    if(!selected?.point)return;
    const disputed=positionStatus(selected)==='disputed';
    if(disputed&&!revealDisputed)return;
    L.circleMarker([selected.point[1],selected.point[0]],{radius:15,weight:3,fill:false,
      className:disputed?'map-selected disputed':'map-selected',interactive:false}).addTo(selection);
    if(disputed) L.marker([selected.point[1],selected.point[0]],{keyboard:false,
      icon:L.divIcon({className:'disputed-pin',html:'?',iconSize:[24,24],iconAnchor:[12,12]})})
      .bindTooltip('Disputed reported position. No corrected location established.').addTo(selection);
  }
  function render() {
    markers.clearLayers();
    const bounds=map.getPixelBounds(),zoom=map.getZoom();
    const summary=screenGroups(records,point=>{const p=map.project([point[1],point[0]],zoom);return [p.x,p.y];},
      [bounds.min.x,bounds.min.y,bounds.max.x,bounds.max.y],72);
    for(const group of summary.groups) {
      const count=group.records.length,single=count===1,record=group.records[0];
      const label=single?`${record.title}, ${record.date||'date unknown'}, ${record.rating||'unrated'}`:`${count.toLocaleString()} source records. Select to browse this group.`;
      const content=document.createElement('span');content.textContent=single?'':compactCount(count);
      // A group symbol sits at its grid-cell center. Individual records retain
      // their exact reported coordinate when opened or displayed alone.
      const point=single ? [record.point[1],record.point[0]] : map.unproject(group.anchor,zoom);
      const marker=L.marker(point,{keyboard:false,title:label,icon:L.divIcon({
        className:single?'catalogue-pin':'catalogue-cluster',html:content,iconSize:single?[16,16]:[44,44]})});
      marker.on('click',()=>single?onSelect(record):onGroup(group.records));
      marker.addTo(markers);
      marker.getElement().setAttribute('aria-label',label);
      marker.getElement().dataset[single?'record':'cluster']=single?record.id:String(count);
    }
    onCount(summary);renderSelection();
  }
  map.on('moveend',()=>{render();onView();});
  function setLayer(mode) {
    tileGeneration++;const token=tileGeneration;cancelTileWait();
    if(tiles){tiles.remove();tiles=null;}
    layer=mode;
    if(mode==='local'){onStatus('Local overview geography. Roads and detailed place labels are available in the USGS layer.');return;}
    const service=mode==='terrain'?'USGSShadedReliefOnly':'USGSTopo';
    const current=L.tileLayer(`https://basemap.nationalmap.gov/arcgis/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,{
      maxNativeZoom:16,maxZoom:16,noWrap:true,keepBuffer:0,updateWhenIdle:true,
      bounds:[[-85.05112878,-180],[85.05112878,180]],
      className:'usgs-tiles',attribution:'<a href="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer">USGS The National Map and contributors</a>'});
    let failed=false;
    let timeout=null;
    cancelTileWait=()=>clearTimeout(timeout);
    const startWait=()=>{clearTimeout(timeout);timeout=setTimeout(fail,15000);};
    function fail(){
      if(token!==tileGeneration||failed)return;
      failed=true;clearTimeout(timeout);current.remove();
      onStatus('USGS map unavailable. Local geography and the record list still work. Use Retry map to try again.');
    }
    current.on('tileerror',fail);
    current.on('loading',startWait);
    current.on('load',()=>{clearTimeout(timeout);if(token===tileGeneration&&!failed)onStatus('Modern USGS reference geography. It does not show conditions on the tornado date.');});
    tiles=current;current.addTo(map);
    onStatus('Loading modern USGS reference geography...');
  }
  // Hidden mobile panels have zero dimensions. Preserve the last useful map
  // size until the panel returns, then keep its geographic center fixed.
  function resizeMap(){if(host.clientWidth&&host.clientHeight)map.invalidateSize({animate:false});}
  const resize=new ResizeObserver(resizeMap);resize.observe(host);
  return {
    setRecords(value){records=value;render();},
    select(record){if(record?.id!==selected?.id)revealDisputed=false;selected=record;renderSelection();},
    setView(view){map.setView([view[0],view[1]],view[2],{animate:false});},
    region(name){
      const areas={mainland:[[24,-125],[50,-66]],alaska:[[51,-180],[72,-129]],hawaii:[[18,-161],[23,-154]],caribbean:[[17.5,-68],[19,-64]],world:[[-60,-180],[80,180]]};
      map.fitBounds(areas[name],{padding:[18,18],animate:false});
    },
    view(){const c=map.getCenter();return [c.lat,c.lng,map.getZoom()];},
    area(){const b=map.getBounds();return [Math.max(-180,b.getWest()),Math.max(-85,b.getSouth()),Math.min(180,b.getEast()),Math.min(85,b.getNorth())];},
    fit(value){const points=usablePoints(value);if(points.length)map.fitBounds(points.map(r=>[r.point[1],r.point[0]]),{padding:[30,30],maxZoom:12,animate:false});},
    center(record){if(record?.point){revealDisputed=positionStatus(record)==='disputed';map.setView([record.point[1],record.point[0]],12,{animate:false});renderSelection();}},
    zoom(delta){map.setZoom(map.getZoom()+delta,{animate:false});},
    setLayer, retry(){setLayer(layer);}, resize:resizeMap,
    interactive(enabled){explicitDragging=enabled;if(enabled)map.dragging.enable();else map.dragging.disable();}
  };
}
