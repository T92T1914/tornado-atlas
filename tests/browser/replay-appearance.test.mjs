import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture,base} from './harness.mjs';

const web=new URL('../../web/',import.meta.url);
const config=JSON.parse(await readFile(new URL('events/el-reno-2013.json',web),'utf8'));
const bundle=JSON.parse(await readFile(new URL('data.json',web),'utf8'));
function cameraRegistration(source,start,end,shape){
  return {
    id:'window-'+source.id,start_utc:start,end_utc:end,source_id:source.id,kind:'registered',
    basis:'Synthetic fixture for shared-clock browser behavior. No historical observation.',
    keys:[{at:0,shape,extent:.4,label:'Synthetic first appearance'},
      {at:1,shape,extent:1,label:'Synthetic second appearance'}],
    registration:{
      source:{url:source.url,video_id:source.video_id,original_locator:source.url,
        edit_identity:'Synthetic original edit',sha256:null,identity_basis:'Synthetic test identity.'},
      inspection:{status:'continuous_video_inspected',start_video_seconds:10,end_video_seconds:20,
        reviewed_on:'2026-10-07',discontinuities:'none_observed',basis:'Synthetic coverage declaration.'},
      timing:{method:'linear_verified',uncertainty_seconds:.5,basis:'Synthetic time alignment.',
        anchors:[{video_seconds:10,utc:start},{video_seconds:15,utc:'2013-05-31T23:05:05Z'},
          {video_seconds:20,utc:end}]},
      camera:{mode:'fixed_view',coordinates:[0,0],bearing_degrees:90,pitch_degrees:0,roll_degrees:0,
        position_uncertainty_m:10,orientation_uncertainty_degrees:2,
        lens_calibration:'Synthetic lens fixture',basis:'Synthetic fixed view.'},
      rights:{reuse:'external_links_only',creator:source.creator,uploader:'Fixture uploader',
        rights_holder:'Fixture rights holder',basis:'Only synthetic original links are shown.'},
      uncertainty:'Every source, viewpoint and form in this fixture is synthetic.'
    }
  };
}
async function synthetic(page){
  const data=structuredClone(bundle),manifest=structuredClone(config);
  const sources=['a','b'].map((suffix,i)=>({
    id:'synthetic-'+suffix,video_id:i?'zyxwvutsrqp':'abcdefghijk',
    url:'https://www.youtube.com/watch?v='+(i?'zyxwvutsrqp':'abcdefghijk'),
    creator:'Synthetic creator '+suffix.toUpperCase(),title:'Synthetic source '+suffix.toUpperCase(),
    duration_seconds:60,rights:'Synthetic fixture. External link only.',
    clock_basis:'Synthetic clock.',limits:'No historical El Reno claim.'
  }));
  data.footage.sources=sources;
  data.footage.anchors=sources.map((source,i)=>({
    id:'synthetic-anchor-'+i,source_id:source.id,video_seconds:10,utc:'2013-05-31T23:05:00Z',
    evidence:'onscreen_clock_sample',coordinates:null,bearing:null,note:'Synthetic paused frame only.'
  }));
  const start='2013-05-31T23:05:00Z',end='2013-05-31T23:05:10Z';
  data.appearance_timeline={schema_version:1,event:'el-reno-2013',windows:[
    cameraRegistration(sources[0],start,end,'cone'),
    cameraRegistration(sources[1],start,end,'rope'),
    {id:'authored-late',start_utc:'2013-05-31T23:05:22Z',end_utc:'2013-05-31T23:05:30Z',
      source_id:null,kind:'illustrative',basis:'Synthetic authored form only.',registration:null,
      keys:[{at:0,shape:'wedge',extent:.3,label:'Authored first form'},
        {at:1,shape:'rope',extent:.8,label:'Authored second form'}]}
  ]};
  manifest.schema_version=2;manifest.coverage.appearance='bounded_timeline';
  const body=JSON.stringify(data);
  manifest.bundle_sha256=createHash('sha256').update(body).digest('hex');
  await page.route('**/events/el-reno-2013.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(manifest)}));
  await page.route('**/data.json',route=>route.fulfill({contentType:'application/json',body}));
}

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`published El Reno checked frame and unknown gap at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783');
    await page.locator('#replay-time:not([disabled])').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Checked original frame/);
    assert.match(await page.locator('#replay-appearance-detail').textContent(),/S Choctaw/);
    assert.match(await page.locator('#replay-appearance-source').getAttribute('href'),/MxgU1QcFMJM&t=5s/);
    assert.equal(await page.locator('#replay-appearance-drawing').isVisible(),false);
    await page.locator('#replay-time').fill('782');
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Appearance unknown/);
    assert.equal(await page.locator('#replay-appearance-source').isVisible(),false);
    await page.reload();
    await page.locator('#replay-time:not([disabled])').waitFor();
    assert.equal(await page.locator('#replay-time').inputValue(),'782');
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Appearance unknown/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
  });
}

test('one replay clock drives synthetic source comparison, gaps, rate, pause and history',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await synthetic(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=60');
  await page.locator('#replay-time:not([disabled])').waitFor();
  const state=page.locator('#replay-appearance-state'),time=page.locator('#replay-time');
  assert.match(await state.textContent(),/Source-linked appearance anchor/);
  assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-evidence-state'),'observed');
  const graphics=await page.locator('#replay-appearance-canvas').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');if(!gl)return false;
    window.appearanceDraws={lines:0,points:0};
    const draw=gl.drawArrays;
    gl.drawArrays=function(...args){
      if(args[0]===gl.LINES)window.appearanceDraws.lines++;
      if(args[0]===gl.POINTS)window.appearanceDraws.points++;
      return draw.apply(this,args);
    };
    return true;
  });
  await time.fill('65');
  assert.match(await state.textContent(),/Interpolated appearance/);
  assert.match(await page.locator('#replay-appearance-source').getAttribute('href'),/abcdefghijk&t=15s/);
  if(graphics)await page.waitForFunction(()=>window.appearanceDraws.points>0);
  await page.locator('#footage-source').selectOption('synthetic-b');
  assert.equal(new URL(page.url()).searchParams.get('footage_source'),'synthetic-b');
  assert.match(await state.textContent(),/Interpolated appearance/);
  await time.fill('75');
  assert.match(await state.textContent(),/Appearance unknown/);
  assert.equal(await page.locator('#replay-appearance-source').isVisible(),false);
  await page.evaluate(()=>{
    window.appearanceStatusMutations=0;
    new MutationObserver(records=>window.appearanceStatusMutations+=records.length)
      .observe(document.querySelector('#replay-appearance-state'),{childList:true,characterData:true,subtree:true});
  });
  if(graphics){
    const before=await page.evaluate(()=>({...window.appearanceDraws}));
    await time.fill('76');
    await page.waitForFunction(before=>window.appearanceDraws.lines>before.lines,before);
    assert.equal(await page.evaluate(()=>window.appearanceDraws.points),before.points,'Unknown interval draws no funnel particles');
  }
  assert.equal(await page.evaluate(()=>window.appearanceStatusMutations),0,'An unchanged unknown interval does not rewrite the live status');
  await time.fill('65');
  assert.match(await state.textContent(),/Interpolated appearance/);
  await page.locator('#replay-rate').selectOption('1');
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>65.2);
  await page.locator('#replay-play').click();
  const paused=Number(await time.inputValue());
  await page.waitForTimeout(120);
  assert.equal(Number(await time.inputValue()),paused);
  await time.fill('60');
  assert.match(await state.textContent(),/Source-linked appearance anchor/);
  await page.goBack();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-a');
  assert.equal(await time.inputValue(),'65');
  assert.match(await state.textContent(),/Interpolated appearance/);
  await page.goForward();
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-b');
  await page.locator('#replay-appearance-mode').selectOption('illustrative');
  await time.fill('85');
  assert.match(await state.textContent(),/Illustrative authored form/);
  await time.fill('75');
  assert.match(await state.textContent(),/No illustrative form assigned/);
  await page.reload();
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'illustrative');
  assert.match(await state.textContent(),/No illustrative form assigned/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
});

test('changing form mode during playback records the displayed clock in history',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await synthetic(page);
  await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=60');
  await page.locator('#replay-time:not([disabled])').waitFor();
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>60.2);
  await page.locator('#replay-appearance-mode').selectOption('illustrative');
  const selected=new URL(page.url());
  assert.equal(selected.searchParams.get('appearance_view'),'illustrative');
  assert.equal(selected.searchParams.has('footage'),false);
  assert.ok(Number(selected.searchParams.get('t'))>60.2,'Mode history preserves the running moment');
  await page.goBack();
  assert.equal(await page.locator('#replay-appearance-mode').inputValue(),'source');
  assert.equal(await page.locator('#replay-time').inputValue(),'60');
  assert.match(await page.locator('#replay-appearance-state').textContent(),/Source-linked appearance anchor/);
});
