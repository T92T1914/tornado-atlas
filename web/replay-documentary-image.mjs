import {checkedPhotoBytes,documentaryPhoto} from './photo-view.mjs';

const DEADLINE_MS=10000;
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};

// A checked documentary copy belongs to one exact selected sample. It never
// supplies a form, camera solution or appearance between reported instants.
export function mountReplayDocumentaryImage(host,openPhoto){
  let selected=null,attempt=null;
  host.hidden=true;host.dataset.state='empty';
  function retire(){
    if(!attempt)return;
    attempt.active=false;clearTimeout(attempt.timer);attempt.controller.abort();
    attempt.image.removeAttribute('src');
    attempt.link.removeAttribute('href');
    if(attempt.url)URL.revokeObjectURL(attempt.url);
    attempt=null;
  }
  function show(sample,{retry=false}={}){
    if(sample===selected&&!retry)return;
    retire();selected=sample;host.replaceChildren();host.setAttribute('aria-busy','false');
    delete host.dataset.sampleId;
    if(!sample?.hosted_image){host.hidden=true;host.dataset.state='empty';return;}
    const photo=documentaryPhoto(sample),version=sample.hosted_image;
    host.hidden=false;host.dataset.state='loading';host.dataset.sampleId=sample.id;host.setAttribute('aria-busy','true');
    const title=element('h3','Complete photograph at this reported instant');title.id='replay-documentary-title';
    const figure=element('figure'),link=element('a');
    link.setAttribute('aria-label','Enlarge the complete photograph: '+photo.title);
    link.addEventListener('click',event=>{
      if(!owns()||host.dataset.state!=='ready'){event.preventDefault();return;}
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();openPhoto(photo);
    });
    const image=element('img');image.id='replay-documentary-photo';image.alt=photo.alt;
    image.width=version.width;image.height=version.height;image.hidden=true;image.referrerPolicy='no-referrer';
    link.append(image);
    const caption=element('figcaption');caption.append(element('p',photo.caption),element('p',photo.credit));
    figure.append(link,caption);
    const status=element('p','Checking the complete photograph...');status.id='replay-documentary-status';status.setAttribute('role','status');
    const retryButton=element('button','Retry photograph');retryButton.type='button';retryButton.id='replay-documentary-retry';retryButton.hidden=true;
    host.append(title,figure,status,retryButton);
    const owned={active:true,controller:new AbortController(),timer:null,image,link,url:null,deadline:performance.now()+DEADLINE_MS};attempt=owned;
    const owns=()=>attempt===owned&&owned.active&&selected===sample&&host.isConnected;
    function failed(error){
      if(!owns())return;
      retire();image.hidden=true;host.dataset.state='unavailable';host.setAttribute('aria-busy','false');
      status.textContent='The photograph could not be checked or displayed. '+error.message+' Its description and source links remain available.';
      retryButton.hidden=false;
    }
    function live(){
      if(!owns())return false;
      if(performance.now()>=owned.deadline){failed(Error('The image check took too long.'));return false;}
      return true;
    }
    retryButton.addEventListener('click',()=>{
      if(selected!==sample)return;
      show(sample,{retry:true});const heading=host.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});
    });
    image.addEventListener('load',async()=>{
      if(!live())return;
      try{if(typeof image.decode!=='function')throw Error();await image.decode();}
      catch{failed(Error('The checked photograph could not finish decoding.'));return;}
      if(!live())return;
      if(image.naturalWidth!==version.width||image.naturalHeight!==version.height){failed(Error('The checked dimensions do not match the selected record.'));return;}
      clearTimeout(owned.timer);link.href=photo.asset;image.hidden=false;host.dataset.state='ready';host.setAttribute('aria-busy','false');
      status.textContent='The complete displayed photograph matches the reviewed file. This is one creator-reported instant, without calibrated geometry or continuous appearance.';
    },{once:true});
    image.addEventListener('error',()=>failed(Error('The checked photograph could not be displayed.')),{once:true});
    owned.timer=setTimeout(()=>failed(Error('The image check took too long.')),DEADLINE_MS);
    checkedPhotoBytes(photo,{signal:owned.controller.signal,deadline:owned.deadline}).then(({bytes,type})=>{
      if(!live())return;
      if(bytes.byteLength!==version.bytes)throw Error('The checked byte count does not match the selected record.');
      if(typeof URL.createObjectURL!=='function'||typeof URL.revokeObjectURL!=='function')throw Error('Checked image display is unavailable in this browser.');
      owned.url=URL.createObjectURL(new Blob([bytes],{type}));image.src=owned.url;
    }).catch(failed);
  }
  window.addEventListener('pagehide',()=>{retire();host.hidden=true;host.dataset.state='retired';host.setAttribute('aria-busy','false');});
  window.addEventListener('pageshow',event=>{if(event.persisted&&selected)show(selected,{retry:true});});
  return {show};
}
