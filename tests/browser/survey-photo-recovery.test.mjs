import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url)));
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNwaDjwHwAFBAKAPJ4DgAAAAABJRU5ErkJggg==','base64');
const surfaces=[
  {name:'survey',path:'/survey.html?survey=165486&surveyPhotos=1',record:165486,selection:'165486'},
  {name:'replay',path:'/reconstruction.html?t=780&footage_source=robinson-dashcam&survey=165486&surveyPhotos=1',record:165486,selection:'165486'},
  {name:'article',path:'/index.html?t=780&footage_source=robinson-dashcam&survey=165486&surveyPhotos=1#survey-explorer',record:165486,selection:'165486'},
  {name:'nearby fatality',path:'/survey.html?fatality=twistex-recovery',record:165661,selection:'fatality:twistex-recovery'},
];

for(const [width,appearance] of [[320,'dark'],[1280,'light']])for(const surface of surfaces){
  test(`failed survey preview opens the existing viewer and recovers: ${surface.name} ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
    const point=data.survey.points.find(point=>point.id===surface.record);
    const asset=data.survey_media.photos[String(surface.record)][0].url;
    let attempts=0,allowSuccess=false;
    // Synthetic provider responses qualify recovery, not NOAA availability or pixels.
    await page.route(asset,route=>{
      attempts++;
      return route.fulfill(allowSuccess?{status:200,contentType:'image/png',body:tinyPng}:
        {status:503,contentType:'text/plain',body:'Controlled photograph refusal'});
    });
    await page.goto(base+surface.path);
    await page.locator('#survey-observation').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    if(surface.name==='article')await page.waitForFunction(()=>document.body.dataset.exhibitReady==='true');
    const opener=page.locator('#survey-detail .survey-photo-open').first();
    await opener.locator('span').waitFor();
    assert.equal(await opener.isEnabled(),true,'A failed preview must retain its viewer entry');
    assert.match(await opener.textContent(),/Preview unavailable/);
    assert.match(await opener.getAttribute('aria-label'),new RegExp(`photograph 1 and source details for survey record ${surface.record}`));
    const initialUrl=page.url(),initialHistory=await page.evaluate(()=>history.length);
    const initialAttempts=attempts;
    assert.equal(initialAttempts,1,'A failed preview does not retry automatically');
    await opener.focus();
    await page.keyboard.press('Enter');
    await page.locator('#photo-retry').waitFor({state:'visible'});
    assert.equal(attempts,initialAttempts+1,'Opening explicitly requests the same attachment');
    assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
    assert.equal(await page.locator('#photo-title').textContent(),`${point.rating} · NWS survey ${point.id}`);
    assert.equal(await page.locator('#photo-source').getAttribute('href'),point.source_url);
    assert.equal(await page.locator('#photo-original').getAttribute('href'),asset);
    assert.equal(await page.locator('#photo-credit').textContent(),data.survey_media.source.credit);
    assert.match(await page.locator('#photo-caption').textContent(),/not a new rating from the photograph/);
    assert.match(await page.locator('#photo-location').textContent(),/camera's position and capture time are not supplied/);
    if(surface.name==='nearby fatality')assert.match(await page.locator('#photo-caption').textContent(),/not a confirmed photograph of the named fatality record/);
    allowSuccess=true;
    await page.locator('#photo-retry').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>{const image=document.getElementById('photo-full');return image?.complete&&image.naturalWidth===1&&!image.hidden;});
    assert.equal(attempts,initialAttempts+2,'Only explicit Retry issues the next request');
    assert.equal(await page.locator('#photo-full').getAttribute('src'),asset);
    assert.equal(await page.locator('#photo-full').isVisible(),true);
    assert.equal(await page.locator('#photo-retry').isVisible(),false);
    assert.equal(await page.locator('#photo-source').getAttribute('href'),point.source_url);
    await page.locator('#photo-close').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
    assert.equal(await opener.evaluate(button=>document.activeElement===button&&button.isConnected),true);
    assert.equal(await page.locator('#survey-observation').inputValue(),surface.selection);
    assert.equal(page.url(),initialUrl);
    assert.equal(await page.evaluate(()=>history.length),initialHistory);
    if(surface.name==='replay')assert.equal(await page.locator('#replay-time').inputValue(),'780');
    if(surface.name==='article'){
      assert.equal(await page.locator('#timeline').inputValue(),'780');
      assert.equal(new URL(page.url()).searchParams.get('footage_source'),'robinson-dashcam');
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  });
}
