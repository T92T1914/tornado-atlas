import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {setImmediate as turn} from 'node:timers/promises';
import {boundedMapFailureRecord,reportMapRasterFailure} from './browser/map-raster-diagnostics.mjs';

const prefix='ATLAS_MAP_RASTER_FAILURE ';
const consumerSource=await readFile(new URL('./browser/map-raster-density.test.mjs',import.meta.url),'utf8');
const actualCatch=' let current;\n try{current=await displayed(page,id);}\n catch(error){await reportMapRasterFailure(t,page,{mapId:id,provider},error);throw error;}';
assert.equal(consumerSource.split(actualCatch).length-1,1);
const actualConsumer=Function('displayed','reportMapRasterFailure','t','page','id','provider','return (async()=>{'+actualCatch+'\nreturn current;})();');
function clock(){
 let next=0;const tasks=new Map(),delays=[];
 return {tasks,delays,setTimer(fn,ms){assert.equal(ms,500);delays.push(ms);tasks.set(++next,fn);return next;},
  clearTimer(id){tasks.delete(id);},fire(){const first=tasks.entries().next().value;assert.ok(first,'A bounded timer must exist');tasks.delete(first[0]);first[1]();}};
}
function snapshot(){
 return {ready:'loading',exhibitReady:'true',readyState:'complete',path:'/tornado-atlas/index.html',hash:'#path',scroll:[0,2000],viewport:[320,844],dpr:2,
  path_node:{present:true,rect:{x:0,y:-600,width:320,height:1300}},map:{present:true,client:[300,140],viewBox:'0 0 960 430',class:'explorable-map',display:'block',visibility:'visible'},
  select:{present:true,rect:{x:10,y:-50,width:280,height:40}},selected_mode:'streets',image_count:0,images:[],status:'Loading USGS reference geography',source_text:'Open displayed reference image',source_href:'',source_hidden:true};
}
async function exercise({evaluate=async()=>snapshot(),close=async()=>{},emit=null,provider={exports:[],images:[]},original=Object.freeze(new Error('Original displayed timeout')),timing=clock()}={}){
 let calls=0,closed=0,caught;const logs=[];
 const page={async evaluate(...args){calls++;return evaluate(...args);},context(){return {async close(){closed++;return close();}};}};
 const t={name:'published map caller at CSS320 DPR2 index.html#path',diagnostic(text){if(emit)return emit(text);logs.push(text);}};
 const run=actualConsumer(async()=>{throw original;},(...args)=>reportMapRasterFailure(...args,timing),t,page,'map',provider).catch(error=>{caught=error;});
 return {run,logs,timing,original,get caught(){return caught;},get calls(){return calls;},get closed(){return closed;}};
}
function parsed(log){
 assert.ok(log.startsWith(prefix));assert.ok(Buffer.byteLength(log+'\n','utf8')<=16384);
 return JSON.parse(log.slice(prefix.length));
}

test('actual snapshot callback reads only bounded map state and preserves the original error',async()=>{
 const attrs={viewBox:'0 0 960 430',class:'explorable-map',href:'https://basemap.nationalmap.gov/density-streets-1.svg',style:'visibility: hidden',x:'0',y:'0',width:'640',height:'320'};
 const rect={x:10,y:700,width:300,height:140,top:700,right:310,bottom:840,left:10};
 const make=(id='')=>({id,hidden:false,clientWidth:300,clientHeight:140,parentElement:null,getBoundingClientRect:()=>rect,getAttribute:name=>attrs[name]??null});
 const image=make(),source={...make(),textContent:'Open displayed reference image',hidden:true},host={querySelector:()=>({textContent:'Loading'}),querySelectorAll:()=>[source]};
 const map={...make('map'),querySelectorAll:()=>[image,image,image]},select={...make('map-geography'),value:'streets',closest:()=>host};
 const nodes={map,'map-geography':select,path:make('path'),error:{textContent:''}};
 const document={readyState:'interactive',body:{dataset:{ready:'waiting',exhibitReady:'true'}},getElementById:id=>nodes[id]??null};
 const sandbox={document,location:{pathname:'/tornado-atlas/index.html',hash:'#path',search:'PRIVATE-MUST-NOT-APPEAR'},scrollX:0,scrollY:1200,innerWidth:320,innerHeight:844,devicePixelRatio:2,getComputedStyle:()=>({display:'block',visibility:'hidden'})};
 const h=await exercise({evaluate:async(fn,arg)=>vm.runInNewContext('('+fn.toString()+')(argument)',{...sandbox,argument:arg},{timeout:100})});
 await h.run;assert.equal(h.caught,h.original);assert.equal(h.calls,1);assert.equal(h.closed,0);assert.equal(h.timing.tasks.size,0);
 const record=parsed(h.logs[0]);assert.equal(record.observed.exhibitReady,'true');assert.equal(record.observed.images.length,2);assert.equal(record.observed.images_omitted,1);
 assert.equal(record.observed.map.viewBox,attrs.viewBox);assert.deepEqual(record.observed.viewport,[320,844]);assert.equal(record.original_error.message,h.original.message);
 assert.equal(h.logs[0].includes('PRIVATE-MUST-NOT-APPEAR'),false);assert.equal(h.logs.length,1);
});

test('allowlisted records refuse cycles sparse rows and unrelated data without exceeding the encoded cap',()=>{
 const state=snapshot();state.secret='not allowed';state.self=state;state.map.rect={x:state};
 const exports=new Array(12);exports[0]={url:'https://basemap.nationalmap.gov/export',size:[640,320],bbox:[-98,35,-97,36],status:200,href:'https://basemap.nationalmap.gov/density-1.svg',extent:{xmin:-98,ymin:35,xmax:-97,ymax:36}};
 const cleanup={status:'unconfirmed',error:new Error('Cleanup refused'),secret:'private'};cleanup.self=cleanup;
 const record=JSON.parse(boundedMapFailureRecord({caseName:'failure',mapId:'map',original:Error('Original'),observed:state,provider:{exports,images:['image',null,{},...Array(12).fill('image')]},cleanup}));
 assert.equal(record.observed.map.rect.x,null);assert.equal(record.observed.secret,undefined);assert.equal(record.observed.self,undefined);
 assert.equal(record.provider.exports.count,12);assert.equal(record.provider.exports.rows.length,8);assert.equal(record.provider.exports.omitted,4);
 assert.equal(record.provider.exports.rows[1].invalid,true);assert.deepEqual(record.provider.exports.rows[0].bbox,[-98,35,-97,36]);
 assert.equal(record.provider.images.rows.length,8);assert.equal(record.provider.images.omitted,7);
 assert.equal(record.owned_context_cleanup.error.message,'Cleanup refused');assert.equal(record.owned_context_cleanup.secret,undefined);
});

test('escaped and oversized fields remain within16KiB and preserve full omission counts',()=>{
 for(const text of ['\0'.repeat(10000),'\u4e00'.repeat(10000),'\ud800'.repeat(10000)]){
  const observed=snapshot();for(const key of ['ready','exhibitReady','path','hash','status','source_text','source_href','enhancement_error'])observed[key]=text;
  observed.image_count=20;observed.images=Array.from({length:20},()=>({href:text,style:text,visibility:text,display:text,x:text,y:text,width:text,height:text,rect:{}}));
  const provider={exports:Array.from({length:24},()=>({url:text,href:text,status:200})),images:Array(24).fill(text)};
  const original=new Error(text);const json=boundedMapFailureRecord({caseName:text,mapId:'map',original,observed,provider});
  assert.ok(Buffer.byteLength(prefix+json+'\n','utf8')<=16384);const record=JSON.parse(json);
  assert.equal(record.provider.exports.count,24);assert.equal(record.provider.exports.rows.length+record.provider.exports.omitted,24);
  assert.equal(record.provider.images.rows.length+record.provider.images.omitted,24);assert.equal(original.message,text);
 }
});

test('snapshot rejection cannot replace the identical original Error or add another evaluation',async()=>{
 const diagnostic=new Error('Controlled snapshot rejection'),h=await exercise({evaluate:async()=>{throw diagnostic;}});
 await h.run;assert.equal(h.caught,h.original);assert.equal(h.calls,1);assert.equal(h.closed,0);assert.equal(h.timing.tasks.size,0);
 const record=parsed(h.logs[0]);assert.equal(record.snapshot_failure.message,diagnostic.message);assert.equal(record.observed,null);assert.equal(h.logs.length,1);
});

test('500ms timeout closes only the owned context and handles a late rejected snapshot',async()=>{
 let reject;const stalled=new Promise((_,no)=>{reject=no;}),unhandled=[];const listener=reason=>unhandled.push(reason);process.on('unhandledRejection',listener);
 try{
  const h=await exercise({evaluate:()=>stalled});await turn();assert.deepEqual(h.timing.delays,[500]);h.timing.fire();await h.run;
  assert.equal(h.caught,h.original);assert.equal(h.calls,1);assert.equal(h.closed,1);assert.equal(h.timing.tasks.size,0);
  assert.equal(parsed(h.logs[0]).owned_context_cleanup,'closed');assert.equal(h.logs.length,1);
  reject(new Error('Late rejected native evaluation'));await turn();assert.deepEqual(unhandled,[]);
 }finally{process.off('unhandledRejection',listener);}
});

test('bounded owned-context cleanup failure and timeout keep the original wait failure',async()=>{
 for(const hang of [false,true]){
  const h=await exercise({evaluate:()=>new Promise(()=>{}),close:()=>hang?new Promise(()=>{}):Promise.reject(new Error('Owned close refused'))});
  await turn();h.timing.fire();await turn();if(hang){assert.equal(h.timing.tasks.size,1);h.timing.fire();}
  await h.run;assert.equal(h.caught,h.original);assert.equal(h.calls,1);assert.equal(h.closed,1);assert.equal(h.timing.tasks.size,0);
  assert.equal(parsed(h.logs[0]).owned_context_cleanup.status,'unconfirmed');assert.equal(h.logs.length,1);
 }
});

test('serialization and emission failures never escape or retry the original assertion',async()=>{
 const stringify=JSON.stringify;let h;
 try{JSON.stringify=()=>{throw new Error('Controlled serialization refusal');};h=await exercise();await h.run;}
 finally{JSON.stringify=stringify;}
 assert.equal(h.caught,h.original);assert.equal(h.calls,1);assert.equal(h.logs.length,0);assert.equal(h.timing.tasks.size,0);
 let emitted=0;const e=await exercise({emit:()=>{emitted++;throw new Error('Controlled diagnostic emission refusal');}});await e.run;
 assert.equal(e.caught,e.original);assert.equal(emitted,1);assert.equal(e.calls,1);assert.equal(e.timing.tasks.size,0);
});

test('actual consumer catch changes only failed displayed waits and leaves success untouched',async()=>{
 let reports=0;const wanted={href:'exact controlled source'};
 assert.equal(await actualConsumer(async()=>wanted,async()=>{reports++;},{},{},'map',{}),wanted);assert.equal(reports,0);
 const original=new Error('Identical original wait'),timing=clock();
 await assert.rejects(()=>actualConsumer(async()=>{throw original;},async(...args)=>{reports++;await reportMapRasterFailure(...args,timing);},{name:'case',diagnostic:()=>{}},{evaluate:async()=>snapshot()},'map',{exports:[],images:[]}),error=>error===original);
 assert.equal(reports,1);assert.equal(timing.tasks.size,0);
});
