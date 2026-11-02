import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow} from './ground-view-assertions.mjs';
import {sceneFrame,sameScenario,readingState} from './storm-scene-assertions.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

// Full submitted shader identities from the retained, reviewed private controls.
const shaderHashes={
  'storm-v2':'c125b0cc8f42aa53e13925595809037a3d0dbc4b4ea96ccedf8623d3c9306e2a',
  'storm-v4':'e0c316773e6f5339b2e83cac1d198465cda86b019339335b6d1e12e72a072b29'
};
for(const [quality,raster]of [[7200,[512,288]],[1600,[320,180]]])test('filtered native program preserves accepted geometry and reversible cache selection '+quality,{timeout:60000},async t=>{
  const page=await fixture(t,{deviceScaleFactor:1,reducedMotion:'reduce'});await page.goto(base+'/study.html');
  const result=await page.evaluate(async({quality})=>{
    const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:512px;height:288px';document.body.prepend(canvas);
    let renderer=null,original=null;
    try{
      const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,powerPreference:'low-power'});
      if(!gl)return {available:false};
      const {createFormRenderer}=await import('/form-renderer.mjs'),{GROUND_CAMERAS}=await import('/ground-view-model.mjs');
      renderer=createFormRenderer(canvas,quality);
      const frames=[],programs=new Set(),retained=new Map();
      const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
      for(const style of ['storm-v2','storm-v4','storm-v2','storm-v4']){
        renderer.render({shape:{base:.4,flare:.5,bend:.1},extent:1,time:15,dust:true,azimuth:25,elevation:12,distance:7,
          motionModel:'genesis-v1',formationTime:15,flow:true,readingAppearance:'dark',lightingStyle:style,sourceCamera:GROUND_CAMERAS[0].camera});
        const program=gl.getParameter(gl.CURRENT_PROGRAM);programs.add(program);
        const uniform=name=>{const location=gl.getUniformLocation(program,name);return location===null?null:gl.getUniform(program,location);};
        const array=name=>{const value=uniform(name);return value===null?null:Array.from(value);};
        const shaders=gl.getAttachedShaders(program)||[],fragments=shaders.filter(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);
        if(fragments.length!==1)throw Error('Exactly one submitted fragment is required');
        const source=gl.getShaderSource(fragments[0]),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let minimum=255,maximum=0;for(let i=0;i<pixels.length;i++)if(i%4!==3){minimum=Math.min(minimum,pixels[i]);maximum=Math.max(maximum,pixels[i]);}
        const previous=retained.get(style),equal=previous===undefined?null:previous.length===pixels.length&&previous.every((v,i)=>v===pixels[i]);
        if(previous===undefined)retained.set(style,pixels.slice());
        frames.push({style,shaderHash:await digest(new TextEncoder().encode(source)),pixelHash:await digest(pixels),
          compiled:shaders.length===2&&shaders.every(s=>gl.getShaderParameter(s,gl.COMPILE_STATUS)),linked:gl.getProgramParameter(program,gl.LINK_STATUS),
          buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],viewport:array('viewportBox'),time:uniform('time'),state:array('formationState'),
          pullback:array('stormPullback'),inverse:array('inverseCamera'),surface:uniform('surfacePass'),equal,range:maximum-minimum,
          opaque:pixels.every((v,i)=>i%4!==3||v===255),error:gl.getError(),lost:gl.isContextLost()});
      }
      return {available:true,programs:programs.size,frames};
    }catch(error){original=error;throw error;}
    finally{
      try{renderer?.dispose();}catch(error){if(!original)throw error;console.error('FILTERED_STORM_CLEANUP_FAILURE '+String(error).slice(0,500));}
      finally{canvas.remove();}
    }
  },{quality});
  if(!result.available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must compile the actual filtered storm program');
    t.skip('FILTERED_STORM_UNAVAILABLE No native shader or framebuffer evidence in this engine.');return;
  }
  assert.equal(result.programs,2);assert.equal(result.frames.length,4);
  for(const frame of result.frames){
    assert.equal(frame.shaderHash,shaderHashes[frame.style]);assert.equal(frame.compiled,true);assert.equal(frame.linked,true);
    assert.equal(frame.error,0);assert.equal(frame.lost,false);assert.equal(frame.opaque,true);assert.ok(frame.range>0);
    assert.deepEqual(frame.buffer,raster);assert.deepEqual(frame.viewport,[0,0,...raster]);assert.equal(frame.time,15);assert.equal(frame.surface,false);
    assert.deepEqual(frame.state,[1,0,1,1]);
    for(const key of ['time','state','pullback','inverse','viewport'])assert.deepEqual(frame[key],result.frames[0][key],'Matched settings '+key);
  }
  assert.notEqual(result.frames[0].pixelHash,result.frames[1].pixelHash,'The selected filter changes the actual matched native image');
  assert.equal(result.frames[2].equal,true);assert.equal(result.frames[3].equal,true);
});

for(const [width,theme]of [[320,'light'],[1280,'dark']])test('opt-in filtered Form shares its phase with Replay and returns its saved state '+width,{timeout:60000},async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  await page.goto(base+'/study.html');await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-coverage').inputValue(),'storm-detail');
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v2','The existing default is preserved');
  await page.locator('#reading-appearance').selectOption(theme);
  const baseline=await sceneFrame(page,{study:true,style:'storm-v2',retain:'filtered-baseline'});
  const filtered=await sceneFrame(page,{study:true,style:'storm-v4',trigger:'#sequence-coverage',event:'change',retain:'filtered-new',
    action:()=>page.locator('#sequence-coverage').selectOption('storm-filtered')});
  if(baseline){sameScenario(filtered,baseline);assert.notEqual(filtered.hash,baseline.hash);}
  assert.equal(await page.locator('#motion').textContent(),'Play motion');
  assert.match(await page.locator('#lighting-note').textContent(),/geometry|no matched El Reno camera/);
  const old=await sceneFrame(page,{study:true,style:'storm-v2',trigger:'#sequence-coverage',event:'change',compare:'filtered-baseline',
    action:()=>page.locator('#sequence-coverage').selectOption('storm-detail')});
  if(baseline)assert.equal(old.rawEqual,true);
  const back=await sceneFrame(page,{study:true,style:'storm-v4',trigger:'#sequence-coverage',event:'change',compare:'filtered-new',
    action:()=>page.locator('#sequence-coverage').selectOption('storm-filtered')});
  if(filtered)assert.equal(back.rawEqual,true);
  const priorUI=await readingState(page),changed=await sceneFrame(page,{study:true,style:'storm-v4',trigger:'#reading-appearance',event:'change',compare:'filtered-new',
    action:()=>page.locator('#reading-appearance').selectOption(theme==='light'?'dark':'light')});
  assert.notEqual((await readingState(page)).background,priorUI.background);if(filtered)assert.equal(changed.rawEqual,true);
  await page.locator('#lab-share').click();
  const saved=page.url(),params=new URL(saved).searchParams;
  assert.equal(params.get('experiment'),'form-9');assert.equal(params.get('coverage'),'storm-filtered');assert.equal(params.get('presentation'),'storm-v4');
  assert.equal(params.get('position'),'0.5');assert.equal(params.get('phase'),'15');
  await page.reload();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  const restored=await sceneFrame(page,{study:true,style:'storm-v4'});if(filtered)assert.equal(restored.hash,filtered.hash);
  await page.locator('#form-ground-link').focus();
  const destination=new URL(await page.locator('#form-ground-link').getAttribute('href'));
  assert.equal(destination.searchParams.get('t'),'130');assert.equal(destination.searchParams.get('appearance_style'),'storm-v4');
  await Promise.all([page.waitForURL(destination.href,{timeout:10000}),page.keyboard.press('Enter')]);
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-time').inputValue(),'130');assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-front');
  assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-scene-frame'),'complete-synthetic');
  assert.match(await page.locator('#ground-render-caption').textContent(),/filtered lighting/);
  assert.match(await page.locator('#ground-model-note').textContent(),/no historical|without measured El Reno/);
  await sceneFrame(page,{style:'storm-v4'});
  await enlargeText(page);await reflow(page);
  await page.goBack();await page.waitForURL(saved,{timeout:10000});
  await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-coverage').inputValue(),'storm-filtered');assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v4');assert.equal(await page.locator('#motion').textContent(),'Play motion');
  await enlargeText(page);await reflow(page);
});


// One combined-state check. The literal Form9 link and Greensburg identity come
// from their separate reviewed contracts, never from the serializer under test.
test('filtered Form9 retains Greensburg source-only reference through saved native return 320',{timeout:60000},async t=>{
  const revision='c4d47704a89025e2fc66e70ffe25eeaa30b9d77d863fc8abc55a6735f8bad937';
  const original='https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2007_c20260323.csv.gz';
  const account='The Kiowa record describes destroyed homes and a church south of Greensburg, then destruction across nearly 95 percent of the town. It reports 961 homes and businesses destroyed, 216 with major damage and 307 with minor damage. Its reported damage estimate is about $250 million including uninsured losses.';
  const rights='Attributed paraphrase and original source links. No source photograph, figure, audio or film is copied or licensed by this record.';
  const saved=base+'/study.html?experiment=form-9&event=greensburg-2007&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=storm-filtered&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=ordinary&flow=1&presentation=storm-v4#form-experiment';
  const destination=base+'/dossier.html?event=greensburg-2007&source=ncei-2007-retained&revision='+revision+'#source-ncei-2007-retained';
  const page=await fixture(t,{viewport:{width:320,height:1000},deviceScaleFactor:1,colorScheme:'light',reducedMotion:'reduce',serviceWorkers:'block'});
  let unexpectedRequests=0;const unexpected=[];
  page.on('request',request=>{
    const url=request.url();
    if(['image','media'].includes(request.resourceType())||url.startsWith('blob:')||new URL(url).origin!==new URL(base).origin){
      unexpectedRequests++;if(unexpected.length<8)unexpected.push({url,kind:request.resourceType()});
    }
  });
  await page.addInitScript(()=>{
    window.__filteredSourceAllocations={images:0,objectURLs:0};
    const element=document.createElement,create=URL.createObjectURL;
    document.createElement=function(name,...args){if(String(name).toLowerCase()==='img')window.__filteredSourceAllocations.images++;return Reflect.apply(element,this,[name,...args]);};
    if(typeof create==='function')URL.createObjectURL=function(...args){window.__filteredSourceAllocations.objectURLs++;return Reflect.apply(create,this,args);};
  });
  const sourceOnly=async()=>{
    assert.deepEqual(await page.evaluate(()=>window.__filteredSourceAllocations),{images:0,objectURLs:0});
    assert.equal(await page.locator('img,video,audio,iframe').count(),0);
    assert.equal(unexpectedRequests,0,JSON.stringify(unexpected));
  };
  const restored=async()=>{
    await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
    const evidence=page.locator('#lab-reference-evidence[data-event="greensburg-2007"][data-state="ready"]');await evidence.waitFor();
    assert.equal(page.url(),saved);assert.equal(await page.locator('#lab-share').getAttribute('href'),saved);
    assert.deepEqual(await page.evaluate(()=>({
      values:Object.fromEntries(['shape','condensation','azimuth','elevation','distance','quality','sequence-coverage','sequence-rate','sequence-time','condensation-visibility','lab-event'].map(id=>[id,document.getElementById(id).value])),
      switches:Object.fromEntries(['dust','sequence-enabled','flow-cues'].map(id=>[id,document.getElementById(id).checked]))
    })),{values:{shape:'cone',condensation:'100',azimuth:'25',elevation:'12',distance:'7',quality:'7200','sequence-coverage':'storm-filtered','sequence-rate':'1','sequence-time':'0.5','condensation-visibility':'ordinary','lab-event':'greensburg-2007'},switches:{dust:true,'sequence-enabled':true,'flow-cues':true}});
    assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v4');
    assert.equal(await page.locator('#motion').textContent(),'Play motion');
    assert.equal(await evidence.getAttribute('data-observation-id'),'kiowa-town-impact');assert.equal(await evidence.getAttribute('data-media-id'),null);
    assert.equal(await evidence.getAttribute('aria-busy'),'false');
    assert.equal(await evidence.locator('#lab-reference-title').textContent(),'From homes south of town into Greensburg');
    assert.equal(await evidence.locator('.lab-reference-caption').textContent(),account);
    assert.equal(await evidence.locator('.lab-reference-limits').textContent(),'These are source reported damage categories and a nominal historical estimate. No independently assessed building inventory, present day value, complete local EF5 swath or uniform wind field is inferred.');
    assert.equal(await evidence.locator('.lab-reference-boundary').textContent(),'This account records reported destruction. It supplies no historical funnel geometry, camera or measured wind field.');
    assert.equal(await evidence.locator('.lab-reference-rights').textContent(),rights);
    assert.equal(await evidence.locator('.lab-reference-credit').textContent(),'Source: NOAA NCEI Storm Events: two Greensburg county records');
    assert.equal(await evidence.getByRole('link',{name:'Read the source record',exact:true}).getAttribute('href'),destination);
    assert.equal(await evidence.getByRole('link',{name:'Open the original source',exact:true}).getAttribute('href'),original);
    await sourceOnly();
  };
  await page.goto(saved);await restored();
  await page.locator('#lab-share').click();await restored();
  await page.reload();await restored();
  const before=await sceneFrame(page,{study:true,style:'storm-v4'});await restored();
  const link=page.locator('#lab-reference-evidence').getByRole('link',{name:'Read the source record',exact:true});
  await link.evaluate(node=>{
    const events=[];let total=0;sessionStorage.removeItem('__filteredSourceGesture');
    for(const type of ['keydown','click','keyup'])document.addEventListener(type,event=>{
      total++;if(events.length<8)events.push({type:event.type,key:event.key??null,trusted:event.isTrusted,repeat:event.repeat??null,
        detail:event.detail??null,targetIsLink:event.target===node,focused:document.activeElement===node,href:node.href,
        alt:event.altKey,ctrl:event.ctrlKey,meta:event.metaKey,shift:event.shiftKey});
      sessionStorage.setItem('__filteredSourceGesture',JSON.stringify({total,events}));
    },true);
  });
  await link.focus();assert.equal(await link.evaluate(node=>document.activeElement===node),true);
  const commits=[],onCommit=frame=>{if(frame===page.mainFrame())commits.push(frame.url());};page.on('framenavigated',onCommit);
  let gesture;
  try{
    await page.keyboard.press('Enter');await waitForDossier(page,{href:destination,elementId:'source-ncei-2007-retained'});
    assert.equal(page.url(),destination);
    const card=page.locator('#source-ncei-2007-retained');assert.equal(await card.locator('h3').textContent(),'NOAA NCEI Storm Events: two Greensburg county records');
    assert.equal(await card.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),original);
    assert.match(await card.textContent(),/No source photograph, figure, audio or film is copied or licensed by this record/);
    gesture=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('__filteredSourceGesture')));
    assert.ok([2,3].includes(gesture.total));assert.equal(gesture.events.length,gesture.total);
    assert.deepEqual(gesture.events.map(row=>row.type),gesture.total===2?['keydown','click']:['keydown','click','keyup']);
    assert.equal(gesture.events[0].key,'Enter');assert.equal(gesture.events[0].repeat,false);assert.equal(gesture.events[1].key,null);
    if(gesture.total===3){assert.equal(gesture.events[2].key,'Enter');assert.equal(gesture.events[2].repeat,false);}
    assert.ok(gesture.events.every(row=>row.trusted&&row.targetIsLink&&row.focused&&row.href===destination&&!row.alt&&!row.ctrl&&!row.meta&&!row.shift));
    assert.deepEqual(commits,[destination]);await sourceOnly();
  }finally{page.off('framenavigated',onCommit);}
  await page.goBack();await page.waitForURL(saved);await restored();
  const after=await sceneFrame(page,{study:true,style:'storm-v4'});
  if(before){assert.ok(after);assert.equal(after.hash,before.hash);sameScenario(after,before);}
  await restored();
  const returned=page.locator('#lab-reference-evidence').getByRole('link',{name:'Read the source record',exact:true});await returned.focus();
  assert.equal(await returned.evaluate(node=>document.activeElement===node),true);
  t.diagnostic('FILTERED_GREEN_SOURCE_RETURN '+JSON.stringify({gesture,commits,nativeSceneCompared:Boolean(before),returnFocus:'explicit focusability only',scope:'Saved synthetic Form9 state and source-only documentary context. No historical camera or physical-device qualification.'}));
});
