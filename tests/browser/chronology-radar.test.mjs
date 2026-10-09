import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const data=JSON.parse(await readFile(new URL('../../exhibits/joplin-2011/chronology.json',import.meta.url),'utf8'));
const reference=data.radar_context.reference;
const png='assets/joplin-2011/nist-radar-sequence.png';

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`Joplin printed radar labels share documentary seeking and the complete figure ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
    await page.goto(base+'/reconstruction.html?event=joplin-2011');
    const picker=page.locator('#chronology-radar-snapshot');await picker.waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.match(await page.locator('#chronology-radar-selected').textContent(),/No earlier radar snapshot/);
    assert.equal(await picker.locator('option').count(),7);
    assert.equal(await picker.locator('option[value="radar-2253"]').count(),0);
    assert.match(await page.locator('#chronology-radar').textContent(),/Outside this chronology: 2253 UTC/);
    await picker.selectOption('radar-2239');
    assert.equal(new URL(page.url()).searchParams.get('t'),'14940');
    const documentary=await page.locator('.chronology-record h3').textContent();
    await page.locator('#chronology-time').focus();await page.keyboard.press('ArrowRight');
    assert.equal(new URL(page.url()).searchParams.get('t'),'15000');
    assert.match(await page.locator('#chronology-radar-age').textContent(),/1 min 0 s/);
    assert.match(await page.locator('#chronology-radar-selected').textContent(),/Latest earlier printed snapshot/);
    await picker.selectOption('radar-2243');
    assert.equal(await page.locator('.chronology-record h3').textContent(),documentary);
    assert.match(await page.locator('#chronology-radar-selected').textContent(),/2243 UTC/);
    await page.goBack();assert.equal(await picker.inputValue(),'radar-2239');
    assert.match(await page.locator('#chronology-radar-age').textContent(),/1 min 0 s/);
    await page.goForward();assert.equal(await picker.inputValue(),'radar-2243');
    await page.reload();await picker.waitFor();assert.equal(await picker.inputValue(),'radar-2243');
    await page.locator('#chronology-time').focus();await page.keyboard.press('End');
    assert.equal(await picker.inputValue(),'radar-2248');assert.equal(new URL(page.url()).searchParams.get('t'),'15480');
    const open=page.locator('#chronology-radar-open');await open.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>{const image=document.querySelector('#photo-full');return document.querySelector('#photo-dialog').open&&!image.hidden&&image.naturalWidth===947&&image.naturalHeight===1326;});
    assert.match(await page.locator('#photo-credit').textContent(),/National Oceanic and Atmospheric Administration/);
    assert.match(await page.locator('#photo-caption').textContent(),/not a continuous radar animation/);
    assert.match(await page.locator('#photo-license').textContent(),/Adjacent Figure 2-8/);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#photo-dialog').open);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'chronology-radar-open');
    const evidenceLink=page.getByRole('link',{name:'Read this radar account, source inspection and reuse record',exact:true});
    assert.match(await evidenceLink.getAttribute('href'),new RegExp('revision='+reference.dossier_sha256));
    assert.match(await evidenceLink.getAttribute('href'),/source=nist-joplin-radar-sequence/);
    const text=await page.locator('#chronology-radar').textContent();
    await page.evaluate(()=>{const nodes=[document.querySelector('#replay-chronology'),...document.querySelectorAll('#replay-chronology *')];const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,i)=>node.style.fontSize=`${sizes[i]*2}px`);});
    assert.equal(await page.locator('#chronology-radar').textContent(),text);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.ok((await open.boundingBox()).height>=44);assert.ok((await picker.boundingBox()).height>=44);
    if(process.env.ATLAS_RADAR_CAPTURE_DIR){await mkdir(process.env.ATLAS_RADAR_CAPTURE_DIR,{recursive:true});await page.locator('#chronology-radar').screenshot({path:path.join(process.env.ATLAS_RADAR_CAPTURE_DIR,`radar-${width}-${appearance}.png`)});}
    await evidenceLink.focus();await page.keyboard.press('Enter');
    await page.locator('#media-nist-joplin-radar-sequence').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('revision'),reference.dossier_sha256);
    assert.match(await page.locator('#content').textContent(),/not a continuous radar animation/);
    const figure=await page.request.get(base+'/'+png);
    assert.equal(createHash('sha256').update(await figure.body()).digest('hex'),'8d00dd1d87fc1607f855282337b5d1ee9b7d9f35605a5c28d691841e1b77cbd3');
  });
}

test('a changed pinned radar response leaves the actual documentary clock and recovery usable',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  await page.route('**/'+reference.file,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+' '});});
  await page.goto(base+'/reconstruction.html?event=joplin-2011&t=14940');
  await page.getByRole('button',{name:'Play chronology',exact:true}).waitFor();
  assert.equal(await page.locator('#chronology-radar-snapshot').count(),0);
  assert.equal(await page.locator('#chronology-radar img').count(),0);
  assert.match(await page.locator('#chronology-radar').textContent(),/could not be verified/);
  await page.getByRole('button',{name:'Next entry',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).searchParams.get('t'),'15480');
  const documentary=page.getByRole('link',{name:'Read the complete documentary figure and caption',exact:true});
  await documentary.focus();await page.keyboard.press('Enter');
  await page.locator('#radar').waitFor();assert.equal(new URL(page.url()).pathname,'/joplin.html');
});

test('malformed radar metadata is rejected before mounting a partial chronology',async t=>{
  const page=await fixture(t);
  await page.route('**/events/joplin-2011-chronology.json',async route=>{const response=await route.fetch();const changed=await response.json();changed.radar_context.reference.event_id='el-reno-2013';await route.fulfill({response,json:changed});});
  await page.goto(base+'/reconstruction.html?event=joplin-2011');
  await page.locator('#replay-error').waitFor();assert.equal(await page.locator('#replay-chronology').isVisible(),false);
  assert.equal(await page.locator('#chronology-radar-open').count(),0);
});

test('the reused viewer retries a failed complete figure and closes to its connected opener',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});
  let allowFigure=false,blockedFigureRequests=0;
  // Fail the figure before any successful preview can populate image caches.
  // Keep failure enabled until the modal itself exposes its retry control.
  await page.route('**/'+png,async route=>{if(!allowFigure){blockedFigureRequests++;await route.abort('failed');}else await route.continue();});
  await page.goto(base+'/reconstruction.html?event=joplin-2011&t=15180');
  const open=page.locator('#chronology-radar-open');await open.waitFor();
  await open.scrollIntoViewIfNeeded();
  await open.focus();await page.keyboard.press('Enter');
  await page.locator('#photo-retry').waitFor();assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.ok(blockedFigureRequests>0);allowFigure=true;
  await page.locator('#photo-retry').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#photo-full').hidden&&document.querySelector('#photo-full').naturalWidth===947);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#photo-dialog').open);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'chronology-radar-open');
  assert.equal(new URL(page.url()).searchParams.get('t'),'15180');
});

test('without scripting the existing complete documentary figure and source route remain readable',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false});
  await page.goto(base+'/joplin.html#radar');
  const figure=page.locator('#radar a[data-photo-id="nist-joplin-radar-sequence"]');
  assert.equal(await figure.getAttribute('href'),png);
  assert.equal(await figure.locator('img').getAttribute('width'),'947');
  assert.equal(await figure.locator('img').getAttribute('height'),'1326');
  assert.match(await page.locator('#radar').textContent(),/NOAA/);
  assert.match(await page.locator('#source-nist-radar a').first().getAttribute('href'),/#page=93$/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
