import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';

const readJSON=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const index=readJSON('../web/events.json'),config=readJSON('../web/events/el-reno-2013.json');
const data=readJSON('../web/data.json');
const sourceB={...data.footage.sources[0],id:'synthetic-source-b',creator:'Synthetic provider B',video_id:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk'};
const anchorB={...data.footage.anchors[0],id:'synthetic-anchor-b',source_id:sourceB.id,video_seconds:20,note:'Synthetic source-switch test, not a historical observation.'};
data.footage.sources.push(sourceB);data.footage.anchors.splice(1,0,anchorB);
const bundle=Buffer.from(JSON.stringify(data));
config.bundle_sha256=createHash('sha256').update(bundle).digest('hex');
let moduleId=0;

async function fixture(t,href) {
  const ids=new Map(),created=[],frames=new Map(),requests=[],historyWrites=[];
  const location=new URL(href);let nextFrame=0,ready;
  const mounted=new Promise(resolve=>{ready=resolve;});
  class Element {
    constructor(tag='div') {this.tagName=tag.toUpperCase();this.children=[];this.handlers=new Map();this.attributes=new Map();this.dataset={};this._text='';this._value='';this.checked=false;this.hidden=false;this.disabled=false;this.clientWidth=800;this.clientHeight=500;}
    set id(value) {this._id=value;ids.set(value,this);}
    get id() {return this._id;}
    set value(value) {this._value=String(value);}
    get value() {return this._value;}
    set textContent(value) {this._text=String(value);this.children=[];}
    get textContent() {return this._text+this.children.map(child=>child.textContent).join('');}
    set href(value) {this.attributes.set('href',new URL(String(value),location.href).href);if(this.id==='replay-link')ready();}
    get href() {return this.attributes.get('href');}
    setAttribute(name,value) {this.attributes.set(name,String(value));}
    getAttribute(name) {return this.attributes.get(name)??null;}
    hasAttribute(name) {return this.attributes.has(name);}
    removeAttribute(name) {this.attributes.delete(name);}
    append(...children) {this.children.push(...children);}
    replaceChildren(...children) {this._text='';this.children=[...children];}
    addEventListener(name,callback) {if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(callback);}
    fire(name) {for(const callback of this.handlers.get(name)||[])callback({target:this});}
    getContext() {return {};}
  }
  const document={hidden:false,documentElement:new Element(),head:new Element('head'),fonts:{ready:Promise.resolve()},
    createElement:tag=>{const element=new Element(tag);created.push(element);return element;},
    getElementById:id=>{if(!ids.has(id)){const element=new Element();element.id=id;}return ids.get(id);},
    querySelectorAll:()=>[],addEventListener:()=>{}};
  document.getElementById('replay-error').hidden=true;
  document.getElementById('replay-time').disabled=true;
  const globals={document,location,crypto:webcrypto,window:new EventTarget(),
    history:Object.fromEntries(['pushState','replaceState'].map(method=>[method,(_state,_title,url)=>{location.href=String(url);historyWrites.push({method,href:location.href});}])),
    fetch:async path=>{
      requests.push(String(path));
      if(path==='events.json')return {ok:true,json:async()=>index};
      if(path==='events/el-reno-2013.json')return {ok:true,json:async()=>config};
      if(path==='data.json')return {ok:true,arrayBuffer:async()=>Uint8Array.from(bundle).buffer};
      throw new Error(`Unexpected request: ${path}`);
    },
    matchMedia:()=>({matches:false,addEventListener:()=>{}}),
    requestAnimationFrame:callback=>{const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),
    ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}}};
  const original=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;frames.clear();for(const [key,descriptor] of original)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];};
  t.after(dispose);
  // Mount the real package loader and replay/footage views. Painting is outside this fixture.
  await import(new URL(`../web/reconstruction.js?share-consumer=${++moduleId}`,import.meta.url));
  let timer;
  try {await Promise.race([mounted,new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error(`Replay did not mount: ${document.getElementById('replay-error').textContent}`)),2000);})]);}
  finally {clearTimeout(timer);}
  assert.equal(document.getElementById('replay-error').hidden,true);
  assert.equal(document.getElementById('replay-time').disabled,false);
  return {ids,location,historyWrites,dispose,
    share:()=>new URL(ids.get('replay-link').href),
    unloaded(){assert.deepEqual(requests,['events.json','events/el-reno-2013.json','data.json']);assert.equal(created.some(element=>['SCRIPT','IFRAME'].includes(element.tagName)),false,'Sharing never loads the video provider');},
    seek(seconds){const control=ids.get('replay-time');control.value=seconds;control.fire('input');},
    sourceB(){assert.equal(ids.get('footage-source').value,sourceB.id);},
    checkedB(){assert.match(ids.get('footage-status').textContent,/Synthetic provider B · video 0:20/);},
    gap(){assert.match(ids.get('footage-status').textContent,/No checked video frame/);}};
}

test('visible replay link reopens the selected source at its coincident checked anchor',async t=>{
  const f=await fixture(t,'https://example.test/reconstruction.html?event=el-reno-2013&t=783');
  const picker=f.ids.get('footage-source');picker.value=sourceB.id;picker.fire('change');
  f.sourceB();f.checkedB();
  const shared=f.share();
  assert.equal(shared.searchParams.get('event'),'el-reno-2013');
  assert.equal(shared.searchParams.get('t'),'783');
  assert.equal(shared.searchParams.get('footage_source'),sourceB.id);
  assert.equal(shared.searchParams.get('footage'),anchorB.id);
  f.unloaded();f.dispose();
  const reopened=await fixture(t,shared.href);reopened.sourceB();reopened.checkedB();reopened.unloaded();
  assert.equal(reopened.ids.get('replay-time').value,'783');
});

test('visible replay link retains the source through an unassigned gap without an anchor or stale fragment',async t=>{
  const f=await fixture(t,`https://example.test/reconstruction.html?event=el-reno-2013&t=783&footage=${anchorB.id}#registered-footage`);
  f.checkedB();f.seek(782);f.sourceB();f.gap();
  const shared=f.share();
  assert.equal(shared.searchParams.get('t'),'782');
  assert.equal(shared.searchParams.get('footage_source'),sourceB.id);
  assert.equal(shared.searchParams.has('footage'),false);assert.equal(shared.hash,'');
  assert.equal(f.location.searchParams.get('t'),'782');
  assert.equal(f.location.searchParams.has('footage'),false);
  f.unloaded();f.dispose();
  const reopened=await fixture(t,shared.href);reopened.sourceB();reopened.gap();reopened.unloaded();
});

test('visible replay link floors time while the current address preserves its fractional second and source',async t=>{
  const href=`https://example.test/reconstruction.html?event=el-reno-2013&t=783.5&footage_source=${sourceB.id}`;
  const f=await fixture(t,href);f.sourceB();f.checkedB();
  assert.equal(f.location.href,href);assert.equal(f.ids.get('replay-time').value,'784','The whole-second slider rounds without changing the fractional historical clock');
  assert.deepEqual(f.historyWrites,[],'Computing a share link does not rewrite the current address');
  const shared=f.share();
  assert.equal(shared.searchParams.get('t'),'783');
  assert.equal(shared.searchParams.get('footage_source'),sourceB.id);
  assert.equal(shared.searchParams.get('footage'),anchorB.id);
  assert.equal(f.location.searchParams.has('footage'),false,'A fractional current time does not acquire an exact anchor');
  f.unloaded();f.dispose();
  const reopened=await fixture(t,shared.href);reopened.sourceB();reopened.checkedB();reopened.unloaded();
  assert.equal(reopened.ids.get('replay-time').value,'783');
});
