import test from 'node:test';
import assert from 'node:assert/strict';
import {mountGeography} from '../web/geography-view.mjs';

// Exercise the asynchronous response-to-image boundary without a browser or
// network. Image events are explicit so every test clears its pending timer.
class Element extends EventTarget {
  constructor(tag) {
    super();this.tag=tag;this.children=[];this.attributes={};this.textContent='';
    this.value=tag==='select'?'streets':'';
    this.classList=new Set();this.classList.remove=name=>this.classList.delete(name);
    this.style={removeProperty:name=>delete this.style[name]};
  }
  append(...children) {for(const child of children){child.parent=this;this.children.push(child);}}
  prepend(child) {child.parent=this;this.children.unshift(child);}
  replaceChildren(...children) {this.children=[];this.append(...children);}
  setAttribute(key,value) {this.attributes[key]=String(value);}
  remove() {if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
}
const extent={xmin:-98.06,ymin:35.43,xmax:-97.82,ymax:35.56,spatialReference:{wkid:4326}};
const valid={href:'https://basemap.nationalmap.gov/arcgis/rest/directories/arcgisoutput/example.png',extent};
const project=([lon,lat])=>[(lon+98.06)*2000,(35.56-lat)*2000];

test('only a validated geographic response can become a reference map image',async t=>{
  const cases=[
    ['valid geographic extent',valid,true],
    ['wrong spatial reference',{...valid,extent:{...extent,spatialReference:{wkid:3857}}},false],
    ['missing spatial reference',{...valid,extent:{...extent,spatialReference:undefined}},false],
    ['conflicting reference',{...valid,extent:{...extent,spatialReference:{wkid:4326,latestWkid:3857}}},false],
    ['missing coordinate',{...valid,extent:{...extent,xmax:undefined}},false],
    ['string coordinate',{...valid,extent:{...extent,xmin:'-98.06'}},false],
    ['reversed extent',{...valid,extent:{...extent,xmax:-99}},false],
    ['projected units',{...valid,extent:{...extent,xmin:-10916000}},false],
    ['nonfinite extent',{...valid,extent:{...extent,ymax:Infinity}},false],
    ['foreign image origin',{...valid,href:'https://example.test/map.png'},false],
    ['service error',{...valid,error:{message:'Service unavailable'}},false],
  ];
  for(const [name,response,accepted] of cases) await t.test(name,async()=>{
    const original={document:globalThis.document,fetch:globalThis.fetch,observer:globalThis.IntersectionObserver};
    const nodes=[];
    const create=tag=>{const node=new Element(tag);nodes.push(node);return node;};
    globalThis.document={createElement:create,createElementNS:(_,tag)=>create(tag)};
    globalThis.fetch=async()=>({ok:true,json:async()=>response});
    globalThis.IntersectionObserver=class {constructor(callback){this.callback=callback;}observe(){this.callback([{isIntersecting:true}]);}};
    try {
      const svg=create('svg');svg.id='fixture';svg.viewBox={baseVal:{x:0,y:0,width:480,height:260}};
      mountGeography(svg,project,create('section'));
      await new Promise(resolve=>setImmediate(resolve));
      const images=nodes.filter(node=>node.tag==='image');
      assert.equal(images.length,accepted?1:0);
      const status=nodes.find(node=>node.attributes.role==='status');
      if(accepted) {
        images[0].dispatchEvent(new Event('load'));
        assert.match(status.textContent,/geography loaded/);
        assert.ok(Math.abs(Number(images[0].attributes.width)-480)<1e-8);
        assert.ok(svg.classList.has('has-basemap'));
      } else {
        assert.match(status.textContent,/could not be loaded/);
        assert.equal(svg.classList.has('has-basemap'),false);
      }
    } finally {
      for(const image of nodes.filter(node=>node.tag==='image')) image.dispatchEvent(new Event('error'));
      if(original.document===undefined)delete globalThis.document;else globalThis.document=original.document;
      if(original.observer===undefined)delete globalThis.IntersectionObserver;else globalThis.IntersectionObserver=original.observer;
      globalThis.fetch=original.fetch;
    }
  });
});

test('an image arriving after its timeout cannot resurrect the failed layer',async()=>{
  const original={document:globalThis.document,fetch:globalThis.fetch,observer:globalThis.IntersectionObserver,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
  const nodes=[],timers=new Map();let next=0;
  const create=tag=>{const node=new Element(tag);nodes.push(node);return node;};
  globalThis.document={createElement:create,createElementNS:(_,tag)=>create(tag)};
  globalThis.fetch=async()=>({ok:true,json:async()=>valid});
  globalThis.IntersectionObserver=class{constructor(callback){this.callback=callback;}observe(){this.callback([{isIntersecting:true}]);}};
  globalThis.setTimeout=fn=>{timers.set(++next,fn);return next;};globalThis.clearTimeout=id=>timers.delete(id);
  try{
    const svg=create('svg');svg.id='timeout';svg.viewBox={baseVal:{x:0,y:0,width:480,height:260}};
    mountGeography(svg,project,create('section'));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(timers.size,1);[...timers.values()][0]();
    const status=nodes.find(node=>node.attributes.role==='status');assert.match(status.textContent,/timed out/);
    nodes.find(node=>node.tag==='image').dispatchEvent(new Event('load'));
    assert.equal(svg.classList.has('has-basemap'),false);assert.match(status.textContent,/timed out/);
  }finally{
    for(const [key,value] of Object.entries(original)){
      const name=key==='observer'?'IntersectionObserver':key;
      if(value===undefined)delete globalThis[name];else globalThis[name]=value;
    }
  }
});
