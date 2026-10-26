import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeSnapshot} from './browser/ground-view-assertions.mjs';

// Controlled page contract only. These objects do not provide browser or GPU evidence.
function unavailablePage({retainTime=false,camera='synthetic-front',visible=false,fillError=null}={}){
  const state={time:'120',fills:[]};
  const canvas={getContext:()=>null};
  return {state,locator(selector){
    if(selector==='#replay-appearance-canvas')return {
      evaluate:async fn=>fn(canvas),isVisible:async()=>visible,
      getAttribute:async name=>{assert.equal(name,'data-source-camera');return camera;}
    };
    if(selector==='#replay-appearance-renderer-status')return {textContent:async()=>'The form renderer could not start here.'};
    if(selector==='#replay-time')return {
      fill:async value=>{state.fills.push(value);if(fillError)throw fillError;if(!retainTime)state.time=value;},
      inputValue:async()=>state.time
    };
    throw Error('Unexpected controlled page selector: '+selector);
  }};
}
function engine(t,value){
  const previous=process.env.ATLAS_BROWSER_ENGINE;process.env.ATLAS_BROWSER_ENGINE=value;
  t.after(()=>{if(previous===undefined)delete process.env.ATLAS_BROWSER_ENGINE;else process.env.ATLAS_BROWSER_ENGINE=previous;});
}

test('unavailable graphics still applies exactly the requested input without claiming a render',async t=>{
  engine(t,'firefox');const page=unavailablePage();
  const result=await nativeSnapshot(page,130,'synthetic-front');
  assert.deepEqual(page.state.fills,['130']);assert.equal(page.state.time,'130');
  assert.equal(result.available,false);assert.equal(result.time,130);assert.equal(result.selectedCamera,'synthetic-front');
});
test('unavailable graphics refuses an input that leaves the old clock selected',async t=>{
  engine(t,'firefox');const page=unavailablePage({retainTime:true});
  await assert.rejects(nativeSnapshot(page,130,'synthetic-front'),/requested time/);
  assert.deepEqual(page.state.fills,['130']);
});
test('unavailable graphics refuses a different selected camera',async t=>{
  engine(t,'firefox');const page=unavailablePage({camera:'synthetic-oblique'});
  await assert.rejects(nativeSnapshot(page,130,'synthetic-front'),/selected source camera/);
});
test('Chromium cannot substitute unavailable graphics for a required drawing',async t=>{
  engine(t,'chromium');const page=unavailablePage();
  await assert.rejects(nativeSnapshot(page,130,'synthetic-front'),/Chromium must supply actual rendered-scene evidence/);
});
test('unavailable graphics requires the fallback canvas to be withheld',async t=>{
  engine(t,'firefox');const page=unavailablePage({visible:true});
  await assert.rejects(nativeSnapshot(page,130,'synthetic-front'),{name:'AssertionError'});
});
test('unavailable graphics preserves the original input failure',async t=>{
  engine(t,'firefox');const original=new Error('controlled original range input failure');
  const page=unavailablePage({fillError:original});
  await assert.rejects(nativeSnapshot(page,130,'synthetic-front'),error=>error===original);
});
