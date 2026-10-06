import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const id='nist-joplin-radar-sequence';
const asset='assets/joplin-2011/nist-radar-sequence.png';
const source='https://www.govinfo.gov/content/pkg/GOVPUB-C13-a0ac8adb5269166f1b1e230423cf79ec/pdf/GOVPUB-C13-a0ac8adb5269166f1b1e230423cf79ec.pdf';
const figureName='Open the complete NOAA and NIST Joplin radar figure and caption';
async function observedWait(page,label,predicate,expected,options={}){
  try{await page.waitForFunction(predicate,expected,options);}
  catch(error){
    let timer,snapshot;
    try{snapshot=await Promise.race([page.evaluate(()=>({
      href:location.href.slice(0,1200),ready:document.body?.dataset.photoViewer||null,
      dialog:document.getElementById('photo-dialog')?.open??null,
      image:document.getElementById('photo-full')?.getAttribute('src')?.slice(0,300)||null,
      dimensions:[document.getElementById('photo-full')?.naturalWidth||0,document.getElementById('photo-full')?.naturalHeight||0],
      focus:document.activeElement?.id?.slice(0,100)||null
    })).catch(()=>({unavailable:true})),
      new Promise(resolve=>{timer=setTimeout(()=>resolve({unavailable:'Snapshot exceeded 500 ms'}),500);})
    ]);}finally{clearTimeout(timer);}
    console.error('Joplin radar wait failed',JSON.stringify({label,snapshot}));
    throw error;
  }
}
async function ready(page,href){
  await observedWait(page,'ready',expected=>location.href===expected&&
    document.body?.dataset.photoViewer==='ready'&&Boolean(document.getElementById('photo-dialog')),href);
}
async function shown(page,href){
  await observedWait(page,'shown',expected=>{
    const dialog=document.getElementById('photo-dialog'),image=document.getElementById('photo-full');
    return location.href===expected&&document.body?.dataset.photoViewer==='ready'&&
      new URL(location.href).searchParams.get('photo')==='nist-joplin-radar-sequence'&&
      dialog?.open===true&&image?.complete===true&&!image.hidden&&
      image.naturalWidth===947&&image.naturalHeight===1326&&
      new URL(image.src).pathname.endsWith('/assets/joplin-2011/nist-radar-sequence.png');
  },href);
}
async function closed(page,href,options={}){
  await observedWait(page,'closed',expected=>location.href===expected&&
    document.body?.dataset.photoViewer==='ready'&&
    document.getElementById('photo-dialog')?.open===false,href,options);
}
function selected(href){const url=new URL(href);url.searchParams.set('photo',id);return url.href;}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');}

for(const [width,height,appearance] of [[1280,900,'light'],[390,844,'dark'],[700,320,'light']]){
  test(`Joplin radar source journey ${width}x${height} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height},hasTouch:width<800,isMobile:width<800});
    const href=base+'/joplin.html?context=radar#radar-reading';
    await page.goto(href);await ready(page,href);
    await page.locator('#reading-appearance').selectOption(appearance);
    const note=page.locator('#radar-reading'),link=note.getByRole('link',{name:figureName,exact:true});
    const image=link.locator('img');await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode());
    assert.deepEqual(await image.evaluate(i=>[i.naturalWidth,i.naturalHeight]),[947,1326]);
    assert.match(await note.textContent(),/1.5 kilometers above the ground/);
    assert.match(await note.textContent(),/not raw radar data or an optical photograph/);
    await fits(page);await link.focus();await page.keyboard.press('Enter');await shown(page,selected(href));
    assert.match(await page.locator('#photo-credit').textContent(),/NOAA radar images, enhanced by NIST/);
    assert.match(await page.locator('#photo-location').textContent(),/source-reported UTC radar labels/);
    assert.doesNotMatch(await page.locator('#photo-credit').textContent(),/embedded photograph/);
    assert.equal(await page.locator('#photo-source').getAttribute('href'),source+'#page=93');
    assert.equal(await page.locator('#photo-original').textContent(),'Open the complete radar figure and caption');
    assert.equal(await page.locator('#photo-license').getAttribute('href'),source+'#page=4');
    if(width===390){
      await page.locator('#photo-dialog').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('h2,p,button,a')];
        const sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
        nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
      });
      assert.ok(await page.locator('#photo-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+1),'Doubled modal text stays inside the viewer');
      await page.keyboard.press('Escape');
      await closed(page,href);
      await link.tap();await shown(page,selected(href));
    }
    await page.goBack();await closed(page,href);
    await page.waitForFunction(()=>document.activeElement?.dataset.photoId==='nist-joplin-radar-sequence');
    await page.goForward();await shown(page,selected(href));await page.keyboard.press('Escape');
    await closed(page,href);
    assert.equal(new URL(page.url()).searchParams.get('context'),'radar');
    await note.getByRole('link',{name:'Inspect the radar record, credits and limits',exact:true}).click();
    const card=page.locator('#media-'+id);await card.waitFor();
    assert.match(await card.textContent(),/assertionsource reported/);
    await card.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    await page.locator('#source-'+id).waitFor();
    assert.match(await page.locator('#source-'+id).textContent(),/NOAA/);
    await page.goBack();await card.waitFor();await page.goBack();await ready(page,href);
    const scales=await note.evaluate(note=>[...note.querySelectorAll('h3,p,figcaption')].map(node=>{
      const before=parseFloat(getComputedStyle(node).fontSize);node.style.fontSize=before*2+'px';
      return [before,parseFloat(getComputedStyle(node).fontSize)];
    }));
    for(const [before,after] of scales)assert.equal(after,before*2);
    await fits(page);
    if(process.env.ATLAS_SCREENSHOT_DIR){await note.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`joplin-radar-${width}-${appearance}.png`)});}
  });
}

test('direct radar enlargement closes without losing the surrounding URL',async t=>{
  const page=await fixture(t),href=base+'/joplin.html?context=radar#radar-reading';
  await page.goto(selected(href));await shown(page,selected(href));
  await page.locator('#photo-close').click();await closed(page,href);
  assert.equal(new URL(page.url()).searchParams.get('context'),'radar');
  assert.equal(new URL(page.url()).searchParams.has('photo'),false);
  assert.equal(new URL(page.url()).hash,'#radar-reading');
});

test('failed radar loading preserves provenance and retries the selected figure',async t=>{
  const page=await fixture(t);let failing=true;
  await page.route('**/'+asset,route=>failing?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  const href=base+'/joplin.html#radar-reading';
  await page.goto(selected(href));await ready(page,selected(href));
  await page.locator('#photo-retry').waitFor({state:'visible'});
  assert.match(await page.locator('#photo-credit').textContent(),/NOAA/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),source+'#page=93');
  failing=false;await page.locator('#photo-retry').click();await shown(page,selected(href));
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
});

test('radar closed readiness rejects the wrong route and a missing dialog',async t=>{
  const page=await fixture(t),href=base+'/joplin.html?context=radar#radar-reading';
  await page.goto(base+'/joplin.html?context=other#radar-reading');
  await ready(page,page.url());
  await assert.rejects(closed(page,href,{timeout:250}),error=>error.name==='TimeoutError');
  await page.goto(href);await ready(page,href);
  await page.locator('#photo-dialog').evaluate(dialog=>dialog.remove());
  await assert.rejects(closed(page,href,{timeout:250}),error=>error.name==='TimeoutError');
  await page.reload();await ready(page,href);await closed(page,href);
});
