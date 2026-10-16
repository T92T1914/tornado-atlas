import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
const SEQUENCE='wakimoto-early-extension';
const SAMPLE='wakimoto-2016-230510';
const SOURCE='wakimoto-2016';
const PAPER='https://repository.library.noaa.gov/view/noaa/32144/noaa_32144_DS1.pdf';
const ORIGINAL=PAPER+'#page=8';
const REPORTED='2013-05-31T23:05:10Z';
const sequence=data.appearance_timeline.photo_sequences.find(row=>row.id===SEQUENCE);
assert.ok(sequence,'Integrated Figure6 source sequence is a prerequisite for this proposal.');
assert.equal(sequence.samples.length,1,'One source-reported observation must stay discrete.');
const sample=sequence.samples[0];
assert.equal(sample.id,SAMPLE);
assert.equal(sample.source_id,SOURCE);
assert.equal(sample.reported_utc,REPORTED);
assert.equal(sample.shape,null);
assert.equal(sample.extent,null);
assert.equal(data.appearance_timeline.schema_version,5);
assert.deepEqual(data.appearance_timeline.windows,[]);
assert.equal(sample.partial_form.kind,'visible_condensation_region');
const source=data.appearance_timeline.photo_sources.find(row=>row.id===SOURCE);
assert.ok(source);
assert.equal(source.sha256,'7ce3c5d8dc1d643417fecddbd802aef3869a9e32ec60d892c973599104c7be50');
assert.equal(sample.image.original_url,ORIGINAL);

const target=seconds=>base+'/reconstruction.html?event=el-reno-2013&t='+seconds+'&appearance_view=photo&appearance_photo='+SEQUENCE;
const painted=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function capture(page,name){
  const folder=process.env.ATLAS_FIG6_PRIVATE_CAPTURE_DIR;
  if(!folder)return;
  await mkdir(folder,{recursive:true});
  await page.screenshot({path:path.join(folder,name+'.png'),fullPage:false});
}
async function installProbe(page,disabled=false){
  await page.addInitScript(disabled=>{
    const get=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      if(disabled&&this.id==='replay-appearance-canvas'&&kind==='webgl2')return null;
      const gl=get.call(this,kind,...args);
      if(this.id!=='replay-appearance-canvas'||kind!=='webgl2'||!gl||seen.has(gl))return gl;
      seen.add(gl);
      const canvas=this,draw=gl.drawArrays,clear=gl.clear,uniform4fv=gl.uniform4fv;
      const record=window.fig6Draws={triangles:0,lines:0,points:0,clears:0,plane:null,last:null,lastUnknownClear:null};
      const read=()=>{
        const bytes=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        let nonzero=0;
        for(let i=3;i<bytes.length;i+=4)if(bytes[i])nonzero++;
        return {bytes,nonzero,error:gl.getError()};
      };
      gl.uniform4fv=function(location,values,...args){
        if(values.length===4)record.plane=Array.from(values);
        return uniform4fv.call(this,location,values,...args);
      };
      gl.clear=function(...args){
        const result=clear.apply(this,args);record.clears++;
        if(record.captureUnknown&&canvas.dataset.evidenceState==='unknown'){
          record.captureUnknown=false;
          const actual=read();
          record.lastUnknownClear={nonzero:actual.nonzero,error:actual.error,clipped:gl.isEnabled(gl.SCISSOR_TEST)};
        }
        return result;
      };
      gl.drawArrays=function(...args){
        const result=draw.apply(this,args);
        if(args[0]===gl.POINTS)record.points++;
        if(args[0]===gl.LINES)record.lines++;
        if(args[0]!==gl.TRIANGLES)return result;
        record.triangles++;
        if(!record.plane)return result;
        const actual=read(),rect=canvas.getBoundingClientRect();
        const at=(x,y)=>{
          const [left,bottom,width,height]=record.plane;
          const px=Math.floor((left+x*width)/rect.width*gl.drawingBufferWidth);
          const py=Math.floor((bottom+y*height)/rect.height*gl.drawingBufferHeight);
          if(px<0||py<0||px>=gl.drawingBufferWidth||py>=gl.drawingBufferHeight)throw new Error('Figure6 probe outside framebuffer');
          const offset=(py*gl.drawingBufferWidth+px)*4;
          return Array.from(actual.bytes.slice(offset,offset+4));
        };
        record.last={nonzero:actual.nonzero,error:actual.error,core:at(.5,.5),rightContext:at(.85,.5),
          lowerOmission:at(.5,.025),upperOmission:at(.5,.985),clippedDuringDraw:gl.isEnabled(gl.SCISSOR_TEST),
          width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
        return result;
      };
      return gl;
    };
  },disabled);
}
async function ready(page,url=target(70)){
  await page.goto(url);
  await page.locator('#replay-time:not([disabled])').waitFor();
  await page.waitForFunction(()=>document.querySelector('#replay-appearance-mode')?.value==='photo:wakimoto-early-extension');
  await selected(page,70,SEQUENCE,true);
}
async function selected(page,seconds,id,observed){
  await page.waitForFunction(expected=>{
    const time=document.querySelector('#replay-time'),mode=document.querySelector('#replay-appearance-mode');
    const canvas=document.querySelector('#replay-appearance-canvas');
    return time?.value===String(expected.seconds)&&mode?.value==='photo:'+expected.id&&
      canvas?.dataset.evidenceState===(expected.observed?'photo_observed':'unknown')&&
      canvas?.dataset.partialKind===(expected.observed?'visible_condensation_region':'');
  },{seconds,id,observed});
  await painted(page);
  const url=new URL(page.url());
  assert.equal(url.searchParams.get('t'),String(seconds));
  assert.equal(url.searchParams.get('appearance_view'),'photo');
  assert.equal(url.searchParams.get('appearance_photo'),id);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
}
async function expectRecord(page){
  const record=await page.locator('#replay-photo-record').textContent();
  for(const expected of [SEQUENCE,REPORTED,'Unquantified.','Physical shape and extent are unassigned.'])
    assert.ok(record.includes(expected),'Missing independent Figure6 source/uncertainty statement: '+expected);
  assert.match(record,/Figure\s*6\s*\(a\)/i);
  assert.match(record,/Unknown: coordinates, bearing, pitch, roll/);
  assert.match(record,/independent|Independen/);
  assert.match(record,/omitt|unresolved|unobserved/i);
  assert.match(record,/ground contact|ground-contact/i);
  assert.match(record,/no duration|has no duration/i);
  // Also check the actual curated declaration is fully consumed, without making
  // those generated values the sole evidence of correct identity or clock.
  for(const expected of [sample.partial_form.component,sample.partial_form.basis,sample.partial_form.use_basis,...sample.partial_form.limits])
    assert.ok(record.includes(expected),'Curated limit or interpretation was dropped.');
  assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),ORIGINAL);
  assert.equal(await page.locator('#replay-photo-original').isVisible(),true);
  assert.equal(await page.locator('#replay-appearance-source').getAttribute('href'),source.url);
  const detail=await page.locator('#replay-appearance-detail').textContent();
  assert.match(detail,/Physical shape, dimensions and camera geometry are unassigned/);
  assert.match(detail,/Ground contact, depth and motion between photographs remain unknown/);
  assert.match(detail,/no duration.*Clock accuracy is unverified/);
  assert.doesNotMatch(detail,/The dark northern area is context/,'Later2015 contextual wording must not describe the new early component.');
  assert.equal(await page.locator('#replay-appearance img,#replay-appearance iframe').count(),0,'The mathematical view must not silently host a figure or load a video.');
  assert.equal(await page.locator('[data-photo-sample="'+SAMPLE+'"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#replay-funnel').isDisabled(),true,'Photo appearance keeps geographic center-only behavior.');
}
async function expectGraphicsOrFallback(page,t){
  const actual=await page.evaluate(()=>window.fig6Draws?.last??null);
  if(actual){
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),true);
    assert.ok(actual.nonzero>1000,JSON.stringify(actual));
    assert.ok(actual.core[3]>200,JSON.stringify(actual));
    assert.equal(actual.lowerOmission[3],0);
    assert.equal(actual.upperOmission[3],0);
    assert.ok(actual.core.slice(0,3).every((value,index)=>value<actual.rightContext[index]),JSON.stringify(actual));
    assert.equal(actual.error,0);
    const counts=await page.evaluate(()=>({points:window.fig6Draws.points,lines:window.fig6Draws.lines}));
    assert.deepEqual(counts,{points:0,lines:0},'No generic particles, ground dust or margin lines in the partial filled view.');
    assert.equal(await page.locator('#replay-appearance-canvas').evaluate(canvas=>canvas.getContext('webgl2').isEnabled(canvas.getContext('webgl2').SCISSOR_TEST)),false);
    t.diagnostic('FIG6_ACTUAL_RENDER '+JSON.stringify(actual));
  }else{
    assert.equal(await page.locator('#replay-appearance-canvas').evaluate(canvas=>canvas.hidden),true);
    assert.equal(await page.locator('#replay-appearance-renderer-status').textContent(),'The form renderer could not start here. Source and coverage text remain available.');
    t.diagnostic('Figure6 source/text journey checked. Actual drawing unavailable in this engine and remains unverified.');
  }
  return actual;
}
async function seekRange(page,seconds){await page.locator('#replay-time').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},String(seconds));}
async function expectUnknown(page,seconds){
  await selected(page,seconds,SEQUENCE,false);
  assert.match(await page.locator('#replay-appearance-state').textContent(),/unknown at this exact clock instant/);
  assert.equal(await page.locator('#replay-photo-record').textContent(),'');
  assert.equal(await page.locator('#replay-photo-original').count(),0);
  assert.equal(await page.locator('#replay-appearance-source').isVisible(),false);
  assert.equal(await page.locator('#replay-appearance-source').getAttribute('href'),null);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.equal(await page.locator('[data-photo-sample="'+SAMPLE+'"]').getAttribute('aria-pressed'),'false');
}
for(const [width,theme] of [[320,'dark'],[1280,'light']]){
  test('Figure6 article route, source limits and coarse drawing '+width,async t=>{
    const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
    await page.addInitScript(theme=>localStorage.setItem('tornado-atlas-appearance',theme),theme);
    await installProbe(page);
    await page.goto(base+'/index.html');
    const study=page.locator('a[href*="appearance_photo=wakimoto-early-extension"]').first();
    await study.waitFor();
    const href=new URL(await study.getAttribute('href'),base);
    assert.equal(href.pathname,'/reconstruction.html');
    assert.equal(href.searchParams.get('event'),'el-reno-2013');
    assert.equal(href.searchParams.get('t'),'70');
    assert.equal(href.searchParams.get('appearance_view'),'photo');
    assert.equal(href.searchParams.get('appearance_photo'),SEQUENCE);
    await study.focus();await study.press('Enter');
    await page.locator('#replay-time:not([disabled])').waitFor();await selected(page,70,SEQUENCE,true);
    await expectRecord(page);const graphics=await expectGraphicsOrFallback(page,t);
    if(graphics){await page.locator('#replay-appearance-canvas').scrollIntoViewIfNeeded();await capture(page,width+'-fig6-drawing');}
    await page.locator('#replay-photo-details > summary').click();
    await page.locator('#replay-photo-record').scrollIntoViewIfNeeded();await capture(page,width+'-fig6-source');
    const doubled=await page.evaluate(()=>{
      const rows=Array.from(document.querySelectorAll('#replay-appearance *')).map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);
      for(const [node,size] of rows)node.style.fontSize=(size*2)+'px';
      return rows.length>0&&rows.every(([node,size])=>Math.abs(parseFloat(getComputedStyle(node).fontSize)-size*2)<.1);
    });
    assert.equal(doubled,true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('#replay-photo-original').isVisible(),true);
    await page.locator('#replay-photo-original').scrollIntoViewIfNeeded();await capture(page,width+'-fig6-enlarged-source');
    const share=new URL(await page.locator('#replay-link').getAttribute('href'));
    assert.equal(share.searchParams.get('t'),'70');
    assert.equal(share.searchParams.get('appearance_photo'),SEQUENCE);
  });
  test('Figure6 exact neighbors clear pixels, record and source '+width,async t=>{
    const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
    await installProbe(page);await ready(page);const graphics=await expectGraphicsOrFallback(page,t);
    for(const seconds of ['69.999','70.001','69','71']){
      const before=graphics?await page.evaluate(()=>({triangles:window.fig6Draws.triangles,clears:window.fig6Draws.clears})):null;
      if(graphics)await page.evaluate(()=>{window.fig6Draws.captureUnknown=true;window.fig6Draws.lastUnknownClear=null;});
      await seekRange(page,seconds);await expectUnknown(page,seconds);
      if(graphics){
        const after=await page.evaluate(()=>({triangles:window.fig6Draws.triangles,clears:window.fig6Draws.clears,empty:window.fig6Draws.lastUnknownClear}));
        assert.equal(after.triangles,before.triangles);assert.ok(after.clears>before.clears);
        assert.deepEqual(after.empty,{nonzero:0,error:0,clipped:false});
      }
      await page.locator('[data-photo-sample="'+SAMPLE+'"]').click();await selected(page,70,SEQUENCE,true);await expectRecord(page);
    }
    await page.locator('#replay-play').click();
    await page.waitForFunction(()=>document.querySelector('#replay-appearance-canvas')?.dataset.evidenceState==='unknown');
    await page.locator('#replay-play').click();
    assert.equal(await page.locator('#replay-photo-record').textContent(),'');
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  });
  test('Figure6 and existing2015 source retain independent time, history and reload '+width,async t=>{
    const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
    await installProbe(page);await ready(page);await expectRecord(page);
    await page.locator('#replay-appearance-mode').selectOption('photo:wakimoto-visible-condensation');
    await selected(page,70,'wakimoto-visible-condensation',false);
    assert.equal(await page.locator('#replay-photo-record').textContent(),'');
    await page.locator('[data-photo-sample="wakimoto-232441"]').click();
    await selected(page,1241,'wakimoto-visible-condensation',true);
    const oldOriginal=await page.locator('#replay-photo-original').getAttribute('href');
    assert.notEqual(oldOriginal,ORIGINAL);
    assert.ok((await page.locator('#replay-photo-record').textContent()).includes('2013-05-31T23:24:41Z'));
    await page.locator('#replay-appearance-mode').selectOption('photo:'+SEQUENCE);
    await expectUnknown(page,1241);
    await page.locator('[data-photo-sample="'+SAMPLE+'"]').click();await selected(page,70,SEQUENCE,true);await expectRecord(page);
    await page.goBack();await expectUnknown(page,1241);
    await page.goBack();await selected(page,1241,'wakimoto-visible-condensation',true);
    assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),oldOriginal);
    await page.goForward();await expectUnknown(page,1241);
    await page.goForward();await selected(page,70,SEQUENCE,true);await expectRecord(page);
    await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();
    await selected(page,70,SEQUENCE,true);await expectRecord(page);
    const final=new URL(page.url());assert.equal(final.searchParams.get('appearance_photo'),SEQUENCE);
  });
  test('Figure6 no-script article retains factual text and native source routes '+width,async t=>{
    const page=await fixture(t,{viewport:{width,height:1000},javaScriptEnabled:false,reducedMotion:'reduce'});
    await page.goto(base+'/index.html');
    const body=await page.locator('body').textContent();
    assert.match(body,/23:05:10 UTC/);
    assert.match(body,/Figure 6\(a\)|Figure 6/);
    assert.match(body,/partial|coarse/i);
    const study=page.locator('a[href*="appearance_photo=wakimoto-early-extension"]').first();
    assert.equal(await study.isVisible(),true);
    const nativeSources=page.locator('a[href="'+ORIGINAL+'"]');
    assert.ok(await nativeSources.count()>0,'A direct original page8 route must survive without JavaScript.');
    assert.equal(await nativeSources.first().isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await nativeSources.first().scrollIntoViewIfNeeded();await capture(page,width+'-fig6-no-script-source');
  });
  test('Figure6 deliberate WebGL failure preserves source and unknown states '+width,async t=>{
    const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'});
    await installProbe(page,true);await ready(page);await expectRecord(page);
    assert.equal(await page.locator('#replay-appearance-canvas').evaluate(canvas=>canvas.hidden),true);
    assert.equal(await page.locator('#replay-appearance-renderer-status').textContent(),'The form renderer could not start here. Source and coverage text remain available.');
    assert.equal(await page.evaluate(()=>window.fig6Draws??null),null);
    await page.locator('#replay-photo-details > summary').click();
    await page.locator('#replay-photo-record').scrollIntoViewIfNeeded();await capture(page,width+'-fig6-no-graphics-source');
    await seekRange(page,'70.001');await expectUnknown(page,'70.001');
    await page.locator('[data-photo-sample="'+SAMPLE+'"]').click();await selected(page,70,SEQUENCE,true);await expectRecord(page);
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  });
}
