import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,base} from './harness.mjs';

const data=JSON.parse(await readFile(new URL('../../web/data.json',import.meta.url),'utf8'));
const photos=data.damage.photos;
const pointFor=photo=>data.survey.points.find(point=>point.id===photo.survey_record.object_id);

async function ready(page){
  await page.goto(base+'/index.html');
  await page.locator('#survey-observation option').last().waitFor({state:'attached'});
  await page.locator('#damage-compare .damage-survey-link').first().waitFor();
  await page.waitForSelector('body[data-exhibit-ready="true"]',{state:'attached'});
}
async function selected(page,photo){
  const point=pointFor(photo);
  assert.equal(await page.locator('#survey-observation').inputValue(),String(point.id),'The gallery link selects its survey record');
  assert.equal(await page.locator('#survey-detail > .eyebrow').first().textContent(),`NWS DAT RECORD ${point.id} · ${point.rating}`);
  assert.equal(new URL(page.url()).searchParams.get('survey'),String(point.id),'The selection is shareable');
  assert.equal(await page.locator('#survey-map .survey-selected').getAttribute('visibility'),'visible','The surveyed point is marked on the map');
}

for(const [width,appearance] of [[390,'dark'],[1280,'light']]){
  test(`gallery photographs select their surveyed structures at ${width}px ${appearance}`,async t=>{
    const page=await fixture(t,{viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
    await ready(page);
    await page.locator('#reading-appearance').selectOption(appearance);
    const firstId=await page.locator('#damage-view-1').inputValue();
    const first=photos.find(photo=>photo.id===firstId);
    const panel=page.locator('#damage-compare .damage-panel').first();
    assert.match(await panel.locator('figcaption').textContent(),/not the camera/,'The link says its point is not the camera');
    const link=panel.locator('.damage-survey-link');
    const box=await link.boundingBox();
    assert.ok(box.height>=44,'The link keeps a usable target');
    assert.ok(box.x>=-1&&box.x+box.width<=width+1,'The link fits the viewport');
    // A search that hides the record must not block the link.
    await page.locator('#survey-search').fill('no-matching-observation');
    const before=await page.evaluate(()=>history.length);
    if(width<600)await link.tap();else await link.click();
    await selected(page,first);
    assert.equal(await page.locator('#survey-search').inputValue(),'','A filter that hid the record is cleared');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'survey-observation','Focus moves to the selected observation');
    assert.equal(await page.evaluate(()=>history.length),before+1,'One gallery choice adds one history entry');
    const top=await page.locator('.survey-workspace').evaluate(node=>node.getBoundingClientRect().top);
    assert.ok(top>=-2&&top<844,'The map and inspector are brought into view');
    await page.goBack();
    assert.equal(await page.locator('#survey-search').inputValue(),'no-matching-observation','Back restores the earlier survey state');
    await page.goForward();
    await selected(page,first);
    await page.reload();
    await page.locator('#survey-observation option').last().waitFor({state:'attached'});
    await selected(page,first);
  });
}

test('every browse card links the matched survey record',async t=>{
  const page=await fixture(t,{viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await ready(page);
  await page.locator('.damage-browse summary').click();
  const links=page.locator('#damage-photos .damage-survey-link');
  assert.equal(await links.count(),photos.length);
  assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.surveyRecord))),
    photos.map(photo=>photo.survey_record.object_id));
  for(const [index,photo] of photos.entries()){
    const href=new URL(await links.nth(index).getAttribute('href'));
    assert.equal(href.searchParams.get('survey'),String(photo.survey_record.object_id),'A new tab opens the same record');
    assert.equal(href.hash,'#survey-explorer');
  }
  const last=photos.at(-1);
  await links.last().click();
  await selected(page,last);
});
