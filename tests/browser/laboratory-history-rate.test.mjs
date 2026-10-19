import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture,base} from './harness.mjs';

async function probe(page,{logicalClock=false}={}){
 await page.addInitScript(logicalClock=>{
  const originalReplace=History.prototype.replaceState,nativeSet=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window);
  const state=window.labHistoryProbe={writes:[],attempts:0,quotaHits:0,hold:false,held:new Map(),retired:[],next:1000000000,refuseNext:false,now:1000};
  // Refusal controls need an owned pending record even when a real input handler
  // takes longer than the history interval. Measured burst tests keep real time.
  if(logicalClock)Object.defineProperty(performance,'now',{configurable:true,value:()=>state.now});
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
 },logicalClock);
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
test('Controlled 481-sample input burst retains live values and share link with bounded history replacements',{timeout:30000},async t=>{
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
test('Controlled Form input burst retains its final authored position without history flooding',{timeout:30000},async t=>{
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
test('Pending same-document Forward restores its own final sample and retired callbacks cannot overwrite Back',{timeout:30000},async t=>{
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
test('Explicit share, reference and evidence boundaries commit paused Form state before navigation',{timeout:30000},async t=>{
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
test('Immediate reload captures pending Wind assumptions before the replacement timer fires',{timeout:30000},async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 await page.goto(base+'/wind.html?event=tuscaloosa-birmingham-2011');await ready(page);
 await page.evaluate(()=>{window.labHistoryProbe.hold=true;for(const value of [349,350]){const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}});
 const exact=await page.locator('#lab-share').getAttribute('href');assert.ok(await page.evaluate(()=>window.labHistoryProbe.held.size>0));
 const retained=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname)));
 assert.equal(retained.target,exact);assert.equal(retained.base,page.url());assert.equal(retained.kind,'wind');assert.equal(retained.version,1);
 await page.reload();await ready(page);assert.equal(page.url(),exact);assert.equal(await page.locator('#passage-time').inputValue(),'350');assert.equal(await page.locator('#component-time').inputValue(),'350');await paused(page,'wind');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname)),null,'Successful URL commit retires its owned transient record');
});
test('A controlled native history refusal is preserved without a swallowed error or automatic retry',{timeout:30000},async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/wind.html?event=blackwell-1955');await ready(page);
 await page.evaluate(()=>{window.labHistoryProbe.hold=true;for(const value of [99,100]){const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}});
 assert.ok(await page.evaluate(()=>window.labHistoryProbe.held.size>0));
 const state=await page.evaluate(()=>{const probe=window.labHistoryProbe,attempts=probe.attempts;probe.refuseNext=true;const callbacks=[...probe.held.values()];probe.held.clear();for(const callback of callbacks)callback();return {attempts,after:probe.attempts};}).catch(error=>({observed:error.message}));
 // The deliberately refused synchronous callback must reject the evaluated operation.
 assert.ok(state.observed?.includes('Controlled history write refusal'));
 const after=await page.evaluate(()=>({attempts:window.labHistoryProbe.attempts,pending:window.labHistoryProbe.held.size,shared:new URL(document.getElementById('lab-share').href).searchParams.get('sample')}));
 assert.equal(after.pending,0);assert.equal(after.shared,'100');
 await delay(350);
 assert.equal(await page.evaluate(()=>window.labHistoryProbe.attempts),after.attempts,'No blind quota retry was attempted');
 assert.equal(await page.evaluate(()=>window.labHistoryProbe.held.size),0,'No deferred quota retry was scheduled');
 assert.deepEqual(errors,[],'The controlled callback rejection is inspected directly, without masking an unrelated page error');

});

// These defaults are the independently stated Wind laboratory contract, not read from its generated state.
const refusalDefaults={peak:'100',radius:'500',background:'0','probe-x':'1','probe-y':'0',area:'1',coefficient:'1.2',travel:'30',offset:'1',threshold:'50',capacity:'1'};
const refusalCases=['foreign-entry','stale-base','wrong-kind','external-target','partial-target','malformed','oversized'].map(mode=>({mode,committed:false}));
refusalCases.push({mode:'wrong-kind',committed:true});
for(const {mode,committed} of refusalCases){
 test('Pending reload record refuses '+mode+' without partial assumptions'+(committed?' after a controlled elapsed interval':''),{timeout:30000},async t=>{
  const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page,{logicalClock:true});
  await page.goto(base+'/wind.html?event=tuscaloosa-birmingham-2011');await ready(page);const original=page.url();
  const committed349=new URL(original);committed349.search=new URLSearchParams({experiment:'wind-1',event:'tuscaloosa-birmingham-2011',...refusalDefaults,sample:'349'}).toString();
  const pending350=new URL(committed349);pending350.searchParams.set('sample','350');
  await page.addInitScript(({mode})=>{
   const key='atlasLabPendingV1:wind:'+location.pathname,raw=sessionStorage.getItem(key);
   window.labPendingMutation={mode,ran:false};if(!raw)return;
   const record=JSON.parse(raw),before={...record};
   if(mode==='foreign-entry')record.entry='unrelated-history-entry';
   if(mode==='stale-base')record.base+='&unrelated=1';
   if(mode==='wrong-kind')record.kind='form';
   if(mode==='external-target')record.target='https://example.invalid/wind.html?experiment=wind-1';
   if(mode==='partial-target'){const target=new URL(record.target);target.searchParams.delete('capacity');record.target=target.href;}
   const after=mode==='malformed'?'{':mode==='oversized'?' '.repeat(8193):JSON.stringify(record);
   sessionStorage.setItem(key,after);window.labPendingMutation={mode,ran:true,before,after};
  },{mode});
  const before=await page.evaluate(committed=>{
   window.labHistoryProbe.now=committed?1300:1000;
   window.labHistoryProbe.hold=true;for(const value of [349,350]){const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}
   return {url:location.href,logical_now:performance.now(),pending:JSON.parse(sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname)),held:window.labHistoryProbe.held.size,entry:history.state.atlasLabEntryV1+'|'+location.hash,share:document.getElementById('lab-share').href,sample:document.getElementById('passage-time').value,component:document.getElementById('component-time').value};
  },committed);
  t.diagnostic(JSON.stringify({scope:'controlled source-clock precondition, not measured handler duration',mode,committed,before}));
  assert.equal(before.logical_now,committed?1300:1000);
  assert.equal(before.url,committed?committed349.href:original,'The declared schedule retains its exact reference0 or complete349 baseline');
  const expectedSample=committed?'349':'0';
  assert.ok(before.held>0,'A real pending replacement must be withheld for this refusal control');
  assert.deepEqual(before.pending,{version:1,kind:'wind',entry:before.entry,base:before.url,target:pending350.href});
  assert.equal(before.share,pending350.href);assert.equal(before.sample,'350');assert.equal(before.component,'350');
  await page.reload();await ready(page);
  const mutation=await page.evaluate(()=>window.labPendingMutation);assert.equal(mutation?.ran,true,'Reload corruption actually ran');assert.equal(mutation.mode,mode);assert.deepEqual(mutation.before,before.pending);
  const expectedCorruption={...before.pending};
  if(mode==='foreign-entry')expectedCorruption.entry='unrelated-history-entry';
  if(mode==='stale-base')expectedCorruption.base+='&unrelated=1';
  if(mode==='wrong-kind')expectedCorruption.kind='form';
  if(mode==='external-target')expectedCorruption.target='https://example.invalid/wind.html?experiment=wind-1';
  if(mode==='partial-target'){const target=new URL(pending350);target.searchParams.delete('capacity');expectedCorruption.target=target.href;}
  assert.equal(mutation.after,mode==='malformed'?'{':mode==='oversized'?' '.repeat(8193):JSON.stringify(expectedCorruption));
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname)),mutation.after,'The corrupted record was stored and was not admitted or rewritten');
  assert.equal(page.url(),before.url,'Refusing pending350 preserves the exact valid committed baseline');
  assert.equal(await page.locator('#passage-time').inputValue(),expectedSample);assert.equal(await page.locator('#component-time').inputValue(),expectedSample);
  for(const [id,value] of Object.entries(refusalDefaults))assert.equal(await page.locator('#'+id).inputValue(),value,'Refusal preserves the declared '+id+' assumption');
  assert.equal(await page.locator('#lab-event').inputValue(),'tuscaloosa-birmingham-2011');
  assert.equal(await page.locator('#sampled-values-body tr').count(),481);assert.equal(await page.locator('#passage-sample-'+expectedSample).getAttribute('aria-current'),'true');await paused(page,'wind');
  const message=await page.locator('#lab-state').textContent();
  assert.equal(await page.locator('#lab-state').getAttribute('data-state'),expectedSample==='349'?'restored':'reference');
  assert.match(message,expectedSample==='349'?/^Experiment restored and paused/:/^Default experiment, paused/);
  if(mode!=='foreign-entry')assert.match(message,/Pending reload changes were not restored|Automatic reload retention is unavailable/);
  t.diagnostic(JSON.stringify({mode,controlled_elapsed_ms:committed?300:0,committed_sample:expectedSample,pending_sample:350,held:before.held,corruption_ran:mutation.ran}));
 });
}

test('A complete Wind sample commits synchronously after the history interval and reloads paused',{timeout:30000},async t=>{
 const page=await fixture(t,{serviceWorkers:'block',reducedMotion:'reduce'});await probe(page,{logicalClock:true});
 await page.goto(base+'/wind.html?event=tuscaloosa-birmingham-2011');await ready(page);
 const complete=new URL(page.url());complete.search=new URLSearchParams({experiment:'wind-1',event:'tuscaloosa-birmingham-2011',...refusalDefaults,sample:'350'}).toString();
 const before=await page.evaluate(()=>{
  const state=window.labHistoryProbe;state.hold=true;
  for(const [value,now] of [[349,1300],[350,1551]]){state.now=now;const node=document.getElementById('passage-time');node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));}
  return {url:location.href,logical_now:performance.now(),pending:sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname),held:state.held.size,share:document.getElementById('lab-share').href};
 });
 t.diagnostic(JSON.stringify({scope:'controlled synchronous deadline positive control, not measured handler duration',before}));
 assert.equal(before.logical_now,1551);assert.equal(before.url,complete.href);assert.equal(before.share,complete.href);
 assert.equal(before.held,0);assert.equal(before.pending,null,'A legitimate complete commit retires the transient pending record');
 await page.reload();await ready(page);assert.equal(page.url(),complete.href);
 assert.equal(await page.locator('#passage-time').inputValue(),'350');assert.equal(await page.locator('#component-time').inputValue(),'350');
 for(const [id,value] of Object.entries(refusalDefaults))assert.equal(await page.locator('#'+id).inputValue(),value);
 assert.equal(await page.locator('#lab-event').inputValue(),'tuscaloosa-birmingham-2011');
 assert.equal(await page.locator('#sampled-values-body tr').count(),481);assert.equal(await page.locator('#passage-sample-350').getAttribute('aria-current'),'true');await paused(page,'wind');
 assert.equal(await page.locator('#lab-state').getAttribute('data-state'),'restored');assert.match(await page.locator('#lab-state').textContent(),/^Experiment restored and paused/);
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('atlasLabPendingV1:wind:'+location.pathname)),null);
});
test('Unavailable pending storage remains visible while the exact experiment anchor can commit and reload',{timeout:30000},async t=>{
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
