import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

async function probe(page){
 await page.addInitScript(()=>{
  const originalReplace=History.prototype.replaceState,nativeSet=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window);
  const state=window.labHistoryProbe={writes:[],attempts:0,quotaHits:0,hold:false,held:new Map(),retired:[],next:1000000000,refuseNext:false};
  History.prototype.replaceState=function(...args){
   state.attempts++;const now=performance.now(),recent=state.writes.filter(row=>now-row.at<10000);
   if(state.refuseNext){state.refuseNext=false;throw new DOMException('Controlled history write refusal','SecurityError');}
   if(recent.length>=100){state.quotaHits++;throw new DOMException('Controlled 100 history replacements per 10 seconds','SecurityError');}
   state.writes.push({at:now,url:String(args[2])});return originalReplace.apply(this,args);
  };
  window.setTimeout=function(callback,delay,...args){
   if(state.hold&&typeof callback==='function'&&delay>0&&delay<=250){const id=++state.next;state.held.set(id,()=>callback(...args));return id;}
   return nativeSet(callback,delay,...args);
  };
  window.clearTimeout=function(id){
   if(state.held.has(id)){state.retired.push(state.held.get(id));state.held.delete(id);return;}
   return nativeClear(id);
  };
 });
}
async function ready(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function input(page,id,value){await page.locator('#'+id).evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
async function burst(page,id,last){return page.evaluate(({id,last})=>{
 const control=document.getElementById(id),start=performance.now(),before=window.labHistoryProbe.writes.length;
 for(let i=0;i<=last;i++){control.value=id==='sequence-time'?i/1000:i;control.dispatchEvent(new Event('input',{bubbles:true}));}
 return {elapsed:performance.now()-start,before,writes:window.labHistoryProbe.writes.length-before};
},{id,last});}
async function staleCallbacks(page){return page.evaluate(()=>{
 const before=location.href,callbacks=window.labHistoryProbe.retired.splice(0);
 for(const callback of callbacks)callback();return {before,after:location.href,callbacks:callbacks.length};
});}
async function paused(page,kind){
 assert.equal(await page.locator(kind==='wind'?'#passage-play':'#motion').textContent(),kind==='wind'?'Play passage':'Play motion');
 if(kind==='wind')assert.equal(await page.locator('#component-play').textContent(),'Play passage');
}
test('Controlled 481-sample input burst retains live values and share link with bounded history replacements',async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 await page.goto(base+'/wind.html?event=blackwell-1955');await ready(page);
 const measured=await burst(page,'passage-time',480);
 assert.equal(await page.locator('#passage-time').inputValue(),'480');assert.equal(await page.locator('#component-time').inputValue(),'480');
 assert.equal(await page.locator('#passage-sample-480').getAttribute('aria-current'),'true');
 assert.equal(new URL(await page.locator('#lab-share').getAttribute('href')).searchParams.get('sample'),'480','The ordinary anchor follows every input without waiting for an address write');
 await page.waitForURL(url=>url.searchParams.get('sample')==='480');await paused(page,'wind');
 const record=await page.evaluate(()=>({writes:window.labHistoryProbe.writes,quotaHits:window.labHistoryProbe.quotaHits}));
 assert.equal(record.quotaHits,0);assert.ok(record.writes.length<100,'The complete rapid workload stays below the observed WebKit quota');
 assert.ok(measured.writes<=Math.floor(measured.elapsed/250)+2,'Input writes coalesce by elapsed time rather than input count');
 t.diagnostic(JSON.stringify({scope:'controlled isolated input burst, not a physical device',inputs:481,measured,total_replacements:record.writes.length}));
});
test('Controlled Form input burst retains its final authored position without history flooding',async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 await page.goto(base+'/study.html?event=el-reno-2013');await ready(page);
 await page.locator('#sequence-enabled').check();await page.locator('#sequence-coverage').selectOption('bounded');
 const measured=await burst(page,'sequence-time',800);
 assert.equal(await page.locator('#sequence-time').inputValue(),'0.8');
 const shared=new URL(await page.locator('#lab-share').getAttribute('href'));assert.equal(shared.searchParams.get('position'),'0.8');assert.equal(shared.searchParams.get('phase'),'24');
 await page.waitForURL(url=>url.searchParams.get('position')==='0.8');await paused(page,'form');
 assert.equal(await page.evaluate(()=>window.labHistoryProbe.quotaHits),0);
 assert.ok(measured.writes<=Math.floor(measured.elapsed/250)+2);
});
test('Pending same-document Forward restores its own final sample and retired callbacks cannot overwrite Back',async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 await page.goto(base+'/wind.html?event=blackwell-1955');await ready(page);
 await input(page,'passage-time',10);await page.locator('#lab-share').click();
 const original=page.url();await page.locator('#lab-event').selectOption('joplin-2011');
 await page.evaluate(()=>{window.labHistoryProbe.hold=true;for(const value of [200,201]){const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}});
 assert.ok(await page.evaluate(()=>window.labHistoryProbe.held.size>0),'An address replacement is deliberately withheld');
 assert.equal(new URL(await page.locator('#lab-share').getAttribute('href')).searchParams.get('sample'),'201');
 await page.goBack();await page.waitForFunction(()=>document.getElementById('lab-event').value==='blackwell-1955');
 assert.equal(page.url(),original);assert.equal(await page.locator('#passage-time').inputValue(),'10');
 const stale=await staleCallbacks(page);assert.ok(stale.callbacks>0);assert.equal(stale.after,stale.before,'Even a manually delivered canceled callback has no old URL ownership');
 await page.goForward();await page.waitForFunction(()=>document.getElementById('lab-event').value==='joplin-2011');
 assert.equal(await page.locator('#passage-time').inputValue(),'201');assert.equal(await page.locator('#component-time').inputValue(),'201');assert.equal(new URL(page.url()).searchParams.get('sample'),'201');
 assert.equal(await page.locator('#passage-sample-201').getAttribute('aria-current'),'true');await paused(page,'wind');
 const committed=page.url();await page.reload();await ready(page);assert.equal(page.url(),committed);assert.equal(await page.locator('#passage-time').inputValue(),'201');
});
test('Explicit share, reference and evidence boundaries commit paused Form state before navigation',async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 await page.goto(base+'/study.html?event=el-reno-2013');await ready(page);await page.locator('#sequence-enabled').check();
 await page.evaluate(()=>{window.labHistoryProbe.hold=true;});
 await input(page,'sequence-time',.2);await input(page,'sequence-time',.3);await page.locator('#lab-share').click();
 assert.equal(new URL(page.url()).searchParams.get('position'),'0.3');await paused(page,'form');
 const stale=await staleCallbacks(page);assert.equal(stale.after,stale.before);
 await input(page,'sequence-time',.4);await page.locator('#lab-event').selectOption('joplin-2011');
 assert.equal(new URL(page.url()).searchParams.get('event'),'joplin-2011');assert.equal(new URL(page.url()).searchParams.get('position'),'0.4');
 await page.goBack();await page.waitForFunction(()=>document.getElementById('lab-event').value==='el-reno-2013');assert.equal(new URL(page.url()).searchParams.get('position'),'0.4');
 await page.goForward();await page.waitForFunction(()=>document.getElementById('lab-event').value==='joplin-2011');
 await input(page,'sequence-time',.5);const exact=await page.locator('#lab-share').getAttribute('href');
 await page.locator('#lab-reference-links a').first().click();await page.waitForURL('**/joplin.html#photographs-and-film');
 await page.goBack();await ready(page);assert.equal(page.url(),exact);assert.equal(await page.locator('#sequence-time').inputValue(),'0.5');await paused(page,'form');
 const delayed=await staleCallbacks(page);assert.equal(delayed.after,delayed.before);
});
test('Immediate reload captures pending Wind assumptions before the replacement timer fires',async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 await page.goto(base+'/wind.html?event=tuscaloosa-birmingham-2011');await ready(page);
 await page.evaluate(()=>{window.labHistoryProbe.hold=true;for(const value of [349,350]){const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}});
 const exact=await page.locator('#lab-share').getAttribute('href');assert.ok(await page.evaluate(()=>window.labHistoryProbe.held.size>0));
 const retained=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname)));
 assert.equal(retained.target,exact);assert.equal(retained.base,page.url());assert.equal(retained.kind,'wind');assert.equal(retained.version,1);
 await page.reload();await ready(page);assert.equal(page.url(),exact);assert.equal(await page.locator('#passage-time').inputValue(),'350');assert.equal(await page.locator('#component-time').inputValue(),'350');await paused(page,'wind');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname)),null,'Successful URL commit retires its owned transient record');
});
test('A controlled native history refusal is preserved without a swallowed error or automatic retry',async t=>{
 const owner=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'}),page=await owner.context().newPage();await probe(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/wind.html?event=blackwell-1955');await ready(page);
 await page.evaluate(()=>{window.labHistoryProbe.hold=true;for(const value of [99,100]){const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}});
 assert.ok(await page.evaluate(()=>window.labHistoryProbe.held.size>0));
 const state=await page.evaluate(()=>{const probe=window.labHistoryProbe,attempts=probe.attempts;probe.refuseNext=true;const callbacks=[...probe.held.values()];probe.held.clear();for(const callback of callbacks)callback();return {attempts,after:probe.attempts};}).catch(error=>({observed:error.message}));
 // The deliberately refused synchronous callback must reject the evaluated operation.
 assert.ok(state.observed?.includes('Controlled history write refusal'));
 const after=await page.evaluate(()=>({attempts:window.labHistoryProbe.attempts,pending:window.labHistoryProbe.held.size,shared:new URL(document.getElementById('lab-share').href).searchParams.get('sample')}));
 assert.equal(after.pending,0);assert.equal(after.shared,'100');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.evaluate(()=>window.labHistoryProbe.attempts),after.attempts,'No blind quota retry is scheduled');
 assert.deepEqual(errors,[],'The controlled callback rejection is inspected directly, without masking an unrelated page error');
 await page.close();
});

for(const mode of ['foreign-entry','stale-base','wrong-kind','external-target','partial-target','malformed','oversized']){
 test('Pending reload record refuses '+mode+' without partial assumptions',async t=>{
  const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
  await page.goto(base+'/wind.html?event=tuscaloosa-birmingham-2011');await ready(page);const original=page.url();
  await page.addInitScript(({mode})=>{
   const key='atlasLabPendingV1:wind:'+location.pathname,raw=sessionStorage.getItem(key);if(!raw)return;
   const record=JSON.parse(raw);
   if(mode==='foreign-entry')record.entry='unrelated-history-entry';
   if(mode==='stale-base')record.base+='&unrelated=1';
   if(mode==='wrong-kind')record.kind='form';
   if(mode==='external-target')record.target='https://example.invalid/wind.html?experiment=wind-1';
   if(mode==='partial-target'){const target=new URL(record.target);target.searchParams.delete('capacity');record.target=target.href;}
   sessionStorage.setItem(key,mode==='malformed'?'{':mode==='oversized'?' '.repeat(8193):JSON.stringify(record));
  },{mode});
  await page.evaluate(()=>{window.labHistoryProbe.hold=true;for(const value of [349,350]){const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}});
  assert.equal(new URL(await page.locator('#lab-share').getAttribute('href')).searchParams.get('sample'),'350');
  await page.reload();await ready(page);assert.equal(page.url(),original);
  assert.equal(await page.locator('#passage-time').inputValue(),'0');assert.equal(await page.locator('#component-time').inputValue(),'0');
  assert.equal(await page.locator('#capacity').inputValue(),'1');await paused(page,'wind');
  assert.doesNotMatch(await page.locator('#lab-state').textContent(),/^Experiment restored/);
  if(mode!=='foreign-entry')assert.match(await page.locator('#lab-state').textContent(),/unavailable|not restored/);
 });
}
test('Unavailable pending storage remains visible while the exact experiment anchor can commit and reload',async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 await page.addInitScript(()=>{
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key.startsWith('atlasLabPendingV1:'))throw new DOMException('Controlled pending storage refusal','SecurityError');return original.call(this,key,value);};
 });
 await page.goto(base+'/wind.html?event=blackwell-1955');await ready(page);
 await page.evaluate(()=>{window.labHistoryProbe.hold=true;});await input(page,'capacity',20);
 assert.match(await page.locator('#lab-state').textContent(),/Automatic reload retention is unavailable/);
 const exact=await page.locator('#lab-share').getAttribute('href');assert.equal(new URL(exact).searchParams.get('capacity'),'20');
 await page.locator('#lab-share').click();assert.equal(page.url(),exact);
 await page.reload();await ready(page);assert.equal(page.url(),exact);assert.equal(await page.locator('#capacity').inputValue(),'20');await paused(page,'wind');
});
