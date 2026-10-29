"""Publication labels explain a lightning example without registering a camera."""
import copy
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from reviewed_continuation_support import reviewed_predecessor
from atlas.archive import digest, dossiers, dossier_history
from atlas.evidence_coverage import layer_references

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = 'a1f75223cbe5f4d86d659e9f22b6b1bb10690789ebb8764e0fb1616ae1d80f99'
SOURCE = 'ntrs-2014-large-charge-moment'
OBSERVATION = 'ntrs-2014-reported-lightning-event'
ORIGINAL = 'https://ntrs.nasa.gov/api/citations/20140011687/downloads/20140011687.pdf#page=11'
PDF_SHA = '988a96e30ca18db8aa43e6ed1f4fd50e4a79388ec88e466c8eeb64dd9c7b10cc'


class Reading(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids, self.embeds = [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'a':
            self.links.append(attrs.get('href'))
        if tag in ('img', 'video', 'iframe', 'object', 'embed', 'source'):
            self.embeds.append(attrs)


class NtrsLightningReferenceTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers(ROOT) if row['id'] == 'el-reno-2013')
        self.source = next(row for row in self.doc['sources'] if row['id'] == SOURCE)
        self.observation = next(row for row in self.doc['observations'] if row['id'] == OBSERVATION)
        self.previous = json.loads((ROOT / f'web/archive/el-reno-2013-{PREVIOUS[:20]}.json').read_bytes())
        self.assertEqual(digest(self.previous), PREVIOUS)

    def test_exact_source_and_selected_inspection_keep_authors_separate_from_archive(self):
        self.assertEqual(self.source['title'], 'Large Charge Moment Change Lightning in an Oklahoma Mesoscale Convective System')
        self.assertEqual(self.source['url'], ORIGINAL)
        for author in ('Timothy J. Lang', 'Steven Cummer', 'Danyal Petersen',
                       'Lizxandra Flores-Rivera', 'Walt Lyons', 'Donald MacGorman', 'William Beasley'):
            self.assertIn(author, self.source['locator'])
        self.assertIn('not the author', self.source['locator'])
        self.assertIn('1,669,600 bytes', self.source['revision'])
        self.assertIn(PDF_SHA, self.source['revision'])
        self.assertIn('Selected-page coverage, not full-paper review', self.source['access'])
        self.assertIn('No source figure, PDF, video frame or underlying measurement dataset is hosted', self.source['rights'])

    def test_may_31_event_has_the_reported_quantity_without_a_camera_clock(self):
        obs = self.observation
        for expected in ('positive cloud-to-ground', '23:15:19 UTC', 'May 31, 2013',
                         '121 C km', 'minute-only label 2315 UTC', 'first two milliseconds'):
            self.assertIn(expected, obs['account'])
        self.assertNotIn('-341', obs['account'])
        self.assertNotIn('June 1', obs['account'])
        self.assertEqual(obs['status'], {'intake':'published', 'assertion':'source_reported',
            'temporal':'source_label', 'spatial':'unregistered',
            'availability':'reviewed_available', 'rights':'links_only'})
        self.assertEqual(obs['time']['event']['reported'], '2013-05-31T23:15:19Z')
        self.assertEqual(obs['time']['event']['precision'], 'publication_whole_second_label')
        for role in ('capture', 'video', 'alignment'):
            self.assertIsNone(obs['time'][role])
        self.assertIsNone(obs['place']['coordinates'])
        for expected in ('not established clock accuracy', 'Radar seconds',
                         'time difference are unknown', 'not complete flash duration or camera accuracy',
                         'not peak current or photographic brightness',
                         'not a camera or exact ground-strike point', 'not a recovered raw dataset'):
            self.assertIn(expected, obs['limits'])

    def test_increment_preserves_every_preceding_record_and_nolte_grant(self):
        retained = reviewed_predecessor(self, self.doc)
        after = copy.deepcopy(retained)
        for field, additions in (('sources', [SOURCE]), ('observations', [OBSERVATION])):
            count = len(self.previous[field])
            self.assertEqual([row['id'] for row in after[field][count:]], additions)
            after[field] = after[field][:count]
        self.assertEqual(after['routes'][len(self.previous['routes']):], [{
            'label':'Read the flash and radar clock labels',
            'href':'index.html#lightning-figure-clock-labels'}])
        after['routes'] = after['routes'][:len(self.previous['routes'])]
        self.assertEqual(after['provenance']['publication_review']['previous_dossier_sha256'], PREVIOUS)
        after['provenance']['publication_review'] = self.previous['provenance']['publication_review']
        self.assertEqual(digest(after), PREVIOUS)
        changes = next(row for row in dossier_history(retained)['versions']
                       if row['dossier_sha256'] == digest(retained))['changes']
        self.assertEqual(changes, [
            {'kind':'sources','id':SOURCE,'change':'added','fields':[]},
            {'kind':'observations','id':OBSERVATION,'change':'added','fields':[]},
            {'kind':'dossier','id':'el-reno-2013','change':'updated','fields':['routes']}])

    def test_only_existing_gap_membership_admits_the_unmatched_publication_event(self):
        layers = layer_references(ROOT, self.doc)
        self.assertIn(OBSERVATION, layers['gaps']['observations'])
        for layer in ('appearance', 'geography', 'damage'):
            self.assertNotIn(OBSERVATION, layers[layer]['observations'])
        timeline = json.loads((ROOT / 'exhibits/el-reno-2013/appearance-timeline.json').read_bytes())
        self.assertEqual(timeline['windows'], [])
        self.assertNotIn('ntrs-2014', json.dumps(timeline))
        self.assertEqual(self.doc['reconstruction'], self.previous['reconstruction'])

    def test_generated_reading_has_ordinary_source_routes_without_reproducing_the_figure(self):
        page = (ROOT / 'web/index.html').read_text(encoding='utf8')
        parsed = Reading(); parsed.feed(page)
        self.assertIn('lightning-reports-and-video', parsed.ids)
        self.assertIn('lightning-figure-clock-labels', parsed.ids)
        self.assertIn('#lightning-figure-clock-labels', parsed.links)
        for target in (ORIGINAL,
                       f'dossier.html?event=el-reno-2013&observation={OBSERVATION}#observation-{OBSERVATION}',
                       f'dossier.html?event=el-reno-2013&source={SOURCE}#source-{SOURCE}'):
            self.assertIn(target, parsed.links)
        self.assertFalse(any('20140011687' in json.dumps(row) for row in parsed.embeds))
        for expected in ('121 C km', '2315 UTC', 'first two milliseconds',
                         'does not establish a 19-second difference',
                         'not identified an independent optical exposure'):
            self.assertIn(expected, page)


if __name__ == '__main__':
    unittest.main()
