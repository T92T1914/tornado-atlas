import {formationAt} from './formation-model.mjs';

// Local geographic stage, in kilometers. Flat ground is a display assumption.
export function localPoint(coordinates, origin) {
  if (![...coordinates, ...origin].every(Number.isFinite) || coordinates.length !== 2 || origin.length !== 2) throw new RangeError('Invalid geographic point');
  const radians = Math.PI / 180;
  return [(coordinates[0]-origin[0])*111.195*Math.cos(origin[1]*radians),
    (coordinates[1]-origin[1])*111.195, 0];
}

// Perspective projection. Azimuth 0 looks north from the south of the scene.
export function sceneProject(point, camera, width, height) {
  const {azimuth, elevation, distance, focus} = camera;
  if (![...point, ...focus, azimuth, elevation, distance, width, height].every(Number.isFinite) || distance <= 0 || width <= 0 || height <= 0) throw new RangeError('Invalid scene camera');
  const a=azimuth*Math.PI/180, e=elevation*Math.PI/180;
  const [x,y,z]=point.map((v,i)=>v-focus[i]);
  const depth=distance-(x*Math.sin(a)*Math.cos(e)-y*Math.cos(a)*Math.cos(e)+z*Math.sin(e));
  if (depth <= .05) return null;
  const scale=height*1.1/depth;
  return {x:width/2+(x*Math.cos(a)+y*Math.sin(a))*scale,
    y:height/2-(-x*Math.sin(a)*Math.sin(e)+y*Math.cos(a)*Math.sin(e)+z*Math.cos(e))*scale,
    scale, depth};
}

export function initialSeconds(search, duration) {
  const raw=new URLSearchParams(search).get('t');
  if (raw === null || raw.trim() === '') return 0;
  const seconds=Number(raw);
  return Number.isFinite(seconds) ? Math.min(duration,Math.max(0,seconds)) : 0;
}

export function replaySeconds(search,duration,anchors,start){
  // Existing source-moment links can contain an older t value. Their known
  // footage identity still selects the reviewed moment, as it did before.
  const id=new URLSearchParams(search).get('footage');
  const anchor=anchors.find(item=>item.id===id);
  const seconds=anchor?(Date.parse(anchor.utc)-start)/1000:NaN;
  return Number.isFinite(seconds)&&seconds>=0&&seconds<=duration?seconds:initialSeconds(search,duration);
}

export function replayURL(href,eventId,seconds,anchors,start){
  const url=new URL(href);
  url.searchParams.set('event',eventId);url.searchParams.set('t',seconds);
  // The panel can display a printed clock throughout its second. Only the
  // exact anchor may replace t on reload, so fractional seeks stay intact.
  const linked=anchors.find(item=>item.id===url.searchParams.get('footage'));
  const source=linked?.source_id || url.searchParams.get('footage_source');
  if(linked?.source_id)url.searchParams.set('footage_source',linked.source_id);
  const anchor=anchors.find(item=>(!source||item.source_id===source)&&(Date.parse(item.utc)-start)/1000===seconds);
  if(anchor)url.searchParams.set('footage',anchor.id);
  else{
    url.searchParams.delete('footage');
    if(url.hash==='#registered-footage')url.hash='';
  }
  return url;
}

// Project only an azimuth direction, then normalize to a fixed screen symbol.
// The arrow length is neither distance to a feature nor a camera field of view.
export function observerGlyph(sample,origin,camera,width,height){
  const point=localPoint(sample.coordinates,origin),angle=sample.azimuth*Math.PI/180;
  const start=sceneProject(point,camera,width,height);
  if(!start||start.x<0||start.x>width||start.y<0||start.y>height)return null;
  // Differentiate the projection at the observer. Projecting an arbitrary
  // distant endpoint could cross the near plane and hide a visible observer.
  const a=camera.azimuth*Math.PI/180,e=camera.elevation*Math.PI/180;
  const east=Math.sin(angle),north=Math.cos(angle);
  const horizontal=east*Math.cos(a)+north*Math.sin(a);
  const vertical=(-east*Math.sin(a)+north*Math.cos(a))*Math.sin(e);
  const depth=(-east*Math.sin(a)+north*Math.cos(a))*Math.cos(e);
  const x=(start.x-width/2)/start.scale,y=-(start.y-height/2)/start.scale;
  const dx=horizontal*start.depth-x*depth,dy=-vertical*start.depth+y*depth;
  const length=Math.hypot(dx,dy);
  return {x:start.x,y:start.y,dx:length>1e-8?dx/length*30:0,dy:length>1e-8?dy/length*30:0};
}

// The particle symbol the replay drew before the funnel outline below. It is
// kept only so the pinned earlier replay script of the share link proof still
// loads. The replay no longer draws it. Its parameters never come from EF rating.
export function funnelGlyph(seconds, count=480) {
  if (!Number.isFinite(seconds) || !Number.isInteger(count) || count < 1 || count > 2000) throw new RangeError('Invalid glyph');
  return Array.from({length:count},(_,i)=>{
    // Independent integer hashes avoid correlating height with azimuth, which
    // can turn an otherwise dense cloud into a conspicuous single spiral.
    const unit=salt=>{let x=i+salt;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;};
    const h=unit(17), angle=unit(191)*Math.PI*2+seconds*.7;
    const radius=(.14+.40*h*h)*Math.sqrt(unit(977));
    return [Math.cos(angle)*radius, Math.sin(angle)*radius, .85*h];
  });
}

// A reduced outline of the joined funnel of the form study's storm-v3
// presentation. The shape numbers are copied from that shader and a test
// compares the two. The outline keeps the radius, axis, section, flare, top
// fade and lowered cloud base. It leaves out the shader's soft lobed edge, its
// fade at the ground and the cloud that continues past the filled cover. The
// stage and the size are drawing choices. Nothing here comes from a rating, a
// width record or the path envelope.
export const REPLAY_FUNNEL=Object.freeze({
  presentation:'storm-v3',
  // The developed stage of the formation study, held still.
  stageSeconds:15,
  // Shader height of the funnel column and the height that column is drawn at,
  // which is the height of the particle symbol. The flared top and the cloud
  // base rise above the column, to about 1.0 km.
  columnUnits:2.6,columnKilometers:.85,
  // The upper body widens into the cloud and fades out inside it.
  flare:.30,flareFrom:.80,flareTo:1.10,fadeFrom:1.02,fadeTo:1.22,
  // One join unit is the funnel's top radius times this factor.
  joinRadius:1.24,
  // The cloud base comes down to this height over the funnel, rises back to
  // the wider layer between these join distances and is filled out to these.
  loweredBase:2.34,baseInner:.85,baseOuter:2.4,coverInner:1.3,coverOuter:2.6,
  wideBase:3.10,wideDip:.70,wideScale:Object.freeze([1.55,1.25]),
});
const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
// These three follow referenceRadius, referenceAxis and referenceSection with
// the shader clock held at zero, so the drawing does not sway or turn.
const funnelRadius=(h,shape)=>(.62+.95*shape.base+.24*smoothstep(.05,.95,h)+.10*h)*(.82+.42*h*h)*
  (1+REPLAY_FUNNEL.flare*smoothstep(REPLAY_FUNNEL.flareFrom,REPLAY_FUNNEL.flareTo,h));
const funnelAxis=(h,shape)=>[.09*h+.55*shape.bend*h*h,-.10*h+.13*h*(1-h)];
const funnelSection=h=>[1.10+.06*Math.sin(2*h),.88+.05*Math.cos(2.7*h)];
const cachedFunnels=new Map();

// Rings in kilometers east, north and up from the ground point the funnel
// stands on. A ring's weight is how much of the drawing's ink it carries.
export function replayFunnel(levels=40,segments=24){
  if(!Number.isInteger(levels)||levels<8||levels>80||!Number.isInteger(segments)||segments<8||segments>48)throw new RangeError('Invalid funnel drawing resolution');
  const key=`${levels}:${segments}`;
  if(cachedFunnels.has(key))return cachedFunnels.get(key);
  const F=REPLAY_FUNNEL,shape=formationAt(F.stageSeconds).shape,scale=F.columnKilometers/F.columnUnits;
  const around=build=>Object.freeze(Array.from({length:segments},(_,i)=>{
    const angle=i/segments*Math.PI*2;
    return Object.freeze(build(Math.cos(angle),Math.sin(angle)).map(value=>value*scale));
  }));
  const rings=[];
  for(let level=0;level<levels;level++){
    const h=level/levels*F.fadeTo,weight=1-smoothstep(F.fadeFrom,F.fadeTo,h);
    const radius=funnelRadius(h,shape),axis=funnelAxis(h,shape),section=funnelSection(h);
    rings.push(Object.freeze({part:'body',weight,
      points:around((cos,sin)=>[axis[0]+radius*section[0]*cos,axis[1]+radius*section[1]*sin,F.columnUnits*h])}));
  }
  // The lowered base shares the footprint of the funnel top. Its flat part
  // inside baseInner lies within the body, so the discs start where the cover
  // begins to thin. Each disc is flat at the height of its rim and carries the
  // share of the cloud cover that ends before the next one.
  const top=funnelAxis(1,shape),topSection=funnelSection(1);
  const unit=F.joinRadius*(.62+.95*shape.base+.24+.10);
  const cover=distance=>1-smoothstep(F.coverInner,F.coverOuter,distance);
  const discs=12;
  for(let disc=0;disc<discs;disc++){
    const distance=F.coverInner+(F.coverOuter-F.coverInner)*disc/discs;
    const next=F.coverInner+(F.coverOuter-F.coverInner)*(disc+1)/discs;
    rings.push(Object.freeze({part:'cloud-base',weight:cover(distance)-cover(next),points:around((cos,sin)=>{
      const x=top[0]+distance*unit*topSection[0]*cos,z=top[1]+distance*unit*topSection[1]*sin;
      const wide=F.wideBase-F.wideDip*Math.exp(-((x/F.wideScale[0])**2+(z/F.wideScale[1])**2));
      const rise=smoothstep(F.baseInner,F.baseOuter,distance);
      return [x,z,Math.min(F.loweredBase,wide)*(1-rise)+wide*rise];
    })}));
  }
  const funnel=Object.freeze({base:Object.freeze([0,0,0]),rings:Object.freeze(rings)});
  cachedFunnels.set(key,funnel);
  return funnel;
}

// Where the canvas text beside the center marker starts. It sits 12 px right
// of the marker, or right of a reported width circle, and moves to the left of
// both when the right side would cross the scene's edge. Where a circle leaves
// no room on either side, the text still keeps clear of the marker. While the
// marker is in the scene the text never leaves it. A marker outside the scene
// keeps its text beside it.
export function centerLabelX(markerX,textWidth,sceneWidth,clear=null){
  const gap=12,margin=4;
  const right=clear?Math.max(markerX+gap,clear.right+6):markerX+gap;
  if(markerX<0||markerX>sceneWidth||right+textWidth<=sceneWidth-margin)return right;
  const left=(clear?Math.min(markerX-gap,clear.left-6):markerX-gap)-textWidth;
  if(left>=margin)return left;
  if(markerX+gap+textWidth<=sceneWidth-margin)return markerX+gap;
  if(markerX-gap-textWidth>=margin)return markerX-gap-textWidth;
  return Math.max(margin,sceneWidth-margin-textWidth);
}

// Survey records and fatality records as marks of the scene. Only a record
// whose point projects inside the scene gets a mark. A mark is the recorded
// point and nothing more. It has no size, no time and no rating drawn into it.
// The order runs across the scene from left to right, so a keyboard can step
// through what is in view.
export function sceneMarks(points,places,origin,camera,width,height){
  const marks=[];
  const add=(kind,id,coordinates)=>{
    const p=sceneProject(localPoint(coordinates,origin),camera,width,height);
    if(p&&p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)marks.push({kind,id,x:p.x,y:p.y});
  };
  for(const point of points)add('survey',point.id,point.coordinates);
  for(const place of places)add('fatality',place.id,place.coordinates);
  const key=mark=>mark.kind+':'+mark.id;
  return marks.sort((a,b)=>a.x-b.x||a.y-b.y||(key(a)<key(b)?-1:key(a)>key(b)?1:0));
}

// Half the width of the filled diamond of a fatality record, in scene pixels.
export const FATALITY_MARK_HALF=6;

// The mark a pointer at this place means. A fatality record's filled diamond
// is drawn over the small marks around it, so a pointer on that diamond means
// that record. Anywhere else it is the nearest mark within reach, or none.
export function markAt(marks,x,y,reach=12){
  if(![x,y,reach].every(Number.isFinite)||reach<=0)throw new RangeError('Invalid mark reach');
  let best=null,nearest=Infinity,covering=null,closest=Infinity;
  for(const mark of marks){
    const distance=Math.hypot(mark.x-x,mark.y-y);
    if(distance<=reach&&distance<nearest){best=mark;nearest=distance;}
    if(mark.kind==='fatality'&&Math.abs(mark.x-x)+Math.abs(mark.y-y)<=FATALITY_MARK_HALF&&distance<closest){covering=mark;closest=distance;}
  }
  return covering??best;
}

// The marks of one kind that share a place with this one, in order across the
// scene. Records with the same coordinates can only be told apart this way.
export function markStack(marks,mark,within=1.5){
  if(!Number.isFinite(within)||within<0)throw new RangeError('Invalid mark distance');
  return marks.filter(other=>other.kind===mark.kind&&Math.hypot(other.x-mark.x,other.y-mark.y)<=within);
}

// How far above or below its mark a label may be moved to find a free place.
export const MARK_LABEL_REACH=70;

// Where the written label of a mark goes. It tries above and below the mark,
// first to its right and then to its left, and takes the first place that
// stays inside the scene, leaves the mark itself uncovered and touches no box
// that is already taken. When the places beside the mark are taken it moves
// farther above and below in steps, so a label as wide as a narrow scene can
// still find a free row. Among the free places it takes the one that covers
// the fewest of the given points, which are the other marks of the scene, and
// the nearer one when two cover as few. Boxes listed as soft are given up
// first when no place is clear of everything. With no place clear of the
// taken boxes it stays above the mark, inside the scene. The answer says how
// many points the label covers there. A caller whose scene is moving passes
// the offset the label had from its mark, and the label keeps that place for
// as long as it is free, so it does not hop between places that are nearly as
// good.
export function markLabelPlace(mark,size,scene,taken=[],soft=[],points=[],gap=8,keep=null){
  if(![mark.x,mark.y,size.width,size.height,scene.width,scene.height,gap].every(Number.isFinite)||size.width<=0||size.height<=0||gap<0)
    throw new RangeError('Invalid mark label');
  const inside=(x,y)=>({x:Math.max(gap,Math.min(scene.width-size.width-gap,x)),y:Math.max(gap,Math.min(scene.height-size.height-gap,y))});
  const own={left:mark.x-gap,right:mark.x+gap,top:mark.y-gap,bottom:mark.y+gap};
  const clear=boxes=>place=>boxes.every(box=>!box||place.x>=box.right||place.x+size.width<=box.left||place.y>=box.bottom||place.y+size.height<=box.top);
  const covers=place=>points.reduce((count,point)=>count+(point!==mark&&point.x>place.x&&point.x<place.x+size.width&&point.y>place.y&&point.y<place.y+size.height?1:0),0);
  if(keep&&Number.isFinite(keep.dx)&&Number.isFinite(keep.dy)){
    const held=inside(mark.x+keep.dx,mark.y+keep.dy);
    if(clear([own,...taken,...soft])(held))return {...held,covers:covers(held)};
  }
  const places=[];
  for(let away=0;away<=MARK_LABEL_REACH;away+=14)
    for(const x of [mark.x+gap+2,mark.x-size.width-gap-2])
      for(const y of [mark.y-size.height-gap-away,mark.y+gap+away])places.push(inside(x,y));
  const least=boxes=>{
    let best=null;
    for(const place of places.filter(clear(boxes))){const count=covers(place);if(!best||count<best.covers)best={...place,covers:count};}
    return best;
  };
  return least([own,...taken,...soft])??least([own,...taken])??{...places[0],covers:covers(places[0])};
}
