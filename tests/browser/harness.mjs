import {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit} from 'playwright';

// Serve the checked-in exhibit in an owned loopback server. No user profile,
// display capture, clipboard, media playback or external tile service is used.
const root=fileURLToPath(new URL('../../web/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
  '.css':'text/css','.json':'application/json','.gz':'application/gzip',
  '.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
let browser,server;
export let base;
before(async()=>{
  server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname.replace(/^\/tornado-atlas(?=\/)/,'');
    const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root.endsWith(path.sep)?root:root+path.sep)){res.writeHead(403).end();return;}
    try{const info=await stat(file);if(!info.isFile())throw Error('Not a file');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
      createReadStream(file).pipe(res);
    }catch{res.writeHead(404).end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  browser=await (process.env.ATLAS_BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true,
    ...(process.env.ATLAS_BROWSER_ENGINE==='webkit'?{}:{chromiumSandbox:true,
    ...(process.env.ATLAS_BROWSER_EXECUTABLE?{executablePath:process.env.ATLAS_BROWSER_EXECUTABLE}:
      process.env.ATLAS_BROWSER_CHANNEL?{channel:process.env.ATLAS_BROWSER_CHANNEL}:{}),
    args:['--mute-audio','--disable-gpu']}),});
  console.log(`Isolated browser: ${browser.version()}`);
});
after(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});

export async function fixture(t,options={}){
  const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:false,permissions:[],...options});
  t.after(()=>context.close());
  // Keep ordinary checks deterministic and prevent external protocol navigation.
  await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(()=>assert.deepEqual(errors,[],'Uncaught page errors'));
  page.setDefaultTimeout(10000);
  return page;
}
export async function open(page,suffix=''){
  await page.goto(base+'/atlas.html?layer=local'+suffix);
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
}
export async function search(page,text){await page.locator('#query').fill(text);await page.locator('#query').press('Enter');}
export async function select(page,id){await page.locator(`#results [data-record="${id}"]`).click();}
export async function detail(page,id){
  await page.waitForFunction(id=>document.querySelector('#detail .eyebrow')?.textContent===id&&!!document.querySelector('#detail .source-link'),id);
}
export async function photo(page,id){
  await page.waitForFunction(id=>new URL(location.href).searchParams.get('media')===id&&document.querySelector('#photo-dialog').open&&document.querySelector('#photo-full').naturalWidth>0,id);
}
