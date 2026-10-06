"""Caption routes must preserve identity without acquiring pixels or registration."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

from atlas.archive import dossiers, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
PRIOR = ROOT / 'web/archive/blackwell-1955-cc230959464007bb4cbc.json'
IDS = {'ou-flora62-railroad-yard', 'ou-flora67-fire-response'}
GALLERY = 'https://legacy-westhist.libraries.ou.edu/locations/docs/westhist/flora/tornado.html'


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.originals = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('class') == 'archive-original':
            self.originals.append(attrs['href'])


class BlackwellArchiveRouteTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers() if row['id'] == 'blackwell-1955')
        self.prior = json.loads(PRIOR.read_bytes())
        self.page = (ROOT / 'web/blackwell.html').read_text(encoding='utf-8')

    def test_previous_evidence_is_unchanged_and_no_media_is_added(self):
        validate_dossier(self.doc)
        for field in ('media', 'records', 'reconstruction'):
            self.assertEqual(self.doc[field], self.prior[field], field)
        for field in ('sources', 'observations', 'creators', 'routes'):
            for row in self.prior[field]:
                self.assertIn(row, self.doc[field], field)
        self.assertEqual(len(self.doc['sources']) - len(self.prior['sources']), 2)
        self.assertEqual(len(self.doc['observations']) - len(self.prior['observations']), 2)
        self.assertEqual(len(self.doc['creators']) - len(self.prior['creators']), 2)
        self.assertEqual(self.doc['routes'][-1]['href'], 'blackwell.html#archive-prints')

    def test_caption_association_does_not_become_capture_registration_or_reuse(self):
        items = {row['source_id']: row for row in self.doc['observations'] if row['source_id'] in IDS}
        self.assertEqual(set(items), IDS)
        for identifier, item in items.items():
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

    def test_original_source_roles_and_rights_limits_are_explicit(self):
        sources = {row['id']: row for row in self.doc['sources'] if row['id'] in IDS}
        self.assertEqual(set(sources), IDS)
        for source in sources.values():
            self.assertEqual(source['url'], GALLERY)
            self.assertIn('Complete image pixels were not visually inspected', source['access'])
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
        for number, identifier in [('62', 'ou-flora62-railroad-yard'), ('67', 'ou-flora67-fire-response')]:
            item = re.search(r'<li id="archive-flora' + number + r'">(.*?)</li>', section, re.S).group(1)
            self.assertIn('Find FLORA' + number, item)
            self.assertIn('observation=' + identifier + '-caption#observation-' + identifier + '-caption', item)
            self.assertIn('source=' + identifier + '#source-' + identifier, self.page)
        self.assertIn('not the photographer', section)
        self.assertIn('FLORA58 captions are excluded', section)
        self.assertIn('does not establish the fire', section)


if __name__ == '__main__':
    unittest.main()
