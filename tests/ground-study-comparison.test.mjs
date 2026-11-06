import test from 'node:test';
import assert from 'node:assert/strict';
import {formationStudyComparison} from '../web/ground-view-model.mjs';
import {DEFAULT_EXPERIMENTS,readExperiment} from '../web/experiment-state.mjs';
import {formationAt} from '../web/formation-model.mjs';
import {mountGroundStudyReturn} from '../web/ground-view.mjs';
import {exactPlayingComparisonSeconds} from './browser/ground-view-assertions.mjs';

const origin='https://example.test/tornado-atlas/reconstruction.html?event=el-reno-2013&source=retained#replay-ground-controls';
const read=link=>readExperiment(new URL(link.href).search,'form');

function playingRecord(seconds,visible=String(seconds)){
  const sourceHref='https://example.test/tornado-atlas/reconstruction.html?event=el-reno-2013&appearance_view=formation&t='+String(seconds);
  return {nativeType:'range',nativeStep:'any',rawBefore:visible,rawAfter:visible,requested:Number(visible),after:Number(visible),
    sourceHref,sourceHrefAfter:sourceHref,url:sourceHref,serializedSource:visible};
}

test('the playing oracle retains the literal CI clock double across native decimal serialization',()=>{
  const exact=130.01399999999998,record=playingRecord(exact,'130.014');
  assert.notEqual(record.requested,exact);assert.equal(exactPlayingComparisonSeconds(record),exact);
  assert.equal(exactPlayingComparisonSeconds(playingRecord(130.011)),130.011);
});

test('one adjacent clock value cannot borrow an unchanged native range display',()=>{
  const record=playingRecord(130.01399999999998,'130.014'),advanced=130.014;
  assert.equal(advanced-record.requested,0);assert.notEqual(advanced,130.01399999999998);
  assert.equal(advanced-130.01399999999998,2**-45,'These are adjacent binary64 values in the 128 to 256 interval');
  const next=new URL(record.url);next.searchParams.set('t',advanced);
  assert.throws(()=>exactPlayingComparisonSeconds({...record,url:next.href}));
  assert.throws(()=>exactPlayingComparisonSeconds({...record,url:next.href,sourceHrefAfter:next.href}));
});

test('the strict playing oracle refuses changed display or inconsistent native serialization',()=>{
  const record=playingRecord(130.01399999999998,'130.014');
  for(const patch of [{rawAfter:'130.015'},{after:130.015},{serializedSource:'130.01399999999998'},{nativeType:'number'},{nativeStep:'1'}]){
    assert.throws(()=>exactPlayingComparisonSeconds({...record,...patch}));
  }
});

test('an invalid or ambiguous exact snapshot cannot become a playing comparison',()=>{
  for(const query of ['','t=','t=NaN','t=Infinity','t=119','t=141','t=130&t=131']){
    const record=playingRecord(130),href='https://example.test/reconstruction.html?'+query;
    assert.throws(()=>exactPlayingComparisonSeconds({...record,sourceHref:href,sourceHrefAfter:href,url:href}));
  }
});

test('literal comparison instants preserve the declared mapping and complete Form defaults',()=>{
  for(const [player,phase,position] of [[120,0,0],[124,6,.2],[130,15,.5],[136,24,.8],[140,30,1]]){
    const link=formationStudyComparison(origin,player,'synthetic-front','storm-v2'),parsed=read(link);
    assert.equal(parsed.status,'restored');assert.equal(parsed.event,'el-reno-2013');
    assert.equal(new URL(link.href).pathname,'/tornado-atlas/study.html');assert.equal(new URL(link.href).hash,'#form-experiment');
    assert.equal(new URL(link.href).searchParams.get('experiment'),'form-7');
    assert.equal(new URL(link.href).searchParams.has('source'),false);
    assert.equal(link.playerSeconds,player);assert.equal(link.requestedPhase,phase);assert.equal(link.openedPhase,phase);assert.equal(link.rounding,0);
    assert.deepEqual(parsed.state,{...DEFAULT_EXPERIMENTS.form,model:'genesis-v1',sequence:true,coverage:'storm-detail',position,phase,visibility:'ordinary',flow:true,presentation:'storm-v2'});
  }
});

test('an off-grid Replay phase is disclosed and serialized at the nearest supported study step',()=>{
  const link=formationStudyComparison(origin,130.011,'synthetic-oblique','storm-v2'),parsed=read(link);
  assert.equal(parsed.status,'restored');assert.equal(parsed.state.position,.501);assert.equal(parsed.state.phase,.501*30);
  assert.ok(Math.abs(link.requestedPhase-15.0165)<1e-10);assert.equal(link.openedPhase,parsed.state.phase);
  assert.ok(Math.abs(link.rounding)<=.015+1e-10);assert.notEqual(link.requestedPhase,link.openedPhase);
  for(let i=0;i<=4000;i++){
    const sample=formationStudyComparison(origin,120+i/200,'synthetic-front','legacy');
    assert.equal(read(sample).status,'restored');assert.ok(Math.abs(sample.rounding)<=.015+1e-10);
  }
});

test('each accepted presentation keeps its existing experiment version without admitting held storm-v3',()=>{
  for(const [style,version,coverage] of [['legacy','form-3','formation'],['world-v1','form-4','formation'],['reference-v1','form-5','reference'],['storm-v1','form-6','storm'],['storm-v2','form-7','storm-detail']]){
    const link=formationStudyComparison(origin,130,'synthetic-oblique',style),parsed=read(link),url=new URL(link.href);
    assert.equal(parsed.status,'restored');assert.equal(url.searchParams.get('experiment'),version);assert.equal(parsed.state.coverage,coverage);
    if(style==='world-v1')assert.equal(parsed.state.lighting,style);
    else if(style!=='legacy')assert.equal(parsed.state.presentation,style);
    else assert.equal('presentation' in parsed.state||'lighting' in parsed.state,false);
  }
  for(const style of ['storm-v3','unknown',null,'',{},'world-v1&presentation=storm-v2'])assert.equal(formationStudyComparison(origin,130,'synthetic-front',style),null);
});

test('missing cameras and unsupported intervals cannot manufacture a comparison',()=>{
  for(const time of [119.999,140.001,0,NaN,Infinity,-Infinity,'130',null,undefined])assert.equal(formationStudyComparison(origin,time,'synthetic-front','storm-v2'),null);
  for(const camera of ['',null,undefined,'unavailable-camera','synthetic-front&other=1'])assert.equal(formationStudyComparison(origin,130,camera,'storm-v2'),null);
});

test('the existing visibility comparison changes condensation alone at the transferred phase',()=>{
  const state=read(formationStudyComparison(origin,128.123,'synthetic-front','storm-v2')).state;
  const ordinary=formationAt(state.phase),limited=formationAt(state.phase,{visibility:'limited'});
  assert.equal(limited.condensation,ordinary.condensation*.22);
  for(const key of ['seconds','progress','circulation','dust','erosion','extent','stage'])assert.equal(limited[key],ordinary[key]);
  assert.deepEqual(limited.shape,ordinary.shape);
});

// Controlled lifecycle policy only, separate from native Back/focus evidence.
function focusFixture({type='navigate',state=null,shown=true,mounted=true}={}){
  const events=new Map(),microtasks=[],frames=new Map(),focus=[],writes=[];let next=0;
  const node={isConnected:true,hidden:false,hasAttribute:()=>true,closest:()=>node.hidden?{}:null,focus:options=>focus.push(options)};
  const doc={readyState:shown?'complete':'loading',getElementById:id=>mounted&&id==='ground-study-link'?node:null};
  const win={performance:{getEntriesByType:()=>[{type}]},location:{href:origin},
    history:{state,replaceState(value,_title,href){this.state=value;writes.push(value);assert.equal(href,win.location.href);}},
    queueMicrotask:fn=>microtasks.push(fn),requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),
    addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
  const fixture={doc,win,node,focus,writes,microtasks,frames,mount:()=>{mounted=true;},emit:(name,value={})=>{for(const fn of events.get(name)??[])fn(value);},flushMicro:()=>{while(microtasks.length)microtasks.shift()();},flushFrames:()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();}};
  fixture.owner=mountGroundStudyReturn(doc,win);return fixture;
}
const ordinary=()=>({button:0,defaultPrevented:false,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false});
const intent=()=>({atlasGroundStudyReturn:{version:1,href:origin,wasNull:false},unrelated:'retained'});

test('ordinary departure finalizes in Window bubble and preserves unrelated native history state',()=>{
  const f=focusFixture({state:{unrelated:'retained'}}),click=ordinary();f.owner.arm(click);assert.equal(f.writes.length,0);f.flushMicro();assert.equal(f.writes.length,0);f.emit('click',click);
  assert.equal(f.win.history.state.unrelated,'retained');assert.equal(f.win.history.state.atlasGroundStudyReturn.href,origin);
  f.owner.restore();f.flushFrames();assert.equal(f.focus.length,0,'Departure does not focus its own origin');
  for(const field of ['ctrlKey','metaKey','shiftKey','altKey']){
    const modified=focusFixture(),event={...ordinary(),[field]:true};modified.owner.arm(event);modified.emit('click',event);assert.equal(modified.writes.length,0);
  }
  const cancelled=focusFixture(),event=ordinary();cancelled.owner.arm(event);cancelled.flushMicro();event.defaultPrevented=true;cancelled.emit('click',event);assert.equal(cancelled.writes.length,0);
  for(const button of [1,2]){const auxiliary=focusFixture(),event={...ordinary(),button};auxiliary.owner.arm(event);auxiliary.emit('click',event);assert.equal(auxiliary.writes.length,0);}
});

test('fresh history return waits for the page and valid mounted link, consumes once and preserves scroll',()=>{
  const f=focusFixture({type:'back_forward',state:intent(),shown:false,mounted:false});
  f.owner.restore();assert.equal(f.frames.size,0);f.emit('pageshow',{persisted:false,isTrusted:true});assert.equal(f.frames.size,0);
  f.mount();f.owner.restore();f.owner.restore();assert.equal(f.frames.size,1);assert.deepEqual(f.win.history.state,{unrelated:'retained'});
  f.flushFrames();assert.deepEqual(f.focus,[{preventScroll:true}]);f.owner.restore();f.flushFrames();assert.equal(f.focus.length,1);
});

test('cached history return restores only after real pageshow and retires a pending focus frame',()=>{
  const f=focusFixture(),event=ordinary();f.owner.arm(event);f.emit('click',event);f.emit('pagehide');f.emit('pageshow',{persisted:true,isTrusted:true});
  assert.equal(f.frames.size,1);assert.equal(f.win.history.state,null);f.flushFrames();assert.equal(f.focus.length,1);
  const leaving=focusFixture({type:'back_forward',state:intent()});leaving.owner.restore();leaving.emit('pagehide');leaving.flushFrames();assert.equal(leaving.focus.length,0);
});

test('initial loads, reloads and newer deliberate input cannot steal focus',()=>{
  for(const type of ['navigate','reload']){const f=focusFixture({type,state:intent()});f.emit('pageshow',{persisted:false,isTrusted:true});f.owner.restore();f.flushFrames();assert.equal(f.focus.length,0);assert.deepEqual(f.win.history.state,{unrelated:'retained'});}
  for(const name of ['pointerdown','keydown']){
    const f=focusFixture({type:'back_forward',state:intent()});f.owner.restore();f.emit(name,{isTrusted:true});f.flushFrames();assert.equal(f.focus.length,0);assert.deepEqual(f.win.history.state,{unrelated:'retained'});
    const synthetic=focusFixture({type:'back_forward',state:intent()});synthetic.owner.restore();synthetic.emit(name,{isTrusted:false});synthetic.flushFrames();assert.equal(synthetic.focus.length,1);
  }
  const syntheticShow=focusFixture({type:'back_forward',state:intent(),shown:false});syntheticShow.emit('pageshow',{persisted:true,isTrusted:false});syntheticShow.flushFrames();assert.equal(syntheticShow.focus.length,0);
});

test('stale URLs, unavailable links and detached targets never receive return focus',()=>{
  const stale=focusFixture({type:'back_forward',state:intent()});stale.win.location.href=origin+'&t=145';stale.owner.restore();stale.flushFrames();assert.equal(stale.focus.length,0);
  const hidden=focusFixture({type:'back_forward',state:intent()});hidden.node.hidden=true;hidden.owner.restore();assert.equal(hidden.frames.size,0);
  const detached=focusFixture({type:'back_forward',state:intent()});detached.owner.restore();detached.node.isConnected=false;detached.flushFrames();assert.equal(detached.focus.length,0);
  const moved=focusFixture({type:'back_forward',state:intent()});moved.owner.restore();moved.win.location.href=origin+'&t=145';moved.flushFrames();assert.equal(moved.focus.length,0);
});
