import {checkedPhotoBytes} from './photo-view.mjs';
// The source GIF is loaded only after the visitor chooses motion.
export function mountRecordedAnimations(root=document){
 const owners=[];
 for(const card of root.querySelectorAll('[data-recorded-animation]')){
  const poster=card.querySelector('img'),button=card.querySelector('[data-animation-action]'),status=card.querySelector('[data-animation-status]');
  const source=card.dataset.recordedAnimation;
  if(!poster||!button||!status||!/^assets\/[a-z0-9_/-]+\.gif$/.test(source))continue;
  let current=poster,pending=null,version=0,playing=false,disposed=false,timeout=null;
  const initial=status.textContent;
  button.hidden=false;button.setAttribute('aria-pressed','false');
  function cancel(){clearTimeout(timeout);timeout=null;if(pending){pending.onload=null;pending.onerror=null;pending.removeAttribute('src');pending=null;}}
  function stop(message=initial){
   version++;cancel();playing=false;
   if(current!==poster){current.replaceWith(poster);current.removeAttribute('src');current=poster;}
   button.textContent='Play radar animation';button.setAttribute('aria-pressed','false');status.textContent=message;
  }
  function play(){
   if(disposed||document.hidden)return;
   const token=++version;cancel();
   const image=poster.cloneNode(false);image.removeAttribute('srcset');image.removeAttribute('loading');pending=image;
   playing=true;button.textContent='Stop radar animation';button.setAttribute('aria-pressed','true');status.textContent='Loading the original radar animation.';
   const fail=()=>{if(token!==version||disposed)return;stop('The animation could not load. The first frame and original source links remain available. Choose play to retry.');};
   image.onerror=fail;timeout=setTimeout(fail,10000);
   image.onload=()=>{
    if(token!==version||disposed)return;clearTimeout(timeout);timeout=null;image.onload=null;image.onerror=fail;pending=null;
    current.replaceWith(image);current=image;
    image.alt=card.dataset.animationAlt||poster.alt;status.textContent='Playing the original published animation. Stop returns to the first frame. Playback does not change the Atlas clock.';
   };
   image.src=source;
  }
  const click=()=>playing?stop('Animation stopped. The first frame is shown.'):play();
  const hidden=()=>{if(document.hidden)stop('Animation stopped while the page was hidden. The first frame is shown.');};
  const departure=()=>stop();
  const reduced=event=>{if(event.matches)stop('Animation stopped for reduced motion. Choose play when you want to examine the sequence.');};
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&playing)stop('Animation stopped while it was out of view. The first frame is shown.');});observer.observe(card);
  button.addEventListener('click',click);document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',departure);preference.addEventListener('change',reduced);
  owners.push({stop,dispose(){disposed=true;stop();observer.disconnect();button.removeEventListener('click',click);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',departure);preference.removeEventListener('change',reduced);button.hidden=true;}});
 }
 return owners;
}
mountRecordedAnimations();

const joplinObservations=Object.freeze({
 asset:'assets/joplin-2011/nist-radar-sequence.png',
 expectedSha256:'8d00dd1d87fc1607f855282337b5d1ee9b7d9f35605a5c28d691841e1b77cbd3',
 width:947,height:1326,
 frames:[
  {label:'2224 UTC',gap:null,box:[67,8,396,267]},
  {label:'2229 UTC',gap:5,box:[475,8,398,267]},
  {label:'2234 UTC',gap:5,box:[67,273,396,266]},
  {label:'2239 UTC',gap:5,box:[475,273,398,266]},
  {label:'2243 UTC',gap:4,box:[67,536,396,266]},
  {label:'2248 UTC',gap:5,box:[475,536,398,266]},
  {label:'2253 UTC',gap:5,box:[67,798,396,266]},
 ]
});

export function mountRecordedObservations(root=document){
 const owners=[];
 for(const card of root.querySelectorAll('[data-recorded-observations="joplin-nist-seven"]')){
  const source=joplinObservations,frames=source.frames,controls=card.querySelector('[data-observation-controls]');
  const play=card.querySelector('[data-observation-play]'),prev=card.querySelector('[data-observation-prev]'),next=card.querySelector('[data-observation-next]');
  const picker=card.querySelector('[data-observation-picker]'),stage=card.querySelector('[data-observation-stage]'),svg=stage?.querySelector('svg');
  const title=svg?.querySelector('title'),label=card.querySelector('[data-observation-label]'),status=card.querySelector('[data-observation-status]');
  if(!controls||!play||!prev||!next||!picker||!stage||!svg||!title||!label||!status)continue;
  let image=svg.querySelector('image');if(!image)continue;
  let shown=0,requested=0,playing=false,disposed=false,version=0,timer=null,attempt=null,displayURL=null;
  const preference=matchMedia('(prefers-reduced-motion: reduce)'),dwell=1500;
  const clearTimer=()=>{clearTimeout(timer);timer=null;};
  const inView=()=>{const r=stage.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0;};
  const buttons=()=>{play.textContent=playing?'Stop observations':shown===frames.length-1?'Play from first observation':'Play observations';play.setAttribute('aria-pressed',String(playing));picker.value=String(requested);prev.disabled=requested===0;next.disabled=requested===frames.length-1;};
  function retireAttempt(){
   version++;const old=attempt;attempt=null;if(!old)return;
   clearTimeout(old.timer);old.controller.abort();old.probe.onload=old.probe.onerror=null;old.probe.removeAttribute('src');
   if(old.element){old.element.onload=old.element.onerror=null;old.element.removeAttribute('href');old.element.remove();}
   if(old.url)URL.revokeObjectURL(old.url);
  }
  function draw(index){
   shown=requested=index;const frame=frames[index];svg.setAttribute('viewBox',frame.box.join(' '));
   title.textContent='NOAA and NIST paired observation '+frame.label+', radial velocity at left and reflectivity at right.';
   label.textContent='Displayed pair '+(index+1)+' of 7: '+frame.label+' on May 22, 2011. '+(frame.gap===null?'First retained observation.':frame.gap+' minutes after the preceding retained label.');
   svg.dataset.sourceAsset=source.asset;svg.dataset.sourceSha256=source.expectedSha256;svg.dataset.observationIndex=String(index);
   stage.hidden=false;buttons();
  }
  function stop(message='Observation display stopped. The first retained pair is shown.'){
   playing=false;clearTimer();retireAttempt();if(displayURL)draw(0);else{requested=shown;buttons();}status.textContent=message;
  }
  function arm(){
   clearTimer();if(!playing||disposed||document.hidden)return;
   if(!inView()){stop('Observation display stopped while its image was out of view. It will not restart automatically.');return;}
   if(shown===frames.length-1){playing=false;buttons();status.textContent='The seventh retained pair is shown. The display sequence has stopped.';return;}
   const token=version,ownedTimer=setTimeout(()=>{if(timer!==ownedTimer||token!==version)return;timer=null;if(playing&&!disposed&&!document.hidden)choose(shown+1,false);},dwell);timer=ownedTimer;
  }
  function ready(index){draw(index);status.textContent=playing?'Playing selected report observations with at least 1.5 seconds per pair. Their historical gaps remain four or five minutes.':'The selected source pair is shown. The complete original figure and caption remain below.';arm();}
  function choose(index,manual=true){
   if(disposed||document.hidden||!Number.isInteger(index)||index<0||index>=frames.length)return;
   if(manual){playing=false;clearTimer();}retireAttempt();requested=index;buttons();
   if(displayURL){ready(index);return;}
   const owned={controller:new AbortController(),probe:new Image(),element:null,url:null,timer:null,deadline:performance.now()+10000,token:version};attempt=owned;
   const owns=()=>attempt===owned&&owned.token===version&&!disposed;
   const fail=()=>{if(!owns())return;retireAttempt();playing=false;clearTimer();requested=shown;buttons();status.textContent='The observation image could not be checked or displayed. The complete original figure and source links remain below. Choose Play or an observation to retry.';};
   const live=()=>{if(!owns())return false;if(performance.now()>=owned.deadline){fail();return false;}return true;};
   status.textContent='Checking the complete source figure for requested '+frames[index].label+'. '+(displayURL?'The previous pair keeps its own label.':'The unchanged complete source figure remains below.');
   owned.timer=setTimeout(fail,10000);
   owned.probe.onerror=fail;
   owned.probe.onload=async()=>{
    if(!live())return;try{await owned.probe.decode();}catch{fail();return;}
    if(!live())return;if(owned.probe.naturalWidth!==source.width||owned.probe.naturalHeight!==source.height){fail();return;}
    const candidate=document.createElementNS('http://www.w3.org/2000/svg','image');owned.element=candidate;
    candidate.setAttribute('width',String(source.width));candidate.setAttribute('height',String(source.height));
    candidate.onload=()=>{
     if(!live())return;clearTimeout(owned.timer);candidate.onload=candidate.onerror=null;owned.probe.onload=owned.probe.onerror=null;owned.probe.removeAttribute('src');
     image.replaceWith(candidate);image=candidate;displayURL=owned.url;owned.url=null;owned.element=null;attempt=null;ready(index);
    };
    candidate.onerror=fail;candidate.setAttribute('href',owned.url);svg.append(candidate);
   };
   checkedPhotoBytes(source,{signal:owned.controller.signal,deadline:owned.deadline}).then(({bytes,type})=>{
    if(!live())return;
    if(typeof URL.createObjectURL!=='function'||typeof URL.revokeObjectURL!=='function')throw Error('Checked display unavailable');
    owned.url=URL.createObjectURL(new Blob([bytes],{type}));owned.probe.src=owned.url;
   }).catch(fail);
  }
  const toggle=()=>{if(playing){stop();return;}if(disposed||document.hidden)return;playing=true;choose(shown===frames.length-1?0:shown,false);};
  const previous=()=>choose(Math.max(0,requested-1)),following=()=>choose(Math.min(frames.length-1,requested+1));
  const select=()=>choose(Number(picker.value));
  const hidden=()=>{if(document.hidden)stop('Observation display stopped while the page was hidden. It will not restart automatically.');};
  const reduced=event=>{if(event.matches)stop('Observation display stopped for reduced motion. Manual observations remain available.');};
  const departure=()=>{stop('Observation display stopped on departure.');image.removeAttribute('href');if(displayURL)URL.revokeObjectURL(displayURL);displayURL=null;stage.hidden=true;};
  const observer=new IntersectionObserver(()=>{if(playing&&displayURL&&!inView())stop('Observation display stopped while its image was out of view. It will not restart automatically.');});observer.observe(stage);
  play.addEventListener('click',toggle);prev.addEventListener('click',previous);next.addEventListener('click',following);picker.addEventListener('change',select);
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',departure);preference.addEventListener('change',reduced);
  controls.hidden=false;buttons();
  owners.push({stop,dispose(){disposed=true;departure();observer.disconnect();play.removeEventListener('click',toggle);prev.removeEventListener('click',previous);next.removeEventListener('click',following);picker.removeEventListener('change',select);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',departure);preference.removeEventListener('change',reduced);controls.hidden=true;}});
 }
 return owners;
}

mountRecordedObservations();
