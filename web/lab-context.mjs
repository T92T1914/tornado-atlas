import {LAB_EVENTS,DEFAULT_EXPERIMENTS,readExperiment,experimentURL} from './experiment-state.mjs';
import {mountLabReference} from './lab-reference-view.mjs';
import {createLabViewportOwner} from './lab-viewport.mjs';

// A small page adapter. Evidence navigation and model inputs remain separate.
export function mountLabContext({kind,read,capture,apply,defaults=DEFAULT_EXPERIMENTS[kind]}){
  const get=id=>document.getElementById(id),host=get('lab-context');
  if(!host)return {changed(){},preview(){}};
  const picker=get('lab-event'),share=get('lab-share'),message=get('lab-state'),account=get('lab-reference-account'),links=get('lab-reference-links');
  const evidence=document.createElement('section');evidence.id='lab-reference-evidence';
  links.closest('.lab-context-grid').after(evidence);
  const viewport=createLabViewportOwner();
  const referenceView=mountLabReference(evidence,()=>{viewport.clear();return commit(capture(),'Experiment paused before opening the evidence.');},change=>viewport.update(change),()=>viewport.clear());
  const replaceInterval=250;
  let event=null,restoring=false,pending=null,timer=null,generation=0,lastReplace=-Infinity,currentEntry=null;
  const entryField='atlasLabEntryV1',departed=new Map();
  const pendingStorageKey='atlasLabPendingV1:'+kind+':'+location.pathname,maxPendingChars=8192;
  let storageNotice='';
  function storageUnavailable(error){
    storageNotice=' Automatic reload retention is unavailable ('+(error?.name||'storage error')+'). Open the experiment link to retain the displayed assumptions.';
  }
  function stored(){
    try{const raw=sessionStorage.getItem(pendingStorageKey);if(raw===null)return null;
      if(raw.length>maxPendingChars)throw new Error('Pending record is too large');
      return JSON.parse(raw);
    }catch(error){storageUnavailable(error);return null;}
  }
  function clearStored(){
    const record=stored();
    if(record?.entry===currentEntry){try{sessionStorage.removeItem(pendingStorageKey);}catch(error){storageUnavailable(error);}}
  }
  function persist(url){
    if(url.href===location.href){clearStored();return;}
    const raw=JSON.stringify({version:1,kind,entry:currentEntry,base:location.href,target:url.href});
    if(raw.length>maxPendingChars){storageUnavailable(new RangeError('Pending record is too large'));return;}
    try{sessionStorage.setItem(pendingStorageKey,raw);storageNotice='';}catch(error){storageUnavailable(error);}
  }
  function recoverStored(){
    const record=stored();if(record===null)return;
    let target;
    // Only this document's currently selected native entry may recover its pending URL.
    if(record?.entry!==currentEntry)return;
    try{
      if(Object.keys(record).sort().join('|')!=='base|entry|kind|target|version'||record.version!==1||record.kind!==kind||record.base!==location.href||typeof record.target!=='string'||record.base.length>3072||record.target.length>3072)throw new Error('Invalid pending record');
      const base=new URL(record.base);target=new URL(record.target);const result=readExperiment(target.search,kind);
      if(base.href!==record.base||target.href!==record.target||target.origin!==base.origin||target.pathname!==base.pathname||target.hash!==base.hash||target.username||target.password||readExperiment(base.search,kind).status==='invalid'||result.status!=='restored'||experimentURL(target.href,kind,result.event,result.state).href!==target.href)throw new Error('Invalid pending experiment');
    }catch{
      storageNotice=' Pending reload changes were not restored because their saved record was invalid. Open a valid experiment link to recover its assumptions.';return;
    }
    // Commit errors remain original errors, without a retry or a success claim.
    replace(target);
  }
  const entryState=()=>({...((history.state&&typeof history.state==='object')?history.state:{}),[entryField]:crypto.randomUUID()});
  function entryKey(){
    if(typeof history.state?.[entryField]!=='string'){history.replaceState(entryState(),'',location.href);lastReplace=performance.now();}
    return history.state[entryField]+'|'+location.hash;
  }
  for(const row of LAB_EVENTS){const option=document.createElement('option');option.value=row.id;option.textContent=row.title;picker.append(option);}
  function cancelPending(){
    generation++;if(timer!==null)clearTimeout(timer);timer=null;pending=null;
  }
  function replace(url){
    if(url.href!==location.href){history.replaceState(history.state,'',url);lastReplace=performance.now();}
    clearStored();
  }
  function queue(url){
    if(url.href===location.href){cancelPending();clearStored();return;}
    pending=url;persist(url);
    const delay=Math.max(0,replaceInterval-(performance.now()-lastReplace));
    if(delay===0){cancelPending();replace(url);return;}
    if(timer!==null)return;
    const ownedGeneration=generation;
    timer=setTimeout(()=>{
      if(ownedGeneration!==generation)return;
      timer=null;const latest=pending;pending=null;if(latest)replace(latest);
    },Math.ceil(delay));
  }
  function showCurrent(url,notice){share.href=url.href;message.textContent=notice+storageNotice;message.dataset.state='current';}
  function commit(state,notice='Experiment paused. The address and experiment link retain the displayed assumptions.'){
    cancelPending();const url=experimentURL(location.href,kind,event,state);replace(url);departed.delete(currentEntry);showCurrent(url,notice);return url;
  }
  function reference(){
    viewport.clear();
    picker.value=event??'';account.replaceChildren();links.replaceChildren();
    const row=LAB_EVENTS.find(item=>item.id===event);
    referenceView.show(row?.id??null);
    const failureReturn=get('scene-failure-return');
    if(failureReturn){failureReturn.href=row?row.form:'atlas.html';failureReturn.textContent=row?'Read the '+row.title+' documentary evidence':'Explore the documentary collection';}
    if(!row){account.textContent='No documentary reference selected. These settings describe your assumed experiment.';return;}
    account.textContent=row[kind+'Account'];
    for(const [label,href] of [['Read the '+row.title+' account',row[kind]],['Inspect its evidence dossier',row.source]]){
      const link=document.createElement('a');link.textContent=label;link.href=href;
      // Commit before ordinary navigation, while this history entry still owns its URL.
      link.addEventListener('click',()=>{commit(capture(),'Experiment paused before opening the evidence.');});
      links.append(link);
    }
  }
  function preview(){
    if(restoring)return;
    share.href=experimentURL(location.href,kind,event,read()).href;
  }
  function changed({mode='replace',state=read(),notice='The experiment link follows the current controls. Reopening it starts paused.'}={}){
    if(restoring)return;
    const url=experimentURL(location.href,kind,event,state);
    if(mode==='push'){cancelPending();history.pushState(entryState(),'',url);currentEntry=entryKey();lastReplace=performance.now();}else queue(url);
    showCurrent(url,notice);
  }
  function restore(){
    // Only uncommitted departures need temporary ownership. Revisited entries retire here.
    // This cache lasts for this document, without promising unsaved entries across a later reload.
    if(pending&&currentEntry)departed.set(currentEntry,pending.href);
    clearStored();cancelPending();restoring=true;currentEntry=entryKey();
    const retained=departed.get(currentEntry);
    if(retained){replace(new URL(retained));departed.delete(currentEntry);}else recoverStored();
    const result=readExperiment(location.search,kind);
    event=result.event;
    apply(result.state??defaults);reference();
    message.dataset.state=result.status;
    message.textContent=result.status==='invalid'?'Experiment link not restored. '+result.message+' No values from the link were applied. Default controls are shown. Change a control or choose a reference to start a new experiment.':
      result.status==='restored'?(event?'Experiment restored and paused. The selected documentary supplies context, not model calibration.':'Experiment restored and paused. No documentary reference is assigned.'):
      'Default experiment, paused. Choose a documentary reference or change the assumptions.';
    message.textContent+=storageNotice;
    restoring=false;preview();host.dataset.experimentReady='true';
  }
  picker.addEventListener('change',()=>{
    const state=capture();commit(state);event=picker.value||null;reference();
    changed({mode:'push',state,notice:'Documentary reference changed. The same assumed experiment is paused.'});
  });
  share.addEventListener('click',click=>{
    const state=capture(),url=commit(state);share.href=url.href;
    if(click.button===0&&!click.ctrlKey&&!click.metaKey&&!click.shiftKey&&!click.altKey){click.preventDefault();changed({mode:'push',state,notice:'Paused experiment link saved. The address above can reopen the same assumptions.'});}
  });
  // Native same-page links inherit the current query. Commit before their default action.
  document.addEventListener('click',click=>{
    const link=click.target.closest?.('a[href^="#"]');
    if(!click.defaultPrevented&&link&&link!==share&&message.dataset.state!=='invalid')commit(capture());
  });
  window.addEventListener('beforeunload',()=>{
    referenceView.beforeDeparture();
    if(message.dataset.state==='invalid')return;
    // Reload can capture its destination before beforeunload. Retain this one pending
    // paused snapshot instead of promising that a late replaceState changes that target.
    const url=experimentURL(location.href,kind,event,capture());cancelPending();persist(url);showCurrent(url,'Experiment paused before leaving this document.');
  });
  window.addEventListener('pagehide',cancelPending);
  window.addEventListener('popstate',restore);
  get('lab-enhancement').hidden=false;get('lab-documentary-fallback').hidden=true;
  restore();
  return {changed,preview,beforeNavigate:()=>commit(capture(),'Experiment paused before opening the evidence.')};
}
