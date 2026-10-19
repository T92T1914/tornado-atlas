import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

for(const width of [1280,390])test(`bounded form windows remain separate at ${width}px`,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000}});
  await page.goto(base+'/study.html');
  await page.locator('#sequence-enabled').check();
  await page.locator('#sequence-coverage').selectOption('bounded');
  assert.match(await page.locator('#sequence-coverage-note').textContent(),/not historical observations/);
  await page.locator('#sequence-time').fill('0.5');
  assert.match(await page.locator('#sequence-stage').textContent(),/No assigned form/);
  assert.match(await page.locator('#scene-form').textContent(),/GAP/);
  await page.locator('#scene').scrollIntoViewIfNeeded();
  const available=await page.locator('#scene').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');if(!gl)return false;
    window.boundedDraws={gl,clears:0,points:0,lines:0};
    const clear=gl.clear,draw=gl.drawArrays;
    gl.clear=function(...args){const result=clear.apply(this,args);const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);window.boundedDraws.lastClear={clipped:gl.isEnabled(gl.SCISSOR_TEST),painted:pixels.some((value,index)=>index%4===3&&value>0),error:gl.getError()};window.boundedDraws.clears++;return result;};
    gl.drawArrays=function(...args){
      if(args[0]===gl.POINTS)window.boundedDraws.points++;
      if(args[0]===gl.LINES)window.boundedDraws.lines++;
      return draw.apply(this,args);
    };return true;
  });
  if(!available){t.skip('Isolated browser has no WebGL2 for actual draw checks');return;}
  await page.locator('#quality').selectOption('3600');
  await page.waitForFunction(()=>window.boundedDraws.clears>0);
  assert.equal(await page.evaluate(()=>window.boundedDraws.lines),0,'No reference grid across the gap');
  assert.deepEqual(await page.evaluate(()=>window.boundedDraws.lastClear),{clipped:false,painted:false,error:0});
  assert.equal(await page.evaluate(()=>window.boundedDraws.points),0,'No funnel drawing across the gap');
  assert.equal(await page.locator('#scene').getAttribute('data-appearance-coverage'),'gap');
  assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  await page.locator('#sequence-time').fill('0.1');
  await page.waitForFunction(()=>window.boundedDraws.points>0);
  assert.equal(await page.locator('#scene').getAttribute('data-appearance-coverage'),'assigned');
  await page.locator('#quality').selectOption('7200');
  await page.locator('#sequence-rate').selectOption('15');
  assert.equal(await page.locator('#sequence-time').inputValue(),'0.1','Quality and paused rate changes preserve time');
  await page.locator('#sequence-time').fill('0.9');
  assert.match(await page.locator('#sequence-stage').textContent(),/broad authored form/);
  await page.locator('#sequence-time').fill('0.5');
  assert.match(await page.locator('#sequence-stage').textContent(),/No assigned form/);
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

async function assertUnavailable(page,message){
  assert.equal(await page.locator('#scene-failure').isVisible(),true);
  assert.equal(await page.locator('#motion').isDisabled(),true);
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
  assert.equal(await page.locator('#motion-status').textContent(),message);
}

test('unavailable WebGL keeps its diagnosis through view and motion controls',async t=>{
  const page=await fixture(t);
  await page.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return type==='webgl2'?null:getContext.call(this,type,...args);
    };
  });
  await page.goto(base+'/study.html');
  await page.locator('#scene-failure:visible').waitFor();
  const message='WebGL 2 is unavailable';
  await page.locator('#reset-view').click();
  await assertUnavailable(page,message);
  await page.locator('#sequence-enabled').check();
  await page.locator('#sequence-time').fill('0.5');
  await assertUnavailable(page,message);
  assert.equal(await page.locator('#sequence-progress').textContent(),'50% of authored sequence');
  await page.emulateMedia({reducedMotion:'reduce'});
  // Wait for the real media-query change handler, without an arbitrary sleep.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await assertUnavailable(page,message);
  const link=page.locator('#scene-failure a');
  assert.equal(await page.locator('#lab-event').inputValue(),'','No documentary reference is selected');
  assert.equal(await page.locator('#lab-reference-account').textContent(),'No documentary reference selected. These settings describe your assumed experiment.');
  assert.equal(await link.getAttribute('href'),'atlas.html');
  assert.equal(await link.textContent(),'Explore the documentary collection');
  await link.click();
  await page.waitForURL(base+'/atlas.html');
  assert.equal(new URL(page.url()).pathname,'/atlas.html');
  await page.locator('#museum-title').waitFor({state:'visible'});
  assert.equal(await page.locator('#museum-title').textContent(),'Tornado history, through the surviving record.');
});

test('a real WebGL context can recover without resuming motion or losing controls',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1200}});
  await page.goto(base+'/study.html');
  const available=await page.locator('#scene').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');
    const extension=gl?.getExtension('WEBGL_lose_context');
    if(!extension)return false;
    window.studyContextTest={gl,extension};
    return true;
  });
  if(!available){t.skip('Isolated browser has no WebGL2 context-loss extension');return;}
  await page.locator('#motion:not([disabled])').waitFor();
  await page.locator('#quality').selectOption('3600');
  await page.locator('#sequence-enabled').check();
  await page.locator('#sequence-time').fill('0.4');
  await page.locator('#motion').click();
  await page.waitForFunction(()=>document.querySelector('#motion').textContent==='Pause motion');
  await page.evaluate(()=>window.studyContextTest.extension.loseContext());
  await page.locator('#scene-failure:visible').waitFor();
  const message='Graphics context lost; waiting for recovery';
  await page.locator('#sequence-time').fill('0.6');
  await assertUnavailable(page,message);
  await page.evaluate(()=>window.studyContextTest.extension.restoreContext());
  await page.locator('#scene-failure').waitFor({state:'hidden'});
  assert.equal(await page.locator('#motion').isDisabled(),false);
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
  assert.match(await page.locator('#motion-status').textContent(),/^Paused/);
  assert.equal(await page.locator('#quality').inputValue(),'3600');
  assert.equal(await page.locator('#sequence-enabled').isChecked(),true);
  assert.equal(await page.locator('#sequence-time').inputValue(),'0.6');
  await page.locator('#scene').scrollIntoViewIfNeeded();
  // Sample the actual draw before compositing may clear the default drawing buffer.
  // Neither the production context attributes nor the renderer are replaced.
  await page.locator('#scene').evaluate(canvas=>{
    const state=window.studyContextTest,gl=state.gl,drawArrays=gl.drawArrays;
    gl.drawArrays=function(...args){
      const result=drawArrays.apply(this,args);
      if(args[0]!==gl.POINTS)return result;
      try{
        const pixels=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        state.rendered={lost:gl.isContextLost(),error:gl.getError(),painted:pixels.some((value,index)=>index%4===3&&value>0)};
      }finally{gl.drawArrays=drawArrays;}
      return result;
    };
  });
  await page.locator('#quality').selectOption('3600');
  await page.waitForFunction(()=>window.studyContextTest.rendered!==undefined);
  const rendered=await page.evaluate(()=>window.studyContextTest.rendered);
  assert.deepEqual(rendered,{lost:false,error:0,painted:true});
  assert.equal(await page.locator('#sequence-time').inputValue(),'0.6');
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
});
