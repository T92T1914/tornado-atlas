"""Caption routes must preserve identity without acquiring pixels or registration."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

from atlas.archive import digest, dossiers, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
PRIOR = ROOT / 'web/archive/blackwell-1955-cc230959464007bb4cbc.json'
QUALIFIED_PRIOR = ROOT / 'web/archive/blackwell-1955-7ece223222ef94b0e0f6.json'
PRIOR_DIGEST = '7ece223222ef94b0e0f65fafa42040a2cd028e10d14eb9ad4a7c9a0f92b45634'
CANDIDATE_DIGEST = '3a9466fdfbce7ef25dc524e204ea43ab3f5b990cec778a13556f9e4664509643'
ITEMS = [
    ('62', 'ou-flora62-railroad-yard', 'ou-flora62-online-preview', 193, 12287,
     '2efceead19ccb34602b5a09cda35654628c4ee9997045c3977b3184f2343c132'),
    ('67', 'ou-flora67-fire-response', 'ou-flora67-online-preview', 192, 13662,
     '33840aa0f924edd5e7db9d287d902a1db1d4898e5ae78c1b9d4bb2a1e02bd094'),
]
IDS = {row[1] for row in ITEMS}
GALLERY = 'https://legacy-westhist.libraries.ou.edu/locations/docs/westhist/flora/tornado.html'


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.originals = []
        self.online_versions = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('class') == 'archive-original':
            self.originals.append(attrs['href'])
        if tag == 'a' and attrs.get('class') == 'archive-online-version':
            self.online_versions.append(attrs['href'])


class BlackwellArchiveRouteTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers() if row['id'] == 'blackwell-1955')
        self.prior = json.loads(PRIOR.read_bytes())
        self.qualified_prior = json.loads(QUALIFIED_PRIOR.read_bytes())
        self.assertEqual(digest(self.qualified_prior), PRIOR_DIGEST)
        self.page = (ROOT / 'web/blackwell.html').read_text(encoding='utf-8')

    def test_previous_evidence_is_unchanged_and_no_media_is_added(self):
        validate_dossier(self.doc)
        for field in ('media', 'records', 'reconstruction'):
            self.assertEqual(self.doc[field], self.prior[field], field)
        for field in ('sources', 'observations', 'creators', 'routes'):
            for row in self.prior[field]:
                self.assertIn(row, self.doc[field], field)
        self.assertEqual(len(self.doc['sources']) - len(self.prior['sources']), 2)
        self.assertEqual(len(self.doc['observations']) - len(self.prior['observations']), 4)
        self.assertEqual(len(self.doc['creators']) - len(self.prior['creators']), 2)
        self.assertEqual(self.doc['routes'][-1]['href'], 'blackwell.html#archive-prints')
        prior = self.qualified_prior
        self.assertEqual(self.doc['observations'][:7], prior['observations'])
        self.assertEqual([row['id'] for row in self.doc['observations'][7:]],
                         [row[2] for row in ITEMS])
        for field in ('media', 'records', 'reconstruction', 'routes', 'creators',
                      'title', 'summary', 'coverage'):
            self.assertEqual(self.doc[field], prior[field], field)
        self.assertEqual([row['id'] for row in self.doc['sources']],
                         [row['id'] for row in prior['sources']])
        for before, after in zip(prior['sources'], self.doc['sources']):
            if before['id'] in IDS:
                self.assertEqual({key for key in before if before[key] != after[key]},
                                 {'access', 'agent_processing', 'locator', 'revision', 'rights'})
                for key in ('id', 'title', 'url'):
                    self.assertEqual(after[key], before[key])
                self.assertEqual(after['rights'].split('Photographer', 1)[1],
                                 before['rights'].split('Photographer', 1)[1])
            else:
                self.assertEqual(after, before)
        review = self.doc['provenance']['publication_review']
        self.assertEqual(review['previous_dossier_sha256'], PRIOR_DIGEST)
        self.assertEqual(review['candidate_sha256'], CANDIDATE_DIGEST)
        self.assertEqual(self.doc['provenance']['inputs'], prior['provenance']['inputs'])

    def test_caption_association_does_not_become_capture_registration_or_reuse(self):
        selected = [row for row in self.doc['observations'] if row['source_id'] in IDS]
        self.assertEqual({row['id'] for row in selected},
                         {source + '-caption' for source in IDS} | {row[2] for row in ITEMS})
        items = {row['id']: row for row in selected}
        prior = {row['id']: row for row in self.qualified_prior['observations']}
        for identifier in IDS:
            item = items[identifier + '-caption']
            self.assertEqual(item, prior[item['id']])
            self.assertEqual(item['time']['retrieval'], '2026-10-06')
            self.assertIsNone(item['time']['video'])
            self.assertEqual(item['id'], identifier + '-caption')
            self.assertEqual(item['status']['assertion'], 'source_reported')
            self.assertEqual(item['status']['rights'], 'links_only')
            self.assertEqual(item['status']['spatial'], 'unregistered')
            self.assertEqual(item['status']['temporal'], 'source_label')
            self.assertIsNone(item['time']['capture'])
            self.assertIsNone(item['time']['publication'])
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['place']['coordinates'])
            self.assertIn('May 25, 1955', item['time']['event']['reported'])
            self.assertIn('not a capture clock', item['time']['event']['precision'])
            self.assertIn('not an independent visual description', item['limits'])
            self.assertIn('Complete-pixel inspection', item['review'])

    def test_online_preview_samples_keep_null_registration_and_links_only_rights(self):
        observations = {row['id']: row for row in self.doc['observations']}
        sources = {row['id']: row for row in self.doc['sources']}
        for number, source_id, preview_id, width, byte_count, sha256 in ITEMS:
            item = observations[preview_id]
            self.assertEqual(set(item), {'id', 'title', 'source_id', 'locator', 'account',
                                         'limits', 'status', 'time', 'place', 'review'})
            self.assertEqual(item['source_id'], source_id)
            self.assertEqual(item['status'], {
                'intake': 'published', 'assertion': 'observed_sample',
                'temporal': 'unregistered', 'spatial': 'unregistered',
                'availability': 'reviewed_available', 'rights': 'links_only'})
            self.assertEqual(item['time'], {
                'event': {'reported': 'May 25, 1955, as associated by the archive caption',
                          'precision': 'caption event date, not a capture clock'},
                'capture': None, 'publication': None, 'retrieval': '2026-10-10',
                'video': None, 'alignment': None})
            self.assertEqual(item['place'], {
                'role': 'archive_caption_context',
                'reported': 'Blackwell, Oklahoma, as associated by the archive caption',
                'coordinates': None,
                'basis': 'Institutional caption association only. No location is registered from the inspected online version.'})
            version = GALLERY.removesuffix('tornado.html') + 'images/flora' + number + '.jpg'
            for text in (version, str(width) + ' by 150', str(byte_count) + ' bytes', sha256):
                self.assertIn(text, item['locator'])
            for text in (str(width) + ' by 150', str(byte_count) + ' bytes', sha256):
                self.assertIn(text, sources[source_id]['revision'])
            self.assertIn('complete original-print coverage remains unknown', item['limits'])
            self.assertIn('Image hosting and derivative permission are not established', item['limits'])
            self.assertIn('entire returned JPEG rectangle', item['review'])
        self.assertIn('does not establish individual rail cars',
                      observations[ITEMS[0][2]]['limits'])
        self.assertIn('does not establish identities, gender, precise actions',
                      observations[ITEMS[1][2]]['limits'])

    def test_original_source_roles_and_rights_limits_are_explicit(self):
        sources = {row['id']: row for row in self.doc['sources'] if row['id'] in IDS}
        self.assertEqual(set(sources), IDS)
        for source in sources.values():
            self.assertEqual(source['url'], GALLERY)
            self.assertIn('Complete image pixels were not visually inspected during that caption qualification',
                          source['access'])
            self.assertIn('October 6, 2026', source['access'])
            self.assertIn('On October 10, 2026', source['access'])
            self.assertIn('entire returned small online JPEG', source['access'])
            self.assertIn('Complete original-print coverage remains unknown', source['access'])
            self.assertIn('Photographer and copyright holder unknown', source['rights'])
            self.assertIn('permission not established', source['rights'])
            self.assertIn('one archive stream', source['agent_processing'])
        collector = next(row for row in self.doc['creators'] if row['id'] == 'snowden-dwight-flora-collector')
        self.assertIn('not identified as the photographer', collector['basis'])

    def test_chapter_source_and_observation_routes_keep_the_two_item_identities(self):
        section = re.search(r'<section id="archive-prints">(.*?)</section>', self.page, re.S).group(1)
        self.assertNotRegex(section, r'<(?:img|iframe|video|picture|source)\b')
        parser = Links()
        parser.feed(section)
        self.assertEqual(parser.originals, [GALLERY, GALLERY])
        self.assertEqual(parser.online_versions, [
            GALLERY.removesuffix('tornado.html') + 'images/flora62.jpg',
            GALLERY.removesuffix('tornado.html') + 'images/flora67.jpg'])
        for number, identifier in [('62', 'ou-flora62-railroad-yard'), ('67', 'ou-flora67-fire-response')]:
            item = re.search(r'<li id="archive-flora' + number + r'">(.*?)</li>', section, re.S).group(1)
            self.assertIn('Find FLORA' + number, item)
            self.assertIn('observation=' + identifier + '-caption#observation-' + identifier + '-caption', item)
            self.assertIn('source=' + identifier + '#source-' + identifier, self.page)
            preview = 'ou-flora' + number + '-online-preview'
            self.assertEqual(item.count('observation=' + preview + '#observation-' + preview), 1)
            self.assertEqual(item.count('observation=' + identifier + '-caption#observation-' + identifier + '-caption'), 1)
        self.assertIn('October 10, 2026', section)
        self.assertIn('original prints have not been inspected', section)
        self.assertIn('Complete original-print coverage', section)
        self.assertIn('not the photographer', section)
        self.assertIn('FLORA58 captions are excluded', section)
        self.assertIn('does not establish the fire', section)


if __name__ == '__main__':
    unittest.main()
