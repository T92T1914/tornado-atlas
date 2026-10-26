import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSourceCamera,projectSourcePoint,sourceFrame,sourceCameraProjection,sourceBackingSize} from '../web/source-camera-model.mjs';
import {GROUND_CAMERAS,groundViewAt} from '../web/ground-view-model.mjs';
import {PlaybackClock} from '../web/playback-model.mjs';

const known=()=>({...structuredClone(GROUND_CAMERAS[0].camera),position:[0,0,10],target:[0,0,0],
  image:{width:800,height:600},intrinsics:{fx:800,fy:600,cx:300,cy:200}});
const close=(actual,expected,tolerance=1e-3)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const independent=JSON.parse(await readFile(new URL('./fixtures/source-camera-controls.json',import.meta.url),'utf8'));
test('independently authored point and contain tables constrain all five camera orientations',()=>{
  for(const row of independent.points){
    const camera=independent.cameras[row.camera],actual=projectSourcePoint(row.point,camera);
    if(row.expected===null){assert.equal(actual,null);continue;}
    for(const name of ['x','y','depth'])close(actual[name],row.expected[name],1e-8);
    const {matrix:m}=sourceCameraProjection(camera,camera.image.width,camera.image.height),p=[...row.point,1];
    const clip=[0,1,2,3].map(r=>p.reduce((sum,v,c)=>sum+m[c*4+r]*v,0));
    close((clip[0]/clip[3]+1)*camera.image.width/2,row.expected.x,.01);
    close((1-clip[1]/clip[3])*camera.image.height/2,row.expected.y,.01);
  }
  for(const row of independent.contain)assert.deepEqual(sourceFrame(independent.cameras[row.camera],...row.viewport),row.frame);
});
// Independently computed using similar triangles, not a production projection.
const controls=[[[0,0,0],[300,200,10]],[[1,0,0],[380,200,10]],[[0,1,0],[300,140,10]],
  [[1,1,1],[300+800/9,200-600/9,9]],[[-2,-1,0],[140,260,10]]];
test('known pinhole axes, depth, principal point and unequal focal lengths',()=>{
  for(const [point,expected] of controls){const p=projectSourcePoint(point,known());close(p.x,expected[0]);close(p.y,expected[1]);close(p.depth,expected[2]);}
});
test('the actual graphics matrix independently reproduces the same known image coordinates',()=>{
  const camera=known(),{matrix:m}=sourceCameraProjection(camera,800,600);
  for(const [p,expected] of controls){
    const h=[...p,1],clip=[0,1,2,3].map(row=>h.reduce((sum,v,col)=>sum+m[col*4+row]*v,0));
    close((clip[0]/clip[3]+1)*400,expected[0]);close((1-clip[1]/clip[3])*300,expected[1]);
  }
});
test('azimuth and roll signs are constrained by independent axis controls',()=>{
  const camera=known();camera.position=[10,0,0];
  close(projectSourcePoint([0,0,1],camera).x,220);close(projectSourcePoint([0,1,0],camera).y,140);
  camera.position=[0,0,10];camera.up=[1,0,0];
  close(projectSourcePoint([1,0,0],camera).y,140);close(projectSourcePoint([0,1,0],camera).x,220);
});
test('near, far and behind-camera points are not projected into the image',()=>{
  const camera=known();
  for(const point of [[0,0,11],[0,0,9.95],[0,0,-51]])assert.equal(projectSourcePoint(point,camera),null);
  const {matrix:m}=sourceCameraProjection(camera,800,600);
  for(const [z,expected]of [[9.9,-1],[-50,1]])close((m[10]*z+m[14])/(m[11]*z+m[15]),expected);
});
test('source frame contains the complete image through wide and tall viewports',()=>{
  assert.deepEqual(sourceFrame(known(),1600,600),{left:400,top:0,width:800,height:600,scale:1});
  assert.deepEqual(sourceFrame(known(),800,1200),{left:0,top:300,width:800,height:600,scale:1});
  const source=GROUND_CAMERAS[0].camera;
  assert.deepEqual(sourceBackingSize(1280,720,2),{width:2048,height:1152});
  const fit=sourceFrame(source,2048,1152);assert.equal(fit.left,0);assert.equal(fit.top,0);
  assert.deepEqual(sourceBackingSize(320,430,2),{width:640,height:860});
  const raster=sourceCameraProjection(known(),1600,600);
  assert.deepEqual(raster.viewport,{x:400,y:0,width:800,height:600});
  assert.equal(raster.pointScale,800);assert.deepEqual(raster.spriteAspect,[1,.75]);
});
for(const [name,change]of [
  ['unknown units',c=>c.units='metres'],['unknown optics',c=>c.provenance.intrinsics='unknown'],
  ['distortion',c=>c.distortion.model='brown-conrady'],['ignored coefficient',c=>c.distortion.k1=.1],
  ['parallel up',c=>c.up=[0,0,1]],['coincident eye',c=>c.target=[0,0,10]],
  ['zero focal length',c=>c.intrinsics.fx=0],['NaN lens',c=>c.intrinsics.fy=NaN],
  ['boolean lens',c=>c.intrinsics.cx=true],['invalid frame',c=>c.image.width=0],
  ['reversed clip',c=>c.clip.far=.01],['unassigned position',c=>c.position=null],
  ['undeclared field',c=>c.bearing=90],['missing field',c=>delete c.origin]
])test('invalid camera refuses '+name,()=>{const camera=known();change(camera);assert.throws(()=>validateSourceCamera(camera));});
test('invalid viewport and raster inputs refuse without defaulting',()=>{
  for(const args of [[0,600,1],[800,0,1],[800,600,NaN],[Infinity,600,1]])assert.throws(()=>sourceBackingSize(...args));
  assert.throws(()=>sourceFrame(known(),NaN,600));
});
test('synthetic evolution is a pure shared-time function with explicit gaps and exact reference instants',()=>{
  const first=groundViewAt(120,'synthetic-front'),middle=groundViewAt(130,'synthetic-front'),last=groundViewAt(140,'synthetic-front');
  assert.deepEqual(first.shape,{base:.18,flare:.62,bend:0});close(last.shape.base,.83);
  assert.equal(middle.reference,'assets/ground-view-demo/synthetic-front-130.svg');
  assert.equal(groundViewAt(130.01,'synthetic-front').reference,null);
  assert.deepEqual(groundViewAt(130,'synthetic-front'),middle,'Reverse seeks and frame schedule do not change state');
  assert.equal(groundViewAt(130,'synthetic-oblique').shape.base,middle.shape.base);
  for(const time of [119.9,140.1]){const state=groundViewAt(time,'synthetic-front');assert.equal(state.state,'gap');assert.equal(state.shape,null);assert.equal(state.reference,null);}
  assert.equal(groundViewAt(130,'missing-camera').state,'unavailable');
});
test('the existing shared clock gives the same authored state across schedules, rate changes and reverse seek',()=>{
  const states=[];
  for(const schedule of [[100,200,500,1000],[1000]]){
    const clock=new PlaybackClock(2280,1);clock.seek(120);clock.play(0);
    for(const wall of schedule)clock.tick(wall);
    const state=groundViewAt(clock.seconds,'synthetic-front');states.push(state);
    close(clock.seconds,121);close(state.shape.base,.2125);close(state.shape.flare,.605);
    clock.setRate(15,1000);clock.tick(1600);close(clock.seconds,130);
    clock.pause(1600);clock.tick(5000);close(clock.seconds,130);
    clock.seek(120);assert.equal(groundViewAt(clock.seconds,'synthetic-front').reference,'assets/ground-view-demo/synthetic-front-120.svg');
  }
  assert.deepEqual(states[0],states[1]);
});
