import {continuousRankineReference} from './wind-continuous-reference.mjs';
import {MPH} from './wind-model.mjs';

// Compare the finite sample grid with independent geometry of the same assumption.
export function attachContinuousReference(document){
  const get=id=>document.getElementById(id),panel=get('wind-reference-values');
  const fields=['maximum-wind','maximum-drag','comparison-duration','capacity-duration'];
  return {update({field,result,component,threshold,capacity}){
    const reference=continuousRankineReference(field,{threshold,capacity});
    const available=reference.status==='available';panel.hidden=!available;
    if(!available){
      for(const id of fields)get('reference-'+id).textContent='';
      get('wind-reference-status').textContent='Continuous comparison unavailable for nonzero background wind. The sampled field, component and table still describe your chosen assumptions. Set background wind to zero to use the independent annulus reference.';
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
  }};
}
