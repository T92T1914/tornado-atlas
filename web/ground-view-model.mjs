import {validateSourceCamera} from './source-camera-model.mjs';
import {formationAt} from './formation-model.mjs';

// Software demonstration only. No source pixels, historical camera, geographic
// transform or appearance window is supplied by this authored scene.
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export const GROUND_DEMO=freeze({id:'synthetic-ground-v1',start:120,end:140,frames:[120,130,140]});
const camera=(id,position)=>({id,coordinate_space:'right_handed_y_up',units:'authored_scene_units',origin:'model-ground-origin',
  position,target:[0,1.3,0],up:[0,1,0],image:{width:1280,height:720},
  intrinsics:{fx:900,fy:900,cx:640,cy:360},clip:{near:.1,far:60},distortion:{model:'none'},
  provenance:{position:'illustrative',orientation:'illustrative',intrinsics:'illustrative',distortion:'illustrative'}});
export const GROUND_CAMERAS=freeze([
  {id:'synthetic-front',label:'Synthetic front ground view',camera:camera('synthetic-front',[0,.16,7])},
  {id:'synthetic-oblique',label:'Synthetic oblique ground view',camera:camera('synthetic-oblique',[4,.16,6])},
]);
for(const view of GROUND_CAMERAS)validateSourceCamera(view.camera);
export const GROUND_MARKS=freeze([[-2,0,0],[0,2.6,0],[2,0,0],[0,0,0]]);

export function groundViewAt(seconds,id){
  if(!Number.isFinite(seconds))throw new RangeError('Invalid shared player time');
  const view=GROUND_CAMERAS.find(item=>item.id===id);
  if(!view)return {state:'unavailable',camera:null,shape:null,reference:null,reason:'The requested synthetic camera is not declared. No viewpoint has been substituted.'};
  const camera=view.camera;
  if(seconds<GROUND_DEMO.start||seconds>GROUND_DEMO.end)return {state:'gap',camera,shape:null,reference:null,reason:'Outside the authored demonstration interval. No form or reference is held here.'};
  const u=(seconds-GROUND_DEMO.start)/(GROUND_DEMO.end-GROUND_DEMO.start);
  return {state:'synthetic',camera,shape:{base:.18+.65*u,flare:.62-.30*u,bend:0},extent:1,
    // This is the shared clock value, never an accumulated animation time.
    time:seconds,reference:GROUND_DEMO.frames.includes(seconds)?`assets/ground-view-demo/${id}-${seconds}.svg`:null,
    reason:'Authored synthetic evolution. These camera and shape quantities are not El Reno observations.'};
}

export function funnelSimulationAt(seconds,id){
  const original=groundViewAt(seconds,id);
  if(original.state!=='synthetic')return {...original,motionModel:'kinematic-v1'};
  const u=(seconds-GROUND_DEMO.start)/(GROUND_DEMO.end-GROUND_DEMO.start),smooth=u*u*(3-2*u);
  return {...original,shape:{base:.42+.23*smooth,flare:.70-.12*smooth,bend:.10},
    reference:null,motionModel:'kinematic-v1',
    reason:'Procedural condensation, rising helical detail, low circulating dust and a separately moving cloud base. Authored scene units and motion; no historical El Reno appearance or physical wind is registered.'};
}

export function formationSimulationAt(seconds,id){
  const original=groundViewAt(seconds,id);
  if(original.state!=='synthetic')return {...original,motionModel:'genesis-v1'};
  // One explicit mapping from the shared player, not an independently running clock.
  const formationTime=(seconds-GROUND_DEMO.start)/(GROUND_DEMO.end-GROUND_DEMO.start)*30;
  const state=formationAt(formationTime);
  return {...original,shape:state.shape,extent:1,reference:null,motionModel:'genesis-v1',formationTime,
    stage:state.stage,reason:`${state.stage}. An illustrative supercell scenario: circulation, visible condensation and dust have separate authored schedules. No El Reno appearance or physical wind is registered.`};
}
