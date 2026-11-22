import {dateLabel,timeLabel,positionLabel,ratingLabel,filterCases,readLink,writeLink} from './china-model.mjs';

const el=id=>document.getElementById(id);
const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function link(text,href){const node=make('a',text),url=new URL(href,location.href);if(url.protocol!=='https:'&&url.origin!==location.origin)throw Error('Unsupported source link');node.href=url.href;if(url.origin!==location.origin){node.target='_blank';node.rel='noopener noreferrer';}return node;}
function datum(list,label,value){list.append(make('dt',label),make('dd',value));}
const pageSize=20;
let records=[],matches=[],page=0;
const filters=()=>({query:el('china-query').value,rating:el('china-rating').value});

function card(record){
  const article=make('article','', 'china-case');article.dataset.case=record.id;article.tabIndex=-1;
  article.append(make('h3',record.case_label));
  const list=make('dl');
  datum(list,'Recorded date',dateLabel(record.recorded_date));
  datum(list,'Start time',timeLabel(record.start_time));
  datum(list,'End time',timeLabel(record.end_time));
  datum(list,'Position',positionLabel(record.position));
  datum(list,'Rating',ratingLabel(record.rating));
  datum(list,'Source row','Data sheet, row '+record.provenance.sheet_row);
  article.append(list);
  if(record.recorded_date.approximate)article.dataset.approximate='true';
  return article;
}
function render(){
  page=Math.min(page,Math.max(0,Math.ceil(matches.length/pageSize)-1));
  const fragment=document.createDocumentFragment();
  for(const record of matches.slice(page*pageSize,(page+1)*pageSize))fragment.append(card(record));
  if(!matches.length)fragment.append(make('p','No source cases match. Remove a filter or search by year, date or case label.'));
  el('china-results').replaceChildren(fragment);
  el('china-results-count').textContent=matches.length.toLocaleString('en-US')+' matching cases / '+records.length.toLocaleString('en-US')+' source cases';
  el('china-page-count').textContent=matches.length?(page*pageSize+1)+' to '+Math.min((page+1)*pageSize,matches.length)+' of '+matches.length.toLocaleString('en-US'):'0 cases';
  el('china-prev-page').disabled=page===0;el('china-next-page').disabled=(page+1)*pageSize>=matches.length;
}
function apply(push){
  matches=filterCases(records,filters());page=0;render();
  const href=location.pathname+writeLink(filters());
  if(href!==location.pathname+location.search)history[push?'pushState':'replaceState'](null,'',href);
}
function restore(){const state=readLink(location.search);el('china-query').value=state.query;el('china-rating').value=state.rating;matches=filterCases(records,state);page=0;render();}
function source(index){
  const s=index.source,box=make('div'),list=make('dl');
  datum(list,'Dataset',s.title+', version '+s.version);
  datum(list,'Creators',s.creators.join(', '));
  datum(list,'File',s.file_name+', '+s.bytes.toLocaleString('en-US')+' bytes, MD5 '+s.md5);
  datum(list,'Retrieved',s.retrieved_at);
  datum(list,'License',s.license);
  datum(list,'Changes',index.changes);
  datum(list,'Left out',index.omitted_columns.join(', '));
  datum(list,'Limits',index.limits);
  const links=make('p');links.append(link('Dataset record',s.doi),document.createTextNode(' · '),link('CC BY 4.0 license',s.license_url));
  box.append(make('p',index.attribution),list,links);
  el('china-source').replaceChildren(box);
}
async function start(){
  try{
    const response=await fetch('china-cases/index.json');
    if(!response.ok)throw Error('Could not load the published source cases.');
    const index=await response.json();
    records=index.records;
    const c=index.coverage;
    el('china-coverage').textContent=c.source_cases.toLocaleString('en-US')+' source cases from '+c.occurrence_years[0]+' to '+c.occurrence_years.at(-1)+'. '+c.geocoded_positions.toLocaleString('en-US')+' have a geocoded position and '+c.approximate_date_ranges+' give an approximate date range.';
    source(index);restore();
  }catch(error){
    el('china-coverage').textContent='The source cases could not be loaded.';
    el('china-load-error').textContent=error.message;el('china-load-error').hidden=false;
  }
  document.body.dataset.ready='true';
}
el('china-filters').addEventListener('submit',event=>{event.preventDefault();apply(true);});
el('china-filters').addEventListener('reset',()=>setTimeout(()=>apply(true)));
el('china-rating').addEventListener('change',()=>apply(true));
// A page button can turn disabled while it holds focus, so focus moves to the first case shown.
function turn(step){page+=step;render();const first=el('china-results').querySelector('[data-case]');if(first)first.focus({preventScroll:true});el('china-results').scrollIntoView({block:'start'});}
el('china-prev-page').addEventListener('click',()=>turn(-1));
el('china-next-page').addEventListener('click',()=>turn(1));
addEventListener('popstate',restore);
start();
