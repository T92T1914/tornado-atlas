import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
const sequence=data.appearance_timeline.photo_sequences.find(row=>row.id==='wakimoto-visible-margin');
const url=seconds=>base+'/reconstruction.html?event=el-reno-2013&t='+seconds+'&appearance_view=photo&appearance_photo='+sequence.id;
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function ready(page,seconds=1261){
  await page.goto(url(seconds));await page.locator('#replay-time:not([disabled])').waitFor();
  await page.waitForFunction(()=>document.querySelector('#replay-appearance-canvas').dataset.evidenceState==='photo_observed');
  await painted(page);
}
async function capture(page,name){
  const folder=process.env.ATLAS_PARTIAL_FORM_CAPTURE;if(!folder)return;
  await mkdir(folder,{recursive:true});await page.screenshot({path:path.join(folder,name+'.png'),fullPage:false});
}
async function contrastProbe(page){
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const gl=get.call(this,kind,...args);if(this.id!=='replay-appearance-canvas'||kind!=='webgl2'||!gl)return gl;
      const canvas=this,draw=gl.drawArrays;
      gl.drawArrays=function(...args){
        const result=draw.apply(this,args);if(args[0]!==gl.TRIANGLES)return result;
        const bytes=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        let core=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i+3]>bytes[core+3])core=i;
        const background=getComputedStyle(canvas).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number);
        const alpha=bytes[core+3]/255;
        // Existing blending leaves premultiplied RGB in the framebuffer.
        const composite=background.map((value,i)=>bytes[core+i]+value*(1-alpha));
        const luminance=rgb=>rgb.map(value=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
        const foregroundL=luminance(composite),backgroundL=luminance(background);
        window.marginContrast={theme:getComputedStyle(canvas).colorScheme,alpha,rgba:[...bytes.slice(core,core+4)],background,composite,contrast:(Math.max(foregroundL,backgroundL)+.05)/(Math.min(foregroundL,backgroundL)+.05)};
        return result;
      };return gl;
    };
  });
}
async function coreContrast(page,theme,t){
  const available=await page.evaluate(()=>Boolean(window.marginContrast));
  if(!available){t.diagnostic('No actual WebGL contrast sample in this engine.');return;}
  await page.waitForFunction(theme=>window.marginContrast?.theme===theme,theme);
  const record=await page.evaluate(()=>window.marginContrast);
  assert.ok(record.alpha>.75);assert.ok(record.contrast>=3,JSON.stringify(record));
  t.diagnostic('PARTIAL_FORM_CORE_CONTRAST '+JSON.stringify(record));
}
for(const [width,theme] of [[320,'dark'],[1280,'light']])test('partial margin and original-source record remain readable at '+width,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.addInitScript(theme=>localStorage.setItem('tornado-atlas-appearance',theme),theme);
  await contrastProbe(page);await ready(page);
  await coreContrast(page,theme,t);
  if(width===1280){
    await page.locator('#reading-appearance').selectOption('dark');await painted(page);await coreContrast(page,'dark',t);
    await page.locator('#reading-appearance').selectOption('system');
    for(const colorScheme of ['light','dark']){await page.emulateMedia({colorScheme});await painted(page);await coreContrast(page,colorScheme,t);}
    await page.locator('#reading-appearance').selectOption(theme);await painted(page);await coreContrast(page,theme,t);
    assert.equal(await page.locator('#replay-time').inputValue(),'1261');
  }
  assert.equal(await page.locator('html').getAttribute('data-appearance'),theme);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme);
  const record=await page.locator('#replay-photo-record').textContent();
  const sample=sequence.samples[0];
  for(const text of [sample.partial_form.component,sample.partial_form.basis,sample.partial_form.use_basis,...sample.partial_form.limits])assert.ok(record.includes(text));
  assert.match(await page.locator('#replay-appearance-state').textContent(),/Independently authored partial margin/);
  assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),sample.image.original_url);
  assert.equal(await page.locator('#replay-appearance img').count(),0);
  // Double actual computed sizes, preserving native controls and full declarations.
  const enlargement=await page.evaluate(()=>{const rows=[...document.querySelectorAll('#replay-appearance *')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const [node,size] of rows)node.style.fontSize=(size*2)+'px';return {count:rows.length,doubled:rows.every(([node,size])=>Math.abs(parseFloat(getComputedStyle(node).fontSize)-size*2)<.1)};});
  assert.ok(enlargement.count>0);
  assert.equal(enlargement.count,await page.locator('#replay-appearance *').count());
  assert.equal(enlargement.doubled,true);
  t.diagnostic('PARTIAL_FORM_READING '+JSON.stringify({width,theme,enlargement}));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.locator('#replay-appearance-canvas').scrollIntoViewIfNeeded();await painted(page);
  await capture(page,width+'-partial-margin');
  await page.locator('#replay-photo-original').scrollIntoViewIfNeeded();await capture(page,width+'-source-record');
  await page.locator('[data-photo-sample="wakimoto-232509"]').click();
  assert.equal(new URL(page.url()).searchParams.get('t'),'1269');
  await page.locator('#replay-time').fill('1265');await painted(page);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.match(await page.locator('#replay-appearance-state').textContent(),/unknown at this exact clock instant/);
  assert.equal(await page.locator('#replay-photo-record').textContent(),'');
  await page.locator('#replay-appearance-state').scrollIntoViewIfNeeded();await capture(page,width+'-unknown-gap');
  await page.goBack();await page.waitForFunction(()=>new URL(location.href).searchParams.get('t')==='1261');
  await painted(page);assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-form'),'true');
  await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'photo:'+sequence.id);
});

test('partial margin draw clears on fractional playback, seeking and appearance switching',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const gl=get.call(this,kind,...args);if(this.id!=='replay-appearance-canvas'||kind!=='webgl2'||!gl)return gl;
      window.partialDraws={clears:0,triangles:0,lines:0,points:0,partialAlpha:0};
      const clear=gl.clear,draw=gl.drawArrays;
      gl.clear=function(...args){window.partialDraws.clears++;return clear.apply(this,args);};
      gl.drawArrays=function(...args){
        const result=draw.apply(this,args);const record=window.partialDraws;
        if(args[0]===gl.TRIANGLES){record.triangles++;const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);record.partialAlpha=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])record.partialAlpha++;}
        if(args[0]===gl.LINES)record.lines++;if(args[0]===gl.POINTS)record.points++;
        return result;
      };return gl;
    };
  });
  await ready(page);
  const graphics=await page.evaluate(()=>Boolean(window.partialDraws));
  if(graphics){const draw=await page.evaluate(()=>({...window.partialDraws}));assert.ok(draw.triangles>0);assert.ok(draw.partialAlpha>0);assert.equal(draw.lines,0);assert.equal(draw.points,0);t.diagnostic('PARTIAL_FORM_ACTUAL_GL '+JSON.stringify(draw));}
  else t.diagnostic('WebGL2 unavailable: qualified text and source route tested, actual draw is unverified in this engine.');
  for(const seconds of ['1261.25','1265','1268.99']){
    const previous=graphics?await page.evaluate(()=>({...window.partialDraws})):null;
    await page.locator('#replay-time').fill(seconds);await painted(page);
    assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-form'),'false');
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
    if(graphics){const draw=await page.evaluate(()=>({...window.partialDraws}));assert.ok(draw.clears>previous.clears);assert.equal(draw.triangles,previous.triangles);assert.equal(draw.points,0);}
  }
  await page.locator('[data-photo-sample="wakimoto-232501"]').click();await painted(page);
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>document.querySelector('#replay-appearance-canvas').dataset.partialForm==='false');
  await page.locator('#replay-play').click();
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  await page.locator('[data-photo-sample="wakimoto-232509"]').click();await painted(page);
  await page.locator('#replay-appearance-mode').selectOption('photo:nolte-reported-stills');await painted(page);
  assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-form'),'false');
  await page.locator('#replay-appearance-mode').selectOption('source');await painted(page);
  assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-form'),'false');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
});


test('graphics recovery restores the currently selected exact margin or unknown gap',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900}});await ready(page);
  const available=await page.locator('#replay-appearance-canvas').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');window.marginLossExtension=gl?.getExtension('WEBGL_lose_context');
    return Boolean(window.marginLossExtension);
  });
  if(!available){t.diagnostic('Actual context-loss extension unavailable; recovery remains unverified in this engine.');return;}
  for(const [destination,expected] of [['1265',false],['1261',true]]){
    await page.evaluate(()=>window.marginLossExtension.loseContext());
    await page.waitForFunction(()=>document.querySelector('#replay-appearance-renderer-status').textContent.includes('lost its graphics context'));
    await page.locator('#replay-time').fill(destination);await painted(page);
    assert.equal(await page.locator('#replay-photo-record').textContent()==='',!expected);
    await page.evaluate(()=>window.marginLossExtension.restoreContext());
    await page.waitForFunction(()=>document.querySelector('#replay-appearance-renderer-status').textContent==='');
    await painted(page);
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),expected);
    assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-partial-form'),String(expected));
    const gl=await page.locator('#replay-appearance-canvas').evaluate(canvas=>canvas.getContext('webgl2')?.getError());
    assert.equal(gl,0);
  }
  t.diagnostic('PARTIAL_FORM_ACTUAL_CONTEXT_RECOVERY exact-to-gap and gap-to-exact passed.');
});
