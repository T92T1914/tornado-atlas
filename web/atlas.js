import {filterRecords,yearCoverage} from './atlas-model.mjs';
import {readExplorerLink,writeExplorerLink,positionStatus,usablePoints,inside} from './explorer-model.mjs';
import {mountExplorerMap} from './explorer-map.mjs';
import {mountPhotoViewer} from './photo-view.mjs';

const el=id=>document.getElementById(id);
const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function anchor(text,href,className){const node=make('a',text,className),url=new URL(href,location.href);if(!['https:','http:'].includes(url.protocol))throw Error('Unsupported source link');node.href=url.href;if(url.origin!==location.origin){node.target='_blank';node.rel='noopener noreferrer';}return node;}
function button(text,action){const node=make('button',text);node.type='button';node.addEventListener('click',action);return node;}
async function json(path){const response=await fetch(path);if(!response.ok)throw Error('Could not load '+path);return response.json();}
function option(select,value,text=value){const node=make('option',text);node.value=value;select.append(node);}
function dateLabel(date){if(!date)return 'Date not reported';return new Intl.DateTimeFormat('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));}
const openPhoto=mountPhotoViewer();
// Selection recovery must not erase an unrelated collection or media failure.
const recordError=make('p');recordError.id='record-error';recordError.setAttribute('role','alert');recordError.hidden=true;el('filters').after(recordError);
let mapUI=null,selected=null,mediaId='',restoring=true,movingSelection=false,restoreGeneration=0,area=null,group=null,records=[],matches=[],filtered=[],page=0,request=0,timer=null;
let byId=new Map(),media={records:{}},mediaAvailable=true,detailCache=new Map();
const pageSize=20,layout=document.querySelector('.atlas-layout');
function viewMode(mode){layout.dataset.mobileView=mode;for(const name of ['map','list','detail'])el('show-'+name).setAttribute('aria-pressed',String(name===mode));if(mode==='list'){el('browse').hidden=false;el('selected-panel').hidden=true;}if(mode==='detail'&&selected){el('browse').hidden=true;el('selected-panel').hidden=false;}if(mode==='map')mapUI?.resize();}
function filters(){return {query:el('query').value,year:el('year').value,rating:el('rating').value,state:el('state').value,exhibits:el('exhibits').checked};}
function sync({push=false}={}){
  if(restoring)return;
  const href=location.pathname+writeExplorerLink({filters:filters(),recordId:selected?.id,view:mapUI?.view(),area,layer:el('layer').value,media:mediaId,quality:el('quality').value,hasMedia:el('has-media').checked});
  el('search-link').href=href;
  if(href!==location.pathname+location.search+location.hash)history[push?'pushState':'replaceState'](null,'',href);
}
function currentList(){return group?matches.filter(r=>group.has(r.id)):matches;}
function renderResults(){
  const list=currentList(),fragment=document.createDocumentFragment();
  page=Math.min(page,Math.max(0,Math.ceil(list.length/pageSize)-1));
  for(const record of list.slice(page*pageSize,(page+1)*pageSize)){
    const node=button('',()=>selectRecord(record,{center:true}));node.className='result-button';node.dataset.record=record.id;node.setAttribute('aria-pressed',String(selected?.id===record.id));
    node.append(make('span',record.rating||'Unrated','result-rating'),make('strong',record.title),make('small',dateLabel(record.date)));
    if(record.aliases.length)node.append(make('small',record.aliases[0]));
    node.append(make('small',record.id));
    const badges=[];if(record.exhibit)badges.push('Reviewed exhibit');if(media.records[record.id])badges.push('Event photographs');
    if(positionStatus(record)!=='reported')badges.push(positionStatus(record)==='missing'?'No map position':'Disputed position');
    if(badges.length)node.append(make('small',badges.join(' · ')));
    fragment.append(node);
  }
  if(!list.length)fragment.append(make('p','No records match. Remove a filter or leave the area search to browse more of the collection.','empty-state'));
  el('results').replaceChildren(fragment);
  el('results-count').textContent=group?`${list.length.toLocaleString()} in this group / ${matches.length.toLocaleString()} results`:`${matches.length.toLocaleString()} results${area?' in selected area / '+filtered.length.toLocaleString()+' across collection':''}`;
  el('browse-note').textContent=group?'Temporary map group. Shared links retain the filters and selection, not this group.':area?'Area search stays fixed until you choose Search this area again.':'Browse the full filtered collection. Panning alone does not change these results.';
  el('clear-group').hidden=!group;
  el('page-count').textContent=list.length?`${page*pageSize+1}-${Math.min((page+1)*pageSize,list.length)} of ${list.length.toLocaleString()}`:'0 records';
  el('prev-page').disabled=page===0;el('next-page').disabled=(page+1)*pageSize>=list.length;
  const index=list.findIndex(r=>r.id===selected?.id);el('prev-record').disabled=index<=0;el('next-record').disabled=index<0||index>=list.length-1;
}
function activeFilters(){
  const host=el('active-filters');host.replaceChildren();
  for(const [id,label] of [['query','Search'],['year','Year'],['state','State'],['rating','Rating'],['quality','Location']])if(el(id).value)host.append(button(`${label}: ${el(id).value} ×`,()=>{el(id).value='';applyFilters({push:true});}));
  for(const [id,label] of [['exhibits','Reviewed exhibits'],['has-media','Event photographs']])if(el(id).checked)host.append(button(label+' ×',()=>{el(id).checked=false;applyFilters({push:true});}));
  if(area)host.append(button('Selected map area ×',()=>{area=null;applyFilters({push:true});}));
}
function applyFilters({push=false}={}){
  group=null;page=0;
  filtered=filterRecords(records,filters()).filter(r=>(!el('quality').value||positionStatus(r)===el('quality').value)&&(!el('has-media').checked||media.records[r.id]));
  matches=area?filtered.filter(r=>positionStatus(r)==='reported'&&inside(r.point,area)):filtered;
  const notice=el('outside-filter-notice');if(notice)notice.hidden=matches.some(r=>r.id===selected?.id);
  mapUI?.setRecords(matches);renderResults();activeFilters();el('clear-area').hidden=!area;
  el('fit').disabled=!usablePoints(matches).length;
  if(!restoring)viewMode('list');sync({push});
}
function datum(list,label,value){list.append(make('dt',label),make('dd',value===null||value===undefined?'Not reported':String(value)));}
function showMedia(photo,{push=true}={}){mediaId=photo.id;openPhoto(photo);sync({push});}
function mediaPanel(record){
  const collection=media.records[record.id];if(!collection)return make('p','No reviewed photographs are linked to this source record. Its original source remains available below.');
  const section=make('section');section.append(make('h3','Event photographs'),make('p',collection.scope));
  const strip=make('div',undefined,'photo-strip');
  collection.photos.forEach((photo,index)=>{const node=button(`${index+1}. ${photo.title}`,()=>showMedia(photo));node.dataset.photo=photo.id;const image=make('img');image.alt=photo.alt;image.loading='lazy';image.src=photo.asset;image.addEventListener('error',()=>{image.remove();},{once:true});node.prepend(image);strip.append(node);});
  section.append(strip);return section;
}
async function selectRecord(record,{center=false,push=true,focus=true}={}){
  if(!record)return;
  recordError.hidden=true;
  if(el('photo-dialog').open)el('photo-dialog').close();
  selected=record;mediaId='';const token=++request;
  el('show-detail').disabled=false;el('center-selected').hidden=!record.point;
  mapUI?.select(record);
  movingSelection=true;
  try{if(center&&positionStatus(record)==='reported')mapUI?.center(record);}finally{movingSelection=false;}
  renderResults();viewMode('detail');sync({push});
  const panel=el('detail');panel.replaceChildren(make('span',record.id,'eyebrow'),make('h2',record.title),make('p','Loading source account...'));
  if(focus)panel.focus({preventScroll:true});
  try{
    if(!detailCache.has(record.detail_file))detailCache.set(record.detail_file,json('catalogue/'+record.detail_file).catch(error=>{detailCache.delete(record.detail_file);throw error;}));
    const file=await detailCache.get(record.detail_file);if(token!==request)return;
    const detail=file[record.id];if(!detail||detail.id!==record.id)throw Error('The detail file does not contain the selected source ID.');
    panel.replaceChildren(make('span',record.id,'eyebrow'),make('h2',record.title),make('p',`${dateLabel(record.date)} · Reported ${record.rating||'unrated'}`,'record-date'));
    if(record.aliases.length)panel.append(make('p',record.aliases.join(' · ')));
    panel.append(make('p','NOAA source record. It may describe one segment of a longer tornado.'));
    const notice=make('p','This selected record is outside the current filters. Clear filters to include it.','location-warning');
    notice.id='outside-filter-notice';notice.hidden=matches.some(r=>r.id===record.id);panel.append(notice);
    if(detail.location_review)panel.append(make('p',detail.location_review.reason+' The disputed start is excluded from ordinary groups and fitted views.','location-warning'));
    else if(positionStatus(record)==='missing')panel.append(make('p','No usable reported position is available. The record remains in the collection.','location-warning'));
    else panel.append(make('p',`${record.point[1]}, ${record.point[0]} · ${record.point_basis==='reported_end_only'?'Reported end only. The start is unavailable.':'Reported start, not an independently verified camera or damage location.'}`));
    panel.append(make('p',`${record.local_time||'Time unknown'} ${record.zone||''}. Source time label retained. Daylight time is not silently substituted.`));
    panel.append(anchor('Read the original NOAA source file',detail.provenance.source_url,'source-link'));
    const actions=make('div',undefined,'detail-actions');
    if(record.exhibit)actions.append(anchor('Open reviewed exhibit',record.exhibit));
    if(record.point)actions.append(button(detail.location_review?'Show disputed reported position':'Center this record',()=>{mapUI?.center(record);viewMode('map');sync();}));
    actions.append(anchor('Link to this record',el('search-link').href));panel.append(actions);
    if(detail.narrative)panel.append(make('h3','From the source account'),make('p',detail.narrative.split('||')[0],'source-narrative'));
    panel.append(mediaPanel(record));
    if(detail.narrative){const account=make('details');account.append(make('summary','Read the complete source account'),make('p',detail.narrative,'source-narrative'));panel.append(account);}
    const source=make('details');source.append(make('summary','Source details, measurements and provenance'));
    const fields=make('dl');datum(fields,'Source ID',record.id);datum(fields,'Original place label',record.title);datum(fields,'County / area',record.area);
    datum(fields,'Reported start',detail.spatial.begin_point?.join(', '));datum(fields,'Reported end',detail.spatial.end_point?.join(', '));datum(fields,'Coordinate order','Longitude, latitude');
    datum(fields,'Reported source time',detail.time.begin.reported);datum(fields,'Source time zone',record.zone);
    datum(fields,'Reported length, miles',detail.dimensions.reported_length_miles);datum(fields,'Reported width, yards (not funnel width)',detail.dimensions.reported_width_yards);
    datum(fields,'Direct deaths in this source record',detail.impacts.deaths_direct);datum(fields,'Direct injuries in this source record',detail.impacts.injuries_direct);
    datum(fields,'Property damage, source amount',detail.impacts.property_damage.reported);datum(fields,'Source revision',detail.provenance.snapshot_id);datum(fields,'CSV logical record',detail.provenance.csv_record);datum(fields,'Retrieved',detail.provenance.retrieved_at);
    source.append(fields);for(const note of detail.quality_notes)source.append(make('p',note.replaceAll('_',' ')));
    if(!detail.quality_notes.length)source.append(make('p','No parser flags. This is not a certification of historical accuracy.'));
    if(detail.curation)source.append(make('p',detail.curation.basis));
    panel.append(source);
  }catch(error){if(token!==request)return;panel.append(make('p',error.message),button('Retry this record',()=>selectRecord(record,{push:false})));}
}
function clearSelection(){request++;selected=null;mediaId='';recordError.hidden=true;mapUI?.select(null);el('show-detail').disabled=true;el('center-selected').hidden=true;if(el('photo-dialog').open)el('photo-dialog').close();}
async function restore(){
  const generation=++restoreGeneration;
  restoring=true;clearTimeout(timer);
  const state=readExplorerLink(location.search,location.hash);
  for(const id of ['year','rating','state']){
    const select=el(id);select.querySelectorAll('[data-unavailable]').forEach(n=>n.remove());
    if(state.filters[id]&&![...select.options].some(n=>n.value===state.filters[id])){option(select,state.filters[id],'Unavailable: '+state.filters[id]);select.lastElementChild.dataset.unavailable='true';}
    select.value=state.filters[id];
  }
  el('query').value=state.filters.query;el('exhibits').checked=state.filters.exhibits;el('quality').value=state.quality;el('has-media').checked=state.hasMedia&&mediaAvailable;el('layer').value=state.layer;area=state.area;
  clearSelection();applyFilters();mapUI?.setLayer(state.layer);
  if(state.view)mapUI?.setView(state.view);else if(state.filters.query||state.filters.state||state.filters.year)mapUI?.fit(matches);else mapUI?.region('mainland');
  let selectionTask=null;
  if(state.recordId&&byId.has(state.recordId)){
    selectionTask=selectRecord(byId.get(state.recordId),{push:false,focus:false});
  }else{viewMode('map');el('browse').hidden=false;el('selected-panel').hidden=true;if(state.recordId){recordError.hidden=false;recordError.textContent='That source ID is not in this catalogue. Your search still applies.';}}
  restoring=false;sync();
  // Release the history guard before fetching details. A reader can choose
  // another record while this response is still in flight.
  if(selectionTask){
    await selectionTask;
    if(generation!==restoreGeneration||selected?.id!==state.recordId)return;
    const photo=media.records[state.recordId]?.photos.find(p=>p.id===state.media);if(photo)showMedia(photo,{push:false});
  }
}
async function main(){
  const getCatalogue=async()=>{if(typeof DecompressionStream!=='undefined')try{const response=await fetch('catalogue/index.json.gz');if(response.ok)return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();}catch{}return json('catalogue/index.json');};
  const catalogue=await getCatalogue();records=catalogue.records;byId=new Map(records.map(r=>[r.id,r]));
  try{media=await json('catalogue/media.json');}catch{mediaAvailable=false;el('error').hidden=false;el('error').textContent='Photograph links could not load. The photograph filter is unavailable. Source records remain available. Reload to retry.';el('has-media').disabled=true;}
  el('coverage').textContent=`${records.length.toLocaleString()} NOAA source records · US ${yearCoverage(Object.keys(catalogue.coverage.by_year))} · Includes tornado segments`;
  Object.keys(catalogue.coverage.by_year).sort().forEach(year=>option(el('year'),year));
  [...new Set(records.map(r=>r.state).filter(Boolean))].sort().forEach(state=>option(el('state'),state));
  [...new Set(records.map(r=>r.rating).filter(r=>/^(EF|F)[0-5]$/.test(r||'')))].sort().forEach(r=>option(el('rating'),r));option(el('rating'),'unrated','Unrated / other');
  try{mapUI=mountExplorerMap(el('world-map'),{onSelect:r=>selectRecord(r),onGroup:rows=>{group=new Set(rows.map(r=>r.id));page=0;renderResults();viewMode('list');mapUI.fit(rows);},onView:()=>{if(mapUI&&!movingSelection)sync();},onCount:s=>{el('map-count').textContent=`${s.visible.toLocaleString()} in view · ${s.missing.toLocaleString()} missing · ${s.disputed.toLocaleString()} disputed`;},onStatus:text=>{el('map-status').textContent=text;}});mapUI.setView([38,-97,4]);}catch(error){el('map-status').textContent=error.message;}
  for(const id of ['query','year','rating','state','quality','exhibits','has-media'])el(id).addEventListener(id==='query'?'input':'change',()=>{clearTimeout(timer);if(id==='query')timer=setTimeout(()=>applyFilters(),180);else applyFilters({push:true});});
  el('filters').addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);el('advanced').open=false;applyFilters({push:true});mapUI?.fit(matches);});
  el('advanced').addEventListener('keydown',event=>{if(event.key==='Escape'){el('advanced').open=false;el('advanced').querySelector('summary').focus();}});
  el('filters').addEventListener('reset',event=>{event.preventDefault();clearTimeout(timer);for(const id of ['query','year','rating','state','quality'])el(id).value='';el('exhibits').checked=false;el('has-media').checked=false;area=null;clearSelection();applyFilters({push:true});});
  el('clear-group').onclick=()=>{group=null;page=0;renderResults();};
  el('prev-page').onclick=()=>{page--;renderResults();el('results').firstElementChild?.focus();};el('next-page').onclick=()=>{page++;renderResults();el('results').firstElementChild?.focus();};
  for(const [id,delta] of [['prev-record',-1],['next-record',1]])el(id).onclick=()=>{const list=currentList(),index=list.findIndex(r=>r.id===selected?.id);selectRecord(list[index+delta]);};
  el('back-list').onclick=()=>{viewMode('list');el('results').querySelector(`[data-record="${selected?.id}"]`)?.focus();};
  for(const mode of ['map','list','detail'])el('show-'+mode).onclick=()=>viewMode(mode);
  el('fit').onclick=()=>mapUI?.fit(matches);el('zoom-in').onclick=()=>mapUI?.zoom(1);el('zoom-out').onclick=()=>mapUI?.zoom(-1);
  el('search-area').onclick=()=>{area=mapUI?.area()||null;applyFilters({push:true});};el('clear-area').onclick=()=>{area=null;applyFilters({push:true});};
  el('center-selected').onclick=()=>{mapUI?.center(selected);viewMode('detail');};
  el('region').onchange=()=>{const region=el('region').value;if(region==='all')mapUI?.fit(records);else mapUI?.region(region);};
  el('layer').onchange=()=>{mapUI?.setLayer(el('layer').value);sync({push:true});};el('retry-map').onclick=()=>mapUI?.retry();
  el('expand-map').onclick=()=>{const expanded=layout.classList.toggle('expanded');el('expand-map').setAttribute('aria-pressed',String(expanded));el('expand-map').textContent=expanded?'Restore panels':'Expand map';mapUI?.resize();};
  el('map-drag').onchange=()=>mapUI?.interactive(el('map-drag').checked);
  el('copy-link').onclick=async()=>{sync();try{await navigator.clipboard.writeText(el('search-link').href);el('share-status').textContent='Link copied.';}catch{el('share-status').textContent='Copy unavailable. Use the Link to this view link.';}};
  const controls=make('div',undefined,'attachment-controls');controls.append(button('Previous photograph',()=>stepPhoto(-1)),make('span',undefined,'photo-count'),button('Next photograph',()=>stepPhoto(1)));el('photo-caption').before(controls);
  function stepPhoto(delta){const photos=media.records[selected?.id]?.photos||[],index=photos.findIndex(p=>p.id===mediaId);const photo=photos[index+delta];if(photo){showMedia(photo);updatePhotoControls();}}
  function updatePhotoControls(){const photos=media.records[selected?.id]?.photos||[],index=photos.findIndex(p=>p.id===mediaId);controls.querySelector('span').textContent=`Photograph ${index+1} of ${photos.length}`;controls.firstElementChild.disabled=index<=0;controls.lastElementChild.disabled=index>=photos.length-1;}
  new MutationObserver(updatePhotoControls).observe(el('photo-title'),{childList:true});
  el('photo-dialog').addEventListener('close',()=>{if(!el('photo-dialog').open){mediaId='';sync();}});
  window.addEventListener('popstate',restore);
  window.addEventListener('hashchange',()=>{if(!location.hash||location.hash.startsWith('#record='))restore();});
  await restore();performance.mark('atlas-ready');document.body.dataset.ready='true';
}
main().catch(error=>{el('error').hidden=false;el('error').textContent=error.message+'. You can still open the museum chapters.';el('retry-catalogue').hidden=false;el('retry-catalogue').onclick=()=>location.reload();});
