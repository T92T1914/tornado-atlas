import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

export function assertNoScriptImage(snapshot, expected) {
  assert.equal(snapshot.connected, true, 'Photograph must remain connected');
  assert.equal(snapshot.source, expected.source, 'Expected full photograph source required');
  assert.equal(snapshot.complete, true, 'Photograph request must be complete');
  assert.equal(snapshot.width, expected.width, 'Expected natural photograph width required');
  assert.equal(snapshot.height, expected.height, 'Expected natural photograph height required');
  assert.equal(snapshot.visible, true, 'Photograph must occupy a visible viewport region');
  assert.equal(snapshot.opaque, true, 'These retained JPEG photographs must have opaque sampled pixels');
  assert.ok(snapshot.colors > 1, 'Expected nonblank photograph bitmap required');
}

// Page JavaScript is disabled in these two journeys. A returned decode promise
// is a separate asynchronous contract, so inspect the loaded bitmap synchronously.
// This establishes usable pixels, not DOM paint. The existing screenshot option
// retains the actual image region for that separate visual check.
export async function noScriptImage(image, expected, screenshotPath) {
  const deadline = performance.now() + 10000;
  let last, timer, stopped = false;
  const operation = (async () => {
  while (!stopped && performance.now() < deadline) {
    last = await image.evaluate(image => {
      const rect = image.getBoundingClientRect();
      let visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
        rect.top < innerHeight && rect.left < innerWidth;
      for (let node = image; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        visible &&= style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0;
      }
      const snapshot = {connected:image.isConnected, complete:image.complete,
        width:image.naturalWidth, height:image.naturalHeight, source:image.currentSrc || image.src,
        visible, opaque:false, colors:0};
      if (snapshot.connected && snapshot.complete && snapshot.width > 0 && snapshot.height > 0) {
        const canvas = document.createElement('canvas');canvas.width = 8;canvas.height = 8;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, 8, 8);
        const pixels = context.getImageData(0, 0, 8, 8).data, colors = new Set();
        snapshot.opaque = true;
        for (let index = 0; index < pixels.length; index += 4) {
          snapshot.opaque &&= pixels[index + 3] === 255;
          colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
        }
        snapshot.colors = colors.size;
      }
      return snapshot;
    }, undefined, {timeout:Math.max(1, deadline - performance.now())});
    if (stopped || performance.now() >= deadline)
      throw new Error('Expected no-script photograph exceeded its 10000ms bound: ' + JSON.stringify(last));
    // A lazy image can initially be complete with no loaded bitmap. Keep its
    // original bound. Once pixels exist, reject a wrong/blank image immediately.
    if ((last.complete && last.width > 0) || !last.connected || last.source !== expected.source) {
      assertNoScriptImage(last, expected);
      if (screenshotPath) await image.screenshot({path:screenshotPath,
        timeout:Math.max(1, deadline - performance.now())});
      if (stopped || performance.now() >= deadline)
        throw new Error('Expected no-script photograph capture exceeded its 10000ms bound');
      return last;
    }
    const remaining = deadline - performance.now();
    if (remaining > 0) await delay(Math.min(25, remaining));
  }
  throw new Error('Expected no-script photograph did not load within 10000ms: ' + JSON.stringify(last));
  })();
  try {
    return await Promise.race([operation,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Expected no-script photograph exceeded its 10000ms bound: ' +
        JSON.stringify(last))),Math.max(1,deadline-performance.now()));
    })]);
  } finally {stopped=true;clearTimeout(timer);}
}
