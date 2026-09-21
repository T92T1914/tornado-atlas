import {fatalityMarker, fillFatalityRecord} from './fatality-view.mjs';

// Published locations stay fixed while the historical clock moves.
export function mountPlaces(places, svg, project) {
  const layer=document.createElementNS(svg.namespaceURI,'g');svg.append(layer);
  const enabled=document.getElementById('places-enabled'),status=document.getElementById('places-status');
  const update=()=>{
    layer.setAttribute('display',enabled.checked?'inline':'none');
    status.textContent=enabled.checked
      ? `${places.length} documented fatality record shown. A recovery location does not establish the exact place of death.`
      : 'Fatality locations are hidden. The sourced accounts remain available below.';
  };
  enabled.addEventListener('change',update);
  for(const place of places) {
    layer.append(fatalityMarker(place,svg,project,()=>{location.hash=place.id;}));
    const card=document.createElement('article');card.className='place-record';card.id=place.id;
    fillFatalityRecord(card,place);
    const show=document.createElement('a');show.textContent='Show this fatality record on the path map';show.href='#path';
    show.addEventListener('click',()=>{enabled.checked=true;update();});card.append(show);
    document.getElementById('documented-places').append(card);
  }
  update();
}
