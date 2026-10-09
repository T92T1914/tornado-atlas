import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {readDossierDownload} from './dossier-download-helper.mjs';

const survey='https://www.weather.gov/bmx/event_04272011tuscbirm';
const photos=[
  {id:'birmingham-aftermath-april29',file:'birmingham-aftermath-april29.jpg',
    title:'A damaged neighborhood north of Birmingham',credit:/Only embedded metadata was removed/},
  {id:'apartment-complex-aftermath',file:'apartment-complex-april29.jpg',
    title:'An apartment complex in the survey photograph',credit:/Only EXIF metadata was removed/},
  {id:'railway-bridge-aftermath',file:'railway-bridge-april29.jpg',
    title:'A railway bridge in the survey photograph',credit:/Only EXIF metadata was removed/},
  {id:'aerial-context-aftermath',file:'aerial-context-april29.jpg',
    title:'A wider view of the survey aftermath',credit:/Only EXIF metadata was removed/},
];
const aerial=photos[3],sourceId='bmx-aerial-context';
const sha='df7c4593844902834ce3b428a7b021e8c530efd2b16ac5fe8698c3d7e92b703c';
const asset=photo=>'assets/tuscaloosa-birmingham-2011/'+photo.file;

async function select(page,photo,touch=false){
  const link=page.locator(`[data-photo-id="${photo.id}"]`);
  await link.scrollIntoViewIfNeeded();
  await page.waitForFunction(id=>{
    const img=document.querySelector(`[data-photo-id="${id}"] img`);
    return img?.complete&&img.naturalWidth===800&&img.naturalHeight===600;
  },photo.id);
  await link.locator('img').evaluate(img=>img.decode());
  if(touch)await link.tap();else{await link.focus();await page.keyboard.press('Enter');}
}
async function metadata(page,photo){
  assert.equal(await page.locator('#photo-title').textContent(),photo.title);
  assert.match(await page.locator('#photo-credit').textContent(),photo.credit);
  assert.match(await page.locator('#photo-credit').textContent(),/Individual photographer unknown/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),survey);
  assert.equal(await page.locator('#photo-original').getAttribute('href'),base+'/'+asset(photo));
  assert.match(await page.locator('#photo-original').textContent(),/metadata-stripped publication copy/);
  assert.equal(new URL(page.url()).searchParams.get('photo'),photo.id);
  if(photo===aerial){
    assert.match(await page.locator('#photo-caption').textContent(),/Aerial View of Scope of Damage Path/);
    const location=await page.locator('#photo-location').textContent();
    assert.match(location,/locality is unidentified/);
    assert.match(location,/April 27 tornado/);
    assert.match(location,/April 29, 2011 is a source label/);
    assert.match(location,/capture time and time zone are unknown/);
    assert.match(location,/No clock or geographic registration/);
    assert.equal(await page.locator('#photo-license').getAttribute('href'),'https://www.weather.gov/disclaimer');
  }
}
async function shown(page,photo){
  // All four are 800x600. Decode readiness must also match the selected filename.
  await page.waitForFunction(file=>{
    const img=document.getElementById('photo-full');
    return document.getElementById('photo-dialog').open&&!img.hidden&&
      new URL(img.src).pathname.endsWith('/'+file)&&img.complete&&
      img.naturalWidth===800&&img.naturalHeight===600;
  },photo.file);
  await page.locator('#photo-full').evaluate(img=>img.decode());
  await metadata(page,photo);
}
async function closed(page,photo){
  await page.waitForFunction(id=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo')&&
    document.activeElement?.dataset.photoId===id,photo.id);
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`four Tuscaloosa photographs retain distinct image, history and source ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600,acceptDownloads:true});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/tuscaloosa.html?context=aerial#path');
    await page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');
    await page.locator('#reading-appearance').selectOption(appearance);
    for(const photo of photos){
      await select(page,photo,width<600);await shown(page,photo);
      await page.keyboard.press('Escape');await closed(page,photo);
    }
    await select(page,aerial,width<600);await shown(page,aerial);
    const response=await page.request.get(base+'/'+asset(aerial));
    assert.equal(response.status(),200);
    assert.equal(createHash('sha256').update(await response.body()).digest('hex'),sha);
    await page.goBack();await closed(page,aerial);
    await page.goForward();await shown(page,aerial);
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({
      path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-aerial-${width}-${appearance}.png`)});
    if(width===320){
      const fonts=await page.locator('#photo-dialog').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('h2,p,a,button')];
        const before=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,i)=>node.style.fontSize=before[i]*2+'px');
        return {before,after:nodes.map(node=>parseFloat(getComputedStyle(node).fontSize)),
          client:dialog.clientWidth,scroll:dialog.scrollWidth};
      });
      fonts.before.forEach((value,i)=>assert.equal(fonts.after[i],value*2));
      assert.ok(fonts.scroll<=fonts.client+1,JSON.stringify(fonts));
    }
    await page.keyboard.press('Escape');await closed(page,aerial);
    assert.equal(new URL(page.url()).searchParams.get('context'),'aerial');
    assert.equal(new URL(page.url()).hash,'#path');
    const dossier=page.locator('#aerial-context a[href*="media=aerial-context-aftermath"]');
    await dossier.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    const card=page.locator('#media-'+aerial.id);await card.waitFor();
    assert.match(await card.textContent(),/Locality and camera unknown/);
    assert.match(await card.textContent(),/No full-track extent, measured width, wind speed, rating/);
    assert.equal(await card.locator('dt:has-text("Spatial") + dd').textContent(),'unregistered');
    assert.equal(await card.locator('dt:has-text("Temporal") + dd').textContent(),'source label');
    const {dossier:doc}=await readDossierDownload(page);
    const item=doc.media.find(row=>row.id===aerial.id);
    assert.equal(item.source_id,sourceId);
    assert.equal(item.transformation.asset,asset(aerial));
    assert.equal(item.transformation.sha256,sha);
    assert.equal(item.place.coordinates,null);assert.equal(item.place.reported,null);
    for(const clock of ['capture','publication','video','alignment'])assert.equal(item.time[clock],null);
    await card.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    const source=page.locator('#source-'+sourceId);await source.waitFor();
    assert.match(await source.textContent(),/Aerial View of Scope of Damage Path/);
    assert.match(await source.textContent(),/Item-specific agency-material inference/);
    assert.match(await source.textContent(),/Photographer employment is unknown/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('a controlled aerial-photo failure retains its metadata and recovers without a stale bridge bitmap',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844}});let failing=true;
  await page.route('**/'+aerial.file,route=>failing?
    route.fulfill({status:503,body:'Controlled test fixture: unavailable'}):route.continue());
  await page.goto(base+'/tuscaloosa.html?photo='+aerial.id+'&context=aerial#aerial-context');
  await page.locator('#photo-retry').waitFor({state:'visible'});await metadata(page,aerial);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/broad band of debris/);
  await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo'));
  await select(page,photos[2]);await shown(page,photos[2]);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  assert.equal(await page.locator('#photo-retry').isVisible(),false);
  await page.keyboard.press('Escape');await closed(page,photos[2]);
  // The failed thumbnail can still open readable attribution using its real link.
  const link=page.locator(`[data-photo-id="${aerial.id}"]`);
  await link.focus();await page.keyboard.press('Enter');
  await page.locator('#photo-retry').waitFor({state:'visible'});await metadata(page,aerial);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  failing=false;await page.locator('#photo-retry').click();await shown(page,aerial);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  await page.keyboard.press('Escape');await closed(page,aerial);
  assert.equal(new URL(page.url()).searchParams.get('context'),'aerial');
  assert.equal(new URL(page.url()).hash,'#aerial-context');
});
