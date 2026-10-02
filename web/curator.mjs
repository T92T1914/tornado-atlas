const $=id=>document.getElementById(id);
const tokenKey='atlas-curator-session';
const fragment=new URLSearchParams(location.hash.slice(1));
let token=fragment.get('token')||sessionStorage.getItem(tokenKey)||'';
if(fragment.has('token')){sessionStorage.setItem(tokenKey,token);history.replaceState(null,'',location.pathname);}
let current=null, exported=null, busy=false;
function dirty(){return Boolean(current&&($('private-notes').value!==current.draft.private_notes||$('dossier-json').value!==JSON.stringify(current.draft.dossier,null,2)));}
function mayReplace(){return !dirty()||window.confirm('This draft has unsaved notes or dossier edits. Discard those edits and open another draft?');}
function invalidateExport(){exported=null;$('download').disabled=true;if(!$('candidate-panel').hidden)$('preview-state').textContent='Draft content changed after this preview. Validate again before downloading the current candidate.';}
for(const id of ['private-notes','dossier-json'])$(id).addEventListener('input',invalidateExport);
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
function note(message){$('status').textContent=message;$('error').hidden=true;}
function fail(error){$('error').textContent=error.message||String(error);$('error').hidden=false;}
async function api(path,payload){
  const response=await fetch(path,{method:payload===undefined?'GET':'POST',headers:{'X-Curator-Token':token,...(payload===undefined?{}:{'Content-Type':'application/json'})},...(payload===undefined?{}:{body:JSON.stringify(payload)})});
  const result=await response.json();if(!response.ok)throw Error(result.error||`Request failed (${response.status})`);return result;
}
function option(value,text){const node=document.createElement('option');node.value=value;node.textContent=text;return node;}
async function refresh(){const data=await api('/api/session');$('event-choice').replaceChildren(...data.events.map(e=>option(e.id,e.title)));$('draft-choice').replaceChildren(option('','Choose a saved draft'),...data.drafts.map(d=>option(d.id,`${d.title} (${d.id})`)));if(current)$('draft-choice').value=current.draft.id;}
function receive(data){current=data;exported=null;$('download').disabled=true;$('workspace').hidden=false;$('candidate-panel').hidden=true;$('current-title').textContent=data.draft.dossier.title;$('target-context').textContent=`${data.draft.target.kind==='record'?'Source record':'Reviewed event'}: ${data.draft.target.id}. No new event association is inferred.`;$('revision').textContent=`Saved revision: ${data.revision}`;$('private-notes').value=data.draft.private_notes;$('dossier-json').value=JSON.stringify(data.draft.dossier,null,2);}
function edited(){if(!current)throw Error('Choose a research context first');return {...current.draft,private_notes:$('private-notes').value,dossier:JSON.parse($('dossier-json').value)};}
function download(name,value){const link=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function text(parent,tag,value){const node=document.createElement(tag);node.textContent=value;parent.append(node);return node;}
function preview(candidate){
  const doc=candidate.dossier,panel=$('candidate-summary');panel.replaceChildren();text(panel,'h3',doc.title);text(panel,'p',doc.summary);
  for(const item of [...doc.observations,...doc.media]){const article=document.createElement('article');article.className='evidence-card';text(article,'h3',item.title);text(article,'p',item.account);text(article,'p',`Locator: ${item.locator}`);text(article,'p',`Limits: ${item.limits}`);text(article,'p',Object.entries(item.status).map(([k,v])=>`${k}: ${v}`).join(' · '));if(item.time.video)text(article,'p',`Presentation seconds: ${item.time.video.start_seconds} to ${item.time.video.end_seconds}. Capture clock: ${JSON.stringify(item.time.capture)}. Alignment: ${JSON.stringify(item.time.alignment)}.`);const source=doc.sources.find(s=>s.id===item.source_id);if(source){const link=text(article,'a',source.title);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';}panel.append(article);}
  $('candidate-json').textContent=JSON.stringify(candidate,null,2);$('preview-state').textContent='Validated candidate. Private notes are excluded. Review this public content before publication. No bytes have been published.';$('candidate-panel').hidden=false;$('download').disabled=false;
}
function run(action){return async event=>{
  event?.preventDefault();if(busy)return;busy=true;let controls=[];
  try{
    // Capture the action's form values before disabling them. Disabled controls
    // are otherwise omitted from FormData. Async handlers capture before await.
    const pending=action(event);
    controls=[...document.querySelectorAll('main input,main select,main textarea,main button')].map(control=>[control,control.disabled]);
    for(const [control] of controls)control.disabled=true;
    document.querySelector('main').setAttribute('aria-busy','true');
    await pending;
  }catch(error){fail(error);}
  finally{
    for(const [control,disabled] of controls)control.disabled=disabled;
    $('download').disabled=!exported;
    document.querySelector('main').removeAttribute('aria-busy');busy=false;
  }
};}
$('new-form').addEventListener('submit',run(async()=>{if(!mayReplace())return;receive(await api('/api/new',{id:$('new-id').value,kind:'event',target:$('event-choice').value}));await refresh();note('Private event draft saved. Retained observations keep their original evidence limits.');}));
$('search-form').addEventListener('submit',run(async()=>{const result=await api('/api/search?q='+encodeURIComponent($('record-query').value));$('record-results').replaceChildren();for(const record of result.records){const button=text($('record-results'),'button',`${record.title} | ${record.date||'Unknown date'} | ${record.rating||'Unrated'} | ${record.id}`);button.type='button';button.addEventListener('click',run(async()=>{if(!$('new-id').reportValidity()||!mayReplace())return;receive(await api('/api/new',{id:$('new-id').value,kind:'record',target:record.id}));await refresh();note('Private source-record draft saved. A whole-event association remains unreviewed.');}));}if(!result.records.length)text($('record-results'),'p','No matching source records. Try another place, date or source ID.');}));
$('reopen').addEventListener('click',run(async()=>{if(!$('draft-choice').value)throw Error('Choose a saved draft');if(!mayReplace())return;receive(await api('/api/draft/'+encodeURIComponent($('draft-choice').value)));note('Draft reopened from its saved revision.');}));
$('save').addEventListener('click',run(async()=>{receive(await api('/api/save',{draft:edited(),revision:current.revision}));await refresh();note('Draft saved atomically. Private notes remain outside the public candidate.');}));
$('preview').addEventListener('click',run(async()=>{const result=await api('/api/candidate',{draft:edited()});exported=result.candidate;preview(exported);note('Candidate validation passed. Publication requires the reviewed repository workflow.');}));
$('download').addEventListener('click',()=>{if(exported)download(`${current.draft.id}-candidate.json`,exported);});
$('backup-draft').addEventListener('click',run(async()=>{if(!current)throw Error('Reopen a saved draft first');if(dirty())throw Error('Save or reopen this draft before downloading its private backup. Unsaved edits are not backed up.');const result=await api('/api/backup-draft',{id:current.draft.id,revision:current.revision});download(`${current.draft.id}-private-backup.json`,result);note('Saved draft private backup prepared. It contains notes and intake records, and must not be committed publicly.');}));
$('intake-form').addEventListener('submit',run(async event=>{const values=Object.fromEntries(new FormData(event.target));for(const name of ['video_start','video_end'])values[name]=values[name]===''?null:Number(values[name]);const result=await api('/api/intake',{draft:edited(),revision:current.revision,item:values});receive(result);await refresh();note(result.added?'Intake saved as an unreviewed lead. No clock or map registration was inferred.':'Identical intake already exists. Nothing was duplicated.');}));
$('sample').addEventListener('click',run(async()=>{const doc=edited().dossier,media=doc.media.find(m=>m.kind==='video'&&m.time.video);if(!media)throw Error('This dossier has no retained video sample');const source=doc.sources.find(s=>s.id===media.source_id),form=$('intake-form');const name=id=>doc.creators.find(c=>c.id===id)?.name||'';const values={key:'retained-'+media.id,kind:'video',title:media.title,url:source.url,locator:media.locator,creator:name(media.roles.creator),uploader:name(media.roles.uploader),rights_holder:name(media.roles.rights_holder),attribution_basis:'Retained dossier attribution. This draft performs no new identity review.',rights:'links_only',rights_note:source.rights,capture_text:JSON.stringify(media.time.capture),publication_text:'',retrieval_text:'Retained sample only. No new source retrieval.',place_text:JSON.stringify(media.place.reported),video_start:media.time.video.start_seconds,video_end:media.time.video.end_seconds,account:media.account,limits:media.limits};for(const [key,value]of Object.entries(values))form.elements.namedItem(key).value=value;note('Form filled from a retained paused sample. It remains a private draft until you save intake. No new video frames were inspected.');}));
$('backup').addEventListener('click',run(async()=>{download('atlas-private-curator-backup.json',await api('/api/backup'));note('Private backup prepared. It contains notes and must not be committed publicly.');}));
$('restore').addEventListener('click',run(async()=>{const file=$('restore-file').files[0];if(!file)throw Error('Choose a private backup JSON file');if(file.size>2_000_000)throw Error('Backup exceeds the 2 MB import limit');const result=await api('/api/restore',JSON.parse(await file.text()));await refresh();note(`Restored ${result.restored.length} drafts. ${result.unchanged} identical drafts were left unchanged.`);}));
if(location.hostname==='127.0.0.1'&&token){refresh().then(()=>{document.body.dataset.ready='true';note('Private local session connected. Choose an event or source record.');}).catch(fail);}else{fail(Error('This authoring page needs the loopback session URL. The public website has no writable curator service.'));}
