"""Keep original-source qualification distinct from reconstruction and reuse."""
import copy
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossiers

ROOT = Path(__file__).resolve().parents[1]
ACCEPTED = {
    'el-reno-2013': '19fa9fdc033ea7fd86166db3747c6a6c2556eda86aa0c8e14a714f8a6ce116d4',
    'blackwell-1955': '11debc7ee3155b03ad7bed784b7e5de94b17895aa1d17b4e6727f3461fd9362c',
    'joplin-2011': '68dca24097277ba2afb70a2430ed89cda500cd4e833c804347b2dee2e4ebe326',
    'tuscaloosa-birmingham-2011': '63b08e0460f38874aeb9f56825860abb768886cb6eea408e5415e9215bcc4a64',
}
SCAN = 'https://www.govinfo.gov/content/pkg/GOVPUB-I-4777581ea2c4a034cd4eb4b914c8e576/pdf/GOVPUB-I-4777581ea2c4a034cd4eb4b914c8e576.pdf#page=166'
COY = 'https://caps.ou.edu/reu/reu15/finalpapers/Coy-finalpaper.pdf#page=6'
EL_RENO_QUALIFIED = 'a1f75223cbe5f4d86d659e9f22b6b1bb10690789ebb8764e0fb1616ae1d80f99'


def accepted(event):
    sha = ACCEPTED[event]
    doc = json.loads((ROOT / 'web/archive' / (event + '-' + sha[:20] + '.json')).read_bytes())
    if digest(doc) != sha:
        raise ValueError('Changed accepted source-qualification predecessor')
    return doc


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = []
        self.media = []

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == 'a':
            self.links.append(attributes.get('href', ''))
        if attributes.get('id'):
            self.ids.append(attributes['id'])
        if tag in ('img', 'iframe', 'video', 'source'):
            self.media.append(attributes)


class QualifiedSourcePreservation(unittest.TestCase):
    def setUp(self):
        self.docs = {doc['id']: doc for doc in dossiers(ROOT)}

    def test_current_dossiers_change_only_the_independently_reviewed_scope(self):
        for event in ACCEPTED:
            with self.subTest(event=event):
                before = accepted(event)
                after = copy.deepcopy(self.docs[event])
                if event == 'el-reno-2013':
                    # Keep the completed source-qualification decision frozen.
                    # Later documentary increments have their own preservation controls.
                    after = json.loads((ROOT / 'web/archive' / (
                        event + '-' + EL_RENO_QUALIFIED[:20] + '.json')).read_bytes())
                    self.assertEqual(digest(after), EL_RENO_QUALIFIED)
                if event == 'tuscaloosa-birmingham-2011':
                    # The community extension has its own exact-delta controls.
                    # Retain this earlier source contract across that addition.
                    self.assertEqual([row['id'] for row in after['sources'][len(before['sources']):]], [
                        'tuscaloosa-county-recovery-plans', 'tuscaloosa-city-recovery-area',
                        'tuscaloosa-city-memorial-places', 'tuscaloosa-2021-anniversary-announcement'])
                    self.assertEqual([row['id'] for row in after['observations'][len(before['observations']):]], [
                        'community-recovery-plans', 'recovery-area-boundary',
                        'community-memorial-places', 'anniversary-observance-clock'])
                    self.assertEqual(after['routes'][len(before['routes']):], [
                        {'label': 'Read recovery planning and local remembrance',
                         'href': 'tuscaloosa.html#recovery-and-remembrance'}])
                    for field in ('sources', 'observations', 'routes'):
                        after[field] = after[field][:len(before[field])]
                    intermediate_sha = 'f880ae503c3cb6ef1ebefec27a81f1d9f558abeb9b11eeea8dd59e3962371297'
                    intermediate = json.loads((ROOT / 'web/archive' / (
                        event + '-' + intermediate_sha[:20] + '.json')).read_bytes())
                    self.assertEqual(digest(intermediate), intermediate_sha)
                    self.assertEqual(intermediate['provenance']['publication_review']['previous_dossier_sha256'], ACCEPTED[event])
                    self.assertEqual(after['provenance']['publication_review']['previous_dossier_sha256'], intermediate_sha)
                    after['provenance']['publication_review'] = before['provenance']['publication_review']
                if event == 'blackwell-1955':
                    old_source = next(row for row in before['sources'] if row['id'] == 'interior-blackwell-power-study-fy1955')
                    new_source = next(row for row in after['sources'] if row['id'] == old_source['id'])
                    self.assertEqual({key for key in new_source if new_source[key] != old_source[key]},
                                     {'url', 'locator', 'access', 'revision', 'agent_processing'})
                    self.assertTrue(new_source['revision'].startswith(old_source['revision']))
                    for field in ('url', 'locator', 'access', 'revision', 'agent_processing'):
                        new_source[field] = old_source[field]
                    old_observation = next(row for row in before['observations'] if row['id'] == 'interior-blackwell-electric-distribution-study')
                    new_observation = next(row for row in after['observations'] if row['id'] == old_observation['id'])
                    self.assertEqual({key for key in new_observation if new_observation[key] != old_observation[key]},
                                     {'locator', 'limits', 'review'})
                    for field in ('locator', 'limits', 'review'):
                        new_observation[field] = old_observation[field]
                if event == 'el-reno-2013':
                    self.assertEqual([row['id'] for row in after['sources'][len(before['sources']):]],
                                     ['coy-calhoun-lightning-video-2015'])
                    self.assertEqual([row['id'] for row in after['observations'][len(before['observations']):]],
                                     ['coy-calhoun-detection-versus-video'])
                    self.assertEqual(after['routes'][len(before['routes']):], [{
                        'label': 'Read the lightning detection and video comparison',
                        'href': 'index.html#lightning-reports-and-video'}])
                    for field in ('sources', 'observations', 'routes'):
                        after[field] = after[field][:len(before[field])]
                if event in ('el-reno-2013', 'blackwell-1955'):
                    expected_previous = 'c1d7a06952f561ed0c35dea360e9253347b5b5fb22d76ecae8592b59e80fd70d' if event == 'blackwell-1955' else ACCEPTED[event]
                    self.assertEqual(after['provenance']['publication_review']['previous_dossier_sha256'], expected_previous)
                    if event == 'blackwell-1955':
                        intermediate = json.loads((ROOT / 'web/archive/blackwell-1955-c1d7a06952f561ed0c35.json').read_bytes())
                        self.assertEqual(digest(intermediate), expected_previous)
                        self.assertEqual(intermediate['provenance']['publication_review']['previous_dossier_sha256'], ACCEPTED[event])
                    after['provenance']['publication_review'] = before['provenance']['publication_review']
                # This comparison includes every older observation, source, media,
                # creator, reconstruction limit and route, including Nolte's grants.
                self.assertEqual(digest(after), digest(before))

    def test_scan_qualification_retains_both_editions_and_unknown_repair_quantities(self):
        doc = self.docs['blackwell-1955']
        source = next(row for row in doc['sources'] if row['id'] == 'interior-blackwell-power-study-fy1955')
        obs = next(row for row in doc['observations'] if row['id'] == 'interior-blackwell-electric-distribution-study')
        self.assertEqual(source['url'], SCAN)
        self.assertIn(next(row for row in accepted('blackwell-1955')['sources'] if row['id'] == source['id'])['url'], source['locator'])
        self.assertIn(SCAN, source['locator'])
        for identity in ('d8c64dc077c7b8ce9a83c0ada5309e6d870d4f52c477b26be7bf7f20241260ed',
                         '5a9ecfa9dbec58097aa2be7b7fb5a70dcc8b3fc7cf83b727971a659d5d461cdd'):
            self.assertIn(identity, source['revision'])
        for unknown in ('resulting estimate', 'outage duration', 'repair-completion date', 'exact study date'):
            self.assertIn(unknown.lower(), obs['limits'].lower())
        self.assertEqual(obs['time'], next(row for row in accepted('blackwell-1955')['observations'] if row['id'] == obs['id'])['time'])
        self.assertIsNone(obs['time']['alignment'])
        self.assertIsNone(obs['place']['coordinates'])

    def test_lightning_cases_are_source_labels_without_registration_or_reproduction(self):
        doc = self.docs['el-reno-2013']
        source = next(row for row in doc['sources'] if row['id'] == 'coy-calhoun-lightning-video-2015')
        obs = next(row for row in doc['observations'] if row['id'] == 'coy-calhoun-detection-versus-video')
        self.assertEqual(source['url'], COY)
        self.assertIn('470a74bfff08fae68655712289d193a6d01a6ccbcd74918be012ea1c6e08de90', source['revision'])
        self.assertIn('not asserted here to be peer reviewed', source['revision'])
        self.assertIn('lower Figure 9', source['locator'])
        self.assertIn('Figure 10', source['locator'])
        for token in ('22:59:06', '23:13:30', 'not video confirmed'):
            self.assertIn(token, obs['account'])
        self.assertEqual(obs['status'], {
            'intake': 'published', 'assertion': 'source_reported', 'temporal': 'source_label',
            'spatial': 'unregistered', 'availability': 'reviewed_available', 'rights': 'links_only'})
        self.assertIsNone(obs['time']['alignment'])
        self.assertIsNone(obs['time']['video'])
        self.assertIsNone(obs['place']['coordinates'])
        self.assertIn('30 fps does not establish camera accuracy', obs['limits'])
        self.assertIn('no 23:15:19 correspondence', obs['limits'])
        self.assertEqual(doc['media'], accepted('el-reno-2013')['media'])
        timeline = json.loads((ROOT / 'exhibits/el-reno-2013/appearance-timeline.json').read_bytes())
        self.assertEqual(timeline['windows'], [])
        self.assertNotIn('coy-calhoun', json.dumps(timeline))

    def test_reading_routes_work_without_scripts_and_preserve_lighter_ocr_access(self):
        page = (ROOT / 'web/blackwell.html').read_text(encoding='utf-8')
        parsed = Links(); parsed.feed(page)
        self.assertIn('power-system-assessment', parsed.ids)
        self.assertGreaterEqual(parsed.links.count(SCAN), 2)
        self.assertIn('63 MiB', page)
        self.assertIn(next(row for row in accepted('blackwell-1955')['sources'] if row['id'] == 'interior-blackwell-power-study-fy1955')['url'], parsed.links)
        self.assertIn('dossier.html?event=blackwell-1955&observation=interior-blackwell-electric-distribution-study#observation-interior-blackwell-electric-distribution-study', parsed.links)
        page = (ROOT / 'web/index.html').read_text(encoding='utf-8')
        parsed = Links(); parsed.feed(page)
        self.assertIn('lightning-reports-and-video', parsed.ids)
        self.assertIn('#lightning-reports-and-video', parsed.links)
        for route in (COY,
                      'dossier.html?event=el-reno-2013&observation=coy-calhoun-detection-versus-video#observation-coy-calhoun-detection-versus-video',
                      'dossier.html?event=el-reno-2013&source=coy-calhoun-lightning-video-2015#source-coy-calhoun-lightning-video-2015'):
            self.assertIn(route, parsed.links)
        self.assertFalse(any('Coy-finalpaper' in json.dumps(row) for row in parsed.media))


if __name__ == '__main__':
    unittest.main()
