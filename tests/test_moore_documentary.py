import hashlib
import json
from pathlib import Path
import unittest

from atlas.archive import validate_dossier

ROOT = Path(__file__).resolve().parents[1]


class MooreDocumentaryTests(unittest.TestCase):
    def setUp(self):
        self.doc = json.loads((ROOT / 'exhibits/moore-2013/dossier.json').read_bytes())

    def test_two_county_records_remain_one_unregistered_documentary(self):
        validate_dossier(self.doc)
        self.assertEqual([r['id'] for r in self.doc['records']], ['ncei:451537', 'ncei:451572'])
        self.assertEqual(self.doc['reconstruction']['appearance'], 'unregistered')
        self.assertEqual(self.doc['reconstruction']['intervals'], [])
        event = next(r for r in json.loads((ROOT / 'exhibits/events.json').read_bytes())['events'] if r['id'] == 'moore-2013')
        self.assertEqual(event['documentary'], 'moore.html')
        self.assertIsNone(event['replay'])
        self.assertIsNone(event['chronology'])

    def test_rating_revision_and_unsynchronized_siren_are_source_reported(self):
        observations = {r['id']: r for r in self.doc['observations']}
        revised = observations['briarwood-rating-revision']
        self.assertEqual(revised['source_id'], 'ncei-cleveland-451572')
        self.assertIn('EF4', revised['account'])
        self.assertIn('EF5', revised['account'])
        siren = observations['reported-siren-clock']
        self.assertIn('2:42:34', siren['account'])
        self.assertEqual(siren['status']['temporal'], 'source_label')
        self.assertIsNone(siren['time']['alignment'])

    def test_only_two_qualified_agency_image_versions_are_published(self):
        expected = {
            'assets/moore-2013/IMG_2314-800.jpg': (410330, 'd53b38069c63ec7508cece9e4a70b11fabf45aad090fa072bc7f115efd2ac7e6', 800, 600),
            'assets/moore-2013/IMG_9287-800.jpg': (339582, 'f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb', 800, 533),
        }
        self.assertEqual(len(self.doc['media']), 2)
        self.assertEqual({r['transformation']['asset'] for r in self.doc['media']}, set(expected))
        self.assertEqual({p.name for p in (ROOT / 'web/assets/moore-2013').iterdir()}, {Path(p).name for p in expected})
        for row in self.doc['media']:
            asset = row['transformation']
            size, sha, width, height = expected[asset['asset']]
            raw = (ROOT / 'web' / asset['asset']).read_bytes()
            self.assertEqual(len(raw), size)
            self.assertEqual(hashlib.sha256(raw).hexdigest(), sha)
            self.assertEqual((asset['width'], asset['height']), (width, height))
            self.assertEqual(row['status']['rights'], 'permitted_hosting')
            self.assertIsNone(row['place']['coordinates'])
            self.assertIsNone(row['time']['alignment'])
            self.assertNotEqual(asset['parent_sha256'], sha)


if __name__ == '__main__':
    unittest.main()
