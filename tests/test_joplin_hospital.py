"""A sourced exhibit increment preserves previous claims and exact media identity."""
import hashlib
import json
from pathlib import Path
import unittest

from atlas.archive import dossiers

ROOT = Path(__file__).resolve().parents[1]


class HospitalExhibitTests(unittest.TestCase):
    def setUp(self):
        self.doc = next(doc for doc in dossiers() if doc['id'] == 'joplin-2011')
        self.before = json.loads((ROOT / 'web/archive/joplin-2011-01b24def4c0f59517dd4.json').read_text(encoding='utf-8'))

    def test_previous_evidence_and_chronology_are_unchanged(self):
        for key in ('observations', 'records', 'reconstruction', 'creators', 'summary', 'coverage'):
            self.assertEqual(self.doc[key], self.before[key], key)
        self.assertEqual(self.doc['sources'][:-2], self.before['sources'])
        self.assertEqual(self.doc['media'][:-3], self.before['media'])
        self.assertEqual(self.doc['routes'][:-2], self.before['routes'])
        hospital = json.loads((ROOT / 'web/archive/joplin-2011-2ff06de762b0d24a3451.json').read_text(encoding='utf-8'))
        self.assertEqual(hospital['provenance']['publication_review']['previous_dossier_sha256'],
                         '01b24def4c0f59517dd4c799ffb19f53db60a94c6fad1803c477e9047e22bec1')
        for field in ('sources', 'media', 'routes'):
            self.assertEqual(self.doc[field][:-1], hospital[field], field)

    def test_photos_are_complete_bounded_unregistered_report_sources(self):
        expected = [
            ('nist-west-tower', 901, 541, 93681, '3f651ca4c66baf9e5fb7db1296a6e78204181a237a9f4b9cb7d4973cf5f6ff10', 160),
            ('nist-west-tower-south-windows', 936, 585, 62230, '25561df386d5e21eae19c07d7af0ac7afcd040f2043d7e0484505c3b1d6dcdf6', 162),
        ]
        for identifier, width, height, size, sha, page in expected:
            photo = next(row for row in self.doc['media'] if row['id'] == identifier)
            raw = (ROOT / 'web' / photo['transformation']['asset']).read_bytes()
            self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (size, sha))
            self.assertEqual(photo['transformation']['sha256'], sha)
            self.assertEqual((photo['transformation']['width'], photo['transformation']['height']), (width, height))
            self.assertEqual(photo['status']['rights'], 'permitted_hosting')
            self.assertEqual(photo['status']['temporal'], 'unregistered')
            self.assertEqual(photo['status']['spatial'], 'unregistered')
            self.assertIsNone(photo['time']['capture'])
            self.assertIsNone(photo['time']['alignment'])
            self.assertIsNone(photo['place']['coordinates'])
            self.assertEqual(photo['roles'], {'creator': 'nist', 'uploader': None, 'rights_holder': None})
            self.assertTrue(photo['url'].endswith('#page=' + str(page)))
            self.assertIn('PDF annotation overlays', photo['transformation']['recipe'])
            self.assertIn('not an original camera file', photo['transformation']['recipe'])

    def test_rights_and_mechanism_limits_remain_visible(self):
        source = next(row for row in self.doc['sources'] if row['id'] == 'nist-hospital-envelope')
        self.assertEqual(source['id'], 'nist-hospital-envelope')
        self.assertIn('PDF page 4', source['rights'])
        self.assertIn('Curtis Lynn Geise', source['rights'])
        self.assertIn('Kermit Bright', source['rights'])
        self.assertIn('Not a full report', source['access'])
        chapter = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        for phrase in ('likely combination', 'even without the electrical outage',
                       'not a controlled experiment', 'not a before and after pair',
                       'embedded metadata removed', 'item-specific rights statement'):
            self.assertIn(phrase, chapter)
        self.assertNotIn('©', chapter[chapter.index('id="hospital-envelope"'):chapter.index('id="school-refuge"')])


if __name__ == '__main__':
    unittest.main()
