import assert from 'node:assert/strict';

// A no-script page can still be completing its native fragment animation when
// load finishes. Sample outside the page before entering locator auto-waiting.
export async function settledFragment(page, fragmentId, photoId) {
  const started=performance.now(),deadline=started+3000;
  let previous=null,stableSince=null,last=null;
  for(let samples=0;samples<30 && performance.now()<deadline;samples++) {
    let timer;
    try {
      last=await Promise.race([
        page.evaluate(({fragmentId,photoId})=>{
          const fragment=document.getElementById(fragmentId);
          const opener=[...document.querySelectorAll('a[data-photo-id]')]
            .find(link=>link.dataset.photoId===photoId);
          const rect=node=>{
            if(!node?.isConnected) return null;
            const value=node.getBoundingClientRect();
            return {x:value.x,y:value.y,width:value.width,height:value.height};
          };
          const section=rect(fragment);
          return {scrollY,viewport:{width:innerWidth,height:innerHeight},fragment:section,opener:rect(opener),
            fragmentInView:Boolean(section && section.width>0 && section.height>0 && section.y>=0 &&
              section.y<innerHeight && section.x<innerWidth && section.x+section.width>0)};
        },{fragmentId,photoId}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Fragment snapshot exceeded its remaining bound')),
          Math.min(200,Math.max(1,deadline-performance.now())));}),
      ]);
    } finally {clearTimeout(timer);}
    const now=performance.now(),key=JSON.stringify(last);
    if(last.fragmentInView && last.opener) {
      if(key!==previous) stableSince=now;
      if(stableSince!==null && now-stableSince>=250) return;
    } else stableSince=null;
    previous=key;
    if(now<deadline) await new Promise(resolve=>setTimeout(resolve,Math.min(100,deadline-now)));
  }
  assert.fail('Initial fragment did not remain visible and steady for 250 ms within 3 s: '+JSON.stringify(last));
}
