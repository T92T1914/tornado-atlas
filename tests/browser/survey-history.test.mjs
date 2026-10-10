import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';
import {beginSurveyActivation,finishSurveyActivation} from './survey-activation-diagnostics.mjs';
import {waitForSettledTouchTarget} from './touch-target-readiness.mjs';

const data=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url)));
const fatality=data.history.remembrance.places[0];

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`survey choices restore through URL, history and reload at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    await page.goto(base+'/survey.html?survey=270271&surveyPhotos=0');
    await page.locator('#survey-observation').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    const state=()=>page.evaluate(()=>({url:location.href,length:history.length}));
    const starting=await state();
    await page.locator('#survey-next').click();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    assert.equal(new URL(page.url()).searchParams.get('survey'),'270275');
    assert.equal((await state()).length,starting.length+1);
    await page.goBack();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
    await page.goForward();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');

    await page.locator('#survey-order').selectOption('path');
    await page.locator('#survey-rating').selectOption('EF2');
    const beforeSearch=await state();
    const search=page.locator('#survey-search');
    await search.fill('R');await search.fill('Re');await search.fill('Residences');
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('surveySearch')==='Residences'&&document.querySelector('#survey-search').value==='Residences');
    const searched=new URL(page.url());
    assert.equal(searched.searchParams.get('surveyOrder'),'path');
    assert.equal(searched.searchParams.get('surveyRating'),'EF2');
    assert.equal(searched.searchParams.get('surveySearch'),'Residences');
    assert.equal((await state()).length,beforeSearch.length+1,'One search edit sequence adds one history entry');
    const searchedId=await page.locator('#survey-observation').inputValue();
    assert.equal(searched.searchParams.get('survey'),searchedId);
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-search').inputValue(),'Residences');
    assert.equal(await page.locator('#survey-rating').inputValue(),'EF2');
    assert.equal(await page.locator('#survey-order').inputValue(),'path');
    assert.equal(await page.locator('#survey-observation').inputValue(),searchedId);
    assert.equal(await page.locator('#survey-line-selection').getAttribute('data-record'),searchedId);
    await page.goBack();
    assert.equal(await page.locator('#survey-search').inputValue(),'');
    assert.equal(await page.locator('#survey-rating').inputValue(),'EF2');
    await page.goForward();
    assert.equal(await page.locator('#survey-search').inputValue(),'Residences');

    await page.locator('#survey-search').fill('no-matching-observation');
    assert.equal(await page.locator('#survey-count').textContent(),'0 of 336 survey locations');
    assert.equal(new URL(page.url()).searchParams.has('survey'),false);
    assert.equal(await page.locator('#survey-line-selection').getAttribute('visibility'),'hidden');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-search').inputValue(),'no-matching-observation');
    assert.equal(await page.locator('#survey-line-selection').getAttribute('visibility'),'hidden');
    await page.locator('#survey-photos-only').check();
    assert.equal(new URL(page.url()).searchParams.get('surveyPhotos'),'1');
    await page.goBack();
    assert.equal(await page.locator('#survey-photos-only').isChecked(),false);
    await page.goForward();
    assert.equal(await page.locator('#survey-photos-only').isChecked(),true);
    await page.locator('#survey-observation').selectOption('fatality:'+fatality.id);
    assert.equal(new URL(page.url()).searchParams.get('fatality'),fatality.id);
    assert.equal(new URL(page.url()).searchParams.has('survey'),false);
    const alternate=new URL(await page.locator('#survey-alternate').getAttribute('href'));
    assert.equal(alternate.searchParams.get('fatality'),fatality.id);
    assert.equal(alternate.searchParams.get('surveyRating'),'EF2');
    assert.equal(alternate.searchParams.get('surveySearch'),'no-matching-observation');
    assert.equal(alternate.searchParams.get('surveyPhotos'),'1');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-observation').inputValue(),'fatality:'+fatality.id);
    assert.equal(await page.locator('#survey-search').inputValue(),'no-matching-observation');
    assert.equal(await page.locator('#survey-photos-only').isChecked(),true);
    await page.goBack();
    assert.equal(await page.locator('#survey-line-selection').getAttribute('visibility'),'hidden');
    assert.equal(new URL(page.url()).searchParams.has('fatality'),false);
    await page.goForward();
    assert.equal(await page.locator('#survey-observation').inputValue(),'fatality:'+fatality.id);
    await page.locator('#survey-reset').click();
    const reset=new URL(page.url());
    assert.equal(reset.searchParams.get('fatality'),fatality.id);
    assert.equal(reset.searchParams.get('surveySearch'),null);
    assert.equal(reset.searchParams.get('surveyRating'),null);
    assert.equal(reset.searchParams.get('surveyOrder'),null);
    assert.equal(reset.searchParams.get('surveyPhotos'),'1');
    await page.goBack();
    assert.equal(await page.locator('#survey-search').inputValue(),'no-matching-observation');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
}

test('full report survey history keeps replay time and footage source',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/index.html?t=780&footage_source=robinson-dashcam&survey=270271&surveyPhotos=0#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
  const next=page.locator('#survey-next');
  await next.scrollIntoViewIfNeeded();
  await waitForSettledTouchTarget(page,next);
  await beginSurveyActivation(page);
  await next.click();
  const immediateProtocolUrl=page.url();
  await finishSurveyActivation(t,page,'ordinary full report survey selection');
  t.diagnostic('SURVEY_ORDINARY_PROTOCOL '+JSON.stringify({immediateProtocolUrl}));
  await page.waitForFunction(()=>document.getElementById('survey-observation').value==='270275'&&
    document.getElementById('timeline').value==='780'&&
    new URL(location.href).searchParams.get('survey')==='270275');
  await page.waitForURL(url=>url.searchParams.get('survey')==='270275'&&
    url.searchParams.get('t')==='780'&&url.searchParams.get('footage_source')==='robinson-dashcam');
  const selected=new URL(page.url());
  assert.equal(selected.searchParams.get('survey'),'270275');
  assert.equal(selected.searchParams.get('t'),'780');
  assert.equal(selected.searchParams.get('footage_source'),'robinson-dashcam');
  await page.goBack();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(await page.locator('#timeline').inputValue(),'780');
  await page.goForward();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
  assert.equal(new URL(page.url()).searchParams.get('footage_source'),'robinson-dashcam');
});

test('survey choice during playback stores the current replay time before pausing',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/index.html?t=780&footage_source=robinson-dashcam&survey=270271&surveyPhotos=0#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  const readReplaySurvey=()=>page.evaluate(()=>{
    const element=id=>document.getElementById(id);
    return {url:location.href,timeline:element('timeline')?.value??null,
      selection:element('survey-observation')?.value??null,
      footageSource:element('footage-source')?.value??null,
      play:element('play')?.textContent??null,
      share:element('survey-share')?.href??null,
      fatalityShare:element('fatality-share')?.href??null,
      alternate:element('survey-alternate')?.href??null,
      ready:document.body.dataset.exhibitReady??null,visibility:document.visibilityState};
  });
  const initial=await readReplaySurvey();
  await page.locator('#play').click();
  await page.waitForFunction(()=>Number(document.getElementById('timeline').value)>780);
  const beforeSelection=await readReplaySurvey();
  const next=page.locator('#survey-next');
  await next.scrollIntoViewIfNeeded();
  await waitForSettledTouchTarget(page,next);
  await beginSurveyActivation(page);
  await next.click();
  const protocolUrlAfterClick=page.url(),completed=await readReplaySurvey();
  await finishSurveyActivation(t,page,'article survey selection during playback');
  t.diagnostic('SURVEY_REPLAY_SELECTION '+JSON.stringify({initial,beforeSelection,
    protocolUrlAfterClick,protocolUrlAfterSnapshot:page.url(),completed}));
  assert.equal(completed.selection,'270275','The intended survey selection completed');
  const selected=new URL(completed.url),savedTime=Number(selected.searchParams.get('t'));
  assert.ok(savedTime>780);
  assert.equal(Math.floor(savedTime),Number(completed.timeline));
  assert.equal(selected.searchParams.get('survey'),'270275');
  assert.equal(selected.searchParams.get('footage_source'),'robinson-dashcam');
  assert.equal(completed.footageSource,'robinson-dashcam');
  assert.equal(completed.play,'Play timeline');
  const share=new URL(completed.share);
  assert.equal(Number(share.searchParams.get('t')),savedTime);
  assert.equal(share.searchParams.get('survey'),'270275');
  assert.equal(share.searchParams.get('footage_source'),'robinson-dashcam');
  assert.equal(new URL(completed.alternate).searchParams.get('survey'),'270275');
  await page.reload();
  await page.locator('#survey-observation').waitFor();
  assert.equal(Math.floor(savedTime),Number(await page.locator('#timeline').inputValue()));
  assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
  await page.goBack();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(Math.floor(savedTime),Number(await page.locator('#timeline').inputValue()));
  await page.goForward();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
  assert.equal(Math.floor(savedTime),Number(await page.locator('#timeline').inputValue()));
  await page.locator('#play').click();
  await page.waitForFunction(time=>Number(document.getElementById('timeline').value)>Math.floor(time),savedTime);
  await page.locator('#survey-observation').selectOption('fatality:'+fatality.id);
  const protocolFatalityUrlAfterSelection=page.url(),completedFatality=await readReplaySurvey();
  t.diagnostic('SURVEY_REPLAY_FATALITY '+JSON.stringify({savedTime,
    protocolFatalityUrlAfterSelection,protocolUrlAfterSnapshot:page.url(),completed:completedFatality}));
  assert.equal(completedFatality.selection,'fatality:'+fatality.id);
  const fatalityUrl=new URL(completedFatality.url),fatalityTime=Number(fatalityUrl.searchParams.get('t'));
  assert.ok(fatalityTime>savedTime);
  assert.equal(Math.floor(fatalityTime),Number(completedFatality.timeline));
  assert.equal(fatalityUrl.searchParams.get('fatality'),fatality.id);
  assert.equal(fatalityUrl.searchParams.has('survey'),false);
  assert.equal(fatalityUrl.searchParams.get('footage_source'),'robinson-dashcam');
  assert.equal(completedFatality.footageSource,'robinson-dashcam');
  assert.equal(completedFatality.play,'Play timeline');
  const fatalityShare=new URL(completedFatality.fatalityShare);
  assert.equal(Number(fatalityShare.searchParams.get('t')),fatalityTime);
  assert.equal(fatalityShare.searchParams.get('fatality'),fatality.id);
  assert.equal(new URL(completedFatality.alternate).searchParams.get('fatality'),fatality.id);
});

test('filtering during replay playback refreshes the current observation share time',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/index.html?t=780&survey=270271&surveyPhotos=0#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  await page.locator('#play').click();
  await page.waitForFunction(()=>Number(document.getElementById('timeline').value)>780);
  await page.locator('#survey-rating').selectOption('EF2');
  const saved=new URL(page.url()),time=Number(saved.searchParams.get('t'));
  assert.ok(time>780);
  assert.equal(saved.searchParams.get('surveyRating'),'EF2');
  assert.equal(await page.locator('#play').textContent(),'Play timeline');
  const share=new URL(await page.locator('#survey-share').getAttribute('href'));
  assert.equal(Number(share.searchParams.get('t')),time);
  assert.equal(share.searchParams.get('survey'),saved.searchParams.get('survey'));
  assert.equal(share.searchParams.get('surveyRating'),'EF2');
});

const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNwaDjwHwAFBAKAPJ4DgAAAAABJRU5ErkJggg==','base64');
async function syntheticSurveyImage(page) {
  // The source image is replaced only inside this isolated browser fixture.
  await page.route('https://services.dat.noaa.gov/**',route=>route.fulfill({status:200,contentType:'image/png',body:tinyPng}));
}

test('survey Back closes a photo before replacing its opener and focuses a connected control',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await syntheticSurveyImage(page);
  await page.goto(base+'/survey.html?survey=270271&surveyPhotos=1');
  await page.locator('#survey-observation').waitFor();
  await page.waitForFunction(()=>{
    const image=document.querySelector('#survey-detail .survey-photo-open img');
    return image?.complete&&image.naturalWidth===1&&image.getBoundingClientRect().height>0;
  });
  const initialHistory=await page.evaluate(()=>history.length);
  const transitionBefore=await page.evaluate(()=>{
    window.__surveyTransitionEvents=[];
    for(const type of ['pointerdown','mousedown','mouseup','click'])document.addEventListener(type,event=>{
      if(window.__surveyTransitionEvents.length<16)window.__surveyTransitionEvents.push({type,target:event.target?.id||event.target?.tagName,x:event.clientX,y:event.clientY});
    },{capture:true,passive:true});
    const button=document.getElementById('survey-next'),rect=button.getBoundingClientRect();
    return {url:location.href,selected:document.getElementById('survey-observation').value,nextDisabled:button.disabled,button:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
  });
  await page.locator('#survey-next').click();
  try{
    await page.waitForFunction(()=>document.getElementById('survey-observation')?.value==='270275');
  }catch(error){
    try{
      console.error('SURVEY_NEXT_DIAGNOSTIC '+JSON.stringify({before:transitionBefore,after:await page.evaluate(()=>{
        const button=document.getElementById('survey-next'),rect=button?.getBoundingClientRect();
        return {url:location.href,ready:document.readyState,selection:document.getElementById('survey-observation')?.value,nextDisabled:button?.disabled,
          button:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,events:window.__surveyTransitionEvents,
          focus:document.activeElement?.id,history:history.length,scrollY};
      })}));
    }finally{throw error;}
  }
  assert.equal(new URL(page.url()).searchParams.get('survey'),'270275');
  assert.equal(await page.evaluate(()=>history.length),initialHistory+1);
  const opener=page.locator('#survey-detail .survey-photo-open').first();
  await opener.click();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  await page.waitForFunction(()=>{
    const image=document.getElementById('photo-full');
    return image?.complete&&image.naturalWidth===1&&!image.hidden&&image.getBoundingClientRect().height>0;
  });
  const oldOpener=await opener.elementHandle();
  await page.goBack();
  try{
    await page.waitForFunction(()=>{const dialog=document.getElementById('photo-dialog');return dialog&&!dialog.open;});
  }catch(error){
    try{
      console.error('SURVEY_BACK_DIAGNOSTIC '+JSON.stringify(await page.evaluate(()=>({url:location.href,
        ready:document.readyState,history:history.length,selection:document.getElementById('survey-observation')?.value,
        dialogPresent:!!document.getElementById('photo-dialog'),dialogOpen:document.getElementById('photo-dialog')?.open,
        focus:document.activeElement?.outerHTML.slice(0,500)}))));
    }finally{throw error;}
  }
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(await oldOpener.evaluate(node=>node.isConnected),false);
  await page.waitForFunction(()=>document.activeElement===document.getElementById('survey-observation'));
});

test('replay Back keeps an unchanged survey photo opener connected',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await syntheticSurveyImage(page);
  await page.goto(base+'/index.html?t=780&survey=270271&surveyPhotos=1#survey-explorer');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#timeline:not([disabled])').waitFor();
  await page.locator('#next').click();
  const nextTime=new URL(page.url()).searchParams.get('t');
  assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),nextTime);
  const opener=page.locator('#survey-detail .survey-photo-open').first();
  const oldOpener=await opener.elementHandle();
  await opener.click();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  await page.goBack();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  assert.equal(await oldOpener.evaluate(node=>node.isConnected),true);
  assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),'780');
  await page.goForward();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  assert.equal(await oldOpener.evaluate(node=>node.isConnected),true);
  assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),nextTime);
  await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await page.evaluate(()=>document.activeElement?.isConnected),true);
});
