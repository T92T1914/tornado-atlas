// A touch journey starts from a positioned, stationary link. Playwright's tap
// actionability check precedes its automatic scroll, and its tap interceptor does
// not observe the later click. Keep the actual touch and route assertions intact.
export async function waitForSettledTouchTarget(page, target, {timeout=10000}={}) {
  const handle=await target.elementHandle();
  if(!handle)throw new Error('The intended touch target is absent');
  await handle.evaluate(node=>{
    window.__atlasTouchTargetReadiness??=new WeakMap();
    window.__atlasTouchTargetReadiness.set(node,{signature:null,stableFrames:0,state:null});
  });
  let settled;
  try{
    settled=await page.waitForFunction(node=>{
      const record=window.__atlasTouchTargetReadiness.get(node);
      const rects=[...node.getClientRects()].map(r=>[r.x,r.y,r.width,r.height]);
      const viewport=visualViewport;
      const state={scroll:[scrollX,scrollY],viewport:[innerWidth,innerHeight],
        visualViewport:viewport?[viewport.offsetLeft,viewport.offsetTop,viewport.width,viewport.height,viewport.scale]:null,
        rectangles:rects};
      const first=rects.find(([x,y,w,h])=>w>0&&h>0&&x>=0&&y>=0&&x+w<=innerWidth&&y+h<=innerHeight);
      const point=first?[first[0]+first[2]/2,first[1]+first[3]/2]:null;
      const hit=point?document.elementFromPoint(...point):null;
      const onTarget=node.isConnected&&Boolean(hit&&(hit===node||node.contains(hit)));
      const signature=JSON.stringify(state);
      record.stableFrames=onTarget&&signature===record.signature?record.stableFrames+1:0;
      record.signature=signature;
      record.state={...state,point,onTarget,stableFrames:record.stableFrames};
      return record.stableFrames>=3;
    },handle,{timeout,polling:'raf'});
  }catch(error){
    let timer;
    try{
      const state=await Promise.race([
        handle.evaluate(node=>window.__atlasTouchTargetReadiness.get(node)?.state??null).catch(()=>({unavailable:true})),
        new Promise(resolve=>{timer=setTimeout(()=>resolve({unavailable:'Snapshot exceeded 500 ms'}),500);})
      ]);
      console.error('TOUCH_TARGET_READINESS_DIAGNOSTIC '+JSON.stringify(state));
    }finally{clearTimeout(timer);}
    throw error;
  }finally{
    await settled?.dispose().catch(()=>{});
    await handle.dispose().catch(()=>{});
  }
}
