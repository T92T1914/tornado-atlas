import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

async function filter(page,event,layer){
  await page.getByLabel('Event',{exact:true}).selectOption(event);
  await page.getByLabel('Evidence layer',{exact:true}).selectOption(layer);
  await page.getByRole('button',{name:'Show coverage',exact:true}).focus();
  await page.keyboard.press('Enter');
}

for(const [width,appearance] of [[320,'dark'],[390,'dark'],[1280,'light']]){
  test(`coverage filters, source routes and unknown appearance stay useful ${width} ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:900}});
    await page.goto(base+'/coverage.html');
    await page.locator('#reading-appearance:not([disabled])').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('.coverage-event:visible').count(),4);
    await filter(page,'','geography');
    assert.equal(await page.locator('.coverage-layer:visible').count(),4);
    assert.equal(await page.locator('[data-event="el-reno-2013"] [data-layer="geography"]').getAttribute('data-state'),'replay');
    assert.equal(await page.locator('[data-event="joplin-2011"] [data-layer="geography"]').getAttribute('data-state'),'context');
    const geographyURL=page.url();
    await filter(page,'joplin-2011','appearance');
    assert.equal(await page.locator('.coverage-event:visible').count(),1);
    const layer=page.locator('[data-event="joplin-2011"] [data-layer="appearance"]');
    assert.equal(await layer.getAttribute('data-state'),'not_admitted');
    assert.match(await layer.textContent(),/No historical interval admitted/);
    const summary=layer.locator(':scope > details > summary');
    await summary.focus();await page.keyboard.press('Enter');
    const link=layer.getByRole('link',{name:"Daniel Friskey's view of the Joplin tornado",exact:true});
    assert.equal(await link.isVisible(),true);
    const target=new URL(await link.getAttribute('href'),base);
    assert.equal(target.searchParams.get('event'),'joplin-2011');
    assert.match(target.searchParams.get('revision'),/^[a-f0-9]{64}$/);
    assert.equal(target.searchParams.get('media'),'friskey-joplin-storm');
    assert.match(await layer.textContent(),/Time: Unregistered/);
    assert.match(await layer.textContent(),/Place: Unregistered/);
    assert.equal(await page.locator('iframe,canvas,img').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    const appearanceURL=page.url();
    await page.goBack();assert.equal(page.url(),geographyURL);
    assert.equal(await page.locator('.coverage-layer:visible').count(),4);
    await page.goForward();assert.equal(page.url(),appearanceURL);
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#coverage-layer').value==='appearance');
    assert.equal(await page.locator('.coverage-layer:visible').count(),1);
    await page.locator('[data-event="joplin-2011"] [data-layer="appearance"] > details > summary').click();
    await page.getByRole('link',{name:"Daniel Friskey's view of the Joplin tornado",exact:true}).click();
    await page.locator('#media-friskey-joplin-storm').waitFor();
    assert.match(await page.locator('#media-friskey-joplin-storm').textContent(),/unregistered/i);
  });
}

test('invalid coverage filters have an explicit error and a clear recovery',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await page.goto(base+'/coverage.html?event=unknown&layer=appearance');
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').textContent(),/not in this publication/);
  assert.equal(await page.locator('.coverage-event:visible').count(),0);
  await page.getByRole('link',{name:'Clear filters',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#coverage-status').textContent.includes('4 events'));
  assert.equal(await page.locator('.coverage-event:visible').count(),4);
});

test('without JavaScript all event coverage and original sources remain readable',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:390,height:900}});
  await page.goto(base+'/coverage.html?event=joplin-2011&layer=appearance');
  assert.equal(await page.locator('.coverage-event:visible').count(),4);
  assert.match(await page.locator('noscript').textContent(),/All published coverage is available/);
  const layer=page.locator('[data-event="blackwell-1955"] [data-layer="damage"]');
  await layer.locator(':scope > details > summary').click();
  assert.match(await layer.textContent(),/caption record does not establish/);
  assert.equal(await layer.locator('a[href^="https://"]').count()>0,true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('coverage discovery retains access from the existing dossier index',async t=>{
  const page=await fixture(t);
  await page.goto(base+'/dossier.html');
  await page.getByRole('link',{name:'Compare evidence coverage across events',exact:true}).first().click();
  await page.getByRole('heading',{name:'Evidence coverage',exact:true}).waitFor();
  assert.equal(await page.locator('.coverage-event:visible').count(),4);
});

test('enlarged reading text retains narrow source access and keyboard disclosure',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  await page.goto(base+'/coverage.html?event=blackwell-1955&layer=damage');
  await page.waitForFunction(()=>document.querySelector('#coverage-layer').value==='damage');
  await page.addStyleTag({content:'html{font-size:200%}'});
  const layer=page.locator('[data-event="blackwell-1955"] [data-layer="damage"]');
  await layer.locator(':scope > details > summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await layer.locator(':scope > details').getAttribute('open'),'');
  assert.equal(await layer.locator('a[href^="dossier.html?"]').count()>0,true);
  assert.equal(await layer.locator('a[href^="https://"]').count()>0,true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

test('static Joplin gaps retain conflicting media labels and item inspection provenance',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:390,height:900}});
  await page.goto(base+'/coverage.html');
  const layer=page.locator('[data-event="joplin-2011"] [data-layer="gaps"]');
  await layer.locator(':scope > details > summary').click();
  assert.match(await layer.textContent(),/inception field says March 21, 2025/);
  assert.match(await layer.textContent(),/unresolved internal conversion inconsistency/);
  assert.match(await layer.textContent(),/Recorded source revision:/);
  assert.match(await layer.textContent(),/Item inspection record, retained from dossier:/);
  const aftermath=layer.locator('.coverage-evidence > li').filter({has:page.getByRole('link',{name:'An aftermath view attributed to NWS Springfield',exact:true})});
  await aftermath.getByText('Recorded time and date roles',{exact:true}).click();
  assert.match(await aftermath.textContent(),/May 23, 2011 at 13:19/);
  assert.match(await aftermath.textContent(),/unverified clock and time zone/);
  assert.equal(await layer.getByRole('link',{name:'Inspect all limits in this dossier version',exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});
