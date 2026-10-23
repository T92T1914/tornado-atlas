import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';
import {assertReadingReflow} from './reading-reflow-diagnostics.mjs';

// Accepted source identities and report locators, independent of the coverage generator.
const revision='5ed36647a0e6141f8ddeeee30ef7be9e7bb6332613ed86428b3b9b5536b25e85';
const damageObservations=[
  'facility-reconnaissance-scope','medical-center-function','plaza-reported-refuge-change',
  'plaza-roof-wall-performance','briarwood-400-refuge-envelope'
];
const damageMedia=['moore-briarwood-survey','moore-medical-center-survey'];
const gapObservations=[
  'preliminary-precursor-difference','reported-siren-clock',
  'briarwood-rating-revision','survey-photo-source-group'
];
const layer=(page,name)=>page.locator('[data-event="moore-2013"] [data-layer="'+name+'"]');

function evidenceRoute(href,kind,id){
  const url=new URL(href,base);
  assert.equal(url.pathname,'/dossier.html');
  assert.deepEqual(Object.fromEntries(url.searchParams),{event:'moore-2013',revision,[kind]:id});
  assert.equal(url.hash,'#'+kind+'-'+id);
}
async function openEvidence(section){
  const summary=section.locator(':scope > details > summary');
  if(await section.locator(':scope > details').getAttribute('open')===null){
    await summary.focus();await summary.press('Enter');
  }
}
async function selected(page,name){
  await page.waitForFunction(({name})=>document.querySelector('#coverage-event').value==='moore-2013'&&
    document.querySelector('#coverage-layer').value===name,{name});
  assert.equal(await page.locator('.coverage-event:visible').count(),1);
  assert.equal(await page.locator('.coverage-layer:visible').count(),1);
  assert.equal(await page.locator('.coverage-event').count(),6);
}
async function selectLayer(page,name){
  await page.getByLabel('Evidence layer',{exact:true}).selectOption(name);
  await page.getByRole('button',{name:'Show coverage',exact:true}).focus();
  await page.keyboard.press('Enter');await selected(page,name);
}
async function itemRoutes(section,kind){
  return section.locator('.coverage-evidence > li > h4 > a').evaluateAll((links,kind)=>links
    .map(link=>new URL(link.href)).filter(url=>url.searchParams.has(kind))
    .map(url=>({id:url.searchParams.get(kind),href:url.href})),kind);
}
async function assertMooreDamage(page){
  const damage=layer(page,'damage');
  assert.equal(await damage.getAttribute('data-state'),'context');
  await openEvidence(damage);
  for(const [kind,expected] of [['observation',damageObservations],['media',damageMedia]]){
    const routes=await itemRoutes(damage,kind);
    assert.deepEqual(routes.map(row=>row.id).sort(),[...expected].sort());
    for(const row of routes)evidenceRoute(row.href,kind,row.id);
  }
  const text=await damage.innerText();
  for(const locator of ['printed page 29 / PDF page 53','printed page 31 / PDF page 55',
    'printed page 36 / PDF page 60','printed page 38 / PDF page 62'])assert.ok(text.includes(locator),locator);
  assert.match(text,/not registered to Building 400/);
  assert.match(text,/not.*certif.*shelter|no.*shelter certification/i);
  assert.match(text,/following.day/i);
  assert.equal(await page.locator('img,iframe,canvas').count(),0);
  return damage;
}

for(const [width,appearance] of [[320,'dark'],[1280,'light']]){
  test('Moore coverage keeps disagreement, exact evidence and current article return '+width,{timeout:45000},async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
    await page.goto(base+'/coverage.html?event=moore-2013&layer=gaps');
    await selected(page,'gaps');
    await page.locator('#reading-appearance:not([disabled])').waitFor();
    await page.locator('#reading-appearance').selectOption(appearance);
    const gaps=layer(page,'gaps');
    assert.equal(await gaps.getAttribute('data-state'),'disputed');
    await openEvidence(gaps);
    const routes=await itemRoutes(gaps,'observation');
    assert.deepEqual(routes.map(row=>row.id).sort(),[...gapObservations].sort());
    for(const row of routes)evidenceRoute(row.href,'observation',row.id);
    const precursor=gaps.locator('.coverage-evidence > li').filter({has:page.getByRole('link',{
      name:'The earlier Newcastle damage has differing source classifications',exact:true})});
    assert.match(await precursor.innerText(),/thunderstorm wind/);
    assert.match(await precursor.innerText(),/earlier short-lived EF0 tornado/);
    assert.match(await precursor.innerText(),/Do not add another tornado/);
    const entry=precursor.locator('h4 > a'),href=await entry.evaluate(link=>link.href);
    await entry.focus();await entry.press('Enter');
    await waitForDossier(page,{href,elementId:'observation-preliminary-precursor-difference'});
    const card=page.locator('#observation-preliminary-precursor-difference');
    const status=await card.locator('dl').first().evaluate(node=>Object.fromEntries([...node.querySelectorAll('dt')]
      .map(term=>[term.textContent,term.nextElementSibling.textContent])));
    assert.equal(status.assertion,'disputed');assert.equal(status.availability,'disputed');
    const source=card.getByRole('link',{name:'Inspect the source card',exact:true});
    const sourceHref=await source.evaluate(link=>link.href);
    const sourceURL=new URL(sourceHref);
    assert.deepEqual(Object.fromEntries(sourceURL.searchParams),{event:'moore-2013',source:'nws-storm-data-201305',revision});
    await source.focus();await source.press('Enter');
    await waitForDossier(page,{href:sourceHref,elementId:'source-nws-storm-data-201305'});
    const sourceCard=page.locator('#source-nws-storm-data-201305');
    assert.equal(await sourceCard.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),
      'https://www.weather.gov/media/oun/stormdata/oun201305.pdf');
    assert.match(await sourceCard.innerText(),/Historical edition printed September 16, 2013/);
    await sourceCard.getByText('Continue in the current article',{exact:true}).click();
    const article=sourceCard.locator('a[href="'+base+'/moore.html#source-editions"]');
    await article.focus();await article.press('Enter');
    await page.waitForURL(url=>url.pathname==='/moore.html'&&url.hash==='#source-editions');
    const classification=page.locator('#source-editions details > summary');
    await classification.focus();await classification.press('Enter');
    assert.match(await page.locator('#source-editions').innerText(),/thunderstorm wind/);
    await assertReadingReflow(page,'Moore source-edition return '+width);
    await page.goBack();await waitForDossier(page,{href:sourceHref,elementId:'source-nws-storm-data-201305'});
    await page.goBack();await waitForDossier(page,{href,elementId:'observation-preliminary-precursor-difference'});
    await page.goBack();await selected(page,'gaps');
    await selectLayer(page,'damage');
    const damage=await assertMooreDamage(page);
    const plaza=damage.getByRole('link',{name:'Plaza Towers teachers reported a change of shelter within the original building',exact:true});
    const plazaHref=await plaza.evaluate(link=>link.href);
    await plaza.focus();await plaza.press('Enter');
    await waitForDossier(page,{href:plazaHref,elementId:'observation-plaza-reported-refuge-change'});
    const plazaCard=page.locator('#observation-plaza-reported-refuge-change');
    assert.match(await plazaCard.innerText(),/printed page 29 \/ PDF page 53/);
    assert.match(await plazaCard.innerText(),/teacher interviews/i);
    assert.match(await plazaCard.innerText(),/not.*certif.*shelter/i);
    await plazaCard.getByText('Continue in the current article',{exact:true}).click();
    const returnToSchool=plazaCard.locator('a[href="'+base+'/moore.html#plaza-towers-refuge"]');
    await returnToSchool.focus();await returnToSchool.press('Enter');
    await page.waitForURL(url=>url.pathname==='/moore.html'&&url.hash==='#plaza-towers-refuge');
    assert.match(await page.locator('#plaza-towers-refuge + p').innerText(),/Teachers interviewed by NIST/);
    await assertReadingReflow(page,'Moore school return '+width);
  });

  test('Moore coverage remains readable with measured doubled text and spacing '+width,{timeout:30000},async t=>{
    const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
    await page.goto(base+'/coverage.html?event=moore-2013&layer=damage');await selected(page,'damage');
    const damage=await assertMooreDamage(page);
    const samples=[damage.locator(':scope > details > summary'),damage.locator('.coverage-evidence > li > h4 > a').first(),
      damage.locator('.coverage-evidence > li > p').first(),page.locator('label[for="coverage-event"]')];
    const before=await Promise.all(samples.map(node=>node.evaluate(element=>{
      const box=element.getBoundingClientRect();return {font:Number.parseFloat(getComputedStyle(element).fontSize),width:box.width,height:box.height};
    })));
    for(const sample of before){assert.ok(sample.font>0&&sample.width>0&&sample.height>0);}
    await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('html,body,body *')].filter(node=>node instanceof HTMLElement);
      const sizes=nodes.map(node=>Number.parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node,index)=>{node.style.fontSize=(sizes[index]*2)+'px';});
    });
    await page.addStyleTag({content:'#coverage-content *{line-height:1.6!important;letter-spacing:.12em!important;word-spacing:.16em!important}#coverage-content p{margin-bottom:2em!important}'});
    const after=await Promise.all(samples.map(node=>node.evaluate(element=>{
      const style=getComputedStyle(element);return {font:Number.parseFloat(style.fontSize),line:Number.parseFloat(style.lineHeight),
        letter:Number.parseFloat(style.letterSpacing),word:Number.parseFloat(style.wordSpacing)};
    })));
    after.forEach((sample,index)=>{
      assert.equal(sample.font,before[index].font*2);
      assert.ok(Math.abs(sample.line-sample.font*1.6)<.02);
      assert.ok(Math.abs(sample.letter-sample.font*.12)<.02);
      assert.ok(Math.abs(sample.word-sample.font*.16)<.02);
    });
    await damage.locator(':scope > details > summary').focus();
    await page.keyboard.press('Enter');assert.equal(await damage.locator(':scope > details').getAttribute('open'),null);
    await page.keyboard.press('Enter');assert.equal(await damage.locator(':scope > details').getAttribute('open'),'');
    await assertMooreDamage(page);await assertReadingReflow(page,'Moore doubled coverage '+width);
  });
}

test('Moore damage and disputed sources remain linked without JavaScript',async t=>{
  const page=await fixture(t,{javaScriptEnabled:false,viewport:{width:320,height:900}});
  await page.goto(base+'/coverage.html?event=moore-2013&layer=gaps');
  assert.equal(await page.locator('.coverage-event:visible').count(),6);
  assert.match(await page.locator('noscript').innerText(),/All published coverage is available/);
  const gaps=layer(page,'gaps');await openEvidence(gaps);
  assert.equal(await gaps.getAttribute('data-state'),'disputed');
  const routes=await itemRoutes(gaps,'observation');
  assert.deepEqual(routes.map(row=>row.id).sort(),[...gapObservations].sort());
  for(const row of routes)evidenceRoute(row.href,'observation',row.id);
  const damage=await assertMooreDamage(page);
  assert.equal(await damage.locator('a[href="https://doi.org/10.6028/NIST.sp.1164"]').count(),5);
  assert.equal(await damage.locator('a[href="https://www.weather.gov/oun/events-20130520"]').count(),2);
  await assertReadingReflow(page,'Moore static coverage');
});

// Controlled archive unavailability, not an observation of a public outage.
for(const width of [320,1280])for(const [kind,id,layerName] of [
  ['observation','preliminary-precursor-difference','gaps'],
  ['media','moore-briarwood-survey','damage'],
])test('Moore coverage retries the exact unavailable '+kind+' reader '+width,{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  const archive=base+'/archive/moore-2013-5ed36647a0e6141f8dde.json';
  let unavailable=true,blocked=0,recovered=0;
  await page.route(archive,route=>{
    assert.equal(route.request().url(),archive);
    if(unavailable){blocked++;return route.fulfill({status:503,contentType:'text/plain',body:'Controlled archive unavailability'});}
    recovered++;return route.continue();
  });
  await page.goto(base+'/coverage.html?event=moore-2013&layer='+layerName);
  await selected(page,layerName);const section=layer(page,layerName);await openEvidence(section);
  const entry=section.locator('h4 > a[href*="'+kind+'='+id+'"]');
  assert.equal(await entry.count(),1);const href=await entry.evaluate(node=>node.href);evidenceRoute(href,kind,id);
  await entry.focus();await page.keyboard.press('Enter');
  const unavailableView=async()=>{
    await page.waitForFunction(href=>location.href===href&&document.body?.dataset.ready==='error',href);
    assert.equal(await page.locator('#content h1').textContent(),'Evidence unavailable');
    assert.equal(await page.locator('#content .archive-card').count(),0);
    assert.ok(blocked>0);assert.equal(recovered,0);
    assert.equal(await page.getByRole('link',{name:'Retry this view',exact:true}).getAttribute('href'),href);
    assert.match(await page.locator('#documentary-chapters > p').innerText(),/current documentary chapters, not a retained dossier revision/);
    await assertReadingReflow(page,'Moore unavailable '+kind+' '+width);
  };
  await unavailableView();
  const fallback=page.locator('#documentary-chapters').getByRole('link',{name:'Newcastle and Moore, 2013',exact:true});
  assert.equal(await fallback.getAttribute('href'),'moore.html');
  await fallback.focus();await page.keyboard.press('Enter');await page.waitForURL(base+'/moore.html');
  await page.locator('#source-editions').waitFor({state:'attached'});
  await page.goBack();await unavailableView();
  unavailable=false;
  await page.getByRole('link',{name:'Retry this view',exact:true}).focus();await page.keyboard.press('Enter');
  await waitForDossier(page,{href,elementId:kind+'-'+id});assert.ok(recovered>0);
  evidenceRoute(page.url(),kind,id);
  const card=page.locator('#'+kind+'-'+id);
  const fields=await card.locator('dl').first().evaluate(node=>Object.fromEntries([...node.querySelectorAll('dt')]
    .map(term=>[term.textContent,term.nextElementSibling.textContent])));
  assert.equal(fields.assertion,kind==='observation'?'disputed':'observed sample');
  assert.equal(fields.availability,kind==='observation'?'disputed':'reviewed available');
  if(kind==='observation')assert.match(await card.innerText(),/thunderstorm wind/);
  else assert.match(await card.innerText(),/following.day/i);
  await assertReadingReflow(page,'Moore recovered '+kind+' '+width);
  const sourceId=kind==='observation'?'nws-storm-data-201305':'nws-event-hub';
  const source=card.getByRole('link',{name:'Inspect the source card',exact:true});
  const sourceHref=await source.evaluate(node=>node.href);evidenceRoute(sourceHref,'source',sourceId);
  await source.focus();await page.keyboard.press('Enter');
  await waitForDossier(page,{href:sourceHref,elementId:'source-'+sourceId});
  const sourceCard=page.locator('#source-'+sourceId);
  assert.equal(await sourceCard.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),
    kind==='observation'?'https://www.weather.gov/media/oun/stormdata/oun201305.pdf':'https://www.weather.gov/oun/events-20130520');
  const reading=sourceCard.getByText('Continue in the current article',{exact:true});
  await reading.focus();await page.keyboard.press('Enter');
  const anchor=kind==='observation'?'source-editions':'survey-photographs';
  const article=sourceCard.locator('a[href="'+base+'/moore.html#'+anchor+'"]');
  assert.equal(await article.count(),1);await article.focus();await page.keyboard.press('Enter');
  await page.waitForURL(base+'/moore.html#'+anchor);
  await page.waitForFunction(()=>document.querySelector('.documentary-contents')?.dataset.focusReveal==='ready');
  await page.locator('#'+anchor).waitFor({state:'visible'});
  if(kind==='observation'){
    const disclosure=page.locator('#source-editions details > summary');await disclosure.focus();await page.keyboard.press('Enter');
    assert.match(await page.locator('#source-editions').innerText(),/thunderstorm wind/);
  }else assert.equal(await page.locator('#moore-briarwood-survey img').getAttribute('src'),'assets/moore-2013/IMG_2314-800.jpg');
  await assertReadingReflow(page,'Moore recovered source and article '+kind+' '+width);
});
