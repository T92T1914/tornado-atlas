// Progressive filtering over the generated view. The source records remain in
// their existing dossiers, and the browser URL retains the selected context.
const form=document.getElementById('coverage-filters');
const eventSelect=document.getElementById('coverage-event');
const layerSelect=document.getElementById('coverage-layer');
const status=document.getElementById('coverage-status');
const error=document.getElementById('coverage-error');
const cards=[...document.querySelectorAll('.coverage-event')];
function choices(select){return new Set([...select.options].map(option=>option.value));}
function apply(){
  const query=new URLSearchParams(location.search),event=query.get('event')||'',layer=query.get('layer')||'';
  const valid=choices(eventSelect).has(event)&&choices(layerSelect).has(layer);
  eventSelect.value=choices(eventSelect).has(event)?event:'';
  layerSelect.value=choices(layerSelect).has(layer)?layer:'';
  error.hidden=valid;
  error.textContent=valid?'':'That event or layer is not in this publication. Clear the filters to return to the published coverage.';
  let events=0,layers=0;
  for(const card of cards){
    card.hidden=!valid||Boolean(event&&card.dataset.event!==event);
    if(!card.hidden)events++;
    for(const section of card.querySelectorAll('.coverage-layer')){
      section.hidden=Boolean(layer&&section.dataset.layer!==layer);
      if(!card.hidden&&!section.hidden)layers++;
    }
  }
  status.textContent=valid?`${events} event${events===1?'':'s'} and ${layers} evidence layer${layers===1?'':'s'} shown.`:'';
}
form.addEventListener('submit',event=>{
  event.preventDefault();
  const url=new URL(location.href);
  for(const [key,value] of [['event',eventSelect.value],['layer',layerSelect.value]]){
    if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
  }
  history.pushState(null,'',url);
  apply();
});
window.addEventListener('popstate',apply);
apply();
