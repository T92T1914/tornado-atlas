import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture,base} from './harness.mjs';
import {settledFragment} from './fragment-ready.mjs';
import {noScriptImage} from './no-script-image.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

const items=[
  {id:'nws-joplin-high-school-aftermath',file:'nws-high-school-aftermath.jpg',width:1024,height:768,
   anchor:'school-refuge',title:/High School/,limit:/does not identify the designated refuge areas/},
  {id:'nws-joplin-st-johns-aftermath',file:'nws-st-johns-aftermath.jpg',width:3888,height:2592,
   anchor:'hospital-services',title:/St. John's/,limit:/does not show internal service conditions/},
];
const ready=page=>page.waitForFunction(()=>location.pathname.endsWith('/joplin.html')&&document.body?.dataset.photoViewer==='ready');
async function exactImage(page,item){
  await page.waitForFunction(({file,width,height})=>{
    const image=document.getElementById('photo-full');
    return document.getElementById('photo-dialog')?.open&&!image.hidden&&image.complete&&
      image.naturalWidth===width&&image.naturalHeight===height&&new URL(image.currentSrc||image.src).pathname.endsWith('/'+file);
  },item);
  await page.locator('#photo-full').evaluate(async image=>{await image.decode();});
}
async function labels(page,item){
  assert.match(await page.locator('#photo-title').textContent(),item.title);
  assert.match(await page.locator('#photo-caption').textContent(),item.limit);
  assert.match(await page.locator('#photo-credit').textContent(),/photographer unestablished/);
  assert.match(await page.locator('#photo-location').textContent(),/unregistered/);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),'https://storymaps.arcgis.com/stories/d64c8d41c28949bd87478f252ac7e378');
  assert.equal(await page.locator('#photo-license').getAttribute('href'),'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.match(await page.locator('#photo-license').textContent(),/Agency-declared/);
  assert.equal(await page.locator('#photo-original').textContent(),'Open the unchanged agency-published photograph');
  assert.ok((await page.locator('#photo-original').getAttribute('href')).endsWith(item.file));
}
async function close(page,item){
  await page.keyboard.press('Escape');
  await page.waitForFunction(id=>!document.getElementById('photo-dialog').open&&!new URL(location.href).searchParams.has('photo')&&document.activeElement?.dataset.photoId===id,item.id);
}
async function capture(page,name){
  if(process.env.ATLAS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,name+'.png')});
}

for(const [width,palette] of [[320,'dark'],[1280,'light']]){
  test(`Joplin institution photographs ${width} ${palette}: history, exact resources and source return`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},reducedMotion:'reduce',hasTouch:width<600,isMobile:width<600});
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/joplin.html?context=institution#school-refuge');await ready(page);
    await page.locator('#reading-appearance').selectOption(palette);
    for(const item of items){
      const opener=page.locator(`a[data-photo-id="${item.id}"]`);await opener.click();await exactImage(page,item);await labels(page,item);
      await capture(page,`joplin-${item.id}-${width}-${palette}-viewer`);
      await close(page,item);await page.goForward();await exactImage(page,item);await labels(page,item);
      await page.goBack();await page.waitForFunction(()=>!document.getElementById('photo-dialog').open);
      assert.equal(new URL(page.url()).searchParams.get('context'),'institution');
      const mediaLink=page.locator(`a[href*="media=${item.id}"]`);
      const mediaTarget={href:await mediaLink.evaluate(a=>a.href),elementId:'media-'+item.id};
      await mediaLink.click();await waitForDossier(page,mediaTarget);
      const media=page.locator('#media-'+item.id);assert.match(await media.textContent(),/unregistered/);
      const sourceLink=media.getByRole('link',{name:'Inspect the source card',exact:true});
      const sourceTarget={href:await sourceLink.evaluate(a=>a.href),elementId:'source-nws-joplin-storymap-damage-photos'};
      await sourceLink.click();await waitForDossier(page,sourceTarget);
      assert.match(await page.locator('#source-nws-joplin-storymap-damage-photos').textContent(),/CC0/);
      await page.goBack();await waitForDossier(page,mediaTarget);await page.goBack();await ready(page);
    }
    // New agency context must not leak labels into an existing report figure.
    await page.locator('[data-photo-id="nist-west-tower"]').click();
    await exactImage(page,{file:'nist-west-tower.jpg',width:901,height:541});
    assert.equal(await page.locator('#photo-source').textContent(),'Complete source figure and caption');
    assert.match(await page.locator('#photo-license').getAttribute('href'),/#page=4$/);
    await close(page,{id:'nist-west-tower'});
    await page.locator(`[data-photo-id="${items[0].id}"]`).click();await exactImage(page,items[0]);await labels(page,items[0]);await close(page,items[0]);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('Joplin institution photograph direct entry survives reload and retains its chapter',async t=>{
  const page=await fixture(t),item=items[1];
  await page.goto(base+`/joplin.html?context=direct&photo=${item.id}#${item.anchor}`);await ready(page);await exactImage(page,item);await labels(page,item);
  await page.reload();await ready(page);await exactImage(page,item);await labels(page,item);
  await close(page,item);
  assert.equal(new URL(page.url()).searchParams.get('context'),'direct');assert.equal(new URL(page.url()).hash,'#'+item.anchor);
});

test('Joplin school photograph is reachable by ordinary Tab traversal with visible focus',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},reducedMotion:'reduce'}),item=items[0];
  await page.goto(base+'/joplin.html#school-refuge');await ready(page);
  const walked=[];let reached=false;
  for(let n=0;n<160;n++){
    await page.keyboard.press('Tab');
    const active=await page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,photo:document.activeElement?.dataset.photoId,href:document.activeElement?.getAttribute('href')}));
    walked.push(active);if(active.photo===item.id){reached=true;break;}
  }
  assert.equal(reached,true,JSON.stringify(walked));t.diagnostic('Ordinary Tab route '+JSON.stringify(walked));
  const focus=await page.evaluate(()=>{const node=document.activeElement,s=getComputedStyle(node);return {visible:node.getClientRects().length>0,outline:s.outlineStyle,width:parseFloat(s.outlineWidth)};});
  assert.equal(focus.visible,true);assert.notEqual(focus.outline,'none');assert.ok(focus.width>0);
  await capture(page,'joplin-school-ordinary-tab-focus');
  await page.keyboard.press('Enter');await exactImage(page,item);await labels(page,item);await close(page,item);
});

for(const item of items){
  test(`Joplin institution failed ${item.id} keeps its identity and retries its exact image`,async t=>{
    const page=await fixture(t);let failing=true;
    await page.route('**/'+item.file,route=>failing?route.fulfill({status:503,body:'Unavailable selected Joplin photograph'}):route.continue());
    await page.goto(base+'/joplin.html');await ready(page);
    const other=items.find(i=>i.id!==item.id);
    await page.locator(`[data-photo-id="${other.id}"]`).click();await exactImage(page,other);await close(page,other);
    await page.locator(`[data-photo-id="${item.id}"]`).click();await page.locator('#photo-retry').waitFor({state:'visible'});await labels(page,item);
    assert.equal(await page.locator('#photo-full').isVisible(),false);
    assert.ok((await page.locator('#photo-full').getAttribute('src')).endsWith(item.file));
    await capture(page,'joplin-'+item.id+'-failure');
    failing=false;await page.locator('#photo-retry').click();await exactImage(page,item);await labels(page,item);
    assert.equal(await page.locator('#photo-failure').isVisible(),false);await close(page,item);
  });
}

test('Joplin institution photographs retain static reading and nonblank originals without scripts',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844}});
  await page.goto(base+'/joplin.html#school-refuge');
  await settledFragment(page,'school-refuge',items[0].id);
  for(const item of items){
    const opener=page.locator(`[data-photo-id="${item.id}"]`);await opener.scrollIntoViewIfNeeded();
    assert.match(await opener.locator('..').textContent(),item.limit);
    await noScriptImage(opener.locator('img'),{...item,source:base+'/assets/joplin-2011/'+item.file},process.env.ATLAS_SCREENSHOT_DIR&&path.join(process.env.ATLAS_SCREENSHOT_DIR,`joplin-${item.id}-nojs.png`));
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const item=items[0];await page.locator(`[data-photo-id="${item.id}"]`).click();
  await page.waitForURL(url=>url.pathname.endsWith(item.file));await page.goBack();
  assert.equal(new URL(page.url()).hash,'#school-refuge');
});

test('Joplin institution reading and viewer retain doubled text in a short viewport',async t=>{
  const page=await fixture(t,{viewport:{width:568,height:320},reducedMotion:'reduce'}),item=items[1];
  await page.goto(base+'/joplin.html#hospital-services');await ready(page);
  await page.locator('#hospital-services').evaluate(section=>{
    const nodes=[...section.querySelectorAll('h2,h3,p,figcaption,a')];const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));
    nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');
  });
  await page.locator(`[data-photo-id="${item.id}"]`).scrollIntoViewIfNeeded();await capture(page,'joplin-hospital-doubled-reading');
  const caption=page.locator(`[data-photo-id="${item.id}"]`).locator('..').locator('figcaption');
  await caption.scrollIntoViewIfNeeded();await capture(page,'joplin-hospital-doubled-caption');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator(`[data-photo-id="${item.id}"]`).click();await exactImage(page,item);
  await page.locator('#photo-dialog').evaluate(dialog=>{
    const nodes=[...dialog.querySelectorAll('h2,p,a,button')];const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*2+'px');
  });
  const layout=await page.locator('#photo-dialog').evaluate(d=>({client:d.clientWidth,scroll:d.scrollWidth,height:d.clientHeight,scrollHeight:d.scrollHeight}));
  assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));assert.ok(layout.scrollHeight>=layout.height);
  await labels(page,item);await capture(page,'joplin-hospital-doubled-viewer');
  await page.locator('#photo-caption').scrollIntoViewIfNeeded();await capture(page,'joplin-hospital-doubled-viewer-caption');
  await page.locator('#photo-license').scrollIntoViewIfNeeded();
  const linkVisible=await page.locator('#photo-license').evaluate(link=>{
    const r=link.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#photo-license')===link;
  });
  assert.equal(linkVisible,true);await capture(page,'joplin-hospital-doubled-viewer-source-links');await close(page,item);
});
