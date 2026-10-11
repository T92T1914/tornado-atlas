import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
const observation=JSON.parse(await readFile(new URL('../../exhibits/el-reno-2013/documentary.json',import.meta.url),'utf8')).reported_appearance.observations[0];
async function capture(page,name){
  if(!process.env.ATLAS_EARLY_APPEARANCE_CAPTURE)return;
  await mkdir(process.env.ATLAS_EARLY_APPEARANCE_CAPTURE,{recursive:true});
  await page.locator('#early-condensation-reading').evaluate(node=>node.scrollIntoView({behavior:'instant',block:'start'}));
  await page.screenshot({path:path.join(process.env.ATLAS_EARLY_APPEARANCE_CAPTURE,name+'.png'),fullPage:false});
}
async function probe(page){
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      const gl=get.call(this,kind,...args);
      if(this.id!=='early-condensation-canvas'||kind!=='webgl2'||!gl||seen.has(gl))return gl;
      seen.add(gl);const canvas=this,draw=gl.drawArrays,uniform=gl.uniform4fv;
      window.earlyAppearanceGL=gl;window.earlyAppearanceProbe={triangles:0,lines:0,points:0};
      gl.uniform4fv=function(location,values,...args){if(values.length===4)window.earlyAppearanceProbe.plane=[...values];return uniform.call(this,location,values,...args);};
      gl.drawArrays=function(...args){
        const result=draw.apply(this,args),record=window.earlyAppearanceProbe;
        if(args[0]===gl.LINES)record.lines++;if(args[0]===gl.POINTS)record.points++;
        if(args[0]!==gl.TRIANGLES)return result;record.triangles++;
        const rect=canvas.getBoundingClientRect(),[left,bottom,w,h]=record.plane;
        const bytes=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        const atCSS=(x,y)=>{const px=Math.floor(x/rect.width*gl.drawingBufferWidth),py=Math.floor(y/rect.height*gl.drawingBufferHeight);if(px<0||px>=gl.drawingBufferWidth||py<0||py>=gl.drawingBufferHeight)throw new Error('Early form probe outside buffer');const i=(py*gl.drawingBufferWidth+px)*4;return [...bytes.slice(i,i+4)];};
        const at=(x,y)=>atCSS(left+x*w,bottom+y*h);
        record.last={core:at(.55,.55),context:at(.10,.50),omitted:at(.62,.025),outside:atCSS(left-2,bottom+h*.5),error:gl.getError(),clipped_during_draw:gl.isEnabled(gl.SCISSOR_TEST),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};
        record.hashPromise=crypto.subtle.digest('SHA-256',bytes).then(value=>[...new Uint8Array(value)].map(v=>v.toString(16).padStart(2,'0')).join(''));
        return result;
      };
      return gl;
    };
  });
}
async function snapshot(page){return page.evaluate(async()=>({...window.earlyAppearanceProbe,last:{...window.earlyAppearanceProbe.last},sha256:await window.earlyAppearanceProbe.hashPromise,hashPromise:undefined,scissor_after_draw:window.earlyAppearanceGL.isEnabled(window.earlyAppearanceGL.SCISSOR_TEST),state:document.querySelector('#early-condensation-canvas').dataset.documentaryState,url:location.href,clock:document.querySelector('#timeline').value,record:JSON.parse(document.querySelector('#early-condensation-record').textContent)}));}
async function reading(page){
  const article=page.locator('#early-condensation-reading');
  assert.match(await article.textContent(),/6:04 PM CDT/);
  assert.match(await article.textContent(),/exposure second and clock accuracy are unknown/);
  assert.match(await article.textContent(),/not ground contact/);
  assert.equal(await article.getByRole('link',{name:'Open Reid’s original photograph'}).getAttribute('href'),observation.original_url);
  assert.equal(await article.getByRole('link',{name:'Read the creator’s account and caption'}).getAttribute('href'),observation.account_url);
  assert.equal(await article.locator('img,video,iframe').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
}
for(const [width,theme] of [[320,'dark'],[1280,'light']])test('early reported-minute form, source return and replay isolation '+width+' '+theme,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},reducedMotion:'reduce'}),sourceRequests=[];
  page.on('request',req=>{if(req.url().includes('stormbruiser.com'))sourceRequests.push(req.url());});
  await page.addInitScript(theme=>localStorage.setItem('tornado-atlas-appearance',theme),theme);await probe(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=1261&appearance_view=photo&appearance_photo=wakimoto-visible-condensation');
  await page.locator('#replay-time:not([disabled])').waitFor();
  const earlyLink=page.getByRole('link',{name:'Earlier light taper · reported 6:04 PM CDT minute'});await earlyLink.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true'&&['reported_minute','unavailable'].includes(document.querySelector('#early-condensation-canvas').dataset.documentaryState));
  await reading(page);
  if(await page.locator('#early-condensation-canvas').getAttribute('data-documentary-state')==='unavailable'){assert.equal(process.env.ATLAS_BROWSER_ENGINE,'firefox','Chrome and WebKit require an actual filled early form');t.skip('WebGL 2 is unavailable in this Firefox environment; no early graphical journey acceptance. Static fallback is tested separately.');return;}
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  const before=await snapshot(page);
  assert.ok(before.last.core.slice(0,3).every(v=>v>160)&&before.last.core[3]===255);
  assert.ok(before.last.context.slice(0,3).every(v=>v<90));assert.equal(before.last.omitted[3],0);assert.equal(before.last.outside[3],0);assert.equal(before.last.error,0);assert.equal(before.last.clipped_during_draw,true);assert.equal(before.scissor_after_draw,false);assert.equal(before.lines,0);assert.equal(before.points,0);
  assert.equal(before.record.reported_time.exact_replay_seconds,null);assert.equal(before.record.continuous_registration,null);assert.equal(before.record.physical_extent,null);
  await capture(page,'early-'+width+'-'+theme);
  await page.evaluate(()=>{window.earlyAppearanceLoss=window.earlyAppearanceGL.getExtension('WEBGL_lose_context');if(!window.earlyAppearanceLoss)throw new Error('Owned context-loss extension unavailable');window.earlyAppearanceLoss.loseContext();});
  await page.waitForFunction(()=>document.querySelector('#early-condensation-canvas').dataset.documentaryState==='unavailable');
  await reading(page);await page.evaluate(()=>window.earlyAppearanceLoss.restoreContext());
  await page.waitForFunction(()=>document.querySelector('#early-condensation-canvas').dataset.documentaryState==='reported_minute');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const recovered=await snapshot(page);assert.equal(recovered.sha256,before.sha256);assert.equal(recovered.last.clipped_during_draw,true);assert.equal(recovered.scissor_after_draw,false);
  await page.locator('#timeline').focus();await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('#timeline').value!=='0');
  const after=await snapshot(page);assert.equal(after.sha256,before.sha256);assert.notEqual(after.clock,before.clock);assert.equal(after.triangles,recovered.triangles,'No clock subscription redraws the documentary observation');
  // Native source-return behavior with a declared synthetic body, not live media acceptance.
  await page.route(observation.original_url,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Controlled source return fixture</title><p>No historical content is supplied by this route fixture.</p>'}));
  await page.locator('#early-condensation-reading').getByRole('link',{name:'Open Reid’s original photograph'}).click();
  await page.waitForURL(observation.original_url);await page.goBack();
  await page.waitForFunction(()=>document.querySelector('#early-condensation-canvas').dataset.documentaryState==='reported_minute');
  assert.equal(new URL(page.url()).searchParams.get('t'),after.clock);await reading(page);
  await page.reload();await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true'&&document.querySelector('#early-condensation-canvas').dataset.documentaryState==='reported_minute');await reading(page);
  assert.equal(new URL(page.url()).searchParams.get('t'),after.clock);
  // Reflow both the caption and the displayed authored form.
  await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,i)=>node.style.fontSize=sizes[i]*2+'px');});
  await reading(page);await capture(page,'early-'+width+'-doubled-text');
  assert.deepEqual(sourceRequests,[observation.original_url],'No original image is fetched before explicit native source activation');
  console.log('EARLY_DOCUMENTARY_ACTUAL '+JSON.stringify({width,theme,before:{...before,record:undefined},after:{...after,record:undefined},source_return_basis:'Native original URL with controlled synthetic body; not live source rendering',source_requests:sourceRequests}));
});
for(const scenario of ['nojs','data503','noWebGL'])test('early documentary reading survives '+scenario,async t=>{
  const page=await fixture(t,{viewport:{width:320,height:1000},javaScriptEnabled:scenario!=='nojs'}),originalRequests=[];
  page.on('request',req=>{if(req.url().includes('stormbruiser.com'))originalRequests.push(req.url());});
  if(scenario==='data503')await page.route('**/data.json',route=>route.fulfill({status:503,body:'Controlled unavailable data'}));
  if(scenario==='noWebGL')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return this.id==='early-condensation-canvas'&&kind==='webgl2'?null:get.call(this,kind,...args);};});
  await page.goto(base+'/index.html#early-condensation-reading');
  if(scenario==='data503')await page.waitForFunction(()=>document.body.dataset.exhibitReady==='error'&&document.querySelector('#early-condensation-canvas').dataset.documentaryState==='reported_minute');
  if(scenario==='noWebGL')await page.waitForFunction(()=>document.querySelector('#early-condensation-canvas').dataset.documentaryState==='unavailable');
  await reading(page);assert.deepEqual(originalRequests,[]);await capture(page,'early-fallback-'+scenario);
});
