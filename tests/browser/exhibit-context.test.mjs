import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

// The fixtures serve local originals only. Original source links are inspected,
// never opened; external services and all user browser state remain excluded.
async function loadedOriginal(page,image,source){
  await image.scrollIntoViewIfNeeded();
  // Scrolling can initiate lazy loading. Wait for the final original source,
  // rather than decoding a pending source selection that WebKit may abort.
  await page.waitForFunction(source=>{
    const image=document.querySelector(`img[src="${source}"]`);
    return image?.currentSrc===new URL(source,document.baseURI).href&&image.complete&&
      image.naturalWidth>0&&image.naturalHeight>0;
  },source);
}

for(const width of [1280,390,320]){
  test(`Blackwell map, remembrance and enlargement at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/blackwell.html');
    const map=page.locator('img[src="assets/blackwell-1955/nws-smoothed-damage.gif"]');
    await loadedOriginal(page,map,'assets/blackwell-1955/nws-smoothed-damage.gif');
    assert.deepEqual(await map.evaluate(image=>[image.naturalWidth,image.naturalHeight]),[700,700]);
    assert.ok((await map.getAttribute('alt')).includes('damage contours'));
    assert.ok(await page.locator('#damage-survey').innerText().then(text=>text.includes('does not preserve every building entry')));
    const link=map.locator('..');
    await link.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/assets/blackwell-1955/nws-smoothed-damage.gif');
    assert.equal((await page.request.get(page.url())).headers()['content-type'],'image/gif');
    await page.goBack();
    if(width===390&&process.env.ATLAS_CONTEXT_SCREENSHOT_DIR){
      await page.locator('#damage-survey').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,'blackwell-map-390.png')});
    }
    const memorial=page.locator('img[src="assets/blackwell-1955/nws-memorial-2005.jpg"]');
    await loadedOriginal(page,memorial,'assets/blackwell-1955/nws-memorial-2005.jpg');
    assert.deepEqual(await memorial.evaluate(image=>[image.naturalWidth,image.naturalHeight]),[800,600]);
    assert.ok(await page.locator('#remembrance').innerText().then(text=>text.includes('remembrance in 2005, not the tornado itself')));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');
    if(width===390&&process.env.ATLAS_CONTEXT_SCREENSHOT_DIR){
      await page.screenshot({path:path.join(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,'blackwell-memorial-390.png')});
    }
  });

  test(`Joplin interview retains its small source size at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/joplin.html#survivor-investigation');
    const image=page.locator('img[src="assets/joplin-2011/nist-interview.jpg"]');
    await loadedOriginal(page,image,'assets/joplin-2011/nist-interview.jpg');
    const metrics=await image.evaluate(image=>({width:image.clientWidth,natural:[image.naturalWidth,image.naturalHeight]}));
    assert.deepEqual(metrics.natural,[288,216]);
    assert.ok(metrics.width>0&&metrics.width<=288,'Small original is not enlarged beyond available pixels');
    assert.ok(await page.locator('#survivor-investigation').innerText().then(text=>text.includes('does not name the people')));
    assert.equal(await image.locator('..').getAttribute('href'),'assets/joplin-2011/nist-interview.jpg');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');
    if(width===390&&process.env.ATLAS_CONTEXT_SCREENSHOT_DIR){
      await page.locator('#survivor-investigation').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.ATLAS_CONTEXT_SCREENSHOT_DIR,'joplin-interview-390.png')});
    }
  });

  test(`Map discovery retains source credit and unregistered status at ${width}px`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/dossier.html?evidence=map');
    await page.waitForSelector('.archive-grid .archive-card');
    assert.equal(await page.locator('select[name="evidence"]').inputValue(),'map');
    const mapDossiers=page.locator('.archive-grid .archive-card');
    assert.equal(await mapDossiers.count(),2);
    assert.deepEqual(await mapDossiers.locator('a').evaluateAll(links=>links.map(link=>link.href).sort()),[
      new URL('dossier.html?event=blackwell-1955',base+'/').href,
      new URL('dossier.html?event=tuscaloosa-birmingham-2011',base+'/').href,
    ]);
    const blackwellDiscovery=mapDossiers.filter({has:page.locator('a[href$="dossier.html?event=blackwell-1955"]')});
    assert.equal(await blackwellDiscovery.count(),1);
    assert.ok((await blackwellDiscovery.innerText()).includes('Blackwell'));
    await page.goto(base+'/dossier.html?event=blackwell-1955&media=nws-blackwell-smoothed-map');
    const card=page.locator('#media-nws-blackwell-smoothed-map');
    await card.waitFor();
    assert.ok((await card.innerText()).includes('not measured wind bands'));
    assert.ok((await card.innerText()).includes('Doug Speheger, NWS Norman'));
    assert.equal(await card.locator('dt:has-text("Temporal") + dd').textContent(),'unregistered');
    assert.equal(await card.locator('dt:has-text("Spatial") + dd').textContent(),'unregistered');
    assert.equal(await card.locator('a:has-text("Open original media")').getAttribute('href'),'https://www.weather.gov/images/oun/wxevents/19550525/blackwelldamage.gif');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');
    await page.goto(base+'/dossier.html?event=tuscaloosa-birmingham-2011&media=bmx-static-survey-map');
    const survey=page.locator('#media-bmx-static-survey-map');
    await survey.waitFor();
    const surveyText=await survey.innerText();
    assert.ok(surveyText.includes('198 accounts'));
    assert.ok(surveyText.includes('no registered camera, visible tornado geometry'));
    assert.equal(await survey.locator('a[href$="dossier.html?creator=nws-birmingham"]').textContent(),'National Weather Service Birmingham');
    assert.equal(await survey.locator('dt:has-text("Temporal") + dd').textContent(),'source label');
    assert.equal(await survey.locator('dt:has-text("Spatial") + dd').textContent(),'unregistered');
    const originalMap='https://noaa.maps.arcgis.com/apps/mapviewer/index.html?configurableview=true&webmap=0deae8ed1989461faf99b315bb0e3126&theme=dark&bookmarks=true&legend=true&information=true&share=true&scroll=false&center=-87.27385175195786,33.364490187329956&scale=1155581.1085775';
    assert.equal(await survey.locator('a:has-text("Open original media")').getAttribute('href'),originalMap);
    const transformation=survey.locator('details').filter({hasText:'Parent and transformation'});
    assert.equal(await transformation.count(),1);
    await transformation.locator('summary').click();
    assert.equal(await transformation.getAttribute('open'),'');
    const transformationText=await transformation.innerText();
    assert.ok(transformationText.includes('eight decimal places for portable serialization, not field accuracy'));
    assert.ok(transformationText.includes('5ee7602b7022556858cbd7b99fce99ad0bf81750b79d8427acc12bf8a3efaefb'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Expanded map transformation has no horizontal document overflow');
    await survey.locator('a:has-text("Inspect the source card")').click();
    await page.waitForURL(url=>url.searchParams.get('event')==='tuscaloosa-birmingham-2011'&&url.searchParams.get('source')==='bmx-estimated-damage-map'&&url.hash==='#source-bmx-estimated-damage-map');
    const source=page.locator('#source-bmx-estimated-damage-map');
    await source.waitFor();
    assert.equal(await source.locator('a:has-text("Read original source")').getAttribute('href'),originalMap);
    assert.ok((await source.innerText()).includes('not a recovered 2011 revision'));
    assert.ok((await source.innerText()).includes('No source imagery hosted or blanket photograph rights granted'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Source return has no horizontal document overflow');
  });
}

test('A missing local map leaves its historical account and source routes readable',async t=>{
  const page=await fixture(t);
  await page.route('**/assets/blackwell-1955/nws-smoothed-damage.gif',route=>route.abort());
  await page.goto(base+'/blackwell.html#damage-survey');
  const map=page.locator('#damage-survey img');
  await map.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const image=document.querySelector('#damage-survey img');return image.complete&&image.naturalWidth===0;});
  assert.ok((await page.locator('#damage-survey').innerText()).includes('smoothed contours'));
  assert.equal(await page.locator('#damage-survey a:has-text("Original account")').getAttribute('href'),'https://www.weather.gov/oun/events-19550525');
  assert.ok(await map.getAttribute('alt'));
});
