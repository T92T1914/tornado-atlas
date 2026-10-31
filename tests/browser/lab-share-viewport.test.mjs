import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,base} from './harness.mjs';

// These controlled image arrivals test software interaction, not historical timing
// or physical-phone use. The original CI698 click has no retained event trace.
const windURL=capacity=>base+'/wind.html?experiment=wind-1&event=blackwell-1955&peak=100&radius=500&background=0&probe-x=1&probe-y=0&area=1&coefficient=1.2&travel=30&offset=1&threshold=50&capacity='+capacity+'&sample=0';
const formURLs={
 first:'/study.html?experiment=form-8&event=blackwell-1955&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=storm-integrated&rate=1&position=0.5&phase=15&model=genesis-v1&visibility=ordinary&flow=1&presentation=storm-v3',
 next:'/study.html?experiment=form-8&event=blackwell-1955&shape=cone&condensation=100&azimuth=25&elevation=12&distance=7&dust=1&quality=7200&sequence=1&coverage=storm-integrated&rate=1&position=0.6&phase=18&model=genesis-v1&visibility=ordinary&flow=1&presentation=storm-v3',
};
async function installControl(page){
 await page.addInitScript(()=>{
  const nativeSet=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window),originalSet=Storage.prototype.setItem;
  const state=window.atlasShareViewportControl={hold:false,held:new Map(),next:1000000000,events:[],commits:[]};
  // Fixed logical time keeps the pending 250 ms address replacement pending
  // while the independently bounded real source request is deliberately held.
  Object.defineProperty(performance,'now',{configurable:true,value:()=>1000});
  window.setTimeout=function(callback,delay,...args){if(state.hold&&typeof callback==='function'&&delay>0&&delay<=250){const id=++state.next;state.held.set(id,()=>callback(...args));return id;}return nativeSet(callback,delay,...args);};
  window.clearTimeout=function(id){if(state.held.delete(id))return;return nativeClear(id);};
  Storage.prototype.setItem=function(key,value){if(key.startsWith('atlasLabPendingV1:'))throw new DOMException('Controlled pending storage refusal','SecurityError');return originalSet.call(this,key,value);};
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','click','keydown','keyup'])document.addEventListener(type,event=>{
   if(state.events.length>=64)return;const anchor=document.getElementById('lab-share'),r=anchor?.getBoundingClientRect();
   state.events.push({type,trusted:event.isTrusted,anchor:Boolean(anchor&&event.target.closest?.('#lab-share')===anchor),key:event.key??null,detail:event.detail??null,primary:event.isPrimary??null,button:event.button??null,point:[event.clientX??null,event.clientY??null],rect:r?[r.x,r.y,r.width,r.height]:null,scrollY,wall:Date.now()});
  },{capture:true,passive:true});
  // The browser handler commits synchronously. Its client URL notification may
  // arrive later, so retain the post-handler browser observation separately.
  document.addEventListener('click',event=>{if(state.commits.length<8)state.commits.push({trusted:event.isTrusted,anchor:event.target.closest?.('#lab-share')===document.getElementById('lab-share'),prevented:event.defaultPrevented,detail:event.detail,url:location.href});},{passive:true});
 });
}
function assertKeyboardActivation(observation,before,next){
 assert.ok(Number.isInteger(before.eventCount)&&before.eventCount>=0&&before.eventCount<=60,'The bounded record retains room to detect an extra event');
 assert.equal(before.active,'lab-share');assert.equal(observation.commitCount,before.commitCount+1,'Enter must produce one distinct new commit');
 assert.equal(observation.eventCount,before.eventCount+3,'The activation contains only the trusted Enter gesture');
 assert.deepEqual(observation.gesture.map(row=>row.type),['keydown','click','keyup']);
 for(const row of observation.gesture)assert.ok(row.trusted&&row.anchor,'Every keyboard activation event must reach the same anchor');
 assert.equal(observation.gesture[0].key,'Enter');assert.equal(observation.gesture[2].key,'Enter');
 const commit=observation.keyboardCommit;assert.ok(commit?.trusted&&commit.anchor&&commit.prevented);
 assert.equal(commit.detail,observation.gesture[1].detail,'The commit belongs to the observed new click');
 assert.equal(commit.url,next);assert.equal(observation.url,next);assert.equal(observation.active,'lab-share');
}
async function ready(page){await page.locator('#lab-context[data-experiment-ready="true"]').waitFor();}
async function setInput(page,id,value){await page.locator('#'+id).evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},String(value));}
const imageReady=()=>document.getElementById('lab-reference-evidence')?.dataset.state==='ready'&&document.getElementById('lab-reference-image')?.naturalWidth>0&&!document.getElementById('lab-reference-image')?.hidden;
for(const kind of ['wind','form'])for(const width of [320,1280])test('Checked source arrival preserves the '+kind+' experiment anchor at '+width,{timeout:30000},async t=>{
 const page=await fixture(t,{viewport:{width,height:800},serviceWorkers:'block',reducedMotion:'reduce'});await installControl(page);
 const route=kind==='wind'?'wind.html':'study.html',short=base+'/'+route+'?event=blackwell-1955',first=kind==='wind'?windURL(20):base+formURLs.first,next=kind==='wind'?windURL(19):base+formURLs.next,control=kind==='wind'?'capacity':'sequence-time';
 const asset=base+'/assets/blackwell-1955/nara-283884.jpg';let release,arrived,down=false,original=null,blocked=false;
 const gate=new Promise(resolve=>{release=resolve;}),requested=new Promise(resolve=>{arrived=resolve;});
 const handler=async route=>{blocked=true;arrived();await gate;await route.fallback();};await page.route(asset,handler);
 try{
  await page.goto(short);await ready(page);await page.waitForFunction(()=>document.getElementById('lab-reference-image')?.hidden===true);
  let timer;try{await Promise.race([requested,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The checked source request did not reach its controlled gate')),5000);})]);}finally{clearTimeout(timer);}
  assert.equal(blocked,true);await page.evaluate(()=>{atlasShareViewportControl.hold=true;});await setInput(page,control,kind==='wind'?20:.5);
  assert.match(await page.locator('#lab-state').textContent(),/Automatic reload retention is unavailable/);
  assert.equal(page.url(),short);assert.equal(await page.evaluate(()=>location.href),short);assert.ok(await page.evaluate(()=>atlasShareViewportControl.held.size>0));
  assert.equal(await page.locator('#lab-share').getAttribute('href'),first,'Independent complete assumptions must be available before the delayed address update');
  await page.locator('#lab-share').scrollIntoViewIfNeeded();const box=await page.locator('#lab-share').boundingBox();assert.ok(box&&box.width>0&&box.height>0);const point=[box.x+box.width/2,box.y+box.height/2];
  assert.equal(await page.evaluate(point=>{const link=document.getElementById('lab-share');return document.elementsFromPoint(...point).some(node=>node===link||link.contains(node));},point),true);
  await page.mouse.move(...point);await page.mouse.down();down=true;
  const pressed=await page.evaluate(()=>atlasShareViewportControl.events.filter(row=>row.type==='mousedown').at(-1));assert.ok(pressed?.trusted&&pressed.anchor,'The real mouse press must reach the experiment anchor');
  const pointerDown=await page.evaluate(()=>atlasShareViewportControl.events.filter(row=>row.type==='pointerdown').at(-1));assert.ok(pointerDown?.trusted&&pointerDown.anchor&&pointerDown.primary&&pointerDown.button===0);
  release();await page.waitForFunction(imageReady);
  const beforeUp=await page.evaluate(point=>{const link=document.getElementById('lab-share'),r=link.getBoundingClientRect();return {rect:[r.x,r.y,r.width,r.height],hit:document.elementsFromPoint(...point).some(node=>node===link||link.contains(node)),url:location.href};},point);
  assert.ok(Math.abs(beforeUp.rect[0]-pressed.rect[0])<=1&&Math.abs(beforeUp.rect[1]-pressed.rect[1])<=1,'The pressed anchor retains its screen position within one CSS pixel after the complete source appears');
  assert.equal(beforeUp.hit,true);assert.equal(beforeUp.url,short);
  await page.mouse.up();down=false;
  const mouseCommit=await page.evaluate(()=>atlasShareViewportControl.commits.at(-1));
  assert.ok(mouseCommit?.trusted&&mouseCommit.anchor&&mouseCommit.prevented&&mouseCommit.detail>0);assert.equal(mouseCommit.url,first,'The post-handler browser event sees the synchronous exact commit');
  assert.equal(await page.evaluate(()=>location.href),first);await page.waitForURL(first,{timeout:5000});assert.equal(page.url(),first);
  const events=await page.evaluate(()=>atlasShareViewportControl.events);
  for(const type of ['pointerup','mouseup','click']){const row=events.filter(row=>row.type===type).at(-1);assert.ok(row?.trusted&&row.anchor,'The real '+type+' must reach the same anchor');}
  await setInput(page,control,kind==='wind'?19:.6);assert.equal(await page.locator('#lab-share').getAttribute('href'),next);
  assert.equal(page.url(),first);assert.equal(await page.evaluate(()=>location.href),first);assert.ok(await page.evaluate(()=>atlasShareViewportControl.held.size>0));
  await page.locator('#lab-share').focus();
  const keyboardBefore=await page.evaluate(()=>({commitCount:atlasShareViewportControl.commits.length,eventCount:atlasShareViewportControl.events.length,active:document.activeElement.id}));
  assert.equal(keyboardBefore.commitCount,1);assert.ok(keyboardBefore.eventCount<=60,'The bounded record must retain room to detect an extra event');
  await page.keyboard.press('Enter');
  const keyboardObservation=await page.evaluate(before=>{
   const keyboardCommit=atlasShareViewportControl.commits.at(-1);
   return {keyboardCommit,commitCount:atlasShareViewportControl.commits.length,commits:atlasShareViewportControl.commits.map((row,index)=>({index,...row})),events:atlasShareViewportControl.events.slice(-12),eventCount:atlasShareViewportControl.events.length,gesture:atlasShareViewportControl.events.slice(before.eventCount),active:document.activeElement.id,url:location.href};
  },keyboardBefore),keyboardCommit=keyboardObservation.keyboardCommit;
  const keyboardDiagnostic=JSON.stringify({kind,width,...keyboardObservation});assert.ok(Buffer.byteLength(keyboardDiagnostic)<=262144);t.diagnostic('LAB_SHARE_KEYBOARD '+keyboardDiagnostic);
  // Firefox can report click detail 1 for trusted Enter. The recorded key
  // gesture and distinct commit establish activation without that heuristic.
  assertKeyboardActivation(keyboardObservation,keyboardBefore,next);
  assert.equal(await page.evaluate(()=>location.href),next);await page.waitForURL(next,{timeout:5000});assert.equal(page.url(),next);
  const keyboard=await page.evaluate(()=>({key:atlasShareViewportControl.events.filter(row=>row.type==='keydown'&&row.key==='Enter').at(-1),click:atlasShareViewportControl.events.filter(row=>row.type==='click').at(-1)}));
  assert.deepEqual(keyboard,{key:keyboardObservation.gesture[0],click:keyboardObservation.gesture[1]},'The final key and click still identify the same trusted activation');
  await page.reload();await ready(page);assert.equal(page.url(),next);assert.equal(await page.evaluate(()=>location.href),next);assert.equal(await page.locator('#'+control).inputValue(),kind==='wind'?'19':'0.6');
  assert.equal(await page.locator(kind==='wind'?'#passage-play':'#motion').textContent(),kind==='wind'?'Play passage':'Play motion');if(kind==='wind')assert.equal(await page.locator('#component-play').textContent(),'Play passage');
  await page.waitForFunction(imageReady);
  t.diagnostic(JSON.stringify({scope:'Controlled checked-source arrival during a held trusted pointer, with fixed logical history time. This is not the original CI698 event sequence or a physical-phone test.',kind,width,pressed,beforeUp,events,keyboard,mouseCommit,keyboardCommit,exact:first,reloaded:next}));
 }catch(error){original=error;throw error;}finally{
  try{release();if(down)await page.mouse.up();await page.unroute(asset,handler);}catch(error){if(!original)throw error;t.diagnostic('Additional source-gate/pointer cleanup failure '+String(error.message).slice(0,500));}
 }
});
