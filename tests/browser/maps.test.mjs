import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,open,search,detail,base} from './harness.mjs';

const phone={viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3};
const image='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#fafafa"/><path d="M0 300H1200M600 0V600" stroke="#747474" stroke-width="4"/></svg>';
async function geography(page){
  await page.route('https://basemap.nationalmap.gov/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/export')){
      const [xmin,ymin,xmax,ymax]=url.searchParams.get('bbox').split(',').map(Number);
      await route.fulfill({json:{href:'https://basemap.nationalmap.gov/fixture.svg',extent:{xmin,ymin,xmax,ymax,spatialReference:{wkid:4326}}}});
    }else await route.fulfill({contentType:'image/svg+xml',body:image});
  });
}
async function exhibit(page){await geography(page);await page.goto(base+'/index.html#path');await page.locator('#play:not([disabled])').waitFor();await page.locator('#map').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('#map').classList.contains('has-basemap'));}

test('mobile return to selection keeps the map visible and preserves source identity',async t=>{
  const page=await fixture(t,phone);await open(page);await search(page,'El Reno');
  await page.locator('#results [data-record="ncei:453682"]').tap();await detail(page,'ncei:453682');
  await page.locator('#show-map').tap();await page.locator('#zoom-out').tap();await page.locator('#center-selected').tap();
  assert.equal(await page.locator('#world-map').isVisible(),true);
  assert.equal(await page.locator('#show-map').getAttribute('aria-pressed'),'true');
  assert.match(page.url(),/#record=ncei%3A453682/);
});

test('mobile map and selected source survive a fresh shared URL',async t=>{
  const page=await fixture(t,phone);await open(page);await search(page,'El Reno');
  await page.locator('#results [data-record="ncei:453682"]').tap();await detail(page,'ncei:453682');
  await page.locator('#show-map').tap();const href=await page.locator('#search-link').getAttribute('href');
  const other=await fixture(t,phone);await other.goto(new URL(href,base).href);await other.waitForFunction(()=>document.body.dataset.ready==='true');
  assert.equal(await other.locator('#world-map').isVisible(),true);
  await other.locator('#show-detail').tap();await detail(other,'ncei:453682');
});

test('path and outline have separate noninteractive casing over every reference mode',async t=>{
  const page=await fixture(t,phone);await exhibit(page);
  const geometry=await page.locator('#map .map-path').getAttribute('d');
  for(const theme of ['dark','light']){
    await page.locator('#reading-appearance').selectOption(theme);
    for(const layer of ['streets','terrain','none']){
      await page.locator('#map-geography').selectOption(layer);await page.locator('#map').scrollIntoViewIfNeeded();
      await page.waitForFunction(layer=>document.querySelector('#map').classList.contains('has-basemap')===(layer!=='none'),layer);
      assert.equal(await page.locator('#map .map-path').getAttribute('d'),geometry);
      assert.equal(await page.locator('#map .map-path-casing').getAttribute('d'),geometry);
      const styles=await page.locator('#map .map-path-casing').evaluate(el=>({stroke:getComputedStyle(el).stroke,pointer:getComputedStyle(el).pointerEvents,width:parseFloat(getComputedStyle(el).strokeWidth)}));
      assert.equal(styles.pointer,'none');assert.ok(styles.width>=4);
      assert.ok(await page.locator('#map .map-outline-casing').count());
      if(layer!=='none'){
        // Read actual painted pixels. A computed CSS filter was present even
        // when WebKit left the former white fixture image unfiltered.
        const png=(await page.locator('#map').screenshot({scale:'css'})).toString('base64');
        const pixel=await page.evaluate(async encoded=>{
          const img=new Image();img.src='data:image/png;base64,'+encoded;await img.decode();
          const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
          const context=canvas.getContext('2d');context.drawImage(img,0,0);
          return [...context.getImageData(4,4,1,1).data];
        },png);
        assert.ok(theme==='dark'?pixel[0]<100:pixel[0]>180,`${theme} ${layer}: painted pixel ${pixel}`);
      }
    }
  }
});

test('evidence-only mode removes modern qualification from the visible status',async t=>{
  const page=await fixture(t,phone);await exhibit(page);await page.locator('#map-geography').selectOption('none');
  assert.equal(await page.locator('#path-geography .geography-note').count(),1);
  assert.equal(await page.locator('#path-geography .geography-note').isVisible(),false);
  assert.match(await page.locator('#path-geography [role=status]').textContent(),/hidden/);
});

test('failed replacement geography removes the old mode and reports the actual fallback',async t=>{
  const page=await fixture(t,phone);await exhibit(page);
  await page.route('**/USGSShadedReliefOnly/MapServer/export?*',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.locator('#map-geography').selectOption('terrain');
  await page.waitForFunction(()=>document.querySelector('#path-geography [role=status]').textContent.includes('could not be loaded'));
  assert.equal(await page.locator('#map').evaluate(el=>el.classList.contains('has-basemap')),false);
  assert.equal(await page.locator('#map .basemap-layer image').count(),0);
});

test('published symbols remain small with an accessible exact-time alternative',async t=>{
  const page=await fixture(t,phone);await exhibit(page);
  const dot=await page.locator('#map .map-position').first().boundingBox();assert.ok(dot.width<=7);
  const time=page.locator('#published-position');await time.selectOption({index:12});
  assert.match(await page.locator('#position-basis').textContent(),/Published/);
  assert.match(await page.locator('#map .fatality-map-label').textContent(),/recovery/i);
  assert.match(await page.locator('#map .incident-marker').getAttribute('aria-label'),/Tim Samaras.*Paul Samaras.*Carl Young/);
});

test('phone map groups do not obscure most of each bin and open the record chooser',async t=>{
  const page=await fixture(t,phone);await open(page);
  const group=page.locator('.catalogue-cluster').first(),box=await group.boundingBox();assert.ok(box.width<=36);
  await group.tap();assert.equal(await page.locator('#results').isVisible(),true);
  assert.match(await page.locator('#browse-note').textContent(),/Temporary map group/);
  assert.ok(await page.locator('#results [data-record]').count());
});

test('forced colors retain the remembrance label and path legend',
  {skip:process.env.ATLAS_BROWSER_ENGINE==='webkit'?'Forced-colors emulation is Chromium-only here':false},async t=>{
  const page=await fixture(t,{...phone,forcedColors:'active'});await exhibit(page);
  const colors=await page.evaluate(()=>({
    text:getComputedStyle(document.body).color,
    label:getComputedStyle(document.querySelector('.fatality-map-label')).fill,
    legend:getComputedStyle(document.querySelector('.map-shell .legend .line')).backgroundColor,
  }));
  assert.equal(colors.label,colors.text);assert.equal(colors.legend,colors.text);
  await page.locator('#published-position').selectOption({index:5});assert.match(await page.locator('#position-basis').textContent(),/Published/);
});

test('mobile filters, area search, sharing fallback and panel history keep the source',async t=>{
  const page=await fixture(t,phone);
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Fixture denies clipboard');}}}));
  await page.goto(base+'/tornado-atlas/atlas.html?layer=local');await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await search(page,'El Reno');await page.locator('#advanced summary').tap();
  await page.locator('#year').selectOption('2013');await page.locator('#advanced summary').tap();
  await page.locator('#results [data-record="ncei:453682"]').tap();await detail(page,'ncei:453682');
  await page.locator('#show-map').tap();await page.locator('#zoom-in').tap();await page.locator('#search-area').tap();
  assert.equal(await page.locator('#query').inputValue(),'El Reno');assert.equal(await page.locator('#year').inputValue(),'2013');
  assert.ok(new URL(page.url()).searchParams.get('area'));await page.locator('#show-detail').tap();
  await page.goBack();await page.waitForFunction(()=>document.querySelector('.atlas-layout').dataset.mobileView==='list');
  await page.goForward();await page.waitForFunction(()=>document.querySelector('.atlas-layout').dataset.mobileView==='detail');await detail(page,'ncei:453682');
  await page.locator('#show-map').tap();await page.locator('#clear-area').tap();
  assert.equal(new URL(page.url()).searchParams.has('area'),false);
  await page.locator('#copy-link').tap();assert.match(await page.locator('#share-status').textContent(),/Copy unavailable/);
  assert.match(await page.locator('#search-link').getAttribute('href'),/^\/tornado-atlas\/atlas.html\?/);
  await page.locator('#active-filters').getByRole('button',{name:'Year: 2013'}).tap();assert.equal(await page.locator('#year').inputValue(),'');
  await page.locator('#reset').tap();assert.equal(await page.locator('#query').inputValue(),'');assert.equal(await page.locator('#show-detail').isDisabled(),true);
});

test('responsive and expanded maps retain selection and center without reflow overflow',async t=>{
  const page=await fixture(t,{...phone,reducedMotion:'reduce'});await open(page);await search(page,'El Reno');
  await page.locator('#results [data-record="ncei:453682"]').tap();await detail(page,'ncei:453682');await page.locator('#show-map').tap();
  const original=new URL(page.url()).searchParams.get('view').split(',').map(Number);
  for(const [width,height] of [[320,640],[360,780],[390,844],[440,900],[844,390],[820,1180],[1280,900],[1440,900],[390,844]]){
    await page.setViewportSize({width,height});
    for(const theme of ['dark','light']){
      await page.locator('#reading-appearance').selectOption(theme);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${width} ${theme} reflow`);
      const box=await page.locator('#world-map').boundingBox();assert.ok(box.width>250&&box.height>=330);
      assert.equal(await page.locator('#detail .eyebrow').textContent(),'ncei:453682');
    }
  }
  const before=await page.locator('#world-map').boundingBox();await page.locator('#expand-map').tap();
  assert.ok((await page.locator('#world-map').boundingBox()).height>before.height);
  await page.locator('#expand-map').tap();assert.equal(await page.locator('#expand-map').getAttribute('aria-pressed'),'false');
  const restored=new URL(page.url()).searchParams.get('view').split(',').map(Number);
  assert.ok(Math.abs(restored[0]-original[0])<.005&&Math.abs(restored[1]-original[1])<.005);assert.equal(restored[2],original[2]);
  await page.locator('#expand-map').tap();await page.locator('#show-detail').tap();
  assert.equal(await page.locator('.atlas-layout').evaluate(el=>el.classList.contains('expanded')),false);
  assert.equal(await page.locator('#detail').isVisible(),true);
});

test('delayed geography cannot overwrite evidence-only and can be retried',async t=>{
  const page=await fixture(t,phone);await exhibit(page);
  let release;const gate=new Promise(resolve=>{release=resolve;});
  let started;const pending=new Promise(resolve=>{started=resolve;});
  await page.route('**/USGSShadedReliefOnly/MapServer/export?*',async route=>{started();await gate;await route.fulfill({status:503,body:'Late failure'}).catch(()=>{});});
  await page.locator('#map-geography').selectOption('terrain');await pending;
  await page.locator('#reading-appearance').selectOption('light');await page.locator('#map-geography').selectOption('none');release();
  await page.locator('#path-zoom-in').tap();await page.locator('#path-fit').tap();
  assert.match(await page.locator('#path-geography [role=status]').textContent(),/hidden/);
  assert.equal(await page.locator('#map .basemap-layer image').count(),0);
  await page.locator('#map-geography').selectOption('streets');await page.waitForFunction(()=>document.querySelector('#map').classList.contains('has-basemap'));
  assert.match(await page.locator('#path-geography [role=status]').textContent(),/roads and towns geography loaded/);
});

test('published time, source coordinates and pause survive theme, layer and orientation changes',async t=>{
  const page=await fixture(t,phone);await exhibit(page);await page.locator('#published-position').selectOption({index:20});
  const before=await page.locator('#map .selected-core').evaluate(el=>[el.getAttribute('cx'),el.getAttribute('cy')]);
  const time=await page.locator('#clock').textContent();
  await page.locator('#path-zoom-in').tap();await page.setViewportSize({width:844,height:390});
  await page.locator('#reading-appearance').selectOption('light');await page.locator('#map-geography').selectOption('terrain');
  assert.deepEqual(await page.locator('#map .selected-core').evaluate(el=>[el.getAttribute('cx'),el.getAttribute('cy')]),before);
  assert.equal(await page.locator('#clock').textContent(),time);
  await page.locator('#play').tap();await page.waitForFunction(t=>document.querySelector('#clock').textContent!==t,time);
  await page.locator('#play').tap();const paused=await page.locator('#clock').textContent();
  await page.locator('#reading-appearance').selectOption('dark');await page.locator('#path-fit').tap();
  assert.equal(await page.locator('#clock').textContent(),paused);
  await page.locator('#previous').tap();assert.match(await page.locator('#position-basis').textContent(),/Published/);
});

test('desktop keyboard navigation and enlarged text preserve controls and media return focus',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});await open(page);await search(page,'El Reno');
  const row=page.locator('#results [data-record="ncei:453682"]');await row.focus();await row.press('Enter');await detail(page,'ncei:453682');
  await page.locator('[data-photo="storm-1"]').focus();await page.keyboard.press('Enter');await page.locator('#photo-dialog[open]').waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-photo="storm-1"]').evaluate(el=>el===document.activeElement),true);
  await page.locator('#world-map').focus();const view=new URL(page.url()).searchParams.get('view');await page.keyboard.press('ArrowRight');
  assert.notEqual(new URL(page.url()).searchParams.get('view'),view);
  // A text-only enlargement approximation, not a physical browser zoom claim.
  await page.evaluate(()=>{const nodes=[...document.querySelectorAll('body *')].filter(el=>el.namespaceURI==='http://www.w3.org/1999/xhtml');const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));nodes.forEach((el,i)=>el.style.fontSize=sizes[i]*1.5+'px');});
  for(const theme of ['dark','light']){
    await page.locator('#reading-appearance').selectOption(theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.locator('#back-list').click();await page.locator('#results [data-record="ncei:453682"]').click();await detail(page,'ncei:453682');
  }
});

test('touch dragging changes the enabled map without activating a record on release',
  {skip:process.env.ATLAS_BROWSER_ENGINE==='webkit'?'Chromium CDP touch protocol only':false},async t=>{
  const page=await fixture(t,phone);await open(page);await search(page,'El Reno');
  await page.locator('#results [data-record="ncei:453682"]').tap();await detail(page,'ncei:453682');await page.locator('#show-map').tap();
  await page.getByText('Layers & help',{exact:true}).tap();await page.locator('#map-drag').check();await page.getByText('Layers & help',{exact:true}).tap();
  await page.locator('#world-map').scrollIntoViewIfNeeded();
  const cdp=await page.context().newCDPSession(page); // Closed with the owned context.
  const box=await page.locator('#world-map').boundingBox(),x=box.x+box.width*.75,y=box.y+box.height*.65;
  const before=new URL(page.url()).searchParams.get('view');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let n=1;n<=6;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-12*n,y:y-6*n}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(before=>new URL(location.href).searchParams.get('view')!==before,before);
  assert.equal(new URL(page.url()).hash,'#record=ncei%3A453682');assert.equal(await page.locator('#show-map').getAttribute('aria-pressed'),'true');
  const after=new URL(page.url()).searchParams.get('view');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(new URL(page.url()).searchParams.get('view'),after);
});
