import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fixture,base} from './harness.mjs';

const routes=['atlas','index','joplin','blackwell','tuscaloosa','moore','udall','dossier','coverage',
  'reconstruction','survey','radar-source','study','wind','japan','curator'];
const variants=['index','atlas','dossier','curator'];

// Read-only bounded evidence for the previously unexplained WebKit audit error.
// The fixture's original uncaught-page-error assertion remains unchanged.
async function observeAuditNavigation(t,page){
 const start=Date.now(),rows=[],requests=new WeakMap();let used=0,omitted=0,next=0,disposed=false,reportedError=false;
 const small=value=>String(value??'').slice(0,768);
 const note=(kind,data={})=>{const row={ms:Date.now()-start,kind,...data},bytes=Buffer.byteLength(JSON.stringify(row));
  if(rows.length>=64||used+bytes>14000){omitted++;return;}used+=bytes;rows.push(row);};
 const requested=request=>{if(new URL(request.url()).pathname!=='/source-audit.json')return;
  const id=++next;requests.set(request,id);note('request',{id,url:small(request.url()),method:request.method(),resource:request.resourceType(),document:small(page.url())});};
 const responded=response=>{const id=requests.get(response.request());if(id)note('response',{id,status:response.status()});};
 const finished=request=>{const id=requests.get(request);if(id)note('finished',{id});};
 const failed=request=>{const id=requests.get(request);if(id)note('failed',{id,error:small(request.failure()?.errorText),document:small(page.url())});};
 const navigated=frame=>{if(frame===page.mainFrame())note('navigation',{url:small(frame.url())});};
 const report=reason=>t.diagnostic('MUSEUM_AUDIT_NAVIGATION '+JSON.stringify({reason,rows,omitted,observedAuditRequests:next,
  scope:'Read-only protocol and bounded document events. Document snapshots do not expose fetch creation or Promise settlement. Original strict fixture assertion and all menu checks retained.',
  limits:{rows:64,row_bytes:14000,field_characters:768,document_events:8,document_payload_characters:4096}}));
 const error=value=>{note('pageerror',{name:small(value.name),message:small(value.message),stack:small(value.stack),document:small(page.url())});
  if(!reportedError){reportedError=true;report('first page error');}};
 const documentEvent=message=>{
  const prefix='MUSEUM_AUDIT_DOCUMENT ',text=message.text();
  if(message.type()!=='debug'||!text.startsWith(prefix))return;
  if(text.length>4096){omitted++;return;}
  try{
   const row=JSON.parse(text.slice(prefix.length));
   if(!row||!['observer_ready','error','unhandledrejection','rejectionhandled','pagehide','pageshow'].includes(row.event)
     ||!Number.isInteger(row.sequence)||row.sequence<1||row.sequence>8
     ||!Number.isFinite(row.document_time_origin)||!Number.isFinite(row.document_ms)
     ||row.path!=='/index.html'||!['loading','interactive','complete'].includes(row.ready)
     ||!['visible','hidden'].includes(row.visibility)||!['missing','empty','report','fallback','other'].includes(row.audit)
     ||![true,false,null].includes(row.persisted)
     ||!['name','message'].every(key=>row[key]===null||typeof row[key]==='string'&&row[key].length<=768))throw new Error('Unexpected document observation shape');
   note('document_event',{event:row.event,sequence:row.sequence,document_time_origin:row.document_time_origin,document_ms:row.document_ms,
    path:row.path,ready:row.ready,visibility:row.visibility,audit:row.audit,persisted:row.persisted,name:row.name,message:row.message});
  }catch{omitted++;}
 };
 const closed=()=>{note('page_closed');retire();};
 const listeners=[['request',requested],['response',responded],['requestfinished',finished],['requestfailed',failed],['framenavigated',navigated],['pageerror',error],['console',documentEvent],['close',closed]];
 function retire(){
  if(disposed)return;disposed=true;
  for(const [name,listener] of listeners)page.off(name,listener);
  report('observer retired');
 }
 for(const [name,listener] of listeners)page.on(name,listener);
 // A failing earlier after hook can prevent a later hook from running. Retire
 // on the owned page close too, and report the first error before that boundary.
 t.after(retire);
 await page.addInitScript(()=>{
  if(window!==window.top||location.pathname!=='/index.html')return;
  let count=0;
  const auditState=()=>{
   const node=document.getElementById('link-audit-summary');
   if(!node)return 'missing';
   const text=node.querySelector('p')?.textContent??node.textContent??'';
   if(text==='The link audit could not be loaded. Its preserved file is linked below.')return 'fallback';
   if(text.startsWith('Link access checked '))return 'report';
   return text.trim()?'other':'empty';
  };
  const observe=event=>{
   if(count>=8)return;
   const reason=event.type==='error'?event.error:event.reason;
   const small=value=>typeof value==='string'?value.slice(0,768):null;
   console.debug('MUSEUM_AUDIT_DOCUMENT '+JSON.stringify({event:event.type,sequence:++count,
    document_time_origin:performance.timeOrigin,document_ms:performance.now(),path:location.pathname,
    ready:document.readyState,visibility:document.visibilityState,audit:auditState(),
    persisted:['pagehide','pageshow'].includes(event.type)?event.persisted:null,
    name:reason instanceof Error?small(reason.name):null,
    message:event.type==='error'?small(event.message):reason instanceof Error?small(reason.message):small(reason)}));
  };
  // These listeners neither handle a Promise nor cancel an event. They retire
  // with the owned document. The snapshot does not inspect fetch internals.
  for(const type of ['error','unhandledrejection','rejectionhandled','pagehide','pageshow'])window.addEventListener(type,observe,{capture:true,passive:true});
  observe({type:'observer_ready'});
 });
}

async function layout(page){
  return page.evaluate(()=>{
    const nav=document.querySelector('.museum-nav');
    const box=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    const visible=node=>{
      for(let details=node.parentElement.closest('details');details;details=details.parentElement?.closest('details')){
        if(!details.open&&!details.querySelector(':scope > summary')?.contains(node))return false;
      }
      return node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';
    };
    const controls=[...nav.closest('header').querySelectorAll('a,summary,select,button,input')]
      .filter(visible).map(node=>({label:node.textContent.trim().slice(0,80),...box(node)}));
    const collisions=[];
    for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
      const a=controls[i],b=controls[j];
      if(Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&
        Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1)collisions.push([a.label,b.label]);
    }
    const summaries=[...nav.querySelectorAll(':scope > details > summary')].map(box);
    const open=nav.querySelector(':scope > details[open]');
    const panel=open?box(open.querySelector('.museum-menu')):null;
    const fragments=open?[...open.querySelectorAll('a')].flatMap(node=>{
      const range=document.createRange();range.selectNodeContents(node);
      return [...range.getClientRects()].filter(r=>r.width>0).map(r=>({left:r.left,right:r.right}));
    }):[];
    return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,
      summaries,panel,collisions,fragments,headerBottom:nav.closest('header').getBoundingClientRect().bottom};
  });
}

async function exercise(page,context){
  const groups=page.locator('.museum-nav > details');
  for(let index=0;index<3;index++){
    // Start closed so normal-flow collapse of an earlier panel is not confused
    // with the selected heading being reordered by its own open state.
    await groups.evaluateAll(nodes=>nodes.forEach(node=>node.open=false));
    const before=await layout(page),summary=groups.nth(index).locator(':scope > summary');
    if(context.touch)await summary.tap();else {await summary.focus();await page.keyboard.press(index===1?'Space':'Enter');}
    assert.equal(await groups.evaluateAll(nodes=>nodes.filter(node=>node.open).length),1);
    const actual=await layout(page),message=JSON.stringify({context,index,actual});
    assert.equal(actual.overflow,false,message);
    assert.deepEqual(actual.collisions,[],message);
    assert.ok(actual.panel.top>=actual.summaries[index].bottom-1,message);
    if(actual.width<=760){
      assert.ok(Math.abs(actual.summaries[index].top-before.summaries[index].top)<=1,
        'Opening must not reorder the selected heading: '+message);
      assert.ok(actual.headerBottom>=actual.panel.bottom-1,'Phone menu stays in document flow: '+message);
    }else assert.ok(actual.panel.top>=Math.max(...actual.summaries.map(r=>r.bottom))-1,
      'A wrapped toolbar must remain clear of its open panel: '+message);
    for(const fragment of actual.fragments)assert.ok(fragment.left>=-1&&fragment.right<=actual.width+1,message);
    if(process.env.ATLAS_NAV_LAYOUT_CAPTURE_DIR&&index===2&&['index','atlas'].includes(context.route)&&[320,1280].includes(actual.width)){
      await mkdir(process.env.ATLAS_NAV_LAYOUT_CAPTURE_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.ATLAS_NAV_LAYOUT_CAPTURE_DIR,
        context.route+'-'+actual.width+'-'+context.theme+'.png'),
        clip:{x:0,y:0,width:actual.width,height:Math.min(1400,Math.ceil(Math.max(actual.headerBottom,actual.panel.bottom)+16))}});
    }
  }
}

for(const width of [320,1280])test('Every native museum header has clear panels '+width,{timeout:90000},async t=>{
  const page=await fixture(t,{viewport:{width,height:1000},javaScriptEnabled:false});
  for(const route of routes){await page.goto(base+'/'+route+'.html');await exercise(page,{route,theme:'dark',touch:false});}
});

for(const width of [320,600,601,760,761,1280])test('Responsive enlarged museum panels '+width,{timeout:60000},async t=>{
  const touch=width<=760;
  const page=await fixture(t,{viewport:{width,height:1000},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});
  await observeAuditNavigation(t,page);
  for(const [index,route] of variants.entries()){
    await page.goto(base+'/'+route+'.html');await page.locator('#reading-appearance:not([disabled])').waitFor();
    const theme=index%2?'light':'dark';await page.locator('#reading-appearance').selectOption(theme);
    await page.locator('.museum-nav a,.museum-nav summary').evaluateAll(nodes=>{
      for(const node of nodes)node.style.fontSize=parseFloat(getComputedStyle(node).fontSize)*2+'px';
    });
    await exercise(page,{route,theme,touch});
  }
});
