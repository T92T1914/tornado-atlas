import {MPH,FOOT,windAt,loadAt} from './wind-model.mjs';
const el=id=>document.getElementById(id),canvas=el('wind-field'),ctx=canvas.getContext('2d');
const ids=['peak','radius','background','probe-x','probe-y','area','coefficient'];
let running=false,last=null,raf=0,visible=true,particles=[];
function settings() {
  const s=Object.fromEntries(ids.map(id=>[id,Number(el(id).value)]));
  return {...s,peak:s.peak*MPH,radius:s.radius*FOOT,background:s.background*MPH};
}
function palette(value) {
  const a=[65,127,139],b=[231,182,121],p=Math.min(1,Math.max(0,value));
  return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*p)).join(',')})`;
}
function resetParticles() {
  // A deterministic visual distribution; these are passive markers, not debris.
  particles=Array.from({length:260},(_,i)=>({x:((i*137)%521)/100-2.6,y:((i*211)%523)/100-2.6}));
}
function geometry() {
  const width=canvas.clientWidth,height=width/1.4,dpr=Math.min(devicePixelRatio||1,2);
  if (canvas.width!==Math.round(width*dpr) || canvas.height!==Math.round(height*dpr)) {canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {width,height,scale:height/5.5,cx:width/2,cy:height/2};
}
function draw(elapsed=0) {
  const s=settings(),{width,height,scale,cx,cy}=geometry();
  ctx.clearRect(0,0,width,height);
  const max=s.peak+s.background;
  // Field is in core-radius units. Y increases northward, opposite canvas Y.
  for (let y=-2.5;y<=2.5;y+=.25) for (let x=-3.5;x<=3.5;x+=.25) {
    const w=windAt(x*s.radius,y*s.radius,s),p=w.speed/max;
    ctx.fillStyle=palette(p);ctx.globalAlpha=.055+.09*p;
    ctx.fillRect(cx+x*scale-scale*.125,cy-y*scale-scale*.125,scale*.25+1,scale*.25+1);
    ctx.globalAlpha=.85;
    if (w.speed<1e-6) continue;
    const len=scale*(.07+.08*p),dx=w.u/w.speed*len,dy=-w.v/w.speed*len;
    const px=cx+x*scale,py=cy-y*scale;
    ctx.strokeStyle=palette(p);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(px-dx/2,py-dy/2);ctx.lineTo(px+dx/2,py+dy/2);
    ctx.moveTo(px+dx/2-dx*.35-dy*.23,py+dy/2-dy*.35+dx*.23);ctx.lineTo(px+dx/2,py+dy/2);ctx.lineTo(px+dx/2-dx*.35+dy*.23,py+dy/2-dy*.35-dx*.23);ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.strokeStyle='#d6c5a0';ctx.lineWidth=1;ctx.setLineDash([5,6]);
  ctx.beginPath();ctx.arc(cx,cy,scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#b3bbae';ctx.font='11px Segoe UI';ctx.fillText('N ↑',18,24);ctx.fillText(`R = ${Math.round(s.radius/FOOT)} ft`,cx+scale+7,cy-8);
  if (elapsed) for (const point of particles) {
    const w=windAt(point.x*s.radius,point.y*s.radius,s);
    const mx=point.x+w.u/s.radius*elapsed/2,my=point.y+w.v/s.radius*elapsed/2;
    const mid=windAt(mx*s.radius,my*s.radius,s);
    point.x+=mid.u/s.radius*elapsed;point.y+=mid.v/s.radius*elapsed;
    if (Math.abs(point.x)>3.6 || Math.abs(point.y)>2.7) {point.x=-3.5;point.y=((point.y+2.7)%5.4+5.4)%5.4-2.7;}
  }
  ctx.fillStyle='#f8ead0';
  for (const point of particles) {ctx.beginPath();ctx.arc(cx+point.x*scale,cy-point.y*scale,1.15,0,Math.PI*2);ctx.fill();}
  const px=cx+s['probe-x']*scale,py=cy-s['probe-y']*scale;
  ctx.strokeStyle='#fff8ed';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,8,0,Math.PI*2);ctx.moveTo(px-14,py);ctx.lineTo(px+14,py);ctx.moveTo(px,py-14);ctx.lineTo(px,py+14);ctx.stroke();
  ctx.fillStyle='#fff8ed';ctx.fillText('PROBE',Math.min(width-60,px+14),Math.max(14,py-13));
}
function update() {
  const s=settings(),wind=windAt(s['probe-x']*s.radius,s['probe-y']*s.radius,s),load=loadAt(wind.speed,s);
  const labels={peak:`${el('peak').value} mph`,radius:`${el('radius').value} ft`,background:`${el('background').value} mph`,'probe-x':`${s['probe-x'].toFixed(1)} R`,'probe-y':`${s['probe-y'].toFixed(1)} R`,area:`${s.area.toFixed(1)} m²`,coefficient:s.coefficient.toFixed(1)};
  for (const id of ids) el(`${id}-value`).textContent=labels[id];
  el('probe-speed').textContent=`${(wind.speed/MPH).toFixed(1)} mph`;
  el('probe-si').textContent=`${wind.speed.toFixed(1)} m/s · ${(wind.speed*3.6).toFixed(1)} km/h`;
  el('probe-pressure').textContent=`${(load.pressure/1000).toFixed(2)} kPa`;
  el('probe-force').textContent=`${(load.force/1000).toFixed(2)} kN`;
  draw();
}
function pause(message='Paused. Move the probe to explore.') {
  running=false;cancelAnimationFrame(raf);last=null;el('wind-motion').textContent='Play tracers';el('wind-status').textContent=message;
}
function frame(now) {
  if (!running) return;
  const dt=last===null?0:Math.min((now-last)/1000,.04);last=now;draw(dt);raf=requestAnimationFrame(frame);
}
el('wind-controls').addEventListener('submit',e=>e.preventDefault());
for (const id of ids) el(id).addEventListener('input',update);
el('wind-motion').addEventListener('click',()=>{
  if (running) return pause();
  if (!visible || document.hidden) return;
  running=true;last=null;el('wind-motion').textContent='Pause tracers';el('wind-status').textContent='Passive tracers moving through the assumed field.';raf=requestAnimationFrame(frame);
});
el('wind-reset').addEventListener('click',()=>{pause();el('wind-controls').reset();resetParticles();update();});
function probe(x,y) {el('probe-x').value=Math.max(-2.5,Math.min(2.5,x));el('probe-y').value=Math.max(-2.5,Math.min(2.5,y));update();}
canvas.addEventListener('pointerdown',e=>{
  const box=canvas.getBoundingClientRect(),scale=box.height/5.5;
  probe((e.clientX-box.left-box.width/2)/scale,-(e.clientY-box.top-box.height/2)/scale);
});
canvas.addEventListener('keydown',e=>{
  const steps={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]},d=steps[e.key];
  if (!d) return;e.preventDefault();probe(Number(el('probe-x').value)+d[0],Number(el('probe-y').value)+d[1]);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Paused while the page was hidden.');});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)pause('Paused while the field was out of view.');},{threshold:.1}).observe(canvas);
new ResizeObserver(()=>draw()).observe(canvas);
resetParticles();update();
