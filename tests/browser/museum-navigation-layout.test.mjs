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
function observeAuditNavigation(t,page){
 const start=Date.now(),rows=[],requests=new WeakMap();let used=0,omitted=0,next=0;
 const small=value=>String(value??'').slice(0,768);
 const note=(kind,data={})=>{const row={ms:Date.now()-start,kind,...data},bytes=Buffer.byteLength(JSON.stringify(row));
  if(rows.length>=64||used+bytes>14000){omitted++;return;}used+=bytes;rows.push(row);};
 const requested=request=>{if(new URL(request.url()).pathname!=='/source-audit.json')return;
  const id=++next;requests.set(request,id);note('request',{id,url:small(request.url()),method:request.method(),resource:request.resourceType(),document:small(page.url())});};
 const responded=response=>{const id=requests.get(response.request());if(id)note('response',{id,status:response.status()});};
 const finished=request=>{const id=requests.get(request);if(id)note('finished',{id});};
 const failed=request=>{const id=requests.get(request);if(id)note('failed',{id,error:small(request.failure()?.errorText),document:small(page.url())});};
 const navigated=frame=>{if(frame===page.mainFrame())note('navigation',{url:small(frame.url())});};
 const error=value=>note('pageerror',{name:small(value.name),message:small(value.message),stack:small(value.stack),document:small(page.url())});
 const closed=()=>note('page_closed');
 for(const [name,listener] of [['request',requested],['response',responded],['requestfinished',finished],['requestfailed',failed],['framenavigated',navigated],['pageerror',error],['close',closed]])page.on(name,listener);
 t.after(()=>{
  for(const [name,listener] of [['request',requested],['response',responded],['requestfinished',finished],['requestfailed',failed],['framenavigated',navigated],['pageerror',error],['close',closed]])page.off(name,listener);
  t.diagnostic('MUSEUM_AUDIT_NAVIGATION '+JSON.stringify({rows,omitted,observedAuditRequests:next,
   scope:'Read-only request/navigation/error events. Original strict fixture assertion and all menu checks retained.'}));
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
  observeAuditNavigation(t,page);
  for(const [index,route] of variants.entries()){
    await page.goto(base+'/'+route+'.html');await page.locator('#reading-appearance:not([disabled])').waitFor();
    const theme=index%2?'light':'dark';await page.locator('#reading-appearance').selectOption(theme);
    await page.locator('.museum-nav a,.museum-nav summary').evaluateAll(nodes=>{
      for(const node of nodes)node.style.fontSize=parseFloat(getComputedStyle(node).fontSize)*2+'px';
    });
    await exercise(page,{route,theme,touch});
  }
});
