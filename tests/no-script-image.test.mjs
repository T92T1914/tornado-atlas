import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoScriptImage,noScriptImage} from './browser/no-script-image.mjs';

const expected={source:'http://127.0.0.1:8123/assets/joplin-2011/damage.jpg',width:1024,height:768};
const loaded={...expected,connected:true,complete:true,visible:true,opaque:true,colors:40};

test('no-script photograph acceptance requires exact source, dimensions and usable visible pixels',()=>{
  assertNoScriptImage(loaded,expected);
  for(const [key,value,message] of [
    ['connected',false,/remain connected/],['source','http://other.test/damage.jpg',/full photograph source/],
    ['complete',false,/request must be complete/],['width',0,/natural photograph width/],
    ['width',1023,/natural photograph width/],['height',767,/natural photograph height/],
    ['visible',false,/visible viewport region/],['opaque',false,/opaque sampled pixels/],
    ['colors',1,/nonblank photograph bitmap/],['colors',0,/nonblank photograph bitmap/],
  ]) assert.throws(()=>assertNoScriptImage({...loaded,[key]:value},expected),message);
});

test('a stalled evaluation expires and a late snapshot cannot start a capture',{timeout:1000},async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let finishEvaluation,captures=0;
  const image={evaluate:()=>new Promise(resolve=>{finishEvaluation=resolve;}),
    screenshot:()=>{captures++;return Promise.resolve();}};
  const pending=noScriptImage(image,expected,'disposable.png');
  const rejected=assert.rejects(pending,/exceeded its 10000ms bound/);
  t.mock.timers.tick(10001);await rejected;
  finishEvaluation(loaded);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(captures,0,'Expired work must not start a late capture');
});

test('a stalled optional capture consumes the same finite allowance',{timeout:1000},async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let captureOptions;
  const image={evaluate:()=>Promise.resolve(loaded),
    screenshot:options=>{captureOptions=options;return new Promise(()=>{});}};
  const pending=noScriptImage(image,expected,'disposable.png');
  const rejected=assert.rejects(pending,/exceeded its 10000ms bound/);
  await Promise.resolve();
  assert.ok(captureOptions.timeout>0 && captureOptions.timeout<=10000);
  t.mock.timers.tick(10001);await rejected;
});

test('loaded photograph dimensions wait for usable pixels before acceptance',async()=>{
  let evaluations=0;
  const image={evaluate:()=>Promise.resolve(++evaluations===1?
    {...loaded,opaque:false,colors:1}:loaded)};
  assert.deepEqual(await noScriptImage(image,expected),loaded);
  assert.equal(evaluations,2);
});

test('a bitmap that stays blank cannot pass or start a capture',{timeout:1000},async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let captures=0;
  const image={evaluate:()=>Promise.resolve({...loaded,opaque:false,colors:1}),
    screenshot:()=>{captures++;return Promise.resolve();}};
  const pending=noScriptImage(image,expected,'disposable.png');
  const rejected=assert.rejects(pending,/exceeded its 10000ms bound/);
  await Promise.resolve();
  t.mock.timers.tick(10001);await rejected;
  assert.equal(captures,0);
});
