import {fatalityMarker, fillFatalityRecord} from './fatality-view.mjs';

// Published locations stay fixed while the historical clock moves.
export function mountPlaces(places, svg, project, photoContext) {
  const layer=document.createElementNS(svg.namespaceURI,'g');layer.id='map-recovery-context';svg.append(layer);
  const enabled=document.getElementById('places-enabled'),status=document.getElementById('places-status');
  const legend=document.getElementById('playback-remembrance-legend');
  const update=()=>{
    layer.setAttribute('display',enabled.checked?'inline':'none');
    legend.hidden=!enabled.checked;
    status.textContent=enabled.checked
      ? `${places.length} reviewed recovery record shown, independent of the selected time. This does not mark a death at the playback time or establish the exact place of death.`
      : 'Recovery context is off. The damage map and remembrance retain the location account.';
  };
  enabled.addEventListener('change',update);
  for(const place of places) {
    layer.append(fatalityMarker(place,svg,project,()=>{location.hash=place.id;}));
    const card=document.createElement('article');card.className='place-record';card.id=place.id;
    fillFatalityRecord(card,place,photoContext);
    const show=document.createElement('a');show.textContent='Show this fatality record on the path map';show.href='#path';
    show.addEventListener('click',()=>{enabled.checked=true;update();});card.append(show);
    document.getElementById('documented-places').append(card);
  }
  update();
}
