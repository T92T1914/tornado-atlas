"""The new report cases must not acquire occupant or reconstruction claims."""
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossiers, publication

ROOT = Path(__file__).resolve().parents[1]
OLD = 'archive/joplin-2011-c080b55cf2dfa5efc278.json'
NEW_IDS = {'intake-nist-east-middle-refuge-2014', 'intake-nist-high-school-refuge-2014'}
LATER_ADDITIONS = {'intake-nws-siren-cessation-2011',
                   'intake-nws-local-siren-warning-distinction-2011'}
SCHOOL_REVISION = 'archive/joplin-2011-1f02a52e8fcabe1667db.json'


class JoplinRefugeTests(unittest.TestCase):
    def test_original_dossier_and_its_clock_records_are_preserved(self):
        old = json.loads((ROOT / 'web' / OLD).read_text(encoding='utf-8'))
        self.assertEqual(digest(old), 'c080b55cf2dfa5efc278ba9405840a366af984e984034eb0e7f0db60507fc721')
        current = next(d for d in dossiers() if d['id'] == old['id'])
        self.assertEqual(current['records'], old['records'])
        original_items = {row['id']: row for row in old['observations']}
        retained = {row['id']: row for row in current['observations'] if row['id'] not in NEW_IDS | LATER_ADDITIONS}
        self.assertEqual(retained, original_items)
        prior_media_ids = {row['id'] for row in old['media']}
        self.assertEqual([row for row in current['media'] if row['id'] in prior_media_ids], old['media'])
        self.assertEqual(current['reconstruction'], old['reconstruction'])

    def test_refuge_metadata_remains_source_reported_links_only_and_unregistered(self):
        doc = next(d for d in dossiers() if d['id'] == 'joplin-2011')
        source = next(s for s in doc['sources'] if s['id'] == 'nist-school-refuge')
        self.assertIn('0b1c41b9134f74f2e4e600e68b27d3197598f5c42e88ea7c2ad6cc8e715cca78', source['revision'])
        self.assertIn('#page=274', source['url'])
        self.assertIn('No human review', source['agent_processing'])
        rows = [r for r in doc['observations'] if r['id'] in NEW_IDS]
        self.assertEqual(len(rows), 2)
        for row in rows:
            with self.subTest(case=row['id']):
                self.assertEqual(row['source_id'], source['id'])
                self.assertEqual(row['status'], {
                    'intake': 'published', 'assertion': 'source_reported',
                    'temporal': 'unregistered', 'spatial': 'unregistered',
                    'availability': 'reviewed_available', 'rights': 'links_only'})
                self.assertIsNone(row['time']['capture'])
                self.assertIsNone(row['time']['alignment'])
                self.assertIsNone(row['place']['coordinates'])
                self.assertIn('PDF page', row['locator'])
        east = next(r for r in rows if 'east-middle' in r['id'])
        high = next(r for r in rows if 'high-school' in r['id'])
        self.assertIn('unoccupied', east['limits'])
        self.assertIn('likely explanation', east['account'])
        self.assertIn('building occupancy', high['limits'])

    def test_current_export_has_new_revision_without_private_intake(self):
        artifacts = publication()
        index = artifacts['archive/index.json']
        entry = next(e for e in index['events'] if e['id'] == 'joplin-2011')
        self.assertNotEqual(entry['file'], OLD)
        self.assertEqual(entry['registered_media'], 0)
        expected = artifacts[entry['file']]
        actual = json.loads((ROOT / 'web' / entry['file']).read_text(encoding='utf-8'))
        self.assertEqual(actual, expected)
        self.assertNotIn('curator', actual['provenance'])
        self.assertNotIn('private_notes', actual)
        self.assertNotIn('intake', actual)
        self.assertEqual(actual['provenance']['publication_review']['reviewer_kind'], 'agent')
        school_revision = json.loads((ROOT / 'web' / SCHOOL_REVISION).read_text(encoding='utf-8'))
        self.assertEqual(school_revision['provenance']['publication_review']['previous_dossier_sha256'],
                         '735c1ec99e9d1275197199d5eef6b9382d4eb48c4bc97cec9eecc08d98144744')


if __name__ == '__main__':
    unittest.main()
