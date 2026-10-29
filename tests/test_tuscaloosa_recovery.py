"""Community context must not silently become calibrated storm evidence."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from reviewed_continuation_support import reviewed_predecessor
from atlas.archive import dossiers, digest, validate_dossier
from atlas.evidence_coverage import layer_references

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = '63b08e0460f38874aeb9f56825860abb768886cb6eea408e5415e9215bcc4a64'
INTERMEDIATE = 'f880ae503c3cb6ef1ebefec27a81f1d9f558abeb9b11eeea8dd59e3962371297'
SOURCE_URLS = {
    'tuscaloosa-county-recovery-plans': 'https://www.tuscaloosacountyema.org/disaster-recovery/tuscaloosa-disaster-recovery',
    'tuscaloosa-city-recovery-area': 'https://www.tuscaloosa.com/tornadorecovery/desktop-dashboard',
    'tuscaloosa-city-memorial-places': 'https://www.tuscaloosa.com/tornadorecovery',
    'tuscaloosa-2021-anniversary-announcement': 'https://www.tuscaloosa.com/posts/2021/04/23/city-of-tuscaloosa-to-commemorate-tornado-anniversary',
}
OBSERVATIONS = ['community-recovery-plans', 'recovery-area-boundary',
                'community-memorial-places', 'anniversary-observance-clock']
ROUTE = {'label': 'Read recovery planning and local remembrance',
         'href': 'tuscaloosa.html#recovery-and-remembrance'}


class RecoverySection(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.depth = 0
        self.text = []
        self.links = []
        self.media = []
        self.feed(html)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'section':
            if attrs.get('id') == 'recovery-and-remembrance' or self.depth:
                self.depth += 1
        if self.depth:
            if tag == 'a':
                self.links.append(attrs.get('href'))
            if tag in ('img', 'video', 'iframe', 'audio', 'source'):
                self.media.append(tag)

    def handle_endtag(self, tag):
        if tag == 'section' and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.text.append(data)


class TuscaloosaRecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(d for d in dossiers(ROOT) if d['id'] == 'tuscaloosa-birmingham-2011')
        cls.raw = (ROOT / 'web/archive' / f'tuscaloosa-birmingham-2011-{PREVIOUS[:20]}.json').read_bytes()
        cls.previous = json.loads(cls.raw)
        cls.html = (ROOT / 'web/tuscaloosa.html').read_text(encoding='utf-8')
        cls.section = RecoverySection(cls.html)

    def test_exact_addition_preserves_every_predecessor_field(self):
        self.assertEqual(digest(self.previous), PREVIOUS)
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(),
                         '02c2d593027112397d859184955225db56912135ab6ea827ec2f76598d334f72')
        after = reviewed_predecessor(self, self.doc)
        self.assertEqual([s['id'] for s in after['sources'][len(self.previous['sources']):]], list(SOURCE_URLS))
        self.assertEqual([o['id'] for o in after['observations'][len(self.previous['observations']):]], OBSERVATIONS)
        self.assertEqual(after['routes'][len(self.previous['routes']):], [ROUTE])
        for field in ('sources', 'observations', 'routes'):
            after[field] = after[field][:len(self.previous[field])]
        self.assertEqual(after['provenance']['publication_review']['previous_dossier_sha256'], INTERMEDIATE)
        after['provenance']['publication_review'] = self.previous['provenance']['publication_review']
        self.assertEqual(digest(after), digest(self.previous))

    def test_place_correction_preserves_the_unaccepted_intermediate_exactly(self):
        raw = (ROOT / 'web/archive' / f'tuscaloosa-birmingham-2011-{INTERMEDIATE[:20]}.json').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),
                         '8b001d3f224f6ad47d7023c1d867814b08cbe5cb14643edcec199c235f12508c')
        intermediate = json.loads(raw)
        self.assertEqual(digest(intermediate), INTERMEDIATE)
        self.assertEqual(intermediate['provenance']['publication_review']['previous_dossier_sha256'], PREVIOUS)
        corrected = reviewed_predecessor(self, self.doc)
        city_ids = set(OBSERVATIONS[1:])
        for obs in corrected['observations']:
            if obs['id'] in city_ids:
                self.assertEqual(obs['place']['reported'], 'Tuscaloosa, Alabama')
                obs['place']['reported'] = 'Tuscaloosa and Holt, Alabama'
        corrected['provenance']['publication_review'] = intermediate['provenance']['publication_review']
        self.assertEqual(digest(corrected), INTERMEDIATE)

    def test_source_rights_and_access_are_limited_to_inspected_text(self):
        for source in self.doc['sources'][-4:]:
            self.assertEqual(source['url'], SOURCE_URLS[source['id']])
            self.assertIn('inspected', source['access'])
            self.assertIn('No photographs, video, dashboard data, maps or plaque text reproduced', source['rights'])
            self.assertIn('No embedded dashboard', source['agent_processing'])
        area = self.doc['sources'][-3]
        self.assertIn('ten-year and fifteen-year', area['revision'])
        self.assertIn('not independently inspected', area['access'])

    def test_clocks_places_and_historical_coverage_do_not_expand(self):
        for obs in self.doc['observations'][-4:]:
            self.assertEqual(obs['status'], dict(intake='published', assertion='source_reported',
                temporal='source_label', spatial='unregistered', availability='reviewed_available', rights='links_only'))
            self.assertEqual(obs['place']['role'], 'community_context')
            self.assertIsNone(obs['place']['coordinates'])
            for field in ('capture', 'alignment', 'video'):
                self.assertIsNone(obs['time'][field])
            self.assertEqual(obs['time']['retrieval'], '2026-10-27')
            expected_place = ('Tuscaloosa and Holt, Alabama' if obs['id'] == 'community-recovery-plans'
                              else 'Tuscaloosa, Alabama')
            self.assertEqual(obs['place']['reported'], expected_place)
        observance = self.doc['observations'][-1]
        self.assertIn('2021', observance['time']['event'])
        self.assertIn('time zone not explicitly stated', observance['time']['event'])
        self.assertEqual(observance['time']['publication'], 'April 23, 2021, as labeled by the City article.')
        self.assertEqual(reviewed_predecessor(self, self.doc)['reconstruction'], self.previous['reconstruction'])
        refs = layer_references(ROOT, self.doc)
        before_refs = json.loads((ROOT / 'exhibits/tuscaloosa-birmingham-2011/layers.json').read_text())
        self.assertEqual(before_refs['dossier_sha256'], digest(self.doc))
        for layer in ('geography', 'damage', 'appearance', 'gaps'):
            self.assertFalse(set(OBSERVATIONS) & set(refs[layer]['observations']))

    def test_invalid_coordinates_and_alignment_are_rejected(self):
        for field in ('coordinates', 'alignment'):
            with self.subTest(field=field):
                changed = copy.deepcopy(self.doc)
                obs = changed['observations'][-1]
                if field == 'coordinates':
                    obs['place']['coordinates'] = [-87.54, 33.21]
                else:
                    obs['status']['temporal'] = 'unregistered'
                    obs['time']['alignment'] = {'utc': '2011-04-27T22:13:00Z', 'basis': 'An anniversary time'}
                with self.assertRaises(ValueError):
                    validate_dossier(changed)
        self.assertIs(validate_dossier(self.doc), self.doc)

    def test_native_reader_has_specific_primary_links_and_return_routes(self):
        text = ' '.join(self.section.text)
        for phrase in ('Tuscaloosa Forward', 'Holt In Action', 'May 2011', 'Forest Lake',
                       'Alberta Park', 'Mary Harmon Park', 'April 23, 2021', '5:13 p.m.',
                       'not plotted death locations', 'not establish that each project was built'):
            self.assertIn(phrase, text)
        for url in SOURCE_URLS.values():
            self.assertIn(url, self.section.links)
        for fragment in ('#path', '#damage-map', '#counts', '#clocks', '#article-contents'):
            self.assertIn(fragment, self.section.links)
        self.assertEqual(self.section.media, [])
        self.assertIn('<a href="#recovery-and-remembrance">Recovery and remembrance</a>', self.html)
        self.assertEqual(reviewed_predecessor(self, self.doc)['media'], self.previous['media'])


if __name__ == '__main__':
    unittest.main()
