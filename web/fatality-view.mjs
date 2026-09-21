import {fatalityLabel} from './impact-model.mjs';

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

export function fillFatalityRecord(card, place) {
  card.replaceChildren();card.classList.add('fatality-record');
  card.append(make('p', `${fatalityLabel(place)} · Fatality record`, 'fatality-badge'),make('h4', place.title));
  const list=make('ul',null,'fatality-names');
  for(const name of place.people) list.append(make('li',name));
  if(place.people.length) card.append(list);
  if(place.people.length < place.deaths) card.append(make('p','Some names have not yet been verified for this location.'));
  card.append(make('p', place.label, 'place-kind'),make('p', place.account),
    make('p', place.precision_note, 'fineprint'),make('p', place.time_note, 'fineprint'));
  const source=make('a','Read the research account');source.href=place.source;source.target='_blank';source.rel='noopener noreferrer';
  const remembrance=make('a','Read the remembrance');remembrance.href='#remembrance';
  const links=make('div',null,'report-links');links.append(source,remembrance);card.append(links,make('p',place.source_locator,'fineprint'));
}
