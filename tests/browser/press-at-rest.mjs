import assert from 'node:assert/strict';

// The site scrolls smoothly (`html {scroll-behavior:smooth}` in
// web/style.css). The documentary pages turn that off from 1081 px up, and the
// dossier page never does. Playwright 1.63.0 reveals an element that is out of
// view by scrolling to it. Its first attempt asks the browser to scroll and
// reads the element's place at once. When that scroll is animated the element
// is still outside the viewport, so Playwright tries again, and three of every
// four later attempts scroll with a plain `scrollIntoView`, which the page
// animates as well. A press can then go out while the page is moving. When the
// element leaves the pointer between down and up, the click goes to whatever
// surrounds it and nothing happens. Playwright checks its target only at the
// first event of a press, so it reports that press as done. The WebKit logs of
// CI fit this. A press on a link that is out of view takes about 900 ms where
// the page scrolls smoothly and about 30 ms where it does not.
//
// pressAtRest takes the scroll out of the press. It centers the element with
// an instant scroll, and again if late content pushes it out, waits until its
// whole box has stayed inside the viewport without moving for three frames,
// and only then presses. The press is Playwright's ordinary trusted click, and
// the helper adds no retry of its own. If the element moves again before the
// pointer goes down, Playwright's attempts scroll as before, and the read
// after the press is what catches a miss. A click that lands outside the
// element and leaves the document in place fails here, at the press, and names
// what it landed on. A press that replaces the document takes the note with
// it, and the caller's own wait judges where it went.
//
// The whole box has to fit inside the viewport, so this is for links and
// controls, not for anything taller or wider than the screen. `timeout` bounds
// the wait for rest and the press, each on its own, and 0 means no limit.
const STILL_FRAMES = 3;

export async function pressAtRest(locator, {timeout = 10000} = {}) {
  const page = locator.page();
  await locator.evaluate((node, {timeout, frames}) => new Promise((resolve, reject) => {
    const center = () => node.scrollIntoView({behavior: 'instant', block: 'center', inline: 'nearest'});
    const name = target => {
      if (!(target instanceof Element)) return 'the document';
      const own = target.id ? '#' + target.id : target.localName;
      const around = target.parentElement?.closest('[id]');
      return (around ? own + ' inside #' + around.id : own).slice(0, 160);
    };
    let last = null, still = 0, over = false;
    // A timer ends the wait even on a page that has stopped producing frames.
    const timer = timeout > 0 ? setTimeout(() => {
      over = true;
      reject(Error('The element did not come to rest inside the viewport within ' + timeout + ' ms'));
    }, timeout) : null;
    const frame = () => {
      if (over) return;
      const box = node.getBoundingClientRect();
      const inside = box.width > 0 && box.height > 0 && box.top >= 0 && box.left >= 0 &&
        box.bottom <= innerHeight && box.right <= innerWidth;
      still = inside && last && box.top === last.top && box.left === last.left &&
        box.width === last.width && box.height === last.height ? still + 1 : 0;
      last = inside ? {top: box.top, left: box.left, width: box.width, height: box.height} : null;
      if (still >= frames) {
        over = true;
        clearTimeout(timer);
        // The note lives in this document. A press that replaces the document
        // takes it away with the page.
        const note = window.atlasPressAtRest = {state: 'armed', target: null, point: null};
        addEventListener('click', event => {
          note.state = event.target instanceof Node && node.contains(event.target) ? 'landed' : 'missed';
          note.target = name(event.target);
          note.point = [Math.round(event.clientX), Math.round(event.clientY)];
        }, {capture: true, once: true});
        resolve();
        return;
      }
      // Content that loads late can push the element out again.
      if (!inside) center();
      requestAnimationFrame(frame);
    };
    center();
    requestAnimationFrame(frame);
  }), {timeout, frames: STILL_FRAMES}, {timeout});
  await locator.click({timeout});
  let note;
  try {
    note = await page.evaluate(() => window.atlasPressAtRest ?? null);
  } catch (error) {
    // A document replaced during the read means the press navigated. A page
    // that has closed is a different failure and keeps its own error.
    if (page.isClosed()) throw error;
    return;
  }
  if (note === null || note.state === 'landed') return;
  assert.fail(note.state === 'missed'
    ? 'The press landed on ' + note.target + ' at ' + note.point.join(',') + ', not on the element it began on'
    : 'The press produced no click in the page');
}
