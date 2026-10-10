import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

// These are retained, reported photo labels. Loading them tests publication
// and player behavior, not clock calibration or historical reconstruction.
const declaration=JSON.parse(await readFile(new URL('../../exhibits/el-reno-2013/appearance-timeline.json',import.meta.url),'utf8'));
const sequence=declaration.photo_sequences[0];
const source=declaration.photo_sources[0];
const offsets=[397,419,482,535];
const photoQuery=`appearance_view=photo&appearance_photo=${sequence.id}`;
const canvasState=(page,state)=>page.waitForFunction(state=>
  document.querySelector('#replay-appearance-canvas')?.dataset.evidenceState===state,state);

async function openActual(page,seconds){
  await page.goto(base+`/reconstruction.html?event=el-reno-2013&t=${seconds}&${photoQuery}#replay-appearance`);
  await page.locator('#replay-time:not([disabled])').waitFor();
}

test('retained Nolte observations expose four originals without copying media or drawing a historical form',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:900}});
  const requests=[];
  page.context().on('request',request=>{if(new URL(request.url()).hostname==='nnwx.us')requests.push(request.url());});
  await openActual(page,397);
  for(let index=0;index<sequence.samples.length;index++){
    const sample=sequence.samples[index];
    const button=page.locator(`[data-photo-sample="${sample.id}"]`);
    await button.focus();
    await page.keyboard.press(index%2?'Space':'Enter');
    await canvasState(page,'photo_observed');
    assert.equal(await page.locator('#replay-time').inputValue(),String(offsets[index]));
    assert.equal(await button.getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#replay-play').textContent(),'Play timeline');
    assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),sample.image.original_url);
    assert.equal(await page.locator('#replay-appearance-source').getAttribute('href'),source.url);
    const text=await page.locator('#replay-photo-record').textContent();
    for(const value of [sample.reported_utc,sample.image.sha256,sample.image.panel_locator,
      sample.timing.uncertainty_basis,sample.viewpoint.description,...sample.characteristics,...sample.boundary_limits]){
      assert.ok(text.includes(value),`Retains the selected source statement: ${value}`);
    }
    assert.match(text,/Timing uncertaintyUnquantified/);
    assert.match(text,/Unknown: coordinates, bearing, pitch, roll/);
    assert.ok(text.includes(source.rights.basis),'Retains the exact limited use basis');
    assert.equal(await page.locator('#replay-appearance img,#replay-appearance iframe').count(),0);
  }
  assert.deepEqual(requests,[],'Source text and links acquire no Nolte resources');
});

test('actual photo routes retain exact instants and unknown fractional gaps through reload and history',async t=>{
  const page=await fixture(t);
  for(const seconds of [396.999,397.000000001,408,419.000000001,450,482.1,535.000000001]){
    await openActual(page,seconds);
    await canvasState(page,'unknown');
    assert.equal(await page.locator('[data-photo-sample][aria-pressed="true"]').count(),0);
    assert.equal(Number(new URL(page.url()).searchParams.get('t')),seconds);
    await page.reload();
    await page.locator('#replay-time:not([disabled])').waitFor();
    await canvasState(page,'unknown');
    assert.equal(Number(new URL(page.url()).searchParams.get('t')),seconds);
  }
  await openActual(page,397);
  await canvasState(page,'photo_observed');
  await page.locator(`[data-photo-sample="${sequence.samples[1].id}"]`).click();
  await canvasState(page,'photo_observed');
  assert.equal(Number(new URL(page.url()).searchParams.get('t')),419);
  await page.goBack();
  await canvasState(page,'photo_observed');
  assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),sequence.samples[0].image.original_url);
  assert.equal(Number(new URL(page.url()).searchParams.get('t')),397);
  await page.goForward();
  await canvasState(page,'photo_observed');
  assert.equal(await page.locator('#replay-photo-original').getAttribute('href'),sequence.samples[1].image.original_url);
  assert.equal(new URL(page.url()).hash,'#replay-appearance');
  await page.locator('#replay-appearance-mode').selectOption('source');
  await canvasState(page,'unknown');
  assert.equal(await page.locator('#replay-photo-record').isVisible(),false);
});

test('actual photo source reading and controls reflow at 320px with doubled text and unavailable WebGL',async t=>{
  const page=await fixture(t,{viewport:{width:320,height:900}});
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return type==='webgl2'?null:original.call(this,type,...args);
    };
  });
  await openActual(page,535);
  await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('#replay-appearance,#replay-appearance *')];
    const sizes=nodes.map(node=>Number.parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node,index)=>{node.style.fontSize=`${sizes[index]*2}px`;});
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await canvasState(page,'photo_observed');
  assert.equal(await page.locator('#replay-photo-record').isVisible(),true);
  assert.equal(await page.locator('#replay-photo-original').isVisible(),true);
  assert.ok(await page.locator('#replay-photo-original').evaluate(node=>Number.parseFloat(getComputedStyle(node).fontSize)>=26),'Fixed-size source text is actually doubled');
  assert.equal(await page.locator('#replay-appearance-canvas').isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
  for(const sample of sequence.samples){
    const button=page.locator(`[data-photo-sample="${sample.id}"]`);
    const box=await button.boundingBox();
    assert.ok(box&&box.width>=44&&box.height>=44,'Native sample control retains a 44px target');
  }
});
