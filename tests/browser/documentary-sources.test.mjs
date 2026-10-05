import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

async function sources(page){
  const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
  const source={...data.footage.sources[0],id:'synthetic-source-b',creator:'Synthetic source B',video_id:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk'};
  const anchor={...data.footage.anchors[0],id:'synthetic-b-coincident',source_id:source.id,video_seconds:20,note:'Authored source identity fixture, not another historical observation.'};
  const later={...anchor,id:'synthetic-b-only',utc:'2013-05-31T23:17:07Z',video_seconds:24};
  data.footage.sources.push(source);data.footage.anchors.splice(1,0,anchor,later);
  await page.route('**/data.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)}));
}
const camera=page=>page.locator('#evidence-desk .evidence-cards article').nth(2);
async function ready(page,path){await page.goto(base+path);await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');}
async function state(page){return page.evaluate(()=>{
  const button=document.querySelector('[data-anchor="synthetic-b-only"]'),rect=button?.getBoundingClientRect();
  return {url:location.href,source:document.querySelector('#footage-source')?.value,
    timeline:document.querySelector('#timeline')?.value,ready:document.body?.dataset.exhibitReady,
    contentsOpen:document.querySelector('#exhibit-contents')?.open,visibility:document.visibilityState,
    error:document.querySelector('#error')?.textContent,clicks:window.fixtureClicks||[],
    button:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null};
});}
async function clock(page,value){
  try{await page.waitForFunction(value=>document.querySelector('#timeline')?.value===String(value),value);}
  catch(error){error.message+='\nExhibit state: '+JSON.stringify(await state(page));throw error;}
}

for(const width of [1280,390])test(`documentary interactions wait for delayed reader layout at ${width}px`,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000}});await sources(page);
  let release,requested;
  const held=new Promise(resolve=>{release=resolve;}),request=new Promise(resolve=>{requested=resolve;});
  t.after(release);
  await page.route('**/reader-view.mjs',async route=>{requested();await held;await route.continue();});
  await page.goto(base+'/index.html?t=783',{waitUntil:'domcontentloaded'});await request;
  assert.equal(await page.locator('#timeline').isDisabled(),true,'Playback stays unavailable while reader layout is pending');
  assert.notEqual(await page.evaluate(()=>document.body.dataset.exhibitReady),'true');
  release();await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');
  assert.equal(await page.locator('#exhibit-contents').evaluate(contents=>contents.open),width>1080);
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  await page.evaluate(()=>{
    window.fixtureClicks=[];
    document.querySelector('[data-anchor="synthetic-b-only"]').addEventListener('click',event=>{
      window.fixtureClicks.push({trusted:event.isTrusted,timeline:document.querySelector('#timeline').value});
    });
  });
  await page.locator('[data-anchor="synthetic-b-only"]').click();await clock(page,787);
  assert.deepEqual((await state(page)).clicks,[{trusted:true,timeline:'787'}]);
  assert.equal(new URL(page.url()).searchParams.get('footage'),'synthetic-b-only');
});

test('failed reader initialization keeps playback unavailable and reports the error',async t=>{
  const page=await fixture(t);
  await page.route('**/reader-view.mjs',route=>route.fulfill({status:503,contentType:'text/javascript',body:''}));
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='error');
  assert.equal(await page.locator('#timeline').isDisabled(),true);
  assert.equal(await page.locator('#error').isVisible(),true);
  assert.ok((await page.locator('#error').textContent()).length>0);
});

test('malformed section hash leaves the exhibit usable and preserves manual contents choice',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:1000}});
  await ready(page,'/index.html#%E0%A4%A');
  const contents=page.locator('#exhibit-contents');
  assert.equal(await contents.evaluate(element=>element.open),false);
  await contents.locator('summary').click();
  assert.equal(await contents.evaluate(element=>element.open),true);
  await page.locator('#timeline').fill('783');await clock(page,783);
  assert.equal(await contents.evaluate(element=>element.open),true);
  await contents.locator('summary').click();
  assert.equal(await contents.evaluate(element=>element.open),false);
  await page.setViewportSize({width:1280,height:1000});
  await page.waitForFunction(()=>document.querySelector('#exhibit-contents').open);
  await page.setViewportSize({width:390,height:1000});
  await page.waitForFunction(()=>!document.querySelector('#exhibit-contents').open);
});

for(const width of [1280,390])test(`documentary source identity and history survive at ${width}px`,async t=>{
  const page=await fixture(t,{viewport:{width,height:1000}});await sources(page);
  await ready(page,'/index.html?t=783');
  assert.match(await camera(page).textContent(),/Dan Robinson/);
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  assert.match(await camera(page).textContent(),/Synthetic source B/);assert.doesNotMatch(await camera(page).textContent(),/Dan Robinson/);
  await page.locator('[data-anchor="synthetic-b-only"]').click();await clock(page,787);
  assert.match(await camera(page).textContent(),/Synthetic source B/);
  assert.equal(new URL(page.url()).searchParams.get('footage'),'synthetic-b-only');
  await page.goBack();await clock(page,783);
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  await page.goBack();await clock(page,783);
  assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  assert.match(await camera(page).textContent(),/Dan Robinson/);
  await page.goForward();assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  await page.goForward();await clock(page,787);
  await page.locator('#timeline').fill('782');
  assert.match(await camera(page).textContent(),/No checked video frame/);
  await page.locator('#footage-source').selectOption('robinson-dashcam');
  await page.goBack();await clock(page,782);
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  await page.reload();await page.waitForFunction(()=>document.body?.dataset.exhibitReady==='true');await clock(page,782);
  assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(await page.locator('#registered-footage iframe').count(),0);
  assert.equal(await page.locator('#play').textContent(),'Play timeline');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

test('documentary gap source history preserves exact fractional time',async t=>{
  const page=await fixture(t);await sources(page);await ready(page,'/index.html?t=782.25&context=kept');
  assert.equal(new URL(page.url()).searchParams.get('t'),'782.25');
  await page.locator('#footage-source').selectOption('synthetic-source-b');
  assert.equal(new URL(page.url()).searchParams.get('t'),'782.25');
  await page.goBack();assert.equal(await page.locator('#footage-source').inputValue(),'robinson-dashcam');
  assert.equal(new URL(page.url()).searchParams.get('t'),'782.25');
  await page.goForward();assert.equal(await page.locator('#footage-source').inputValue(),'synthetic-source-b');
  assert.equal(new URL(page.url()).searchParams.get('t'),'782.25');
  assert.equal(new URL(page.url()).searchParams.get('context'),'kept');
  assert.equal(new URL(page.url()).searchParams.has('event'),false);
});
