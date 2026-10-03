import {classLabels,readCaseLink,writeCaseLink,filterCases,numberLabel,intervalLabel,validDetail,detailPath,boundedComparison} from './jma-model.mjs';

const el=id=>document.getElementById(id);
const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
const japanese=(tag,text)=>{const node=make(tag,text);node.lang='ja';return node;};
const button=(text,action)=>{const node=make('button',text);node.type='button';node.addEventListener('click',action);return node;};
function link(text,href){const node=make('a',text),url=new URL(href,location.href);if(!['https:','http:'].includes(url.protocol))throw Error('Unsupported source link');node.href=url.href;if(url.origin!==location.origin){node.target='_blank';node.rel='noopener noreferrer';}return node;}
function datum(list,label,value){list.append(make('dt',label),make('dd',value));}
function option(select,value,text=value){const node=make('option',text);node.value=value;select.append(node);}
async function json(path){const response=await fetch(path);if(!response.ok)throw Error('Could not load this source file.');return response.json();}
const pageSize=20,cache=new Map();
let catalogue,records=[],byId=new Map(),matches=[],selected=null,selectedDetail=null,linkedCaseId='',comparisonIds=[],comparisonRequest=0,page=0,request=0,panel='list',restoring=false,timer;
const filters=()=>({query:el('case-query').value,classCode:el('case-class').value,rating:el('case-rating').value});
function view(mode){panel=mode;el('case-layout').dataset.panel=mode;el('case-list-view').setAttribute('aria-pressed',String(mode==='list'));el('case-record-view').setAttribute('aria-pressed',String(mode==='detail'));}
function sync(push=false){const href=location.pathname+writeCaseLink({filters:filters(),caseId:linkedCaseId,panel,comparisonIds});el('case-view-link').href=href;if(!restoring&&href!==location.pathname+location.search+location.hash)history[push?'pushState':'replaceState'](null,'',href);}
function navigation(){const index=matches.findIndex(record=>record.id===selected?.id);el('case-previous').disabled=index<=0;el('case-next').disabled=index<0||index>=matches.length-1;const notice=el('case-outside-filters');if(notice)notice.hidden=index>=0;}
function results(){
  const fragment=document.createDocumentFragment();
  page=Math.min(page,Math.max(0,Math.ceil(matches.length/pageSize)-1));
  for(const record of matches.slice(page*pageSize,(page+1)*pageSize)){
    const node=button('',()=>choose(record));node.dataset.case=record.id;node.setAttribute('aria-pressed',String(record.id===selected?.id));
    node.append(japanese('strong',record.title),make('span',(classLabels[record.classification_code]||'Source phenomenon')+' · '+(record.rating||'Rating unresolved')),make('small',record.year+' · '+record.case_id));
    fragment.append(node);
  }
  if(!matches.length)fragment.append(make('p','No source cases match. Change the phenomenon or remove another filter.'));
  el('case-results').replaceChildren(fragment);
  el('case-results-count').textContent=matches.length.toLocaleString()+' matching cases / '+records.length.toLocaleString()+' retained source cases';
  el('case-page-count').textContent=matches.length?(page*pageSize+1)+' to '+Math.min((page+1)*pageSize,matches.length)+' of '+matches.length.toLocaleString():'0 cases';
  el('case-prev-page').disabled=page===0;el('case-next-page').disabled=(page+1)*pageSize>=matches.length;
  navigation();
}
function apply(push=false){page=0;matches=filterCases(records,filters());results();sync(push);}
function section(panel,title,collapsed=false,heading='h3'){const node=make(collapsed?'details':'section');node.append(make(collapsed?'summary':heading,title));const values=make('dl');node.append(values);panel.append(node);return values;}
function calendar(values,title,time){datum(values,title,time.local||time.components.map(numberLabel).join(' / '));datum(values,title+' uncertainty, minus minutes',numberLabel(time.uncertainty_minus_minutes));datum(values,title+' uncertainty, plus minutes',numberLabel(time.uncertainty_plus_minutes));}
function position(values,title,position){
  const fields=position.reported_components;
  datum(values,title+' latitude, degrees / minutes / seconds',[0,1,2].map(i=>numberLabel(fields[i])).join(' / '));
  datum(values,title+' latitude uncertainty, arcseconds',numberLabel(fields[3]));
  datum(values,title+' longitude, degrees / minutes / seconds',[4,5,6].map(i=>numberLabel(fields[i])).join(' / '));
  datum(values,title+' longitude uncertainty, arcseconds',numberLabel(fields[7]));
}
function renderDetail(detail,record,host=el('case-detail'),{comparison=false}={}){
  const fields=(title,collapsed=false)=>section(host,title,collapsed,comparison?'h4':'h3');
  host.replaceChildren(make('span',record.case_id,'eyebrow'),japanese(comparison?'h3':'h2',record.title));
  host.append(make('p',(classLabels[record.classification_code]||'Source phenomenon')+' · '+(record.rating||'Rating unresolved')+' · '+record.year,'jma-source-label'));
  host.append(japanese('p',detail.classification_reported));
  host.append(make('p','Reported beginning: '+(detail.time.begin.local||detail.time.begin.components.map(numberLabel).join(' / '))));
  host.append(make('p','Timezone, coordinate datum and the separate wind unit remain unresolved. Full source fields and uncertainties are available below.','jma-fine'));
  host.append(make('p',detail.confirmed_tornado?'JMA explicitly classifies this source case as a tornado.':'This source case is not counted as an explicitly classified tornado.'));
  if(!comparison){const notice=make('p','This selected case is outside your current filters. Its source details remain available.','jma-warning');notice.id='case-outside-filters';host.append(notice);}
  host.append(link('Read the original JMA case CSV',detail.provenance.source_url));
  const rating=fields('Damage rating');
  datum(rating,'Reported scale',detail.rating.scale||'Unresolved');
  datum(rating,'Minimum category',numberLabel(detail.rating.source_minimum));datum(rating,'Maximum category',numberLabel(detail.rating.source_maximum));
  host.append(make('p','F and JEF are distinct damage scales. This is not a measured wind speed.','jma-fine'));
  const time=fields('Reported calendar and time',true);
  calendar(time,'Beginning',detail.time.begin);calendar(time,'Ending',detail.time.end);
  datum(time,'Timezone','Unresolved in this adapter');datum(time,'UTC conversion','Not performed');
  const coordinates=fields('Reported reference coordinates',true);
  position(coordinates,'Beginning',detail.spatial.begin);position(coordinates,'Ending',detail.spatial.end);
  datum(coordinates,'Coordinate datum','Unresolved in this adapter');
  coordinates.parentElement.append(make('p','These source reference points do not create a surveyed track or an interpolated appearance. They are not placed on an assumed basemap.','jma-fine'));
  const dimensions=fields('Reported damage area');
  datum(dimensions,'Damage width, meters',intervalLabel(detail.dimensions.width_interval));
  datum(dimensions,'Damage length, meters',intervalLabel(detail.dimensions.length_interval));
  datum(dimensions,'Original length values, units of 100 meters',numberLabel(detail.dimensions.length_interval.reported_minimum)+' / '+numberLabel(detail.dimensions.length_interval.reported_maximum));
  host.append(make('p','These damage-area intervals are not visible funnel width. Other gust phenomena can describe damage-area diameters.','jma-fine'));
  const impacts=fields('Reported casualty and building fields',true);
  for(const [name,value] of Object.entries(detail.impacts)){
    const label=japanese('dt',name);const output=make('dd',numberLabel(value.count)+' · Shared-scope source cell: '+(value.shared_scope_reported||'Blank')+'. Not aggregated.');
    impacts.append(label,output);
  }
  impacts.parentElement.append(make('p','Shared-scope cells can contain a flag or a complete associated case ID. No figures on this page are added into an event or national total.','jma-fine'));
  const wind=fields('Separate wind field',true);
  datum(wind,'Original source value',numberLabel(detail.wind.reported));datum(wind,'Unit and measurement basis','Unresolved in this adapter');
  const source=make('details');source.append(make('summary','Case provenance and parser notes'));const provenance=make('dl');source.append(provenance);
  for(const [label,value] of [['Source case ID',detail.source_record_id],['Source snapshot',detail.provenance.snapshot_id],['Original CSV logical record',detail.provenance.csv_record],['Source SHA-256',detail.provenance.sha256],['Retrieved',detail.provenance.retrieved_at],['Revision basis','Observed HTTP Last-Modified, not a publisher-signed release']])datum(provenance,label,String(value));
  source.append(link('Processed detail object',detailPath(record)));
  for(const note of detail.quality_notes)source.append(make('p',note.replaceAll('_',' '),'jma-fine'));
  if(!detail.quality_notes.length)source.append(make('p','No parser flags. This does not certify the historical account.'));
  host.append(source);if(!comparison)navigation();
}
async function loadDetail(record){
  const path=detailPath(record);
  if(!cache.has(path))cache.set(path,json(path).catch(error=>{cache.delete(path);throw error;}));
  const details=await cache.get(path),detail=details?.[record.id];
  if(!validDetail(detail,record,catalogue.source)){cache.delete(path);throw Error('The detail does not match this retained source case.');}
  return detail;
}
function comparisonControl(){
  const included=comparisonIds.includes(selected?.id),full=comparisonIds.length===2;
  el('case-compare-add').disabled=!selectedDetail||included||full;
  el('case-compare-hint').textContent=!selectedDetail?'Choose and load a record to add its retained source details.':
    included?'This record is already in the comparison. Browse another record to choose a second case.':
    full?'Two cases are retained. Remove one from the comparison before adding another.':
    comparisonIds.length?'One case is retained. Add this record to compare their source fields.':'Add this record, then browse another case to compare their source fields.';
}
function setComparison(ids,{focus=false}={}){
  comparisonIds=boundedComparison(ids);renderComparison();sync(true);
  if(focus)(el('case-comparison-cards').firstElementChild||el('case-list-view')).focus();
}
async function renderComparison(){
  const token=++comparisonRequest,host=el('case-comparison-cards');
  el('case-comparison').hidden=!comparisonIds.length;
  el('case-comparison-count').textContent=comparisonIds.length+' of 2 source cases retained. The pair stays available when filters or selected records change.';
  host.replaceChildren();comparisonControl();
  await Promise.all(comparisonIds.map(async id=>{
    const record=byId.get(id),card=make('section',undefined,'jma-comparison-card');
    card.dataset.comparisonCase=id;card.tabIndex=-1;host.append(card);
    const controls=()=>{const actions=make('div',undefined,'jma-comparison-actions');
      actions.append(button('Remove case '+(record?.case_id||id)+' from comparison',()=>setComparison(comparisonIds.filter(value=>value!==id),{focus:true})));
      if(record)actions.append(button('Inspect case '+record.case_id,()=>{choose(record);el('case-panel').scrollIntoView({block:'start'});}));
      return actions;};
    if(!record){card.append(controls(),make('h3',id),make('p','Source case not found in the retained current snapshot. This comparison slot remains visible until you remove it.'));card.dataset.state='unavailable';return;}
    const load=async({keepFocus=false}={})=>{
      if(token!==comparisonRequest)return;
      card.replaceChildren(controls(),japanese('h3',record.title),make('p','Loading the retained source details...'));card.dataset.state='loading';
      if(keepFocus)card.focus({preventScroll:true});
      try{
        const detail=await loadDetail(record);if(token!==comparisonRequest)return;
        renderDetail(detail,record,card,{comparison:true});card.prepend(controls());card.dataset.state='ready';
      }catch(error){
        if(token!==comparisonRequest)return;
        card.append(make('p',error.message,'jma-warning'),button('Retry comparison case '+record.case_id,()=>load({keepFocus:card.contains(document.activeElement)})),link('Original JMA source',catalogue.source.url));card.dataset.state='failed';
      }
    };
    await load();
  }));
}
async function choose(record,{push=true,focus=true,reveal=true}={}){
  selected=record;selectedDetail=null;linkedCaseId=record.id;comparisonControl();el('case-record-view').disabled=false;const token=++request;
  if(reveal)view('detail');results();sync(push);const host=el('case-detail');
  host.replaceChildren(japanese('h2',record.title),make('p','Loading the source case...'));
  if(focus)host.focus({preventScroll:true});
  try{
    const detail=await loadDetail(record);if(token!==request)return;
    renderDetail(detail,record);selectedDetail=detail;comparisonControl();
  }catch(error){
    if(token!==request)return;
    host.append(make('p',error.message,'jma-warning'),button('Retry this case',()=>choose(record,{push:false})),link('Original JMA source',catalogue.source.url));
  }
}
async function restore(){
  const state=readCaseLink(location.search,location.hash);restoring=true;clearTimeout(timer);
  for(const [id,value] of [['case-class',state.filters.classCode],['case-rating',state.filters.rating]]){
    const select=el(id);select.querySelectorAll('[data-unavailable]').forEach(node=>node.remove());
    if(![...select.options].some(node=>node.value===value)){option(select,value,'Unavailable: '+value);select.lastElementChild.dataset.unavailable='true';}
    select.value=value;
  }
  el('case-query').value=state.filters.query;selected=null;selectedDetail=null;linkedCaseId=state.caseId;comparisonIds=state.comparisonIds;request++;el('case-record-view').disabled=true;
  apply();view(state.panel);
  let task=null;
  if(state.caseId&&byId.has(state.caseId)){
    const index=matches.findIndex(record=>record.id===state.caseId);
    if(index>=0)page=Math.floor(index/pageSize);
    task=choose(byId.get(state.caseId),{push:false,focus:false,reveal:state.panel==='detail'});
  }
  else if(state.caseId){el('case-detail').replaceChildren(make('h2','Source case not found.'),make('p','This ID is not in the retained current snapshot. Your filters still apply.'));view('detail');}
  else {view('list');el('case-detail').replaceChildren(make('h2','Choose a source case.'),make('p','Original source classifications and uncertainty remain available.'));}
  const comparisonTask=renderComparison();restoring=false;
  // Canonicalize comparison slots while retaining an unavailable selected ID.
  sync();
  await Promise.all([task,comparisonTask]);
}
async function main(){
  catalogue=await json('jma-cases/index.json');
  if(catalogue.schema_version!==1||catalogue.source?.url!=='https://www.data.jma.go.jp/stats/data/bosai/tornado/data/ichiran.csv'||!Array.isArray(catalogue.records))throw Error('Unsupported JMA source index.');
  records=catalogue.records;byId=new Map(records.map(record=>[record.id,record]));
  if(byId.size!==records.length)throw Error('Duplicate source-case identifiers.');
  for(const record of records){if(!/^jma:[0-9]{10}$/.test(record.id)||typeof record.title!=='string'||record.confirmed_tornado!==(record.classification_code==='1'))throw Error('Unsupported source-case identity.');detailPath(record);}
  el('case-coverage').textContent=records.length.toLocaleString()+' retained source cases · '+catalogue.coverage.classified_tornado_records.toLocaleString()+' explicitly classified tornado records';
  for(const [code,label] of Object.entries(classLabels))if(code!=='1')option(el('case-class'),code,label);
  for(const rating of [...new Set(records.map(record=>record.rating).filter(Boolean))].sort())option(el('case-rating'),rating);
  option(el('case-rating'),'unrated','Unresolved / unreported rating');
  const source=el('case-source-provenance'),data=make('dl');source.append(data);
  for(const [label,value] of [['Source snapshot',catalogue.source.snapshot_id],['Source SHA-256',catalogue.source.sha256],['Retrieved',catalogue.source.retrieved_at],['Observed Last-Modified',catalogue.source.last_modified]])datum(data,label,value);
  source.append(make('p',catalogue.attribution),make('p',catalogue.transformation),make('p','Original raw CSV rows remain in the local archive. The static detail objects contain processed fields and provenance, rather than pretending to be unchanged JMA output.'));
  el('case-filters').addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);view('list');apply(true);});
  el('case-query').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>apply(),180);});
  for(const id of ['case-class','case-rating'])el(id).addEventListener('change',()=>{clearTimeout(timer);apply(true);});
  el('case-filters').addEventListener('reset',event=>{event.preventDefault();clearTimeout(timer);el('case-query').value='';el('case-class').value='1';el('case-rating').value='';apply(true);});
  for(const [id,delta] of [['case-prev-page',-1],['case-next-page',1]])el(id).onclick=()=>{page+=delta;results();el('case-results').firstElementChild?.focus();};
  for(const [id,delta] of [['case-previous',-1],['case-next',1]])el(id).onclick=()=>{const index=matches.findIndex(record=>record.id===selected?.id);const record=matches[index+delta];if(record)choose(record);};
  el('case-back').onclick=()=>{view('list');sync(true);el('case-results').querySelector('[aria-pressed=true]')?.focus();};
  el('case-list-view').onclick=()=>{view('list');sync(true);};
  el('case-record-view').onclick=()=>{view('detail');sync(true);};
  el('case-compare-add').onclick=()=>{if(selectedDetail&&!comparisonIds.includes(selected.id)&&comparisonIds.length<2)setComparison([...comparisonIds,selected.id],{focus:true});};
  el('case-comparison-clear').onclick=()=>setComparison([],{focus:true});
  window.addEventListener('popstate',restore);
  window.addEventListener('hashchange',()=>{if(!location.hash||location.hash.startsWith('#case='))restore();});
  await restore();document.body.dataset.ready='true';
}
main().catch(error=>{el('case-load-error').hidden=false;el('case-load-error').textContent=error.message+' The original JMA database and format guide remain available above.';el('case-reload').hidden=false;el('case-reload').onclick=()=>location.reload();for(const control of el('case-filters').elements)control.disabled=true;});
