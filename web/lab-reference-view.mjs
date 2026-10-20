import {boundedJSON,validateArchiveReferences,loadVerifiedDossier} from './dossier-file-model.mjs';
import {checkedPhotoBytes} from './photo-view.mjs';

// These are existing documentary items, never inputs to the assumed model.
const REFERENCES=Object.freeze({
  'el-reno-2013':{id:'nolte-231037-full-documentary',source:'nolte-three-permitted-full-exports',asset:'assets/el-reno-2013/nolte-231037-full.jpg',
    role:'Storm photograph at a creator-reported instant',story:'index.html#documentary-nolte-231037',
    boundary:'A reported photographic instant is not a calibrated three-dimensional shape or continuous appearance.',
    extra:[['Read this reported instant in the player','reconstruction.html?event=el-reno-2013&t=397&appearance_view=photo&appearance_photo=nolte-reported-stills#replay-appearance'],['Compare the other permitted photographs','index.html#nolte-documentary-photographs']]},
  'joplin-2011':{id:'friskey-joplin-storm',source:'commons-friskey-joplin',asset:'assets/joplin-2011/storm.jpg',
    role:'Storm photograph with an unregistered camera and clock',story:'joplin.html?photo=friskey-joplin-storm#visibility',
    boundary:'The visible storm and its illumination do not determine physical width, wind speed or a continuous silhouette.',license:'https://creativecommons.org/licenses/by-sa/4.0/'},
  'tuscaloosa-birmingham-2011':{id:'oliveira-2019-tornado-video-frames',source:'oliveira-2019-tuscaloosa-figure6',asset:'assets/tuscaloosa-birmingham-2011/tornado-video-frames-oliveira2019.png',
    role:'Complete published film-frame figure with estimated time labels',story:'tuscaloosa.html#photographs-and-film',
    boundary:'Three panels from two credited films are discrete views. Their estimated labels do not calibrate this model or establish motion between them.',license:'https://creativecommons.org/licenses/by/4.0/'},
  'blackwell-1955':{id:'nara-blackwell-aerial-aftermath',source:'nara-blackwell-283884',asset:'assets/blackwell-1955/nara-283884.jpg',
    role:'Aerial aftermath photograph, not a storm-time view',story:'blackwell.html#photographs-and-film',
    boundary:'This photograph records the aftermath. No registered storm-time appearance is assigned to this reference.'},
  'moore-2013':{id:'moore-medical-center-survey',source:'nws-event-hub',asset:'assets/moore-2013/IMG_9287-800.jpg',
    role:'Following-day survey photograph, not a storm-time view',story:'moore.html#survey-photographs',
    boundary:'Damage and reported survey context do not supply a funnel shape, historical wind field or failure sequence.',license:'https://www.weather.gov/disclaimer'},
  'udall-1955':{id:'nws-blackwell-warning2',source:'nws-blackwell-warning2',asset:'assets/blackwell-1955/nws-warning2.jpg',
    role:'Regional forecast document, not a photograph of the tornado',story:'udall.html#udall-regional-forecast',
    boundary:'This regional document preserves forecast and later caption labels. It supplies no storm-time appearance, calibrated clock or local warning receipt.',license:'https://www.weather.gov/disclaimer'}
});
const DEADLINE_MS=10000;
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function link(text,href){
  const node=element('a',text),url=new URL(href,location.href);node.href=url.href;
  if(url.origin!==location.origin){node.target='_blank';node.rel='noopener noreferrer';}
  return node;
}
function dossierRoute(event,field,id,revision){
  return 'dossier.html?'+new URLSearchParams({event,[field]:id,...(revision?{revision}:{})})+'#'+field+'-'+id;
}

export function mountLabReference(host,beforeNavigate){
  let selected=null,attempt=null;
  host.hidden=true;host.dataset.state='empty';
  function retire(){
    if(!attempt)return;
    attempt.active=false;clearTimeout(attempt.timer);attempt.controller.abort();
    attempt.image?.removeAttribute('src');
    if(attempt.url)URL.revokeObjectURL(attempt.url);
    attempt=null;
  }
  function beforeDeparture(){
    // A cancelled departure keeps the selected source and an explicit retry.
    // An already checked image stays visible until ordinary pagehide cleanup.
    if(!attempt?.active||host.dataset.state!=='loading')return;
    const status=host.querySelector('#lab-reference-status'),retry=host.querySelector('#lab-reference-retry');
    retire();host.dataset.state='unavailable';host.setAttribute('aria-busy','false');
    status.textContent='The image check stopped before leaving this page. If you stay here, retry the image or use its article and source links.';
    retry.hidden=false;
  }
  function show(event,{retry=false}={}){
    if(event===selected&&!retry&&attempt?.active)return;
    retire();selected=event;host.replaceChildren();host.dataset.event=event??'';delete host.dataset.mediaId;
    if(!event){host.hidden=true;host.dataset.state='empty';host.setAttribute('aria-busy','false');return;}
    const reference=REFERENCES[event];
    if(!reference)throw Error('No documentary reference is assigned to this event.');
    host.hidden=false;host.dataset.state='loading';host.dataset.mediaId=reference.id;host.setAttribute('aria-busy','true');
    const title=element('h3','Inspect the selected documentary evidence.');title.id='lab-reference-title';host.setAttribute('aria-labelledby',title.id);
    const role=element('p',reference.role,'lab-reference-role'),boundary=element('p',reference.boundary,'lab-reference-boundary');
    const status=element('p','Checking the selected source record and complete image...');status.id='lab-reference-status';status.setAttribute('role','status');
    const actions=element('nav',undefined,'lab-reference-actions');actions.setAttribute('aria-label','Selected documentary source and reading');
    const retryButton=element('button','Retry documentary image');retryButton.id='lab-reference-retry';retryButton.type='button';retryButton.hidden=true;
    function sourceLinks(revision){
      actions.replaceChildren(link('Read this item in its article',reference.story),
        link('Inspect the media record and its limits',dossierRoute(event,'media',reference.id,revision)),
        link('Read the item source and permission',dossierRoute(event,'source',reference.source,revision)));
      for(const [label,href] of reference.extra??[])actions.append(link(label,href));
    }
    sourceLinks();host.append(title,role,boundary,status,actions,retryButton);
    const owned={active:true,controller:new AbortController(),timer:null,image:null,url:null,deadline:performance.now()+DEADLINE_MS};attempt=owned;
    const owns=()=>attempt===owned&&owned.active&&selected===event&&host.isConnected;
    function failed(error){
      if(!owns())return;
      retire();host.dataset.state='unavailable';host.setAttribute('aria-busy','false');
      status.textContent='The documentary image could not be checked or displayed. '+error.message+' The article and source records remain available.';retryButton.hidden=false;
    }
    function live(){
      if(!owns())return false;
      if(performance.now()>=owned.deadline){failed(Error('The reference check took too long.'));return false;}
      return true;
    }
    retryButton.addEventListener('click',()=>{if(selected===event){show(event,{retry:true});host.querySelector('#lab-reference-title').tabIndex=-1;host.querySelector('#lab-reference-title').focus();}});
    owned.timer=setTimeout(()=>failed(Error('The reference check took too long.')),DEADLINE_MS);
    const fetcher=(file,options={})=>fetch(file,{...options,signal:owned.controller.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
    (async()=>{
      const index=validateArchiveReferences(await boundedJSON('archive/index.json',200000,{fetcher}));if(!live())return;
      const entry=index.events.find(row=>row.id===event);if(!entry)throw Error('The selected event is absent from this archive publication.');
      const checked=await loadVerifiedDossier(entry,event,{fetcher});if(!live())return;
      const doc=checked.dossier,item=doc.media.find(row=>row.id===reference.id),source=doc.sources.find(row=>row.id===reference.source),version=item?.transformation;
      if(!item||item.source_id!==reference.source||!source||item.kind!=='photograph'||item.status.intake!=='published'||
        item.status.availability!=='reviewed_available'||item.status.rights!=='permitted_hosting'||version?.asset!==reference.asset||
        !Number.isSafeInteger(version.width)||version.width<=0||!Number.isSafeInteger(version.height)||version.height<=0||
        typeof version.alt!=='string'||!version.alt||typeof version.recipe!=='string')throw Error('The selected item no longer has its expected documentary publication and hosting basis.');
      title.textContent=item.title;sourceLinks(checked.reference.dossier_sha256);
      const figure=element('figure',undefined,'lab-reference-figure'),imageLink=link('Open the complete published image file',version.asset);imageLink.className='lab-reference-image-link';
      const image=element('img');image.id='lab-reference-image';image.alt=version.alt;image.width=version.width;image.height=version.height;image.hidden=true;image.referrerPolicy='no-referrer';owned.image=image;
      imageLink.replaceChildren(image);imageLink.setAttribute('aria-label','Open the complete published image: '+item.title);
      const caption=element('figcaption');
      const visibleCaption=item.review?.hosted_image?.caption??item.account;
      caption.append(element('p',visibleCaption,'lab-reference-caption'),element('p',item.limits,'lab-reference-limits'));
      const names=Object.entries(item.roles).map(([role,id])=>role.replaceAll('_',' ')+': '+(id?doc.creators.find(row=>row.id===id).name:'not established'));
      caption.append(element('p',names.join('. ')+'.','lab-reference-credit'),element('p',source.rights,'lab-reference-rights'),element('p','Image version: '+version.recipe,'lab-reference-version'));
      figure.append(imageLink,caption);status.before(figure);
      actions.append(link('Open the original source',source.url));if(item.url!==source.url)actions.append(link('Open the original item',item.url));
      if(reference.license)actions.append(link('Read the item use terms',reference.license));
      image.addEventListener('load',async()=>{
        if(!live())return;
        try{if(typeof image.decode!=='function')throw Error('Image decoding is unavailable.');await image.decode();}
        catch{failed(Error('The checked image could not finish decoding.'));return;}
        if(!live())return;
        if(image.naturalWidth!==version.width||image.naturalHeight!==version.height){failed(Error('The checked image dimensions do not match the selected record.'));return;}
        clearTimeout(owned.timer);image.hidden=false;host.dataset.state='ready';host.setAttribute('aria-busy','false');
        status.textContent='The complete displayed image matches the reviewed public file. Its documentary role does not calibrate the assumed experiment.';
      },{once:true});
      image.addEventListener('error',()=>failed(Error('The checked image could not be displayed.')),{once:true});
      const result=await checkedPhotoBytes({asset:version.asset,expectedSha256:version.sha256},{signal:owned.controller.signal,deadline:owned.deadline,fetcher});if(!live())return;
      if(typeof URL.createObjectURL!=='function'||typeof URL.revokeObjectURL!=='function')throw Error('Checked image display is unavailable in this browser.');
      owned.url=URL.createObjectURL(new Blob([result.bytes],{type:result.type}));image.src=owned.url;
    })().catch(failed);
  }
  host.addEventListener('click',event=>{if(event.target.closest?.('a'))beforeNavigate();});
  window.navigation?.addEventListener('navigate',event=>{
    if(event.defaultPrevented||event.signal?.aborted||event.destination?.sameDocument!==false||event.downloadRequest!=null)return;
    // A same-origin download anchor does not relinquish this document's image.
    // Match this event's source and destination, without remembering a prior URL.
    const source=event.sourceElement;
    if(source instanceof HTMLAnchorElement&&source.ownerDocument===document&&source.hasAttribute('download')&&
      source.origin===location.origin&&source.href===event.destination.url)return;
    beforeDeparture();
  });
  window.addEventListener('pagehide',()=>{retire();host.dataset.state='retired';host.setAttribute('aria-busy','false');});
  window.addEventListener('pageshow',event=>{if(event.persisted&&selected)show(selected,{retry:true});});
  return {show,beforeDeparture};
}
