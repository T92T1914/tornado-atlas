import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(process.env.ATLAS_STARTUP_POSITION_SOURCE || new URL('../../web/app.js',import.meta.url),'utf8');
const start = source.indexOf('function startupReaderPosition() {');
const end = source.indexOf('async function main()',start);
assert.ok(start >= 0 && end > start,'Exercise the actual startup owner from the application');
const implementation = source.slice(start,end) + '\nstartupReaderPosition';

function model(initial = [],kind = 'source',{primeOnRead = false} = {}) {
 const values = new Map(initial.map(([name,value,priority = ''])=>[name,{value,priority}]));
 const writes = [],listeners = new Map();
 let position = 200,scroll = 0,queued = 0,measureError = null,restoreError = null,scrollCalls = 0,firstRead = true,nativePrimed = false,onMeasure = null;
 const style = {
  getPropertyValue: name=>values.get(name)?.value || '',
  getPropertyPriority: name=>values.get(name)?.priority || '',
  setProperty(name,value,priority = '') {
   if (restoreError && value !== 'none') throw restoreError;
   writes.push({name,value,priority});values.set(name,{value,priority});
  },
  removeProperty(name) {writes.push({name,removed:true});values.delete(name);},
 };
 const button = {isConnected:true,matches: selector=>selector === 'a[href]' ? kind === 'source' : kind === 'clip',
  getBoundingClientRect() {
   if (measureError) throw measureError;
   if (firstRead) {firstRead = false;nativePrimed = primeOnRead && style.getPropertyValue('overflow-anchor') !== 'none';}
   onMeasure?.();
   return {top:position-scroll,bottom:position-scroll+20,width:100,height:20};
  },
 };
 const location = {pathname:'/index.html',hash:'#photos'};
 const document = {scrollingElement:{style},activeElement:button,hidden:false,elementFromPoint:()=>null};
 const window = {
  addEventListener(type,handler) {if (!listeners.has(type)) listeners.set(type,new Set());listeners.get(type).add(handler);},
  removeEventListener(type,handler) {listeners.get(type)?.delete(handler);if (!listeners.get(type)?.size) listeners.delete(type);},
  scrollBy({top}) {scroll += top;scrollCalls++;},
 };
 const owner = vm.runInNewContext(implementation,{window,document,location,innerHeight:900})();
 const emit = (type,extra = {})=>{for (const handler of [...(listeners.get(type) || [])]) handler({type,isTrusted:true,isPrimary:true,button:0,target:{closest:()=>button},...extra});};
 return {owner,style,writes,listeners,button,location,emit,
  press:()=>emit('pointerdown'),top:()=>position-scroll,scrollCalls:()=>scrollCalls,
  move(delta) {position += delta;},
  queueNative(delta) {position += delta;if (nativePrimed || style.getPropertyValue('overflow-anchor') !== 'none') queued += delta;},
  finishNative() {scroll += queued;queued = 0;},
  observeMeasure(callback) {onMeasure = callback;},
  failMeasure(error) {measureError = error;},failRestore(error) {restoreError = error;},
 };
}

test('owned source correction excludes a delayed native adjustment model',()=>{
 for (const delta of [-141,480]) {
  const m = model([['overflow-anchor','auto','important']]);m.press();
  m.owner.update(()=>m.queueNative(delta));m.finishNative();
  assert.equal(m.top(),200,'A synthetic native queue cannot apply the same movement twice');
  assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');
  assert.equal(m.style.getPropertyPriority('overflow-anchor'),'important');
 }
});

test('owned source correction restores the prior inline property and priority',()=>{
 for (const initial of [[],[['overflow-anchor','auto','important']],[['overflow-anchor','none','']]]) {
  const m = model(initial);m.style.setProperty('--retained','yes');m.writes.length = 0;m.press();
  const before = [m.style.getPropertyValue('overflow-anchor'),m.style.getPropertyPriority('overflow-anchor')];
  m.owner.update(()=>{
   assert.equal(m.style.getPropertyValue('overflow-anchor'),'none');
   assert.equal(m.style.getPropertyPriority('overflow-anchor'),'important');m.move(80);
  });
  assert.deepEqual([m.style.getPropertyValue('overflow-anchor'),m.style.getPropertyPriority('overflow-anchor')],before);
  assert.equal(m.style.getPropertyValue('--retained'),'yes');assert.equal(m.top(),200);
 }
});

test('an update without an owner does not alter anchoring or scroll',()=>{
 const m = model();m.owner.update(()=>m.move(60));
 assert.deepEqual(m.writes,[]);assert.equal(m.scrollCalls(),0);assert.equal(m.top(),260);
});

test('detached and changed route owners do not take the property',()=>{
 for (const invalidate of [m=>m.button.isConnected=false,m=>m.location.hash='#new']) {
  const m = model();m.press();invalidate(m);m.owner.update(()=>m.move(50));
  assert.deepEqual(m.writes,[]);assert.equal(m.scrollCalls(),0);
 }
});

test('drag and explicit retirement leave later layout unowned',()=>{
 for (const retire of [m=>m.emit('pointermove',{clientX:2,clientY:2}),m=>m.owner.retire()]) {
  const m = model();m.press();retire(m);m.owner.update(()=>m.move(50));
  assert.deepEqual(m.writes,[]);assert.equal(m.scrollCalls(),0);
 }
 const m = model();m.owner.retire();assert.equal(m.listeners.size,0);
});

test('a different later property value retains its owner',()=>{
 const m = model([['overflow-anchor','auto','important']]);m.press();
 m.owner.update(()=>{m.move(30);m.style.setProperty('overflow-anchor','auto','');});
 assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');assert.equal(m.style.getPropertyPriority('overflow-anchor'),'');
 assert.equal(m.top(),200);
});

test('the original mutation error survives measurement cleanup',()=>{
 const m = model([['overflow-anchor','auto','important']]),original = new Error('original mutation'),secondary = new Error('later measurement');m.press();
 assert.throws(()=>m.owner.update(()=>{m.failMeasure(secondary);throw original;}),error=>error === original);
 assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');assert.equal(m.style.getPropertyPriority('overflow-anchor'),'important');
});

test('the original mutation error survives a later restoration error',()=>{
 const m = model([['overflow-anchor','auto','important']]),original = new Error('original mutation'),secondary = new Error('later restoration');m.press();
 assert.throws(()=>m.owner.update(()=>{m.failRestore(secondary);throw original;}),error=>error === original);
});

test('an existing clip owner retains manual correction without source opt out',()=>{
 const m = model([['overflow-anchor','auto','important']],'clip');m.press();m.owner.update(()=>m.move(30));
 assert.deepEqual(m.writes,[]);assert.equal(m.top(),200);
});

test('a geometry read cannot prime a later native adjustment model',()=>{
 for (const delta of [-141,480]) {
  const m = model([['overflow-anchor','auto','important']],'source',{primeOnRead:true});m.press();
  m.owner.update(()=>m.queueNative(delta));m.finishNative();
  assert.equal(m.top(),200,'Exclusion covers the first geometry read as well as the mutation');
  assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');
  assert.equal(m.style.getPropertyPriority('overflow-anchor'),'important');
 }
});

test('an offscreen owner restores the measured policy before mutation',()=>{
 const m = model([['overflow-anchor','auto','important']]);m.press();m.move(1000);
 m.owner.update(()=>{
  assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');
  assert.equal(m.style.getPropertyPriority('overflow-anchor'),'important');m.move(50);
 });
 assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');assert.equal(m.scrollCalls(),0);assert.equal(m.top(),1250);
});

test('ownership retired during measurement is restored before mutation',()=>{
 const m = model([['overflow-anchor','auto','important']]);m.press();m.observeMeasure(()=>m.emit('pointermove',{clientX:2,clientY:2}));
 m.owner.update(()=>{
  assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');
  assert.equal(m.style.getPropertyPriority('overflow-anchor'),'important');m.move(50);
 });
 assert.equal(m.scrollCalls(),0);assert.equal(m.top(),250);
});

test('the first measurement error survives restoration and prevents mutation',()=>{
 for (const restorationFails of [false,true]) {
  const m = model([['overflow-anchor','auto','important']]),original = new Error('first measurement'),secondary = new Error('restoration');let called = false;m.press();m.failMeasure(original);
  if (restorationFails) m.failRestore(secondary);
  assert.throws(()=>m.owner.update(()=>{called = true;}),error=>error === original);
  assert.equal(called,false);assert.equal(m.scrollCalls(),0);
  if (!restorationFails) {assert.equal(m.style.getPropertyValue('overflow-anchor'),'auto');assert.equal(m.style.getPropertyPriority('overflow-anchor'),'important');}
 }
});
