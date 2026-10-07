"""Revision discovery must preserve historical accounts and explicit gaps."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from atlas.archive import (build, digest, dossier_changes, dossier_history, dossiers,
                           evidence, publication, source, validate_dossier)
from atlas.publication import write_json

ROOT = Path(__file__).resolve().parents[1]


class ArchiveHistoryTests(unittest.TestCase):
    def test_events_have_exact_retained_revision_routes(self):
        artifacts = publication()
        index = artifacts['archive/index.json']
        counts = {'el-reno-2013': 3, 'joplin-2011': 13, 'blackwell-1955': 6,
                  'tuscaloosa-birmingham-2011': 11}
        self.assertEqual({e['id'] for e in index['events']}, set(counts))
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

    def test_tuscaloosa_second_photo_is_an_addition_after_the_first_photo(self):
        doc = next(d for d in dossiers() if d['id'] == 'tuscaloosa-birmingham-2011')
        history = dossier_history(doc)
        current = next(v for v in history['versions'] if v['dossier_sha256'] ==
                       'a1d19787e5730aa6216e3606955ce25a6edefc112891326875e8dc5101bbe115')
        previous_sha = '1eca25f06fa270ce9e71e2c2963f6c6b84f06eb2e5d7737a50f2189aafd1fca4'
        self.assertEqual(current['review']['previous_dossier_sha256'], previous_sha)
        self.assertTrue(current['predecessor_available'])
        first_photo = next(v for v in history['versions'] if v['dossier_sha256'] == previous_sha)
        self.assertEqual(first_photo['review']['previous_dossier_sha256'],
                         '82ac763506249130a2e9fe9f8d99407b20ff08cf87e4e2dce42d4c455d2b6229')
        self.assertEqual([r for r in current['changes'] if r['kind'] == 'media'], [
            {'kind': 'media', 'id': 'apartment-complex-aftermath', 'change': 'added', 'fields': []}])
        self.assertEqual([r for r in current['changes'] if r['kind'] == 'sources'], [
            {'kind': 'sources', 'id': 'bmx-apartment-complex', 'change': 'added', 'fields': []}])
        for kind in ('observations', 'records', 'creators'):
            self.assertEqual([r for r in current['changes'] if r['kind'] == kind], [])
        self.assertFalse(any(r['change'] == 'removed' for r in current['changes']))

    def test_blackwell_warning_images_preserve_the_prior_event_record(self):
        latest = next(d for d in dossiers() if d['id'] == 'blackwell-1955')
        history = dossier_history(latest)
        current = next(version for version in history['versions']
                       if version['dossier_sha256'] == 'a90a7539209f7894092248384251566a6db9e4b669d748d498d5df8b4001fc87')
        doc = json.loads((ROOT / 'web' / current['file']).read_text(encoding='utf-8'))
        for field in ('records', 'reconstruction'):
            self.assertEqual(latest[field], doc[field])
        for field in ('observations', 'sources', 'media', 'creators', 'routes'):
            for row in doc[field]:
                self.assertIn(row, latest[field])
        prior_sha = '54ce2e5ef8f7a616c7766adde8d075e42e846a99e1a5e5f3ebfb4b34ca248a09'
        self.assertEqual(current['review']['previous_dossier_sha256'], prior_sha)
        prior = next(version for version in history['versions'] if version['dossier_sha256'] == prior_sha)
        old = json.loads((ROOT / 'web' / prior['file']).read_text(encoding='utf-8'))
        for field in ('observations', 'records', 'reconstruction'):
            self.assertEqual(doc[field], old[field])
        for field in ('sources', 'media', 'creators'):
            for row in old[field]:
                self.assertIn(row, doc[field])
        added = [row for row in doc['media'] if row['id'] not in {m['id'] for m in old['media']}]
        self.assertEqual([row['id'] for row in added], ['nws-blackwell-warning1', 'nws-blackwell-warning2'])
        for row in added:
            self.assertEqual(row['status']['temporal'], 'unregistered')
            self.assertEqual(row['status']['spatial'], 'unregistered')
            self.assertEqual(row['status']['rights'], 'permitted_hosting')
            self.assertIsNone(row['place']['coordinates'])
            for role in ('event', 'capture', 'publication', 'video', 'alignment'):
                self.assertIsNone(row['time'][role])
            self.assertIsNone(row['roles']['creator'])
            self.assertIsNone(row['roles']['rights_holder'])
        self.assertEqual([r for r in current['changes'] if r['kind'] == 'observations'], [])
        self.assertEqual([r for r in current['changes'] if r['kind'] == 'media'], [
            {'kind': 'media', 'id': 'nws-blackwell-warning1', 'change': 'added', 'fields': []},
            {'kind': 'media', 'id': 'nws-blackwell-warning2', 'change': 'added', 'fields': []}])

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
        warning_addition = next(v for v in history['versions'] if v['dossier_sha256'].startswith('30b168fee88e'))
        self.assertEqual([r['change'] for r in warning_addition['changes'] if r['kind'] == 'observations'], ['added'])
        interview_addition = next(v for v in history['versions'] if v['dossier_sha256'].startswith('01b24def4c0f'))
        self.assertEqual([r for r in interview_addition['changes'] if r['kind'] == 'observations'], [])
        self.assertEqual([r for r in interview_addition['changes'] if r['kind'] == 'media'], [
            {'kind': 'media', 'id': 'nist-joplin-survivor-interview', 'change': 'added', 'fields': []}])
        hospital_addition = next(v for v in history['versions'] if v['dossier_sha256'].startswith('2ff06de762b0'))
        self.assertEqual(hospital_addition['review']['previous_dossier_sha256'], interview_addition['dossier_sha256'])
        self.assertEqual([r for r in hospital_addition['changes'] if r['kind'] == 'observations'], [])
        self.assertEqual([r for r in hospital_addition['changes'] if r['kind'] == 'media'], [
            {'kind': 'media', 'id': 'nist-west-tower', 'change': 'added', 'fields': []},
            {'kind': 'media', 'id': 'nist-west-tower-south-windows', 'change': 'added', 'fields': []}])
        roof_addition = next(v for v in history['versions'] if v['dossier_sha256'].startswith('22debeaf0aba'))
        self.assertEqual(roof_addition['review']['previous_dossier_sha256'], hospital_addition['dossier_sha256'])
        self.assertEqual([r for r in roof_addition['changes'] if r['kind'] == 'observations'], [])
        self.assertEqual([r for r in roof_addition['changes'] if r['kind'] == 'media'], [
            {'kind': 'media', 'id': 'nist-home-depot-roof', 'change': 'added', 'fields': []}])
        radar_addition = next(v for v in history['versions'] if v['dossier_sha256'].startswith('47a506c259e7'))
        self.assertEqual(radar_addition['review']['previous_dossier_sha256'], roof_addition['dossier_sha256'])
        self.assertEqual([r for r in radar_addition['changes'] if r['kind'] == 'observations'], [])
        self.assertEqual([r for r in radar_addition['changes'] if r['kind'] == 'media'], [
            {'kind': 'media', 'id': 'nist-joplin-radar-sequence', 'change': 'added', 'fields': []}])

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


class CanonicalHistoryValuesTests(unittest.TestCase):
    @staticmethod
    def dossier():
        return dict(schema_version=1, id='synthetic-history', title='Synthetic history',
                    coverage='Dossier', summary='One inert correction journey.',
                    records=[], routes=[], creators=[], observations=[],
                    sources=[source('source', 'Synthetic source', 'https://example.com/source',
                                    'Fixture locator', 'Fixture only', 'Fixture revision')],
                    media=[evidence('sample', 'Synthetic media', 'source', 'Fixture locator',
                                    'Synthetic account.', 'No historical claim.',
                                    kind='photograph', url='https://example.com/source',
                                    roles=dict(creator=None, uploader=None, rights_holder=None),
                                    parent=None, transformation={'sample_count': 1})],
                    reconstruction={'appearance': 'unregistered', 'intervals': [],
                                    'limits': 'Fixture only.'}, provenance={'adapter': 'fixture'})

    def test_valid_nested_media_type_changes_follow_canonical_identity(self):
        for old, new in [(1, True), (1, 1.0), (0.0, -0.0)]:
            with self.subTest(old=repr(old), new=repr(new)):
                before = self.dossier()
                before['media'][0]['transformation'] = {'sample_count': old}
                after = copy.deepcopy(before)
                after['media'][0]['transformation'] = {'sample_count': new}
                validate_dossier(before)
                validate_dossier(after)
                self.assertNotEqual(digest(before), digest(after))
                self.assertEqual(dossier_changes(before, after), [
                    dict(kind='media', id='sample', change='updated', fields=['transformation'])])

    def test_valid_video_number_forms_change_history_without_admitting_booleans(self):
        before = self.dossier()
        before['media'][0]['time']['video'] = {'start_seconds': 0, 'end_seconds': 1}
        after = copy.deepcopy(before)
        after['media'][0]['time']['video']['end_seconds'] = 1.0
        validate_dossier(before)
        validate_dossier(after)
        self.assertEqual(dossier_changes(before, after), [
            dict(kind='media', id='sample', change='updated', fields=['time'])])
        after['media'][0]['time']['video']['end_seconds'] = True
        with self.assertRaisesRegex(ValueError, 'Video presentation bounds'):
            validate_dossier(after)

    def test_mapping_order_and_publication_provenance_do_not_invent_field_changes(self):
        before = self.dossier()
        before['media'][0]['transformation'] = {'a': 1, 'b': {'x': None, 'y': [1, True]}}
        after = copy.deepcopy(before)
        after['media'][0]['transformation'] = {'b': {'y': [1, True], 'x': None}, 'a': 1}
        after['provenance']['synthetic_review'] = 'Deliberately outside the field comparison.'
        validate_dossier(before)
        validate_dossier(after)
        self.assertEqual(dossier_changes(before, before), [])
        self.assertEqual(dossier_changes(before, after), [])

    def test_nested_missing_and_null_remain_distinct_valid_metadata(self):
        before = self.dossier()
        before['media'][0]['transformation'] = {}
        after = copy.deepcopy(before)
        after['media'][0]['transformation'] = {'sample_count': None}
        validate_dossier(before)
        validate_dossier(after)
        expected = [dict(kind='media', id='sample', change='updated', fields=['transformation'])]
        self.assertEqual(dossier_changes(before, after), expected)
        self.assertEqual(dossier_changes(after, before), expected)

    def test_comparison_helper_distinguishes_absent_row_field_without_weakening_validation(self):
        present = self.dossier()
        absent = copy.deepcopy(present)
        absent['media'][0].pop('parent')
        with self.assertRaisesRegex(ValueError, 'Unexpected evidence fields'):
            validate_dossier(absent)
        expected = [dict(kind='media', id='sample', change='updated', fields=['parent'])]
        self.assertEqual(dossier_changes(absent, present), expected)
        self.assertEqual(dossier_changes(present, absent), expected)

    def test_dossier_values_follow_the_same_canonical_contract(self):
        before = self.dossier()
        before['reconstruction']['limits'] = {'sample_count': 1}
        after = copy.deepcopy(before)
        after['reconstruction']['limits']['sample_count'] = True
        validate_dossier(before)
        validate_dossier(after)
        self.assertEqual(dossier_changes(before, after), [
            dict(kind='dossier', id='synthetic-history', change='updated', fields=['reconstruction'])])

    def test_row_and_field_sorting_additions_and_removals_remain_stable(self):
        before = self.dossier()
        first = evidence('a-kept', 'Synthetic observation', 'source', 'Fixture locator',
                         'Initial account.', 'Fixture only.', review={'sample_count': 1})
        last = copy.deepcopy(first)
        last['id'] = 'z-removed'
        before['observations'] = [last, first]
        after = copy.deepcopy(before)
        kept = after['observations'][1]
        kept['review']['sample_count'] = True
        kept['account'] = 'Corrected synthetic account.'
        added = copy.deepcopy(first)
        added['id'] = 'm-added'
        after['observations'] = [added, kept]
        validate_dossier(before)
        validate_dossier(after)
        self.assertEqual(dossier_changes(before, after), [
            dict(kind='observations', id='a-kept', change='updated', fields=['account', 'review']),
            dict(kind='observations', id='m-added', change='added', fields=[]),
            dict(kind='observations', id='z-removed', change='removed', fields=[])])

    def test_retained_history_reports_the_valid_correction_to_its_predecessor(self):
        before = self.dossier()
        after = copy.deepcopy(before)
        after['media'][0]['transformation']['sample_count'] = True
        after['provenance']['publication_review'] = {
            'reviewer_kind': 'agent', 'reviewed_at': '2026-10-02T00:00:00Z',
            'basis': 'Synthetic type correction with no historical claim.',
            'candidate_sha256': digest(after), 'previous_dossier_sha256': digest(before)}
        validate_dossier(before)
        validate_dossier(after)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_json(root / 'web/archive' / f"{before['id']}-{digest(before)[:20]}.json", before)
            history = dossier_history(after, root)
        current = history['versions'][0]
        self.assertEqual(current['dossier_sha256'], digest(after))
        self.assertTrue(current['predecessor_available'])
        self.assertEqual(current['changes'], [
            dict(kind='media', id='sample', change='updated', fields=['transformation'])])


if __name__ == '__main__':
    unittest.main()
