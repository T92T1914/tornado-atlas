// Map coordinates, independent of screen size and input device.
export function constrainView(view, extent, minWidth = extent[2] / 16) {
  if (![...view, ...extent, minWidth].every(Number.isFinite) || view[2] <= 0
      || extent[2] <= 0 || extent[3] <= 0 || minWidth <= 0) throw new RangeError('Invalid map view');
  const width = Math.min(extent[2], Math.max(minWidth, view[2]));
  const height = width * extent[3] / extent[2];
  return [Math.max(extent[0], Math.min(extent[0] + extent[2] - width, view[0])),
    Math.max(extent[1], Math.min(extent[1] + extent[3] - height, view[1])), width, height];
}

export function zoomView(view, factor, anchor, extent, minWidth) {
  if (!Number.isFinite(factor) || factor <= 0 || !anchor.every(Number.isFinite)) throw new RangeError('Invalid map zoom');
  const width = constrainView([0, 0, view[2] * factor, view[3]], extent, minWidth)[2];
  const ratio = width / view[2];
  return constrainView([anchor[0] - (anchor[0] - view[0]) * ratio,
    anchor[1] - (anchor[1] - view[1]) * ratio, width, view[3] * ratio], extent, minWidth);
}

// Grabbed map coordinates follow the pointer. At the edge the map stays bounded.
export function panView(view, delta, extent, minWidth) {
  return constrainView([view[0] - delta[0], view[1] - delta[1], view[2], view[3]], extent, minWidth);
}

export function wheelFactor(delta, mode = 0, pageHeight = 600) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  return Math.exp(Math.max(-200, Math.min(200, pixels)) * .0025);
}
