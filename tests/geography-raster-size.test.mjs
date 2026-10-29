import test from 'node:test';
import assert from 'node:assert/strict';
import {basemapRasterSize,basemapRequest} from '../web/geography-model.mjs';
import {mountGeography} from '../web/geography-view.mjs';

const bounds=[-98,35,-97,35.5];
const project=([lon,lat])=>[(lon+98)*960,(35.5-lat)*860];
const valid=(name='first',extent={xmin:-98,ymin:35,xmax:-97,ymax:35.5,spatialReference:{wkid:4326}})=>({
  href:`https://basemap.nationalmap.gov/arcgis/rest/directories/arcgisoutput/${name}.png`,extent,
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('export dimensions follow measured size and bounded density, independently of the legacy default',()=>{
  assert.deepEqual(basemapRasterSize(bounds,960,430,1),{width:960,height:480,density:1,capped:false});
  assert.deepEqual(basemapRasterSize(bounds,1320,591,2),{width:2688,height:1344,density:2,capped:false});
  assert.deepEqual(basemapRasterSize(bounds,3840,1720,1),{width:2896,height:1448,density:1,capped:true});
  assert.deepEqual(basemapRasterSize(bounds,960,430,.5),{width:960,height:480,density:1,capped:false});
  assert.deepEqual(basemapRasterSize(bounds,960,430,3),{width:1920,height:960,density:2,capped:true});
  // The height can determine density too, rather than silently undersampling
  // a tall CSS map whose geographic ratio differs from its display ratio.
  assert.deepEqual(basemapRasterSize(bounds,100,1000,1),{width:2048,height:1024,density:1,capped:false});
  const legacy=new URL(basemapRequest('streets',bounds));
  assert.equal(legacy.searchParams.get('size'),'1200,600');
  assert.equal(legacy.searchParams.get('bbox'),'-98,35,-97,35.5');
  assert.equal(legacy.searchParams.get('dpi'),null);
  for(const [cssWidth,cssHeight,density] of [[1,1,1],[1000,450,1],[1320,591,2],[3840,2160,2],[1e8,1e8,99]]){
    const size=basemapRasterSize(bounds,cssWidth,cssHeight,density);
    assert.equal(new URL(basemapRequest('terrain',bounds,size.width)).searchParams.get('size'),`${size.width},${size.height}`);
    assert.ok(Number.isInteger(size.width)&&Number.isInteger(size.height));
    assert.ok(size.width>0&&size.height>0&&size.width<=4096&&size.height<=4096);
    assert.ok(size.width*size.height<=4194304);
  }
});

test('invalid and extreme inputs cannot create an unbounded export',()=>{
  for(const value of [0,-1,NaN,Infinity,-Infinity,'100',null,undefined]){
    assert.throws(()=>basemapRasterSize(bounds,value,450,1),RangeError);
    assert.throws(()=>basemapRasterSize(bounds,1000,value,1),RangeError);
    // Undefined intentionally selects the documented ratio default.
    if(value!==undefined)assert.throws(()=>basemapRasterSize(bounds,1000,450,value),RangeError);
  }
  for(const invalid of [null,[],[-98,35,-98,35.5],[-97,35,-98,35.5],[-98,36,-97,35.5],[-181,35,-97,35.5],[-98,-91,-97,35.5],[-98,35,181,35.5],[-98,35,-97,91],[-98,35,'-97',35.5],[-98,NaN,-97,35.5],[-98,35,-97,Infinity]])
    assert.throws(()=>basemapRasterSize(invalid,1000,450,1),RangeError);
  for(const extreme of [[-180,-90,180,90],[0,0,1,90],[0,0,180,1e-8]]){
    const size=basemapRasterSize(extreme,1e8,1e8,2);
    assert.ok(size.width>0&&size.height>0&&size.width<=4096&&size.height<=4096);
    assert.ok(size.width*size.height<=4194304);
  }
  assert.throws(()=>basemapRasterSize([0,0,1e-8,90],1000,450,1),RangeError);
  assert.throws(()=>basemapRasterSize([0,0,Number.MIN_VALUE,90],1000,450,1),RangeError);
  assert.throws(()=>basemapRasterSize(bounds,Number.MAX_VALUE,450,2),RangeError);
});

// These are controls for the actual response-to-image consumer. They do not
// load a provider, browser, tile or screenshot. Every asynchronous event and
// timer is explicit, and all replaced globals are restored after each case.
class Element extends EventTarget {
  constructor(tag){
    super();this.tag=tag;this.children=[];this.attributes={};this.textContent='';this.hidden=false;
    this.value=tag==='select'?'streets':'';this.classList=new Set();this.classList.remove=name=>this.classList.delete(name);
    this.style={removeProperty:name=>delete this.style[name]};
  }
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  prepend(child){child.parent=this;this.children.unshift(child);}
  replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this.append(...children);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}}
}

function fixture(t,{width=1000,height=450,density=1}={}){
  const names=['document','fetch','IntersectionObserver','setTimeout','clearTimeout','devicePixelRatio','matchMedia','CustomEvent'];
  const original=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const install=(name,value)=>Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
  const nodes=[],requests=[],timers=new Map(),queries=[];let next=0,observer;
  const create=tag=>{const node=new Element(tag);nodes.push(node);return node;};
  install('document',{createElement:create,createElementNS:(_,tag)=>create(tag)});
  install('fetch',(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject})));
  install('IntersectionObserver',class{constructor(callback){observer=callback;}observe(){observer([{isIntersecting:true}]);}});
  install('setTimeout',(fn,delay)=>{timers.set(++next,{fn,delay});return next;});
  install('clearTimeout',id=>timers.delete(id));
  install('devicePixelRatio',density);
  install('matchMedia',query=>{const target=new EventTarget();target.media=query;queries.push(target);return target;});
  if(!globalThis.CustomEvent)install('CustomEvent',class extends Event{constructor(name){super(name);}});
  t.after(()=>{timers.clear();for(const [name,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
  const svg=create('svg');svg.id='bounded-map';svg.clientWidth=width;svg.clientHeight=height;svg.viewBox={baseVal:{x:0,y:0,width:960,height:430}};
  mountGeography(svg,project,create('section'));
  const status=()=>nodes.find(node=>node.attributes.role==='status');
  const imageLink=()=>nodes.find(node=>node.tag==='a'&&node.textContent==='Open displayed reference image');
  const images=()=>nodes.filter(node=>node.tag==='image');
  const layer=()=>nodes.find(node=>node.classList.has('basemap-layer'));
  const fireDelay=delay=>{for(const [id,timer]of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}};
  const change=()=>svg.dispatchEvent(new Event('mapviewchange'));
  const select=nodes.find(node=>node.tag==='select');
  const mode=value=>{select.value=value;select.dispatchEvent(new Event('change'));};
  const respond=async(index,data=valid(),ok=true)=>{requests[index].resolve({ok,json:async()=>data});await tick();};
  const load=async(index,data=valid())=>{await respond(index,data);const image=images().at(-1);image.dispatchEvent(new Event('load'));return image;};
  return {svg,nodes,requests,timers,queries,status,imageLink,images,layer,fireDelay,change,mode,respond,load};
}

test('a successful matching request survives a same-bucket resize without provider traffic',async t=>{
  const f=fixture(t);assert.equal(f.requests.length,1);
  assert.equal(new URL(f.requests[0].url).searchParams.get('size'),'1024,512');
  const image=await f.load(0,valid('displayed'));
  assert.equal(f.imageLink().href,valid('displayed').href);assert.equal(f.imageLink().hidden,false);
  f.svg.clientWidth=1010;f.svg.clientHeight=455;f.change();f.fireDelay(350);await tick();
  assert.equal(f.requests.length,1);assert.deepEqual(f.layer().children,[image]);
  assert.match(f.status().textContent,/geography loaded/);assert.equal(f.timers.size,0);
  f.svg.clientWidth=1100;f.change();assert.equal(f.requests.length,1);f.fireDelay(350);
  assert.equal(f.requests.length,2);assert.equal(new URL(f.requests[1].url).searchParams.get('size'),'1152,576');
  assert.deepEqual(f.layer().children,[image]);assert.equal(f.imageLink().href,valid('displayed').href);
  await f.respond(1,valid('replacement'));
  const pending=f.images().at(-1);assert.equal(pending.style.visibility,'hidden');assert.ok(f.layer().children.includes(image));
  pending.dispatchEvent(new Event('load'));
  assert.deepEqual(f.layer().children,[pending]);assert.equal(f.imageLink().href,valid('replacement').href);
  assert.equal(f.timers.size,0);
});

test('a same-key resize keeps its pending request and commits actual returned extent and source',async t=>{
  const f=fixture(t);f.svg.clientWidth=1010;f.change();f.fireDelay(350);
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].options.signal.aborted,false);
  const actual={xmin:-98.1,ymin:34.9,xmax:-96.9,ymax:35.6,spatialReference:{wkid:4326}};
  const image=await f.load(0,valid('actual-extent',actual));
  assert.ok(Math.abs(Number(image.attributes.x)+96)<1e-8);
  assert.ok(Math.abs(Number(image.attributes.y)+86)<1e-8);
  assert.ok(Math.abs(Number(image.attributes.width)-1152)<1e-8);
  assert.ok(Math.abs(Number(image.attributes.height)-602)<1e-8);
  assert.equal(f.imageLink().href,image.attributes.href);
});

test('bounds and mode participate in the key, and stale metadata and image events cannot replace current source',async t=>{
  const f=fixture(t);const first=await f.load(0,valid('first'));
  f.svg.viewBox.baseVal.x=48;f.change();f.fireDelay(350);assert.equal(f.requests.length,2);
  assert.notEqual(f.requests[1].url,f.requests[0].url);
  await f.respond(1,valid('late-image'));const staleImage=f.images().at(-1);
  f.svg.viewBox.baseVal.x=96;f.change();f.fireDelay(350);assert.equal(f.requests.length,3);
  staleImage.dispatchEvent(new Event('load'));assert.deepEqual(f.layer().children,[first]);assert.equal(f.imageLink().href,valid('first').href);
  f.mode('terrain');assert.equal(f.requests.length,4);assert.deepEqual(f.layer().children,[]);assert.equal(f.imageLink().hidden,true);
  assert.equal(f.requests[2].options.signal.aborted,true);
  await f.respond(2,valid('late-metadata'));assert.equal(f.images().length,2);
  const terrain=await f.load(3,valid('terrain'));
  assert.deepEqual(f.layer().children,[terrain]);assert.match(f.status().textContent,/terrain geography loaded/);
  assert.equal(f.imageLink().href,valid('terrain').href);assert.match(f.requests[3].url,/USGSShadedReliefOnly/);
});

test('returning to a displayed key retires a different pending request without losing the displayed image',async t=>{
  const f=fixture(t);const image=await f.load(0,valid('retained'));
  f.svg.clientWidth=1100;f.change();f.fireDelay(350);assert.equal(f.requests.length,2);
  f.svg.clientWidth=1000;f.change();assert.equal(f.requests[1].options.signal.aborted,true);
  await f.respond(1,valid('must-not-commit'));f.fireDelay(350);
  assert.equal(f.requests.length,2);assert.deepEqual(f.layer().children,[image]);
  assert.equal(f.imageLink().href,valid('retained').href);assert.equal(f.timers.size,0);
});

test('none clears image identity, cancels pending work and requires a new positive load on re-entry',async t=>{
  const f=fixture(t);await f.respond(0,valid('retired'));const retired=f.images().at(-1);
  f.mode('none');assert.deepEqual(f.layer().children,[]);assert.equal(f.imageLink().hidden,true);assert.equal(f.imageLink().href,'');
  assert.equal(f.requests[0].options.signal.aborted,true);retired.dispatchEvent(new Event('load'));
  assert.equal(f.svg.classList.has('has-basemap'),false);assert.match(f.status().textContent,/Historical evidence only/);
  f.mode('streets');assert.equal(f.requests.length,2);await f.load(1,valid('re-entry'));
  assert.equal(f.imageLink().href,valid('re-entry').href);assert.equal(f.svg.classList.has('has-basemap'),true);
});

test('metadata rejection, image failure and timeout are not successful cache entries and preserve explicit retry',async t=>{
  const f=fixture(t);await f.respond(0,{...valid(),extent:{...valid().extent,spatialReference:{wkid:3857}}});
  assert.match(f.status().textContent,/could not be loaded/);assert.equal(f.imageLink().hidden,true);
  f.mode('streets');assert.equal(f.requests.length,2);assert.equal(f.requests[1].url,f.requests[0].url);
  await f.respond(1,valid('failure'));f.images().at(-1).dispatchEvent(new Event('error'));
  assert.match(f.status().textContent,/imagery unavailable/);assert.equal(f.imageLink().hidden,true);
  f.mode('streets');await f.respond(2,valid('timeout'));const expired=f.images().at(-1);f.fireDelay(15000);
  assert.match(f.status().textContent,/timed out/);expired.dispatchEvent(new Event('load'));
  assert.equal(f.svg.classList.has('has-basemap'),false);assert.equal(f.imageLink().hidden,true);
  f.mode('streets');assert.equal(f.requests.length,4);await f.load(3,valid('recovered'));
  assert.equal(f.imageLink().href,valid('recovered').href);assert.equal(f.timers.size,0);
});

test('a hidden zero-size map waits, while density changes use the same bounded request identity',async t=>{
  const f=fixture(t,{width:0,height:0});assert.equal(f.requests.length,0);
  assert.match(f.status().textContent,/visible size/);
  f.svg.clientWidth=1000;f.svg.clientHeight=450;f.change();f.fireDelay(350);assert.equal(f.requests.length,1);
  await f.load(0,valid('one-density'));
  assert.equal(f.queries[0].media,'(resolution:1dppx)');globalThis.devicePixelRatio=2;
  f.queries[0].dispatchEvent(new Event('change'));assert.equal(f.queries.length,2);f.fireDelay(350);
  assert.equal(f.requests.length,2);assert.equal(new URL(f.requests[1].url).searchParams.get('size'),'2048,1024');
  await f.load(1,valid('two-density'));globalThis.devicePixelRatio=3;f.queries[1].dispatchEvent(new Event('change'));f.fireDelay(350);
  assert.equal(f.requests.length,2);assert.equal(f.queries.length,3);assert.match(f.status().textContent,/density is bounded/);
  f.svg.clientWidth=0;f.svg.clientHeight=0;globalThis.devicePixelRatio=1;f.queries[2].dispatchEvent(new Event('change'));
  assert.equal(f.requests.length,2);assert.equal(f.timers.size,0);assert.equal(f.imageLink().href,valid('two-density').href);
});
