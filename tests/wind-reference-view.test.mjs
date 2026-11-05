import test from 'node:test';
import assert from 'node:assert/strict';
import {samplePassage} from '../web/wind-model.mjs';
import {componentHistory} from '../web/component-model.mjs';
import {comparePassageGrids,attachContinuousReference} from '../web/wind-reference-view.mjs';
const field={peak:105*.44704,radius:500*.3048,background:0,travel:30*.44704,offset:.7,area:1,coefficient:1.2};
const maximum=.5*1.225*(105*.44704)**2*1.2;
function input(changes={},capacity=1600,maximumDrag=maximum){
  const current={...field,...changes},threshold=100*.44704,result=samplePassage(current,{threshold});
  return {field:current,result,component:componentHistory(result.samples,{...current,capacity}),threshold,capacity,maximumDrag};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-8,actual+' versus '+expected);
test('two grids expose the independent off-grid capacity witness without mutating the primary sequence',()=>{
  const args=input(),before=JSON.stringify(args),actual=comparePassageGrids(args);
  // The coarse nearest exterior point is0.725R; the finer interior point is0.7125R.
  const coarse=maximum/(.725**2+.7**2),fine=maximum*(.7125**2+.7**2);
  near(maximum,1619.4170450304002);near(actual.coarse.peakDrag,coarse);near(actual.fine.peakDrag,fine);
  assert.equal(actual.coarse.count,481);assert.equal(actual.fine.count,961);
  near(actual.coarse.spacing,12*500*.3048/(30*.44704)/480);
  assert.equal(actual.fine.spacing,actual.coarse.spacing/2);
  assert.equal(actual.coarse.capacityExceeded,false);assert.equal(actual.fine.capacityExceeded,true);
  near(actual.coarse.shortfall,maximum-coarse);near(actual.fine.shortfall,maximum-fine);
  assert.equal(JSON.stringify(args),before);assert.equal(args.component.firstFailureIndex,null);
});
test('coarse instants are the even fine instants for unchanged finite assumptions',()=>{
  for(const offset of [-.7,.7,0,1.1]){
    const settings={...field,offset,background:20*.44704},coarse=samplePassage(settings),fine=samplePassage(settings,{steps:960});
    for(let i=0;i<481;i++)assert.deepEqual(coarse.samples[i],fine.samples[2*i]);
  }
});
test('strict equality and rounded labels do not decide either grid outcome',()=>{
  const changes={peak:0,background:3,density:2,coefficient:1,area:1};
  const equal=comparePassageGrids(input(changes,9,9));
  assert.equal(equal.coarse.peakDrag,9);assert.equal(equal.fine.peakDrag,9);
  assert.equal(equal.coarse.capacityExceeded,false);assert.equal(equal.fine.capacityExceeded,false);
  const below=comparePassageGrids(input(changes,9-2**-40,9));
  assert.equal(below.coarse.peakDrag.toFixed(3),equal.coarse.peakDrag.toFixed(3));
  assert.equal(below.coarse.capacityExceeded,true);assert.equal(below.fine.capacityExceeded,true);
  const zero=comparePassageGrids(input({...changes,coefficient:0},1,0));
  for(const grid of [zero.coarse,zero.fine]){assert.equal(grid.peakDrag,0);assert.equal(grid.capacityExceeded,false);assert.equal(grid.shortfall,0);}
});
test('positive background preserves independent opposite-side maxima and capacity outcomes',()=>{
  const V=100*.44704,B=20*.44704,K=.5*1.225*1.2;
  for(const [offset,continuous,exceeded]of [[-.7,1938.8938770432,true],[.7,1116.3328382976,false]]){
    const actual=comparePassageGrids(input({peak:V,background:B,offset},1600,continuous));
    for(const [steps,grid]of [[480,actual.coarse],[960,actual.fine]]){
      let expected=0;
      for(let i=0;i<=steps;i++){
        const s=(i/steps*2-1)*6,q=s*s+offset*offset;
        const speed2=q<=1?(B-V*offset)**2+V*V*s*s:B*B+(V*V-2*B*V*offset)/q;
        expected=Math.max(expected,K*speed2);
      }
      near(grid.peakDrag,expected);assert.equal(grid.capacityExceeded,exceeded);
      assert.ok(grid.peakDrag<=continuous+1e-8);
    }
  }
});
test('unrepresentable or mismatched grid inputs are refused',()=>{
  for(const change of [
    args=>({...args,capacity:0}),args=>({...args,maximumDrag:Infinity}),
    args=>({...args,threshold:NaN}),args=>({...args,field:{...args.field,density:0}}),
    args=>({...args,result:{...args.result,halfTime:Infinity}}),
    args=>({...args,result:{...args.result,samples:args.result.samples.slice(1)}}),
    args=>({...args,component:{...args.component,peak:Infinity}}),
    args=>({...args,component:{...args.component,states:args.component.states.map((s,i)=>i===2?{...s,force:Infinity}:s)}}),
    args=>({...args,component:{...args.component,states:args.component.states.map((s,i)=>i===2?{...s,time:s.time+1}:s)}}),
  ])assert.throws(()=>comparePassageGrids(change(input())),RangeError);
});
function documentFixture(){
  const nodes=new Map();return {getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:true,dataset:{}});return nodes.get(id);}};
}
test('view clears stale grid and continuous values and can recover',()=>{
  const doc=documentFixture(),view=attachContinuousReference(doc),args=input();view.update(args);
  assert.equal(doc.getElementById('grid-481-peak').textContent,'1594.503');
  assert.equal(doc.getElementById('grid-961-peak').textContent,'1615.622');
  const malformed={...args,component:{...args.component,peak:Infinity}};
  // Same physical key still revalidates the supplied primary grid.
  view.update(malformed);assert.equal(doc.getElementById('wind-grid-values').hidden,true);
  for(const count of [481,961])for(const key of ['spacing','peak','exceeded','shortfall'])assert.equal(doc.getElementById('grid-'+count+'-'+key).textContent,'');
  assert.notEqual(doc.getElementById('reference-maximum-drag').textContent,'');
  view.update(args);assert.equal(doc.getElementById('wind-grid-values').hidden,false);
  view.update({...args,field:{...field,peak:1e308}});
  assert.equal(doc.getElementById('wind-reference-values').hidden,true);
  assert.equal(doc.getElementById('wind-grid-values').hidden,true);
  for(const key of ['maximum-wind','maximum-drag','comparison-duration','capacity-duration'])assert.equal(doc.getElementById('reference-'+key).textContent,'');
  for(const count of [481,961])for(const key of ['spacing','peak','exceeded','shortfall'])assert.equal(doc.getElementById('grid-'+count+'-'+key).textContent,'');
  view.update(args);assert.equal(doc.getElementById('grid-481-exceeded').textContent,'No');assert.equal(doc.getElementById('grid-961-exceeded').textContent,'Yes');
});

test('malformed primary helper readings clear previous values and preserve the original error',()=>{
  const known=new Error('controlled primary reading getter failure');
  for(const [index,make]of [
    args=>({...args,result:{...args.result,aboveSeconds:undefined}}),
    args=>({...args,component:null}),
    args=>({...args,result:{...args.result,get aboveSeconds(){throw known;}}}),
  ].entries()){
    const doc=documentFixture(),view=attachContinuousReference(doc),args=input();view.update(args);
    assert.equal(doc.getElementById('grid-961-peak').textContent,'1615.622');
    const malformed=make(args);
    assert.throws(()=>view.update(malformed),error=>index===2?error===known:error instanceof TypeError);
    assert.equal(doc.getElementById('wind-reference-values').hidden,true);
    assert.equal(doc.getElementById('wind-grid-values').hidden,true);
    assert.equal(doc.getElementById('wind-reference-status').dataset.state,'unavailable');
    for(const key of ['maximum-wind','maximum-drag','comparison-duration','capacity-duration'])assert.equal(doc.getElementById('reference-'+key).textContent,'');
    for(const count of [481,961])for(const key of ['spacing','peak','exceeded','shortfall'])assert.equal(doc.getElementById('grid-'+count+'-'+key).textContent,'');
    view.update(args);assert.equal(doc.getElementById('wind-reference-values').hidden,false);
    assert.equal(doc.getElementById('grid-481-exceeded').textContent,'No');assert.equal(doc.getElementById('grid-961-exceeded').textContent,'Yes');
  }
});
