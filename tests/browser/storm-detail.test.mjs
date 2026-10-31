import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow} from './ground-view-assertions.mjs';
import {sceneFrame,sameScenario,readingState} from './storm-scene-assertions.mjs';

const form7='study.html?experiment=form-7&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=storm-detail&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=ordinary&flow=1&presentation=storm-v2';
const replay='reconstruction.html?event=el-reno-2013&appearance_view=formation&appearance_style=storm-v2&ground_view=synthetic-front&t=130&footage_source=robinson-dashcam';

// Literal binary32 expectations expanded independently from the existing h=1 body geometry.
// No product attachment or formation helper supplies these expected values.
const attachmentFrames=[
  {
    "seconds": 6,
    "form_position": 0.2,
    "replay_seconds": 124,
    "shape_f32": [
      0.1899999976158142,
      0.48664721846580505,
      0.07000000029802322
    ],
    "attachment_f32": [
      0.12849999964237213,
      -0.10000000149011612,
      1.6353275775909424,
      1.1754823923110962
    ]
  },
  {
    "seconds": 15,
    "form_position": 0.5,
    "replay_seconds": 130,
    "shape_f32": [
      0.4569677710533142,
      0.6000000238418579,
      0.07000000029802322
    ],
    "attachment_f32": [
      0.12849999964237213,
      -0.10000000149011612,
      1.9067628383636475,
      1.4906209707260132
    ]
  },
  {
    "seconds": 24,
    "form_position": 0.8,
    "replay_seconds": 136,
    "shape_f32": [
      0.33903831243515015,
      0.5481593012809753,
      0.19960179924964905
    ],
    "attachment_f32": [
      0.19978098571300507,
      -0.10000000149011612,
      1.6629077196121216,
      1.4456897974014282
    ]
  },
  {
    "seconds": 30,
    "form_position": 1,
    "replay_seconds": 140,
    "shape_f32": [
      0.18000000715255737,
      0.47999998927116394,
      0.3700000047683716
    ],
    "attachment_f32": [
      0.29350000619888306,
      -0.10000000149011612,
      1.463056206703186,
      1.301476240158081
    ]
  }
];
function checkAttachmentFrame(frame,expected){
  assert.equal(frame.time,expected.seconds);
  assert.equal(frame.shape?.length,3);
  frame.shape.forEach((value,index)=>assert.ok(Math.abs(value-expected.shape_f32[index])<=2e-7,
    'Independent authored shape at '+expected.seconds+'/'+index));
  const passes=frame.draws.filter(draw=>draw.role==='volume'||draw.role==='surface');
  assert.equal(passes.length,2);
  for(const pass of passes){
    assert.equal(pass.attachment?.length,4);
    pass.attachment.forEach((value,index)=>assert.ok(Math.abs(value-expected.attachment_f32[index])<=2e-7,
      'Independent h=1 attachment upload at '+expected.seconds+'/'+index));
  }
}

test('native storm-v2 compiles and submits independently specified pullback factors without borrowing storm-v1',async t=>{
  const page=await fixture(t,{deviceScaleFactor:1,reducedMotion:'reduce'});await page.goto(base+'/study.html');
  const result=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:320px;height:180px';document.body.prepend(canvas);
    let renderer=null,original=null;
    try{
      const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,powerPreference:'low-power'});
      if(!gl)return {available:false};
      const {createFormRenderer}=await import('/form-renderer.mjs');renderer=createFormRenderer(canvas,7200);
      const frames=[];let peak=null;
      for(const [style,seconds]of [['storm-v1',15],['storm-v2',0],['storm-v2',10],['storm-v2',30],['storm-v2',15],['storm-v2',15]]){
        renderer.render({shape:{base:.4,flare:.5,bend:.1},extent:1,time:seconds,dust:true,azimuth:25,elevation:12,distance:7,
          motionModel:'genesis-v1',formationTime:seconds,flow:true,readingAppearance:'dark',lightingStyle:style});
        const program=gl.getParameter(gl.CURRENT_PROGRAM),uniform=name=>{
          const location=gl.getUniformLocation(program,name);return location===null?null:gl.getUniform(program,location);
        },array=name=>{const value=uniform(name);return value===null?null:Array.from(value);};
        const shaders=(gl.getAttachedShaders(program)||[]).map(shader=>{
          const source=gl.getShaderSource(shader);
          return {compiled:gl.getShaderParameter(shader,gl.COMPILE_STATUS),fragment:gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER,
            reference:/^#define REFERENCE_FORM 1$/m.test(source),version:Number(source.match(/^#define STORM_SCENE ([12])$/m)?.[1]??0)};
        });
        const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
        gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let minimum=255,maximum=0;for(let i=0;i<pixels.length;i++)if(i%4!==3){minimum=Math.min(minimum,pixels[i]);maximum=Math.max(maximum,pixels[i]);}
        const repeated=peak===null?null:peak.length===pixels.length&&peak.every((value,index)=>value===pixels[index]);
        if(style==='storm-v2'&&seconds===15&&peak===null)peak=pixels.slice();
        frames.push({style,seconds,shaders,linked:gl.getProgramParameter(program,gl.LINK_STATUS),pullback:array('stormPullback'),
          time:uniform('time'),state:array('formationState'),shape:array('shape'),inverse:array('inverseCamera'),viewport:array('viewportBox'),
          surface:uniform('surfacePass'),buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],repeated,
          opaque:pixels.every((value,index)=>index%4!==3||value===255),range:maximum-minimum,
          hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(value=>value.toString(16).padStart(2,'0')).join(''),
          error:gl.getError(),lost:gl.isContextLost()});
      }
      return {available:true,frames};
    }catch(error){original=error;throw error;}
    finally{
      try{renderer?.dispose();}catch(error){if(!original)throw error;console.error('STORM_DETAIL_CLEANUP_FAILURE '+String(error).slice(0,500));}
      finally{canvas.remove();}
    }
  });
  if(!result.available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must compile the actual new storm program');
    t.skip('STORM_DETAIL_UNAVAILABLE Native shader and framebuffer acceptance unavailable in this engine.');return;
  }
  assert.equal(result.frames.length,6);
  for(const frame of result.frames){
    assert.equal(frame.linked,true);assert.equal(frame.error,0);assert.equal(frame.lost,false);assert.equal(frame.opaque,true);assert.ok(frame.range>0);
    assert.deepEqual(frame.buffer,[320,180]);assert.deepEqual(frame.viewport,[0,0,320,180]);assert.equal(frame.time,frame.seconds);assert.equal(frame.surface,false);
    assert.equal(frame.shaders.length,2);
    for(const shader of frame.shaders){assert.equal(shader.compiled,true);assert.equal(shader.reference,shader.fragment);assert.equal(shader.version,shader.fragment?(frame.style==='storm-v2'?2:1):0);}
  }
  assert.equal(result.frames[0].pullback,null,'The retained v1 program has no new per-draw uniform');
  // Literal analytic values also used by the independent CPU factor checks.
  // No production factor function supplies this native test's expected values.
  const factors=[[1,1,0,0],[.697676326071031,1.1972173631218102,-.6718303865088199,0],[.3395955256449391,1.7160068621848585,-1.467565498566802,0]];
  for(let i=0;i<factors.length;i++){
    const actual=result.frames[i+1].pullback;assert.equal(actual?.length,4);
    actual.forEach((value,index)=>assert.ok(Math.abs(value-factors[i][index])<1e-7,'Independent native factor '+i+'/'+index));
  }
  assert.equal(new Set(result.frames.slice(1,4).map(frame=>frame.hash)).size,3,'Transport changes the actual framebuffer at the three declared times');
  for(const key of ['time','state','shape','inverse','viewport','buffer'])assert.deepEqual(result.frames[4][key],result.frames[0][key],'Matched old/new '+key);
  assert.notEqual(result.frames[4].hash,result.frames[0].hash,'The version selection changes actual matched rendered pixels');
  assert.equal(result.frames[5].repeated,true,'A repeated complete render restores every raw RGBA byte');
});

for(const [style,scenario,formRoute]of [['storm-v2','storm-detail',form7],['storm-v3','storm-integrated',form7.replaceAll('form-7','form-8').replaceAll('storm-detail','storm-integrated').replaceAll('storm-v2','storm-v3')]])for(const [width,theme]of [[320,'light'],[1280,'dark']])test(`${style} Form and Replay preserve opaque native state and complete framing at ${width} ${theme}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  for(const study of [true,false]){
    await page.goto(base+'/'+(study?formRoute:replay.replace('storm-v2',style)));
    await page.locator(study?'#lab-context[data-experiment-ready="true"]':'#replay-time:not([disabled])').waitFor();
    if(study){
      assert.equal(await page.locator('#sequence-coverage').inputValue(),scenario);
      assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),style);
      assert.equal(await page.locator('#sequence-enabled').isChecked(),true);
    }
    await page.locator('#reading-appearance').selectOption(theme);
    const before=await sceneFrame(page,{study,style,retain:'detail-before'}),ui=await readingState(page);
    if(study)await page.waitForURL(base+'/'+formRoute);
    const saved=page.url();
    if(before){
      assert.deepEqual(before.state,[1,0,1,1]);assert.deepEqual(before.alpha,[255,255]);
      // The declared replay image is 1280x720. Integer backing dimensions
      // retain its complete frame with the existing centered pixel rounding.
      const [w,h]=before.buffer,scale=Math.min(w/1280,h/720),fw=1280*scale,fh=720*scale;
      const expectedViewport=study?[0,0,w,h]:[Math.floor((w-fw)/2),Math.floor((h-fh)/2),Math.round(fw),Math.round(fh)];
      assert.deepEqual(before.final.viewport,expectedViewport);
    }
    if(!study){
      assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-scene-frame'),'complete-synthetic');
      const fit=await page.locator('#replay-appearance-canvas').evaluate(canvas=>[canvas.clientWidth,canvas.clientHeight]);
      if(before)assert.ok(Math.abs(fit[0]/fit[1]-16/9)<.025,'The complete declared camera follows its image aspect ratio');
      else{
        assert.deepEqual(fit,[0,0],'An explicitly unavailable and hidden canvas has no displayed camera frame');
        assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
        assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start|lost/);
      }
      assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
    }
    if(style==='storm-v3'&&before){
      const defaultAttachment=attachmentFrames.find(row=>row.seconds===15);
      checkAttachmentFrame(before,defaultAttachment);
      if(study){
        for(const [id,wanted]of [['azimuth','25'],['elevation','12'],['distance','7']])assert.equal(await page.locator('#'+id).inputValue(),wanted);
      }else assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-front');
      for(const expected of attachmentFrames.filter(row=>row.seconds!==15)){
        const sought=await sceneFrame(page,{study,style,value:study?expected.form_position:expected.replay_seconds,seconds:expected.seconds});
        assert.ok(sought,'The actual storm-v3 renderer supplies both submitted attachment uniforms');
        checkAttachmentFrame(sought,expected);
        assert.deepEqual(sought.matrix,before.matrix,'Seeking changes authored state without changing the declared default camera');
      }
      const returned=await sceneFrame(page,{study,style,compare:'detail-before'});
      assert.ok(returned);checkAttachmentFrame(returned,defaultAttachment);sameScenario(returned,before);
      assert.equal(returned.rawEqual,true,'Reverse seek restores every RGBA byte after the current attachment updates');
      assert.equal(returned.hash,before.hash);await page.waitForURL(saved);
    }
    const changed=await sceneFrame(page,{study,style,trigger:'#reading-appearance',event:'change',compare:'detail-before',
      action:()=>page.locator('#reading-appearance').selectOption(theme==='light'?'dark':'light')});
    const changedUI=await readingState(page);assert.notEqual(changedUI.background,ui.background);assert.notEqual(changedUI.text,ui.text);assert.equal(page.url(),saved);
    if(before){sameScenario(changed,before);assert.equal(changed.rawEqual,true);assert.equal(changed.hash,before.hash);}
    if(study){
      const old=await sceneFrame(page,{study:true,style:'storm-v1',trigger:'#sequence-coverage',event:'change',action:()=>page.locator('#sequence-coverage').selectOption('storm')});
      if(before){sameScenario(old,before);assert.notEqual(old.hash,before.hash);}
      const detail=await sceneFrame(page,{study:true,style,trigger:'#sequence-coverage',event:'change',compare:'detail-before',action:()=>page.locator('#sequence-coverage').selectOption(scenario)});
      if(before)assert.equal(detail.rawEqual,true);
      const noDust=await sceneFrame(page,{study:true,style,trigger:'#dust',action:()=>page.locator('#dust').uncheck()});
      if(before){sameScenario(noDust,before);assert.equal(noDust.dust,false);assert.notEqual(noDust.hash,before.hash);}
      const dust=await sceneFrame(page,{study:true,style,trigger:'#dust',compare:'detail-before',action:()=>page.locator('#dust').check()});
      if(before)assert.equal(dust.rawEqual,true);
      await page.locator('#lab-share').click();assert.equal(page.url(),base+'/'+formRoute);
      const link=new URL(await page.locator('.formation-context a[href*="reconstruction.html"]').getAttribute('href'),page.url());
      assert.equal(link.searchParams.get('appearance_style'),style);
    }else{
      const lower=await sceneFrame(page,{style,trigger:'#ground-quality',event:'change',lighter:true,action:()=>page.locator('#ground-quality').selectOption('1600')});
      if(before){
        sameScenario(lower,before);
        if(before.buffer[0]>320||before.buffer[1]>200)assert.notDeepEqual(lower.buffer,before.buffer);
        else{assert.deepEqual(lower.buffer,before.buffer);assert.equal(lower.hash,before.hash,'A canvas already below both raster caps keeps its complete pixels');}
      }
      const standard=await sceneFrame(page,{style,trigger:'#ground-quality',event:'change',compare:'detail-before',action:()=>page.locator('#ground-quality').selectOption('3200')});
      if(before)assert.equal(standard.rawEqual,true);
    }
    await page.reload();await page.locator(study?'#lab-context[data-experiment-ready="true"]':'#replay-time:not([disabled])').waitFor();
    assert.equal(await page.locator(study?'#sequence-time':'#replay-time').inputValue(),study?'0.5':'130');
    assert.equal(await page.locator(study?'#motion':'#replay-play').textContent(),study?'Play motion':'Play timeline');
    const restored=await sceneFrame(page,{study,style});if(before)assert.equal(restored.hash,before.hash);
    const params=new URL(page.url()).searchParams;
    if(study){assert.equal(params.get('experiment'),style==='storm-v3'?'form-8':'form-7');assert.equal(params.get('coverage'),scenario);assert.equal(params.get('presentation'),style);}
    else{assert.equal(params.get('appearance_style'),style);assert.equal(params.get('t'),'130');assert.equal(params.get('ground_view'),'synthetic-front');assert.equal(params.get('footage_source'),'robinson-dashcam');}
    await enlargeText(page);await reflow(page);
  }
});
