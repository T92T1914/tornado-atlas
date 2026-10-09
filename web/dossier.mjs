// Select one immutable dossier or one existing catalogue shard. Never preload media bytes.
import {validateSourceDirectory,discoverSources} from './archive-discovery-model.mjs';
import {comparisonSection,comparisonRoute} from './evidence-comparison.mjs';
import {selectRevisionEdge,loadRevisionComparison,revisionComparisonSection,revisionComparisonRoute} from './revision-comparison.mjs';
import {validateArchiveReferences,validateDossierHistory,loadVerifiedDossier,boundedJSON,HISTORY_FILE_LIMIT} from './dossier-file-model.mjs';
const host=document.getElementById('content'), query=new URLSearchParams(location.search);
const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function link(text,url){const n=element('a',text),u=new URL(url,location.href);if(!['https:','http:'].includes(u.protocol))throw Error('Unsupported link');n.href=u.href;if(u.origin!==location.origin){n.rel='noopener noreferrer';n.target='_blank';}return n;}
function retryView(){
  const retry=link('Retry this view',location.href);
  // A same-document fragment link would leave the unavailable view in place.
  // Ordinary activation retries the full URL; modified clicks keep native links.
  retry.addEventListener('click',event=>{
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();location.reload();
  });
  return retry;
}
function route(values){return 'dossier.html?'+new URLSearchParams(values);}
function revisionRoute(doc,values={},version){return route({event:doc.id,...values,...(version?{revision:version.dossier_sha256}:{})});}
async function json(file){const r=await fetch(file);if(!r.ok)throw Error('This evidence could not load. Its source may still be available through the catalogue.');return r.json();}
const human=value=>value.replaceAll('_',' ');
function detail(title,value){const n=element('details');n.append(element('summary',title),element('pre',typeof value==='string'?value:JSON.stringify(value,null,2)));return n;}
function links(rows){const n=element('nav',undefined,'archive-links');for(const row of rows)n.append(link(row.label,row.href));return n;}
let checkingDownload=false;
function dossierDownload(reference,eventId,label,filename){
  const group=element('div',undefined,'dossier-download'),button=element('button',label),status=element('p');
  button.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  group.append(button,link('Open raw metadata file (unverified)',reference.file),status);
  button.addEventListener('click',async()=>{
    if(checkingDownload){status.textContent='Another dossier download is being checked. Try again after it finishes.';return;}
    checkingDownload=true;button.disabled=true;status.textContent='Checking the metadata file before download...';
    let objectURL=null;
    try{
      const result=await loadVerifiedDossier(reference,eventId);
      objectURL=URL.createObjectURL(new Blob([result.bytes],{type:'application/json'}));
      const anchor=document.createElement('a');anchor.href=objectURL;anchor.download=filename;anchor.hidden=true;
      document.body.append(anchor);try{anchor.click();}finally{anchor.remove();}
      status.textContent='The checked metadata download started.';
    }catch(error){status.textContent='Metadata download unavailable. '+error.message+' You can retry this button.';}
    finally{
      if(objectURL){const completedURL=objectURL;setTimeout(()=>URL.revokeObjectURL(completedURL),1000);}
      checkingDownload=false;button.disabled=false;
    }
  });
  return group;
}
function listIndex(index){
  host.replaceChildren(element('h1','Follow an event into its evidence.'),element('p',`${index.coverage.current_source_records.toLocaleString()} US source records remain in the catalogue. These dossiers organize selected reviewed accounts. An empty evidence category means no reviewed item is linked here, not that no source exists.`));
  host.append(link('Compare evidence coverage across events','coverage.html'),element('p','Find the available chronology, geography, footage, radar and damage layers, with their registration limits.'));
  if(index.source_directory)host.append(link('Browse inspected source cards',route({view:'sources'})),element('p','Search original source titles, locators and inspection records across the published dossiers.'));
  const form=element('form',undefined,'archive-tools');form.setAttribute('aria-label','Evidence discovery');
  const label=element('label','Search dossiers'),search=element('input');search.type='search';search.name='q';search.value=query.get('q')||'';label.append(search);
  const kindLabel=element('label','Evidence available'),kind=element('select');kind.name='evidence';
  for(const [value,text] of [['','Any reviewed evidence'],['photograph','Linked photographs'],['video','Discrete video samples'],['radar','Historical radar'],['map','Source maps'],['chronology','Chronology'],['source_disagreement','Source disagreements'],['registered','Media with reviewed time and place']]){const o=element('option',text);o.value=value;kind.append(o);}kind.value=query.get('evidence')||'';
  kindLabel.append(kind);const button=element('button','Search');form.append(label,kindLabel,button);form.method='get';host.append(form);
  const grid=element('div',undefined,'archive-grid'),needle=search.value.toLowerCase();
  const rows=index.events.filter(e=>[e.title,e.summary,...e.creators.map(c=>c.name)].join(' ').toLowerCase().includes(needle)&&(!kind.value||(kind.value==='registered'?e.registered_media>0:e.evidence.includes(kind.value))));
  for(const e of rows){const card=element('article',undefined,'archive-card');card.append(element('p',e.coverage,'eyebrow'),element('h2',e.title),element('p',e.summary),link('Open evidence dossier',route({event:e.id})),element('p','Reviewed categories: '+e.evidence.join(', ')));grid.append(card);}host.append(grid);
  if(!rows.length)host.append(element('p','No reviewed dossier meets these filters. This is a coverage gap, not a finding that such evidence does not exist.'),link('Clear evidence filters','dossier.html'));
  host.append(element('h2','Start with a source record'),element('p','The same record view works across the imported catalogue. Wybark is a deliberately sparse example with a short official account and no reviewed event association.'),link('Wybark, Oklahoma · March 30, 2013',route({record:index.sparse_example})),detail('What the coverage descriptions mean',index.coverage_definitions));
}
async function showSources(index){
  const reference=index.source_directory;
  if(!reference||!/^archive\/sources-[0-9a-f]{20}\.json$/.test(reference.file))throw Error('No source directory is available in this archive publication.');
  const directory=validateSourceDirectory(await json(reference.file),index);
  document.title='Inspected source cards | Tornado Atlas';
  host.replaceChildren(link('All evidence dossiers','dossier.html'),element('h1','Find an inspected source.'),element('p',directory.scope));
  const form=element('form',undefined,'archive-tools');form.setAttribute('aria-label','Source discovery');form.method='get';
  const view=element('input');view.type='hidden';view.name='view';view.value='sources';
  const label=element('label','Search source cards'),search=element('input');search.type='search';search.name='q';search.value=query.get('q')||'';label.append(search);
  const eventLabel=element('label','Dossier'),event=element('select');event.name='scope';
  for(const row of [{id:'',title:'All published dossiers'},...index.events]){const option=element('option',row.title);option.value=row.id;event.append(option);}
  const scope=query.get('scope')||'';
  if(scope&&!index.events.some(row=>row.id===scope))throw Error('That dossier is not in this source directory. Browse the archive to find a published event.');
  event.value=scope;eventLabel.append(event);
  form.append(view,label,eventLabel,element('button','Find sources'));host.append(form);
  const rows=discoverSources(directory,{query:search.value,event:scope});
  host.append(element('p',`${rows.length} of ${directory.entries.length} inspected source cards match. These are selected dossier records, not a complete archive of original sources.`));
  const grid=element('div',undefined,'archive-grid');grid.id='source-results';
  for(const row of rows){
    const source=row.source,card=element('article',undefined,'archive-card');
    card.append(element('p',row.event_title,'eyebrow'),element('h2',source.title),element('p','Locator: '+source.locator),
      element('p','Inspection scope: '+source.access),element('p','Source revision: '+source.revision),element('p','Rights: '+source.rights),
      element('p',`${row.observations} linked observations; ${row.media} linked media records.`),
      link('Open source and its evidence',route({event:row.event_id,source:source.id,revision:row.dossier_sha256})+'#source-'+source.id),
      document.createTextNode(' '),link('Read original source',source.url));
    grid.append(card);
  }
  host.append(grid);
  if(!rows.length)host.append(element('p','No inspected source card meets these filters. Sources may exist outside this reviewed collection.'),link('Clear source filters',route({view:'sources'})));
}
function evidenceCard(item,doc,type,version,comparisonVersion=version){
  const card=element('article',undefined,'archive-card');card.id=`${type}-${item.id}`;
  card.append(element('p',type==='media'?human(item.kind):'Observation or attributed claim','eyebrow'),element('h3',item.title),element('p',item.account),element('p',item.limits));
  card.append(element('p','Exact locator: '+item.locator),link('Inspect the source card',revisionRoute(doc,{source:item.source_id},version)+'#source-'+item.source_id));
  const fields=element('dl');for(const [key,value] of Object.entries(item.status))fields.append(element('dt',human(key)),element('dd',human(value)));card.append(fields);
  if(type==='media'){
    card.append(link('Open original media at its source',item.url));
    for(const [role,id] of Object.entries(item.roles)){const name=doc.creators.find(c=>c.id===id);card.append(element('p',human(role)+': '));if(name)card.lastChild.append(link(name.name,route({creator:name.id})));else card.lastChild.append(document.createTextNode('Not established in this record.'));}
    card.append(detail('Parent and transformation', {parent:item.parent,transformation:item.transformation}));
  }
  card.append(detail('Clock roles and registration',item.time),detail('Place and its limits',item.place),detail('Inspection coverage',item.review),link('Link to this evidence',revisionRoute(doc,{[type]:item.id},version)+'#'+card.id));
  if(comparisonVersion)card.append(document.createTextNode(' '),link('Compare this evidence',comparisonRoute(doc,comparisonVersion.dossier_sha256,[type+':'+item.id])));
  return card;
}
function showHistory(doc,history,selected){
  const section=element('section');section.id='correction-history';
  section.append(element('h2','Dossier revisions and correction history'),element('p',history.scope),element('p','Dossier identities describe the projected metadata. They are separate from each original source revision, publication date and event clock.'));
  for(const version of history.versions){
    const card=element('article',undefined,'archive-card');card.id='revision-'+version.dossier_sha256;
    const current=version.dossier_sha256===history.current_dossier_sha256;
    card.append(element('h3',current?'Current published dossier':'Retained dossier revision'),element('p','Dossier SHA256: '+version.dossier_sha256));
    card.append(link(version.dossier_sha256===selected.dossier_sha256?'Link to this revision':'Open this dossier revision',revisionRoute(doc,{},version)+'#correction-history'));
    card.append(dossierDownload(version,doc.id,'Verify and download this revision (JSON)',doc.id+'-'+version.dossier_sha256.slice(0,12)+'.json'));
    const review=version.review;
    if(review){
      card.append(element('p','Publication review: '+review.reviewed_at+' · '+human(review.reviewer_kind)),element('p',review.basis));
      const previous=history.versions.find(v=>v.dossier_sha256===review.previous_dossier_sha256);
      if(previous){
        card.append(link('Open the recorded predecessor',revisionRoute(doc,{},previous)+'#correction-history'));
        if(version.predecessor_available)card.append(link('Read earlier and later recorded values',revisionComparisonRoute(doc.id,version.dossier_sha256,previous.dossier_sha256)));
      }
      else card.append(element('p','The recorded predecessor is not retained in this public archive. Its identity is '+review.previous_dossier_sha256+'. No comparison or missing account has been reconstructed.'));
    }else card.append(element('p','No publication-review record is retained for this snapshot. Its position in a chronology has not been inferred.'));
    if(version.dossier_sha256===selected.dossier_sha256&&version.changes!==null){
      card.append(element('h4','Recorded field differences from the predecessor'),element('p','These differences show what metadata changed. The publication-review basis above states the inspected scope.'));
      if(!version.changes.length)card.append(element('p','No evidence, source, attribution, association or display fields changed.'));
      for(const change of version.changes){
        const row=element('p',`${human(change.kind)} ${change.id}: ${change.change}${change.fields.length?' ('+change.fields.join(', ')+')':''}.`);
        const type={sources:'source',observations:'observation',media:'media'}[change.kind];
        const target=change.change==='removed'?history.versions.find(v=>v.dossier_sha256===review.previous_dossier_sha256):version;
        if(type&&target){row.append(document.createTextNode(' '),link('Inspect this evidence revision',revisionRoute(doc,{[type]:change.id},target)+'#'+type+'-'+change.id));}
        card.append(row);
      }
    }
    section.append(card);
  }
  return section;
}
function showDossier(doc,entry,index,history,selected,publicationComparison){
  document.title=doc.title+' | Tornado Atlas';
  host.replaceChildren(link('All evidence dossiers','dossier.html'),element('p',doc.coverage,'eyebrow'),element('h1',doc.title),element('p',doc.summary),links(doc.routes));
  host.append(dossierDownload(selected||entry,doc.id,'Verify and download dossier metadata (JSON)',doc.id+'.json'),element('p','This download contains metadata and source locators. It does not include third party media or establish hosting rights.'));
  if(history){
    const retained=selected.dossier_sha256!==history.current_dossier_sha256;
    host.append(element('p',retained?'You are reading a retained dossier revision. Its accounts and inspection coverage have not been replaced by current text.':'You are reading the current published dossier.'),element('p','Dossier SHA256: '+selected.dossier_sha256),link('Inspect revisions and correction history','#correction-history'));
    if(retained)host.append(document.createTextNode(' '),link('Return to the current dossier',route({event:doc.id})),element('p','Related source-record links and creator pages open current catalogue and attribution views. The evidence and source cards below belong to this retained dossier.'));
  }
  if(publicationComparison)host.append(publicationComparison);
  if(selected)host.append(comparisonSection(doc,selected.dossier_sha256,query.getAll('compare'),link,query.has('revision')));
  host.append(element('h2','Related source records'));
  for(const row of doc.records){const card=element('article',undefined,'archive-card');card.append(link(row.id,route({record:row.id})),element('p',row.basis),element('p','Reviewed association, not a merged identity. Alternative joins: '+(row.alternatives.length?row.alternatives.join(', '):'none recorded.')));host.append(card);}
  host.append(element('h2','Evidence and open questions'));
  const chosen=query.get('media')||query.get('observation'),sourceId=query.get('source');
  const items=[...doc.observations.map(x=>[x,'observation']),...doc.media.map(x=>[x,'media'])].filter(([x])=>(!chosen||x.id===chosen)&&(!sourceId||x.source_id===sourceId));
  if(chosen||sourceId)host.append(link('Show all evidence in this event',revisionRoute(doc,{},query.has('revision')?selected:undefined)));
  if(!items.length)host.append(element('p','No evidence matches this link. The event and its original source routes remain available.'));
  const version=query.has('revision')?selected:undefined;
  for(const [item,type] of items)host.append(evidenceCard(item,doc,type,version,selected));
  host.append(element('h2','Sources'));
  for(const s of doc.sources.filter(s=>!sourceId||s.id===sourceId)){const card=element('article',undefined,'archive-card');card.id='source-'+s.id;card.append(element('h3',s.title),link('Read original source',s.url),element('p','Locator: '+s.locator),element('p','Access: '+s.access),element('p','Source revision: '+s.revision),element('p','Rights: '+s.rights),element('p',s.agent_processing),link('Evidence drawn from this source',revisionRoute(doc,{source:s.id},version)),document.createTextNode(' '),link('Link to source card',revisionRoute(doc,{source:s.id},version)+'#'+card.id));host.append(card);}
  if(history)host.append(showHistory(doc,history,selected));
  host.append(element('h2','Reconstruction coverage'),element('p',doc.reconstruction.limits),element('p','Registered appearance intervals: '+doc.reconstruction.intervals.length),detail('Projection provenance',doc.provenance));
}
async function showRecord(index,id){
  if(!/^ncei:\d+$/.test(id))throw Error('Unrecognized source record ID. Browse the catalogue to find an available record.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const file=index.record_shards[hash.slice(0,2)];if(!file)throw Error('No source shard is available.');
  const r=(await json('catalogue/'+file))[id];if(!r)throw Error('That source ID is not in this catalogue revision.');
  document.title=r.title+' | Source dossier';
  host.replaceChildren(link('Evidence dossiers','dossier.html'),element('p','Catalogued · '+r.id,'eyebrow'),element('h1',r.title),element('p',`${r.time.begin.local} ${r.time.begin.zone} · ${r.rating.reported||'Unrated'}`),element('p','This source record may describe a county segment. An episode ID is not a canonical tornado identity.'),link('Open this record on the atlas','atlas.html?panel=detail#record='+encodeURIComponent(id)));
  const related=index.events.filter(e=>e.records.includes(id));host.append(element('h2','Reviewed event association'));
  for(const e of related)host.append(link(e.title,route({event:e.id})));
  if(!related.length)host.append(element('p','No reviewed canonical event association is published. Further media and historical research have not been completed for this record. No reconstruction is claimed.'));
  host.append(element('h2','Original source narrative'),...String(r.narrative||'No narrative was reported.').split('||').map(text=>element('p',text,'source-narrative')),element('h2','Source and measurements'),link('Open the original NOAA source file',r.provenance.source_url),element('p',`Source ID ${r.source_record_id}; episode ${r.source_episode_id}; CSV logical record ${r.provenance.csv_record}; revision ${r.provenance.snapshot_id}.`),element('p','Reported endpoints do not establish a surveyed path, camera location or visible funnel width. Original units and source clock convention are retained.'));
  for(const [label,value] of [['Source times',r.time],['Geometry and location review',{...r.spatial,review:r.location_review||null}],['Rating and original units',{rating:r.rating,dimensions:r.dimensions}],['Reported impacts',r.impacts],['Continuation and parser limits',{continuation:r.continuation,quality_notes:r.quality_notes}],['Source provenance',r.provenance]])host.append(detail(label,value));
  const button=element('button','Download source record metadata');
  // Create only a local export of the selected public record. Revoke it after navigation.
  button.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=id.replace(':','-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};host.append(button);
}
async function main(){
  if(query.has('predecessor')&&(['view','record','creator'].some(key=>query.has(key))||!query.has('event')))throw Error('The publication comparison route is invalid. No publication comparison has been substituted.');
  host.replaceChildren(element('h1','Loading archive...'),element('p','The current documentary chapter links below remain available while this evidence loads.'));
  const index=validateArchiveReferences(await json('archive/index.json'));
  if(query.get('view')==='sources')await showSources(index);
  else if(query.has('record'))await showRecord(index,query.get('record'));
  else if(query.has('event')){
    const entry=index.events.find(e=>e.id===query.get('event'));if(!entry)throw Error('This event is not in the reviewed dossier index.');
    const history=validateDossierHistory(await boundedJSON(entry.history_file,HISTORY_FILE_LIMIT),entry);
    const edge=query.has('predecessor')?selectRevisionEdge(query,history,entry.id):null;
    const identity=query.has('revision')?query.get('revision'):history?.current_dossier_sha256;
    const selected=history?.versions.find(v=>v.dossier_sha256===identity);
    if(query.has('revision')&&(!/^[0-9a-f]{64}$/.test(identity)||!selected))throw Error('That revision is not retained for this event. No current account has been substituted.');
    if(history&&(!selected||selected.file!==`archive/${entry.id}-${selected.dossier_sha256.slice(0,20)}.json`))throw Error('The dossier revision identity is invalid.');
    const result=await loadVerifiedDossier(selected,entry.id);
    const publicationComparison=edge?revisionComparisonSection(await loadRevisionComparison(result,edge,entry.id),link):null;
    showDossier(result.dossier,entry,index,history,selected,publicationComparison);
  }
  else if(query.has('creator')){
    const id=query.get('creator'),events=index.events.filter(e=>e.creators.some(c=>c.id===id)),creator=events[0]?.creators.find(c=>c.id===id);if(!creator)throw Error('No supported attribution matches this creator link.');
    const contributions=document.createDocumentFragment();
    contributions.append(link('Evidence dossiers','dossier.html'),element('h1',creator.name),element('p',creator.basis),element('p','This page contains credited contributions, not a biography.'));
    for(const e of events){const {dossier:doc}=await loadVerifiedDossier(e,e.id);contributions.append(link(e.title,route({event:e.id})));for(const m of doc.media.filter(m=>Object.values(m.roles).includes(id)))contributions.append(evidenceCard(m,doc,'media'));}
    host.replaceChildren(contributions);
  }else listIndex(index);
  document.body.dataset.ready='true';
  if(location.hash){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));target?.scrollIntoView();}
}
main().catch(error=>{host.replaceChildren(element('h1','Evidence unavailable'),element('p',error.message),retryView(),link('Browse the archive','dossier.html'),link('Open the catalogue','atlas.html'));document.body.dataset.ready='error';});
