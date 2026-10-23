import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

// Controlled DOM/fetch/lifecycle accounting. This is not native
// WebKit, public source access, a historical claim or replacement for the
// unchanged derived-film-still browser journey and zero-pageerror assertion.
const source=await fs.readFile(new URL('../web/documentary-view.mjs',import.meta.url),'utf8');
const program=source.replace(/^import [^\r\n]+;\r?\n/gm,'').replace(/^export /gm,'')+'\nthis.mount=mountResearchLog;';
const report={checked_at:'2026-10-23T00:00:00Z',counts:{reachable:1,access_unresolved:1},results:[{url:'https://example.org/checked',access:'reachable'},{url:'https://example.net/unresolved',access:'access_unresolved',http_status:503}]};
const fallback='The link audit could not be loaded. Its preserved file is linked below.';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
class Node{
 constructor(tag,text=''){this.tagName=tag;this.children=[];this.own=text;}
 append(...items){for(const item of items){if(item.tagName==='fragment')this.children.push(...item.children);else this.children.push(item);}}
 replaceChildren(...items){this.children=[];this.own='';this.append(...items);}
 set textContent(value){this.own=String(value);this.children=[];}
 get textContent(){return this.own+this.children.map(item=>typeof item==='string'?item:item.textContent).join('');}
}
function model({throws=null}={}){
 const nodes=new Map(['research-log','unmapped-fatalities','link-audit-summary'].map(id=>[id,new Node('div')])),listeners=new Map(),requests=[];
 const document={getElementById:id=>nodes.get(id),querySelectorAll:()=>[],createElement:tag=>new Node(tag),createTextNode:text=>new Node('text',text),createDocumentFragment:()=>new Node('fragment')};
 const window={addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(callback);},removeEventListener(type,callback){listeners.get(type)?.delete(callback);}};
 const fetch=(url,options={})=>{if(throws)throw throws;let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({url,signal:options.signal,resolve,reject});return promise;};
 const realm={document,window,fetch,AbortController,URL,Promise};vm.runInNewContext(program,realm,{timeout:1000});
 return {requests,listeners,host:nodes.get('link-audit-summary'),mount:(options={})=>realm.mount({log:[],unmapped_fatalities:[]},options),emit:(type,extra={})=>{for(const callback of [...listeners.get(type)||[]])callback({type,...extra});}};
}
const success=value=>({ok:true,json:async()=>value});
test('active audit keeps exact retained success summary and unresolved source',async()=>{
 const m=model();m.mount();assert.equal(m.requests.length,1);assert.equal(m.requests[0].url,'source-audit.json');
 m.requests[0].resolve(success(report));await flush();
 assert.match(m.host.textContent,/Link access checked 2026-10-23 UTC: 2 distinct URLs, 1 reachable, 1 with unresolved access, 0 returned missing pages/);
 assert.match(m.host.textContent,/example.net.*HTTP 503.*https:\/\/example.net\/unresolved/);assert.equal(m.host.children.length,2);
 m.emit('pagehide',{persisted:true});m.emit('pageshow',{persisted:true});await flush();assert.equal(m.requests.length,1,'A settled success is not retried');
});
test('active503 and asynchronous body refusal retain visible fallback',async()=>{
 for(const body of [false,true]){const m=model();m.mount();m.requests[0].resolve(body?{ok:true,json:async()=>{throw new SyntaxError('controlled body refusal');}}:{ok:false});await flush();assert.equal(m.host.textContent,fallback);}
});
test('synchronous fetch failure remains owned without replacing the original error',async()=>{
 const original=new Error('controlled original fetch creation failure'),m=model({throws:original});
 assert.doesNotThrow(()=>m.mount());await flush();assert.equal(m.host.textContent,fallback);assert.equal(original.message,'controlled original fetch creation failure');
});
test('retired initial audit refuses fetch until persisted return',async()=>{
 const m=model();m.mount({active:false});assert.equal(m.requests.length,0,'No request starts for already departed document');
 m.emit('pageshow',{persisted:false});assert.equal(m.requests.length,0,'Only an actual persisted restoration reactivates this owner');
 m.emit('pageshow',{persisted:true});assert.equal(m.requests.length,1);m.requests[0].resolve(success(report));await flush();assert.match(m.host.textContent,/2 distinct URLs/);
});
test('pagehide aborts an in-flight owned request and stale success cannot render',async()=>{
 const m=model();m.mount();const old=m.requests[0];m.emit('pagehide',{persisted:true});
 assert.equal(old.signal?.aborted,true,'The pending request has an owned aborted signal');old.resolve(success(report));await flush();assert.equal(m.host.textContent,'');
 m.emit('pageshow',{persisted:true});assert.equal(m.requests.length,2);m.requests[1].resolve(success(report));await flush();assert.match(m.host.textContent,/2 distinct URLs/);
});
test('stale body completion and rejection cannot overwrite the restored retry',async()=>{
 for(const rejectOld of [false,true]){const m=model();m.mount();let resolveBody,rejectBody;
  const body=new Promise((resolve,reject)=>{resolveBody=resolve;rejectBody=reject;});
  m.requests[0].resolve({ok:true,json:()=>body});await flush();m.emit('pagehide',{persisted:true});assert.equal(m.requests[0].signal?.aborted,true);
  m.emit('pageshow',{persisted:true});assert.equal(m.requests.length,2);m.requests[1].resolve(success(report));await flush();const current=m.host.textContent;
  if(rejectOld)rejectBody(new Error('controlled retired original body failure'));else resolveBody({...report,results:[]});await flush();assert.equal(m.host.textContent,current);assert.match(current,/2 distinct URLs/);
 }
});
