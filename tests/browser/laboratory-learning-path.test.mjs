import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const chosen={peak:'145',radius:'650',background:'15','probe-x':'-0.8','probe-y':'1.3',area:'2.4',coefficient:'1.1',travel:'35',offset:'-0.7',threshold:'95',capacity:'1.6'};
const windTargets=['lab-context','wind-field-experiment','passage','component-experiment','continuous-reference','sampled-values','wind-model-limits'];
const formTargets=['lab-context','form-experiment','form-sequence','form-model-limits'];
async function ready(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function input(page,id,value){await page.locator('#'+id).evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
async function windState(page){return page.evaluate(()=>({controls:Object.fromEntries(['peak','radius','background','probe-x','probe-y','area','coefficient','travel','offset','threshold','capacity'].map(id=>[id,document.getElementById(id).value])),sample:document.getElementById('passage-time').value,paired:document.getElementById('component-time').value,current:[...document.querySelectorAll('#sampled-values-body tr[aria-current="true"]')].map(row=>row.id),row:[...document.getElementById('passage-sample-349').cells].map(cell=>[cell.textContent,cell.dataset.value??null]),graph:document.getElementById('passage-line').getAttribute('d')}));}
async function formState(page){return page.evaluate(()=>({controls:Object.fromEntries(['shape','condensation','azimuth','elevation','distance','quality','sequence-coverage','sequence-rate','sequence-time'].map(id=>[id,document.getElementById(id).value])),dust:document.getElementById('dust').checked,enabled:document.getElementById('sequence-enabled').checked,stage:document.getElementById('sequence-stage').textContent}));}
async function paused(page,kind){for(const id of kind==='wind'?['wind-motion','passage-play','component-play']:['motion'])assert.match(await page.locator('#'+id).textContent(),/^Play/);}
async function localLink(page,target){const link=page.locator('.lab-contents a[href="#'+target+'"]');await link.focus();await link.press('Enter');await page.waitForURL(url=>url.hash==='#'+target);await page.locator('#'+target).waitFor({state:'visible'});}
async function noOverflow(page){const result=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.lab-contents a,.study-controls label,.control-note,.wind-caption,.study-explanation p,.lab-return a,.lab-step-title')].flatMap(node=>{const r=document.createRange();r.selectNodeContents(node);return [...r.getClientRects()].filter(b=>b.width>0&&(b.left< -1||b.right>innerWidth+1)).map(b=>({text:node.textContent.slice(0,100),left:b.left,right:b.right}));})}));assert.ok(result.document<=result.viewport+1,JSON.stringify(result));assert.deepEqual(result.overflow,[],JSON.stringify(result));}
async function capture(page,name){if(process.env.ATLAS_LEARNING_CAPTURE){await mkdir(process.env.ATLAS_LEARNING_CAPTURE,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_LEARNING_CAPTURE,name+'.png')});}}
for(const width of [320,1280])test('Wind learning path preserves independently chosen state and source return '+width,{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,reducedMotion:'reduce',serviceWorkers:'block'});
 await page.goto(base+'/wind.html?event=moore-2013');await ready(page);
 for(const [id,value] of Object.entries(chosen))await input(page,id,value);await input(page,'component-time',349);
 const expected=await windState(page);assert.deepEqual(expected.controls,chosen);assert.equal(expected.sample,'349');assert.equal(expected.paired,'349');assert.deepEqual(expected.current,['passage-sample-349']);
 assert.equal(await page.locator('.lab-contents a').count(),windTargets.length);
 for(const target of windTargets){await localLink(page,target);assert.deepEqual(await windState(page),expected);await paused(page,'wind');assert.equal(await page.locator('#lab-event').inputValue(),'moore-2013');}
 assert.equal(await page.locator('#wind-reference-values').isHidden(),true);assert.equal(await page.locator('#reference-maximum-drag').textContent(),'');
 await page.locator('.lab-return a').last().focus();await page.locator('.lab-return a').last().press('Enter');await page.waitForURL(url=>url.hash==='#lab-contents-title');assert.equal(await page.evaluate(()=>document.activeElement.id),'lab-contents-title');
 await noOverflow(page);await capture(page,'wind-learning-'+width);
 const retained=page.url();await page.locator('#lab-reference-links a').first().click();await page.waitForURL('**/moore.html#damage-and-buildings');await page.goBack();await ready(page);assert.equal(page.url(),retained);assert.deepEqual(await windState(page),expected);await paused(page,'wind');
 await page.reload();await ready(page);assert.deepEqual(await windState(page),expected);await paused(page,'wind');
});
for(const width of [320,1280])test('Form learning path retains its unassigned gap and source return '+width,{timeout:45000},async t=>{
 const page=await fixture(t,{viewport:{width,height:900},isMobile:width<600,reducedMotion:'reduce',serviceWorkers:'block'});await page.goto(base+'/study.html?event=blackwell-1955');await ready(page);
 await page.locator('#shape').selectOption('rope');await input(page,'condensation',65);await input(page,'azimuth',-35);await page.locator('#quality').selectOption('3600');await page.locator('#sequence-coverage').selectOption('bounded');await page.locator('#sequence-enabled').check();await input(page,'sequence-time',.5);
 const expected=await formState(page);assert.equal(expected.controls['sequence-time'],'0.5');assert.equal(expected.controls.condensation,'65');assert.equal(expected.controls.azimuth,'-35');assert.match(expected.stage,/No assigned form between 10 and 22 seconds/);
 assert.equal(await page.locator('.lab-contents a').count(),formTargets.length);for(const target of formTargets){await localLink(page,target);assert.deepEqual(await formState(page),expected);await paused(page,'form');}
 await page.locator('.lab-return a').last().click();await noOverflow(page);await capture(page,'form-learning-'+width);const retained=page.url();await page.locator('#lab-reference-links a').first().click();await page.waitForURL('**/blackwell.html#observations');await page.goBack();await ready(page);assert.equal(page.url(),retained);assert.deepEqual(await formState(page),expected);await page.reload();await ready(page);assert.deepEqual(await formState(page),expected);await paused(page,'form');
});
for(const kind of ['wind','study'])test('Native laboratory contents work without scripts '+kind,{timeout:30000},async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900},javaScriptEnabled:false});await page.goto(base+'/'+kind+'.html?event=moore-2013');
 const targets=kind==='wind'?windTargets:formTargets;for(const target of targets)await localLink(page,target);await noOverflow(page);
 assert.deepEqual(await page.locator('#lab-documentary-fallback a').evaluateAll(links=>links.map(link=>[link.getAttribute('href'),link.textContent.trim()])),[
  ['index.html','El Reno documentary'],['joplin.html','Joplin documentary'],['blackwell.html','Blackwell documentary'],
  ['tuscaloosa.html','Tuscaloosa and Birmingham documentary'],['moore.html','Newcastle and Moore documentary'],['udall.html','Udall documentary'],
 ]);
 if(kind==='wind'){assert.equal(await page.locator('#sampled-values-body tr').count(),481);assert.match(await page.locator('#sampled-values-assumptions').textContent(),/Peak swirl 100.0 mph/);assert.equal(await page.locator('#wind-reference-values').isHidden(),true);}
});
for(const kind of ['wind','study'])test('Unavailable laboratory drawing retains learning path and documentary return '+kind,{timeout:30000},async t=>{
 const page=await fixture(t,{viewport:{width:320,height:900},reducedMotion:'reduce'});await page.addInitScript(kind=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type===(kind==='wind'?'2d':'webgl2'))return null;return original.call(this,type,...args);};},kind);
 await page.goto(base+'/'+kind+'.html?event=moore-2013');await ready(page);assert.equal(await page.locator(kind==='wind'?'#wind-field-failure':'#scene-failure').isVisible(),true);await localLink(page,kind==='wind'?'wind-model-limits':'form-model-limits');await noOverflow(page);assert.equal(await page.locator('#lab-reference-links a').first().getAttribute('href'),kind==='wind'?'moore.html#damage-and-buildings':'moore.html#survey-photographs');
});
