import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture, base} from './harness.mjs';
import {noScriptImage} from './no-script-image.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {settledFragment} from './fragment-ready.mjs';

const items=[
  {page:'joplin.html',event:'joplin-2011',section:'satellite-scar',id:'nasa-joplin-aster-may30',sourceId:'nasa-joplin-aster',
   file:'assets/joplin-2011/aster-may30.jpg',width:1606,height:1606,credit:/NASA\/GSFC\/METI\/ERSDAC\/JAROS/,
   clock:/May 30, 2011/,limits:/not adopted/,source:'https://science.nasa.gov/earth/earth-observatory/tornado-in-joplin-missouri-50755/',
   rights:'https://www.nasa.gov/nasa-brand-center/images-and-media/'},
  {page:'tuscaloosa.html',event:'tuscaloosa-birmingham-2011',section:'landsat-scar',id:'usgs-tuscaloosa-landsat-scar',sourceId:'usgs-landsat-scar',
   file:'assets/tuscaloosa-birmingham-2011/landsat-scar.png',width:1108,height:577,credit:/Public Domain/,
   clock:/acquisition date and hour remain unknown/,limits:/no legend/,source:'https://www.usgs.gov/media/images/tuscaloosa-birmingham-tornado-scar-april-2011',
   rights:'https://www.usgs.gov/media/images/tuscaloosa-birmingham-tornado-scar-april-2011'},
];
const ready=page=>page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');
async function shown(page,item){
  await page.waitForFunction(({width,height,file})=>{
    const i=document.getElementById('photo-full');
    return document.getElementById('photo-dialog')?.open && i && !i.hidden && i.complete &&
      i.naturalWidth===width && i.naturalHeight===height && new URL(i.currentSrc||i.src).pathname.endsWith('/'+file);
  },item);
  await noScriptImage(page.locator('#photo-full'),{source:base+'/'+item.file,width:item.width,height:item.height});
}
async function labels(page,item){
  assert.match(await page.locator('#photo-credit').textContent(),item.credit);
  assert.match(await page.locator('#photo-location').textContent(),item.clock);
  assert.match(await page.locator('#photo-location').textContent(),/unregistered/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),item.source);
  assert.equal(await page.locator('#photo-license').getAttribute('href'),item.rights);
  assert.match(await page.locator('#photo-original').textContent(),/preserved.*display/);
  assert.equal(await page.locator('#photo-original').getAttribute('href'),base+'/'+item.file);
}

for(const item of items)for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`satellite documentary, viewer, history and dossier ${item.event} ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/'+item.page+'?context=satellite#'+item.section);await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const opener=page.locator(`[data-photo-id="${item.id}"]`);await opener.scrollIntoViewIfNeeded();
    await noScriptImage(opener.locator('img'),{source:base+'/'+item.file,width:item.width,height:item.height});
    await opener.focus();await page.keyboard.press('Enter');await shown(page,item);await labels(page,item);
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`${item.id}-${width}-${appearance}.png`)});
    await page.keyboard.press('Escape');
    await page.waitForFunction(id=>!document.getElementById('photo-dialog').open && !new URL(location.href).searchParams.has('photo') && document.activeElement?.dataset.photoId===id,item.id);
    await page.goForward();await shown(page,item);await labels(page,item);
    await page.reload();await ready(page);await shown(page,item);await labels(page,item);
    await page.locator('#photo-close').click();
    await page.waitForFunction(()=>!document.getElementById('photo-dialog').open && !new URL(location.href).searchParams.has('photo'));
    assert.equal(new URL(page.url()).searchParams.get('context'),'satellite');
    assert.equal(new URL(page.url()).hash,'#'+item.section);
    const link=page.locator(`a[href*="media=${item.id}"]`);
    const destination={href:await link.evaluate(a=>a.href),elementId:'media-'+item.id};
    await link.click();await waitForDossier(page,destination);
    const media=page.locator('#media-'+item.id);assert.match(await media.textContent(),item.limits);
    assert.match(await media.textContent(),/unregistered/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const source=media.getByRole('link',{name:'Inspect the source card',exact:true});
    const target={href:await source.evaluate(a=>a.href),elementId:'source-'+item.sourceId};
    await source.click();await waitForDossier(page,target);
    assert.match(await page.locator('#source-'+item.sourceId).textContent(),/inspected/);
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
    assert.equal(requests.some(url=>/youtube|\.pdf|catalogue\/index/.test(url)),false);
  });
}
for(const item of items){
  test(`satellite no-script local image and readable route ${item.event}`,async t=>{
    const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:390,height:844},colorScheme:'dark'});
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/'+item.page+'#'+item.section);
    const opener=page.locator(`[data-photo-id="${item.id}"]`);
    await settledFragment(page,item.section,item.id);await opener.scrollIntoViewIfNeeded();
    await noScriptImage(opener.locator('img'),{source:base+'/'+item.file,width:item.width,height:item.height});
    assert.match(await page.locator('#'+item.section).textContent(),/not|unknown/);
    assert.equal(await opener.getAttribute('href'),item.file);
    await opener.focus();await page.keyboard.press('Enter');
    await page.waitForURL(base+'/'+item.file);
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
  test(`satellite failed image keeps source, own labels and retry ${item.event}`,async t=>{
    const page=await fixture(t);let fail=true;
    await page.route('**/'+item.file,route=>fail?route.fulfill({status:503,body:'Unavailable'}):route.continue());
    await page.goto(base+'/'+item.page+'?photo='+item.id+'#'+item.section);await ready(page);
    await page.locator('#photo-failure').waitFor();await labels(page,item);
    assert.equal(await page.locator('#photo-full').isVisible(),false);
    fail=false;await page.locator('#photo-retry').click();await shown(page,item);await labels(page,item);
  });
}
