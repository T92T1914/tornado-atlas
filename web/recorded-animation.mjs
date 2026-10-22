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
