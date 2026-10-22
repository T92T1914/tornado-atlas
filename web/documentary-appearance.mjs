import {createFormRenderer} from './form-renderer.mjs';

// A static documentary observation has no replay clock or camera solution.
// Resize redraws the same authored form. It does not animate a historical interval.
export function mountDocumentaryAppearance(root=document){
  const canvas=root.getElementById('early-condensation-canvas');
  const record=root.getElementById('early-condensation-record');
  const status=root.getElementById('early-condensation-status');
  if(!canvas||!record||!status)return null;
  let renderer=null,observer=null,frame=null,active=true,enabled=true,disposed=false,validated=false,observation;
  function cancel(){if(frame!==null)cancelAnimationFrame(frame);frame=null;}
  function unavailable(){
    canvas.style.visibility='hidden';canvas.dataset.documentaryState='unavailable';
    status.textContent='The drawing is unavailable here. The historical description and original source links remain readable.';
  }
  function draw(){
    frame=null;if(!active||!renderer)return;
    try{
      renderer.render({partialForm:observation.partial_form,shape:null,extent:null,time:0,dust:false});
      canvas.style.visibility='visible';canvas.dataset.documentaryState='reported_minute';
      status.textContent='Schematic based on the cited photograph. The reported minute supplies no physical scale or inferred motion.';
    }catch{unavailable();}
  }
  function schedule(){if(active&&frame===null)frame=requestAnimationFrame(draw);}
  function start(){
    if(disposed||!enabled||!validated)return;
    active=true;
    observer?.disconnect();
    try{
      if(renderer)renderer.initialize();else renderer=createFormRenderer(canvas,100);
      canvas.hidden=false;
      observer=new ResizeObserver(schedule);observer.observe(canvas);schedule();
    }catch{unavailable();}
  }
  function stop(){active=false;cancel();observer?.disconnect();observer=null;renderer?.dispose();}
  try{
    observation=JSON.parse(record.textContent);
    if(observation.state!=='documentary_reported_minute'||observation.reported_time.precision!=='minute'||
       observation.reported_time.exact_replay_seconds!==null||observation.continuous_registration!==null||
       observation.shape!==null||observation.physical_extent!==null)throw new Error('Unsupported documentary observation');
    validated=true;
    start();
  }catch{unavailable();}
  const lost=event=>{event.preventDefault();stop();unavailable();};
  const restored=()=>{if(enabled&&!disposed)start();};
  const departure=()=>stop();
  const returned=event=>{if(event.persisted&&enabled&&!disposed)start();};
  canvas.addEventListener('webglcontextlost',lost);
  canvas.addEventListener('webglcontextrestored',restored);
  window.addEventListener('pagehide',departure);
  window.addEventListener('pageshow',returned);
  return {
    suspend(){enabled=false;stop();},
    resume(){if(disposed||enabled&&active)return;enabled=true;start();},
    dispose(){disposed=true;enabled=false;stop();
      canvas.removeEventListener('webglcontextlost',lost);
      canvas.removeEventListener('webglcontextrestored',restored);
      window.removeEventListener('pagehide',departure);
      window.removeEventListener('pageshow',returned);
    }
  };
}
