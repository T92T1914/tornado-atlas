import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPhotoViewer} from '../web/photo-view.mjs';
import {webcrypto,createHash} from 'node:crypto';

// A small DOM fixture lets network completions arrive in a controlled order.
function fixture(t) {
  const previous = globalThis.document, nodes = new Map();
  class Element {
    constructor(tag = 'div') {this.tag = tag; this.hidden = false; this.listeners = {}; this.attributes = {}; this.textContent = '';}
    set id(value) {this._id = value; nodes.set(value, this);}
    get id() {return this._id;}
    setAttribute(key, value) {this.attributes[key] = value;}
    removeAttribute(key) {delete this.attributes[key]; delete this[key];}
    addEventListener(type, fn) {(this.listeners[type] ||= []).push(fn);}
    emit(type) {for (const fn of this.listeners[type] || []) fn();}
    replaceWith(next) {nodes.set(this.id, next);}
    after() {}
    showModal() {this.open = true;}
    close() {this.open = false; this.emit('close');}
    focus() {globalThis.document.activeElement = this;}
    decode() {return Promise.resolve();}
  }
  for (const id of ['photo-dialog', 'photo-full', 'photo-close', 'photo-failure', 'photo-title',
    'photo-caption', 'photo-location', 'photo-credit', 'photo-source', 'photo-original', 'photo-license']) {
    const element = new Element(); element.id = id;
  }
  globalThis.document = {getElementById: id => nodes.get(id), createElement: tag => new Element(tag)};
  t.after(() => {
    if (nodes.get('photo-dialog').open) nodes.get('photo-dialog').close();
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  });
  return {open: mountPhotoViewer(), get: id => nodes.get(id)};
}
const first = {title:'First record', asset:'first.jpg', alt:'First photograph', caption:'First caption',
  location:'Time unknown', credit:'First photographer', source:'https://example.test/first',
  license:'Example license', licenseUrl:'https://example.test/license'};
const second = {title:'Second record', asset:'second.jpg', alt:'Second photograph', caption:'Second caption',
  location:'Camera position unknown', credit:'Second photographer', source:'https://example.test/second'};

test('the selected caption is never paired with the previous loaded photograph', t => {
  const {open,get} = fixture(t);
  open(first); get('photo-full').emit('load');
  assert.equal(get('photo-full').hidden, false);
  const oldImage = get('photo-full');
  get('photo-close').emit('click'); open(second);
  assert.equal(get('photo-full').hidden, true);
  assert.notEqual(get('photo-full'), oldImage);
  assert.equal(get('photo-caption').textContent, second.caption);
  assert.match(get('photo-status').textContent, /Loading/);
  get('photo-full').emit('load');
  assert.equal(get('photo-full').hidden, false);
  assert.equal(get('photo-status').textContent, '');
});

test('a failed request retains its source and can be retried without closing', t => {
  const {open,get} = fixture(t); open(first);
  const failed = get('photo-full'); failed.emit('error');
  assert.equal(failed.src, first.asset, 'Ordinary failure keeps its selected request URL');
  assert.equal(get('photo-full').hidden, true);
  assert.equal(get('photo-failure').hidden, false);
  assert.equal(get('photo-source').href, first.source);
  assert.equal(get('photo-credit').textContent, first.credit);
  assert.equal(get('photo-retry')?.hidden, false);
  get('photo-retry').emit('click');
  const retried = get('photo-full');
  assert.notEqual(retried, failed);
  assert.equal(retried.src, first.asset);
  assert.equal(get('photo-failure').hidden, true);
  assert.equal(get('photo-dialog').open, true);
  retried.emit('load');
  assert.equal(retried.hidden, false);
  assert.equal(get('photo-retry').hidden, true);
  assert.equal(document.activeElement, get('photo-close'));
});

test('late events from a replaced request cannot hide or reveal the selected image', t => {
  const {open,get} = fixture(t); open(first);
  const stale = get('photo-full');
  open(second); const current = get('photo-full');
  stale.emit('load'); assert.equal(current.hidden, true);
  current.emit('load'); stale.emit('error');
  assert.equal(current.hidden, false);
  assert.equal(get('photo-failure').hidden, true);
  assert.equal(get('photo-source').href, second.source);
  assert.equal(get('photo-license').hidden, true);
  assert.equal(get('photo-license').href, undefined);
});

test('closing a pending photograph invalidates its later network completion', t => {
  const {open,get} = fixture(t); open(first);
  const pending = get('photo-full'); get('photo-dialog').close();
  pending.emit('error'); pending.emit('load');
  assert.equal(get('photo-failure').hidden, true);
  assert.equal(get('photo-full').hidden, true);
  assert.equal(get('photo-status').textContent, '');
  open(second); get('photo-full').emit('load');
  assert.equal(get('photo-full').hidden, false);
});

test('queued close events do not clear a newly reopened photograph', t => {
  const {open,get} = fixture(t); open(first);
  get('photo-dialog').open = false;
  open(second); get('photo-dialog').emit('close');
  get('photo-full').emit('load');
  assert.equal(get('photo-full').src, second.asset);
  assert.equal(get('photo-full').hidden, false);
});

const bytes=new Uint8Array([1,2,3,4]),expectedSha256=createHash('sha256').update(bytes).digest('hex');
const originalDigest=webcrypto.subtle.digest.bind(webcrypto.subtle);
const checkedFirst={...first,expectedSha256};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function checkedNetwork(t,{fetcher=async()=>new Response(bytes),digest=originalDigest}={}){
  t.mock.method(globalThis,'fetch',fetcher);
  const digests=[];
  t.mock.method(globalThis.crypto.subtle,'digest',(...args)=>{
    const result=Promise.resolve(digest(...args));digests.push(result);return result;
  });
  const urls=[],retired=[];
  t.mock.method(URL,'createObjectURL',blob=>{const url='blob:fixture-'+urls.length;urls.push({url,blob});return url;});
  t.mock.method(URL,'revokeObjectURL',url=>retired.push(url));
  return {urls,retired,settled:async()=>{await flush();await Promise.all(digests);await flush();}};
}

test('checked bytes alone create the display URL and close retires it exactly once',async t=>{
  const {urls,retired,settled}=checkedNetwork(t),{open,get}=fixture(t);open(checkedFirst);
  assert.equal(get('photo-full').src,undefined);assert.equal(get('photo-full').hidden,true);
  await settled();assert.equal(urls.length,1);assert.deepEqual(new Uint8Array(await urls[0].blob.arrayBuffer()),bytes);
  assert.equal(get('photo-full').src,urls[0].url);assert.equal(get('photo-full').hidden,true);
  get('photo-full').emit('load');await flush();assert.equal(get('photo-full').hidden,false);
  assert.match(get('photo-status').textContent,/bytes match/);
  get('photo-dialog').close();assert.deepEqual(retired,[urls[0].url]);
  get('photo-dialog').emit('close');assert.deepEqual(retired,[urls[0].url]);
});

test('mismatch creates no display URL and exact restoration plus Retry preserves the record',async t=>{
  let correct=false;
  const {urls,settled}=checkedNetwork(t,{fetcher:async()=>new Response(correct?bytes:new Uint8Array([4,3,2,1]))});
  const {open,get}=fixture(t);open(checkedFirst);await settled();
  assert.equal(urls.length,0);assert.equal(get('photo-full').src,undefined);
  assert.match(get('photo-status').textContent,/does not match/);assert.equal(get('photo-retry').hidden,false);
  assert.equal(get('photo-source').href,first.source);assert.equal(get('photo-original').href,first.asset);
  correct=true;get('photo-retry').emit('click');await settled();get('photo-full').emit('load');await flush();
  assert.equal(urls.length,1);assert.equal(get('photo-full').hidden,false);
  assert.equal(get('photo-dialog').open,true);assert.equal(document.activeElement,get('photo-close'));
  get('photo-dialog').close();
});

test('replaced and closed pending digests cannot create URLs or reveal a stale image',async t=>{
  const finishes=[],{urls}=checkedNetwork(t,{digest:()=>new Promise(resolve=>finishes.push(resolve))});
  const {open,get}=fixture(t);open(checkedFirst);await flush();const old=get('photo-full');
  open(second);const next=get('photo-full');next.emit('load');
  finishes[0](await originalDigest('SHA-256',bytes));await flush();
  old.emit('load');assert.equal(next.src,second.asset);assert.equal(next.hidden,false);
  open(checkedFirst);await flush();get('photo-dialog').close();
  finishes[1](await originalDigest('SHA-256',bytes));await flush();
  assert.equal(urls.length,0);
  assert.equal(get('photo-full').src,undefined);assert.equal(get('photo-full').hidden,true);
  assert.equal(get('photo-status').textContent,'');
});

test('deadline rejects stalled hashing without a display or replacement fetch',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let requests=0,signal,finish;
  const {urls}=checkedNetwork(t,{fetcher:async(_url,init)=>{requests++;signal=init.signal;return new Response(bytes);},
    digest:()=>new Promise(resolve=>{finish=resolve;})});
  const {open,get}=fixture(t);open(checkedFirst);await flush();t.mock.timers.tick(10000);
  assert.equal(signal.aborted,true);assert.equal(requests,1);assert.equal(urls.length,0);
  assert.equal(get('photo-full').hidden,true);assert.equal(get('photo-retry').hidden,false);
  assert.match(get('photo-status').textContent,/too long/);
  finish(new Uint8Array(Buffer.from(expectedSha256,'hex')));await flush();assert.equal(urls.length,0);
  get('photo-dialog').close();
});

for(const phase of ['headers','body'])test(`deadline aborts stalled original ${phase} with one request and keeps recovery`,async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let signal,requests=0;
  const {urls}=checkedNetwork(t,{fetcher:async(_url,init)=>{
    signal=init.signal;requests++;
    if(phase==='headers')return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    return new Response(new ReadableStream({start(controller){
      controller.enqueue(new Uint8Array([1]));
      signal.addEventListener('abort',()=>controller.error(signal.reason),{once:true});
    }}));
  }});
  const {open,get}=fixture(t);open(checkedFirst);await flush();t.mock.timers.tick(10000);await flush();
  assert.equal(requests,1);assert.equal(signal.aborted,true);assert.equal(urls.length,0);
  assert.equal(get('photo-full').hidden,true);assert.equal(get('photo-retry').hidden,false);
  assert.match(get('photo-status').textContent,/too long/);assert.equal(get('photo-source').href,first.source);
  get('photo-dialog').close();
});

test('deadline retires a checked URL still awaiting its resource load event',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {urls,retired,settled}=checkedNetwork(t),{open,get}=fixture(t);open(checkedFirst);await settled();
  assert.equal(urls.length,1);const late=get('photo-full');t.mock.timers.tick(10000);late.emit('load');
  assert.deepEqual(retired,[urls[0].url]);assert.equal(late.hidden,true);assert.equal(late.src,undefined);
  assert.match(get('photo-status').textContent,/too long/);get('photo-dialog').close();
});

test('checked load stays hidden until explicit decoding resolves',async t=>{
  const {settled}=checkedNetwork(t),{open,get}=fixture(t);open(checkedFirst);await settled();
  let decoded;const image=get('photo-full');image.decode=()=>new Promise(resolve=>{decoded=resolve;});
  image.emit('load');assert.equal(image.hidden,true);assert.match(get('photo-status').textContent,/Checking/);
  decoded();await flush();assert.equal(image.hidden,false);assert.match(get('photo-status').textContent,/bytes match/);
  get('photo-dialog').close();
});

for(const phase of ['reject','unavailable'])test(`explicit decoder ${phase} keeps checked image unavailable and retires its URL`,async t=>{
  const {settled,urls,retired}=checkedNetwork(t),{open,get}=fixture(t);open(checkedFirst);await settled();
  const image=get('photo-full');image.decode=phase==='reject'?()=>Promise.reject(Error('Synthetic decoder failure')):undefined;
  image.emit('load');await flush();assert.equal(image.hidden,true);assert.equal(image.src,undefined);
  assert.equal(get('photo-retry').hidden,false);assert.match(get('photo-status').textContent,/finish decoding/);
  assert.deepEqual(retired,[urls[0].url]);get('photo-dialog').close();
});

for(const action of ['timeout','replace','close'])test(`pending decode completion after ${action} cannot display its stale checked image`,async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {settled,urls,retired}=checkedNetwork(t),{open,get}=fixture(t);open(checkedFirst);await settled();
  let finish;const image=get('photo-full');image.decode=()=>new Promise(resolve=>{finish=resolve;});image.emit('load');
  if(action==='timeout')t.mock.timers.tick(10000);
  else if(action==='replace'){open(second);get('photo-full').emit('load');}
  else get('photo-dialog').close();
  finish();await flush();assert.equal(image.hidden,true);assert.equal(image.src,undefined);
  assert.deepEqual(retired,[urls[0].url]);
  if(action==='replace'){assert.equal(get('photo-full').src,second.asset);assert.equal(get('photo-full').hidden,false);}
  if(action==='timeout')assert.match(get('photo-status').textContent,/too long/);
  if(action==='close')assert.equal(get('photo-status').textContent,'');
  get('photo-dialog').close();
});

for(const phase of ['hash','decode'])test(`expired ${phase} completion fails even with its timer callback withheld`,async t=>{
  let now=0;const callbacks=[];
  t.mock.method(performance,'now',()=>now);
  t.mock.method(globalThis,'setTimeout',fn=>{callbacks.push(fn);return callbacks.length;});
  t.mock.method(globalThis,'clearTimeout',()=>{});
  let finish,signal;
  const network=checkedNetwork(t,{fetcher:async(_url,init)=>{signal=init.signal;return new Response(bytes);},
    ...(phase==='hash'?{digest:()=>new Promise(resolve=>{finish=resolve;})}:{})});
  const {open,get}=fixture(t);open(checkedFirst);
  if(phase==='hash'){await flush();now=10001;finish(await originalDigest('SHA-256',bytes));await flush();}
  else{await network.settled();const image=get('photo-full');image.decode=()=>new Promise(resolve=>{finish=resolve;});image.emit('load');now=10001;finish();await flush();}
  assert.equal(get('photo-full').hidden,true);assert.equal(get('photo-retry').hidden,false);
  assert.match(get('photo-status').textContent,/too long/);
  assert.equal(get('photo-full').src,undefined);
  assert.equal(signal.aborted,true);
  assert.deepEqual(network.retired,phase==='hash'?[]:[network.urls[0].url]);
  open(second);get('photo-full').emit('load');callbacks[0]();
  assert.equal(get('photo-full').src,second.asset);assert.equal(get('photo-full').hidden,false);
  assert.equal(get('photo-failure').hidden,true);get('photo-dialog').close();
});

for(const method of ['createObjectURL','revokeObjectURL'])test(`missing ${method} fails closed without allocating a checked display`,async t=>{
  const descriptor=Object.getOwnPropertyDescriptor(URL,method);
  const {urls,settled}=checkedNetwork(t);
  Object.defineProperty(URL,method,{value:undefined,configurable:true});
  t.after(()=>Object.defineProperty(URL,method,descriptor));
  const {open,get}=fixture(t);open(checkedFirst);await settled();
  assert.equal(urls.length,0);assert.equal(get('photo-full').src,undefined);
  assert.equal(get('photo-full').hidden,true);assert.equal(get('photo-retry').hidden,false);
  assert.match(get('photo-status').textContent,/cannot display a checked image/);get('photo-dialog').close();
});
