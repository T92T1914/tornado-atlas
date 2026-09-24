import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

// Serve the checked-in exhibit in an owned loopback server. No user profile,
// display capture, clipboard, media playback or external tile service is used.
const root=fileURLToPath(new URL('../../web/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
  '.css':'text/css','.json':'application/json','.gz':'application/gzip',
  '.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
let browser,server,base;
before(async()=>{
  server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    try{const info=await stat(file);if(!info.isFile())throw Error('Not a file');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
      createReadStream(file).pipe(res);
    }catch{res.writeHead(404).end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,chromiumSandbox:true,
    ...(process.env.ATLAS_BROWSER_EXECUTABLE?{executablePath:process.env.ATLAS_BROWSER_EXECUTABLE}:
      process.env.ATLAS_BROWSER_CHANNEL?{channel:process.env.ATLAS_BROWSER_CHANNEL}:{}),
    args:['--mute-audio','--disable-gpu']});
  console.log(`Isolated browser: ${browser.version()}`);
});
after(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});

async function fixture(t,options={}){
  const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:false,permissions:[],...options});
  t.after(()=>context.close());
  // Keep ordinary checks deterministic and prevent external protocol navigation.
  await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(()=>assert.deepEqual(errors,[],'Uncaught page errors'));
  page.setDefaultTimeout(10000);
  return page;
}
async function open(page,suffix=''){
  await page.goto(base+'/atlas.html?layer=local'+suffix);
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
}
async function search(page,text){await page.locator('#query').fill(text);await page.locator('#query').press('Enter');}
async function select(page,id){await page.locator(`#results [data-record="${id}"]`).click();}
async function detail(page,id){
  await page.waitForFunction(id=>document.querySelector('#detail .eyebrow')?.textContent===id&&!!document.querySelector('#detail .source-link'),id);
}
async function photo(page,id){
  await page.waitForFunction(id=>new URL(location.href).searchParams.get('media')===id&&document.querySelector('#photo-dialog').open&&document.querySelector('#photo-full').naturalWidth>0,id);
}

test('search, source details, map selection and photographs retain identity through history',async t=>{
  const page=await fixture(t);await open(page);await search(page,'El Reno');
  await select(page,'ncei:453682');await detail(page,'ncei:453682');
  assert.equal(await page.locator('#detail h2').textContent(),'Calumet, Oklahoma');
  await page.getByText('Source details, measurements and provenance',{exact:true}).click();
  assert.match(await page.locator('#detail dl').textContent(),/Reported start-98.096, 35.485/);
  await page.locator('[data-photo="storm-1"]').click();await photo(page,'storm-1');
  await page.getByRole('button',{name:'Next photograph',exact:true}).click();await photo(page,'storm-2');
  assert.equal(await page.locator('.photo-count').textContent(),'Photograph 2 of 2');
  await page.goBack();await photo(page,'storm-1');
  await page.goForward();await photo(page,'storm-2');
  await page.locator('#photo-close').click();await page.locator('#back-list').click();
  await page.locator('#world-map .catalogue-pin[data-record="ncei:453682"]').click();
  await detail(page,'ncei:453682');assert.equal(await page.locator('#selected-panel').isVisible(),true);
  assert.match(page.url(),/#record=ncei%3A453682/);
});

test('narrow views and appearance changes preserve keyboard-selected records',async t=>{
  const page=await fixture(t,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await open(page);await search(page,'El Reno');await page.locator('#show-list').click();
  const row=page.locator('#results [data-record="ncei:453682"]');await row.focus();await row.press('Enter');await detail(page,'ncei:453682');
  for(const theme of ['light','dark']){
    await page.locator('#reading-appearance').selectOption(theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#show-map').click();await page.locator('#show-detail').click();
    assert.equal(await page.locator('#detail .eyebrow').textContent(),'ncei:453682');
  }
});

test('an obsolete source link stops reporting an error after a valid record is selected',async t=>{
  const page=await fixture(t);await open(page,'#record=ncei%3Ano-such-source');
  assert.match(await page.locator('[role=alert]:visible').textContent(),/That source ID is not in this catalogue/);
  await search(page,'El Reno');await select(page,'ncei:453682');await detail(page,'ncei:453682');
  assert.equal(await page.locator('[role=alert]:visible').count(),0);
});

test('clearing an obsolete link leaves an unrelated media failure visible',async t=>{
  const page=await fixture(t);
  await page.route('**/catalogue/media.json',route=>route.fulfill({status:503,body:'Unavailable'}));
  await open(page,'#record=ncei%3Ano-such-source');await page.locator('#reset').click();
  const messages=await page.locator('[role=alert]:visible').allTextContents();
  assert.equal(messages.length,1);assert.match(messages[0],/Photograph links could not load/);
  assert.equal(await page.locator('#has-media').isDisabled(),true);
});

test('failed record details can be retried without losing the selected source',async t=>{
  const page=await fixture(t);let requests=0;
  await page.route('**/catalogue/details/*',route=>++requests===1?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await open(page);await search(page,'El Reno');await select(page,'ncei:453682');
  await page.getByRole('button',{name:'Retry this record'}).click();await detail(page,'ncei:453682');
  assert.equal(requests,2);assert.equal(await page.getByRole('button',{name:'Retry this record'}).count(),0);
});

test('a failed photograph keeps its credit and retries the selected image',async t=>{
  const page=await fixture(t);let failing=true;
  await page.route('**/assets/el-reno-2013/storm01.jpg',route=>failing?route.fulfill({status:503,body:'Unavailable'}):route.continue());
  await open(page);await search(page,'El Reno');await select(page,'ncei:453682');await detail(page,'ncei:453682');
  await page.locator('[data-photo="storm-1"]').click();await page.locator('#photo-retry').waitFor({state:'visible'});
  assert.equal(await page.locator('#photo-credit').textContent(),'Daniel Rodriguez');
  failing=false;await page.locator('#photo-retry').click();await photo(page,'storm-1');
  assert.equal(await page.locator('#photo-failure').isVisible(),false);
});
