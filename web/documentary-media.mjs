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
