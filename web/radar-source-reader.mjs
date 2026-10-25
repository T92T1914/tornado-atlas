import {loadEventPackage} from './event-package-model.mjs';
import {checkedPhotoBytes} from './photo-view.mjs';
import {validateRadarSource,radarSelection,retainedGap} from './radar-source-model.mjs';

const byId=id=>document.getElementById(id);
const controls=byId('radar-reader-controls'),picker=byId('radar-observation');
const previous=byId('radar-prev'),next=byId('radar-next'),play=byId('radar-play');
const retry=byId('radar-retry'),status=byId('radar-reader-status'),reload=byId('radar-reader-reload');
const figure=byId('radar-source-figure'),caption=byId('radar-source-caption');
const time=byId('radar-source-time'),original=byId('radar-frame-original');
let image=byId('radar-source-image');
const preference=matchMedia('(prefers-reduced-motion: reduce)');
let manifest=null,requested=0,shown=0,attempt=null,displayURL=null,timer=null;
let playing=false,departed=false,notice='',initController=null,initTimer=null,initVersion=0;
const dwell=1000,deadlineMs=10000;
const stamp=frame=>frame.utc.slice(11,19)+' UTC (filename interpretation)';
const currentLabel=()=>manifest?'original GIF frame index '+manifest.frames[shown].frame_index:'original GIF frame index 151';
const clearTimer=()=>{clearTimeout(timer);timer=null;};
const inView=()=>{const rect=figure.getBoundingClientRect();return rect.width>0&&rect.height>0
  &&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;};
const hasDisplayedImage=()=>Boolean(!image.hidden&&image.getAttribute('src')
  &&image.complete&&image.naturalWidth===597&&image.naturalHeight===599);
function unavailableRecord(){
  if(hasDisplayedImage())return;
  image.hidden=true;image.removeAttribute('src');figure.dataset.state='unavailable';
  original.textContent='Open the complete PNG for this source record';
  const frame=manifest?.frames[shown];
  const label=document.createElement('code');
  label.textContent=frame?.source_label||'wseNWRT_Reflectivity_20130531-230137_00.51.png';
  caption.replaceChildren(document.createTextNode('No radar image is currently displayed. Source record: '
    +currentLabel()+'. Printed label: '),label,document.createTextNode('.'));
  time.textContent='Source label for that record: '
    +(frame?stamp(frame):'23:01:37 UTC (filename interpretation)')
    +'. This identifies the source record, not a currently displayed image.';
}
const displayedSummary=()=>hasDisplayedImage()?'Still showing '+currentLabel()+'.'
  :'No radar image is currently displayed. The source record and original image link remain available.';

function buttons(){
  if(!manifest)return;
  picker.value=String(manifest.frames[requested].frame_index);
  previous.disabled=requested===0;next.disabled=requested===manifest.frames.length-1;
  play.textContent=playing?'Pause display sequence':shown===manifest.frames.length-1?'Play from first observation':'Play display sequence';
  play.setAttribute('aria-pressed',String(playing));
}
function retireAttempt(){
  const old=attempt;attempt=null;
  if(!old)return;
  old.active=false;clearTimeout(old.timer);old.controller.abort();
  old.image.onload=null;old.image.onerror=null;old.image.removeAttribute('src');
  if(old.url)URL.revokeObjectURL(old.url);
  figure.setAttribute('aria-busy','false');
}
function pause(message='',cancelPending=true){
  playing=false;clearTimer();
  if(cancelPending&&attempt){retireAttempt();requested=shown;retry.hidden=true;}
  buttons();if(message)status.textContent=message;
}
function arm(){
  clearTimer();
  if(!playing||departed||document.hidden)return;
  if(shown===manifest.frames.length-1){
    pause('The last retained observation is shown. The display sequence has stopped.',false);return;
  }
  // Presentation dwell starts after a complete checked image is committed.
  // It is not the historical interval between the two printed source labels.
  timer=setTimeout(()=>{timer=null;if(playing&&!departed&&!document.hidden)choose(shown+1,false);},dwell);
}
function choose(index,manual=true,writeURL=true){
  if(!manifest||departed||document.hidden)return;
  if(manual){pause('',false);notice='';}
  requested=index;retireAttempt();retry.hidden=true;buttons();
  const frame=manifest.frames[index],pendingImage=new Image();
  pendingImage.id='radar-source-image';pendingImage.width=597;pendingImage.height=599;
  pendingImage.alt=frame.alt;pendingImage.referrerPolicy='no-referrer';
  figure.dataset.requestedFrame=String(frame.frame_index);figure.setAttribute('aria-busy','true');
  status.textContent='Checking requested '+stamp(frame)+'. '
    +(hasDisplayedImage()?'Still showing '+currentLabel()+'.':'No radar image is currently displayed. The source record below retains its own label while a checked replacement loads.');
  const owned={active:true,controller:new AbortController(),image:pendingImage,url:null,timer:null,deadline:performance.now()+deadlineMs};
  attempt=owned;
  const owns=()=>attempt===owned&&owned.active&&!departed&&requested===index;
  const fail=error=>{
    if(!owns())return;
    retireAttempt();playing=false;clearTimer();retry.hidden=false;buttons();
    unavailableRecord();
    status.textContent='Requested original GIF frame index '+frame.frame_index+' ('+stamp(frame)+') could not be checked or displayed. '
      +String(error.message).slice(0,240)+' '+displayedSummary()
      +' Retry the selected observation or choose another one. The source links remain available.';
  };
  const live=()=>{
    if(!owns())return false;
    if(performance.now()>=owned.deadline){fail(Error('The image check took too long.'));return false;}
    return true;
  };
  pendingImage.onerror=()=>fail(Error('The checked PNG could not be displayed.'));
  pendingImage.onload=async()=>{
    if(!live())return;
    try{await pendingImage.decode();}catch{fail(Error('The checked PNG could not finish decoding.'));return;}
    if(!live())return;
    if(pendingImage.naturalWidth!==597||pendingImage.naturalHeight!==599){
      fail(Error('The checked dimensions differ from the retained frame.'));return;
    }
    clearTimeout(owned.timer);pendingImage.onload=null;pendingImage.onerror=null;owned.active=false;attempt=null;
    const old=image,oldURL=displayURL;
    image.replaceWith(pendingImage);image=pendingImage;displayURL=owned.url;owned.url=null;
    old.removeAttribute('src');if(oldURL)URL.revokeObjectURL(oldURL);
    shown=index;figure.dataset.frameIndex=String(frame.frame_index);figure.dataset.state='ready';
    figure.setAttribute('aria-busy','false');
    const label=document.createElement('code');label.textContent=frame.source_label;
    caption.replaceChildren(document.createTextNode('Original GIF frame index '+frame.frame_index+'. Printed label: '),label,document.createTextNode('.'));
    const gap=retainedGap(manifest,index);
    time.textContent='Displayed observation '+(index+1)+' of '+manifest.frames.length+': '+stamp(frame)+'. '
      +(gap===null?'This is the first retained label.':gap+' seconds after the previous retained label. These are curation gaps, not a claim about the instrument update cadence.');
    original.href=frame.file;
    original.textContent='Open the displayed complete PNG';
    if(writeURL){
      const url=new URL(location.href);url.searchParams.set('frame',String(frame.frame_index));
      try{history.replaceState(history.state,'',url.href);}
      catch{notice+='The observation address could not be updated. ';}
    }
    buttons();
    status.textContent=notice+'The complete displayed PNG matches the retained file. '
      +(playing?'The display sequence is running. Each checked observation remains visible for at least one second.':'The display sequence is paused.');
    arm();
  };
  owned.timer=setTimeout(()=>fail(Error('The image check took too long.')),deadlineMs);
  checkedPhotoBytes({asset:frame.file,expectedSha256:frame.sha256},{signal:owned.controller.signal,deadline:owned.deadline})
    .then(({bytes,type})=>{
      if(!live())return;
      if(typeof URL.createObjectURL!=='function'||typeof URL.revokeObjectURL!=='function')throw Error('Checked image display is unavailable.');
      owned.url=URL.createObjectURL(new Blob([bytes],{type}));pendingImage.src=owned.url;
    }).catch(fail);
}

previous.addEventListener('click',()=>choose(Math.max(0,requested-1)));
next.addEventListener('click',()=>choose(Math.min(manifest.frames.length-1,requested+1)));
picker.addEventListener('change',()=>choose(radarSelection(manifest,picker.value).index));
retry.addEventListener('click',()=>choose(requested));
play.addEventListener('click',()=>{
  if(playing){pause('The display sequence is paused. '+displayedSummary());return;}
  if(!manifest||departed||document.hidden)return;
  // Explicit Play reveals its observation without an animated page movement.
  // Manual stepping and timed image updates never initiate their own scrolling.
  if(!inView())figure.scrollIntoView({block:'nearest',behavior:'instant'});
  if(!inView()){status.textContent='The radar image could not be brought into view. Scroll to its source record before playing.';return;}
  playing=true;notice='';retry.hidden=true;buttons();
  if(shown===manifest.frames.length-1)choose(0,false);
  else if(attempt||requested!==shown||figure.dataset.state!=='ready')choose(requested,false);
  else{status.textContent='Playing the retained observations with at least one second for each checked image. This does not advance the Atlas clock.';arm();}
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)pause('The display sequence stopped while the page was hidden. It will not restart automatically.');
});
preference.addEventListener('change',event=>{
  if(event.matches)pause('The display sequence stopped for reduced motion. The observation controls remain available.');
});
const observer=new IntersectionObserver(()=>{
  // A queued entry may precede the explicit reveal. Read current geometry.
  if(!inView()&&playing)pause('The display sequence stopped while the image was out of view. It will not restart automatically.');
});
observer.observe(figure);
window.addEventListener('pagehide',()=>{
  departed=true;initVersion++;initController?.abort();clearTimeout(initTimer);pause('',true);
  image.hidden=true;image.removeAttribute('src');
  if(displayURL)URL.revokeObjectURL(displayURL);displayURL=null;
  unavailableRecord();
  figure.dataset.state='retired';figure.setAttribute('aria-busy','false');retry.hidden=true;buttons();
  status.textContent='The reader retired its image while leaving the page. Its source links remain available.';
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;
  departed=false;
  if(manifest){const selection=radarSelection(manifest,new URL(location.href).searchParams.get('frame'));choose(selection.index,false,false);}
  else initialize();
});

async function initialize(){
  const version=++initVersion;
  initController?.abort();initController=new AbortController();const controller=initController;
  clearTimeout(initTimer);initTimer=setTimeout(()=>controller.abort(),deadlineMs);
  try{
    const {data}=await loadEventPackage('el-reno-2013',{fetcher:(path,init)=>fetch(path,{...init,signal:controller.signal})});
    if(version!==initVersion||departed)return;
    manifest=validateRadarSource(data.timeline_media);
    const options=manifest.frames.map((frame,index)=>{
      const option=document.createElement('option');option.value=String(frame.frame_index);
      option.textContent=(index+1)+' of '+manifest.frames.length+' / '+stamp(frame)+' / GIF index '+frame.frame_index;return option;
    });
    picker.replaceChildren(...options);controls.hidden=false;reload.hidden=true;
    const selection=radarSelection(manifest,new URL(location.href).searchParams.get('frame'));
    requested=selection.index;notice=selection.unknown?'That observation is not in the retained selection. The first observation is shown. ':'';
    buttons();choose(selection.index,false);
  }catch{
    if(version!==initVersion||departed)return;
    controls.hidden=true;reload.hidden=false;reload.href=location.href;
    const retired=!image.getAttribute('src')||image.hidden||(image.complete&&!image.naturalWidth);
    if(retired)unavailableRecord();
    status.textContent='The observation browser could not verify its source package. '
      +(retired?'No radar image is currently displayed. ':'The original comparison below remains outside this browser check. ')
      +'The original source links remain available. Reload to retry.';
  }finally{
    if(version===initVersion){clearTimeout(initTimer);initTimer=null;initController=null;}
  }
}
initialize();
