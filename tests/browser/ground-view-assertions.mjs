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
export async function reflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'The document reflows without horizontal overflow');}
export async function enlargeText(page){
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')].filter(n=>n instanceof HTMLElement);const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');});
}

export async function nativeSnapshot(page,seconds,id){
  const supported=await page.locator('#replay-appearance-canvas').evaluate(canvas=>Boolean(canvas.getContext('webgl2')));
  if(!supported){
    assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start|lost/);
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must supply actual rendered-scene evidence');
    return {available:false,scope:'DOM and unavailable-WebGL behavior only'};
  }
  await page.evaluate(expected=>{
    const canvas=document.querySelector('#replay-appearance-canvas'),gl=canvas.getContext('webgl2');
    window.groundNativeSnapshot=null;
    const original=gl.drawArrays;
    gl.drawArrays=function(...args){
      const result=original.apply(this,args);
      if(args[0]!==gl.POINTS)return result;
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
          marks,cornerAlpha:corner[3],scissor:gl.isEnabled(gl.SCISSOR_TEST),lost:gl.isContextLost(),error:gl.getError(),pointCount:args[2]};
      }catch(error){window.groundNativeSnapshot={error:String(error),available:true};}
      return result;
    };
  },referencePixels[id]);
  await page.locator('#replay-time').fill(String(seconds));
  await page.waitForFunction(()=>window.groundNativeSnapshot!==null);
  const result=await page.evaluate(()=>window.groundNativeSnapshot);
  assert.equal(result.error,0,JSON.stringify(result));assert.equal(result.lost,false);assert.equal(result.scissor,true);
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
