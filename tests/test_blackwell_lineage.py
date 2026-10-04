"""A source-method addition must preserve unresolved historical event records."""
import hashlib
import json
from pathlib import Path
import unittest

from atlas.archive import dossiers, publication

ROOT = Path(__file__).resolve().parents[1]
OLD = 'archive/blackwell-1955-51d56cb1f0c100423c87.json'
OLD_SHA256 = '7ae272b7d8189a4562f58e05317bb70fdab348e02ed05b089b03aa521ab9345e'
NEW_ID = 'intake-blackwell-database-lineage-sr209'


class BlackwellLineageTests(unittest.TestCase):
    def test_source_growth_preserves_original_clocks_counts_and_associations(self):
        raw = (ROOT / 'web' / OLD).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), OLD_SHA256)
        old = json.loads(raw)
        current = next(d for d in dossiers() if d['id'] == old['id'])
        self.assertEqual(current['records'], old['records'])
        self.assertEqual([o for o in current['observations'] if o['id'] != NEW_ID], old['observations'])
        prior_media_ids = {row['id'] for row in old['media']}
        self.assertEqual([row for row in current['media'] if row['id'] in prior_media_ids], old['media'])
        self.assertEqual(current['reconstruction'], old['reconstruction'])
        for original_source in old['sources']:
            self.assertIn(original_source, current['sources'])

    def test_methods_are_published_without_event_time_or_geometry_registration(self):
        doc = next(d for d in dossiers() if d['id'] == 'blackwell-1955')
        item = next(o for o in doc['observations'] if o['id'] == NEW_ID)
        self.assertEqual(item['source_id'], 'noaa-sr209')
        self.assertEqual(item['status'], {
            'intake': 'published', 'assertion': 'source_reported',
            'temporal': 'unregistered', 'spatial': 'unregistered',
            'availability': 'reviewed_available', 'rights': 'links_only'})
        for role in ('event', 'capture', 'video', 'alignment'):
            self.assertIsNone(item['time'][role])
        self.assertIsNone(item['place']['coordinates'])
        source = next(s for s in doc['sources'] if s['id'] == item['source_id'])
        self.assertEqual(source['url'], 'https://repository.library.noaa.gov/view/noaa/6487/noaa_6487_DS1.pdf#page=3')
        self.assertIn('PDF pages 3 to 4', source['locator'])
        self.assertIn('8dc6c897d29f18828649fbecaf0e43ea6ae933f9ebafe25cf53021545f6b0f37', source['revision'])
        entry = next(e for e in publication()['archive/index.json']['events'] if e['id'] == doc['id'])
        self.assertNotEqual(entry['file'], OLD)
        self.assertEqual(entry['registered_media'], 0)
        self.assertNotIn('curator', doc['provenance'])
        self.assertNotIn('private_notes', doc)


if __name__ == '__main__':
    unittest.main()
