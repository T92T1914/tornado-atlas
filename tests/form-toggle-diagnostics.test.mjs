import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {observeFirstFormToggle} from './browser/form-toggle-diagnostics.mjs';

// These controlled page callbacks exercise the actual diagnostic finalizer.
// They supply no native input, browser-layout or timing-cause evidence.
async function exercise({original=null,payload={rows:[],omitted:0,final:{}},readError=null,retireError=null,hang=false}={}){
  const logs=[];let retired=0,thrown=null;
  const page={async evaluate(fn,failed){
    if(hang)return new Promise(()=>{});
    const window={__atlasFirstFormToggleObservation:{read(){if(readError)throw readError;return payload;},retire(){retired++;if(retireError)throw retireError;}}};
    return vm.runInNewContext('('+fn.toString()+')(failed)',{window,failed},{timeout:1000});
  }};
  const prior=console.error;console.error=value=>logs.push(String(value));
  try{await observeFirstFormToggle(page).finish(original,'original-native-uncheck');}catch(error){thrown=error;}finally{console.error=prior;}
  for(const row of logs){assert.ok(Buffer.byteLength(row+'\n','utf8')<=8192);assert.ok(row.startsWith('ATLAS_FORM_TOGGLE_FAILURE '));JSON.parse(row.slice('ATLAS_FORM_TOGGLE_FAILURE '.length));}
  return {logs,retired,thrown,record:logs.length?JSON.parse(logs[0].slice('ATLAS_FORM_TOGGLE_FAILURE '.length)):null};
}

test('a successful native action retires its observer without a failure log',async()=>{
  const result=await exercise();assert.equal(result.retired,1);assert.equal(result.thrown,null);assert.deepEqual(result.logs,[]);
});

test('the original action error is not replaced by read or cleanup errors',async()=>{
  for(const key of ['readError','retireError']){
    const original=new Error('Original native checkbox assertion'),diagnostic=new Error('Controlled diagnostic failure');
    const result=await exercise({original,[key]:diagnostic});
    assert.equal(result.thrown,null,'The caller can rethrow its original Error unchanged');assert.equal(result.logs.length,1);assert.equal(result.retired,1);
    assert.equal(result.record.cleanup,'unconfirmed');assert.equal(result.record.original_error.message,original.message);
    assert.equal(original.message,'Original native checkbox assertion');
  }
});

test('a cleanup failure after an otherwise successful action still fails',async()=>{
  const diagnostic=new Error('Controlled retirement refusal'),result=await exercise({retireError:diagnostic});
  assert.equal(result.thrown,diagnostic);assert.equal(result.record.cleanup,'unconfirmed');assert.equal(result.logs.length,1);
});

test('large observation rows are omitted within the actual encoded record cap',async()=>{
  const payload={rows:Array.from({length:12},(_,i)=>({i,label:'\u4e00'.repeat(4000)})),omitted:0,final:{checked:true}};
  const result=await exercise({original:new Error('Native failure'),payload});
  assert.equal(result.thrown,null);assert.equal(result.logs.length,1);assert.ok(result.record.observed===null||result.record.observed.omitted>0);
});

test('escaped controls and multibyte error fields cannot exceed eight KiB or mutate the original Error',async()=>{
  for(const value of ['\0'.repeat(10000),'\u4e00'.repeat(10000),'\ud800'.repeat(10000)]){
    const original=new Error(value);original.name=value;original.stack=value;
    const result=await exercise({original,retireError:new Error(value),payload:{rows:[],omitted:0,final:{value}}});
    assert.equal(result.thrown,null);assert.equal(result.logs.length,1);assert.equal(original.message,value);assert.equal(original.stack,value);assert.equal(original.name,value);
  }
});

test('an unencodable observation cannot replace the original failure',async()=>{
  const payload={rows:[],omitted:0};payload.final=payload;
  const result=await exercise({original:new Error('Original failure'),payload});
  assert.equal(result.thrown,null);assert.equal(result.logs.length,1);assert.equal(result.record.observed,null);
});

test('the bounded diagnostic timeout preserves an existing action error and reports unconfirmed retirement',async()=>{
  const original=new Error('Original native failure'),result=await exercise({original,hang:true});
  assert.equal(result.thrown,null);assert.equal(result.retired,0);assert.equal(result.logs.length,1);assert.equal(result.record.cleanup,'unconfirmed');
  assert.match(result.record.diagnostic_error,/750ms/);assert.equal(result.record.original_error.message,original.message);
});
