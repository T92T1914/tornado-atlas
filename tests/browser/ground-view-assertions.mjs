import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

// Literal values independently derived with scalar camera equations.
export const referencePixels={
  'synthetic-front':[[378.495994,527.767363],[640,201.835710],[901.504006,527.767363],[640,527.767363]],
  'synthetic-oblique':[[457.208888,520.073871],[640,205.988617],[889.537300,526.571085],[640,522.820933]],
};
const worldMarks=[[-2,0,0],[0,2.6,0],[2,0,0],[0,0,0]];
export async function referenceReady(page,id,seconds){
  await page.waitForFunction(({id,seconds})=>{
    const image=document.querySelector('#ground-reference-image');
    return image&&!image.hidden&&image.complete&&image.naturalWidth===1280&&image.naturalHeight===720&&
      image.getAttribute('src')===`assets/ground-view-demo/${id}-${seconds}.svg`;
  },{id,seconds});
}
export async function reflow(page){
  const geometry=await page.evaluate(()=>{
    const result={viewport:innerWidth,root:document.documentElement.scrollWidth,body:document.body.scrollWidth,nodes:[],omitted:0};
    if(result.root<=innerWidth+1)return result;
    try{
    const seen=new Set(),add=(node,basis)=>{
      if(!node||seen.has(node))return;seen.add(node);
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      result.nodes.push({basis,id:node.id,tag:node.tagName,class:node.className?.toString().slice(0,96),
        x:r.x+scrollX,right:r.right+scrollX,width:r.width,scrollWidth:node.scrollWidth,
        font:s.fontSize,family:s.fontFamily.slice(0,96),appearance:s.appearance,
        cssWidth:s.width,minWidth:s.minWidth,maxWidth:s.maxWidth,overflow:s.overflow,display:s.display});
    };
    for(const id of ['ground-camera','ground-quality','reading-appearance','replay-camera-sample','replay-appearance-mode']){
      const n=document.getElementById(id);add(n,'named');add(n?.parentElement,'parent');add(n?.parentElement?.parentElement,'ancestor');
    }
    let scanned=0,outside=0;
    for(const n of document.body.querySelectorAll('*')){
      if(scanned++>=2000){result.omitted++;break;}
      const r=n.getBoundingClientRect();
      if(n.getClientRects().length&&(r.right+scrollX>innerWidth+1||r.left+scrollX< -1)){
        if(outside++<6)add(n,'outside-document');else result.omitted++;
      }
    }
    }catch(error){result.diagnostic_error=String(error).slice(0,240);}
    return result;
  });
  if(geometry.root>geometry.viewport+1){
    while(Buffer.byteLength(JSON.stringify(geometry))>8192&&geometry.nodes.length){geometry.nodes.pop();geometry.omitted++;}
    console.error('GROUND_REFLOW_DIAGNOSTIC '+JSON.stringify(geometry));
  }
  assert.equal(geometry.root<=geometry.viewport+1,true,'The document reflows without horizontal overflow');
}
export async function enlargeText(page){
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')].filter(n=>n instanceof HTMLElement);const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
}

export async function nativeSnapshot(page,seconds,id){
  const supported=await page.locator('#replay-appearance-canvas').evaluate(canvas=>Boolean(canvas.getContext('webgl2')));
  if(!supported){
    assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start|lost/);
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must supply actual rendered-scene evidence');
    await page.locator('#replay-time').fill(String(seconds));
    const observed=await page.locator('#replay-time').inputValue();
    const selectedCamera=await page.locator('#replay-appearance-canvas').getAttribute('data-source-camera');
    assert.equal(observed,String(seconds),'The unavailable path still selects the requested time');
    assert.equal(selectedCamera,id,'The unavailable path retains the selected source camera');
    const unavailable={available:false,time:Number(observed),selectedCamera,scope:'DOM and unavailable-WebGL behavior only'};
    console.log('GROUND_NATIVE_UNAVAILABLE '+JSON.stringify(unavailable));return unavailable;
  }
  await page.evaluate(({expected,seconds,id})=>{
    const canvas=document.querySelector('#replay-appearance-canvas'),gl=canvas.getContext('webgl2');
    const input=document.querySelector('#replay-time');
    window.groundNativeSnapshot=null;
    const order={input:null,preInputDraws:[],omittedPreInputDraws:0};
    const arm=event=>{order.input={value:Number(input.value),isTrusted:event.isTrusted,at:performance.now()};};
    input.addEventListener('input',arm,{capture:true,once:true});
    const original=gl.drawArrays;
    const captureDraw=function(...args){
      const result=original.apply(this,args);
      if(args[0]!==gl.POINTS)return result;
      if(!order.input){
        if(order.preInputDraws.length<8){const p=gl.getParameter(gl.CURRENT_PROGRAM);order.preInputDraws.push({time:gl.getUniform(p,gl.getUniformLocation(p,'time')),at:performance.now()});}
        else order.omittedPreInputDraws++;
        return result;
      }
      gl.drawArrays=original;
      try{
        const program=gl.getParameter(gl.CURRENT_PROGRAM),viewport=Array.from(gl.getParameter(gl.VIEWPORT));
        const uniform=name=>gl.getUniform(program,gl.getUniformLocation(program,name));
        const marks=expected.map(([x,y])=>{
          const px=Math.floor(viewport[0]+x/1280*viewport[2]),py=Math.floor(viewport[1]+(1-y/720)*viewport[3]);
          const pixels=new Uint8Array(9*9*4);gl.readPixels(px-4,py-4,9,9,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          return {x:px,y:py,maxAlpha:Math.max(...pixels.filter((_,i)=>i%4===3))};
        });
        const corner=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,corner);
        const rect=canvas.getBoundingClientRect(),debug=gl.getExtension('WEBGL_debug_renderer_info');
        window.groundNativeSnapshot={available:true,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),
          reportedBackend:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
          matrix:Array.from(uniform('camera')),shape:Array.from(uniform('shape')),time:uniform('time'),
          pointScale:uniform('viewportHeight'),spriteAspect:Array.from(uniform('spriteAspect')),
          viewport,buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],css:[canvas.clientWidth,canvas.clientHeight],borderBox:[rect.width,rect.height],pixelRatio:devicePixelRatio,
          marks,cornerAlpha:corner[3],scissor:gl.isEnabled(gl.SCISSOR_TEST),lost:gl.isContextLost(),error:gl.getError(),pointCount:args[2],
          order,requested:{seconds,id},selectedCamera:canvas.dataset.sourceCamera};
      }catch(error){window.groundNativeSnapshot={error:String(error),available:true};}
      return result;
    };
    gl.drawArrays=captureDraw;
    window.groundNativeCleanup=()=>{
      input.removeEventListener('input',arm,true);
      if(gl.drawArrays===captureDraw)gl.drawArrays=original;
    };
  },{expected:referencePixels[id],seconds,id});
  let originalFailure=null,result=null;
  try{
  await page.locator('#replay-time').fill(String(seconds));
  await page.waitForFunction(()=>window.groundNativeSnapshot!==null);
  result=await page.evaluate(()=>window.groundNativeSnapshot);
  assert.equal(result.error,0,JSON.stringify(result));assert.equal(result.lost,false);assert.equal(result.scissor,true);
  assert.equal(result.order?.input.value,seconds,'The snapshot follows the original requested slider input');
  assert.equal(result.selectedCamera,id,'The first post-input draw uses the selected source camera');
  assert.equal(result.time,seconds);assert.ok(result.marks[0].maxAlpha>100&&result.marks[2].maxAlpha>100,'Native graphics painted the two independent ground marks');
  for(let i=0;i<worldMarks.length;i++){
    const p=[...worldMarks[i],1],clip=[0,1,2,3].map(row=>p.reduce((sum,v,col)=>sum+result.matrix[col*4+row]*v,0));
    assert.ok(Math.abs((clip[0]/clip[3]+1)*640-referencePixels[id][i][0])<.01);
    assert.ok(Math.abs((1-clip[1]/clip[3])*360-referencePixels[id][i][1])<.01);
  }
  const [cw,ch]=result.css,scale=Math.min(result.pixelRatio,2,2048/cw,1600/ch);
  assert.deepEqual(result.buffer,[Math.max(1,Math.round(cw*scale)),Math.max(1,Math.round(ch*scale))]);
  const [w,h]=result.buffer,fit=Math.min(w/1280,h/720);
  assert.deepEqual(result.viewport,[Math.floor((w-1280*fit)/2),Math.floor((h-720*fit)/2),Math.max(1,Math.round(1280*fit)),Math.max(1,Math.round(720*fit))]);
  if(result.viewport[0]>0||result.viewport[1]>0)assert.equal(result.cornerAlpha,0,'Letterbox stays clear');
  console.log('GROUND_NATIVE '+JSON.stringify({id,seconds,...result}));return result;
  }catch(error){
    originalFailure=error;
    console.error('GROUND_NATIVE_FAILURE '+JSON.stringify({id,seconds,error:String(error).slice(0,500),snapshot:result}));
    throw error;
  }finally{
    try{await page.evaluate(()=>{const cleanup=window.groundNativeCleanup;window.groundNativeCleanup=null;cleanup?.();});}
    catch(error){if(!originalFailure)throw error;console.error('GROUND_NATIVE_CLEANUP_FAILURE '+String(error).slice(0,500));}
  }
}

export async function observeReferenceRetry(page){
  const network=[],counts={omitted:0};
  const record=(event,request,response=null)=>{
    if(!new URL(request.url()).pathname.endsWith('/assets/ground-view-demo/synthetic-front-120.svg'))return;
    if(network.length>=24){counts.omitted++;return;}
    network.push({event,method:request.method(),type:request.resourceType(),status:response?.status()??null,
      failure:request.failure()?.errorText?.slice(0,160)??null});
  };
  const handlers={request:r=>record('request',r),response:r=>record('response',r.request(),r),
    requestfinished:r=>record('finished',r),requestfailed:r=>record('failed',r)};
  for(const [event,handler]of Object.entries(handlers))page.on(event,handler);
  await page.addInitScript(()=>{
    window.groundReferenceEvents={rows:[],omitted:0};
    for(const type of ['keydown','keyup','click','focusin','load','error'])document.addEventListener(type,event=>{
      if(!event.target?.id?.startsWith('ground-reference-'))return;
      const trace=window.groundReferenceEvents;
      if(trace.rows.length>=24){trace.omitted++;return;}
      trace.rows.push({type,id:event.target.id,key:event.key??null,isTrusted:event.isTrusted,at:performance.now()});
    },true);
  });
  return {
    stop(){for(const [event,handler]of Object.entries(handlers))page.off(event,handler);},
    async report(error,attempts){
      let timer;
      const state=await Promise.race([page.evaluate(()=>{
        const image=document.querySelector('#ground-reference-image'),retry=document.querySelector('#ground-reference-retry');
        return {time:document.querySelector('#replay-time')?.value,camera:document.querySelector('#ground-camera')?.value,
          active:document.activeElement?.id,status:document.querySelector('#ground-reference-status')?.textContent?.slice(0,320),
          image:image?{src:image.getAttribute('src'),hidden:image.hidden,complete:image.complete,width:image.naturalWidth,height:image.naturalHeight}:null,
          retry:retry?{hidden:retry.hidden,disabled:retry.disabled,ariaDisabled:retry.getAttribute('aria-disabled')}:null,
          events:window.groundReferenceEvents};
      }).catch(e=>({unavailable:String(e).slice(0,200)})),new Promise(resolve=>{timer=setTimeout(()=>resolve({unavailable:'Owned diagnostic exceeded500ms'}),500);})]);
      clearTimeout(timer);
      const diagnostic={original_error:String(error).slice(0,500),attempts,network,counts,state};
      while(Buffer.byteLength(JSON.stringify(diagnostic))>8192&&(network.length||state.events?.rows?.length)){
        if(network.length)network.pop();else state.events.rows.pop();counts.omitted++;
      }
      console.error('GROUND_RETRY_DIAGNOSTIC '+JSON.stringify(diagnostic));
    }
  };
}

export async function saveCapture(page,name){
  if(!process.env.ATLAS_GROUND_CAPTURE_DIR)return;
  assert.match(name,/^[a-z0-9-]+\.png$/);
  const target=page.locator('#replay-appearance-drawing'),box=await target.boundingBox();
  assert.ok(box&&box.width<=2048&&box.height<=12000);
  const bytes=await target.screenshot({animations:'allow',timeout:10000});
  assert.ok(bytes.length<=4194304);
  await mkdir(process.env.ATLAS_GROUND_CAPTURE_DIR,{recursive:true});
  await writeFile(join(process.env.ATLAS_GROUND_CAPTURE_DIR,name),bytes,{flag:'wx'});
  console.log('GROUND_CAPTURE '+JSON.stringify({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),time:await page.locator('#replay-time').inputValue()}));
}
