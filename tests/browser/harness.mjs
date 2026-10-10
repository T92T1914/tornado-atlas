import {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit,firefox} from 'playwright';

// Serve the checked-in exhibit in an owned loopback server. No user profile,
// display capture, clipboard, media playback or external tile service is used.
const root=fileURLToPath(new URL('../../web/',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
  '.css':'text/css','.json':'application/json','.gz':'application/gzip',
  '.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml'};
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
  const engine=process.env.ATLAS_BROWSER_ENGINE || 'chromium';
  assert.ok(['chromium','webkit','firefox'].includes(engine),'Known isolated browser engine required');
  browser=await ({chromium,webkit,firefox}[engine]).launch({headless:true,
    ...(engine!=='chromium'?{}:{chromiumSandbox:true,
    ...(process.env.ATLAS_BROWSER_EXECUTABLE?{executablePath:process.env.ATLAS_BROWSER_EXECUTABLE}:
      process.env.ATLAS_BROWSER_CHANNEL?{channel:process.env.ATLAS_BROWSER_CHANNEL}:{}),
    args:['--mute-audio','--disable-gpu']}),});
  console.log(`Isolated browser: ${browser.version()}`);
});
after(async()=>{await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});

export async function fixture(t,options={}){
  const supportedOptions={...options};
  // Firefox supports narrow viewports and touch input, but not Playwright's
  // mobile viewport mode. Keep that acceptance distinction explicit.
  if(browser.browserType().name()==='firefox') delete supportedOptions.isMobile;
  const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:false,permissions:[],...supportedOptions});
  t.after(()=>context.close());
  // Keep ordinary checks deterministic and prevent external protocol navigation.
  await context.route('**/*',route=>{
    const url=route.request().url();
    // WebKit also intercepts a checked image's owned Blob URL. It carries
    // already-read loopback bytes and does not request an external provider.
    if(url.startsWith('blob:'+base+'/')) {
      t.diagnostic('Owned loopback Blob request admitted.');
      return route.continue();
    }
    return url.startsWith(base+'/')?route.continue():route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(()=>assert.deepEqual(errors,[],'Uncaught page errors'));
  page.setDefaultTimeout(10000);
  return page;
}
function observeOpenResources(page){
  const started=Date.now(),rows=[],states=new WeakMap(),counts={requested:0,responded:0,finished:0,failed:0,pending:0,omitted:0,outside_scope:0};
  const critical=new Set(['/atlas.js','/catalogue/index.json.gz','/catalogue/index.json','/catalogue/media.json']);
  let frozen=false,ordinary=0;
  const bounded=value=>String(value??'').slice(0,256);
  const elapsed=()=>Date.now()-started;
  const request=req=>{
    if(frozen||states.has(req))return;
    const url=new URL(req.url());
    if(url.origin!==new URL(base).origin){counts.outside_scope++;return;}
    const state={responded:false,terminal:false,row:null};states.set(req,state);counts.requested++;counts.pending++;
    const isCritical=critical.has(url.pathname);
    if(rows.length>=64||!isCritical&&ordinary>=48){counts.omitted++;return;}
    state.row={path:bounded(url.pathname),type:bounded(req.resourceType()),critical:isCritical,started_ms:elapsed(),state:'requested',status:null};
    rows.push(state.row);if(!isCritical)ordinary++;
  };
  const response=res=>{
    if(frozen)return;const state=states.get(res.request());if(!state)return;
    if(!state.responded){state.responded=true;counts.responded++;}
    if(state.row){state.row.status=res.status();state.row.response_ms=elapsed();if(!state.terminal)state.row.state='responded';}
  };
  const terminal=(req,failed)=>{
    if(frozen)return;const state=states.get(req);if(!state||state.terminal)return;
    state.terminal=true;counts.pending--;counts[failed?'failed':'finished']++;
    if(state.row){state.row.state=failed?'failed':'finished';state.row.terminal_ms=elapsed();if(failed)state.row.failure=bounded(req.failure()?.errorText);}
  };
  const finished=req=>terminal(req,false),failed=req=>terminal(req,true);
  page.on('request',request);page.on('response',response);page.on('requestfinished',finished);page.on('requestfailed',failed);
  const stop=()=>{page.off('request',request);page.off('response',response);page.off('requestfinished',finished);page.off('requestfailed',failed);};
  return {stop,freeze:()=>{frozen=true;return {elapsed_ms:elapsed(),counters:{...counts},resources:rows.map(row=>({...row})),limits:{resource_rows:64,ordinary_resource_rows:48,field_characters:256,max_json_bytes:16384,dom_snapshot_ms:500}};}};
}
function openRoute(value){
  try{const url=new URL(value),layer=url.searchParams.get('layer'),record=new URLSearchParams(url.hash.slice(1)).get('record');
    return {path:url.pathname.slice(0,256),layer:layer?.slice(0,256)??null,record:record?.slice(0,256)??null};
  }catch{return {path:'unavailable',layer:null,record:null};}
}
async function boundedOpenSnapshot(page){
  let timer;
  try{return {status:'observed',state:await Promise.race([
    page.evaluate(()=>{
      const read=id=>{const node=document.getElementById(id);if(!node)return {present:false};const style=getComputedStyle(node);
        return {present:true,visible:!node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&node.getClientRects().length>0,text:node.textContent.slice(0,256)};};
      return {captured_at_ms:performance.now(),document_ready_state:document.readyState,body_ready:document.body?.dataset.ready??null,
        atlas_ready_mark:performance.getEntriesByName('atlas-ready').length>0,error:read('error'),record_error:read('record-error'),retry_catalogue:read('retry-catalogue'),coverage:read('coverage')};
    }),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned DOM diagnostic exceeded 500 milliseconds')),500);})
  ])};}catch(error){
    const snapshot={status:'unavailable',error_name:error.name,error_message:String(error.message).slice(0,256),owned_context_cleanup:'not_needed'};
    if(error.message==='Owned DOM diagnostic exceeded 500 milliseconds'){
      let closeTimer;try{await Promise.race([page.context().close(),new Promise((_,reject)=>{closeTimer=setTimeout(()=>reject(new Error('Owned diagnostic context closure unconfirmed after 500 milliseconds')),500);})]);snapshot.owned_context_cleanup='closed';}
      catch(closeError){snapshot.owned_context_cleanup='unconfirmed';snapshot.cleanup_error=String(closeError.message).slice(0,256);}finally{clearTimeout(closeTimer);}
    }
    return snapshot;
  }finally{clearTimeout(timer);}
}
function printOpenDiagnostic(record){
  let text=JSON.stringify(record);record.json_resource_rows_omitted=0;
  while(Buffer.byteLength(text,'utf8')>16384&&record.resources.length){
    const ordinary=record.resources.findIndex(row=>!row.critical);record.resources.splice(ordinary>=0?ordinary:record.resources.length-1,1);
    record.json_resource_rows_omitted++;text=JSON.stringify(record);
  }
  text=JSON.stringify(record);
  // All scalar and DOM text fields have fixed caps; resource rows are optional.
  if(Buffer.byteLength(text,'utf8')>16384)text=JSON.stringify({phase:record.phase,error_name:record.error_name,error_message:record.error_message,diagnostic:'Size bound exceeded; detailed snapshot omitted',counters:record.counters,limits:record.limits});
  console.error('ATLAS_OPEN_FAILURE_DIAGNOSTIC '+text);
}
export async function open(page,suffix=''){
  const requested=base+'/atlas.html?layer=local'+suffix,observer=observeOpenResources(page);
  let phase='navigation',navigation_ms=null;
  const start=Date.now();
  try{
    await page.goto(base+'/atlas.html?layer=local'+suffix);
    navigation_ms=Date.now()-start;phase='application_ready';
    await page.waitForFunction(()=>document.body.dataset.ready==='true');
  }catch(error){
    const record={...observer.freeze(),phase,navigation_ms,requested_route:openRoute(requested),observed_route:openRoute(page.url()),error_name:error.name,error_message:String(error.message).slice(0,256),resource_snapshot_at_original_failure:true};
    observer.stop();
    try{record.dom=await boundedOpenSnapshot(page);record.listener_cleanup='removed';printOpenDiagnostic(record);}
    catch(diagnosticError){console.error('ATLAS_OPEN_FAILURE_DIAGNOSTIC '+JSON.stringify({phase,error_name:error.name,error_message:String(error.message).slice(0,256),diagnostic_error:String(diagnosticError.message).slice(0,256),original_failure_retained:true}));}
    throw error;
  }finally{observer.stop();}
}
export async function search(page,text){await page.locator('#query').fill(text);await page.locator('#query').press('Enter');}
export async function select(page,id){await page.locator(`#results [data-record="${id}"]`).click();}
export async function detail(page,id){
  await page.waitForFunction(id=>document.querySelector('#detail .eyebrow')?.textContent===id&&!!document.querySelector('#detail .source-link'),id);
}
export async function photo(page,id){
  await page.waitForFunction(id=>new URL(location.href).searchParams.get('media')===id&&document.querySelector('#photo-dialog').open&&document.querySelector('#photo-full').naturalWidth>0,id);
}
