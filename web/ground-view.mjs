import {GROUND_CAMERAS,GROUND_DEMO,groundViewAt,funnelSimulationAt,formationSimulationAt} from './ground-view-model.mjs';

const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
export function mountGroundView({host,referenceHost,onCamera,onSeek,onQuality}){
  host.innerHTML=`<h3>Synthetic ground-view comparison</h3>
    <p class="ground-boundary">This is a synthetic camera exercise, not recorded El Reno appearance. The authored interval uses player seconds 120 through 140 to exercise the existing shared clock. It has no historical time correspondence.</p>
    <div class="ground-options"><label>Source camera <select id="ground-camera"><option value="">Choose a synthetic camera</option></select></label>
    <label>Drawing quality <select id="ground-quality"><option value="1600">1600 particles</option><option value="3200" selected>3200 particles</option></select></label></div>
    <p id="ground-lock">The source camera is locked. Geographic orbit controls turn only the path scene.</p>
    <p>Use the existing Play, playback speed and time controls above. Viewpoint selection pauses playback. The three buttons select authored comparison instants.</p>
    <div id="ground-keyframes" class="ground-keyframes" role="group" aria-label="Synthetic comparison instants"></div>
    <p id="ground-time" role="timer" aria-live="off"></p>
    <details><summary>Camera geometry and assumptions</summary><p id="ground-camera-details"></p>
    <p>World axes are right handed: X and Z span the ground, Y points up. The origin is the model's central ground point. All pose, lens and shape quantities are illustrative. The height 2.6 is in authored scene units, with no conversion to metres. The pinhole lens is explicitly undistorted. Unknown or unsupported optics cannot be substituted.</p>
    <p id="ground-model-note">The reference contains an independently derived analytic funnel outline and four reference marks at known scene points. The rendered particles have soft edges and an additional authored cloud base. Those do not coincide with the analytic outline. This comparison checks software projection, not historical likeness, hidden geometry, wind or damage.</p></details>`;
  const camera=host.querySelector('#ground-camera'),quality=host.querySelector('#ground-quality');
  for(const view of GROUND_CAMERAS){const option=document.createElement('option');option.value=view.id;option.textContent=view.label;camera.append(option);}
  for(const seconds of GROUND_DEMO.frames){const button=document.createElement('button');button.type='button';button.dataset.groundSecond=seconds;button.textContent=`Compare at player ${seconds} s`;button.addEventListener('click',()=>onSeek(seconds));host.querySelector('#ground-keyframes').append(button);}
  camera.addEventListener('change',()=>onCamera(camera.value));
  quality.addEventListener('change',()=>onQuality(Number(quality.value)));
  let referenceKey=null,identity=0;
  function showReference(state,seconds){
    const key=state.reference??'';
    const selected=key||`${state.state}:${state.camera?.id??''}`;
    if(selected===referenceKey)return;
    referenceKey=selected;const token=++identity;referenceHost.replaceChildren();
    const caption=document.createElement('figcaption');caption.textContent='Synthetic analytic reference';referenceHost.append(caption);
    const note=document.createElement('p');note.id='ground-reference-status';note.setAttribute('role','status');
    if(!key){note.textContent=state.state==='synthetic'?'No frozen reference exists at this exact instant. Select one of the three comparison instants.':'No reference is assigned to this camera or time.';referenceHost.append(note);return;}
    const retry=document.createElement('button');retry.type='button';retry.id='ground-reference-retry';retry.textContent='Retry synthetic reference';retry.hidden=true;
    const original=document.createElement('a');original.id='ground-reference-original';original.href=key;original.target='_blank';original.rel='noopener';original.textContent='Open the complete synthetic reference';
    let image=null,attemptIdentity=0,retryInitiated=false,inflight=false;
    const load=()=>{
      if(token!==identity)return;
      const attempt=++attemptIdentity,previous=image,next=document.createElement('img');
      next.id='ground-reference-image';next.alt=`Independently computed synthetic funnel guide for ${state.camera.id} at player ${seconds} seconds. Not an El Reno photograph.`;
      next.hidden=true;image=next;
      const ownsAttempt=()=>token===identity&&attempt===attemptIdentity&&image===next;
      next.addEventListener('load',()=>{if(!ownsAttempt())return;inflight=false;const focused=document.activeElement===retry;next.hidden=false;retry.hidden=true;retry.setAttribute('aria-disabled','false');if(focused)original.focus();note.textContent=`Complete synthetic reference: ${state.camera.id}, player ${seconds} seconds. No historical exposure is assigned.`;});
      next.addEventListener('error',()=>{if(!ownsAttempt())return;inflight=false;next.hidden=true;retry.hidden=false;retry.setAttribute('aria-disabled','false');note.textContent='The synthetic reference could not load. Its identity and link to the complete file remain available.';});
      if(previous){previous.removeAttribute('src');previous.replaceWith(next);}else referenceHost.insertBefore(next,note);
      inflight=true;retry.setAttribute('aria-disabled','true');retry.hidden=!retryInitiated;note.textContent='Loading the selected synthetic reference.';next.src=key;
    };
    retry.addEventListener('click',()=>{if(inflight)return;retryInitiated=true;load();});referenceHost.append(note,retry,original);load();
  }
  let simulation=false,currentVariant='legacy';
  const legacyHeading=host.querySelector('h3').textContent,legacyBoundary=host.querySelector('.ground-boundary').textContent,legacyModelNote=host.querySelector('#ground-model-note').textContent;
  return {
    quality:()=>Number(quality.value),
    update(enabled,seconds,id,variant='legacy'){
      const nextSimulation=variant!=='legacy',formation=variant==='genesis-v1';
      if(variant!==currentVariant){
        currentVariant=variant;simulation=nextSimulation;identity++;referenceKey=null;referenceHost.replaceChildren();
        text(host.querySelector('h3'),formation?'Formation, visible cloud and decay':simulation?'Procedural funnel simulation':legacyHeading);
        text(host.querySelector('.ground-boundary'),simulation?'An authored moving funnel in a declared camera. Player seconds 120 through 140 are simulation offsets with no historical El Reno correspondence.':legacyBoundary);
        if(formation)text(host.querySelector('.ground-boundary'),'One illustrative supercell scenario. Surface arrows show assumed circulation, not measured wind. Player seconds 120 through 140 are study offsets with no historical El Reno correspondence.');
        text(host.querySelector('#ground-model-note'),simulation?'The body integrates a bounded procedural density. Detail rises and turns coherently; dust follows separate fading trajectories and the cloud base drifts slowly. These are authored kinematics and display opacity, without physical wind, pressure, debris mass or measured scale. The earlier analytic references remain in the separate synthetic comparison.':legacyModelNote);
        if(formation)text(host.querySelector('#ground-model-note'),'One illustrative supercell pathway, not a universal life cycle. Surface arrows show assumed circulation, not measured velocities. Condensation can be absent while circulation is present; dust does not define tornado existence. Player 120 through 140 maps linearly to 0 through 30 study seconds. Compare reduced condensation at the same circulation in Form Study.');
        for(const b of host.querySelectorAll('[data-ground-second]'))text(b,`${simulation?'Show':'Compare'} at player ${b.dataset.groundSecond} s`);
      }
      host.hidden=!enabled;referenceHost.hidden=!enabled;
      camera.querySelector('[data-unavailable]')?.remove();
      if(!enabled){identity++;referenceKey=null;referenceHost.replaceChildren();return null;}
      const state=(formation?formationSimulationAt:simulation?funnelSimulationAt:groundViewAt)(seconds,id);
      if(id&&!GROUND_CAMERAS.some(view=>view.id===id)){
        const option=document.createElement('option');option.value=id;option.textContent='Unavailable synthetic camera';option.dataset.unavailable='';camera.append(option);
      }
      camera.value=id??'';
      text(host.querySelector('#ground-time'),state.state==='synthetic'?`${state.stage?state.stage+'. ':''}${simulation?'Procedural simulation':'Synthetic render'} at player ${seconds.toFixed(2)} s. Authored interval: 120 through 140 s.`:state.reason);
      text(host.querySelector('#ground-camera-details'),state.camera?`${state.camera.id}. Position [${state.camera.position.join(', ')}], target [${state.camera.target.join(', ')}], up [${state.camera.up.join(', ')}]. Complete image: 1280 by 720 pixels. fx = fy = 900 pixels; principal point [640, 360]. Near/far clipping: 0.1 / 60 authored scene units. Complete source frame is fitted with letterboxing, never cropped.`:'No camera solution is available for the requested selection.');
      for(const button of host.querySelectorAll('[data-ground-second]'))button.setAttribute('aria-pressed',String(Number(button.dataset.groundSecond)===seconds));
      if(simulation)referenceHost.hidden=true;else showReference(state,seconds);
      return state;
    }
  };
}
