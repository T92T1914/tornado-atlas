// Only these reviewed article PNG/JPEG paths replace the original image ban.
// GIF radar and unrelated requests retain the existing predicate's treatment.
export const TUSCALOOSA_REVIEWED_IMAGES=Object.freeze([
  '/assets/tuscaloosa-birmingham-2011/goes-storm-april27.png',
  '/assets/tuscaloosa-birmingham-2011/eo1-track-may2.jpg',
  '/assets/tuscaloosa-birmingham-2011/birmingham-aftermath-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/apartment-complex-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/railway-bridge-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/train-cars-april29.jpg',
  '/assets/tuscaloosa-birmingham-2011/aerial-context-april29.jpg',
]);

export function tuscaloosaRequestForbidden(url,base) {
  return /youtube|catalogue\/index/.test(url) ||
    (/\.(?:png|jpe?g)/i.test(url)&&
      !TUSCALOOSA_REVIEWED_IMAGES.some(path=>url===base+path));
}
