import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const chapters=[
  ['El Reno, 2013','index.html'],
  ['Joplin, 2011','joplin.html'],
  ['Blackwell, 1955','blackwell.html'],
  ['Tuscaloosa and Birmingham, 2011','tuscaloosa.html'],
];
const index=JSON.parse(await readFile(new URL('../../web/archive/index.json',import.meta.url),'utf8'));
const entry=index.events.find(row=>row.id==='tuscaloosa-birmingham-2011');
const history=JSON.parse(await readFile(new URL('../../web/'+entry.history_file,import.meta.url),'utf8'));
const retained=history.versions.find(row=>row.dossier_sha256!==history.current_dossier_sha256);
assert.ok(retained,'The accepted Tuscaloosa archive has a retained predecessor');
const current=JSON.parse(await readFile(new URL('../../web/'+entry.file,import.meta.url),'utf8'));
const older=JSON.parse(await readFile(new URL('../../web/'+retained.file,import.meta.url),'utf8'));

async function fallback(page){
  const section=page.locator('#documentary-chapters');
  assert.equal(await section.isVisible(),true);
  assert.equal(await section.evaluate(node=>node.parentElement.tagName==='MAIN'&&!document.querySelector('#content').contains(node)),true);
  assert.match(await section.locator('p').textContent(),/current documentary chapters, not a retained dossier revision/);
  assert.deepEqual(await section.locator('nav a').evaluateAll(links=>links.map(link=>[link.textContent,link.getAttribute('href')])),chapters);
  for(const [name] of chapters)assert.equal(await section.getByRole('link',{name,exact:true}).isVisible(),true);
  return section;
}
async function keyboardFollow(page,link){
  await link.focus();
  assert.equal(await link.evaluate(node=>node===document.activeElement),true);
  await Promise.all([
    page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame(),timeout:10000}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForLoadState('domcontentloaded',{timeout:10000});
}
async function dossierReady(page){await page.waitForFunction(()=>document.body?.dataset.ready==='true');}
async function surveyHeadingReady(page){
  // Await the destination content itself, then retain its exact identity checks.
  const heading=page.locator('#path').getByRole('heading',{name:'The same track had different outcomes along it.',exact:true});
  await heading.waitFor({state:'visible',timeout:10000});
  assert.equal(await heading.count(),1);
  assert.equal(await page.locator('#source-survey').count(),1);
}
async function appearanceState(page,{choice,enabled,background}){
  const control=page.locator('#reading-appearance'),help=page.locator('#reading-appearance-help');
  assert.equal(await control.inputValue(),choice);
  assert.equal(await control.isEnabled(),enabled);
  assert.equal(await control.evaluate(node=>node.selectedOptions[0].textContent),{system:'Auto',light:'Clair',dark:'Obscur'}[choice]);
  assert.equal(await help.count(),1);
  assert.equal(await help.isVisible(),!enabled);
  assert.equal(await page.locator('html').getAttribute('data-appearance'),choice==='system'?null:choice);
  const colors=await page.evaluate(()=>({variable:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),body:getComputedStyle(document.body).backgroundColor}));
  assert.equal(colors.variable,background);
  assert.equal(colors.body,background==='#090909'?'rgb(9, 9, 9)':'rgb(248, 247, 243)');
}

for(const appearance of ['dark','light'])test(`documentary fallback works without JavaScript at 320px in ${appearance}`,{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},javaScriptEnabled:false,colorScheme:appearance}),requests=[];
  page.on('request',request=>requests.push(request.url()));
  await page.goto(base+'/dossier.html');
  const section=await fallback(page);
  assert.equal(await page.locator('#documentary-js-required').isVisible(),true);
  assert.equal(await page.locator('#content > p').textContent(),'Browse the evidence archive or read a current documentary chapter below.');
  assert.match(await page.locator('#documentary-js-required').textContent(),/search, evidence cards and revision metadata require JavaScript/);
  await appearanceState(page,{choice:'system',enabled:false,background:appearance==='dark'?'#090909':'#f8f7f3'});
  const sizes=()=>section.locator('h2,p,nav a').evaluateAll(nodes=>nodes.map(node=>parseFloat(getComputedStyle(node).fontSize)));
  const before=await sizes();
  // Inline styles do not depend on a stylesheet load event in a no-script page.
  // Production scripts remain disabled; the measured text change is test setup.
  await page.evaluate(()=>{document.body.style.fontSize='200%';});
  const after=await sizes();
  after.forEach((size,i)=>assert.ok(size>=before[i]*1.95&&size<=before[i]*2.05,JSON.stringify({before,after})));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);
  if(process.env.ATLAS_SCREENSHOT_DIR){
    await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`dossier-documentary-nojs-320-${appearance}.png`),fullPage:true});
  }
  assert.equal(requests.some(url=>url.includes('/archive/')||url.includes('/catalogue/')),false);
  await keyboardFollow(page,section.getByRole('link',{name:'Blackwell, 1955',exact:true}));
  assert.equal(new URL(page.url()).pathname,'/blackwell.html');
  assert.equal(await page.locator('#warning-context').count(),1);
  assert.equal(await page.locator('#source-warnings').count(),1);
  await page.goBack();await fallback(page);
  await page.goto(base+'/dossier.html?event='+entry.id+'&revision='+retained.dossier_sha256);
  const direct=await fallback(page);
  await appearanceState(page,{choice:'system',enabled:false,background:appearance==='dark'?'#090909':'#f8f7f3'});
  assert.equal(await page.locator('#documentary-js-required').isVisible(),true);
  assert.equal(await page.locator('#content .archive-card').count(),0);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  assert.equal(requests.some(url=>url.includes('/archive/')||url.includes('/catalogue/')),false);
  await keyboardFollow(page,direct.getByRole('link',{name:'Tuscaloosa and Birmingham, 2011',exact:true}));
  assert.equal(new URL(page.url()).pathname,'/tuscaloosa.html');
  await surveyHeadingReady(page);
});

for(const appearance of ['dark','light'])test(`a blocked appearance script leaves Auto disabled and follows ${appearance}`,{timeout:30000},async t=>{
  const page=await fixture(t,{viewport:{width:320,height:844},colorScheme:appearance});let scriptRequested=false;
  await page.addInitScript(()=>localStorage.setItem('tornado-atlas-appearance','light'));
  await page.route('**/appearance.js',route=>{scriptRequested=true;return route.fulfill({status:503,contentType:'text/javascript',body:''});});
  await page.goto(base+'/dossier.html?event='+entry.id);await dossierReady(page);
  const section=await fallback(page);
  assert.equal(scriptRequested,true);
  await appearanceState(page,{choice:'system',enabled:false,background:appearance==='dark'?'#090909':'#f8f7f3'});
  assert.match(await page.locator('#content').textContent(),/current published dossier/);
  await keyboardFollow(page,section.getByRole('link',{name:'Tuscaloosa and Birmingham, 2011',exact:true}));
  assert.equal(new URL(page.url()).pathname,'/tuscaloosa.html');
  assert.equal(await page.locator('#sources').count(),1);
});

test('initialized appearance restores saved choices and changes the actual palette',{timeout:30000},async t=>{
  const page=await fixture(t,{colorScheme:'light'});
  await page.goto(base+'/dossier.html');await dossierReady(page);
  await appearanceState(page,{choice:'dark',enabled:true,background:'#090909'});
  // Native selection dispatches the production change handler, not a test copy.
  await page.locator('#reading-appearance').selectOption('light');
  await appearanceState(page,{choice:'light',enabled:true,background:'#f8f7f3'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('tornado-atlas-appearance')),'light');
  await page.reload();await dossierReady(page);
  await appearanceState(page,{choice:'light',enabled:true,background:'#f8f7f3'});
  await page.locator('#reading-appearance').selectOption('system');
  await appearanceState(page,{choice:'system',enabled:true,background:'#f8f7f3'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('tornado-atlas-appearance')),'system');
  await page.emulateMedia({colorScheme:'dark'});
  await appearanceState(page,{choice:'system',enabled:true,background:'#090909'});
  await page.reload();await dossierReady(page);
  await appearanceState(page,{choice:'system',enabled:true,background:'#090909'});
  await page.locator('#reading-appearance').selectOption('dark');
  assert.equal(await page.evaluate(()=>localStorage.getItem('tornado-atlas-appearance')),'dark');
  await page.emulateMedia({colorScheme:'light'});
  await appearanceState(page,{choice:'dark',enabled:true,background:'#090909'});
  await page.reload();await dossierReady(page);
  await appearanceState(page,{choice:'dark',enabled:true,background:'#090909'});
});

test('appearance controls remain functional when preference storage is unavailable',{timeout:30000},async t=>{
  const page=await fixture(t,{colorScheme:'light'});
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage unavailable','SecurityError');}}));
  await page.goto(base+'/dossier.html');await dossierReady(page);
  await appearanceState(page,{choice:'dark',enabled:true,background:'#090909'});
  await page.locator('#reading-appearance').selectOption('light');
  await appearanceState(page,{choice:'light',enabled:true,background:'#f8f7f3'});
  await page.locator('#reading-appearance').selectOption('system');
  await appearanceState(page,{choice:'system',enabled:true,background:'#f8f7f3'});
  await page.reload();await dossierReady(page);
  await appearanceState(page,{choice:'dark',enabled:true,background:'#090909'});
});

test('a missing dossier module leaves the native documentary route usable',{timeout:30000},async t=>{
  const page=await fixture(t),requests=[];let moduleRequested=false;
  page.on('request',request=>requests.push(request.url()));
  await page.route('**/dossier.mjs',route=>{moduleRequested=true;return route.fulfill({status:503,contentType:'text/javascript',body:''});});
  await page.goto(base+'/dossier.html?event='+entry.id+'&revision='+retained.dossier_sha256);
  const section=await fallback(page);
  await appearanceState(page,{choice:'dark',enabled:true,background:'#090909'});
  assert.equal(moduleRequested,true);
  assert.equal(await page.locator('#content > p').textContent(),'Browse the evidence archive or read a current documentary chapter below.');
  assert.equal(await page.locator('#content .archive-card').count(),0);
  assert.equal(requests.some(url=>url.includes('/archive/')||url.includes('/catalogue/')),false);
  await keyboardFollow(page,section.getByRole('link',{name:'Joplin, 2011',exact:true}));
  assert.equal(new URL(page.url()).pathname,'/joplin.html');
  assert.equal(await page.locator('#chronology').count(),1);
  assert.equal(await page.locator('#source-nws-assessment').count(),1);
});

test('unavailable archive metadata retains documentary links and retries the requested revision',{timeout:30000},async t=>{
  const page=await fixture(t);let unavailable=true;
  await page.route('**/archive/index.json',route=>unavailable?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await page.goto(base+'/dossier.html?event='+entry.id+'&revision='+retained.dossier_sha256);
  await page.waitForFunction(()=>document.body?.dataset.ready==='error');
  await fallback(page);
  assert.equal(await page.locator('#content h1').textContent(),'Evidence unavailable');
  assert.equal(await page.locator('#content .archive-card').count(),0);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  unavailable=false;
  await keyboardFollow(page,page.getByRole('link',{name:'Retry this view',exact:true}));
  await dossierReady(page);await fallback(page);
  assert.match(await page.locator('#content').textContent(),/reading a retained dossier revision/);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  assert.equal(await page.locator('#observation-'+older.observations[0].id).locator('p').nth(1).textContent(),older.observations[0].account);
});

test('current dossier evidence and retained history stay usable beside documentary links',{timeout:30000},async t=>{
  const page=await fixture(t);
  await page.goto(base+'/dossier.html?event='+entry.id);await dossierReady(page);await fallback(page);
  assert.match(await page.locator('#content').textContent(),/current published dossier/);
  const media=current.media[0],card=page.locator('#media-'+media.id);
  assert.equal(await card.locator('p').nth(1).textContent(),media.account);
  await keyboardFollow(page,card.getByRole('link',{name:'Inspect the source card',exact:true}));
  await dossierReady(page);await fallback(page);
  assert.equal(new URL(page.url()).searchParams.get('source'),media.source_id);
  assert.equal(await page.locator('#source-'+media.source_id).count(),1);
  await page.goBack();await dossierReady(page);
  await keyboardFollow(page,page.locator('#revision-'+retained.dossier_sha256).getByRole('link',{name:'Open this dossier revision',exact:true}));
  await dossierReady(page);await fallback(page);
  assert.match(await page.locator('#content').textContent(),/reading a retained dossier revision/);
  assert.equal(new URL(page.url()).searchParams.get('revision'),retained.dossier_sha256);
  assert.equal(await page.locator('#correction-history .archive-card').count(),history.versions.length);
  const selected=page.locator('#revision-'+retained.dossier_sha256);
  assert.equal(await selected.getByRole('link',{name:'Open raw metadata file (unverified)',exact:true}).getAttribute('href'),new URL(retained.file,base+'/').href);
  assert.equal(await selected.getByRole('button',{name:'Verify and download this revision (JSON)',exact:true}).count(),1);
});

test('documentary fallback does not substitute a current dossier for an unknown revision',{timeout:30000},async t=>{
  const page=await fixture(t),unknown='0'.repeat(64);
  await page.goto(base+'/dossier.html?event='+entry.id+'&revision='+unknown);
  await page.waitForFunction(()=>document.body?.dataset.ready==='error');
  const section=await fallback(page);
  assert.equal(await page.locator('#content h1').textContent(),'Evidence unavailable');
  assert.match(await page.locator('#content').textContent(),/No current account has been substituted/);
  assert.equal(await page.locator('#content .archive-card').count(),0);
  assert.equal(new URL(page.url()).searchParams.get('revision'),unknown);
  await keyboardFollow(page,section.getByRole('link',{name:'Tuscaloosa and Birmingham, 2011',exact:true}));
  assert.equal(new URL(page.url()).pathname,'/tuscaloosa.html');
  assert.equal(new URL(page.url()).searchParams.has('revision'),false);
  assert.equal(await page.locator('#sources').count(),1);
});
