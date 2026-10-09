import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {readDossierDownload} from './dossier-download-helper.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

const survey='https://www.weather.gov/bmx/event_04272011tuscbirm';
const photos=[
  {id:'birmingham-aftermath-april29',file:'birmingham-aftermath-april29.jpg',
    title:'A damaged neighborhood north of Birmingham',
    source:'bmx-birmingham-aftermath',credit:/Only embedded metadata was removed/,
    sha:'2a7c08901d95a8943b53c1d55da6b1f0d6b1c45f717220f7d747856d318507cf'},
  {id:'railway-bridge-aftermath',file:'railway-bridge-april29.jpg',
    title:'A railway bridge in the survey photograph',
    source:'bmx-railway-bridge',credit:/Only EXIF metadata was removed/,
    sha:'1abcd76e5b905f157c39da7d3ee39b0b1e4966810211f16410c5a21f097a8a59'},
  {id:'train-cars-aftermath',file:'train-cars-april29.jpg',
    title:'Rail cars in the survey aftermath',
    source:'bmx-train-cars',credit:/Only EXIF metadata was removed/,
    photographer:/Individual photographer and employment unknown\./,
    sha:'7d3f623f672efe61a65fc975feddddcc2e5ec58007b731a84da97bb3f8c6dd61'},
];
const asset=photo=>'assets/tuscaloosa-birmingham-2011/'+photo.file;
const train=photos[2];
const trainAlt='Elevated view of light-colored rail cars along an upper track and others scattered or angled across dark open ground near trees. NWS BMX is printed at bottom left and 04/29/2011 at bottom right.';

async function transition(page,action,expected){
  // Arm the exact document and evidence wait before activating its real link.
  const settled=waitForDossier(page,expected).then(()=>({}),error=>({error}));
  let activationError;
  try{await action();}catch(error){activationError=error;}
  const result=await settled;
  if(activationError)throw activationError;
  if(result.error)throw result.error;
}

async function select(page,photo,touch=false){
  const link=page.locator(`[data-photo-id="${photo.id}"]`);
  await link.scrollIntoViewIfNeeded();
  await page.waitForFunction(({id,file})=>{
    const img=document.querySelector(`[data-photo-id="${id}"] img`);
    return img?.complete&&new URL(img.src).pathname.endsWith('/'+file)&&
      img.naturalWidth===800&&img.naturalHeight===600;
  },{id:photo.id,file:photo.file});
  await link.locator('img').evaluate(img=>img.decode());
  if(touch)await link.tap();else{await link.focus();await page.keyboard.press('Enter');}
}
async function textMatches(page,photo){
  assert.equal(await page.locator('#photo-title').textContent(),photo.title);
  assert.match(await page.locator('#photo-location').textContent(),/April 29, 2011/);
  assert.match(await page.locator('#photo-location').textContent(),/capture time and time zone are unknown/);
  assert.match(await page.locator('#photo-credit').textContent(),
    photo.photographer||/Individual photographer unknown/);
  assert.match(await page.locator('#photo-credit').textContent(),photo.credit);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),survey);
  assert.equal(await page.locator('#photo-license').getAttribute('href'),'https://www.weather.gov/disclaimer');
  assert.equal(await page.locator('#photo-original').getAttribute('href'),base+'/'+asset(photo));
  assert.match(await page.locator('#photo-original').textContent(),/metadata-stripped publication copy/);
  assert.equal(new URL(page.url()).searchParams.get('photo'),photo.id);
  if(photo===photos[1]){
    assert.match(await page.locator('#photo-caption').textContent(),/Train Bridge Demolished/);
    assert.match(await page.locator('#photo-location').textContent(),/unknown|unidentified/);
    assert.equal(/Black Warrior|KBMX|5:38|county crossing/.test(
      await page.locator('#photo-dialog').textContent()),false);
  }
  if(photo===train){
    assert.match(await page.locator('#photo-caption').textContent(),/Train Cars Derailed & Thrown/);
    const location=await page.locator('#photo-location').textContent();
    assert.match(location,/April 27 tornado/);
    assert.match(location,/Exact locality, railway, camera position, capture time and time zone are unknown\./);
    assert.match(location,/April 29, 2011 is a source label/);
    assert.match(location,/No clock or geographic registration is assigned\./);
    assert.equal(await page.locator('#photo-full').getAttribute('alt'),trainAlt);
    assert.equal(/Black Warrior|KBMX|5:38|county crossing/.test(
      await page.locator('#photo-dialog').textContent()),false);
  }
}
async function shown(page,photo){
  // All three photographs are 800x600. Size alone cannot identify the selected item.
  await page.waitForFunction(file=>{
    const img=document.getElementById('photo-full');
    return document.getElementById('photo-dialog').open&&!img.hidden&&
      new URL(img.src).pathname.endsWith('/'+file)&&img.complete&&
      img.naturalWidth===800&&img.naturalHeight===600;
  },photo.file);
  assert.equal(await page.locator('#photo-dialog').isVisible(),true);
  assert.equal(await page.locator('#photo-full').isVisible(),true);
  await page.locator('#photo-full').evaluate(img=>img.decode());
  await textMatches(page,photo);
}
async function closed(page,photo){
  await page.waitForFunction(id=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo')&&
    document.activeElement?.dataset.photoId===id,photo.id);
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test(`Tuscaloosa bridge, neighborhood and rail cars keep distinct history and source ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600,acceptDownloads:true});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/tuscaloosa.html?context=bridge#path');
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
      assert.equal(new URL(page.url()).searchParams.get('context'),'bridge');
      assert.equal(new URL(page.url()).hash,'#path');
    }
    await select(page,photos[1],width<600);await shown(page,photos[1]);
    if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({
      path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-bridge-${width}-${appearance}.png`)});
    let doubledFonts;
    if(width===320){
      doubledFonts=await page.locator('#photo-dialog').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('h2,p,a,button')];
        const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,i)=>node.style.fontSize=sizes[i]*2+'px');
        return {before:sizes,after:nodes.map(node=>parseFloat(getComputedStyle(node).fontSize))};
      });
      assert.ok(doubledFonts.before.length>0);
      doubledFonts.before.forEach((value,i)=>{
        assert.ok(Number.isFinite(value)&&value>0);
        assert.equal(doubledFonts.after[i],value*2);
      });
      const layout=await page.locator('#photo-dialog').evaluate(dialog=>({
        client:dialog.clientWidth,scroll:dialog.scrollWidth}));
      assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
    }
    await page.keyboard.press('Escape');await closed(page,photos[1]);
    if(width===320){
      await select(page,train,true);await shown(page,train);
      // Reuse the verified doubled styles rather than doubling the dialog again.
      const fonts=await page.locator('#photo-dialog').evaluate(dialog=>
        [...dialog.querySelectorAll('h2,p,a,button')].map(node=>parseFloat(getComputedStyle(node).fontSize)));
      assert.deepEqual(fonts,doubledFonts.after,'The train metadata retains exactly doubled text');
      const layout=await page.locator('#photo-dialog').evaluate(dialog=>({
        client:dialog.clientWidth,scroll:dialog.scrollWidth}));
      assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
      await page.keyboard.press('Escape');await closed(page,train);
    }
    const documentHref=page.url();
    for(const photo of [photos[1],train]){
      const figure=photo===train?'train-cars':'railway-bridge';
      const link=page.locator(`#${figure} a[href*="media=${photo.id}"]`);
      const mediaRoute={href:new URL(await link.getAttribute('href'),page.url()).href,
        elementId:'media-'+photo.id};
      await transition(page,()=>link.click(),mediaRoute);
      const card=page.locator('#media-'+photo.id);await card.waitFor();
      if(photo===photos[1])assert.match(await card.textContent(),/Bridge, waterway and locality unnamed\./);
      else{
        assert.match(await card.textContent(),/movement description comes from the NWS caption/);
        assert.match(await card.textContent(),/Exact locality and railway, photographer, camera position and calibrated capture clock unknown/);
        assert.equal(await card.locator('dt:has-text("Temporal") + dd').textContent(),'source label');
      }
      assert.equal(await card.locator('dt:has-text("Spatial") + dd').textContent(),'unregistered');
      const {dossier:metadata}=await readDossierDownload(page);
      const item=metadata.media.find(row=>row.id===photo.id);
      assert.equal(item.source_id,photo.source);
      assert.equal(item.transformation.asset,asset(photo));
      assert.equal(item.transformation.sha256,photo.sha);
      assert.equal(item.place.coordinates,null);assert.equal(item.time.alignment,null);
      if(photo===train){
        for(const clock of ['capture','publication','video','alignment'])assert.equal(item.time[clock],null);
        assert.equal(item.roles.creator,null);assert.equal(item.roles.rights_holder,null);
        assert.equal(item.roles.uploader,'nws-birmingham');
      }
      const sourceLink=card.getByRole('link',{name:'Inspect the source card',exact:true});
      const sourceRoute={href:new URL(await sourceLink.getAttribute('href'),page.url()).href,
        elementId:'source-'+photo.source};
      await transition(page,()=>sourceLink.click(),sourceRoute);
      const source=page.locator('#source-'+photo.source);await source.waitFor();
      assert.match(await source.textContent(),photo===train?/Train Cars Derailed & Thrown/:/Train Bridge Demolished/);
      assert.match(await source.textContent(),/Item-specific agency-material inference/);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await transition(page,()=>page.goBack(),mediaRoute);
      await page.goBack();
      await page.waitForFunction(href=>location.href===href&&document.body?.dataset.photoViewer==='ready',documentHref);
      if(photo===train){
        const authoredSource=page.locator('#source-train-cars a[href*="source=bmx-train-cars"]');
        await transition(page,()=>authoredSource.click(),{
          href:new URL(await authoredSource.getAttribute('href'),page.url()).href,
          elementId:'source-'+train.source});
        const source=page.locator('#source-'+train.source);
        assert.match(await source.textContent(),/Photographer employment and rights-holder identity unknown/);
        assert.equal(await source.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),
          'https://www.weather.gov/images/bmx/significant_events/2011/042711/tuscbirm/5.JPG');
      }
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('a failed bridge photograph does not leak its bitmap or credit into the neighborhood',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844}});let failing=true;
  await page.route('**/'+photos[1].file,route=>failing?
    route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/tuscaloosa.html?photo='+photos[1].id+'&context=bridge#railway-bridge');
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
  assert.equal(new URL(page.url()).searchParams.get('context'),'bridge');
  assert.equal(new URL(page.url()).hash,'#railway-bridge');
});

test('a controlled train-photo failure retains its metadata and recovers without a stale bridge bitmap or credit',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844}});let failing=true;
  await page.route(base+'/'+asset(train),route=>failing?
    route.fulfill({status:503,body:'Controlled test fixture: unavailable'}):route.continue());
  await page.goto(base+'/tuscaloosa.html?photo='+train.id+'&context=train#train-cars');
  await page.locator('#photo-retry').waitFor({state:'visible'});await textMatches(page,train);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.equal(await page.locator('#photo-full').getAttribute('alt'),trainAlt);
  assert.equal(await page.locator('#photo-full').getAttribute('src'),base+'/'+asset(train));
  await page.locator('#photo-close').click();
  await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&
    !new URL(location.href).searchParams.has('photo'));
  assert.equal(new URL(page.url()).pathname,'/tuscaloosa.html');
  assert.equal(new URL(page.url()).searchParams.get('context'),'train');
  assert.equal(new URL(page.url()).hash,'#train-cars');
  await select(page,photos[1]);await shown(page,photos[1]);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  assert.equal(await page.locator('#photo-retry').isVisible(),false);
  assert.doesNotMatch(await page.locator('#photo-dialog').textContent(),
    /Train Cars Derailed & Thrown|Individual photographer and employment unknown\./);
  await page.keyboard.press('Escape');await closed(page,photos[1]);
  // The failed thumbnail still opens readable metadata through its real link.
  const link=page.locator(`[data-photo-id="${train.id}"]`);
  await link.focus();await page.keyboard.press('Enter');
  await page.locator('#photo-retry').waitFor({state:'visible'});await textMatches(page,train);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.equal(await page.locator('#photo-full').getAttribute('src'),base+'/'+asset(train));
  failing=false;await page.locator('#photo-retry').click();await shown(page,train);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  assert.equal(await page.locator('#photo-retry').isVisible(),false);
  await page.keyboard.press('Escape');await closed(page,train);
  assert.equal(new URL(page.url()).searchParams.get('context'),'train');
  assert.equal(new URL(page.url()).hash,'#train-cars');
});

test('the bridge and rail-car photographs retain readable keyboard source routes without JavaScript',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},javaScriptEnabled:false});
  for(const photo of [photos[1],train]){
    const figureId=photo===train?'train-cars':'railway-bridge';
    await page.goto(base+'/tuscaloosa.html#'+figureId);
    const figure=page.locator('#'+figureId);
    assert.match(await figure.textContent(),photo===train?/Train Cars Derailed & Thrown/:/Train Bridge Demolished/);
    assert.match(await figure.textContent(),/Individual photographer unknown/);
    if(photo===train){
      assert.match(await figure.locator('figcaption').textContent(),/Individual photographer unknown\./);
      const limits=await figure.locator('xpath=following-sibling::p[1]').textContent();
      assert.match(limits,/not established as views of the same railway or place/);
      assert.match(limits,/A single photograph does not establish failure sequence, force, wind speed or trajectory/);
      assert.match(limits,/source label, not a calibrated capture clock/);
    }
    const link=figure.locator(`[data-photo-id="${photo.id}"]`);
    assert.equal(await link.getAttribute('href'),asset(photo));
    await link.focus();
    await Promise.all([page.waitForURL(url=>url.pathname==='/'+asset(photo)),
      page.keyboard.press('Enter')]);
    assert.equal(new URL(page.url()).pathname,'/'+asset(photo));
    const response=await page.request.get(page.url());
    assert.equal(response.status(),200);
    assert.equal(createHash('sha256').update(await response.body()).digest('hex'),photo.sha);
    await page.goBack();
    assert.equal(new URL(page.url()).hash,'#'+figureId);
    assert.equal(await figure.locator('a[href="'+survey+'"]').count()>0,true);
    if(photo===train){
      assert.equal(await figure.locator('a[href="dossier.html?event=tuscaloosa-birmingham-2011&media='+
        train.id+'#media-'+train.id+'"]').count(),1);
      assert.equal(await page.locator('#source-train-cars a[href="dossier.html?event=tuscaloosa-birmingham-2011&source='+
        train.source+'#source-'+train.source+'"]').count(),1);
    }
  }
});
