import test from 'node:test';
import assert from 'node:assert/strict';
import {formationStudyComparison} from '../web/ground-view-model.mjs';
import {DEFAULT_EXPERIMENTS,readExperiment} from '../web/experiment-state.mjs';
import {formationAt} from '../web/formation-model.mjs';

const origin='https://example.test/tornado-atlas/reconstruction.html?event=el-reno-2013&source=retained#replay-ground-controls';
const read=link=>readExperiment(new URL(link.href).search,'form');

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
