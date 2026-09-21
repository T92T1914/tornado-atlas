// Fatalities are a human-impact category, never an EF damage rating.
export function fatalityLabel(place) {
  if (place.category !== 'fatalities' || !Number.isSafeInteger(place.deaths) || place.deaths < 1)
    throw new RangeError('Invalid fatality record');
  return `${place.deaths} ${place.deaths === 1 ? 'death' : 'deaths'}`;
}

function distanceKm(first, second) {
  const radians = value => value * Math.PI / 180;
  const [lon1, lat1] = first.map(radians), [lon2, lat2] = second.map(radians);
  const a = Math.sin((lat2-lat1)/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin((lon2-lon1)/2)**2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearbyFatalities(point, places, radiusKm = .25) {
  return places.filter(place => place.category === 'fatalities' && distanceKm(point.coordinates, place.coordinates) <= radiusKm);
}

// A spatial relationship does not identify the subject of a photograph.
export function nearbySurveyPhotos(place, points, photos, radiusKm = .25) {
  return points.filter(point => photos[String(point.id)]?.length)
    .map(point => ({point, distanceKm:distanceKm(place.coordinates, point.coordinates)}))
    .filter(item => item.distanceKm <= radiusKm)
    .sort((a,b) => a.distanceKm-b.distanceKm || a.point.id-b.point.id);
}

export function fatalityLink(url, id) {
  if(!/^[a-z][a-z0-9-]*$/.test(id)) throw new RangeError('Invalid fatality record id');
  const result=new URL(url,'https://example.invalid');
  for(const key of ['survey','surveyRating','surveySearch','surveyPhotos']) result.searchParams.delete(key);
  result.searchParams.set('fatality',id);result.hash='survey-explorer';return result.href;
}
