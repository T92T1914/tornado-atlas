import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../web/wind.html',import.meta.url),'utf8');

let moduleId=0;
async function fixture(t) {
  const ids=new Map(),frames=new Map(),documentHandlers=new Map(),observers=[];
  let wall=0,nextFrame=0;
  class Element {
    constructor(id) {this.id=id;this.handlers=new Map();this.attributes=new Map();this.dataWrites=0;this.dataset=new Proxy({},{set:(target,key,value)=>{this.dataWrites++;target[key]=value;return true;}});this._textContent='';this.textWrites=0;this.scrollCalls=0;this.defaultValue='0';this._value='0';this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
    set textContent(value) {this._textContent=String(value);this.textWrites++;}
    get textContent() {return this._textContent;}
    set value(value) {this._value=String(value);}
    get value() {return this._value;}
    addEventListener(name,callback) {this.handlers.set(name,callback);}
    setAttribute(name,value) {this.attributes.set(name,String(value));}
    removeAttribute(name) {this.attributes.delete(name);}
    focus() {document.activeElement=this;}
    scrollIntoView() {this.scrollCalls++;}
    fire(name) {this.handlers.get(name)?.();}
  }
  const document={hidden:false,getElementById:id=>{if(!ids.has(id))ids.set(id,new Element(id));return ids.get(id);},addEventListener:(name,callback)=>documentHandlers.set(name,callback)};
  document.body=new Element('body');document.activeElement=null;
  document.getElementById('sampled-values-body').rows=[...html.matchAll(/<tr id="(passage-sample-\d+)"[^>]*>(.*?)<\/tr>/g)].map(match=>{
    const row=document.getElementById(match[1]);
    row.cells=[...match[2].matchAll(/<(th|td)\b([^>]*)>([^<]*)<\/\1>/g)].map((cell,index)=>{
      const node=new Element(`${row.id}-cell-${index}`);node.textContent=cell[3];
      const value=cell[2].match(/data-value="([^"]+)"/);if(value)node.dataset.value=value[1];return node;
    });
    if(match[0].includes('aria-current="true"'))row.attributes.set('aria-current','true');
    return row;
  });
  assert.equal(document.getElementById('sampled-values-body').rows.length,481);
  const globals={document,performance:{now:()=>wall},
    requestAnimationFrame:callback=>{const id=++nextFrame;frames.set(id,callback);return id;},
    cancelAnimationFrame:id=>frames.delete(id),
    IntersectionObserver:class {constructor(callback){this.callback=callback;observers.push(this);}observe(element){this.element=element;}}};
  const original=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  t.after(()=>{frames.clear();for(const [key,descriptor] of original)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
  for(const [id,value] of Object.entries({peak:100,radius:500,background:0,travel:30,offset:1,threshold:50,capacity:1,area:1,coefficient:1.2,'passage-time':0,'component-time':0})) {
    const element=document.getElementById(id);element.value=value;element.defaultValue=String(value);
  }
  await import(new URL(`../web/passage.js?consumer-test=${++moduleId}`,import.meta.url));
  return {ids,frames,document,setWall(value){assert.ok(value>=wall);wall=value;},
    draw(value,rafTimestamp=value){assert.ok(value>=wall);wall=value;assert.equal(frames.size,1,'One owned animation callback');const [id,callback]=frames.entries().next().value;frames.delete(id);callback(rafTimestamp);assert.ok(frames.size<=1,'No competing animation chain');},
    visibility(hidden){document.hidden=hidden;documentHandlers.get('visibilitychange')();},
    intersection(visible){assert.equal(observers.length,1);observers[0].callback([{isIntersecting:visible}]);},
    index(){const passage=Number(ids.get('passage-time').value);assert.equal(Number(ids.get('component-time').value),passage,'Both sliders inspect the same sample');return passage;},
    playing(expected){for(const id of ['passage-play','component-play'])assert.equal(ids.get(id).textContent,expected?'Pause passage':'Play passage');assert.equal(frames.size,expected?1:0);}};
}

for(const interval of [50,200])test(`actual passage reaches its endpoint after 24 seconds at ${interval} ms cadence`,async t=>{
  const f=await fixture(t),chart=f.ids.get('passage-line').attributes.get('d');
  f.ids.get('passage-play').fire('click');f.playing(true);
  for(let now=interval;now<=24000;now+=interval)f.draw(now);
  assert.equal(f.index(),480);f.playing(false);
  assert.equal(f.ids.get('passage-line').attributes.get('d'),chart,'Playback leaves sampled model results unchanged');
  f.setWall(30000);f.ids.get('component-play').fire('click');assert.equal(f.index(),0);f.playing(true);
  f.draw(54000);assert.equal(f.index(),480);f.playing(false);
});

test('pause settles elapsed time without a frame, and either slider seeks and rewinds before resume',async t=>{
  const f=await fixture(t);
  f.ids.get('passage-play').fire('click');f.draw(1000);assert.equal(f.index(),20);
  f.setWall(1250);f.ids.get('component-play').fire('click');assert.equal(f.index(),25);f.playing(false);
  f.setWall(10000);f.ids.get('passage-play').fire('click');f.draw(11000);assert.equal(f.index(),45);
  f.ids.get('component-time').value=120;f.ids.get('component-time').fire('input');assert.equal(f.index(),120);f.playing(false);
  f.setWall(15000);f.ids.get('component-play').fire('click');f.draw(18000);assert.equal(f.index(),180);
  f.ids.get('passage-time').value=0;f.ids.get('passage-time').fire('input');assert.equal(f.index(),0);f.playing(false);
  assert.equal(f.ids.get('component-state').textContent,'Capacity not exceeded so far');
  f.ids.get('passage-time').value=240;f.ids.get('passage-time').fire('input');assert.equal(f.index(),240);
  assert.equal(f.ids.get('component-state').textContent,'Failed under this rule');
});

test('control and frame callbacks share performance.now despite an earlier RAF timestamp',async t=>{
  const f=await fixture(t);
  f.setWall(101);f.ids.get('passage-play').fire('click');
  assert.doesNotThrow(()=>f.draw(111.2,100));
  f.draw(1101,1100);assert.equal(f.index(),20);
  f.setWall(1301);f.ids.get('component-play').fire('click');assert.equal(f.index(),24);f.playing(false);
});

test('hidden and offscreen states retire the owned callback and never count inactive time',async t=>{
  const f=await fixture(t);
  f.ids.get('passage-play').fire('click');f.draw(1000);
  const retired=Array.from(f.frames.values())[0];
  f.setWall(1500);f.visibility(true);assert.equal(f.index(),30);f.playing(false);
  f.setWall(100000);retired(99999);assert.equal(f.index(),30);f.playing(false);
  f.ids.get('component-play').fire('click');f.playing(false);
  f.visibility(false);f.playing(false);
  f.ids.get('component-play').fire('click');f.draw(101000);assert.equal(f.index(),50);
  f.setWall(101500);f.intersection(false);assert.equal(f.index(),60);f.playing(false);
  f.setWall(200000);f.ids.get('passage-play').fire('click');f.playing(false);
  f.intersection(true);f.playing(false);
  f.ids.get('passage-play').fire('click');f.draw(201000);assert.equal(f.index(),80);f.playing(true);
});

test('repeated controls, setting changes and reset leave one paused, synchronized experiment',async t=>{
  const f=await fixture(t);
  for(let i=0;i<4;i++) {
    f.ids.get('passage-play').fire('click');f.playing(true);
    f.setWall((i+1)*100);f.ids.get('component-play').fire('click');f.playing(false);
  }
  f.ids.get('passage-play').fire('click');f.draw(1400);assert.equal(f.index(),28);
  f.setWall(1500);f.ids.get('travel').value=60;f.ids.get('travel').fire('input');assert.equal(f.index(),30);f.playing(false);
  assert.equal(f.ids.get('travel-value').textContent,'60 mph');
  const modelTime=f.ids.get('passage-time-value').textContent;
  f.ids.get('wind-controls').fire('input');assert.equal(f.index(),30);f.playing(false);
  assert.equal(f.ids.get('passage-time-value').textContent,modelTime);
  f.ids.get('passage-play').fire('click');f.draw(2500);assert.equal(f.index(),50);
  f.ids.get('wind-reset').fire('click');await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(f.index(),0);f.playing(false);
  assert.equal(f.ids.get('travel').value,'30');assert.equal(f.ids.get('travel-value').textContent,'30 mph');
  assert.equal(f.ids.get('component-state').textContent,'Capacity not exceeded so far');
  f.ids.get('component-play').fire('click');f.draw(26500);assert.equal(f.index(),480);f.playing(false);
});

test('actual passage keeps complete sample cells and focus stable while selecting, playing and rebuilding',async t=>{
  const f=await fixture(t),rows=f.ids.get('sampled-values-body').rows;
  const numericWrites=()=>rows.reduce((sum,row)=>sum+row.cells.slice(1).reduce((total,cell)=>total+cell.textWrites,0),0);
  assert.equal(f.document.body.dataset.windSamples,'ready');
  const firstWrites=numericWrites();
  f.ids.get('component-time').value=240;f.ids.get('component-time').fire('input');
  assert.equal(f.ids.get('sampled-values-selection').textContent,'Sample 241 of 481 selected.');
  assert.equal(rows[240].attributes.get('aria-current'),'true');
  assert.equal(rows[240].cells[7].textContent,'Failed under this rule');
  assert.equal(numericWrites(),firstWrites,'Selecting a sample must not rewrite computed cells');
  assert.equal(f.document.activeElement,null);
  f.ids.get('sampled-values-show').fire('click');
  assert.equal(f.ids.get('sampled-values-details').open,true);
  assert.equal(f.document.activeElement,rows[240]);assert.equal(rows[240].scrollCalls,1);
  f.ids.get('passage-play').fire('click');f.draw(1000);assert.equal(f.index(),260);
  assert.equal(rows[260].attributes.get('aria-current'),'true');
  assert.equal(rows[240].attributes.has('aria-current'),false);
  assert.equal(numericWrites(),firstWrites,'Playback must leave computed cells unchanged');
  assert.equal(f.document.activeElement,rows[240]);assert.equal(rows[240].scrollCalls,1);
  assert.equal(rows[260].scrollCalls,0);
  f.ids.get('capacity').value=20;f.ids.get('capacity').fire('input');
  assert.ok(numericWrites()>firstWrites);
  assert.ok(rows.every(row=>row.cells[7].textContent==='Capacity not exceeded so far'));
  assert.equal(f.ids.get('sampled-values-body').rows,rows);
  assert.equal(f.document.activeElement,rows[240]);
  f.ids.get('wind-reset').fire('click');await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(f.index(),0);assert.equal(rows[0].attributes.get('aria-current'),'true');
  assert.equal(rows[240].cells[7].textContent,'Failed under this rule');
  assert.equal(f.document.activeElement,rows[240]);
});

test('decisive sample actions pause the actual passage and focus its exact existing row',async t=>{
  const f=await fixture(t),rows=f.ids.get('sampled-values-body').rows;
  f.ids.get('passage-play').fire('click');f.draw(1000);f.playing(true);
  f.ids.get('component-inspect-peak').fire('click');
  assert.equal(f.index(),240,'Default tangent passage reaches its maximum at closest approach');
  f.playing(false);assert.equal(f.document.activeElement,rows[240]);
  assert.equal(rows[240].attributes.get('aria-current'),'true');
  assert.equal(f.ids.get('sampled-values-details').open,true);
  for(const [id,value] of Object.entries({background:20,offset:-.7,capacity:1.6}))f.ids.get(id).value=value;
  f.ids.get('wind-controls').fire('input');
  f.ids.get('component-inspect-first').fire('click');
  assert.equal(f.index(),206,'Independent opposite-side witness retained from capacity controls');
  assert.equal(f.document.activeElement,rows[206]);f.playing(false);
  assert.equal(f.ids.get('component-state').textContent,'Failed under this rule');
  f.ids.get('component-time').value=205;f.ids.get('component-time').fire('input');
  assert.equal(f.ids.get('component-state').textContent,'Capacity not exceeded so far');
  f.ids.get('offset').value=.7;f.ids.get('offset').fire('input');
  assert.equal(f.ids.get('component-inspect-first').disabled,true);
  f.ids.get('component-inspect-first').fire('click');
  assert.equal(f.index(),205,'A stale or synthetic activation cannot select a nonexistent exceedance');
  assert.equal(f.document.activeElement,rows[206],'Rebuild and rejected actions do not move focus');
  for(const [id,value] of Object.entries({peak:105,background:0,offset:.7,capacity:1.6}))f.ids.get(id).value=value;
  f.ids.get('wind-controls').fire('input');
  assert.equal(f.ids.get('component-inspect-first').disabled,true,'Continuous exceedance cannot authorize a sampled target');
  f.ids.get('peak').value=0;f.ids.get('wind-controls').fire('input');
  f.ids.get('component-inspect-peak').fire('click');assert.equal(f.index(),0);
  assert.equal(f.document.activeElement,rows[0]);
});


test('actual input rebuild leaves unchanged sample cells alone and preserves focus',async t=>{
  const f=await fixture(t),rows=f.ids.get('sampled-values-body').rows;
  f.ids.get('component-inspect-peak').fire('click');
  const counters=()=>rows.map(row=>row.cells.map(cell=>[cell.textWrites,cell.dataWrites]));
  const before=counters(),assumptions=f.ids.get('sampled-values-assumptions').textWrites;
  f.ids.get('wind-controls').fire('input');
  assert.deepEqual(counters(),before,'Unchanged calculation does not replace any table cell or raw value');
  assert.equal(f.ids.get('sampled-values-assumptions').textWrites,assumptions);
  assert.equal(f.document.activeElement,rows[240]);assert.equal(f.index(),240);
  f.ids.get('capacity').value=20;f.ids.get('capacity').fire('input');
  for(let i=0;i<481;i++)for(let col=0;col<=5;col++)
    assert.deepEqual([rows[i].cells[col].textWrites,rows[i].cells[col].dataWrites],before[i][col],
      'Capacity changes leave sample number, time, wind, pressure and force untouched');
  // This independent division starts from stored kN rather than the model's N.
  for(const row of rows)assert.ok(Math.abs(Number(row.cells[6].dataset.value)-Number(row.cells[5].dataset.value)/20)<1e-15);
  assert.ok(rows.every(row=>row.cells[7].textContent==='Capacity not exceeded so far'));
  assert.equal(f.document.activeElement,rows[240]);assert.equal(rows[240].attributes.get('aria-current'),'true');
});

test('actual input updates unrounded force and strict state even when every displayed number stays the same',async t=>{
  const f=await fixture(t),rows=f.ids.get('sampled-values-body').rows,peak=rows[240];
  const oldForce=Number(peak.cells[5].dataset.value);
  f.ids.get('capacity').value=oldForce;f.ids.get('capacity').fire('input');
  assert.equal(peak.cells[7].textContent,'Capacity not exceeded so far','Equality is not exceedance');
  const text=peak.cells.slice(1,7).map(cell=>cell.textContent),writes=peak.cells.slice(1,7).map(cell=>cell.textWrites);
  f.ids.get('coefficient').value=1.200000001;f.ids.get('wind-controls').fire('input');
  assert.deepEqual(peak.cells.slice(1,7).map(cell=>cell.textContent),text);
  assert.deepEqual(peak.cells.slice(1,7).map(cell=>cell.textWrites),writes);
  const speed=100*.44704,expectedForce=.5*1.225*speed*speed*1.200000001/1000;
  assert.equal(Number(peak.cells[5].dataset.value),expectedForce);
  assert.ok(Number(peak.cells[5].dataset.value)>oldForce);
  assert.ok(Number(peak.cells[6].dataset.value)>1);
  assert.equal(peak.cells[7].textContent,'Failed under this rule');
});

test('actual passage direction follows paired selection, playback and decisive inspection without rewriting rows',async t=>{
  const f=await fixture(t),rows=f.ids.get('sampled-values-body').rows;
  f.ids.get('background').value=20;f.ids.get('wind-controls').fire('input');
  f.ids.get('passage-time').value=240;f.ids.get('passage-time').fire('input');
  assert.equal(f.ids.get('passage-east-component').textContent,'-80.0 mph');
  assert.equal(f.ids.get('passage-north-component').textContent,'0.0 mph');
  f.ids.get('offset').value=-1;f.ids.get('offset').fire('input');
  assert.equal(f.index(),240);assert.equal(f.ids.get('passage-east-component').textContent,'+120.0 mph');
  const writes=()=>rows.map(row=>row.cells.slice(1).map(cell=>[cell.textWrites,cell.dataWrites]));
  const before=writes();rows[100].focus();
  f.ids.get('component-time').value=200;f.ids.get('component-time').fire('input');
  assert.ok(Number(f.ids.get('passage-north-component').dataset.value)>0);
  f.ids.get('passage-time').value=280;f.ids.get('passage-time').fire('input');
  assert.ok(Number(f.ids.get('passage-north-component').dataset.value)<0);
  assert.deepEqual(writes(),before);assert.equal(f.document.activeElement,rows[100]);
  f.ids.get('component-inspect-peak').fire('click');assert.equal(f.index(),240);
  assert.equal(f.ids.get('passage-east-component').textContent,'+120.0 mph');
  assert.equal(f.document.activeElement,rows[240]);
  f.ids.get('passage-play').fire('click');f.draw(1000);assert.equal(f.index(),260);
  assert.ok(Number(f.ids.get('passage-north-component').dataset.value)<0);
  assert.deepEqual(writes(),before);assert.equal(f.document.activeElement,rows[240]);
  f.ids.get('offset').value=-.7;f.ids.get('capacity').value=1.6;f.ids.get('wind-controls').fire('input');
  f.ids.get('component-inspect-first').fire('click');assert.equal(f.index(),206);
  assert.ok(Math.abs(Number(f.ids.get('passage-east-component').dataset.value)-(20+70/1.2125))<1e-10);
  assert.ok(Math.abs(Number(f.ids.get('passage-north-component').dataset.value)-85/1.2125)<1e-10);
  assert.equal(f.document.activeElement,rows[206]);f.playing(false);
  // The separate field form restores this control before the queued passage reset.
  f.ids.get('background').value=0;
  f.ids.get('wind-reset').fire('click');await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(f.index(),0);assert.equal(f.ids.get('passage-east-component').textContent,'-2.7 mph');
  assert.equal(f.ids.get('passage-north-component').textContent,'+16.2 mph');
});

test('a refused actual rebuild clears direction, then recovers through the existing input path',async t=>{
  const f=await fixture(t);
  f.ids.get('component-inspect-peak').fire('click');
  assert.equal(f.ids.get('passage-direction-arrow').attributes.get('visibility'),'visible');
  f.ids.get('peak').value='NaN';
  assert.throws(()=>f.ids.get('wind-controls').fire('input'),RangeError);
  for(const id of ['passage-east-component','passage-north-component'])assert.equal(f.ids.get(id).textContent,'Unavailable');
  assert.equal(f.ids.get('passage-direction-arrow').attributes.get('d'),'');
  assert.equal(f.ids.get('passage-direction-arrow').attributes.get('visibility'),'hidden');
  assert.equal(f.document.activeElement,f.ids.get('sampled-values-body').rows[240]);f.playing(false);
  f.ids.get('peak').value=100;f.ids.get('wind-controls').fire('input');
  assert.equal(f.index(),240);assert.equal(f.ids.get('passage-east-component').textContent,'-100.0 mph');
  assert.equal(f.ids.get('passage-north-component').textContent,'0.0 mph');
});
