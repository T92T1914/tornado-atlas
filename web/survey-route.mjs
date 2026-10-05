// Spatial browsing of a published center line. No impact clock is inferred.
export function surveyRoute(points, geometry) {
  const paths = geometry.features.filter(f => f.geometry.type === 'LineString' &&
    f.properties?.role === 'published_center_path');
  if (paths.length !== 1) return null;
  const line = paths[0].geometry.coordinates;
  if (line.length < 2 || !line.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return null;
  const latitude = line.reduce((sum, p) => sum + p[1], 0) / line.length;
  const origin = line[0];
  const km = p => [(p[0] - origin[0]) * 111.195 * Math.cos(latitude * Math.PI / 180),
    (p[1] - origin[1]) * 111.195];
  const vertices = line.map(km), segments = [];
  let length = 0;
  for (let i = 1; i < vertices.length; i++) {
    const start = vertices[i - 1], delta = vertices[i].map((v, axis) => v - start[axis]);
    const size = Math.hypot(...delta);
    if (size > 0) segments.push({start, delta, size, distance: length});
    length += size;
  }
  if (!segments.length) return null;
  const positions = new Map();
  for (const point of points) {
    const xy = km(point.coordinates);
    let nearest = null;
    for (const segment of segments) {
      const relative = xy.map((v, axis) => v - segment.start[axis]);
      const fraction = Math.max(0, Math.min(1,
        (relative[0] * segment.delta[0] + relative[1] * segment.delta[1]) / segment.size ** 2));
      const offset = Math.hypot(...relative.map((v, axis) => v - fraction * segment.delta[axis]));
      // Ties retain the earlier stored segment, including where the line loops.
      if (nearest === null || offset < nearest.offsetKm) nearest = {
        alongKm: segment.distance + fraction * segment.size, offsetKm: offset,
      };
    }
    positions.set(point.id, nearest);
  }
  return {positions, lengthKm: length, source: paths[0].properties};
}

export function orderSurvey(points, route, order = 'records') {
  if (order !== 'path' || !route) return points;
  return [...points].sort((a, b) => route.positions.get(a.id).alongKm - route.positions.get(b.id).alongKm || a.id - b.id);
}
