export function damageExplanation(indicator,degree,rating) {
  const box=document.createElement('details');box.className='damage-explanation';
  const title=document.createElement('summary');title.textContent='What this assessment means';box.append(title);
  const add=(label,text)=>{const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+' ';p.append(strong,document.createTextNode(text));box.append(p);};
  add('The surveyed subject:',indicator+'. This is the source description, not an independently identified property.');
  add('What failed:',degree+'. This is the recorded damage description; the photograph alone does not establish the sequence of failure.');
  add('The assessment:',rating==='N/A'||rating==='Not recorded'?'No EF rating is supplied for this record. An unclassified vehicle or object is not automatically a standard damage indicator.':rating+' is the source assessment at this feature. It is not a measured wind speed at the camera or the rating of every nearby location.');
  add('What it cannot tell us:','Construction quality, connections, prior condition and surrounding exposure affect what a structure can withstand. The available image does not supply all of those details or the exact moment of impact.');
  const a=document.createElement('a');a.href='https://www.weather.gov/oun/efscale';a.textContent='How NWS evaluates damage indicators and degrees of damage';a.target='_blank';a.rel='noopener';box.append(a);return box;
}
