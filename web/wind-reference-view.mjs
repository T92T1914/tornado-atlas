import {continuousRankineReference} from './wind-continuous-reference.mjs';
import {MPH,samplePassage} from './wind-model.mjs';
import {componentHistory} from './component-model.mjs';

function summarizeGrid(grid,history,count,capacity,maximumDrag){
  if(grid?.samples?.length!==count||history?.states?.length!==count||!Number.isFinite(grid.halfTime)||grid.halfTime<=0||!Number.isFinite(history.peak)||history.peak<0)throw new RangeError('Unrepresentable grid comparison');
  let previous=-Infinity;
  for(let i=0;i<count;i++){
    const sample=grid.samples[i],state=history.states[i];
    if(!sample||!state||!Number.isFinite(sample.time)||sample.time<=previous||!Number.isFinite(sample.speed)||sample.speed<0||state.time!==sample.time||!Number.isFinite(state.force)||state.force<0)throw new RangeError('Unrepresentable grid comparison');
    previous=sample.time;
  }
  const spacing=2*grid.halfTime/(count-1),shortfall=maximumDrag-history.peak;
  if(!Number.isFinite(spacing)||spacing<=0||!Number.isFinite(shortfall))throw new RangeError('Unrepresentable grid comparison');
  return {count,spacing,peakDrag:history.peak,capacityExceeded:history.peak>capacity,shortfall};
}

// Reuse the selected grid and compare one nested grid under the same assumptions.
export function comparePassageGrids({field,result,component,threshold,capacity,maximumDrag}){
  if(!Number.isFinite(maximumDrag)||maximumDrag<0||!Number.isFinite(capacity)||capacity<=0)throw new RangeError('Invalid grid comparison');
  const coarse=summarizeGrid(result,component,481,capacity,maximumDrag);
  const finer=samplePassage(field,{steps:960,extent:6,threshold});
  const fine=summarizeGrid(finer,componentHistory(finer.samples,{...field,capacity}),961,capacity,maximumDrag);
  return {coarse,fine};
}

// Compare the finite sample grid with independent geometry of the same assumption.
export function attachContinuousReference(document){
  const get=id=>document.getElementById(id),panel=get('wind-reference-values');
  const fields=['maximum-wind','maximum-drag','comparison-duration','capacity-duration'];
  const gridFields=['spacing','peak','exceeded','shortfall'];let cached=null;
  const clearGrids=()=>{
    cached=null;get('wind-grid-values').hidden=true;
    for(const count of [481,961])for(const field of gridFields)get('grid-'+count+'-'+field).textContent='';
    get('wind-grid-status').dataset.state='unavailable';
    get('wind-grid-status').textContent='The grid comparison is unavailable for these inputs. The primary experiment with 481 samples keeps its separate results and limits.';
  };
  return {update(args){
    try{
      const {field,result,component,threshold,capacity}=args;
      let reference;
      try{reference=continuousRankineReference(field,{threshold,capacity});}
      catch(error){if(!(error instanceof RangeError))throw error;reference={status:'unavailable'};}
      const available=reference.status==='available';panel.hidden=!available;
      if(!available){
        for(const id of fields)get('reference-'+id).textContent='';clearGrids();
        get('wind-reference-status').textContent='Continuous comparison unavailable: these inputs do not have a representable reference result. The sampled field, component and table retain their separate assumptions and limits.';
        get('wind-reference-status').dataset.state='unavailable';return;
      }
      get('reference-maximum-wind').textContent=(reference.maximumSpeed/MPH).toFixed(3)+' mph';
      get('reference-maximum-drag').textContent=(reference.maximumDrag/1000).toFixed(3)+' kN';
      get('reference-comparison-duration').textContent=reference.comparisonDuration.toFixed(3)+' model s (481-sample estimate: '+result.aboveSeconds.toFixed(3)+' s)';
      get('reference-capacity-duration').textContent=reference.capacityExceedanceDuration.toFixed(3)+' model s strictly above capacity';
      const missed=reference.capacityExceeded&&component.firstFailureTime===null;
      get('wind-reference-status').dataset.state=missed?'missed-exceedance':'available';
      get('wind-reference-status').textContent=missed?
        'The continuous assumed field exceeds capacity, but none of the 481 samples does. The sampled component state misses this brief exceedance. Its graph and table remain unchanged.':
        reference.capacityExceeded?'The continuous assumed field exceeds capacity. The sampled component follows only its sampled loads; its first failing sample is not an exact crossing time.':
        'The continuous assumed field does not strictly exceed capacity in this finite window. Equality does not count as an exceedance. These results describe this idealization, not a real component.';
      try{
        const key=JSON.stringify([field.peak,field.radius,field.background,field.travel,field.offset,field.area,field.coefficient,field.density??1.225,threshold,capacity]);
        // Reference-only restores reuse the comparison. Playback and selection do not call update.
        if(cached?.key!==key)cached={key,value:comparePassageGrids({field,result,component,threshold,capacity,maximumDrag:reference.maximumDrag})};
        else cached={key,value:{coarse:summarizeGrid(result,component,481,capacity,reference.maximumDrag),fine:cached.value.fine}};
        for(const grid of [cached.value.coarse,cached.value.fine]){
          get('grid-'+grid.count+'-spacing').textContent=grid.spacing.toFixed(6);
          get('grid-'+grid.count+'-peak').textContent=grid.peakDrag.toFixed(3);
          get('grid-'+grid.count+'-exceeded').textContent=grid.capacityExceeded?'Yes':'No';
          get('grid-'+grid.count+'-shortfall').textContent=grid.shortfall.toFixed(3);
        }
        get('wind-grid-values').hidden=false;get('wind-grid-status').dataset.state='available';
        get('wind-grid-status').textContent=cached.value.coarse.capacityExceeded!==cached.value.fine.capacityExceeded?
          'The two grids give different strict capacity outcomes for these inputs. The graph, component and full table still use 481 samples.':
          'The two grids give the same strict capacity outcome for these inputs. This does not establish convergence for other settings or wind fields.';
      }catch(error){clearGrids();if(!(error instanceof RangeError))throw error;}
    }catch(original){
      // A malformed helper input must not leave earlier values under a new state.
      // The supported passage caller supplies complete results; preserve any original error.
      cached=null;
      try{
        panel.hidden=true;
        for(const id of fields)get('reference-'+id).textContent='';
        clearGrids();
        get('wind-reference-status').dataset.state='unavailable';
        get('wind-reference-status').textContent='Comparison unavailable: the current results could not be read. The sampled experiment retains its separate assumptions and limits.';
      }catch(cleanup){try{console.error('Additional Wind reference cleanup failure:',cleanup);}catch{}}
      throw original;
    }
  }};
}
