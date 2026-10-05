import test from 'node:test';
import assert from 'node:assert/strict';

let moduleId=0;
async function fixture(t) {
  const ids=new Map(),frames=new Map(),documentHandlers=new Map(),observers=[];
  let wall=0,nextFrame=0;
  class Element {
    constructor(id) {this.id=id;this.handlers=new Map();this.attributes=new Map();this.textContent='';this.defaultValue='0';this._value='0';this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
    set value(value) {this._value=String(value);}
    get value() {return this._value;}
    addEventListener(name,callback) {this.handlers.set(name,callback);}
    setAttribute(name,value) {this.attributes.set(name,String(value));}
    fire(name) {this.handlers.get(name)?.();}
  }
  const document={hidden:false,getElementById:id=>{if(!ids.has(id))ids.set(id,new Element(id));return ids.get(id);},addEventListener:(name,callback)=>documentHandlers.set(name,callback)};
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
