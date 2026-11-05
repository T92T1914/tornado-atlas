import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow} from './ground-view-assertions.mjs';
import {sceneFrame} from './storm-scene-assertions.mjs';

const replay='reconstruction.html?event=el-reno-2013&appearance_view=formation&ground_view=synthetic-front&t=130';
const formFields={shape:'cone',condensation:'100',azimuth:'25',elevation:'12',distance:'7',dust:'1',quality:'7200',
  sequence:'1',coverage:'formation',rate:'1',position:'0.5',phase:'15',model:'genesis-v1',visibility:'ordinary',flow:'1'};
const form3='study.html?'+new URLSearchParams({experiment:'form-3',...formFields});
const form4='study.html?'+new URLSearchParams({experiment:'form-4',...formFields,lighting:'world-v1'});
const form5='study.html?'+new URLSearchParams({experiment:'form-5',...formFields,coverage:'reference',presentation:'reference-v1'});
const form2='study.html?experiment=form-2&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=0&coverage=continuous&rate=1&position=0&phase=15&model=kinematic-v1';
const form1='study.html?experiment=form-1&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=0&coverage=continuous&rate=1&position=0&phase=15';

async function readyStudy(page,url='study.html'){
  await page.goto(base+'/'+url);
  await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
}
async function readyReplay(page,style='world-v1'){
  await page.goto(base+'/'+replay+(style===null?'':'&appearance_style='+style));
  await page.locator('#replay-time:not([disabled])').waitFor();
}

// Observe the first final POINTS draw after the real control input. Submitted
// program uniforms and framebuffer bytes distinguish a working native material
// from a new label over the old presentation. No private renderer API is used.
async function submittedFrame(page,{study=false,value=130,seconds=15,world=true,motion='genesis-v1',count=3200,lighter=false,trigger=null}={}){
  const canvas=study?'#scene':'#replay-appearance-canvas',input=trigger??(study?'#sequence-time':'#replay-time');
  const available=await page.locator(canvas).evaluate(c=>Boolean(c.getContext('webgl2')));
  if(!available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must render the shared lighting programs');
    await page.locator(input).fill(String(value));
    assert.equal(await page.locator(input).inputValue(),String(value));
    if(study){assert.equal(await page.locator('#scene-failure').isVisible(),true);assert.equal(await page.locator('#motion').isDisabled(),true);}
    else{assert.equal(await page.locator(canvas).isVisible(),false);assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start|lost/);}
    console.info('FUNNEL_LIGHTING_UNAVAILABLE '+JSON.stringify({study,input,value,scope:'Control and explicit unavailable-graphics path only; no native material acceptance.'}));
    return null;
  }
  await page.locator(canvas).scrollIntoViewIfNeeded();
  await page.evaluate(({canvas,input})=>{
    const c=document.querySelector(canvas),gl=c.getContext('webgl2'),control=document.querySelector(input),draw=gl.drawArrays;
    let armed=false;const volumes=[];
    const arm=()=>{armed=true;};control.addEventListener('input',arm,{capture:true,once:true});
    window.lightingFrame=null;
    const intercept=function(...args){
      const result=draw.apply(this,args);if(!armed)return result;
      const program=gl.getParameter(gl.CURRENT_PROGRAM),uniform=name=>{
        const location=gl.getUniformLocation(program,name);return location===null?null:gl.getUniform(program,location);
      };
      if(args[0]===gl.TRIANGLES&&uniform('inverseCamera')!==null){
        volumes.push({world:uniform('worldLighting'),surface:uniform('surfacePass'),time:uniform('time'),
          genesis:uniform('genesis'),progress:uniform('formationProgress'),state:Array.from(uniform('formationState')),
          inverse:Array.from(uniform('inverseCamera')),palette:uniform('readingPalette'),linked:gl.getProgramParameter(program,gl.LINK_STATUS)});
      }
      if(args[0]!==gl.POINTS)return result;
      gl.drawArrays=draw;
      const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      window.lightingPixels=pixels;
      window.lightingFrame={time:uniform('time'),world:uniform('worldLighting'),genesis:uniform('genesis'),kinematic:uniform('kinematic'),
        progress:uniform('formationProgress'),state:Array.from(uniform('formationState')),shape:Array.from(uniform('shape')),
        matrix:Array.from(uniform('camera')),eye:Array.from(uniform('worldEye')),palette:uniform('readingPalette'),
        linked:gl.getProgramParameter(program,gl.LINK_STATUS),count:args[2],volumes,
        reference:gl.getAttachedShaders(program).some(shader=>/^#define REFERENCE_FORM 1$/m.test(gl.getShaderSource(shader))),
        buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],css:[c.clientWidth,c.clientHeight],
        rect:[c.getBoundingClientRect().width,c.getBoundingClientRect().height],ratio:devicePixelRatio,error:gl.getError(),lost:gl.isContextLost()};
      return result;
    };
    gl.drawArrays=intercept;
    window.lightingCleanup=()=>{control.removeEventListener('input',arm,true);if(gl.drawArrays===intercept)gl.drawArrays=draw;};
  },{canvas,input});
  let originalFailure=null;
  try{
    await page.locator(input).fill(String(value));
    await page.locator(canvas).scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>window.lightingFrame!==null);
    const frame=await page.evaluate(async()=>({...window.lightingFrame,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',window.lightingPixels))).map(v=>v.toString(16).padStart(2,'0')).join('')}));
    assert.equal(frame.error,0);assert.equal(frame.lost,false);assert.equal(frame.linked,true);
    assert.equal(frame.world,world);assert.equal(frame.genesis,motion==='genesis-v1');assert.equal(frame.kinematic,motion!=='legacy');
    assert.ok(Math.abs(frame.time-seconds)<3e-5,'Submitted motion uses the selected scenario time');
    assert.equal(frame.count,count);
    if(motion!=='legacy'){
      const [width,height]=study?frame.rect:frame.css,[capWidth,capHeight]=lighter?[320,200]:[512,320];
      const scale=Math.min(frame.ratio,2,capWidth/width,capHeight/height);
      assert.deepEqual(frame.buffer,[Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))],'The actual raster follows the selected presentation budget');
      assert.ok(frame.buffer[0]<=capWidth&&frame.buffer[1]<=capHeight);
    }
    assert.equal(frame.volumes.length,motion==='legacy'?0:world?2:1);
    assert.deepEqual(frame.volumes.map(v=>v.surface),motion==='legacy'?[]:world?[true,false]:[false]);
    for(const volume of frame.volumes){
      assert.equal(volume.linked,true);assert.equal(volume.world,world);assert.equal(volume.genesis,frame.genesis);
      assert.equal(volume.time,frame.time);assert.deepEqual(volume.state,frame.state);
      if(motion==='genesis-v1')assert.ok(Math.abs(volume.progress-Math.fround(seconds/30))<2e-6,'Actual volume carries the declared formation progression');
      if(frame.progress===null)assert.equal(frame.reference,true,'Only the reference particle program may optimize away unused progression');
      else assert.equal(volume.progress,frame.progress);
      assert.equal(volume.palette,frame.palette);
      for(let row=0;row<4;row++)for(let column=0;column<4;column++){
        const product=[0,1,2,3].reduce((sum,k)=>sum+frame.matrix[k*4+row]*volume.inverse[column*4+k],0);
        assert.ok(Math.abs(product-(row===column?1:0))<1e-4,'The submitted volume inverse uses the final POINTS camera');
      }
    }
    return frame;
  }catch(error){
    originalFailure=error;throw error;
  }finally{
    try{await page.evaluate(()=>{window.lightingCleanup?.();window.lightingCleanup=null;window.lightingPixels=null;});}
    catch(error){if(!originalFailure)throw error;console.error('FUNNEL_LIGHTING_CLEANUP_FAILURE '+String(error).slice(0,500));}
  }
}

for(const [width,theme,palette]of [[320,'light',1],[1280,'dark',2]]){
  test(`shared world lighting renders matched ground cameras at ${width} ${theme}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
    await readyReplay(page);await page.locator('#reading-appearance').selectOption(theme);
    const lit=await submittedFrame(page);
    assert.match(await page.locator('#ground-model-note').textContent(),/not historical illumination, surveyed terrain or physical scale/);
    assert.equal(await page.locator('#ground-reference-image').count(),0);
    if(lit){assert.equal(lit.palette,palette);assert.deepEqual(lit.eye,[0,Math.fround(.16),7]);assert.deepEqual(lit.state,[1,0,1,1]);}
    await readyReplay(page,null);await page.locator('#reading-appearance').selectOption(theme);
    const legacy=await submittedFrame(page,{world:false});
    if(lit){
      assert.deepEqual(legacy.matrix,lit.matrix);assert.deepEqual(legacy.state,lit.state);assert.deepEqual(legacy.shape,lit.shape);
      assert.equal(legacy.time,lit.time);assert.equal(legacy.count,lit.count);assert.equal(legacy.palette,lit.palette);
      assert.notEqual(legacy.hash,lit.hash,'The matched new material changes actual rendered bytes');
    }
    await readyReplay(page);await page.locator('#reading-appearance').selectOption(theme);
    await page.locator('#ground-camera').selectOption('synthetic-oblique');
    await page.locator('#ground-quality').selectOption('1600');
    const oblique=await submittedFrame(page,{count:1600,lighter:true});
    if(lit){assert.notDeepEqual(oblique.matrix,lit.matrix);assert.deepEqual(oblique.eye,[4,Math.fround(.16),6]);assert.deepEqual(oblique.state,lit.state);assert.deepEqual(oblique.shape,lit.shape);}
    assert.equal(new URL(page.url()).searchParams.get('appearance_style'),'world-v1');
    await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();
    assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-oblique');
    assert.equal(await page.locator('#replay-time').inputValue(),'130');
    const reloaded=await submittedFrame(page);
    if(oblique){assert.deepEqual(reloaded.matrix,oblique.matrix);assert.deepEqual(reloaded.state,oblique.state);}
    await page.locator('#ground-quality').selectOption('1600');
    const lightAgain=await submittedFrame(page,{count:1600,lighter:true});
    if(oblique){assert.equal(lightAgain.hash,oblique.hash);assert.deepEqual(lightAgain.matrix,reloaded.matrix);assert.deepEqual(lightAgain.shape,reloaded.shape);assert.deepEqual(lightAgain.state,reloaded.state);assert.equal(lightAgain.time,reloaded.time);assert.notDeepEqual(lightAgain.buffer,reloaded.buffer);}
    await enlargeText(page);await reflow(page);
    await readyReplay(page,null);await page.locator('#reading-appearance').selectOption(theme);
    await page.locator('#ground-camera').selectOption('synthetic-oblique');await page.locator('#ground-quality').selectOption('1600');
    const oldLow=await submittedFrame(page,{world:false,count:1600});
    if(oblique){assert.deepEqual(oldLow.matrix,oblique.matrix);assert.deepEqual(oldLow.state,oblique.state);assert.deepEqual(oldLow.shape,oblique.shape);assert.notDeepEqual(oldLow.buffer,oblique.buffer);}
    await enlargeText(page);await reflow(page);
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  });
}

test('literal form-5 saves its state while history and literal form-4 retain distinct presentations',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:1000},reducedMotion:'reduce'});
  await readyStudy(page,form5);await page.locator('#reading-appearance').selectOption('light');
  assert.equal(await page.locator('#sequence-coverage').inputValue(),'reference');
  assert.equal(await page.locator('#sequence-enabled').isChecked(),true);
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'reference-v1');
  assert.equal(await page.locator('#lighting-note').isVisible(),true);
  const fresh=await submittedFrame(page,{study:true,value:.5,count:7200});
  await page.locator('#quality').selectOption('3600');
  const lighter=await submittedFrame(page,{study:true,value:.5,count:3600,lighter:true});
  if(fresh){assert.deepEqual(lighter.matrix,fresh.matrix);assert.deepEqual(lighter.shape,fresh.shape);assert.deepEqual(lighter.state,fresh.state);assert.equal(lighter.time,fresh.time);assert.notDeepEqual(lighter.buffer,fresh.buffer);}
  await page.locator('#quality').selectOption('7200');
  await page.locator('#lab-share').click();
  const saved=page.url();assert.deepEqual(Object.fromEntries(new URL(saved).searchParams),{experiment:'form-5',...formFields,coverage:'reference',presentation:'reference-v1'});
  const cameraLink=new URL(await page.locator('.formation-context a[href*="reconstruction.html"]').getAttribute('href'));
  assert.equal(cameraLink.searchParams.get('appearance_style'),'reference-v1');
  await page.reload();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'reference-v1');
  const reloaded=await submittedFrame(page,{study:true,value:.5,count:7200});
  if(fresh){assert.equal(reloaded.hash,fresh.hash);assert.deepEqual(reloaded.matrix,fresh.matrix);}
  await enlargeText(page);await reflow(page);
  await readyStudy(page,form3);
  const old=await submittedFrame(page,{study:true,value:.5,count:7200,world:false});
  assert.equal(await page.locator('#lighting-note').isVisible(),false);
  assert.equal(new URL(await page.locator('#lab-share').getAttribute('href')).searchParams.get('experiment'),'form-3');
  assert.equal(new URL(await page.locator('.formation-context a[href*="reconstruction.html"]').getAttribute('href')).searchParams.has('appearance_style'),false);
  if(fresh){assert.deepEqual(old.matrix,fresh.matrix);assert.deepEqual(old.state,fresh.state);assert.notEqual(old.hash,fresh.hash);}
  await page.goBack();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(page.url(),saved);assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'reference-v1');
  await submittedFrame(page,{study:true,value:.5,count:7200});
  await page.goForward();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'legacy');
  await enlargeText(page);await reflow(page);
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
  const wide=page;await wide.setViewportSize({width:1280,height:1000});
  await readyStudy(wide,form5);await wide.locator('#reading-appearance').selectOption('dark');
  const wideFrame=await submittedFrame(wide,{study:true,value:.5,count:7200});
  if(wideFrame){assert.equal(wideFrame.palette,2);assert.deepEqual(wideFrame.state,[1,0,1,1]);}
  assert.equal(await wide.locator('#lighting-note').isVisible(),true);
  await enlargeText(wide);await reflow(wide);
  // Literal form-4 remains the earlier material, not a relabeled fresh default.
  await readyStudy(wide,form4);await wide.locator('#reading-appearance').selectOption('dark');
  assert.equal(await wide.locator('#sequence-coverage').inputValue(),'formation');
  assert.equal(await wide.locator('#scene').getAttribute('data-lighting-style'),'world-v1');
  const previous=await submittedFrame(wide,{study:true,value:.5,count:7200});
  assert.deepEqual(Object.fromEntries(new URL(await wide.locator('#lab-share').getAttribute('href')).searchParams),{experiment:'form-4',...formFields,lighting:'world-v1'});
  if(wideFrame){assert.deepEqual(previous.matrix,wideFrame.matrix);assert.deepEqual(previous.state,wideFrame.state);assert.deepEqual(previous.shape,wideFrame.shape);assert.equal(previous.time,wideFrame.time);assert.notEqual(previous.hash,wideFrame.hash,'The reference presentation changes actual rendered bytes from literal form-4');}
  await wide.reload();await wide.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await wide.locator('#scene').getAttribute('data-lighting-style'),'world-v1');
  const restoredPrevious=await submittedFrame(wide,{study:true,value:.5,count:7200});
  if(previous)assert.equal(restoredPrevious.hash,previous.hash);
});

test('literal form-1, form-2 and form-3 links retain their native legacy lighting gates',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1000},reducedMotion:'reduce'});
  for(const [url,version,motion]of [[form1,'form-1','legacy'],[form2,'form-2','kinematic-v1'],[form3,'form-3','genesis-v1']]){
    await readyStudy(page,url);
    assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'legacy');
    assert.equal(await page.locator('#lighting-note').isVisible(),false);
    await submittedFrame(page,{study:true,trigger:motion==='genesis-v1'?null:'#azimuth',value:motion==='genesis-v1' ? .5 : 25,seconds:15,world:false,motion,count:7200});
    await page.locator('#lab-share').click();
    const params=new URL(page.url()).searchParams;assert.equal(params.get('experiment'),version);assert.equal(params.has('lighting'),false);
  }
});

test('unknown or repeated replay lighting refuses the selection and recovers through actual mode controls',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  for(const style of ['world-v2','world-v1&appearance_style=world-v1','']){
    await readyReplay(page,style);
    assert.match(await page.locator('#ground-time').textContent(),/requested lighting presentation is unavailable.*No appearance has been substituted/);
    assert.match(await page.locator('#replay-appearance-state').textContent(),/unavailable/);
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
    assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-evidence-state'),'unavailable');
    assert.equal(await page.locator('#ground-reference-image').count(),0);
  }
  await page.locator('#replay-appearance-mode').selectOption('simulation');
  assert.equal(new URL(page.url()).searchParams.has('appearance_style'),false);
  await page.locator('#replay-appearance-mode').selectOption('formation');
  assert.equal(new URL(page.url()).searchParams.get('appearance_style'),'storm-v3');
  await sceneFrame(page,{style:'storm-v3'});
  await page.locator('#replay-time').fill('145');
  assert.match(await page.locator('#replay-appearance-state').textContent(),/Outside/);
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
});

test('invalid form-4 lighting never partially restores a claimed experiment',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1000},reducedMotion:'reduce'});
  const changed=form4.replace('azimuth=25','azimuth=40');
  for(const url of [changed.replace('world-v1','world-v2'),changed+'&lighting=world-v1',changed.replace('&lighting=world-v1',''),changed.replace('form-4','form-3')]){
    await readyStudy(page,url);
    assert.equal(await page.locator('#lab-state').getAttribute('data-state'),'invalid');
    assert.match(await page.locator('#lab-state').textContent(),/No values from the link were applied/);
    assert.equal(await page.locator('#azimuth').inputValue(),'25');
    assert.equal(await page.locator('#sequence-time').inputValue(),'0');
    assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v3');
    assert.equal(await page.locator('#motion').textContent(),'Play motion');
  }
  await readyStudy(page,form4);assert.equal(await page.locator('#lab-state').getAttribute('data-state'),'restored');
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'world-v1');
  await submittedFrame(page,{study:true,value:.5,count:7200});
});
