import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const pairs=[
  {id:'kbmx-reflectivity-county-crossing',file:'kbmx-reflectivity-2238.gif',width:755,height:583},
  {id:'kbmx-storm-relative-velocity-county-crossing',file:'kbmx-storm-relative-velocity-2238.gif',width:756,height:567},
];
const source='https://www.weather.gov/bmx/event_04272011tuscbirm';
async function ready(page){await page.waitForFunction(()=>document.body?.dataset.photoViewer==='ready');}
async function shown(page,row){await page.waitForFunction(row=>{
  const img=document.getElementById('photo-full');
  return document.getElementById('photo-dialog').open&&!img.hidden&&img.naturalWidth===row.width&&img.naturalHeight===row.height;
},row);}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal document overflow');}

for(const [width,height,appearance] of [[320,844,'dark'],[390,844,'light'],[1280,900,'dark'],[1280,900,'light'],[700,320,'light']]){
  test(`Tuscaloosa original radar journey ${width}x${height} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height},hasTouch:width<800,isMobile:width<800,reducedMotion:'reduce'});
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/tuscaloosa.html?context=radar#evidence');await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const section=page.locator('#evidence');
    assert.match(await section.textContent(),/two single-frame images/);
    assert.match(await section.textContent(),/no timestamp, units or color key/);
    if(process.env.ATLAS_SCREENSHOT_DIR){await section.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-gallery-${width}-${height}-${appearance}.png`)});}
    for(const row of pairs){
      const link=page.locator(`[data-photo-id="${row.id}"]`),image=link.locator('img');
      await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());
      assert.deepEqual(await image.evaluate(img=>[img.naturalWidth,img.naturalHeight]),[row.width,row.height]);
      await link.focus();await page.keyboard.press('Enter');await shown(page,row);
      assert.equal(new URL(page.url()).searchParams.get('photo'),row.id);
      assert.equal(await page.locator('#photo-source').getAttribute('href'),source);
      assert.match(await page.locator('#photo-credit').textContent(),/not subject to copyright protection/);
      assert.match(await page.locator('#photo-location').textContent(),/No independent alignment/);
      assert.equal(await page.locator('#photo-license').getAttribute('href'),'https://www.weather.gov/disclaimer');
      assert.ok((await page.locator('#photo-original').getAttribute('href')).endsWith(row.file));
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&!new URL(location.href).searchParams.has('photo'));
      await page.waitForFunction(id=>document.activeElement?.dataset.photoId===id,row.id);
      await page.goForward();await shown(page,row);await page.goBack();
      await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
      assert.equal(new URL(page.url()).hash,'#evidence');
      assert.equal(new URL(page.url()).searchParams.get('context'),'radar');
    }
    if(width===320){
      const link=page.locator(`[data-photo-id="${pairs[0].id}"]`);
      await link.tap();await shown(page,pairs[0]);
      await page.locator('#photo-dialog').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('h2,p,a,button')];
        const baseline=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,i)=>node.style.fontSize=baseline[i]*2+'px');
      });
      const layout=await page.locator('#photo-dialog').evaluate(dialog=>({
        client:dialog.clientWidth,scroll:dialog.scrollWidth,
        text:[...dialog.querySelectorAll('h2,p,a,button')].map(node=>({
          text:node.textContent,client:node.clientWidth,scroll:node.scrollWidth,
          font:getComputedStyle(node).fontFamily,wrap:getComputedStyle(node).overflowWrap,
        })).filter(row=>row.scroll>row.client+1),
      }));
      assert.ok(layout.scroll<=layout.client+1,`Doubled viewer text fits: ${JSON.stringify(layout)}`);
      await page.locator('#photo-close').click();await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
    }
    const record=section.getByRole('link',{name:'Inspect the reflectivity record, credits and limits',exact:true});
    await record.click();await page.waitForFunction(()=>document.body?.dataset.ready==='true');
    const media=page.locator('#media-'+pairs[0].id);await media.waitFor();
    assert.match(await media.textContent(),/permitted hosting/);
    assert.match(await media.textContent(),/unregistered/);
    await media.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    await page.locator('#source-bmx-kbmx-radar-pair').waitFor();
    await page.goBack();await media.waitFor();await page.goBack();await ready(page);
    await section.evaluate(section=>{
      const nodes=[...section.querySelectorAll('h2,h3,p,figcaption,summary')];
      const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,i)=>node.style.fontSize=sizes[i]*2+'px');
    });
    await fits(page);
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false,'Originals and viewer load locally without external requests');
    if(process.env.ATLAS_SCREENSHOT_DIR){await section.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`tuscaloosa-radar-${width}-${height}-${appearance}.png`)});}
  });
}

test('direct radar URL closes locally while preserving other URL state',async t=>{
  const page=await fixture(t);await page.goto(base+'/tuscaloosa.html?context=radar&photo='+pairs[1].id+'#evidence');await shown(page,pairs[1]);
  await page.locator('#photo-close').click();await page.waitForFunction(()=>!document.getElementById('photo-dialog').open&&!new URL(location.href).searchParams.has('photo'));
  assert.equal(new URL(page.url()).searchParams.get('context'),'radar');assert.equal(new URL(page.url()).hash,'#evidence');
});

test('failed radar preserves source and description and retries the selected original',async t=>{
  const page=await fixture(t);let failing=true;
  await page.route('**/'+pairs[0].file,route=>failing?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/tuscaloosa.html?photo='+pairs[0].id+'#evidence');await ready(page);
  await page.locator('#photo-retry').waitFor({state:'visible'});
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/Bull City/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),source);
  failing=false;await page.locator('#photo-retry').click();await shown(page,pairs[0]);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
});

test('readable descriptions and keyboard original image links survive without JavaScript',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844}});
  await page.goto(base+'/tuscaloosa.html#evidence');
  assert.match(await page.locator('#evidence').textContent(),/no timestamp, units or color key/);
  const link=page.locator(`[data-photo-id="${pairs[0].id}"]`);
  await link.focus();
  await Promise.all([page.waitForURL(url=>url.pathname.endsWith(pairs[0].file)),page.keyboard.press('Enter')]);
});
