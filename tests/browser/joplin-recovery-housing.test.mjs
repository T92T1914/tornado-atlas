import test from 'node:test';
import assert from 'node:assert/strict';
import {settledFragment} from './fragment-ready.mjs';
import {noScriptImage} from './no-script-image.mjs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture, base} from './harness.mjs';

const id='usace-joplin-temporary-housing', file='usace-temporary-housing.jpg';
const source='https://commons.wikimedia.org/wiki/File:First_FEMA_modular_homes_arrive_in_Joplin_(5967939747).jpg';
const license='https://creativecommons.org/licenses/by/2.0/';
const ready=page=>page.waitForFunction(()=>location.pathname.endsWith('/joplin.html') &&
  document.body.dataset.photoViewer==='ready' && !!document.getElementById('photo-dialog'));
async function decode(locator,name=file,width=1280,height=569,dialog=false) {
  // Scrolling can start a lazy request. Load readiness and one decode share
  // the original 10-second budget, including the enlarged dialog's readiness.
  const expected={source:base+'/assets/joplin-2011/'+name,width,height,dialog};
  const deadline=performance.now()+10000;
  let timer,stopped=false,last;
  const operation=(async()=>{
    while(!stopped&&performance.now()<deadline){
      last=await locator.evaluate((image,{dialog})=>({connected:image.isConnected,
        complete:image.complete,width:image.naturalWidth,height:image.naturalHeight,
        source:image.currentSrc||image.src,
        shown:!dialog||(document.getElementById('photo-dialog')?.open&&!image.hidden)}),expected);
      if(stopped||performance.now()>=deadline)
        throw Error('Expected image did not load and decode within 10000ms: '+JSON.stringify(last));
      if(last.connected&&last.complete&&last.width===width&&last.height===height&&
          last.source===expected.source&&last.shown){
        await locator.evaluate(async(image,{source,width,height,dialog})=>{
          const matches=()=>image.isConnected&&image.complete&&image.naturalWidth===width&&
            image.naturalHeight===height&&(image.currentSrc||image.src)===source&&
            (!dialog||(document.getElementById('photo-dialog')?.open&&!image.hidden));
          if(!matches())throw Error('Expected image changed before decode');
          await image.decode();
          if(!matches())throw Error('Expected image changed during decode');
        },expected);
        if(stopped||performance.now()>=deadline)throw Error('Expected image decode exceeded its 10000ms bound');
        return;
      }
      const remaining=deadline-performance.now();
      if(remaining>0)await delay(Math.min(25,remaining));
    }
    throw Error('Expected image did not load and decode within 10000ms: '+JSON.stringify(last));
  })();
  try{
    await Promise.race([operation,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('Expected image did not load and decode within 10000ms: '+
        JSON.stringify(last))),Math.max(1,deadline-performance.now()));
    })]);
  }finally{stopped=true;clearTimeout(timer);}
}
async function shown(page,name=file,width=1280,height=569) {
  await decode(page.locator('#photo-full'),name,width,height,true);
}
async function labels(page) {
  assert.equal(await page.locator('#photo-title').textContent(),'Temporary housing arrived after the storm');
  const credit=await page.locator('#photo-credit').textContent();
  for(const text of ['Mark Haviland','Kansas City District','Tyler ser Noche','September 4, 2018','CC BY 2.0','separate Commons federal public-domain assertion','Full frame resized'])
    assert.ok(credit.includes(text),text);
  const place=await page.locator('#photo-location').textContent();
  for(const text of ['Officer Jeff Taylor Memorial Acres','8:39 a.m.','10:24:01','unverified','unregistered'])
    assert.ok(place.includes(text),text);
  assert.equal(await page.locator('#photo-source').getAttribute('href'),source);
  assert.equal(await page.locator('#photo-license').getAttribute('href'),license);
  assert.equal(await page.locator('#photo-original').textContent(),'Open the full-frame resized photograph');
  assert.ok((await page.locator('#photo-original').getAttribute('href')).endsWith('/'+file));
  assert.equal(/unchanged original|National Weather Service|NIST/.test(credit),false);
}
async function closed(page,selected=id) {
  await page.waitForFunction(selected=>{
    const dialog=document.getElementById('photo-dialog');
    return dialog && !dialog.open && !new URL(location.href).searchParams.has('photo') &&
      document.activeElement?.dataset.photoId===selected;
  },selected);
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]) {
  test(`Joplin housing recovery: ${width}px ${appearance}, enlargement, history and source records`,{timeout:45000},async t=>{
    const page=await fixture(t,{viewport:{width,height:844},hasTouch:width<600,isMobile:width<600,reducedMotion:'reduce'});
    const requests=[];page.on('request',request=>requests.push(request.url()));
    await page.goto(base+'/joplin.html?recovery=caption#recovery');await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.match(await page.locator('#recovery').textContent(),/planned capacity of the two sites together/);
    const opener=page.locator(`[data-photo-id="${id}"]`);
    await opener.scrollIntoViewIfNeeded();await decode(opener.locator('img'));
    if(width<600) await opener.tap();else {await opener.focus();await page.keyboard.press('Enter');}
    await shown(page);await labels(page);
    if(process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`joplin-housing-${width}-${appearance}.png`)});
    await page.keyboard.press('Escape');await closed(page);
    assert.equal(new URL(page.url()).searchParams.get('recovery'),'caption');
    assert.equal(new URL(page.url()).hash,'#recovery');
    await page.goForward();await shown(page);await labels(page);
    await page.goBack();await closed(page);
    // The original aftermath item must reset the housing derivative label and credit.
    await page.locator('[data-photo-id="nws-joplin-aftermath"]').click();await shown(page,'damage.jpg',1024,768);
    assert.match(await page.locator('#photo-credit').textContent(),/National Weather Service Springfield/);
    assert.equal(await page.locator('#photo-original').textContent(),'Open the unchanged original photograph');
    await page.keyboard.press('Escape');await closed(page,'nws-joplin-aftermath');
    await Promise.all([page.waitForURL(url=>url.pathname.endsWith('/dossier.html')&&url.searchParams.get('media')===id),
      page.locator(`#recovery a[href*="media=${id}"]`).click()]);
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
    const media=page.locator('#media-'+id);await media.waitFor();
    assert.match(await media.textContent(),/not unchanged original bytes or pixels/);
    assert.match(await media.textContent(),/Mark Haviland/);
    await media.getByText('Clock roles and registration',{exact:true}).click();
    assert.match(await media.textContent(),/10:24:01/);
    const card=page.locator('#source-commons-usace-joplin-housing');
    await media.getByRole('link',{name:'Inspect the source card',exact:true}).click();await card.waitFor();
    for(const text of ['911895029','CC BY 2.0','FlickreviewR 2','HTTP 404','not independently established'])
      assert.ok((await card.textContent()).includes(text),text);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(requests.some(url=>!url.startsWith(base+'/')),false);
  });
}

test('Joplin housing waits for held thumbnail pixels before its first decode',{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  let release,requested,timer;
  const held=new Promise(resolve=>{release=resolve;});
  const seen=new Promise(resolve=>{requested=resolve;});
  t.after(()=>release());
  await page.route('**/'+file,async route=>{requested();await held;await route.continue();});
  try{
    await page.goto(base+'/joplin.html#recovery');await ready(page);
    const opener=page.locator(`[data-photo-id="${id}"]`),image=opener.locator('img');
    // Observe this owned thumbnail only. Native load state, decode return and
    // original errors are unchanged. The observation dies with its context.
    await image.evaluate(image=>{
      const complete=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'complete').get;
      const nativeDecode=image.decode;
      const observation={snapshots:0,decodeCalls:[]};
      image.__housingReadiness=observation;
      Object.defineProperty(image,'complete',{configurable:true,get(){observation.snapshots++;return complete.call(this);}});
      image.decode=function(...args){
        observation.decodeCalls.push({complete:complete.call(this),width:this.naturalWidth,
          height:this.naturalHeight,source:this.currentSrc||this.src});
        return nativeDecode.apply(this,args);
      };
    });
    await opener.scrollIntoViewIfNeeded();
    const accepting=decode(image).then(()=>({error:null}),error=>({error}));
    await Promise.race([seen,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('The held housing thumbnail was not requested')),10000);
    })]);
    await page.waitForFunction(id=>{
      const observation=document.querySelector(`[data-photo-id="${id}"] img`).__housingReadiness;
      return observation.snapshots>0||observation.decodeCalls.length>0;
    },id);
    const heldState=await image.evaluate(image=>({complete:image.complete,width:image.naturalWidth,
      height:image.naturalHeight,decodeCalls:image.__housingReadiness.decodeCalls.length}));
    assert.equal(heldState.complete&&heldState.width>0,false,'Held response has not supplied image pixels');
    assert.equal(heldState.decodeCalls,0,'Decode must not start before the held thumbnail has exact ready pixels');
    release();
    const result=await accepting;if(result.error)throw result.error;
    const decodedState=await image.evaluate(image=>({dimensions:[image.naturalWidth,image.naturalHeight],
      calls:image.__housingReadiness.decodeCalls}));
    assert.deepEqual(decodedState.dimensions,[1280,569]);
    assert.deepEqual(decodedState.calls,[{complete:true,width:1280,height:569,source:base+'/assets/joplin-2011/'+file}]);
    await opener.tap();await shown(page);await labels(page);
    await page.keyboard.press('Escape');await closed(page);
  }finally{clearTimeout(timer);release();}
});

test('Joplin direct housing view reloads and closes only its own selection',{timeout:45000},async t=>{
  const page=await fixture(t);
  await page.goto(base+`/joplin.html?recovery=direct&photo=${id}#recovery`);await ready(page);await shown(page);await labels(page);
  await page.reload();await ready(page);await shown(page);await labels(page);
  await page.locator('#photo-close').click();await closed(page);
  assert.equal(new URL(page.url()).searchParams.get('recovery'),'direct');
  assert.equal(new URL(page.url()).hash,'#recovery');
});

test('Joplin housing failure retains its own source after a different aftermath image and recovers by Retry',{timeout:45000},async t=>{
  const page=await fixture(t);let failing=true,failures=0;
  // Inject before navigation so a successfully cached housing thumbnail cannot bypass the control.
  await page.route('**/'+file,route=>{
    if(failing){failures+=1;return route.fulfill({status:503,body:'Unavailable'});}
    return route.continue();
  });
  await page.goto(base+'/joplin.html#recovery');await ready(page);
  await page.locator('[data-photo-id="nws-joplin-aftermath"]').click();await shown(page,'damage.jpg',1024,768);
  const previous=await page.locator('#photo-full').elementHandle();
  await page.keyboard.press('Escape');await closed(page,'nws-joplin-aftermath');
  await page.locator(`[data-photo-id="${id}"]`).click();await page.locator('#photo-retry').waitFor({state:'visible'});await labels(page);
  assert.equal(await previous.evaluate(image=>image.isConnected),false);
  assert.equal(await page.locator('#photo-full').isVisible(),false);
  assert.ok((await page.locator('#photo-full').getAttribute('src')).endsWith('/'+file));
  assert.match(await page.locator('#photo-full').getAttribute('alt'),/orange transport truck/);
  assert.ok(failures>=1,'An actual matching 503 must be observed');
  failing=false;await page.locator('#photo-retry').click();await shown(page);await labels(page);
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
  assert.equal(await page.locator('#photo-retry').isVisible(),false);
  await page.locator('#photo-close').click();await closed(page);
});

test('Joplin housing account and full-frame image remain useful without JavaScript',{timeout:45000},async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:844}});
  await page.goto(base+'/joplin.html#recovery');
  const text=await page.locator('#recovery').textContent();
  for(const value of ['July 23, 2011','Mark Haviland','two sites together','not a count of homes occupied','8:39 a.m.','10:24:01'])
    assert.ok(text.includes(value),value);
  assert.equal(await page.locator('#recovery a[href="'+license+'"]').count(),1);
  assert.equal(await page.locator('#source-usace-housing a[href="'+source+'"]').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const opener=page.locator(`[data-photo-id="${id}"]`);
  await settledFragment(page, 'recovery', id);
  await opener.scrollIntoViewIfNeeded();
  await noScriptImage(opener.locator('img'),{source:base+'/assets/joplin-2011/'+file,width:1280,height:569},
    process.env.ATLAS_SCREENSHOT_DIR && path.join(process.env.ATLAS_SCREENSHOT_DIR,'joplin-housing-no-script.png'));
  await opener.focus();
  await Promise.all([page.waitForURL(url=>url.pathname.endsWith('/'+file)),page.keyboard.press('Enter')]);
});

test('Joplin housing attribution stays reachable at doubled text in short landscape',{timeout:45000},async t=>{
  const page=await fixture(t,{viewport:{width:568,height:320},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await page.goto(base+`/joplin.html?photo=${id}#recovery`);await ready(page);await shown(page);await labels(page);
  await page.locator('#photo-dialog').evaluate(dialog=>{
    const nodes=[...dialog.querySelectorAll('h2,p,a,button')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>node.style.fontSize=sizes[index]*2+'px');
  });
  const layout=await page.locator('#photo-dialog').evaluate(dialog=>({client:dialog.clientWidth,scroll:dialog.scrollWidth,height:dialog.clientHeight,scrollHeight:dialog.scrollHeight}));
  assert.ok(layout.scroll<=layout.client+1,JSON.stringify(layout));
  assert.ok(layout.scrollHeight>=layout.height,JSON.stringify(layout));
  await page.locator('#photo-license').scrollIntoViewIfNeeded();assert.equal(await page.locator('#photo-license').isVisible(),true);
  await page.locator('#photo-close').click();await closed(page);
});
