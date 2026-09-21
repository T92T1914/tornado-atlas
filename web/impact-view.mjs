import {fatalityLabel} from './impact-model.mjs';
import {fatalityMarker} from './fatality-view.mjs';

// Human-impact records remain independent of EF and photo filters.
export function mountSurveyImpacts(places, svg, project, host, navigation, onOpen) {
  const make=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
  const layer=document.createElementNS(svg.namespaceURI,'g');svg.append(layer);
  const controls=make('div',null,'impact-controls');
  controls.append(make('h4','Fatalities and remembrance'));
  const label=make('label'),enabled=make('input');enabled.type='checkbox';enabled.checked=true;enabled.id='survey-impacts';
  const symbol=make('span','◆','impact-symbol');symbol.setAttribute('aria-hidden','true');
  label.append(enabled,symbol,document.createTextNode('Show fatality locations'));controls.append(label);
  function show(place) {
    enabled.checked=true;layer.removeAttribute('display');onOpen(place);
    navigation.centerOn(project(place.coordinates));
  }
  for(const place of places) {
    layer.append(fatalityMarker(place,svg,project,()=>show(place)));
    const button=make('button',`◆ ${place.title} · ${fatalityLabel(place)}`);button.type='button';
    button.addEventListener('click',()=>show(place));controls.append(button);
  }
  enabled.addEventListener('change',()=>layer.setAttribute('display',enabled.checked?'inline':'none'));
  controls.append(make('p','Rose diamonds identify documented fatality records. A recovery point is not an exact place of death. These records stay separate from EF ratings and photograph filters.','fineprint'));
  const coverage=make('div');coverage.setAttribute('data-remembrance-coverage','');controls.append(coverage);
  host.prepend(controls);
  return {show};
}
