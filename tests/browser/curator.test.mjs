import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';

let child,browser,directory,url,origin;
before(async()=>{
  directory=await mkdtemp(path.join(tmpdir(),'atlas-curator-check-'));
  const root=fileURLToPath(new URL('../../',import.meta.url));
  child=spawn(process.platform==='win32'?'py':'python3',[...(process.platform==='win32'?['-3.11']:[]),'-m','atlas.curator','--store',path.join(directory,'private')],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});
  url=await new Promise((resolve,reject)=>{
    let text='';const timer=setTimeout(()=>reject(Error('Curator service did not start')),15000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',()=>{clearTimeout(timer);reject(Error('Curator service exited before startup'));});
    child.stdout.on('data',data=>{text+=data.toString();const line=text.split('\n')[0];if(text.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(line).url);}catch(error){reject(error);}}});
  });origin=new URL(url).origin;
  browser=await (process.env.ATLAS_BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true,
    ...(process.env.ATLAS_BROWSER_ENGINE==='webkit'?{}:{chromiumSandbox:true,
      ...(process.env.ATLAS_BROWSER_EXECUTABLE?{executablePath:process.env.ATLAS_BROWSER_EXECUTABLE}:process.env.ATLAS_BROWSER_CHANNEL?{channel:process.env.ATLAS_BROWSER_CHANNEL}:{}),args:['--mute-audio','--disable-gpu']})});
});
after(async()=>{await browser?.close();if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}if(directory)await rm(directory,{recursive:true,force:true});});

async function pageFor(t,width=1280){
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true,permissions:[],reducedMotion:'reduce'});t.after(()=>context.close());
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));t.after(()=>assert.deepEqual(errors,[]));
  await page.goto(url);await page.waitForFunction(()=>document.body.dataset.ready==='true');return page;
}
async function newDraft(page,id){await page.locator('#new-id').fill(id);await page.locator('#event-choice').selectOption('el-reno-2013');await page.getByRole('button',{name:'Start event draft',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('workspace').hidden&&!document.querySelector('main').hasAttribute('aria-busy'));}
async function fitsReadingWidth(page,context){
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const bounds=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
    overflowing:[...document.querySelectorAll('body *')].flatMap(el=>{const rect=el.getBoundingClientRect();return rect.width>0&&(rect.right>innerWidth+.5||rect.left<-.5||el.scrollWidth>el.clientWidth+1)?[{tag:el.tagName,id:el.id,name:el.getAttribute('name'),class:el.className,control:el.querySelector('input,select,textarea')?.id,text:el.childNodes[0]?.textContent?.slice(0,80),left:rect.left,right:rect.right,width:rect.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,font:getComputedStyle(el).font}]:[];}).slice(0,30)}));
  assert.ok(bounds.documentWidth<=bounds.viewport,JSON.stringify({context,...bounds},null,2));
}

test('real retained media survives private save, idempotent intake, preview and candidate download',async t=>{
  const page=await pageFor(t);await newDraft(page,'browser-media-review');
  await page.locator('#private-notes').fill('PRIVATE TEST NOTE must stay outside the public candidate');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Draft saved atomically'));
  await page.getByRole('button',{name:'Fill from a retained video sample'}).click();
  assert.equal(await page.locator('[name=video_start]').inputValue(),'5');assert.equal(await page.locator('[name=video_end]').inputValue(),'5');
  await page.getByRole('button',{name:'Add intake and save'}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Intake saved'));
  const before=await page.locator('#revision').textContent();
  await page.getByRole('button',{name:'Add intake and save'}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Identical intake'));
  assert.equal(await page.locator('#revision').textContent(),before);
  await page.locator('[name=account]').fill('Conflicting replacement under the same key');await page.getByRole('button',{name:'Add intake and save'}).click();await page.locator('#error').waitFor({state:'visible'});assert.match(await page.locator('#error').textContent(),/different content/);
  await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#draft-choice').selectOption('browser-media-review');await page.getByRole('button',{name:'Reopen draft',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('private-notes').value.includes('PRIVATE TEST NOTE'));
  await page.getByRole('button',{name:'Validate and preview candidate'}).click();await page.locator('#candidate-panel').waitFor({state:'visible'});
  assert.doesNotMatch(await page.locator('#candidate-json').textContent(),/PRIVATE TEST NOTE/);
  const result=JSON.parse(await page.locator('#candidate-json').textContent());assert.equal(result.kind,'atlas-curator-candidate');assert.equal(result.base.event_id,'el-reno-2013');
  const added=result.dossier.media.find(m=>m.id==='intake-retained-robinson-01');assert.equal(added.time.alignment,null);assert.equal(added.place.coordinates,null);assert.equal(added.status.assertion,'not_researched');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download candidate JSON'}).click();const received=await download;const file=path.join(directory,'candidate-download.json');await received.saveAs(file);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),result);
  const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download private backup'}).click();const backup=await backupDownload;const backupFile=path.join(directory,'private-backup.json');await backup.saveAs(backupFile);assert.match(await readFile(backupFile,'utf8'),/PRIVATE TEST NOTE/);
  await page.locator('#restore-file').setInputFiles(backupFile);await page.getByRole('button',{name:'Restore selected backup'}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('identical drafts were left unchanged'));
});

test('390 pixel layouts, both appearances, keyboard and source-record context work without registration',async t=>{
  const page=await pageFor(t,390);await page.locator('#new-id').fill('sparse-source-review');await page.locator('#record-query').fill('ncei:432342');await page.locator('#record-query').press('Enter');
  const found=page.locator('#record-results button').first();await found.waitFor();await found.focus();await found.press('Enter');await page.waitForFunction(()=>!document.getElementById('workspace').hidden);
  assert.match(await page.locator('#target-context').textContent(),/Source record: ncei:432342/);
  for(const appearance of ['dark','light','system']){await page.locator('#reading-appearance').selectOption(appearance);await fitsReadingWidth(page,`record ${appearance}`);}
  await page.getByRole('button',{name:'Validate and preview candidate'}).click();await page.locator('#candidate-panel').waitFor({state:'visible'});
  const exported=JSON.parse(await page.locator('#candidate-json').textContent());assert.deepEqual(exported.base,{event_id:null,dossier_sha256:null});assert.deepEqual(exported.dossier.records,[]);
  await page.locator('#record-query').fill('no-such-record-9876');await page.locator('#record-query').press('Enter');await page.getByText('No matching source records.',{exact:false}).waitFor();
});

test('rendered candidate text does not create source-supplied markup',async t=>{
  const page=await pageFor(t);await newDraft(page,'plain-text-preview');
  await page.locator('summary').first().click();const doc=JSON.parse(await page.locator('#dossier-json').inputValue());doc.media[0].title='<img src=x onerror="window.unexpected=true">';await page.locator('#dossier-json').fill(JSON.stringify(doc));
  await page.getByRole('button',{name:'Validate and preview candidate'}).click();await page.locator('#candidate-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#candidate-summary img').count(),0);assert.equal(await page.evaluate(()=>Boolean(window.unexpected)),false);
});

test('editing invalidates a preview and two browser copies cannot silently replace newer notes',async t=>{
  const first=await pageFor(t);await newDraft(first,'conflict-review');
  const second=await pageFor(t);await second.locator('#draft-choice').selectOption('conflict-review');await second.getByRole('button',{name:'Reopen draft',exact:true}).click();await second.waitForFunction(()=>!document.getElementById('workspace').hidden);
  await first.getByRole('button',{name:'Validate and preview candidate'}).click();await first.locator('#candidate-panel').waitFor({state:'visible'});assert.equal(await first.locator('#download').isEnabled(),true);
  await first.locator('summary').first().click();const doc=JSON.parse(await first.locator('#dossier-json').inputValue());doc.summary+=' A private working edit.';await first.locator('#dossier-json').fill(JSON.stringify(doc,null,2));assert.equal(await first.locator('#download').isDisabled(),true);assert.match(await first.locator('#preview-state').textContent(),/Validate again/);
  await first.locator('#private-notes').fill('Newer notes in first tab');await first.getByRole('button',{name:'Save draft',exact:true}).click();await first.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Draft saved atomically'));
  await second.locator('#private-notes').fill('Older tab edit');await second.getByRole('button',{name:'Save draft',exact:true}).click();await second.locator('#error').waitFor({state:'visible'});assert.match(await second.locator('#error').textContent(),/Saved draft changed/);assert.equal(await second.locator('#private-notes').inputValue(),'Older tab edit');
  second.once('dialog',dialog=>dialog.dismiss());await second.getByRole('button',{name:'Reopen draft',exact:true}).click();assert.equal(await second.locator('#private-notes').inputValue(),'Older tab edit');
  second.once('dialog',dialog=>dialog.accept());await second.getByRole('button',{name:'Reopen draft',exact:true}).click();await second.waitForFunction(()=>document.getElementById('private-notes').value==='Newer notes in first tab');
});

test('pending saves and previews hold editor controls until their response is applied',async t=>{
  const page=await pageFor(t);await newDraft(page,'pending-request-review');
  await page.locator('#private-notes').fill('Notes submitted once');
  for(const [endpoint,button,status] of [['save','Save draft','Draft saved atomically'],['candidate','Validate and preview candidate',null]]){
    let release,arrived;
    const gate=new Promise(resolve=>{release=resolve;});const seen=new Promise(resolve=>{arrived=resolve;});
    await page.route(`**/api/${endpoint}`,async route=>{arrived();await gate;await route.continue();});
    try{
      await page.getByRole('button',{name:button,exact:true}).click();await seen;
      for(const selector of ['#private-notes','#dossier-json','#new-id','#event-choice','#draft-choice','#reopen','#download'])assert.equal(await page.locator(selector).isDisabled(),true,selector);
      assert.equal(await page.locator('main').getAttribute('aria-busy'),'true');
      release();
      await page.waitForFunction(()=>!document.querySelector('main').hasAttribute('aria-busy'));
      assert.equal(await page.locator('#private-notes').isEnabled(),true);
      assert.equal(await page.locator('#private-notes').inputValue(),'Notes submitted once');
      if(status)assert.match(await page.locator('#status').textContent(),new RegExp(status));
      else assert.equal(await page.locator('#download').isEnabled(),true);
    }finally{release();await page.unroute(`**/api/${endpoint}`);}
  }
});

test('research desk retains both appearances at narrow and wide reading widths',async t=>{
  const page=await pageFor(t);await newDraft(page,'appearance-review');
  for(const width of [390,1280])for(const appearance of ['dark','light']){
    await page.setViewportSize({width,height:900});await page.locator('#reading-appearance').selectOption(appearance);
    await fitsReadingWidth(page,`event ${width} ${appearance}`);
    if(process.env.ATLAS_SCREENSHOT_DIR){
      await mkdir(process.env.ATLAS_SCREENSHOT_DIR,{recursive:true});await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`curator-${width}-${appearance}.png`)});
      await page.locator('#intake-title').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.ATLAS_SCREENSHOT_DIR,`curator-intake-${width}-${appearance}.png`)});
    }
  }
});

test('fallback font metrics and larger text do not widen the private research desk',async t=>{
  const page=await pageFor(t,390);await newDraft(page,'fallback-width-review');
  const labels=await page.locator('#draft-choice option').allTextContents();
  assert.ok(labels.includes('El Reno, Oklahoma · May 31, 2013 (fallback-width-review)'));
  for(const family of ['Arial, sans-serif','Georgia, serif','monospace'])for(const size of [16,24]){
    await page.evaluate(({family,size})=>{document.documentElement.style.setProperty('--interface-font',family);document.body.style.fontSize=`${size}px`;},{family,size});
    await fitsReadingWidth(page,`${family} ${size}px`);
  }
  assert.deepEqual(await page.locator('#draft-choice option').allTextContents(),labels);
  await page.locator('#draft-choice').focus();await page.locator('#draft-choice').press('Home');
  assert.equal(await page.locator('#draft-choice').inputValue(),'');
  const lastValue=await page.locator('#draft-choice option').last().getAttribute('value');
  await page.locator('#draft-choice').press('End');assert.equal(await page.locator('#draft-choice').inputValue(),lastValue);
  assert.equal(await page.locator('#current-title').textContent(),'El Reno, Oklahoma · May 31, 2013');
});

test('installed Inter supplies curator interface glyphs while code and museum headings stay distinct',{
  skip:process.env.ATLAS_REQUIRE_INTER!=='1'||process.env.ATLAS_BROWSER_ENGINE==='webkit'
},async t=>{
  const page=await pageFor(t);await page.evaluate(()=>document.fonts.ready);
  const session=await page.context().newCDPSession(page);
  try{
    await session.send('DOM.enable');await session.send('CSS.enable');const {root}=await session.send('DOM.getDocument');
    for(const appearance of ['dark','light']){
      await page.locator('#reading-appearance').selectOption(appearance);
      for(const [selector,face] of [['main > p','Inter-Regular'],['label[for="reading-appearance"]','Inter-SemiBold'],['#drafts-title','Inter-Bold']]){
        const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
        const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
        assert.ok(fonts.some(f=>f.postScriptName===face&&f.glyphCount>0),JSON.stringify(fonts));
        console.log(JSON.stringify({appearance,scope:'curator interface',selector,fonts}));
      }
    }
    assert.match(await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily),/Georgia/);
    await newDraft(page,'font-surface-review');
    assert.match(await page.locator('#dossier-json').evaluate(el=>getComputedStyle(el).fontFamily),/monospace/);
  }finally{await session.detach();}
});
