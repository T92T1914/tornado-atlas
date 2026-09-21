// These accounts are independent of damage ratings and their photograph filters.
export function mountSurveyImpacts(places, svg, project, host, navigation) {
  const make=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
  const layer=document.createElementNS(svg.namespaceURI,'g');svg.append(layer);
  const controls=make('div',null,'impact-controls');
  const label=make('label'),enabled=make('input');enabled.type='checkbox';enabled.checked=true;enabled.id='survey-impacts';
  const symbol=make('span','◆','impact-symbol');symbol.setAttribute('aria-hidden','true');
  label.append(enabled,symbol,document.createTextNode('Show documented recovery locations linked to fatalities'));
  controls.append(label,make('p','These accounts are separate from the damage ratings. A recovery point does not establish an exact place of death.','fineprint'));
  const card=make('article',null,'impact-card');card.id='survey-impact-detail';card.hidden=true;card.setAttribute('aria-live','polite');
  function show(place) {
    enabled.checked=true;layer.removeAttribute('display');card.hidden=false;card.replaceChildren();
    card.append(make('p','FATALITIES / '+place.label.toUpperCase(),'eyebrow'),make('h4',place.title),
      make('p',place.people.join(', ')),make('p',place.account),make('p',place.precision_note,'fineprint'),make('p',place.time_note,'fineprint'));
    const source=make('a','Read the research account');source.href=place.source;source.target='_blank';source.rel='noopener noreferrer';
    const memorial=make('a','Read the remembrance');memorial.href='#remembrance';
    const links=make('div',null,'report-links');links.append(source,memorial);card.append(links);
    navigation.centerOn(project(place.coordinates));
  }
  for(const place of places) {
    const [x,y]=project(place.coordinates),mark=document.createElementNS(svg.namespaceURI,'path');
    mark.setAttribute('d',`M ${x} ${y-10} l 10 10 l -10 10 l -10 -10 Z`);mark.setAttribute('class','incident-marker');
    mark.dataset.mapSymbol=[x,y,10].join(',');
    const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=place.title+' / '+place.people.join(', ');mark.append(title);
    mark.addEventListener('click',()=>show(place));layer.append(mark);
    const button=make('button','◆ '+place.title);button.type='button';button.addEventListener('click',()=>show(place));controls.append(button);
  }
  enabled.addEventListener('change',()=>{layer.setAttribute('display',enabled.checked?'inline':'none');if(!enabled.checked)card.hidden=true;});
  controls.append(make('p','No verified injury locations have been added. The remembrance lists the other documented deaths without assigning unverified coordinates.','fineprint'));
  host.append(controls,card);
}
