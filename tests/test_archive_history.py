"""Revision discovery must preserve historical accounts and explicit gaps."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from atlas.archive import build, digest, dossier_changes, dossier_history, dossiers, publication
from atlas.publication import write_json

ROOT = Path(__file__).resolve().parents[1]


class ArchiveHistoryTests(unittest.TestCase):
    def test_three_events_have_exact_retained_revision_routes(self):
        artifacts = publication()
        index = artifacts['archive/index.json']
        counts = {'el-reno-2013': 2, 'joplin-2011': 5, 'blackwell-1955': 2}
        for entry in index['events']:
            history = artifacts[entry['history_file']]
            self.assertEqual(history['event_id'], entry['id'])
            self.assertEqual(len(history['versions']), counts[entry['id']])
            self.assertEqual(history['versions'][0]['file'], entry['file'])
            for version in history['versions']:
                old = json.loads((ROOT / 'web' / version['file']).read_text(encoding='utf-8'))
                self.assertEqual(digest(old), version['dossier_sha256'])
                if version['predecessor_available']:
                    self.assertIn(version['review']['previous_dossier_sha256'],
                                  {v['dossier_sha256'] for v in history['versions']})
                else:
                    self.assertIsNone(version['changes'])

    def test_missing_predecessor_is_a_gap_not_an_inferred_snapshot(self):
        history = dossier_history(dossiers()[0])
        oldest = next(v for v in history['versions'] if not v['predecessor_available'])
        self.assertEqual(oldest['review']['previous_dossier_sha256'],
                         '900cc2c8a99db11a4858006bc3c9d768f468feb1cb88d404d005aa0938b961b4')
        self.assertIsNone(oldest['changes'])
        self.assertIn('not chronological', history['scope'])

    def test_field_differences_keep_stable_identity_and_do_not_infer_causes(self):
        before = dossiers()[0]
        after = copy.deepcopy(before)
        after['sources'][0]['locator'] = 'A synthetic locator correction.'
        after['media'][0]['status']['availability'] = 'unavailable'
        after['media'].pop(1)
        observation = copy.deepcopy(after['observations'][0])
        observation['id'] = 'synthetic-added-observation'
        after['observations'].append(observation)
        changes = dossier_changes(before, after)
        self.assertIn({'kind': 'sources', 'id': before['sources'][0]['id'], 'change': 'updated', 'fields': ['locator']}, changes)
        self.assertIn({'kind': 'media', 'id': before['media'][0]['id'], 'change': 'updated', 'fields': ['status']}, changes)
        self.assertIn({'kind': 'media', 'id': before['media'][1]['id'], 'change': 'removed', 'fields': []}, changes)
        self.assertIn({'kind': 'observations', 'id': observation['id'], 'change': 'added', 'fields': []}, changes)
        self.assertEqual(before, dossiers()[0])
        self.assertEqual(dossier_changes(before, before), [])

    def test_joplin_actual_correction_is_distinct_from_later_source_additions(self):
        history = dossier_history(next(d for d in dossiers() if d['id'] == 'joplin-2011'))
        correction = next(v for v in history['versions'] if v['dossier_sha256'].startswith('1f02a52e8fca'))
        self.assertTrue(correction['predecessor_available'])
        changed = [row for row in correction['changes'] if row['kind'] == 'observations']
        self.assertEqual(len(changed), 1)
        self.assertEqual(changed[0]['change'], 'updated')
        self.assertEqual(changed[0]['fields'], ['account', 'review'])
        current = history['versions'][0]
        self.assertEqual([r['change'] for r in current['changes'] if r['kind'] == 'observations'], ['added'])

    def test_tampered_retained_identity_cannot_be_indexed(self):
        doc = dossiers()[0]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old = copy.deepcopy(doc)
            path = root / 'web/archive' / f"{doc['id']}-{digest(doc)[:20]}.json"
            old['summary'] = 'Changed bytes under an old identity.'
            write_json(path, old)
            with self.assertRaisesRegex(ValueError, 'identity'):
                dossier_history(doc, root)

    def test_retained_private_fields_and_invalid_review_are_rejected(self):
        doc = dossiers()[0]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old = copy.deepcopy(doc)
            old['provenance']['private_notes'] = 'Private fixture text.'
            path = root / 'web/archive' / f"{doc['id']}-{digest(old)[:20]}.json"
            write_json(path, old)
            with self.assertRaisesRegex(ValueError, 'Private'):
                dossier_history(doc, root)
        for field, value in [('reviewed_at', '2026-10-01T12:00:00'),
                             ('previous_dossier_sha256', '../../outside'),
                             ('reviewer_kind', 'human')]:
            bad = copy.deepcopy(doc)
            bad['provenance']['publication_review'][field] = value
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(ValueError):
                    dossier_history(bad, Path(directory))

    def test_immutable_build_does_not_rewrite_retained_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'web/archive/example-identity.json'
            path.parent.mkdir(parents=True)
            raw = b'{ "fixture": 1 }\r\n'
            path.write_bytes(raw)
            artifacts = {'archive/example-identity.json': {'fixture': 1},
                         'archive/index.json': {'events': [], 'coverage': {'current_source_records': 1}}}
            with patch('atlas.archive.publication', return_value=artifacts):
                self.assertEqual(build(root), {'dossiers': 0, 'records': 1})
            self.assertEqual(path.read_bytes(), raw)
            artifacts['archive/example-identity.json'] = {'fixture': 2}
            with patch('atlas.archive.publication', return_value=artifacts):
                with self.assertRaisesRegex(ValueError, 'immutable'):
                    build(root)
            self.assertEqual(path.read_bytes(), raw)


if __name__ == '__main__':
    unittest.main()
