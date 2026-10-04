"""Warning context must preserve chronology and require explicit review."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from atlas.archive import digest, dossiers, publication
from atlas.curator import Conflict, Store, candidate, intake

ROOT = Path(__file__).resolve().parents[1]
OLD = 'archive/joplin-2011-8d3c839b9f9dafb8ff79.json'
OLD_SHA256 = '61d5e67f3392e69ed4a19d3b76df4144219aee9e03c783ce1e540918315c6b4a'
NEW_ID = 'intake-nws-local-siren-warning-distinction-2011'
SOURCE_URL = 'https://www.weather.gov/media/publications/assessments/Joplin_tornado.pdf'


class JoplinWarningContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = (ROOT / 'web' / OLD).read_bytes()
        cls.old = json.loads(cls.raw)
        cls.doc = next(d for d in dossiers() if d['id'] == 'joplin-2011')

    def test_ten_observations_and_recorded_warning_review_base_are_preserved(self):
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), OLD_SHA256)
        self.assertEqual(len(self.old['observations']), 10)
        self.assertEqual(len(self.doc['observations']), 11)
        self.assertEqual(self.doc['observations'][:10], self.old['observations'])
        self.assertEqual(self.doc['observations'][10]['id'], NEW_ID)
        for key in ('records', 'reconstruction'):
            self.assertEqual(self.doc[key], self.old[key])
        self.assertEqual(self.doc['routes'], self.old['routes'] + [{
            'label': 'Hospital frame, windows and loss of function',
            'href': 'joplin.html#hospital-envelope'}])
        for key in ('media', 'creators'):
            prior_ids = {row['id'] for row in self.old[key]}
            self.assertEqual([row for row in self.doc[key] if row['id'] in prior_ids], self.old[key])
        prior_source_ids = {row['id'] for row in self.old['sources']}
        retained_sources = [row for row in self.doc['sources'] if row['id'] in prior_source_ids]
        self.assertEqual([s['id'] for s in retained_sources], [s['id'] for s in self.old['sources']])
        for old, new in zip(self.old['sources'], retained_sources):
            if old['id'] != 'nws-assessment':
                self.assertEqual(old, new)
            else:
                for key in ('id', 'title', 'url', 'revision', 'rights'):
                    self.assertEqual(old[key], new[key])
                for key in ('locator', 'access', 'agent_processing'):
                    self.assertTrue(new[key].startswith(old[key]))
        introduced_raw = (ROOT / 'web/archive/joplin-2011-30b168fee88e544e1ecd.json').read_bytes()
        self.assertEqual(hashlib.sha256(introduced_raw).hexdigest(),
                         'c46521edf5006a26d2b41bae294a0096b36169330d5183ddc427df1cb0964be9')
        introduced = json.loads(introduced_raw)
        self.assertEqual(introduced['provenance']['publication_review']['previous_dossier_sha256'], digest(self.old))
        pre_hospital_raw = (ROOT / 'web/archive/joplin-2011-01b24def4c0f59517dd4.json').read_bytes()
        self.assertEqual(hashlib.sha256(pre_hospital_raw).hexdigest(),
                         'c7c6c12c7bbf8f3f3fd9afae55b23dd0a79a5726fa0ea95e7531136c082d2c38')
        pre_hospital = json.loads(pre_hospital_raw)
        self.assertEqual(pre_hospital['provenance']['publication_review']['previous_dossier_sha256'],
                         digest(introduced))
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'],
                         digest(pre_hospital))

    def test_attribution_and_selected_page_scope_do_not_register_alert_clocks(self):
        row = next(o for o in self.doc['observations'] if o['id'] == NEW_ID)
        self.assertEqual(row['source_id'], 'nws-assessment')
        self.assertEqual(row['status'], {
            'intake': 'published', 'assertion': 'source_reported',
            'temporal': 'unregistered', 'spatial': 'unregistered',
            'availability': 'reviewed_available', 'rights': 'links_only'})
        self.assertIn('5:11 p.m. CDT', row['account'])
        self.assertIn('warning 30', row['account'])
        self.assertIn('different storm', row['account'])
        self.assertIn('Some interviewees', row['account'])
        self.assertIn('selected interviews', row['limits'])
        self.assertIn('not an independently reconstructed alert chain', row['limits'])
        self.assertIn('no individual reception time or video alignment', row['limits'])
        self.assertIn('Current siren policy was not investigated', row['limits'])
        self.assertNotIn('54', row['account'] + row['limits'])
        self.assertNotIn('63', row['account'] + row['limits'])
        self.assertIn('PDF page 19', row['locator'])
        self.assertIn('printed page 13', row['locator'])
        for role in ('event', 'capture', 'video', 'alignment'):
            self.assertIsNone(row['time'][role])
        self.assertIsNone(row['place']['coordinates'])
        self.assertIn('No new human review', row['review'])
        source = next(s for s in self.doc['sources'] if s['id'] == 'nws-assessment')
        self.assertEqual(source['url'], SOURCE_URL)
        self.assertIn('PDF pages 17, 18 and 19', source['access'])
        self.assertIn('not a full-report visual review', source['access'])

    def test_actual_intake_save_reopen_and_export_do_not_publish_or_infer_review(self):
        item = next(o for o in self.doc['observations'] if o['id'] == NEW_ID)
        row = {
            'key': NEW_ID.removeprefix('intake-'), 'kind': 'lead',
            'title': item['title'], 'url': SOURCE_URL + '#page=19',
            'locator': item['locator'], 'account': item['account'], 'limits': item['limits'],
            'creator': '', 'uploader': '', 'rights_holder': '',
            'attribution_basis': 'NWS July 2011 assessment, Section 3.',
            'rights': 'links_only', 'rights_note': 'Attributed paraphrase and original link only.',
            'capture_text': '', 'publication_text': 'July 2011', 'retrieval_text': '',
            'place_text': 'Joplin, Missouri. Named historical warning context only.',
            'video_start': None, 'video_end': None}
        draft = {'schema_version': 1, 'id': 'joplin-warning-context-fixture',
                 'target': {'kind': 'event', 'id': self.old['id'], 'title': self.old['title']},
                 'base': {'event_id': self.old['id'], 'dossier_sha256': digest(self.old)},
                 'dossier': copy.deepcopy(self.old), 'private_notes': 'Not public', 'intake': {}}
        original = copy.deepcopy(draft)
        with tempfile.TemporaryDirectory() as directory:
            store = Store(Path(directory) / 'private')
            first = store.save(draft, None)
            added, changed = intake(draft, row)
            self.assertTrue(changed)
            self.assertEqual(draft, original)
            saved = store.save(added, first['revision'])
            self.assertEqual(store.load(draft['id']), saved)
            repeated, changed = intake(saved['draft'], row)
            self.assertFalse(changed)
            self.assertEqual(repeated, saved['draft'])
            with self.assertRaises(Conflict):
                intake(saved['draft'], row | {'account': 'A conflicting replacement'})
            with self.assertRaises(Conflict):
                store.save(original, first['revision'])
            exported = candidate(saved['draft'])
        candidate_item = exported['dossier']['observations'][-1]
        self.assertEqual(candidate_item['id'], NEW_ID)
        self.assertEqual(candidate_item['status']['intake'], 'candidate')
        self.assertEqual(candidate_item['status']['assertion'], 'not_researched')
        self.assertEqual(candidate_item['status']['availability'], 'not_researched')
        self.assertEqual(exported['base']['dossier_sha256'], digest(self.old))
        for before, after in zip(self.old['observations'], exported['dossier']['observations']):
            expected = copy.deepcopy(before)
            expected['status']['intake'] = 'candidate'
            self.assertEqual(after, expected)
        for role in ('event', 'capture', 'video', 'alignment'):
            self.assertIsNone(candidate_item['time'][role])
        self.assertIsNone(candidate_item['place']['coordinates'])
        text = json.dumps(exported)
        self.assertNotIn('Not public', text)
        self.assertFalse(exported['dossier']['provenance']['curator']['private_notes_included'])
        remaining = [exported]
        while remaining:
            value = remaining.pop()
            if isinstance(value, dict):
                self.assertNotIn('private_notes', value)
                if 'intake' in value:
                    self.assertIsInstance(value['intake'], str)
                remaining.extend(value.values())
            elif isinstance(value, list):
                remaining.extend(value)

    def test_content_addressed_export_and_chapter_link_match_the_observation(self):
        artifacts = publication()
        entry = next(e for e in artifacts['archive/index.json']['events'] if e['id'] == self.doc['id'])
        self.assertEqual(entry['file'], 'archive/joplin-2011-' + digest(self.doc)[:20] + '.json')
        self.assertNotEqual(entry['file'], OLD)
        self.assertEqual(entry['registered_media'], 0)
        self.assertEqual(json.loads((ROOT / 'web' / entry['file']).read_bytes()), self.doc)
        self.assertEqual(artifacts[entry['file']], self.doc)
        self.assertNotIn('curator', self.doc['provenance'])
        self.assertNotIn('private_notes', json.dumps(self.doc))
        chapter = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        self.assertIn('id="warning-context"', chapter)
        self.assertIn('observation=' + NEW_ID, chapter)
        self.assertIn('Joplin_tornado.pdf#page=19', chapter)


if __name__ == '__main__':
    unittest.main()
