import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,base} from './harness.mjs';

async function paintedSurveyDifference(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('#replay-scene').evaluate(canvas=>{
    window.markedSurveyPixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  });
  await page.locator('#survey-search').fill('no-matching-observation');
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='');
  return page.locator('#replay-scene').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let count=0,left=canvas.width,right=-1,top=canvas.height,bottom=-1;
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i]===window.markedSurveyPixels[i]&&pixels[i+1]===window.markedSurveyPixels[i+1]&&pixels[i+2]===window.markedSurveyPixels[i+2])continue;
      const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);
      count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    delete window.markedSurveyPixels;
    return {count,left,right,top,bottom};
  });
}

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`the selected survey marker is painted and geographically fixed at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/reconstruction.html?t=783&survey=270271&surveyPhotos=0');
    await page.locator('#survey-observation').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='270271');
    assert.equal(await page.locator('#replay-scene').getAttribute('data-survey-visible'),'false');
    assert.equal(await page.locator('#replay-damage-offscreen').isVisible(),true);
    await page.locator('#replay-reset').click();
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyVisible==='true');
    assert.equal(await page.locator('#replay-damage-offscreen').isVisible(),false);
    assert.equal(await page.locator('#replay-time').inputValue(),'783');
    assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
    const first=await paintedSurveyDifference(page);
    assert.ok(first.count>20,'Removing the selection must remove visible painted pixels');
    assert.ok(first.right-first.left<250&&first.bottom-first.top<30,'The change must be the bounded marker/label region');
    await page.locator('#survey-search').fill('');
    await page.locator('#survey-observation').selectOption('270271');
    await page.locator('#replay-time').fill('900');
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='270271'&&document.querySelector('#replay-scene').dataset.surveyVisible==='true');
    const later=await paintedSurveyDifference(page);
    assert.ok(later.count>20);
    for(const edge of ['left','right','top','bottom'])assert.ok(Math.abs(first[edge]-later[edge])<=1,'The surveyed marker stays fixed while the historical center changes');
    assert.equal(await page.locator('#replay-time').inputValue(),'900');
  });
}

const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNwaDjwHwAFBAKAPJ4DgAAAAABJRU5ErkJggg==','base64');
async function syntheticSurveyImage(page){
  // This image replaces the provider response only in the isolated fixture.
  await page.route('https://services.dat.noaa.gov/**',route=>route.fulfill({status:200,contentType:'image/png',body:tinyPng}));
}
async function loadedSyntheticPhoto(page){
  await page.waitForFunction(()=>{
    const image=document.getElementById('photo-full'),rect=image.getBoundingClientRect();
    return !image.hidden&&image.complete&&image.naturalWidth===1&&image.naturalHeight===1&&rect.width>0&&rect.height>0;
  });
}

test('player survey history closes an obsolete synthetic photo and restores connected focus',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  await syntheticSurveyImage(page);
  await page.goto(base+'/reconstruction.html?t=780&survey=270271&surveyPhotos=1');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#survey-next').click();
  const opener=page.locator('#survey-detail .survey-photo-open').first(),old=await opener.elementHandle();
  await opener.click();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  await loadedSyntheticPhoto(page);
  await page.goBack();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(await old.evaluate(node=>node.isConnected),false);
  await page.waitForFunction(()=>document.activeElement===document.getElementById('survey-observation'));
  assert.equal(await page.locator('#replay-time').inputValue(),'780');
});

test('player clock history preserves an unchanged synthetic photo opener',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  await syntheticSurveyImage(page);
  await page.goto(base+'/reconstruction.html?t=780&survey=270271&surveyPhotos=1');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#replay-chapter-next').click();
  const nextTime=new URL(page.url()).searchParams.get('t');
  const opener=page.locator('#survey-detail .survey-photo-open').first(),old=await opener.elementHandle();
  await opener.click();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  await loadedSyntheticPhoto(page);
  await page.goBack();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  assert.equal(await old.evaluate(node=>node.isConnected),true);
  assert.equal(await page.locator('#replay-time').inputValue(),'780');
  await page.goForward();
  assert.equal(await page.locator('#photo-dialog').evaluate(dialog=>dialog.open),true);
  assert.equal(await old.evaluate(node=>node.isConnected),true);
  assert.equal(await page.locator('#replay-time').inputValue(),nextTime);
  await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
  assert.equal(await old.evaluate(node=>document.activeElement===node),true);
});


const data=JSON.parse(readFileSync(new URL('../../web/data.json',import.meta.url)));
const params=page=>new URL(page.url()).searchParams;

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`selected surveyed outcome stays with the replay clock at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/reconstruction.html?event=el-reno-2013&t=783&footage_source=robinson-dashcam&survey=270271&surveyPhotos=0#survey-explorer');
    await page.locator('#survey-observation').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('#replay-damage').getAttribute('open'),'');
    assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='270271');
    assert.match(await page.locator('#replay-damage-status').textContent(),/270271.*no assigned impact time/);
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Checked original frame/);
    const source=data.survey.points.find(point=>point.id===270271).source_url;
    assert.equal(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'),source);
    await page.locator('#survey-next').click();
    assert.equal(params(page).get('survey'),'270275');
    assert.equal(params(page).get('t'),'783');
    assert.equal(params(page).get('footage_source'),'robinson-dashcam');
    assert.equal(new URL(await page.locator('#replay-link').getAttribute('href')).searchParams.get('survey'),'270275');
    await page.locator('#replay-time').fill('782');
    assert.match(await page.locator('#replay-appearance-state').textContent(),/Appearance unknown/);
    assert.equal(new URL(await page.locator('#survey-share').getAttribute('href')).searchParams.get('t'),'782');
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='270275');
    await page.goBack();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
    assert.equal(await page.locator('#replay-time').inputValue(),'783');
    await page.goForward();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    assert.equal(await page.locator('#replay-time').inputValue(),'782');
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-observation').inputValue(),'270275');
    assert.equal(await page.locator('#replay-time').inputValue(),'782');
    await page.locator('#survey-search').fill('no-matching-observation');
    assert.equal(await page.locator('#survey-count').textContent(),'0 of 336 survey locations');
    await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='');
    assert.equal(await page.locator('#replay-damage-status').isVisible(),false);
    await page.reload();
    await page.locator('#survey-observation').waitFor();
    assert.equal(await page.locator('#survey-count').textContent(),'0 of 336 survey locations');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('#registered-footage iframe').count(),0);
  });
}

test('opening damage is lazy and a survey choice captures the running replay',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.goto(base+'/reconstruction.html?t=780&footage_source=robinson-dashcam');
  await page.locator('#replay-time:not([disabled])').waitFor();
  assert.equal(await page.locator('#survey-observation').count(),0);
  await page.locator('#replay-damage summary').focus();
  await page.keyboard.press('Enter');
  await page.locator('#survey-observation').waitFor();
  await page.locator('#survey-photos-only').uncheck();
  await page.locator('#survey-observation').selectOption('270271');
  await page.locator('#replay-play').click();
  await page.waitForFunction(()=>Number(document.querySelector('#replay-time').value)>785);
  await page.locator('#survey-next').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
  assert.ok(Number(params(page).get('t'))>785);
  assert.equal(Number(await page.locator('#replay-time').inputValue()),Math.round(Number(params(page).get('t'))),'The one-second slider rounds the retained fractional clock consistently');
  assert.equal(params(page).get('survey'),'270275');
  assert.equal(params(page).get('footage_source'),'robinson-dashcam');
  const pausedSecond=await page.locator('#replay-time').inputValue();
  await page.goBack();
  assert.equal(await page.locator('#survey-observation').inputValue(),'270271');
  assert.equal(await page.locator('#replay-time').inputValue(),pausedSecond);
});

test('unavailable survey photograph and fatality selection retain their distinct sources and clock',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  const point=data.survey.points.find(row=>data.survey_media.photos[String(row.id)]?.length);
  await page.goto(base+`/reconstruction.html?t=900&survey=${point.id}&surveyPhotos=0`);
  await page.locator('#survey-observation').waitFor();
  await page.locator('.survey-photo-open:disabled').first().waitFor();
  assert.match(await page.locator('.survey-photo-open:disabled').first().textContent(),/Photograph unavailable from the source/);
  assert.equal(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'),point.source_url);
  assert.equal(await page.locator('#replay-time').inputValue(),'900');
  const fatality=data.history.remembrance.places[0];
  await page.locator('#survey-observation').selectOption('fatality:'+fatality.id);
  assert.equal(params(page).get('fatality'),fatality.id);
  assert.equal(params(page).get('t'),'900');
  await page.waitForFunction(()=>document.querySelector('#replay-scene').dataset.surveyRecord==='');
  assert.equal(await page.locator('#replay-damage-status').isVisible(),false);
  await page.reload();
  await page.locator('#survey-observation').waitFor();
  assert.equal(await page.locator('#survey-observation').inputValue(),'fatality:'+fatality.id);
  assert.equal(await page.locator('#replay-time').inputValue(),'900');
});

test('an unavailable survey target retains the clock and explains the replacement at enlarged text',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  await page.goto(base+'/reconstruction.html?t=783&survey=999999&surveyPhotos=0');
  await page.locator('#survey-observation').waitFor();
  const control=page.locator('#survey-observation');
  const originalControlFont=await control.evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  const originalOptions=await control.evaluate(node=>[...node.options].map(option=>[option.value,option.textContent]));
  await page.addStyleTag({content:'html {font-size:200%}'});
  assert.match(await page.locator('#survey-link-status').textContent(),/999999 is unavailable/);
  assert.equal(await page.locator('#replay-time').inputValue(),'783');
  assert.match(await page.locator('#replay-damage-status').textContent(),/no assigned impact time/);
  const selected=Number(await page.locator('#survey-observation').inputValue());
  assert.equal(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'),data.survey.points.find(point=>point.id===selected).source_url);
  await page.locator('#survey-order').selectOption('path');
  assert.match(await page.locator('#survey-line-context').textContent(),/does not establish when damage occurred/);
  assert.equal(params(page).get('t'),'783');
  const controlLayout=await control.evaluate(node=>({font:getComputedStyle(node).fontSize,
    labelFont:getComputedStyle(node.parentElement).fontSize,options:[...node.options].map(option=>[option.value,option.textContent]),
    value:node.value,selectedText:node.selectedOptions[0].textContent,
    client:node.clientWidth,scroll:node.scrollWidth,labelClient:node.parentElement.clientWidth,
    labelScroll:node.parentElement.scrollWidth,labelOverflow:getComputedStyle(node.parentElement).overflowX,
    caption:(()=>{const range=document.createRange();range.selectNodeContents(node.parentElement.firstChild);
      return [...range.getClientRects()].map(rect=>({left:rect.left,right:rect.right}));})(),
    labelBounds:(()=>{const rect=node.parentElement.getBoundingClientRect();return {left:rect.left,right:rect.right};})()}));
  assert.ok(parseFloat(controlLayout.font)>=originalControlFont,'The bounded select does not shrink its resolved text size');
  const byValue=(left,right)=>left[0].localeCompare(right[0]);
  assert.deepEqual(controlLayout.options.sort(byValue),originalOptions.sort(byValue));
  assert.equal(controlLayout.value,String(selected));
  assert.ok(controlLayout.selectedText.includes(String(selected)));
  // WebKit includes native-menu text in scrollWidth. Keep that extent inside this label.
  assert.equal(controlLayout.labelOverflow,'hidden');
  assert.ok(controlLayout.caption.length>0);
  assert.ok(controlLayout.caption.every(rect=>rect.left>=controlLayout.labelBounds.left && rect.right<=controlLayout.labelBounds.right),JSON.stringify(controlLayout));
  await control.focus();
  const focusLayout=await control.evaluate(node=>{
    const style=getComputedStyle(node),rect=node.getBoundingClientRect(),label=node.parentElement.getBoundingClientRect();
    const extent=parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset);
    return {focused:document.activeElement===node,visible:node.matches(':focus-visible'),outline:style.outlineStyle,
      width:parseFloat(style.outlineWidth),extent,contained:rect.left-extent>=label.left-1 && rect.right+extent<=label.right+1 &&
        rect.top-extent>=label.top-1 && rect.bottom+extent<=label.bottom+1};
  });
  assert.ok(focusLayout.focused&&focusLayout.visible&&focusLayout.outline!=='none'&&focusLayout.width>=2&&focusLayout.contained,JSON.stringify(focusLayout));
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
    overflow:[...document.querySelectorAll('body *')].filter(e=>{
      const r=e.getBoundingClientRect();return r.right>innerWidth+1 &&
        !e.closest('.survey-photo-strip,.timeline-table-wrap');
    }).map(e=>({tag:e.tagName,id:e.id,class:String(e.className),right:e.getBoundingClientRect().right}))}));
  if(layout.scroll>layout.width+1)layout.diagnostics=await page.evaluate(()=>{
    const describe=node=>({tag:node.tagName,id:node.id,class:String(node.className),
      right:node.getBoundingClientRect().right,client:node.clientWidth,scroll:node.scrollWidth,
      overflow:getComputedStyle(node).overflowX,display:getComputedStyle(node).display});
    const candidates=[...document.querySelectorAll('body>*,main>*,#replay-content>*,#survey-explorer>*,#registered-footage>*')];
    const isolation=candidates.map(node=>{
      const before=node.getAttribute('style');node.style.setProperty('display','none','important');
      const width=document.documentElement.scrollWidth;
      if(before===null)node.removeAttribute('style');else node.setAttribute('style',before);
      return {...describe(node),documentWhenRemoved:width};
    });
    return {document:describe(document.documentElement),body:describe(document.body),
      scrollers:[...document.querySelectorAll('body *')].filter(node=>node.scrollWidth>node.clientWidth+1).map(describe).slice(0,40),isolation};
  });
  assert.ok(layout.scroll<=layout.width+1,JSON.stringify(layout));
  const registration=page.locator('#registered-footage details'),table=registration.locator('.footage-table');
  assert.equal(await registration.evaluate(node=>node.open),false);
  assert.equal(await table.isVisible(),false);
  await registration.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await registration.evaluate(node=>node.open),true);
  assert.equal(await table.isVisible(),true);
  assert.equal(await table.locator('tbody tr').count(),7);
  const openLayout=await table.evaluate(node=>({width:innerWidth,document:document.documentElement.scrollWidth,
    right:node.getBoundingClientRect().right,client:node.clientWidth,scroll:node.scrollWidth}));
  assert.ok(openLayout.document<=openLayout.width+1,JSON.stringify(openLayout));
  assert.ok(openLayout.right<=openLayout.width+1,JSON.stringify(openLayout));
  if(openLayout.scroll>openLayout.client){
    await table.focus();await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('#registered-footage .footage-table').scrollLeft>0);
  }
  await registration.locator('summary').focus();await page.keyboard.press('Enter');
  assert.equal(await table.isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('a browser without the geographic canvas keeps the documentary and survey source route',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844}});
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='2d'?null:original.call(this,type,...args);};
  });
  await page.goto(base+'/reconstruction.html?t=783&survey=270271');
  await page.locator('#replay-error:not([hidden])').waitFor();
  assert.match(await page.locator('#replay-error').textContent(),/source map and historical account remain available/);
  assert.equal(await page.locator('#replay-content').isVisible(),false);
  assert.equal(await page.locator('#replay-documentary').getAttribute('href'),'index.html');
  assert.equal(await page.locator('#survey-observation').count(),0);
  await page.locator('#replay-documentary').click();
  await page.locator('#survey-observation').waitFor();
  assert.ok(await page.locator('#survey-detail a').filter({hasText:'Open this NWS record'}).getAttribute('href'));
});
