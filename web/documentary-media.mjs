// Documentary players load only after the reader chooses a specific source.
for(const card of document.querySelectorAll('[data-documentary-video]')){
 const id=card.dataset.documentaryVideo,button=card.querySelector('button'),slot=card.querySelector('[data-video-slot]'),status=card.querySelector('[data-video-status]');
 if(!/^[A-Za-z0-9_-]{11}$/.test(id)||!button||!slot||!status)continue;
 let frame=null;button.hidden=false;
 const close=()=>{frame?.remove();frame=null;slot.hidden=true;button.textContent='Load video here';button.setAttribute('aria-expanded','false');status.textContent='';};
 button.addEventListener('click',()=>{
  if(frame){close();return;}
  frame=document.createElement('iframe');
  const url=new URL('https://www.youtube-nocookie.com/embed/'+id);
  url.searchParams.set('autoplay','0');url.searchParams.set('playsinline','1');url.searchParams.set('rel','0');
  frame.src=url.href;frame.title=card.dataset.videoTitle||'Documentary source video';
  frame.width='640';frame.height='360';frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
  slot.hidden=false;slot.replaceChildren(frame);button.textContent='Close video';button.setAttribute('aria-expanded','true');
  status.textContent='YouTube player opened below. The original source link remains available.';
 });
 window.addEventListener('pagehide',close);
}

// Native source-relative clips stay separate from the historical playback clock.
for(const clip of document.querySelectorAll('[data-documentary-clip]')){
 const region=clip.closest('section'),button=region?.querySelector('[data-clip-action]'),status=region?.querySelector('[data-clip-status]');
 if(!button||!status)continue;
 button.hidden=false;
 let failed=false,attempt=0;const failedSources=new Set(),sources=[...clip.querySelectorAll('source')];
 const unavailable=()=>{failed=true;button.textContent='Retry short clip';status.textContent='The clip could not load. Retry, open an alternate format or follow the archived source link.';};
 clip.addEventListener('loadstart',()=>{failed=false;failedSources.clear();});
 for(const source of sources)source.addEventListener('error',()=>{failedSources.add(source);if(failedSources.size===sources.length)unavailable();});
 const paused=()=>{button.textContent=(clip.error||failed)?'Retry short clip':'Play short clip';};
 clip.addEventListener('play',()=>{
  if(document.hidden){clip.pause();return;}
  button.textContent='Pause short clip';status.textContent='Playing the silent source-relative passage. The historical clock is unchanged.';
 });
 clip.addEventListener('pause',()=>{paused();if(!clip.error)status.textContent='Clip paused. Use the native controls to examine a moment.';});
 clip.addEventListener('ended',()=>{paused();status.textContent='Passage ended. Replay or examine a moment with the native controls.';});
 clip.addEventListener('error',unavailable);
 button.addEventListener('click',()=>{
  if(!clip.paused&&!failed&&!clip.error){attempt++;clip.pause();return;}
  if(clip.error||failed)clip.load();
  const ownedAttempt=++attempt;
  clip.play().catch(()=>{if(ownedAttempt!==attempt)return;paused();status.textContent='Playback did not start. Use the native controls, retry or open an alternate format below.';});
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){attempt++;clip.pause();}});
 window.addEventListener('pagehide',()=>{attempt++;clip.pause();});
}
