import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit,firefox} from 'playwright';

const repo=fileURLToPath(new URL('../../',import.meta.url));
let browser;
const python=process.env.ATLAS_CURATOR_TEST_PYTHON||(process.platform==='win32'?'py':'python3');
const prefix=process.platform==='win32'&&!process.env.ATLAS_CURATOR_TEST_PYTHON?['-3.11','-B']:['-B'];
const startCode=`
import json,sys
from pathlib import Path
from atlas.archive import clocks,evidence
from atlas.curator import App,Store,server
from atlas.publication import write_json
root,store=map(Path,sys.argv[1:])
config=[dict(id='synthetic-recovery',title='Synthetic recovery context',coverage='Dossier',summary='Synthetic original summary.',records=[],routes=[],sources=[dict(identifier='synthetic-source',title='Synthetic source',url='https://example.org/source',locator='Fixture paragraph',access='Synthetic only',revision='Fixture1')],observations=[evidence('synthetic-observation','Synthetic observation','synthetic-source','Fixture paragraph','Original attributed account.','Synthetic only.',time=clocks(capture={'synthetic_count':0}))])]
write_json(root/'research/archive-dossiers.json',config)
write_json(root/'research/record-aliases.json',{})
write_json(root/'web/catalogue/index.json',{'records':[]})
app=App(Store(store),root)
http=server(app)
print(json.dumps({'url':app.origin+'/#token='+app.token}),flush=True)
try:http.serve_forever()
finally:http.server_close()
`;
const advanceCode=`
import copy,json,sys
from pathlib import Path
from atlas.archive import digest,dossiers,evidence,promote_candidate
from atlas.publication import write_json
root=Path(sys.argv[1]);current=dossiers(root)[0];changed=copy.deepcopy(current)
changes=json.loads(sys.stdin.read())
changed['summary']=changes['summary']
if 'account' in changes:changed['observations'][0]['account']=changes['account']
if 'numeric_current' in changes:changed['observations'][0]['time']['capture']['synthetic_count']=float(changes['numeric_current'])
if changes.get('addition'):changed['observations'].append(evidence('current-added','New reviewed fixture addition','synthetic-source','Fixture paragraph','Current accepted fixture content.','Synthetic only.'))
candidate=root/'synthetic-candidate.json'
write_json(candidate,dict(schema_version=1,kind='atlas-curator-candidate',base=dict(event_id=current['id'],dossier_sha256=digest(current)),dossier=changed))
promote_candidate(candidate,'Synthetic fixture advancement only.',root)
`;
before(async()=>{
  const engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';assert.ok(['chromium','webkit','firefox'].includes(engine));
  browser=await ({chromium,webkit,firefox}[engine]).launch({headless:true,...(engine==='chromium'?{chromiumSandbox:true,args:['--mute-audio','--disable-gpu']}: {})});
  console.log(JSON.stringify({engine,version:browser.version(),headless:true,scope:'isolated synthetic private recovery'}));
});
after(async()=>browser?.close());
async function stop(child){if(child?.pid&&child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill();await exit;}}
async function fixture(t,width=320,appearance='dark'){
  const directory=await mkdtemp(path.join(tmpdir(),'atlas-private-recovery-'));let child,context;t.after(async()=>{await context?.close();await stop(child);await rm(directory,{recursive:true,force:true});});
  const root=path.join(directory,'synthetic-checkout'),store=path.join(directory,'private');await mkdir(path.join(root,'web'),{recursive:true});
  for(const file of ['curator.html','curator.mjs','curator.css','style.css','appearance.css','appearance.js','museum.css'])await copyFile(path.join(repo,'web',file),path.join(root,'web',file));
  child=spawn(python,[...prefix,'-c',startCode,root,store],{cwd:repo,stdio:['ignore','pipe','pipe'],windowsHide:true});
  const url=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Synthetic local session timed out')),15000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('Synthetic local session exited: '+errors));});child.stderr.on('data',d=>errors+=d);child.stdout.on('data',d=>{output+=d;if(output.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(output.split('\n')[0]).url);}catch(e){reject(e);}}});});
  const address=new URL(url),token=new URLSearchParams(address.hash.slice(1)).get('token');
  context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true,permissions:[],reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===address.origin?route.continue():route.abort());
  const page=await context.newPage();
  const museumStyle=page.waitForResponse(response=>response.url()===new URL('/museum.css',url).href);
  await page.goto(url);
  const stylesheet=await museumStyle;assert.equal(stylesheet.status(),200,'Recovery fixture loads the integrated museum stylesheet');
  assert.deepEqual(await stylesheet.body(),await readFile(path.join(repo,'web','museum.css')),'Browser consumed the current museum stylesheet');
  await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#reading-appearance').selectOption(appearance);
  async function api(route,payload){const headers={'X-Curator-Token':token,Origin:address.origin,...(payload===undefined?{}:{'Content-Type':'application/json'})};return payload===undefined?page.request.get(address.origin+route,{headers}):page.request.post(address.origin+route,{headers,data:payload});}
  async function advance(changes){const owned=spawn(python,[...prefix,'-c',advanceCode,root],{cwd:repo,stdio:['pipe','ignore','pipe'],windowsHide:true});let errors='';owned.stderr.on('data',d=>errors+=d);const done=once(owned,'exit');owned.stdin.end(JSON.stringify(changes));const [code]=await done;assert.equal(code,0,errors);}
  return {page,api,advance,root,store,directory};
}
async function newDraft(page,id){await page.locator('#new-id').fill(id);await page.locator('#event-choice').selectOption('synthetic-recovery');const start=page.getByRole('button',{name:'Start event draft',exact:true});await start.focus();await start.press('Enter');await page.waitForFunction(()=>!document.getElementById('workspace').hidden&&!document.querySelector('main').hasAttribute('aria-busy'));}
async function fits(page){const bounds=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(bounds.document<=bounds.width+1,JSON.stringify(bounds));}
async function capture(page,name){if(process.env.ATLAS_CURATOR_RECOVERY_CAPTURE_DIR){await mkdir(process.env.ATLAS_CURATOR_RECOVERY_CAPTURE_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.ATLAS_CURATOR_RECOVERY_CAPTURE_DIR,name+'.png')});}}
for(const [width,appearance] of [[320,'dark'],[1280,'light']])test(`private conflicts, reviewed result and notes survive recovery at ${width} ${appearance}`,async t=>{
  const f=await fixture(t,width,appearance),{page}=f;await newDraft(page,'keyboard-recovery');
  const initial=await (await f.api('/api/draft/keyboard-recovery')).json(),privateDoc=structuredClone(initial.draft.dossier);
  privateDoc.title='Privately edited synthetic title';privateDoc.observations[0].account='Private incompatible fixture account.';
  await page.getByText('Edit the full dossier and inspect disagreements',{exact:true}).click();
  await page.locator('#private-notes').fill('PRIVATE fixture notes stay private');await page.locator('#dossier-json').fill(JSON.stringify(privateDoc,null,2));
  await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Draft saved atomically'));
  const before=await readFile(path.join(f.store,'keyboard-recovery.json'));
  await f.advance({summary:'New reviewed fixture summary.',account:'Current incompatible fixture account.',addition:true});
  const preview=page.getByRole('button',{name:'Preview draft recovery',exact:true});await preview.focus();await preview.press('Enter');await page.locator('#recovery-panel').waitFor({state:'visible'});
  assert.ok(await page.locator('#recovery-save').isDisabled());assert.deepEqual(await readFile(path.join(f.store,'keyboard-recovery.json')),before);
  const card=page.locator('#recovery-conflicts article');assert.equal(await card.count(),1);assert.match(await card.textContent(),/account/);
  for(const summary of ['Retained original','Private edit','Current reviewed record']){const control=card.getByText(summary,{exact:true});await control.focus();await control.press('Enter');}
  await fits(page);await card.scrollIntoViewIfNeeded();await capture(page,`curator-recovery-${width}-${appearance}-conflict`);
  await card.getByRole('combobox').selectOption('private');assert.ok(await page.locator('#recovery-save').isDisabled());
  const review=page.getByRole('button',{name:'Review selected recovery choices',exact:true});await review.focus();await review.press('Enter');
  await page.waitForFunction(()=>!document.getElementById('recovery-save').disabled&&!document.querySelector('main').hasAttribute('aria-busy'));
  const plan=JSON.parse(await page.locator('#recovery-json').textContent());assert.equal(plan.unresolved.length,0);assert.equal(plan.valid,true);
  assert.equal(plan.draft.dossier.title,privateDoc.title);assert.equal(plan.draft.dossier.summary,'New reviewed fixture summary.');
  assert.equal(plan.draft.dossier.observations[0].account,privateDoc.observations[0].account);
  assert.equal(plan.draft.dossier.observations.at(-1).id,'current-added');assert.equal(plan.draft.private_notes,'PRIVATE fixture notes stay private');
  const font=await page.locator('body').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));await page.locator('body').evaluate((el,size)=>el.style.fontSize=size+'px',font*2);
  await fits(page);await page.locator('#recovery-state').scrollIntoViewIfNeeded();await capture(page,`curator-recovery-${width}-${appearance}-reviewed-enlarged`);
  const save=page.getByRole('button',{name:'Save recovered draft',exact:true});await save.focus();await save.press('Enter');
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Recovered private draft saved'));
  const recovered=await (await f.api('/api/draft/keyboard-recovery')).json();assert.deepEqual(recovered.draft,plan.draft);
  await page.locator('#draft-choice').selectOption('keyboard-recovery');await page.getByRole('button',{name:'Reopen draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Draft reopened'));
  assert.equal(await page.locator('#private-notes').inputValue(),plan.draft.private_notes);
  await page.getByRole('button',{name:'Validate and preview candidate',exact:true}).click();await page.locator('#candidate-panel').waitFor({state:'visible'});
  const exported=JSON.parse(await page.locator('#candidate-json').textContent());assert.equal(exported.base.dossier_sha256,plan.current_sha256);assert.doesNotMatch(JSON.stringify(exported),/PRIVATE fixture/);
  const incoming=page.waitForEvent('download');await page.getByRole('button',{name:'Download candidate JSON',exact:true}).click();const file=path.join(f.directory,'synthetic-export.json');await (await incoming).saveAs(file);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),exported);
});
test('changed editor, saved revision and reviewed record invalidate recovery without losing typed text',async t=>{
  const f=await fixture(t),{page}=f;await newDraft(page,'stale-recovery');await f.advance({summary:'Advanced fixture account.'});
  await page.getByRole('button',{name:'Preview draft recovery',exact:true}).click();await page.locator('#recovery-panel').waitFor({state:'visible'});
  await page.locator('#private-notes').fill('Typed after preview');assert.ok(await page.locator('#recovery-panel').isHidden());assert.ok(await page.locator('#recovery-save').isDisabled());
  await page.getByRole('button',{name:'Preview draft recovery',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('recovery-save').disabled);
  const before=await readFile(path.join(f.store,'stale-recovery.json'));await f.advance({summary:'Advanced again after preview.'});
  await page.getByRole('button',{name:'Save recovered draft',exact:true}).click();await page.locator('#error').waitFor({state:'visible'});assert.match(await page.locator('#error').textContent(),/preview changed/);
  assert.deepEqual(await readFile(path.join(f.store,'stale-recovery.json')),before);assert.equal(await page.locator('#private-notes').inputValue(),'Typed after preview');
  await page.getByRole('button',{name:'Preview draft recovery',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('recovery-save').disabled);
  const saved=await (await f.api('/api/draft/stale-recovery')).json();saved.draft.private_notes='Another tab saved';assert.equal((await f.api('/api/save',saved)).status(),200);
  await page.getByRole('button',{name:'Save recovered draft',exact:true}).click();await page.locator('#error').waitFor({state:'visible'});assert.match(await page.locator('#error').textContent(),/Saved draft changed/);
  assert.equal(await page.locator('#private-notes').inputValue(),'Typed after preview');
});
test('pending recovery save holds controls and has no public authoring claim',async t=>{
  const f=await fixture(t),{page}=f;await newDraft(page,'pending-recovery');await f.advance({summary:'Advanced fixture account.'});
  await page.getByRole('button',{name:'Preview draft recovery',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('recovery-save').disabled);
  let release,entered;const seen=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);t.after(()=>release());
  await page.route('**/api/recovery-save',async route=>{entered();await gate;await route.continue();});
  await page.getByRole('button',{name:'Save recovered draft',exact:true}).click();await seen;
  assert.ok(await page.locator('#private-notes').isDisabled());assert.ok(await page.locator('#dossier-json').isDisabled());assert.ok(await page.locator('#save').isDisabled());
  release();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Recovered private draft saved'));
  assert.ok(await page.locator('#private-notes').isEnabled());assert.match(await page.locator('#reviewed-record-recovery').textContent(),/public site provides this explanation only/);
});
test('integer and float conflicts remain distinct through chosen recovery, reopen, export and backup restore',async t=>{
  const f=await fixture(t),{page}=f;await newDraft(page,'literal-numeric-recovery');
  await page.getByText('Edit the full dossier and inspect disagreements',{exact:true}).click();
  const doc=JSON.parse(await page.locator('#dossier-json').inputValue());doc.observations[0].time.capture.synthetic_count=1;
  await page.locator('#dossier-json').fill(JSON.stringify(doc,null,2));await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Draft saved atomically'));
  await f.advance({summary:'New numeric fixture context.',numeric_current:1});
  await page.getByRole('button',{name:'Preview draft recovery',exact:true}).click();await page.locator('#recovery-panel').waitFor({state:'visible'});
  const card=page.locator('#recovery-conflicts article');assert.equal(await card.count(),1);assert.match(await card.textContent(),/time/);
  const privateDisclosure=card.locator('details').filter({has:page.getByText('Private edit',{exact:true})});
  const currentDisclosure=card.locator('details').filter({has:page.getByText('Current reviewed record',{exact:true})});
  await privateDisclosure.locator('summary').click();await currentDisclosure.locator('summary').click();
  assert.match(await privateDisclosure.locator('pre').innerText(),/"synthetic_count": 1\s*[},]/);
  assert.doesNotMatch(await privateDisclosure.locator('pre').innerText(),/"synthetic_count": 1\.0/);
  assert.match(await currentDisclosure.locator('pre').innerText(),/"synthetic_count": 1\.0/);
  await card.getByRole('combobox').selectOption('current');await page.getByRole('button',{name:'Review selected recovery choices',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('recovery-save').disabled&&!document.querySelector('main').hasAttribute('aria-busy'));
  assert.match(await page.locator('#recovery-json').textContent(),/"synthetic_count": 1\.0/);
  await page.getByRole('button',{name:'Save recovered draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Recovered private draft saved'));
  assert.match(await page.locator('#dossier-json').inputValue(),/"synthetic_count": 1\.0/);
  const savedBytes=await readFile(path.join(f.store,'literal-numeric-recovery.json'),'utf8');assert.match(savedBytes,/"synthetic_count": 1\.0/);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Draft saved atomically'));
  assert.equal(await readFile(path.join(f.store,'literal-numeric-recovery.json'),'utf8'),savedBytes,'An unchanged ordinary save must retain canonical float identity and original bytes');
  await page.getByRole('button',{name:'Reopen draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Draft reopened'));
  assert.match(await page.locator('#dossier-json').inputValue(),/"synthetic_count": 1\.0/);
  await page.getByRole('button',{name:'Validate and preview candidate',exact:true}).click();await page.locator('#candidate-panel').waitFor({state:'visible'});
  assert.match(await page.locator('#candidate-json').textContent(),/"synthetic_count": 1\.0/);
  const incoming=page.waitForEvent('download');await page.getByRole('button',{name:'Download candidate JSON',exact:true}).click();const file=path.join(f.directory,'literal-float-export.json');await (await incoming).saveAs(file);
  assert.match(await readFile(file,'utf8'),/"synthetic_count": 1\.0/,'Inspect literal exported bytes, not JavaScript Number equality');
  const backupIncoming=page.waitForEvent('download');await page.getByRole('button',{name:'Download saved draft backup',exact:true}).click();const backup=path.join(f.directory,'literal-private-backup.json');await (await backupIncoming).saveAs(backup);
  assert.match(await readFile(backup,'utf8'),/"synthetic_count": 1\.0/);
  await page.locator('#restore-file').setInputFiles(backup);await page.getByRole('button',{name:'Restore selected backup',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('status').textContent==='Restored 0 drafts. 1 identical drafts were left unchanged.');
  assert.equal(await readFile(path.join(f.store,'literal-numeric-recovery.json'),'utf8'),savedBytes);
});
