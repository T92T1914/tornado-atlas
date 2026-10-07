"""Existing original photographs acquire source records without guessed registration."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

from atlas.archive import dossier_history, dossiers

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = 'joplin-2011-47a506c259e731b4c8e8.json'


class PhotoLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('data-photo-kind') == 'context-photograph':
            self.links[attrs['data-photo-id']] = attrs


class JoplinContextPhotoTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(row for row in dossiers() if row['id'] == 'joplin-2011')
        self.media = {row['id']: row for row in self.doc['media']}
        self.sources = {row['id']: row for row in self.doc['sources']}

    def test_original_bytes_roles_and_clock_limits(self):
        expected = [
            ('friskey-joplin-storm', 'daniel-friskey', 'commons-wikisal', 'storm.jpg',
             90380, '5002f48485c7b139bc6ce3b0d2bd2e3359da812ef220b0d761210cab2bf034f1'),
            ('nws-joplin-aftermath', 'nws-springfield', 'commons-wxtrackercody', 'damage.jpg',
             147156, '5d5bf4cf13abb226f579a7c8d614319bb62d70ff3bb7e4b0b4033ccc3f2ae726'),
        ]
        for identifier, creator, uploader, filename, length, sha in expected:
            row = self.media[identifier]
            self.assertEqual(row['roles'], {'creator': creator, 'uploader': uploader, 'rights_holder': None})
            self.assertEqual(row['status']['temporal'], 'unregistered')
            self.assertEqual(row['status']['spatial'], 'unregistered')
            self.assertEqual(row['status']['rights'], 'permitted_hosting')
            self.assertIsNone(row['place']['coordinates'])
            self.assertIsNone(row['time']['alignment'])
            self.assertIsNone(row['time']['video'])
            raw = (ROOT / 'web/assets/joplin-2011' / filename).read_bytes()
            self.assertEqual(len(raw), length)
            self.assertEqual(hashlib.sha256(raw).hexdigest(), sha)
            self.assertEqual(row['transformation']['sha256'], sha)
            self.assertEqual(row['transformation']['source_sha256'], sha)
        self.assertIsNone(self.media['friskey-joplin-storm']['time']['capture'])
        self.assertIn('March 21, 2025', self.media['friskey-joplin-storm']['limits'])
        self.assertIn('May 23, 2011 at 13:19', self.media['nws-joplin-aftermath']['time']['capture']['reported'])
        self.assertIn('unverified', self.media['nws-joplin-aftermath']['time']['capture']['reported'])

    def test_previous_reviewed_rows_and_reconstruction_are_preserved(self):
        previous = json.loads((ROOT / 'web/archive' / PREVIOUS).read_text(encoding='utf-8'))
        for field in ('records', 'reconstruction'):
            self.assertEqual(previous[field], self.doc[field])
        for field in ('media', 'observations', 'sources', 'creators', 'routes'):
            for row in previous[field]:
                self.assertIn(row, self.doc[field], (field, row.get('id', row)))

    def test_increment_records_exact_predecessor_and_additions(self):
        history = dossier_history(self.doc)
        current = next(version for version in history['versions'] if version['dossier_sha256'] ==
                       'c08d06204ba51b28e19b1263e2dc58b533472c50d63d92bdd6cd6ed2391fac33')
        self.assertEqual(current['review']['previous_dossier_sha256'],
                         '47a506c259e731b4c8e8c8f1bb238cf5bfcf4aa9e00cc2336dd41976fb861799')
        self.assertTrue(current['predecessor_available'])
        self.assertEqual([row for row in current['changes'] if row['kind'] == 'media'], [
            {'kind':'media','id':'friskey-joplin-storm','change':'added','fields':[]},
            {'kind':'media','id':'nws-joplin-aftermath','change':'added','fields':[]},
        ])
        self.assertEqual([row for row in current['changes'] if row['kind'] == 'observations'], [
            {'kind':'observations','id':'nist-rain-obscured-visual-confirmation','change':'added','fields':[]},
        ])
        self.assertFalse(any(row['change'] != 'added' for row in current['changes'] if row['kind'] != 'dossier'))
        self.assertEqual([row for row in current['changes'] if row['kind'] == 'dossier'], [
            {'kind':'dossier','id':'joplin-2011','change':'updated','fields':['routes']},
        ])

    def test_chapter_links_use_the_correct_item_source_and_reuse_record(self):
        parser = PhotoLinks()
        parser.feed((ROOT / 'web/joplin.html').read_text(encoding='utf-8'))
        self.assertEqual(set(parser.links), {'friskey-joplin-storm', 'nws-joplin-aftermath',
                                           'usace-joplin-temporary-housing', 'usace-joplin-debris-coordination'})
        for identifier, link in parser.links.items():
            if identifier in ('usace-joplin-temporary-housing', 'usace-joplin-debris-coordination'):
                # Their own tests bind the later derivative/preview and labels.
                continue
            row = self.media[identifier]
            self.assertEqual(link['href'], row['transformation']['asset'])
            self.assertEqual(link['data-photo-source'], self.sources[row['source_id']]['url'])
            self.assertIn('unregistered', link['data-photo-location'])
            self.assertIn('photograph at original size', link['aria-label'])
        self.assertEqual(parser.links['friskey-joplin-storm']['data-photo-rights'],
                         'https://creativecommons.org/licenses/by-sa/4.0/')
        self.assertIn('PD-US-NOAA-NWS', parser.links['nws-joplin-aftermath']['data-photo-license'])

    def test_visibility_record_keeps_nist_and_nws_interview_samples_separate(self):
        row = next(row for row in self.doc['observations'] if row['id'] == 'nist-rain-obscured-visual-confirmation')
        self.assertIn('140 survivor interviews', row['account'])
        self.assertIn('not a population estimate', row['limits'])
        self.assertIn('separate NWS', row['limits'])
        self.assertIsNone(row['time']['alignment'])
        self.assertIsNone(row['place']['coordinates'])
        page = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        self.assertIn('id="visibility"', page)
        self.assertIn('separate views with different clock evidence', page)
        self.assertIn('observation=nist-rain-obscured-visual-confirmation', page)


if __name__ == '__main__':
    unittest.main()
