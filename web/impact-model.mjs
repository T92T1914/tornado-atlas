// Fatalities are a human-impact category, never an EF damage rating.
export function fatalityLabel(place) {
  if (place.category !== 'fatalities' || !Number.isSafeInteger(place.deaths) || place.deaths < 1)
    throw new RangeError('Invalid fatality record');
  return `${place.deaths} ${place.deaths === 1 ? 'death' : 'deaths'}`;
}

export function nearbyFatalities(point, places, radiusKm = .25) {
  const radians = value => value * Math.PI / 180;
  return places.filter(place => {
    if(place.category !== 'fatalities') return false;
    const [lon1, lat1] = point.coordinates.map(radians), [lon2, lat2] = place.coordinates.map(radians);
    const a = Math.sin((lat2-lat1)/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin((lon2-lon1)/2)**2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) <= radiusKm;
  });
}

export function fatalityLink(url, id) {
  if(!/^[a-z][a-z0-9-]*$/.test(id)) throw new RangeError('Invalid fatality record id');
  const result=new URL(url,'https://example.invalid');
  for(const key of ['survey','surveyRating','surveySearch','surveyPhotos']) result.searchParams.delete(key);
  result.searchParams.set('fatality',id);result.hash='survey-explorer';return result.href;
}
