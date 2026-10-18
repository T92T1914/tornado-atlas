import {LAB_EVENTS,DEFAULT_EXPERIMENTS,readExperiment,experimentURL} from './experiment-state.mjs';

// A small page adapter. Evidence navigation and model inputs remain separate.
export function mountLabContext({kind,read,capture,apply}){
  const get=id=>document.getElementById(id),host=get('lab-context');
  if(!host)return {changed(){},preview(){}};
  const picker=get('lab-event'),share=get('lab-share'),message=get('lab-state'),account=get('lab-reference-account'),links=get('lab-reference-links');
  let event=null,restoring=false;
  for(const row of LAB_EVENTS){const option=document.createElement('option');option.value=row.id;option.textContent=row.title;picker.append(option);}
  function reference(){
    picker.value=event??'';account.replaceChildren();links.replaceChildren();
    const row=LAB_EVENTS.find(item=>item.id===event);
    if(!row){account.textContent='No documentary reference selected. These settings describe your assumed experiment.';return;}
    account.textContent=row[kind+'Account'];
    for(const [label,href] of [['Read the '+row.title+' account',row[kind]],['Inspect its evidence dossier',row.source]]){
      const link=document.createElement('a');link.textContent=label;link.href=href;
      // Save the displayed model before ordinary same-tab navigation. Back can restore it.
      link.addEventListener('click',()=>{changed({state:capture(),notice:'Experiment paused before opening the evidence.'});});
      links.append(link);
    }
  }
  function preview(){
    if(restoring)return;
    share.href=experimentURL(location.href,kind,event,read()).href;
  }
  function changed({mode='replace',state=read(),notice='Current controls are saved in this experiment link. Reopening it starts paused.'}={}){
    if(restoring)return;
    const url=experimentURL(location.href,kind,event,state);
    if(mode==='push'||url.href!==location.href)history[mode==='push'?'pushState':'replaceState'](null,'',url);
    share.href=url.href;message.textContent=notice;message.dataset.state='current';
  }
  function restore(){
    restoring=true;
    const result=readExperiment(location.search,kind);
    event=result.event;
    apply(result.state??DEFAULT_EXPERIMENTS[kind]);reference();
    message.dataset.state=result.status;
    message.textContent=result.status==='invalid'?'Experiment link not restored. '+result.message+' No values from the link were applied. Default controls are shown. Change a control or choose a reference to start a new experiment.':
      result.status==='restored'?(event?'Experiment restored and paused. The selected documentary supplies context, not model calibration.':'Experiment restored and paused. No documentary reference is assigned.'):
      'Default experiment, paused. Choose a documentary reference or change the assumptions.';
    restoring=false;preview();host.dataset.experimentReady='true';
  }
  picker.addEventListener('change',()=>{const state=capture();event=picker.value||null;reference();changed({mode:'push',state,notice:'Documentary reference changed. The same assumed experiment is paused.'});});
  share.addEventListener('click',click=>{
    const state=capture(),url=experimentURL(location.href,kind,event,state);share.href=url.href;
    if(click.button===0&&!click.ctrlKey&&!click.metaKey&&!click.shiftKey&&!click.altKey){click.preventDefault();changed({mode:'push',state,notice:'Paused experiment link saved. The address above can reopen the same assumptions.'});}
  });
  window.addEventListener('popstate',restore);
  get('lab-enhancement').hidden=false;get('lab-documentary-fallback').hidden=true;
  restore();
  return {changed,preview};
}
