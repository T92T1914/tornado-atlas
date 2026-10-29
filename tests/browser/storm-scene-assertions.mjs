import assert from 'node:assert/strict';

// These synthetic camera constants were expanded independently from the
// declared eye, target, lens and clip values in the private preview review.
// They do not establish a historical camera or physical scale.
const groundMatrices={
  'synthetic-front':[1.40625,0,0,0,0,2.46749210357666,.161276176571846,.1607394963502884,0,.4018487334251404,-.9902923703193665,-.9869968891143799,0,-3.20773983001709,6.705908298492432,6.8832597732543945],
  'synthetic-oblique':[1.170070767402649,.21654152870178223,-.5497252345085144,-.5478958487510681,0,2.4693331718444824,.1566716879606247,.15615032613277435,-.7800471782684326,.32481229305267334,-.8245878219604492,-.8218438029289246,0,-3.2101333141326904,6.921026706695557,7.097661972045898],
};

export function sameScenario(actual,expected){
  for(const key of ['time','state','shape','progress','matrix'])assert.deepEqual(actual[key],expected[key],key+' stays at the selected scenario');
}

export async function readingState(page){
  return page.evaluate(()=>{
    const root=document.documentElement,style=getComputedStyle(root),body=getComputedStyle(document.body);
    return {choice:root.dataset.appearance,background:body.backgroundColor,text:body.color,scheme:style.colorScheme};
  });
}

// The probe observes one completed renderer call after the actual control event.
// Its microtask boundary includes any later POINTS pass in that same call.
// A theme test can therefore observe its change event without a compensating seek.
export async function sceneFrame(page,{study=false,value=study ? .5 : 130,seconds=15,style='storm-v1',
  trigger=study?'#sequence-time':'#replay-time',event='input',action=null,lighter=false,
  camera=study?null:'synthetic-front',pointCount=study?7200:3200,retain=null,compare=null,fromGap=false}={}){
  const canvas=study?'#scene':'#replay-appearance-canvas';
  const perform=action??(()=>page.locator(trigger).fill(String(value)));
  const available=await page.locator(canvas).evaluate(c=>Boolean(c.getContext('webgl2')));
  if(!available){
    assert.notEqual(process.env.ATLAS_BROWSER_ENGINE??'chromium','chromium','Chromium must supply the actual storm scene framebuffer');
    await perform();
    if(study){assert.equal(await page.locator('#scene-failure').isVisible(),true);assert.equal(await page.locator('#motion').isDisabled(),true);}
    else{assert.equal(await page.locator(canvas).isVisible(),false);assert.match(await page.locator('#replay-appearance-renderer-status').textContent(),/could not start|lost/);}
    console.info('STORM_SCENE_UNAVAILABLE '+JSON.stringify({study,trigger,event,seconds,scope:'Control and explicit unavailable-graphics behavior only. No native scene acceptance.'}));
    return null;
  }
  if(fromGap){
    assert.equal(study,false,'Gap recovery uses the replay');
    assert.equal(await page.locator(canvas).isVisible(),false,'The unsupported interval has no visible scene');
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Outside/);
    await page.locator(trigger).scrollIntoViewIfNeeded();
  }else await page.locator(canvas).scrollIntoViewIfNeeded();
  await page.evaluate(({canvas,trigger,event,retain,compare})=>{
    const c=document.querySelector(canvas),control=document.querySelector(trigger),gl=c.getContext('webgl2'),original=gl.drawArrays;
    if(!control)throw Error('Missing storm scene test control '+trigger);
    const state=window.stormSceneProbe={armed:false,done:false,queued:false,draws:[],omitted:0,frame:null,pixels:null,initiatingEvent:null};
    const arm=observed=>{state.armed=true;state.initiatingEvent={type:observed.type,id:control.id,value:control.value??null,trusted:observed.isTrusted};};
    control.addEventListener(event,arm,{capture:true,once:true});
    const intercept=function(...args){
      const result=original.apply(this,args);if(!state.armed||state.done)return result;
      const program=gl.getParameter(gl.CURRENT_PROGRAM),uniform=name=>{
        const location=gl.getUniformLocation(program,name);return location===null?null:gl.getUniform(program,location);
      },array=name=>{const value=uniform(name);return value===null?null:Array.from(value);};
      const shaders=(gl.getAttachedShaders(program)??[]).map(shader=>{
        const source=gl.getShaderSource(shader);
        return {type:gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.VERTEX_SHADER?'vertex':'fragment',
          reference:/^#define REFERENCE_FORM 1$/m.test(source),storm:/^#define STORM_SCENE [12]$/m.test(source),
          stormVersion:Number(source.match(/^#define STORM_SCENE ([12])$/m)?.[1]??0)};
      });
      const inverse=array('inverseCamera'),surface=uniform('surfacePass');
      const role=args[0]===gl.POINTS?'particles':args[0]===gl.LINES?'grid':args[0]===gl.TRIANGLES&&inverse!==null?(surface===true?'surface':surface===false?'volume':'unknown-volume'):'other';
      const record={role,mode:args[0],count:args[2],linked:gl.getProgramParameter(program,gl.LINK_STATUS),shaders,
        time:uniform('time'),state:array('formationState'),shape:array('shape'),progress:uniform('formationProgress'),
        extent:uniform('extent'),genesis:uniform('genesis'),world:uniform('worldLighting'),dust:uniform('dust'),
        palette:uniform('readingPalette'),surface,inverse,viewport:array('viewportBox'),pullback:array('stormPullback'),
        matrix:array('camera'),eye:array('worldEye'),kinematic:uniform('kinematic')};
      if(state.draws.length<8)state.draws.push(record);else state.omitted++;
      if(role!=='volume'&&role!=='particles')return result;
      const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
      if(width>512||height>320)throw Error('Storm scene raster exceeds the accepted browser probe bounds');
      const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let minimum=255,maximum=0;for(let i=3;i<pixels.length;i+=4){minimum=Math.min(minimum,pixels[i]);maximum=Math.max(maximum,pixels[i]);}
      const rect=c.getBoundingClientRect();state.pixels=pixels;
      state.frame={final:record,buffer:[width,height],css:[c.clientWidth,c.clientHeight],rect:[rect.width,rect.height],ratio:devicePixelRatio,alpha:[minimum,maximum]};
      if(!state.queued){state.queued=true;queueMicrotask(()=>{state.done=true;});}
      return result;
    };
    gl.drawArrays=intercept;
    window.stormSceneCleanup=()=>{control.removeEventListener(event,arm,true);if(gl.drawArrays===intercept)gl.drawArrays=original;};
    state.read=async()=>{
      const saved=window.stormSceneSavedPixels??=new Map(),previous=compare===null?null:saved.get(compare);
      const rawEqual=compare===null?null:previous instanceof Uint8Array&&previous.length===state.pixels.length&&previous.every((value,i)=>value===state.pixels[i]);
      if(retain!==null){if(!saved.has(retain)&&saved.size>=4)throw Error('Too many retained storm scene pixel buffers');saved.set(retain,state.pixels.slice());}
      return {...state.frame,draws:state.draws,omitted:state.omitted,initiatingEvent:state.initiatingEvent,rawEqual,
        hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',state.pixels))).map(value=>value.toString(16).padStart(2,'0')).join(''),
        error:gl.getError(),lost:gl.isContextLost()};
    };
  },{canvas,trigger,event,retain,compare});
  let originalFailure=null;
  try{
    await perform();await page.locator(canvas).scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>window.stormSceneProbe?.done===true);
    const observed=await page.evaluate(()=>window.stormSceneProbe.read());
    assert.equal(observed.error,0);assert.equal(observed.lost,false);assert.equal(observed.omitted,0);assert.equal(observed.initiatingEvent?.type,event);
    const {final}=observed,storm=['storm-v1','storm-v2'].includes(style),stormVersion=style==='storm-v2'?2:storm?1:0,
      volumes=observed.draws.filter(draw=>draw.role==='volume'),surfaces=observed.draws.filter(draw=>draw.role==='surface'),grids=observed.draws.filter(draw=>draw.role==='grid'),points=observed.draws.filter(draw=>draw.role==='particles');
    assert.equal(volumes.length,1);assert.equal(surfaces.length,1);assert.ok(grids.length>=1);
    assert.equal(points.length,storm?0:1,'The new scene has no separate particle pass');
    assert.deepEqual(observed.draws.filter(draw=>['unknown-volume','other'].includes(draw.role)),[]);
    assert.equal(final.role,storm?'volume':'particles');assert.equal(final.mode,storm?4:0);assert.equal(final.count,storm?6:pointCount);
    assert.equal(final.genesis,true);assert.equal(final.world,true);assert.ok(Math.abs(final.time-seconds)<3e-5);
    assert.equal(final.kinematic,storm?null:true);assert.equal(final.eye===null,storm);
    const matrix=grids[0].matrix;assert.equal(matrix?.length,16);
    for(const grid of grids)assert.deepEqual(grid.matrix,matrix,'Ground and circulation submit one camera');
    for(const pass of [...surfaces,...volumes]){
      assert.equal(pass.linked,true);assert.equal(pass.mode,4);assert.equal(pass.count,6);
      assert.equal(pass.surface,pass.role==='surface');assert.equal(pass.genesis,true);assert.equal(pass.world,true);assert.equal(pass.extent,1);
      assert.equal(pass.time,final.time);assert.deepEqual(pass.shape,final.shape);assert.deepEqual(pass.state,final.state);
      assert.ok(Math.abs(pass.progress-Math.fround(seconds/30))<2e-6);
      assert.equal(pass.palette,storm?2:final.palette);
      assert.equal(pass.shaders.length,2);
      for(const shader of pass.shaders){
        assert.equal(shader.reference,shader.type==='fragment');assert.equal(shader.storm,storm&&shader.type==='fragment');
        assert.equal(shader.stormVersion,shader.type==='fragment'?stormVersion:0,'The actual submitted shader uses the requested version');
      }
      if(stormVersion===2){
        const vertical=Math.exp(-.036*seconds);
        assert.deepEqual(pass.pullback,Array.from(new Float32Array([vertical,Math.exp(.018*seconds),(.08/.036)*(vertical-1),0])),
          'Actual per-draw factors follow the independently specified authored transport');
      }else assert.equal(pass.pullback,null,'Earlier programs do not borrow the new version uniform');
      assert.equal(pass.inverse?.length,16);
      for(let row=0;row<4;row++)for(let column=0;column<4;column++){
        const product=[0,1,2,3].reduce((sum,k)=>sum+matrix[k*4+row]*pass.inverse[column*4+k],0);
        assert.ok(Math.abs(product-(row===column?1:0))<1e-4,'Actual volume inverse matches the submitted ground camera');
      }
    }
    if(storm){assert.equal(final.matrix,null);assert.equal(final.progress,volumes[0].progress);assert.deepEqual(observed.alpha,[255,255],'Every raw framebuffer pixel is opaque, including letterboxing');}
    else{
      assert.equal(final.linked,true);assert.deepEqual(final.matrix,matrix);
      for(const shader of final.shaders){assert.equal(shader.reference,shader.type==='vertex');assert.equal(shader.storm,false);}
      if(final.progress!==null)assert.equal(final.progress,volumes[0].progress);
    }
    if(camera!==null){
      assert.ok(groundMatrices[camera]);
      matrix.forEach((value,i)=>assert.ok(Math.abs(value-groundMatrices[camera][i])<2e-6,'Independent declared camera component '+i));
    }
    const [width,height]=study?observed.rect:observed.css,[capWidth,capHeight]=lighter?[320,200]:[512,320],scale=Math.min(observed.ratio,2,capWidth/width,capHeight/height);
    assert.deepEqual(observed.buffer,[Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))]);
    return {...observed,time:final.time,state:final.state,shape:final.shape,progress:volumes[0].progress,matrix,lines:grids.length,dust:volumes[0].dust};
  }catch(error){originalFailure=error;throw error;}
  finally{
    try{await page.evaluate(()=>{window.stormSceneCleanup?.();window.stormSceneCleanup=null;window.stormSceneProbe=null;});}
    catch(error){if(!originalFailure)throw error;console.error('STORM_SCENE_CLEANUP_FAILURE '+String(error).slice(0,500));}
  }
}
