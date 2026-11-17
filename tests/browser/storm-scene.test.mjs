import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {enlargeText,reflow} from './ground-view-assertions.mjs';
import {sceneFrame,sameScenario,readingState} from './storm-scene-assertions.mjs';

const replay='reconstruction.html?event=el-reno-2013&appearance_view=formation&appearance_style=storm-v1&ground_view=synthetic-front&t=130&footage_source=robinson-dashcam';
const form6='study.html?experiment=form-6&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=storm&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=ordinary&flow=1&presentation=storm-v1';
const form5='study.html?experiment=form-5&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=reference&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=ordinary&flow=1&presentation=reference-v1';
const referenceReplay='reconstruction.html?event=el-reno-2013&appearance_view=formation&appearance_style=reference-v1&ground_view=synthetic-front&t=130&footage_source=robinson-dashcam';

async function readyStudy(page,url='study.html'){
  await page.goto(base+'/'+url);await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
}
async function readyReplay(page,url=replay){
  await page.goto(base+'/'+url);await page.locator('#replay-time:not([disabled])').waitFor();
}
async function twoFrames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function paused(page,study){
  const button=study?'#motion':'#replay-play',input=study?'#sequence-time':'#replay-time',label=study?'Play motion':'Play timeline';
  await page.waitForFunction(({button,label})=>document.querySelector(button).textContent===label,{button,label});
  const value=await page.locator(input).inputValue();await twoFrames(page);assert.equal(await page.locator(input).inputValue(),value);
}

for(const [width,theme]of [[320,'light'],[1280,'dark']])test(`storm scene keeps opaque RGBA while actual reading appearance changes at ${width} ${theme}`,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  for(const study of [true,false]){
    if(study)await readyStudy(page,form6);else await readyReplay(page);
    await page.locator('#reading-appearance').selectOption(theme);
    if(study){
      assert.equal(await page.locator('#sequence-coverage').inputValue(),'storm');
      assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v1');
      assert.equal(await page.locator('#sequence-enabled').isChecked(),true);
    }
    const initialUI=await readingState(page),before=await sceneFrame(page,{study,retain:'theme-before'});
    if(study)await page.waitForURL(base+'/'+form6);
    const url=page.url(),other=theme==='light'?'dark':'light';
    const changed=await sceneFrame(page,{study,trigger:'#reading-appearance',event:'change',
      action:()=>page.locator('#reading-appearance').selectOption(other),compare:'theme-before'});
    const changedUI=await readingState(page);
    assert.equal(initialUI.choice,theme);assert.equal(changedUI.choice,other);
    assert.notEqual(changedUI.background,initialUI.background,'The surrounding reading appearance actually changes');
    assert.notEqual(changedUI.text,initialUI.text);assert.equal(page.url(),url,'A reading choice does not rewrite the experiment or replay clock');
    if(before){assert.ok(changed);sameScenario(changed,before);assert.equal(changed.rawEqual,true,'Compare every raw RGBA byte after the actual theme event');assert.equal(changed.hash,before.hash);assert.deepEqual(changed.buffer,before.buffer);}
    const restored=await sceneFrame(page,{study,trigger:'#reading-appearance',event:'change',
      action:()=>page.locator('#reading-appearance').selectOption(theme),compare:'theme-before'});
    if(before)assert.equal(restored.rawEqual,true);
    assert.equal(await page.locator(study?'#motion':'#replay-play').textContent(),study?'Play motion':'Play timeline');
    const source=page.locator(study?'#reference-form-sources a[href="index.html#storm-photographs"]':'a[data-event-documentary="#registered-footage"]');
    await source.focus();await page.keyboard.press('Enter');
    await page.waitForURL(url=>url.pathname===new URL(base+'/index.html').pathname&&url.hash===(study?'#storm-photographs':'#registered-footage'));
    await page.goBack();
    if(study)await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
    else await page.locator('#replay-time:not([disabled])').waitFor();
    assert.equal(await page.locator(study?'#sequence-time':'#replay-time').inputValue(),study?'0.5':'130');
    if(!study)assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
    const returned=await sceneFrame(page,{study});if(before)assert.equal(returned.hash,before.hash);
    await enlargeText(page);await reflow(page);
  }
});

test('form-6 restores one authored clock while quality, dust, flow, keyboard and source return keep their own controls',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  await readyStudy(page,form6);assert.equal(await page.locator('#lab-state').getAttribute('data-state'),'restored');
  for(const option of await page.locator('#quality option').allTextContents())assert.doesNotMatch(option,/particles/);
  const mature=await sceneFrame(page,{study:true,retain:'mature'});
  if(mature){assert.deepEqual(mature.state,[1,0,1,1]);assert.equal(mature.lines,2);assert.equal(mature.dust,true);}
  const end=await sceneFrame(page,{study:true,value:1,seconds:30});if(end)assert.deepEqual(end.state,[0,1,0,0]);
  const reverse=await sceneFrame(page,{study:true,compare:'mature'});if(mature)assert.equal(reverse.rawEqual,true);
  const noFlow=await sceneFrame(page,{study:true,trigger:'#flow-cues',event:'change',action:()=>page.locator('#flow-cues').uncheck()});
  const neither=await sceneFrame(page,{study:true,trigger:'#dust',action:()=>page.locator('#dust').uncheck()});
  if(mature){
    sameScenario(noFlow,mature);sameScenario(neither,mature);assert.equal(noFlow.lines,1);assert.equal(neither.lines,1);
    assert.equal(noFlow.dust,true);assert.equal(neither.dust,false);
    assert.notEqual(noFlow.hash,mature.hash,'Circulation arrows are independently removable');assert.notEqual(neither.hash,noFlow.hash,'Dust changes the integrated volume at unchanged condensation, camera and time');
  }
  await page.locator('#flow-cues').check();await page.locator('#dust').check();
  const restored=await sceneFrame(page,{study:true,compare:'mature'});if(mature)assert.equal(restored.rawEqual,true);
  const limited=await sceneFrame(page,{study:true,trigger:'#condensation-visibility',event:'change',action:()=>page.locator('#condensation-visibility').selectOption('limited')});
  if(mature){assert.ok(Math.abs(limited.state[0]-.22)<1e-6);assert.deepEqual(limited.state.slice(1),[0,1,1]);assert.deepEqual(limited.matrix,mature.matrix);assert.deepEqual(limited.shape,mature.shape);assert.equal(limited.time,mature.time);assert.notEqual(limited.hash,mature.hash);}
  await page.locator('#condensation-visibility').selectOption('ordinary');
  const lighter=await sceneFrame(page,{study:true,trigger:'#quality',event:'change',lighter:true,action:()=>page.locator('#quality').selectOption('3600')});
  if(mature){sameScenario(lighter,mature);assert.notDeepEqual(lighter.buffer,mature.buffer);assert.equal(lighter.final.count,6);}
  const standard=await sceneFrame(page,{study:true,trigger:'#quality',event:'change',compare:'mature',action:()=>page.locator('#quality').selectOption('7200')});
  if(mature)assert.equal(standard.rawEqual,true);
  await page.locator('#sequence-enabled').uncheck();
  assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'legacy');
  assert.match(await page.locator('#quality option[value="7200"]').textContent(),/7,200 particles/);
  assert.match(await page.locator('#quality option[value="3600"]').textContent(),/3,600 particles/);
  await page.locator('#sequence-coverage').selectOption('storm');
  assert.equal(await page.locator('#sequence-enabled').isChecked(),true);
  for(const label of await page.locator('#quality option').allTextContents())assert.doesNotMatch(label,/particles/);
  const restoredScene=await sceneFrame(page,{study:true,compare:'mature'});if(mature)assert.equal(restoredScene.rawEqual,true);
  const rotated=await sceneFrame(page,{study:true,trigger:'#scene',event:'keydown',action:async()=>{await page.locator('#scene').focus();await page.keyboard.press('ArrowRight');}});
  assert.equal(await page.locator('#azimuth').inputValue(),'30');
  if(mature){assert.notDeepEqual(rotated.matrix,mature.matrix);assert.deepEqual(rotated.state,mature.state);assert.equal(rotated.time,mature.time);}
  const unrotated=await sceneFrame(page,{study:true,trigger:'#scene',event:'keydown',compare:'mature',action:async()=>{await page.locator('#scene').focus();await page.keyboard.press('ArrowLeft');}});
  if(mature)assert.equal(unrotated.rawEqual,true);
  await page.locator('#lab-share').click();const saved=page.url();
  assert.deepEqual(Object.fromEntries(new URL(saved).searchParams),Object.fromEntries(new URL(base+'/'+form6).searchParams));
  const replayLink=new URL(await page.locator('.formation-context a[href*="reconstruction.html"]').getAttribute('href'),page.url());
  assert.equal(replayLink.searchParams.get('appearance_style'),'storm-v1');
  await page.reload();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');assert.equal(await page.locator('#motion').textContent(),'Play motion');
  const reloaded=await sceneFrame(page,{study:true});if(mature)assert.equal(reloaded.hash,mature.hash);
  await page.locator('#lab-event').selectOption('el-reno-2013');
  assert.equal(new URL(page.url()).searchParams.get('event'),'el-reno-2013');
  await page.goBack();assert.equal(new URL(page.url()).searchParams.has('event'),false);
  await page.goForward();assert.equal(new URL(page.url()).searchParams.get('event'),'el-reno-2013');
  const source=page.locator('#reference-form-sources a[href="index.html#storm-photographs"]');await source.focus();await page.keyboard.press('Enter');
  await page.waitForURL(base+'/index.html?t=0#storm-photographs');await page.goBack();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('experiment'),'form-6');assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');
  assert.equal(await page.locator('#flow-cues').isChecked(),true);assert.equal(await page.locator('#dust').isChecked(),true);
  const returned=await sceneFrame(page,{study:true});if(mature)assert.equal(returned.hash,mature.hash);
  if(returned){
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#motion').click();
    await page.waitForFunction(()=>Number(document.querySelector('#sequence-time').value)>.5);
    await page.emulateMedia({reducedMotion:'reduce'});await paused(page,true);
  }
});

test('storm replay retains its locked camera and source across reverse seek, history, reload and paused motion',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});await readyReplay(page);
  assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  for(const option of await page.locator('#ground-quality option').allTextContents())assert.doesNotMatch(option,/particles/);
  const mature=await sceneFrame(page,{retain:'mature'});
  const end=await sceneFrame(page,{value:140,seconds:30});if(end)assert.deepEqual(end.state,[0,1,0,0]);
  const reverse=await sceneFrame(page,{compare:'mature'});if(mature)assert.equal(reverse.rawEqual,true);
  const low=await sceneFrame(page,{trigger:'#ground-quality',event:'change',lighter:true,action:()=>page.locator('#ground-quality').selectOption('1600')});
  if(mature){sameScenario(low,mature);assert.notDeepEqual(low.buffer,mature.buffer);assert.equal(low.final.count,6);}
  const standard=await sceneFrame(page,{trigger:'#ground-quality',event:'change',compare:'mature',action:()=>page.locator('#ground-quality').selectOption('3200')});
  if(mature)assert.equal(standard.rawEqual,true);
  const oblique=await sceneFrame(page,{trigger:'#ground-camera',event:'change',camera:'synthetic-oblique',action:()=>page.locator('#ground-camera').selectOption('synthetic-oblique')});
  if(mature){assert.notDeepEqual(oblique.matrix,mature.matrix);assert.deepEqual(oblique.state,mature.state);assert.equal(oblique.time,mature.time);}
  await page.goBack();assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-front');
  await page.goForward();assert.equal(await page.locator('#ground-camera').inputValue(),'synthetic-oblique');
  await page.reload();await page.locator('#replay-time:not([disabled])').waitFor();
  const parameters=new URL(page.url()).searchParams;
  for(const [key,value]of Object.entries({appearance_view:'formation',appearance_style:'storm-v1',ground_view:'synthetic-oblique',t:'130',footage_source:'robinson-dashcam'}))assert.equal(parameters.get(key),value);
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  const reloaded=await sceneFrame(page,{camera:'synthetic-oblique'});if(oblique)assert.equal(reloaded.hash,oblique.hash);
  const stage=page.locator('[data-ground-second="130"]');
  const keyboard=await sceneFrame(page,{trigger:'[data-ground-second="130"]',event:'click',camera:'synthetic-oblique',action:async()=>{await stage.focus();await page.keyboard.press('Enter');}});
  if(oblique){sameScenario(keyboard,oblique);assert.equal(keyboard.hash,oblique.hash);}
  assert.equal(await stage.evaluate(node=>node===document.activeElement&&node.matches(':focus-visible')),true);
  const pathTurn=await sceneFrame(page,{trigger:'#replay-scene',event:'keydown',camera:'synthetic-oblique',action:async()=>{await page.locator('#replay-scene').focus();await page.keyboard.press('ArrowRight');}});
  if(oblique){sameScenario(pathTurn,oblique);assert.equal(pathTurn.hash,oblique.hash,'Turning the geographic path leaves the explicitly locked appearance camera unchanged');}
  assert.equal(await page.locator('#replay-azimuth').inputValue(),'5');
  const source=page.locator('a[data-event-documentary="#registered-footage"]');await source.focus();await page.keyboard.press('Enter');
  await page.waitForURL(url=>url.pathname===new URL(base+'/index.html').pathname&&url.hash==='#registered-footage');
  await page.goBack();await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');assert.equal(await page.locator('#replay-time').inputValue(),'130');
  const returned=await sceneFrame(page,{camera:'synthetic-oblique'});if(oblique)assert.equal(returned.hash,oblique.hash);
  if(returned){
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#replay-play').click();
    await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>130);await page.locator('#replay-play').click();await paused(page,false);
    await page.locator('#replay-play').click();await page.emulateMedia({reducedMotion:'reduce'});await paused(page,false);
  }
  await page.locator('#replay-time').fill('145');assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.match(await page.locator('#replay-appearance-state').textContent(),/Outside/);
  const recovered=await sceneFrame(page,{trigger:'[data-ground-second="130"]',event:'click',camera:'synthetic-oblique',fromGap:true,action:()=>stage.click()});
  if(oblique)assert.equal(recovered.hash,oblique.hash);
});

test('literal form-5 and reference-v1 stay native while invalid new selections refuse partial restoration',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  await readyStudy(page,form6);const stormForm=await sceneFrame(page,{study:true});
  await readyStudy(page,form5);
  assert.equal(await page.locator('#sequence-coverage').inputValue(),'reference');
  assert.match(await page.locator('#quality option[value="7200"]').textContent(),/7,200 particles/);
  const earlierForm=await sceneFrame(page,{study:true,style:'reference-v1'});
  if(stormForm){sameScenario(earlierForm,stormForm);assert.notEqual(earlierForm.hash,stormForm.hash);}
  await page.reload();await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('experiment'),'form-5');
  const earlierReloaded=await sceneFrame(page,{study:true,style:'reference-v1'});if(earlierForm)assert.equal(earlierReloaded.hash,earlierForm.hash);
  await readyReplay(page);const stormReplay=await sceneFrame(page);
  await readyReplay(page,referenceReplay);const earlierReplay=await sceneFrame(page,{style:'reference-v1'});
  if(stormReplay){sameScenario(earlierReplay,stormReplay);assert.notEqual(earlierReplay.hash,stormReplay.hash);}
  const changed=form6.replace('azimuth=25','azimuth=40');
  for(const url of [changed.replace('storm-v1','storm-v3'),changed.replace('storm-v1','storm-v2'),changed+'&presentation=storm-v1',changed.replace('&presentation=storm-v1',''),changed.replace('form-6','form-5')]){
    await readyStudy(page,url);assert.equal(await page.locator('#lab-state').getAttribute('data-state'),'invalid');
    assert.match(await page.locator('#lab-state').textContent(),/No values from the link were applied/);
    assert.equal(await page.locator('#azimuth').inputValue(),'25');assert.equal(await page.locator('#sequence-time').inputValue(),'0');
    assert.equal(await page.locator('#scene').getAttribute('data-lighting-style'),'storm-v3');assert.equal(await page.locator('#motion').textContent(),'Play motion');
  }
  for(const style of ['storm-v4','storm-v1&appearance_style=storm-v1','']){
    await readyReplay(page,replay.replace('appearance_style=storm-v1','appearance_style='+style));
    assert.match(await page.locator('#ground-time').textContent(),/requested lighting presentation is unavailable.*No appearance has been substituted/);
    assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
    assert.equal(await page.locator('#replay-appearance-canvas').getAttribute('data-evidence-state'),'unavailable');
  }
  await page.locator('#replay-appearance-mode').selectOption('simulation');
  await page.locator('#replay-appearance-mode').selectOption('formation');
  assert.equal(new URL(page.url()).searchParams.get('appearance_style'),'storm-v3');await sceneFrame(page,{style:'storm-v3'});
});
