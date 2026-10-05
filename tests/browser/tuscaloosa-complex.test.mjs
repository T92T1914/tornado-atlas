import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const survey='https://www.weather.gov/bmx/event_04272011tuscbirm';
const photos=[
  {id:'birmingham-aftermath-april29',file:'birmingham-aftermath-april29.jpg',
    title:'A damaged neighborhood north of Birmingham',
    source:'bmx-birmingham-aftermath',credit:/Only embedded metadata was removed/,
    sha:'2a7c08901d95a8943b53c1d55da6b1f0d6b1c45f717220f7d747856d318507cf'},
  {id:'apartment-complex-aftermath',file:'apartment-complex-april29.jpg',
    title:'An apartment complex in the survey photograph',
    source:'bmx-apartment-complex',credit:/Only EXIF metadata was removed/,
    sha:'67502ee34b2f76a9d875d688caf026344d38325b8bfb27a5ebf3a38484142b47'},
];
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
async function textMatches(page,photo){
  assert.equal(await page.locator('#photo-title').textContent(),photo.title);
  assert.match(await page.locator('#photo-location').textContent(),/April 29, 2011/);
  assert.match(await page.locator('#photo-location').textContent(),/capture time and time zone are unknown/);
  assert.match(await page.locator('#photo-credit').textContent(),/Individual photographer unknown/);
  assert.match(await page.locator('#photo-credit').textContent(),photo.credit);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),survey);
  assert.equal(await page.locator('#photo-license').getAttribute('href'),'https://www.weather.gov/disclaimer');
  assert.equal(await page.locator('#photo-original').getAttribute('href'),base+'/'+asset(photo));
  assert.match(await page.locator('#photo-original').textContent(),/metadata-stripped publication copy/);
  assert.equal(new URL(page.url()).searchParams.get('photo'),photo.id);
  if(photo===photos[1]){
    assert.match(await page.locator('#photo-caption').textContent(),/Apartment Complex Leveled/);
    assert.match(await page.locator('#photo-location').textContent(),/no particular complex or city/);
    assert.equal(/Chastain Manor|Alberta City|KBMX|5:38|county crossing/.test(
      await page.locator('#photo-dialog').textContent()),false);
  }
}
async function shown(page,photo){
  // Both photographs are 800x600. Size alone cannot identify the selected item.
  await page.waitForFunction(file=>{
    const img=document.getElementById('photo-full');
    return document.getElementById('photo-dialog').open&&!img.hidden&&
      new URL(img.src).pathname.endsWith('/'+file)&&img.complete&&
      img.naturalWidth===800&&img.naturalHeight===600;
  },photo.file);
  await page.locator('#photo-full').evaluate(img=>img.decode());
  await textMatches(page,photo);
}
async function closed(page,photo){
  await page.waitForFunction(id=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo')&&
    document.activeElement?.dataset.photoId===id,photo.id);
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`two Tuscaloosa photographs keep distinct history and source ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/tuscaloosa.html?context=complex#path');
    await page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');
    await page.locator('#reading-appearance').selectOption(appearance);
    for(const photo of photos){
      await select(page,photo,width<600);await shown(page,photo);
      const response=await page.request.get(base+'/'+asset(photo));
      assert.equal(response.status(),200);
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'),photo.sha);
      await page.goBack();await closed(page,photo);
      await page.goForward();await shown(page,photo);
      await page.keyboard.press('Escape');await closed(page,photo);
      assert.equal(new URL(page.url()).searchParams.get('context'),'complex');
      assert.equal(new URL(page.url()).hash,'#path');
    }
    await select(page,photos[1],width<600);await shown(page,photos[1]);
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({
      path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-complex-${width}-${appearance}.png`)});
    if(width===320){
      await page.locator('#photo-dialog').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('h2,p,a,button')];
        const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,i)=>node.style.fontSize=sizes[i]*2+'px');
      });
      const layout=await page.locator('#photo-dialog').evaluate(dialog=>({
        client:dialog.clientWidth,scroll:dialog.scrollWidth}));
      assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
    }
    await page.keyboard.press('Escape');await closed(page,photos[1]);
    await page.locator('#apartment-complex a[href*="media=apartment-complex-aftermath"]').click();
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    const card=page.locator('#media-'+photos[1].id);await card.waitFor();
    assert.match(await card.textContent(),/unnamed/i);
    assert.equal(await card.locator('dt:has-text("Spatial") + dd').textContent(),'unregistered');
    const metadataUrl=await page.getByRole('link',{name:'Download dossier metadata (JSON)',exact:true}).getAttribute('href');
    const metadata=await (await page.request.get(new URL(metadataUrl,page.url()).href)).json();
    const item=metadata.media.find(row=>row.id===photos[1].id);
    assert.equal(item.source_id,photos[1].source);
    assert.equal(item.transformation.asset,asset(photos[1]));
    assert.equal(item.transformation.sha256,photos[1].sha);
    assert.equal(item.place.coordinates,null);assert.equal(item.time.alignment,null);
    await card.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    const source=page.locator('#source-'+photos[1].source);await source.waitFor();
    assert.match(await source.textContent(),/Apartment Complex Leveled/);
    assert.match(await source.textContent(),/Item-specific agency-material inference/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('a failed second photograph does not leak its bitmap or credit into the first',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844}});let failing=true;
  await page.route('**/'+photos[1].file,route=>failing?
    route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/tuscaloosa.html?photo='+photos[1].id+'&context=complex#apartment-complex');
  await page.locator('#photo-retry').waitFor({state:'visible'});await textMatches(page,photos[1]);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/Elevated view/);
  await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo'));
  await select(page,photos[0]);await shown(page,photos[0]);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  assert.equal(await page.locator('#photo-retry').isVisible(),false);
  await page.keyboard.press('Escape');await closed(page,photos[0]);
  // The second thumbnail remains unavailable. Its ordinary link can still open
  // the viewer's readable failure state without claiming loaded pixels.
  const second=page.locator(`[data-photo-id="${photos[1].id}"]`);
  await second.focus();await page.keyboard.press('Enter');
  await page.locator('#photo-retry').waitFor({state:'visible'});await textMatches(page,photos[1]);
  failing=false;await page.locator('#photo-retry').click();await shown(page,photos[1]);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  await page.keyboard.press('Escape');await closed(page,photos[1]);
  assert.equal(new URL(page.url()).searchParams.get('context'),'complex');
  assert.equal(new URL(page.url()).hash,'#apartment-complex');
});
