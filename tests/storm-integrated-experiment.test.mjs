import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_EXPERIMENTS,experimentURL,readExperiment,validateExperimentState} from '../web/experiment-state.mjs';
import {funnelVolumeFragment} from '../web/funnel-simulation-model.mjs';
import {formationAt} from '../web/formation-model.mjs';
import {createHash} from 'node:crypto';
const state=(presentation,coverage)=>({...DEFAULT_EXPERIMENTS.form,model:'genesis-v1',sequence:true,coverage,visibility:'ordinary',flow:true,presentation,position:.5,phase:15});
test('integrated cloud experiments preserve complete v8 and earlier v7 identities',()=>{
  for(const [presentation,coverage,version] of [['storm-v3','storm-integrated','form-8'],['storm-v2','storm-detail','form-7']]){
    const wanted=state(presentation,coverage),url=experimentURL('https://atlas.invalid/study.html','form','el-reno-2013',wanted);
    assert.equal(url.searchParams.get('experiment'),version);
    const result=readExperiment(url.search,'form');assert.equal(result.status,'restored');assert.equal(result.event,'el-reno-2013');assert.deepEqual(result.state,wanted);
    for(const position of [0,.2,.8,1]){const point={...wanted,position,phase:position*30};assert.deepEqual(readExperiment(experimentURL(url.href,'form',null,point).search,'form').state,point);}
  }
});
test('v8 links refuse cross-version fields, duplicates and partial restoration',()=>{
  const wanted=state('storm-v3','storm-integrated'),url=experimentURL('https://atlas.invalid/study.html','form',null,wanted);
  for(const [key,value] of [['experiment','form-7'],['presentation','storm-v2'],['coverage','storm-detail'],['phase','14'],['model','kinematic-v1']]){const changed=new URL(url);changed.searchParams.set(key,value);assert.equal(readExperiment(changed.search,'form').status,'invalid',key);}
  const duplicate=new URL(url);duplicate.searchParams.append('presentation','storm-v3');assert.equal(readExperiment(duplicate.search,'form').status,'invalid');
  const partial=new URL(url);partial.searchParams.delete('phase');assert.equal(readExperiment(partial.search,'form').status,'invalid');
  assert.throws(()=>validateExperimentState('form',{...wanted,coverage:'storm-detail'}));
});

// Resolve only the storm version branches of the volume shader, as the
// renderer's define would. Other preprocessor branches are kept as written.
function stormSource(version){
  const out=[],stack=[];
  for(const line of funnelVolumeFragment.split('\n')){
    const directive=line.trim(),storm=directive.match(/^#if STORM_SCENE(?:\s*(>=|==)\s*(\d+))?$/);
    const active=()=>stack.every(frame=>frame.keep);
    if(storm){
      const [,op,n]=storm,keep=op==='>='?version>=Number(n):op==='=='?version===Number(n):version>0;
      stack.push({storm:true,keep:active()&&keep,parent:active(),wanted:keep});continue;
    }
    if(/^#if/.test(directive)){stack.push({storm:false,keep:active(),parent:active()});if(active())out.push(line);continue;}
    if(directive==='#else'){const frame=stack.at(-1);if(frame.storm){frame.keep=frame.parent&&!frame.wanted;continue;}if(frame.parent)out.push(line);continue;}
    if(directive==='#endif'){const frame=stack.pop();if(!frame.storm&&frame.parent)out.push(line);continue;}
    if(active())out.push(line);
  }
  assert.equal(stack.length,0);
  return out.join('\n');
}
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const part=(source,start)=>{const from=source.indexOf(start);assert.notEqual(from,-1,start);return source.slice(from,source.indexOf('\n}\n',from)+2);};
const number=(source,pattern)=>{const match=source.match(pattern);assert.ok(match,String(pattern));return match.slice(1).map(Number);};

test('earlier presentations compile from the same shader text as before storm-v3',()=>{
  // Taken from main before storm-v3 was added, for the legacy, storm-v1 and
  // storm-v2 resolutions of the complete volume fragment.
  const before={0:'8c16c05277e353e2bc6a9488030f63c05a82fc8f0ccb7a0718c7428b196f4b9b',
    1:'f6ce631ecc4a7bb0e313d7b576d9732f52092aad6c2cdc467de01f72bd5d41ae',2:'3bd688c86e9a04f71b0a7f547e9712c1f05c859299972b381dc8b53ddbef2515'};
  for(const [version,digest] of Object.entries(before))assert.equal(createHash('sha256').update(stormSource(Number(version))).digest('hex'),digest,'version '+version);
});

test('storm-v2 keeps its level funnel top and separate cloud base',()=>{
  const v2=stormSource(2),body=part(v2,'float stormBody(');
  assert.doesNotMatch(v2,/stormJoinDistance/);
  assert.match(body,/if\(ex<=0\.0\|\|h<0\.0\|\|h>1\.04\)return 0\.0;/);
  assert.match(body,/float ends=smoothstep\(1\.0-ex-\.02,1\.0-ex\+\.045,h\)\*\(1\.0-smoothstep\(\.96,1\.04,h\)\);\n(?!\s*ends=)/);
  assert.match(v2,/radius=3\.3;\n/);assert.match(v2,/vec3\(radius,2\.71,radius\)\);/);assert.doesNotMatch(v2,/vec3\(radius,3\.2,radius\)/);
});

test('storm-v3 widens the funnel into a lowered base and samples the whole flared top',()=>{
  const v3=stormSource(3),body=part(v3,'float stormBody('),height=part(v3,'float stormCloudHeight(');
  const [lowered]=number(height,/float lowered=([\d.]+)\+\.10\*\(broad-\.5\)\+\.06\*\(folded-\.5\);/);
  const [inner,outer]=number(height,/return mix\(min\(lowered,base\),base,smoothstep\(([\d.]+),([\d.]+),stormJoin\)\);/);
  const [cutoff]=number(body,/if\(ex<=0\.0\|\|h<0\.0\|\|h>([\d.]+)\)return 0\.0;/);
  const [flare,flareStart,flareEnd]=number(body,/radius\*=1\.0\+([\d.]+)\*smoothstep\(([\d.]+),([\d.]+),h\);/);
  const [fadeStart,fadeEnd]=number(body,/\n\s*ends=smoothstep\(1\.0-ex-\.02,1\.0-ex\+\.045,h\)\*\(1\.0-smoothstep\(([\d.]+),([\d.]+),h\)\);/);
  const [box,top]=number(v3,/radius=([\d.]+);\n\s*vec2 bodyRange=intersectBox\(origin,ray,length\(segment\),vec3\(-radius,0\.0,-radius\),vec3\(radius,([\d.]+),radius\)\);/);
  assert.match(part(v3,'float stormCloud('),/cover=mix\(max\(cover,\.92\+\.20\*\(detail-\.5\)\),cover,smoothstep\(1\.3,2\.6,stormJoin\)\);/);
  assert.match(part(v3,'float stormCloud('),/stormJoin=stormJoinDistance\(p\.xz\);/);
  // The lowered base, even at its highest noise, lies below the start of the
  // top fade, so the funnel ends inside cloud rather than in clear air.
  assert.ok(lowered+.05+.03<2.6*fadeStart);
  assert.ok(inner<1&&outer>1);assert.equal(fadeEnd,cutoff);assert.ok(top>=2.6*cutoff);
  // Every point of the flared body with any density stays inside the body box.
  // The envelope ends at 1.16 of the radius and the largest lobe is 1.2. The
  // radius, section and axis below are read from the shader as written, so a
  // change to any of them fails here first. The bound uses the schedule's own
  // shapes, which never pair the largest base with the largest bend.
  const field=part(v3,'vec2 referenceAxis(')+part(v3,'vec2 referenceSection(')+part(v3,'float referenceRadius(');
  for(const piece of ['return vec2(.09*h+.11*h*(1.0-h)*sin(.21*t)+.55*s.z*h*h,','-.10*h+.13*h*(1.0-h)*cos(.17*t));',
    'return vec2(1.10+.06*sin(2.0*h-.13*t),.88+.05*cos(2.7*h+.11*t));','return .62+.95*s.x+.24*smoothstep(.05,.95,h)+.10*h;'])
    assert.ok(field.includes(piece),piece);
  for(const piece of ['radius=referenceRadius(h,shape)*(.82+.42*h*h);','float lobe=1.0+.14*sin(2.0*theta+.9*h)+.12*(bulk-.5);',
    'edge=mix(.14,.055,smoothstep(.25,.72,bulk));','float envelope=1.0-smoothstep(.94-edge,1.02+edge,relative);'])
    assert.ok(body.includes(piece),piece);
  let widest=0;
  for(let seconds=0;seconds<=30;seconds+=.25){
    const shape=formationAt(seconds).shape;
    for(let h=0;h<cutoff;h+=.005){
      if(1-smooth(fadeStart,fadeEnd,h)<=0)continue;
      const radius=(.62+.95*shape.base+.24*smooth(.05,.95,h)+.10*h)*(.82+.42*h*h)*(1+flare*smooth(flareStart,flareEnd,h));
      const support=radius*1.16*1.2,axis=[.09*h+.11*h*Math.abs(1-h)+.55*Math.abs(shape.bend)*h*h,.10*h+.13*h*Math.abs(1-h)];
      widest=Math.max(widest,axis[0]+support*1.16,axis[1]+support*.93);
    }
  }
  assert.ok(widest<=box,`flared top reaches ${widest.toFixed(3)} beyond the ${box} box`);
});
