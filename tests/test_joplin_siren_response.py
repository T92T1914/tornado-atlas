"""A reported response must not become a population rate or a registered clock."""
import hashlib
import json
from pathlib import Path
import unittest

from atlas.archive import digest, dossiers, publication

ROOT = Path(__file__).resolve().parents[1]
OLD = 'archive/joplin-2011-1f02a52e8fcabe1667db.json'
OLD_SHA256 = '56a7382c552441ef4315e4334d4756dd8085a432e5d3cb360995f885317c2b21'
NEW_ID = 'intake-nws-siren-cessation-2011'
LATER_IDS = {'intake-nws-local-siren-warning-distinction-2011'}
SIREN_REVISION = 'archive/joplin-2011-8d3c839b9f9dafb8ff79.json'
SIREN_SHA256 = '61d5e67f3392e69ed4a19d3b76df4144219aee9e03c783ce1e540918315c6b4a'


class JoplinSirenResponseTests(unittest.TestCase):
    def test_prior_observations_clocks_records_and_refuge_cases_are_preserved(self):
        raw = (ROOT / 'web' / OLD).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), OLD_SHA256)
        old = json.loads(raw)
        current = next(d for d in dossiers() if d['id'] == old['id'])
        self.assertEqual([o for o in current['observations'] if o['id'] not in {NEW_ID} | LATER_IDS], old['observations'])
        self.assertEqual(current['observations'][:len(old['observations'])], old['observations'])
        for key in ('records', 'reconstruction'):
            self.assertEqual(current[key], old[key])
        for key in ('media', 'creators'):
            prior_ids = {row['id'] for row in old[key]}
            self.assertEqual([row for row in current[key] if row['id'] in prior_ids], old[key])
        siren_raw = (ROOT / 'web' / SIREN_REVISION).read_bytes()
        self.assertEqual(hashlib.sha256(siren_raw).hexdigest(), SIREN_SHA256)
        siren_revision = json.loads(siren_raw)
        self.assertEqual(siren_revision['provenance']['publication_review']['previous_dossier_sha256'], digest(old))

    def test_sample_and_policy_findings_remain_attributed_and_unregistered(self):
        doc = next(d for d in dossiers() if d['id'] == 'joplin-2011')
        rows = [o for o in doc['observations'] if o['id'] == NEW_ID]
        self.assertEqual(len(rows), 1)
        item = rows[0]
        self.assertEqual(item['source_id'], 'nws-assessment')
        self.assertEqual(item['status'], {
            'intake': 'published', 'assertion': 'source_reported',
            'temporal': 'unregistered', 'spatial': 'unregistered',
            'availability': 'reviewed_available', 'rights': 'links_only'})
        for role in ('event', 'capture', 'video', 'alignment'):
            self.assertIsNone(item['time'][role])
        self.assertIsNone(item['place']['coordinates'])
        self.assertIn('Several interviewees', item['account'])
        self.assertIn('54 residents', item['limits'])
        self.assertIn('63 interviews', item['limits'])
        self.assertIn('limited local case study', item['limits'])
        self.assertIn('not current siren guidance', item['limits'])
        self.assertIn('PDF page 11', item['locator'])
        self.assertIn('PDF page 10', item['locator'])
        self.assertIn('No new human review', item['review'])
        sources = [s for s in doc['sources'] if s['id'] == 'nws-assessment']
        self.assertEqual(len(sources), 1)
        self.assertIn('38e97e54efaaa1853cff5018e0b5ae041e70fc822d0c6c9228258a636fc16962', sources[0]['revision'])

    def test_projection_and_chapter_keep_the_new_observation_inspectable(self):
        artifacts = publication()
        entry = next(e for e in artifacts['archive/index.json']['events'] if e['id'] == 'joplin-2011')
        self.assertNotEqual(entry['file'], OLD)
        self.assertEqual(entry['registered_media'], 0)
        self.assertEqual(json.loads((ROOT / 'web' / entry['file']).read_text(encoding='utf-8')), artifacts[entry['file']])
        self.assertNotIn('curator', artifacts[entry['file']]['provenance'])
        self.assertNotIn('private_notes', artifacts[entry['file']])
        chapter = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        self.assertIn('id="siren-response"', chapter)
        self.assertIn('observation=' + NEW_ID, chapter)
        self.assertIn('Joplin_tornado.pdf#page=11', chapter)


if __name__ == '__main__':
    unittest.main()
