import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, base} from './harness.mjs';
import {settledFragment} from './fragment-ready.mjs';
import {noScriptImage} from './no-script-image.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

const id='usace-joplin-debris-coordination',file='usace-debris-coordination-preview.webp';
const source='https://www.dvidshub.net/image/423630/removing-joplin-tornado-debris-july-4';
const policy='https://www.dvidshub.net/about/copyright';
const notice='The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement.';
const ready=page=>page.waitForFunction(()=>location.pathname.endsWith('/joplin.html') &&
  document.body?.dataset.photoViewer==='ready' && Boolean(document.getElementById('photo-dialog')));

async function decoded(image,name=file,width=1000,height=716) {
  const deadline=performance.now()+10000;
  let timer;
  try {
    await image.page().waitForFunction(({selector,name,width,height})=>{
      const image=document.querySelector(selector);
      return image?.isConnected && image.complete && image.naturalWidth===width &&
        image.naturalHeight===height && new URL(image.currentSrc||image.src).pathname.endsWith('/'+name);
    },{selector:await image.evaluate(image=>image.id ? '#'+image.id :
      `a[data-photo-id="${image.closest('a').dataset.photoId}"] img`),name,width,height},
    {timeout:Math.max(1,deadline-performance.now())});
    assert.ok(performance.now()<deadline,'Expected preview readiness must stay within its 10-second bound');
    await Promise.race([image.evaluate(async (image,{name,width,height})=>{
      const original=image.currentSrc||image.src;
      const expected=()=>image.isConnected && image.complete && image.naturalWidth===width &&
        image.naturalHeight===height && new URL(image.currentSrc||image.src).pathname.endsWith('/'+name);
      if(!expected()) throw Error('Expected preview changed before decode');
      await image.decode();
      if(!expected() || (image.currentSrc||image.src)!==original) throw Error('Expected preview changed during decode');
    },{name,width,height}),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('Expected preview decode exceeded its 10-second bound')),
        Math.max(1,deadline-performance.now()));
    })]);
    assert.ok(performance.now()<deadline,'Expected preview decode must stay within its 10-second bound');
  } finally {clearTimeout(timer);}
}
async function shown(page) {
  await page.locator('#photo-dialog').waitFor({state:'visible'});
  await decoded(page.locator('#photo-full'));
}
async function labels(page) {
  assert.equal(await page.locator('#photo-title').textContent(),'Coordinating debris removal after the tornado');
  const credit=await page.locator('#photo-credit').textContent();
  for(const value of ['Andrew Stamer','Kansas City District','provider display preview','not the full-resolution original',notice])
    assert.ok(credit.includes(value),value);
  const location=await page.locator('#photo-location').textContent();
  for(const value of ['July 4, 2011','19:47','separate clock','unestablished','unregistered'])
    assert.ok(location.includes(value),value);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),source);
  assert.equal(await page.locator('#photo-source').textContent(),'Primary photograph record, credit and reuse terms');
  assert.equal(await page.locator('#photo-license').getAttribute('href'),policy);
  assert.equal(await page.locator('#photo-original').textContent(),'Open the retained provider display preview');
  assert.ok((await page.locator('#photo-original').getAttribute('href')).endsWith('/'+file));
}
async function closed(page,selected=id) {
  await page.waitForFunction(selected=>!document.getElementById('photo-dialog')?.open &&
    !new URL(location.href).searchParams.has('photo') && document.activeElement?.dataset.photoId===selected,selected);
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]) {
  test(`Joplin debris coordination: ${width}px ${appearance}, preview, history and source record`,{timeout:45000},async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600,reducedMotion:'reduce'});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/joplin.html?response=notes#debris-removal');await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const account=await page.locator('#debris-removal').textContent();
    for(const value of ['FEMA-assigned debris removal','rather than visual identification',notice])
      assert.ok(account.includes(value),value);
    const opener=page.locator(`[data-photo-id="${id}"]`);
    await opener.scrollIntoViewIfNeeded();await decoded(opener.locator('img'));
    if(width<600) await opener.tap();else {await opener.focus();await page.keyboard.press('Enter');}
    await shown(page);await labels(page);
    await page.keyboard.press('Escape');await closed(page);
    assert.equal(new URL(page.url()).searchParams.get('response'),'notes');
    assert.equal(new URL(page.url()).hash,'#debris-removal');
    await page.goForward();await shown(page);await labels(page);
    await page.goBack();await closed(page);
    // The older original must recover its original-file source and enlargement labels.
    await page.locator('[data-photo-id="nws-joplin-aftermath"]').click();
    await decoded(page.locator('#photo-full'),'damage.jpg',1024,768);
    assert.equal(await page.locator('#photo-original').textContent(),'Open the unchanged original photograph');
    assert.equal(await page.locator('#photo-source').textContent(),'Inspect the original file, credit and reuse record');
    await page.keyboard.press('Escape');await closed(page,'nws-joplin-aftermath');
    const link=page.locator(`#debris-removal a[href*="media=${id}"]`);
    const target={href:await link.evaluate(link=>link.href),elementId:'media-'+id};
    await link.click();await waitForDossier(page,target);
    const card=page.locator('#media-'+id);
    assert.match(await card.textContent(),/not the source-reported 3376 by 2418 original/);
    await card.getByText('Clock roles and registration',{exact:true}).click();
    assert.match(await card.textContent(),/19:47/);
    await card.getByRole('link',{name:'Inspect the source card',exact:true}).click();
    const record=await page.locator('#source-dvids-joplin-debris-coordination').textContent();
    for(const value of ['423630','PUBLIC DOMAIN','Register/Login','was not requested',notice])
      assert.ok(record.includes(value),value);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('Joplin debris preview direct link reload and close preserve the account URL',{timeout:45000},async t=>{
  const page=await fixture(t);
  await page.goto(base+`/joplin.html?response=direct&photo=${id}#debris-removal`);await ready(page);await shown(page);await labels(page);
  await page.reload();await ready(page);await shown(page);await labels(page);
  await page.locator('#photo-close').click();await closed(page);
  assert.equal(new URL(page.url()).searchParams.get('response'),'direct');
  assert.equal(new URL(page.url()).hash,'#debris-removal');
});

test('Joplin debris preview 503 preserves the correct notice and recovers through Retry',{timeout:45000},async t=>{
  const page=await fixture(t);let failing=true,failures=0;
  await page.route('**/'+file,route=>{
    if(failing){failures++;return route.fulfill({status:503,body:'Unavailable'});}
    return route.continue();
  });
  await page.goto(base+'/joplin.html#debris-removal');await ready(page);
  await page.locator('[data-photo-id="nws-joplin-aftermath"]').click();
  await decoded(page.locator('#photo-full'),'damage.jpg',1024,768);
  const previous=await page.locator('#photo-full').elementHandle();
  await page.keyboard.press('Escape');await closed(page,'nws-joplin-aftermath');
  await page.locator(`[data-photo-id="${id}"]`).click();
  await page.locator('#photo-retry').waitFor({state:'visible'});await labels(page);
  assert.equal(await previous.evaluate(image=>image.isConnected),false);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/hard hats/);
  assert.ok(failures>=1,'An actual matching 503 must reach the preview failure state');
  failing=false;await page.locator('#photo-retry').click();await shown(page);await labels(page);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  await page.locator('#photo-close').click();await closed(page);
});

test('Joplin debris response has a no-script account and inline WebP source route',{timeout:45000},async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844}});
  await page.goto(base+'/joplin.html#debris-removal');
  const text=await page.locator('#debris-removal').textContent();
  for(const value of ['quality-assurance','July 4, 2011','provider display preview','No precise camera position',notice])
    assert.ok(text.includes(value),value);
  assert.equal(await page.locator('#source-usace-debris a[href="'+source+'"]').count(),1);
  const opener=page.locator(`[data-photo-id="${id}"]`);
  await settledFragment(page,'debris-removal',id);
  await opener.scrollIntoViewIfNeeded();
  await noScriptImage(opener.locator('img'),{source:base+'/assets/joplin-2011/'+file,width:1000,height:716});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await opener.focus();
  const [response]=await Promise.all([page.waitForResponse(response=>response.url()===base+'/assets/joplin-2011/'+file),
    Promise.all([page.waitForURL(url=>url.pathname.endsWith('/'+file)),page.keyboard.press('Enter')])]);
  assert.equal(response.headers()['content-type'],'image/webp');
});

test('Joplin debris notice remains reachable at doubled text in short landscape',{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:568,height:320},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await page.goto(base+`/joplin.html?photo=${id}#debris-removal`);await ready(page);await shown(page);await labels(page);
  await page.locator('#photo-dialog').evaluate(dialog=>{
    const nodes=[...dialog.querySelectorAll('h2,p,a,button')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
  });
  const size=await page.locator('#photo-dialog').evaluate(dialog=>({width:dialog.clientWidth,scroll:dialog.scrollWidth}));
  assert.ok(size.scroll<=size.width+1,JSON.stringify(size));
  await page.locator('#photo-license').scrollIntoViewIfNeeded();assert.equal(await page.locator('#photo-license').isVisible(),true);
  assert.ok((await page.locator('#photo-credit').textContent()).includes(notice));
  await page.locator('#photo-close').click();await closed(page);
});
