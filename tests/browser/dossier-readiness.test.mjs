import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

const observation='blackwell-tonkawa-barograph';
const target=()=>({href:base+'/dossier.html?event=blackwell-1955&observation='+observation,
  elementId:'observation-'+observation});

test('Dossier readiness requires the requested route, not a ready older page',async t=>{
  const page=await fixture(t);
  await page.goto(base+'/dossier.html?event=blackwell-1955');
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  assert.equal(await page.locator('#observation-'+observation).count(),1);
  await assert.rejects(waitForDossier(page,target(),{timeout:250}),/Timeout/);
});

test('Dossier readiness requires the requested evidence element',async t=>{
  const page=await fixture(t);
  await page.goto(target().href);
  await waitForDossier(page,target());
  await assert.rejects(waitForDossier(page,{...target(),elementId:'observation-not-in-this-dossier'},
    {timeout:250}),/Timeout/);
});

test('A failed dossier response cannot satisfy readiness',async t=>{
  const page=await fixture(t);
  await page.route('**/archive/index.json',route=>route.fulfill({status:503,
    contentType:'text/plain',body:'Controlled unavailable response'}));
  await page.goto(target().href);
  await page.waitForFunction(()=>document.body.dataset.ready==='error');
  await assert.rejects(waitForDossier(page,target(),{timeout:250}),/Timeout/);
});
