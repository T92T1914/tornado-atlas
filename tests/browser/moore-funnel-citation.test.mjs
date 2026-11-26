import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

// The reviewed Moore version that cites Atkins and colleagues (2014) and the
// version before it. Both are pinned by hand and not read from the index.
const revision='2c71bdb17f121b0c00afb869aa7cc6482e1aad99fd51df238d2abbd92b24e167';
const previous='5c2ac0ec0006b1eee3e08e0fd8fbf4402ee284c51bded881707e51e7a950ce72';
const observation='funnel-against-damage-width',beside='reported-path-and-dimensions',source='atkins-2014-moore-analysis';
const doi='https://doi.org/10.1175/BAMS-D-14-00033.1';
const quoted='"The condensation funnel diameter is estimated to be 18% and 8.4% of the width of the damage path and TDS, respectively."';
const assumed='"it is assumed that the condensation funnel center is collocated with the damage path centerline."';

async function activate(page,link){
  await link.scrollIntoViewIfNeeded();await link.focus();
  assert.equal(await link.evaluate(node=>document.activeElement===node),true);
  await page.keyboard.press('Enter');
}

for(const width of [320,1280])test('Moore dossier cites the funnel paper beside its width limit '+width,{timeout:40000},async t=>{
  const page=await fixture(t,{viewport:{width,height:900},reducedMotion:'reduce'});
  // The whole dossier, because a link to one observation shows that card alone.
  const href=base+'/dossier.html?event=moore-2013#observation-'+observation;
  await page.goto(href);await waitForDossier(page,{href,elementId:'observation-'+observation});
  assert.ok((await page.locator('#content').innerText()).includes('Dossier SHA256: '+revision));
  const card=page.locator('#observation-'+observation),limit=page.locator('#observation-'+beside);
  assert.match(await limit.innerText(),/Reported damage length and width are not optical funnel size/);
  assert.equal(await limit.evaluate(node=>node.nextElementSibling?.id),'observation-'+observation,
    'The citation is the card right after the limit it supports');
  const text=await card.innerText();
  assert.ok(text.includes(quoted),'The card quotes the comparison the paper prints');
  assert.ok(text.includes(assumed),'The card states the assumption the paper gives for its range');
  assert.match(text,/KTLX scan at 2016:43 UTC/);
  assert.match(text,/the figures were not read/);
  assert.match(text,/no funnel width for any other time, no funnel shape and no wind/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'The whole dossier fits a '+width+' px page');
  assert.equal(await card.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Nothing in the card runs past its edge');
  const link=card.getByRole('link',{name:'Inspect the source card',exact:true}),sourceHref=await link.evaluate(node=>node.href);
  assert.equal(new URL(sourceHref).searchParams.get('source'),source);
  await activate(page,link);await waitForDossier(page,{href:sourceHref,elementId:'source-'+source});
  assert.deepEqual(await page.locator('article[id^="observation-"],article[id^="media-"]').evaluateAll(nodes=>nodes.map(node=>node.id)),
    ['observation-'+observation],'The paper supports this one observation and no media');
  const sourceCard=page.locator('#source-'+source),sourceText=await sourceCard.innerText();
  assert.equal(await sourceCard.getByRole('link',{name:'Read original source',exact:true}).getAttribute('href'),doi);
  assert.match(sourceText,/Internet Archive capture dated October 5, 2026/);
  assert.match(sourceText,/The PDF and the figure images were not opened/);
  assert.match(sourceText,/none of its images is used here/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'The source view fits a '+width+' px page');
  assert.equal(await sourceCard.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'The hash and the record path wrap inside the source card');
});

test('Moore history shows the citation as two added rows and keeps the version before it',{timeout:40000},async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const href=base+'/dossier.html?event=moore-2013#correction-history';
  await page.goto(href);await waitForDossier(page,{href,elementId:'correction-history'});
  const current=page.locator('#revision-'+revision),changes=await current.innerText();
  assert.match(changes,/Published source citation\./);
  assert.ok(changes.includes(source)&&changes.includes(observation),'The history names both added rows');
  const prior=page.locator('#revision-'+previous).getByRole('link',{name:'Open this dossier revision',exact:true});
  const priorHref=await prior.evaluate(node=>node.href);
  assert.equal(new URL(priorHref).searchParams.get('revision'),previous);
  await activate(page,prior);await waitForDossier(page,{href:priorHref,elementId:'correction-history'});
  assert.match(await page.locator('#content').innerText(),/reading a retained dossier revision/);
  assert.equal(await page.locator('#observation-'+observation).count(),0);
  assert.equal(await page.locator('#source-'+source).count(),0);
  assert.equal(await page.locator('#observation-'+beside).count(),1);
});
