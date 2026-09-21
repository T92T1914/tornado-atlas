import {fatalityLabel, nearbySurveyPhotos} from './impact-model.mjs';
import {surveyPhotos} from './survey-photos.mjs';

const make = (tag, text, className) => {
  const el = document.createElement(tag); if(text) el.textContent = text;
  if(className) el.className = className; return el;
};

export function fatalityMarker(place, svg, project, open) {
  const [x,y] = project(place.coordinates), ns = svg.namespaceURI;
  const group = document.createElementNS(ns, 'g');
  const mark = document.createElementNS(ns, 'path');
  mark.setAttribute('d', `M ${x} ${y-10} l 10 10 l -10 10 l -10 -10 Z`);
  mark.setAttribute('class', 'incident-marker');mark.dataset.mapSymbol = [x,y,10].join(',');
  mark.setAttribute('tabindex', '0');mark.setAttribute('role', 'button');
  const description = `${place.title}: ${fatalityLabel(place)}. ${place.people.join(', ')}. ${place.label}.`;
  mark.setAttribute('aria-label', description);
  const title = document.createElementNS(ns, 'title');title.textContent = description;mark.append(title);
  mark.addEventListener('click', open);
  mark.addEventListener('keydown', event => {if(['Enter',' '].includes(event.key)){event.preventDefault();open();}});
  const label = document.createElementNS(ns, 'text');
  label.textContent = `${place.map_label} · ${fatalityLabel(place)}`;
  label.setAttribute('class', 'fatality-map-label');label.setAttribute('text-anchor', 'middle');
  label.dataset.mapLabel = [x,y].join(',');group.append(mark,label);return group;
}

export function fillFatalityRecord(card, place, photoContext) {
  card.replaceChildren();card.classList.add('fatality-record');
  card.append(make('p', `${fatalityLabel(place)} · Fatality record`, 'fatality-badge'),make('h4', place.title));
  const list=make('ul',null,'fatality-names');
  for(const name of place.people) list.append(make('li',name));
  if(place.people.length) card.append(list);
  if(place.people.length < place.deaths) card.append(make('p','Some names have not yet been verified for this location.'));
  card.append(make('p', place.label, 'place-kind'),make('p', place.account));
  if(photoContext) {
    const {points,media,openPhoto,lazy=false}=photoContext;
    const nearby=nearbySurveyPhotos(place,points,media.photos);
    const section=make('section',null,'fatality-photo-context');
    section.append(make('h5','Nearby survey photographs'));
    const context='Linked by location only. The survey does not identify the vehicle or its occupants, so this is not a confirmed photograph of the named fatality record.';
    if(nearby.length) {
      section.append(make('p',context,'fineprint'));
      for(const {point} of nearby) {
        const figure=make('figure');figure.append(surveyPhotos(point,media,openPhoto,{context,lazy}));
        const caption=make('figcaption',`NWS DAT ${point.id} · ${point.rating} · ${point.indicator}. Survey point within 250 meters of the documented location. `);
        const source=make('a','Open the original survey record');source.href=point.source_url;source.target='_blank';source.rel='noopener';
        caption.append(source);figure.append(caption);section.append(figure);
      }
      section.append(make('p','Source: NOAA/NWS Damage Assessment Toolkit. Photographer and capture time are not identified in the attachment metadata.','fineprint'));
    }else section.append(make('p','No photograph is linked to a survey point within 250 meters in this exhibit.','fineprint'));
    card.append(section);
  }
  card.append(make('p', place.precision_note, 'fineprint'),make('p', place.time_note, 'fineprint'));
  const source=make('a','Read the research account');source.href=place.source;source.target='_blank';source.rel='noopener noreferrer';
  const remembrance=make('a','Read the remembrance');remembrance.href='#remembrance';
  const links=make('div',null,'report-links');links.append(source,remembrance);card.append(links,make('p',place.source_locator,'fineprint'));
}
