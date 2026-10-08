import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const entries=[
  {id:'goes-east-storm-context',figure:'goes-storm',file:'goes-storm-april27.png',width:1280,height:720,
   source:'https://www.nesdis.noaa.gov/news/the-tuscaloosa-birmingham-ef-4-tornado',
   rights:'https://www.noaa.gov/office-education/outreach-communication/faq#using-noaa-content',
   sourceId:'nesdis-goes-storm',title:/cloud field during the storm/,date:/April 27, 2011, 22:15 UTC/,
   credit:/resized the complete original/,original:/resized GOES display copy/},
  {id:'eo1-tuscaloosa-track',figure:'eo1-track',file:'eo1-track-may2.jpg',width:720,height:480,
   source:'https://science.nasa.gov/earth/earth-observatory/tornado-track-in-tuscaloosa-alabama-50434/',
   rights:'https://www.nasa.gov/nasa-brand-center/images-and-media/',
   sourceId:'nasa-eo1-track',title:/debris track several days later/,date:/May 2, 2011/,
   credit:/Jesse Allen and Robert Simmon/,original:/preserved NASA labeled display/},
];
async function ready(page){await page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');}
async function shown(page,item){
  await page.waitForFunction(({width,height})=>{
    const image=document.getElementById('photo-full');
    return document.getElementById('photo-dialog').open&&!image.hidden&&
      image.complete&&image.naturalWidth===width&&image.naturalHeight===height;
  },item);
}
async function labels(page,item){
  assert.match(await page.locator('#photo-title').textContent(),item.title);
  assert.match(await page.locator('#photo-location').textContent(),item.date);
  assert.match(await page.locator('#photo-credit').textContent(),item.credit);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),item.source);
  assert.equal(await page.locator('#photo-license').getAttribute('href'),item.rights);
  assert.match(await page.locator('#photo-original').textContent(),item.original);
  assert.ok((await page.locator('#photo-original').getAttribute('href')).endsWith(item.file));
  assert.equal(/KBMX|county crossing|original radar/.test(await page.locator('#photo-dialog').textContent()),false);
}
async function closed(page,id){
  await page.waitForFunction(id=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo')&&document.activeElement?.dataset.photoId===id,id);
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`satellite views preserve separate source and history journeys ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/tuscaloosa.html?context=satellite#satellite-context');await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const context=await page.locator('#satellite-context').textContent();
    assert.match(context,/These three images preserve different views and their own source clocks/);
    assert.match(context,/not an aligned before and after pair/);
    assert.match(context,/unknown acquisition clock and color meaning kept explicit/);
    const scar=await page.locator('#landsat-scar').textContent();
    assert.match(scar,/no printed legend, scale or acquisition date/);
    assert.match(scar,/colors are not used here as damage ratings or wind measurements/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    for(const item of entries){
      const opener=page.locator(`[data-photo-id="${item.id}"]`);
      await opener.scrollIntoViewIfNeeded();
      await page.waitForFunction(({id,width,height})=>{
        const image=document.querySelector(`[data-photo-id="${id}"] img`);
        return image.complete&&image.naturalWidth===width&&image.naturalHeight===height;
      },item);
      if(width<600)await opener.tap();else{await opener.focus();await page.keyboard.press('Enter');}
      await shown(page,item);await labels(page,item);
      if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({
        path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`${item.figure}-${width}-${appearance}.png`)});
      await page.keyboard.press('Escape');await closed(page,item.id);
      await page.goForward();await shown(page,item);await labels(page,item);
      await page.goBack();await closed(page,item.id);
      assert.equal(new URL(page.url()).hash,'#satellite-context');
      assert.equal(new URL(page.url()).searchParams.get('context'),'satellite');
    }
    // Both lazy sources have completed before taking the full section capture.
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.locator('#satellite-context').screenshot({
      path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-satellite-section-${width}-${appearance}.png`)});
    // Shared controls must reset source and credit when returning to old radar.
    await page.locator('[data-photo-id="kbmx-reflectivity-county-crossing"]').click();
    try{
      await page.waitForFunction(()=>!document.getElementById('photo-full').hidden&&
        document.getElementById('photo-full').naturalWidth===755);
    }catch(error){
      console.log('SATELLITE_RADAR_OPEN_FAILURE',JSON.stringify(await page.evaluate(()=>{
        const image=document.getElementById('photo-full'),dialog=document.getElementById('photo-dialog');
        return {url:location.href,ready:document.body?.dataset.photoViewer,dialog:dialog?.open,
          title:document.getElementById('photo-title')?.textContent,
          image:image&&{src:image.getAttribute('src'),hidden:image.hidden,complete:image.complete,
            width:image.naturalWidth,height:image.naturalHeight},
          failure:document.getElementById('photo-failure')?.textContent,
          failureHidden:document.getElementById('photo-failure')?.hidden,
          active:document.activeElement?.outerHTML.slice(0,500)};
      })));
      throw error;
    }
    assert.match(await page.locator('#photo-location').textContent(),/KBMX/);
    assert.equal(await page.locator('#photo-source').getAttribute('href'),'https://www.weather.gov/bmx/event_04272011tuscbirm');
    assert.equal(await page.locator('#photo-source').textContent(),'Original survey and image captions');
    assert.equal(await page.locator('#photo-license').getAttribute('href'),'https://www.weather.gov/disclaimer');
    assert.match(await page.locator('#photo-original').textContent(),/original radar image/);
    await page.keyboard.press('Escape');await closed(page,'kbmx-reflectivity-county-crossing');
    const item=entries[1];
    await page.locator(`#${item.figure} a[href*="media=${item.id}"]`).click();
    await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    const media=page.locator('#media-'+item.id);await media.waitFor();
    assert.match(await media.textContent(),/May 2, 2011/);
    assert.match(await media.textContent(),/unregistered/);
    await media.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    await page.locator('#source-'+item.sourceId).waitFor();
    assert.match(await page.locator('#source-'+item.sourceId).textContent(),/Jesse Allen and Robert Simmon/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('direct EO-1 URL survives reload and closes without erasing unrelated context',async t=>{
  const page=await fixture(t);const item=entries[1];
  await page.goto(base+`/tuscaloosa.html?context=direct&photo=${item.id}#satellite-context`);
  await ready(page);await shown(page,item);await labels(page,item);
  await page.reload();await ready(page);await shown(page,item);await labels(page,item);
  await page.locator('#photo-close').click();await closed(page,item.id);
  assert.equal(new URL(page.url()).searchParams.get('context'),'direct');
  assert.equal(new URL(page.url()).hash,'#satellite-context');
});

test('failed EO-1 image keeps its own source and retries without a previous bitmap',async t=>{
  const page=await fixture(t);const item=entries[1];let failing=true;
  await page.route('**/'+item.file,route=>failing?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/tuscaloosa.html?photo='+item.id+'#satellite-context');await ready(page);
  await page.locator('#photo-retry').waitFor({state:'visible'});await labels(page,item);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/contrail/);
  failing=false;await page.locator('#photo-retry').click();await shown(page,item);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  await page.locator('#photo-close').click();await closed(page,item.id);
});

test('satellite descriptions and source routes remain useful without JavaScript',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844}});
  await page.goto(base+'/tuscaloosa.html#satellite-context');
  const section=page.locator('#satellite-context');
  for(const phrase of ['These three images preserve different views and their own source clocks','22:15 UTC','May 2 acquisition','contrail','different fields of view'])
    assert.ok((await section.textContent()).includes(phrase),phrase);
  for(const item of entries){
    assert.equal(await page.locator(`#${item.figure} a[href="${item.source}"]`).count(),1);
    assert.equal(await page.locator(`[data-photo-id="${item.id}"] img`).getAttribute('loading'),'lazy');
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const item=entries[1];await page.locator(`[data-photo-id="${item.id}"]`).focus();
  await Promise.all([page.waitForURL(url=>url.pathname.endsWith(item.file)),page.keyboard.press('Enter')]);
});

test('EO-1 long attribution and enlarged text stay readable in a short landscape viewer',async t=>{
  const page=await fixture(t,{viewport:{width:568,height:320},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const item=entries[1];await page.goto(base+'/tuscaloosa.html?photo='+item.id+'#satellite-context');
  await ready(page);await shown(page,item);await labels(page,item);
  await page.locator('#photo-dialog').evaluate(dialog=>{
    const nodes=[...dialog.querySelectorAll('h2,p,a,button')];
    const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
  });
  const layout=await page.locator('#photo-dialog').evaluate(dialog=>({client:dialog.clientWidth,scroll:dialog.scrollWidth,
    height:dialog.clientHeight,scrollHeight:dialog.scrollHeight}));
  assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
  assert.ok(layout.scrollHeight>=layout.height,JSON.stringify(layout));
  await page.locator('#photo-close').click();await closed(page,item.id);
});
