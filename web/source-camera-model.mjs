// A pinhole projection in declared authored scene units. This is not an
// admission path for historical sources, geographic poses or metric geometry.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract = (a,b) => a.map((x,i) => x-b[i]);
function fields(value,names){
  if(!value || typeof value!=='object' || Array.isArray(value) ||
    Object.keys(value).sort().join('|')!==[...names].sort().join('|'))throw new TypeError('Incomplete or unsupported source camera fields');
}
function vector(value){
  if(!Array.isArray(value)||value.length!==3||!value.every(finite)||value.some(x=>Math.abs(x)>1e6))throw new TypeError('Source camera needs finite scene vectors');
}
function unit(value){
  const length=Math.hypot(...value);
  if(length<1e-8)throw new RangeError('Source camera orientation is degenerate');
  return value.map(x=>x/length);
}
export function validateSourceCamera(camera){
  fields(camera,['id','coordinate_space','units','origin','position','target','up','image','intrinsics','clip','distortion','provenance']);
  if(typeof camera.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(camera.id)||
    camera.coordinate_space!=='right_handed_y_up'||camera.units!=='authored_scene_units'||camera.origin!=='model-ground-origin')
    throw new TypeError('Unsupported source camera identity, axes or units');
  for(const name of ['position','target','up'])vector(camera[name]);
  fields(camera.image,['width','height']);
  if(!Object.values(camera.image).every(x=>Number.isInteger(x)&&x>=1&&x<=16384))throw new RangeError('Invalid source image dimensions');
  fields(camera.intrinsics,['fx','fy','cx','cy']);
  const {fx,fy,cx,cy}=camera.intrinsics,{width,height}=camera.image;
  if(![fx,fy,cx,cy].every(finite)||fx<=0||fy<=0||fx>1e7||fy>1e7||cx<0||cx>width||cy<0||cy>height)
    throw new RangeError('Invalid source camera intrinsics');
  fields(camera.clip,['near','far']);
  if(!Object.values(camera.clip).every(finite)||camera.clip.near<=0||camera.clip.far<=camera.clip.near||camera.clip.far>1e7)
    throw new RangeError('Invalid source camera clipping interval');
  fields(camera.distortion,['model']);
  if(camera.distortion.model!=='none')throw new TypeError('Only explicitly undistorted pinhole images are supported');
  fields(camera.provenance,['position','orientation','intrinsics','distortion']);
  if(!Object.values(camera.provenance).every(x=>['measured','reported','fitted','illustrative'].includes(x)))
    throw new TypeError('Unknown camera quantities cannot supply a projection');
  const forward=unit(subtract(camera.target,camera.position));
  const right=unit(cross(forward,unit(camera.up))),up=cross(right,forward);
  return {right,up,forward};
}

export function sourceFrame(camera,width,height){
  validateSourceCamera(camera);
  if(![width,height].every(x=>finite(x)&&x>0))throw new RangeError('Invalid source viewport');
  const scale=Math.min(width/camera.image.width,height/camera.image.height);
  const w=Math.min(width,camera.image.width*scale),h=Math.min(height,camera.image.height*scale);
  return {left:(width-w)/2,top:(height-h)/2,width:w,height:h,scale};
}

export function sourceBackingSize(width,height,pixelRatio){
  if(![width,height,pixelRatio].every(x=>finite(x)&&x>0))throw new RangeError('Invalid source raster bounds');
  // One common scale preserves the CSS source frame when either buffer cap is
  // reached. Independent width/height caps would squeeze the locked projection.
  const scale=Math.min(pixelRatio,2,2048/width,1600/height);
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

export function projectSourcePoint(point,camera){
  vector(point);
  const {right,up,forward}=validateSourceCamera(camera),relative=subtract(point,camera.position);
  const depth=dot(relative,forward);
  if(depth<camera.clip.near||depth>camera.clip.far)return null;
  const {fx,fy,cx,cy}=camera.intrinsics;
  return {x:cx+fx*dot(relative,right)/depth,y:cy-fy*dot(relative,up)/depth,depth};
}

export function sourceCameraProjection(camera,width,height){
  const {right,up,forward}=validateSourceCamera(camera),{fx,fy,cx,cy}=camera.intrinsics;
  const {width:iw,height:ih}=camera.image,{near,far}=camera.clip;
  const rows=[right,up,forward],translation=rows.map(row=>-dot(row,camera.position));
  const a=2*fx/iw,b=2*fy/ih,c=2*cx/iw-1,d=1-2*cy/ih;
  const z=(far+near)/(far-near),tz=-2*far*near/(far-near),matrix=new Float32Array(16);
  for(let column=0;column<4;column++){
    const r=column<3?right[column]:translation[0],u=column<3?up[column]:translation[1],f=column<3?forward[column]:translation[2];
    matrix[column*4]=a*r+c*f;matrix[column*4+1]=b*u+d*f;
    matrix[column*4+2]=z*f+(column===3?tz:0);matrix[column*4+3]=f;
  }
  if(![...matrix].every(finite))throw new RangeError('Source camera exceeds the graphics buffer range');
  const frame=sourceFrame(camera,width,height);
  const viewport={x:Math.floor(frame.left),y:Math.floor(frame.top),width:Math.max(1,Math.round(frame.width)),height:Math.max(1,Math.round(frame.height))};
  const focalX=fx*viewport.width/iw,focalY=fy*viewport.height/ih,pointScale=Math.max(focalX,focalY);
  return {matrix,viewport,pointScale,spriteAspect:[focalX/pointScale,focalY/pointScale]};
}
