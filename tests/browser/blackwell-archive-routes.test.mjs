import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fixture, base} from './harness.mjs';
import {waitForDossier} from './dossier-readiness.mjs';

const gallery = 'https://legacy-westhist.libraries.ou.edu/locations/docs/westhist/flora/tornado.html';
const chapter = () => base + '/blackwell.html#archive-prints';
const items = [
  {number:'62',source:'ou-flora62-railroad-yard',preview:'ou-flora62-online-preview',width:193,bytes:12287,
    sha256:'2efceead19ccb34602b5a09cda35654628c4ee9997045c3977b3184f2343c132',
    account:/parallel lines resembling tracks/,limits:/individual rail cars/},
  {number:'67',source:'ou-flora67-fire-response',preview:'ou-flora67-online-preview',width:192,bytes:13662,
    sha256:'33840aa0f924edd5e7db9d287d902a1db1d4898e5ae78c1b9d4bb2a1e02bd094',
    account:/Several figures appear among tangled structural material/,limits:/identities, gender, precise actions/},
];
const observationHref = id => 'dossier.html?event=blackwell-1955&observation=' + id + '#observation-' + id;
const expectedTime = {
  event:{reported:'May 25, 1955, as associated by the archive caption',precision:'caption event date, not a capture clock'},
  capture:null,publication:null,retrieval:'2026-10-10',video:null,alignment:null,
};
const expectedPlace = {
  role:'archive_caption_context',reported:'Blackwell, Oklahoma, as associated by the archive caption',coordinates:null,
  basis:'Institutional caption association only. No location is registered from the inspected online version.',
};

async function openDetail(page, card, label) {
  const detail = card.locator('details').filter({hasText:label});
  assert.equal(await detail.count(),1);
  const summary=detail.locator('summary');
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await detail.evaluate(node=>node.open),true);
  return JSON.parse(await detail.locator('pre').textContent());
}

async function checkSource(page,item,target) {
  await waitForDossier(page,target);
  const url=new URL(page.url());
  assert.equal(url.searchParams.get('event'),'blackwell-1955');
  assert.equal(url.searchParams.get('source'),item.source);
  const source=page.locator('#source-'+item.source);
  assert.match(await source.textContent(),/Photographer and copyright holder unknown/);
  assert.match(await source.textContent(),/Complete image pixels were not visually inspected during that caption qualification/);
  assert.match(await source.textContent(),/October 6, 2026/);
  assert.match(await source.textContent(),/On October 10, 2026/);
  assert.match(await source.textContent(),/Complete original-print coverage remains unknown/);
  const original=source.locator('a').first();
  assert.equal(await original.getAttribute('href'),gallery);
  assert.equal(await original.getAttribute('target'),'_blank');
  assert.equal(await original.getAttribute('rel'),'noopener noreferrer');
  assert.equal(await page.locator('#observation-'+item.source+'-caption').count(),1);
  assert.equal(await page.locator('#observation-'+item.preview).count(),1);
}

async function returnToChapter(page) {
  await page.locator('a[href="'+chapter()+'"]').click();
  assert.equal(page.url(),chapter());
  await page.locator('#archive-prints').waitFor({state:'visible'});
}

for (const [width, appearance] of [[320, 'dark'], [1280, 'light']]) {
  test('Blackwell archive routes: '+width+'px '+appearance+', separate captions and inspected versions with native history', async t => {
    const page = await fixture(t, {viewport: {width, height: 844}, hasTouch: width < 600, isMobile: width < 600});
    const requests = []; page.on('request', request => requests.push(request.url()));
    await page.goto(chapter());
    await page.locator('#reading-appearance').selectOption(appearance);
    assert.equal(await page.locator('#archive-prints img, #archive-prints iframe').count(), 0);
    assert.match(await page.locator('#archive-prints').textContent(), /collector, not the photographer/);
    assert.match(await page.locator('#archive-prints').textContent(), /October 10, 2026/);
    assert.match(await page.locator('#archive-prints').textContent(), /original prints have not been inspected/);
    for (const item of items) {
      const listItem=page.locator('#archive-flora'+item.number);
      assert.equal(await listItem.locator('.archive-original').getAttribute('href'), gallery);
      const version=gallery.replace('tornado.html','images/flora'+item.number+'.jpg');
      assert.equal(await listItem.locator('.archive-online-version').getAttribute('href'),version);
      const captionId=item.source+'-caption';
      const captionHref=observationHref(captionId);
      const caption=listItem.locator('a[href="'+captionHref+'"]');
      assert.equal(await caption.count(),1);
      const captionTarget={href:base+'/'+captionHref,elementId:'observation-'+captionId};
      await caption.focus();await page.keyboard.press('Enter');
      await waitForDossier(page,captionTarget);
      const captionCard=page.locator('#observation-'+captionId);
      assert.match(await captionCard.textContent(),/not an independent visual description/);
      assert.equal(await page.locator('#observation-'+item.preview).count(),0);
      const captionTime=await openDetail(page,captionCard,'Clock roles and registration');
      assert.equal(captionTime.retrieval,'2026-10-06');
      for(const key of ['capture','publication','video','alignment'])assert.equal(captionTime[key],null);
      const captionSource=captionCard.locator('a').first();
      const sourceTarget={href:await captionSource.evaluate(link=>link.href),elementId:'source-'+item.source};
      await captionSource.click();await checkSource(page,item,sourceTarget);
      await page.goBack();await waitForDossier(page,captionTarget);
      await returnToChapter(page);

      const previewHref=observationHref(item.preview);
      const preview=page.locator('#archive-flora'+item.number+' a[href="'+previewHref+'"]');
      assert.equal(await preview.count(),1);
      const previewTarget={href:base+'/'+previewHref,elementId:'observation-'+item.preview};
      await preview.focus();await page.keyboard.press('Enter');
      await waitForDossier(page,previewTarget);
      const card=page.locator('#observation-'+item.preview);
      const text=await card.textContent();
      assert.match(text,item.account);assert.match(text,item.limits);
      assert.match(text,/complete original-print coverage remains unknown/);
      assert.match(text,/Image hosting and derivative permission are not established/);
      for(const value of ['published','observed sample','unregistered','reviewed available','links only']) {
        assert.ok((await card.locator('dd').allTextContents()).includes(value),value);
      }
      for(const value of [version,item.width+' by 150',item.bytes+' bytes',item.sha256])assert.ok(text.includes(value),value);
      assert.equal(await card.locator('img, iframe, video, picture, source').count(),0);
      assert.equal(await page.locator('#observation-'+captionId).count(),0);
      assert.deepEqual(await openDetail(page,card,'Clock roles and registration'),expectedTime);
      assert.deepEqual(await openDetail(page,card,'Place and its limits'),expectedPlace);
      await page.goBack();
      assert.equal(page.url(),chapter());
      await page.locator('#archive-prints').waitFor({state:'visible'});
      await page.goForward();await waitForDossier(page,previewTarget);
      await page.reload();await waitForDossier(page,previewTarget);
      assert.match(await page.locator('#observation-'+item.preview).textContent(),item.account);
      const previewSource=page.locator('#observation-'+item.preview+' a').first();
      const previewSourceTarget={href:await previewSource.evaluate(link=>link.href),elementId:'source-'+item.source};
      assert.equal(new URL(previewSourceTarget.href).searchParams.get('source'),item.source);
      await previewSource.click();await checkSource(page,item,previewSourceTarget);
      await returnToChapter(page);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(requests.some(url => !url.startsWith(base + '/')), false);
    if (process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR, 'blackwell-archive-'+width+'-'+appearance+'.png')});
  });
}

test('Blackwell original archive context remains useful without scripts at enlarged text', async t => {
  const page = await fixture(t, {javaScriptEnabled: false, viewport: {width: 568, height: 320}});
  await page.goto(chapter());
  assert.equal(await page.locator('#archive-prints li').count(), 2);
  assert.equal(await page.locator('#archive-prints .archive-original').count(), 2);
  assert.equal(await page.locator('#archive-prints .archive-online-version').count(), 2);
  assert.equal(await page.locator('#archive-prints .archive-preview-evidence').count(), 2);
  for(const item of items) {
    const listItem=page.locator('#archive-flora'+item.number);
    assert.equal(await listItem.locator('a[href="'+observationHref(item.source+'-caption')+'"]').count(),1);
    assert.equal(await listItem.locator('a[href="'+observationHref(item.preview)+'"]').count(),1);
    assert.equal(await listItem.locator('.archive-online-version').getAttribute('href'),
      gallery.replace('tornado.html','images/flora'+item.number+'.jpg'));
  }
  assert.match(await page.locator('#archive-prints').textContent(), /FLORA58 captions are excluded/);
  assert.match(await page.locator('#archive-prints').textContent(), /does not establish the fire/);
  assert.match(await page.locator('#archive-prints').textContent(), /October 10, 2026/);
  assert.match(await page.locator('#archive-prints').textContent(), /Complete original-print coverage/);
  assert.equal(await page.locator('#archive-prints img, #archive-prints iframe').count(), 0);
  await page.locator('p,li,h2,h3,a').evaluateAll(nodes => {
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
    nodes.forEach((node, index) => node.style.setProperty('font-size', sizes[index] * 2+'px', 'important'));
    if (!nodes.every((node, index) => Math.abs(parseFloat(getComputedStyle(node).fontSize) - sizes[index] * 2) < 0.1)) {
      throw new Error('Selected text did not reach twice its computed baseline');
    }
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (process.env.ATLAS_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.ATLAS_SCREENSHOT_DIR, 'blackwell-archive-enlarged-no-script.png')});
});
