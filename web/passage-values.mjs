import {MPH,FOOT,loadAt} from './wind-model.mjs';

export const SAMPLE_COUNT=481;
const numeric=(value,places)=>value.toFixed(places);
const stateText=failed=>failed?'Failed under this rule':'Capacity not exceeded so far';

// Read the existing calculation outputs. This adapter adds no wind or failure rule.
export function passageValueRows(result,component,field) {
  if(result.samples.length!==SAMPLE_COUNT || component.states.length!==SAMPLE_COUNT)
    throw new RangeError('Expected the complete 481-sample passage');
  return result.samples.map((sample,index)=>{
    const state=component.states[index];
    if(sample.time!==state.time)throw new RangeError('Passage and component samples must align');
    const values=[sample.time,sample.speed/MPH,sample.speed,
      loadAt(sample.speed,field).pressure/1000,state.force/1000,state.ratio];
    if(!values.every(Number.isFinite) || typeof state.failed!=='boolean')
      throw new RangeError('Sampled values must be finite with an explicit component state');
    return {index,values,failed:state.failed};
  });
}

export function rowCells(row) {
  const precision=[2,2,2,3,3,3];
  return row.values.map((value,index)=>({value:String(value),text:numeric(value,precision[index])}));
}

export function renderSampleRows(rows) {
  return rows.map(row=>`<tr id="passage-sample-${row.index}" tabindex="-1"${row.index===0?' aria-current="true"':''}><th scope="row">${row.index+1}${row.index===0?' (selected)':''}</th>${rowCells(row).map(cell=>`<td data-value="${cell.value}">${cell.text}</td>`).join('')}<td>${stateText(row.failed)}</td></tr>`).join('\n');
}

export function assumptionText({field,result,threshold,capacity}) {
  return `Peak swirl ${numeric(field.peak/MPH,1)} mph, core radius ${numeric(field.radius/FOOT,0)} ft, eastward background ${numeric(field.background/MPH,1)} mph, travel ${numeric(field.travel/MPH,1)} mph, probe offset ${numeric(field.offset,1)} R, reference area ${numeric(field.area,1)} m², drag coefficient ${numeric(field.coefficient,1)}, density 1.225 kg/m³, comparison ${numeric(threshold/MPH,1)} mph and assumed capacity ${numeric(capacity/1000,1)} kN. The 481 samples cover model time ${numeric(-result.halfTime,2)} to ${numeric(result.halfTime,2)} seconds as the center moves from -6 R to +6 R.`;
}

export function renderSampleSection(experiment) {
  const rows=passageValueRows(experiment.result,experiment.component,experiment.field);
  return `<section id="sampled-values" class="sampled-values" aria-labelledby="sampled-values-title">
<h3 id="sampled-values-title">Inspect sampled values.</h3>
<p id="sampled-values-assumptions">${assumptionText(experiment)}</p>
<p id="sampled-values-static">This complete table is the default experiment. JavaScript updates it when settings change. With scripts unavailable, the table stays at these stated defaults and controls cannot recalculate it.</p>
<p>Model seconds measure this hypothetical passage, with zero at closest approach. Playback uses 24 display seconds independently. The finite window omits winds outside it. The comparison speed is not a damage threshold. These assumed values are independent of the historical storms.</p>
<div id="sampled-values-controls" class="sampled-values-controls" hidden><span id="sampled-values-selection">Sample 1 of 481 selected.</span><button id="sampled-values-show" type="button">Show selected sample in table</button></div>
<details id="sampled-values-details"><summary>Read all 481 samples</summary>
<p id="sampled-values-help">Focus the table region to scroll across columns with the arrow keys. Displayed time and wind use two decimal places. Pressure, drag and load ratio use three. State uses unrounded force: only force strictly greater than capacity triggers failure, which persists at later samples. Equality does not fail. Rewinding shows the earlier state.</p>
<div id="sampled-values-region" class="sampled-values-region" role="region" tabindex="0" aria-label="Complete sampled passage values" aria-describedby="sampled-values-help">
<table><caption>All 481 samples of the stated assumed passage. These are calculations, not observed winds or a real component assessment.</caption><thead><tr><th scope="col">Sample</th><th scope="col">Time (model s)</th><th scope="col">Wind (mph)</th><th scope="col">Wind (m/s)</th><th scope="col">Dynamic pressure (kPa)</th><th scope="col">Drag (kN)</th><th scope="col">Load / capacity</th><th scope="col">Component state</th></tr></thead><tbody id="sampled-values-body">
${renderSampleRows(rows)}
</tbody></table></div></details></section>`;
}

export function attachPassageValues(document) {
  const body=document.getElementById('sampled-values-body');
  const nodes=[...body.rows];
  if(nodes.length!==SAMPLE_COUNT)throw new RangeError('Complete static sample table required');
  const details=document.getElementById('sampled-values-details');
  const selection=document.getElementById('sampled-values-selection');
  let selected=0;
  document.getElementById('sampled-values-show').addEventListener('click',()=>{
    details.open=true;
    nodes[selected].scrollIntoView({block:'center',inline:'nearest'});
    nodes[selected].focus({preventScroll:true});
  });
  return {
    rebuild(experiment) {
      const rows=passageValueRows(experiment.result,experiment.component,experiment.field);
      // Keep the existing row nodes and focus. Recalculate only on input changes.
      for(const row of rows) {
        const cells=nodes[row.index].cells;
        rowCells(row).forEach((value,index)=>{
          cells[index+1].textContent=value.text;
          cells[index+1].dataset.value=value.value;
        });
        cells[7].textContent=stateText(row.failed);
      }
      document.getElementById('sampled-values-assumptions').textContent=assumptionText(experiment);
      document.getElementById('sampled-values-static').hidden=true;
      document.getElementById('sampled-values-controls').hidden=false;
      document.body.dataset.windSamples='ready';
    },
    select(index) {
      if(!Number.isInteger(index) || index<0 || index>=nodes.length)throw new RangeError('Sample index outside passage');
      // Playback changes only two markers, without rebuilding, scrolling or focus.
      if(index!==selected) {
        nodes[selected].removeAttribute('aria-current');
        nodes[selected].cells[0].textContent=String(selected+1);
        nodes[index].setAttribute('aria-current','true');
        nodes[index].cells[0].textContent=`${index+1} (selected)`;
        selected=index;
      }
      const text=`Sample ${index+1} of 481 selected.`;
      if(selection.textContent!==text)selection.textContent=text;
    },
  };
}
