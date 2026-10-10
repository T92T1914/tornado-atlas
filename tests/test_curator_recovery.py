"""Synthetic private recovery, with unchanged publication-time stale protection."""
import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

from atlas.archive import digest, dossiers, evidence, promote_candidate, source
from atlas.curator import App, Conflict, MAX_DRAFT, Store, candidate, decode, recovery_plan, server
from atlas.publication import write_json


class CuratorRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'synthetic-checkout'
        config = [{'id': 'synthetic-recovery', 'title': 'Synthetic recovery context',
                   'coverage': 'Dossier', 'summary': 'Synthetic original account.',
                   'records': [], 'routes': [],
                   'sources': [dict(identifier='synthetic-source', title='Synthetic source', url='https://example.org/source',
                                    locator='Fixture paragraph', access='Synthetic access only', revision='Fixture 1')],
                   'observations': [evidence('synthetic-observation', 'Synthetic observation', 'synthetic-source',
                                             'Fixture paragraph', 'Original attributed account.', 'Synthetic only.')]}]
        write_json(self.root / 'research/archive-dossiers.json', config)
        write_json(self.root / 'research/record-aliases.json', {})
        write_json(self.root / 'web/catalogue/index.json', {'records': []})
        self.store = Store(Path(self.temp.name) / 'private')
        self.app = App(self.store, self.root)
        self.original = dossiers(self.root)[0]
        self.saved = self.app.new({'id': 'returning-draft', 'kind': 'event', 'target': self.original['id']})
        self.before = self.store.path('returning-draft').read_bytes()

    def advance(self, edit):
        current = dossiers(self.root)[0]
        changed = copy.deepcopy(current)
        edit(changed)
        path = self.root / 'synthetic-public-candidate.json'
        write_json(path, {'schema_version': 1, 'kind': 'atlas-curator-candidate',
                          'base': {'event_id': current['id'], 'dossier_sha256': digest(current)}, 'dossier': changed})
        promote_candidate(path, 'Synthetic reviewed fixture advancement.', self.root)
        return dossiers(self.root)[0]

    def payload(self, draft=None):
        return {'draft': copy.deepcopy(draft or self.saved['draft']), 'revision': self.saved['revision']}

    def selected(self, payload, plan, choices=None):
        return payload | {'current_sha256': plan['current_sha256'], 'edited_sha256': plan['edited_sha256'],
                          'choices': choices or {}}

    def test_complete_recovery_preserves_private_and_new_reviewed_content_then_still_rejects_later_stale_export(self):
        private = copy.deepcopy(self.saved['draft'])
        private['private_notes'] = 'PRIVATE fixture permission question'
        private['intake'] = {'synthetic-ledger': 'retained-private-key'}
        private['dossier']['title'] = 'Privately edited fixture title'
        private['dossier']['observations'][0]['account'] = 'Privately edited attributed account.'
        private['dossier']['observations'].append(evidence('private-lead', 'Private source lead', 'synthetic-source',
                                                         'Private fixture locator', 'Unreviewed fixture lead.', 'Still unregistered.'))
        current = self.advance(lambda d: (d.update(summary='New reviewed summary.'),
                                          d['sources'].append(source('reviewed-addition', 'Reviewed fixture addition',
                                              'https://example.org/new', 'New fixture locator', 'Fixture only', 'Fixture 2'))))
        stale = self.root / 'stale-private-candidate.json'
        write_json(stale, candidate(private))
        override = self.root / 'research/archive-curated/synthetic-recovery.json'
        reviewed_bytes = override.read_bytes()
        with self.assertRaisesRegex(ValueError, 'Candidate base changed'):
            promote_candidate(stale, 'Synthetic attempt, expected rejection.', self.root)
        self.assertEqual(override.read_bytes(), reviewed_bytes)
        payload = self.payload(private)
        plan = self.app.recover(payload)
        self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)
        self.assertEqual(plan['current_sha256'], digest(current))
        self.assertEqual(plan['conflicts'], [])
        self.assertTrue(plan['valid'])
        result = plan['draft']
        self.assertEqual(result['dossier']['summary'], current['summary'])
        self.assertEqual(result['dossier']['sources'], current['sources'])
        self.assertEqual(result['dossier']['title'], private['dossier']['title'])
        self.assertEqual(result['dossier']['observations'], private['dossier']['observations'])
        self.assertEqual(result['private_notes'], private['private_notes'])
        self.assertEqual(result['intake'], private['intake'])
        self.assertEqual(result['dossier']['provenance'], current['provenance'])
        recovered = self.app.recover(self.selected(payload, plan), apply=True)
        self.assertEqual(self.store.load('returning-draft'), recovered)
        self.assertEqual(recovered['draft']['base']['dossier_sha256'], digest(current))
        exported = candidate(recovered['draft'])
        self.assertNotIn('PRIVATE fixture', json.dumps(exported))
        self.assertNotIn('retained-private-key', json.dumps(exported))
        for item in exported['dossier']['observations']:
            self.assertEqual(item['status']['intake'], 'candidate')
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['place']['coordinates'])
        self.advance(lambda d: d.update(summary='Another reviewed advancement.'))
        write_json(stale, exported)
        with self.assertRaisesRegex(ValueError, 'Candidate base changed'):
            promote_candidate(stale, 'Synthetic later stale rejection.', self.root)

    def test_atomic_field_collision_requires_explicit_choices_and_exact_reviewed_result(self):
        private = copy.deepcopy(self.saved['draft'])
        private['dossier']['observations'][0]['account'] = 'Private incompatible account.'
        current = self.advance(lambda d: d['observations'][0].update(account='Current incompatible account.'))
        payload = self.payload(private); plan = self.app.recover(payload)
        self.assertEqual(len(plan['conflicts']), 1)
        conflict = plan['conflicts'][0]
        self.assertEqual(conflict['field'], 'account')
        self.assertEqual(conflict['original']['value'], 'Original attributed account.')
        with self.assertRaisesRegex(ValueError, 'every recovery conflict'):
            self.app.recover(self.selected(payload, plan), apply=True)
        with self.assertRaisesRegex(ValueError, 'do not match'):
            self.app.recover(self.selected(payload, plan, {'99': 'private'}), apply=True)
        self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)
        for choice, expected in [('private', private['dossier']['observations'][0]['account']),
                                  ('current', current['observations'][0]['account'])]:
            reviewed = self.app.recover(self.selected(payload, plan, {'0': choice}))
            self.assertEqual(reviewed['unresolved'], [])
            self.assertEqual(reviewed['draft']['dossier']['observations'][0]['account'], expected)
        recovered = self.app.recover(self.selected(payload, plan, {'0': 'private'}), apply=True)
        self.assertEqual(recovered['draft']['dossier']['observations'][0]['account'], private['dossier']['observations'][0]['account'])

    def test_row_deletion_and_order_or_provenance_changes_cannot_disappear(self):
        current = self.advance(lambda d: (d['observations'][0].update(account='New reviewed account.'),
                                          d['observations'].append(evidence('current-extra', 'Current extra', 'synthetic-source',
                                              'Fixture', 'Added reviewed content.', 'Synthetic only.'))))
        private = copy.deepcopy(self.saved['draft']); private['dossier']['observations'] = []
        plan = self.app.recover(self.payload(private))
        self.assertEqual(plan['conflicts'][0]['field'], 'complete row')
        kept = self.app.recover(self.selected(self.payload(private), plan, {'0': 'current'}))
        self.assertEqual(kept['draft']['dossier']['observations'], current['observations'])
        removed = self.app.recover(self.selected(self.payload(private), plan, {'0': 'private'}))
        self.assertEqual([r['id'] for r in removed['draft']['dossier']['observations']], ['current-extra'])
        private = copy.deepcopy(self.saved['draft'])
        private['dossier']['observations'].insert(0, evidence('inserted-private', 'Private inserted lead', 'synthetic-source',
                                                          'Fixture', 'Private inserted content.', 'Synthetic only.'))
        private['dossier']['provenance']['authored_basis'] = 'Private authored provenance, not a publication review.'
        plan = self.app.recover(self.payload(private))
        self.assertEqual([c['field'] for c in plan['conflicts']], ['row order', 'authored_basis'])
        reviewed = self.app.recover(self.selected(self.payload(private), plan, {'0': 'private', '1': 'private'}))
        self.assertEqual([r['id'] for r in reviewed['draft']['dossier']['observations']],
                         ['inserted-private', 'synthetic-observation', 'current-extra'])
        self.assertEqual(reviewed['draft']['dossier']['provenance']['authored_basis'], private['dossier']['provenance']['authored_basis'])
        self.assertEqual(reviewed['draft']['dossier']['provenance']['publication_review'], current['provenance']['publication_review'])

    def test_complete_field_identity_keeps_bool_integer_float_distinct(self):
        base = copy.deepcopy(self.original)
        base['observations'][0]['time']['capture'] = {'synthetic_count': 1}
        private = copy.deepcopy(self.saved['draft']); private['base']['dossier_sha256'] = digest(base)
        private['dossier'] = copy.deepcopy(base); private['dossier']['observations'][0]['time']['capture']['synthetic_count'] = True
        current = copy.deepcopy(base); current['observations'][0]['time']['capture']['synthetic_count'] = 1.0
        plan = recovery_plan(base, private, current)
        self.assertEqual(plan['conflicts'][0]['field'], 'time')
        self.assertIs(type(plan['conflicts'][0]['private']['value']['capture']['synthetic_count']), bool)
        self.assertIs(type(plan['conflicts'][0]['current']['value']['capture']['synthetic_count']), float)
        self.assertNotEqual(digest(plan['conflicts'][0]['private']), digest(plan['conflicts'][0]['current']))

    def test_unverified_base_or_private_review_change_refuses_without_writing(self):
        current = self.advance(lambda d: d.update(summary='New fixture account.'))
        original_path = self.root / 'web/archive' / f"{self.original['id']}-{digest(self.original)[:20]}.json"
        original_bytes = original_path.read_bytes()
        for raw in (None, b' ' * 200_001, json.dumps(current).encode()):
            with self.subTest(raw=None if raw is None else len(raw)):
                if raw is None: original_path.unlink()
                else: original_path.write_bytes(raw)
                with self.assertRaisesRegex(ValueError, 'original'):
                    self.app.recover(self.payload())
                self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)
                original_path.write_bytes(original_bytes)
        private = copy.deepcopy(self.saved['draft'])
        private['dossier']['provenance']['publication_review'] = current['provenance']['publication_review']
        with self.assertRaisesRegex(ValueError, 'Private publication review changed'):
            self.app.recover(self.payload(private))
        for field in ('base', 'target'):
            tampered = self.payload(); tampered['draft'][field] = copy.deepcopy(tampered['draft'][field])
            if field == 'base': tampered['draft'][field]['dossier_sha256'] = 'a' * 64
            else: tampered['draft'][field]['title'] = 'A tampered target'
            with self.assertRaisesRegex(ValueError, 'saved target or original base'):
                self.app.recover(tampered)
        with patch('atlas.curator.MAX_BODY', 100):
            with self.assertRaisesRegex(ValueError, 'editor limit'):
                self.app.recover(self.payload())
        self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)

    def test_saved_or_edited_or_current_revision_changes_and_storage_failure_preserve_original(self):
        self.advance(lambda d: d.update(summary='New fixture account.'))
        payload = self.payload(); plan = self.app.recover(payload)
        changed = copy.deepcopy(self.selected(payload, plan)); changed['draft']['private_notes'] = 'Edited after preview'
        with self.assertRaisesRegex(Conflict, 'preview changed'):
            self.app.recover(changed, apply=True)
        with patch('atlas.curator.write_bytes', side_effect=OSError('Synthetic storage failure')):
            with self.assertRaises(OSError):
                self.app.recover(self.selected(payload, plan), apply=True)
        self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)
        self.advance(lambda d: d.update(summary='Advanced after preview.'))
        with self.assertRaisesRegex(Conflict, 'preview changed'):
            self.app.recover(self.selected(payload, plan), apply=True)
        plan = self.app.recover(payload)
        newer = copy.deepcopy(self.saved['draft']); newer['private_notes'] = 'Another tab saved'
        self.store.save(newer, self.saved['revision']); latest = self.store.path('returning-draft').read_bytes()
        with self.assertRaisesRegex(Conflict, 'Saved draft changed'):
            self.app.recover(self.selected(payload, plan), apply=True)
        self.assertEqual(self.store.path('returning-draft').read_bytes(), latest)

    def test_source_record_context_has_no_recovery_association(self):
        record = copy.deepcopy(self.saved['draft']); record['id'] = 'source-only'
        record['target']['kind'] = 'record'; record['base'] = {'event_id': None, 'dossier_sha256': None}
        saved = self.store.save(record, None)
        with self.assertRaisesRegex(ValueError, 'no reviewed event base'):
            self.app.recover({'draft': record, 'revision': saved['revision']})
        self.assertEqual(self.store.load('source-only'), saved)

    def test_literal_draft_transport_preserves_numeric_forms_and_existing_bounds(self):
        draft = copy.deepcopy(self.saved['draft'])
        draft['dossier']['observations'][0]['time']['capture'] = {'synthetic_count': 1.0}
        draft['private_notes'] = 'Private literal envelope ' * 1200
        text = json.dumps(draft, indent=2)
        self.assertGreater(len(text), 30000)
        parsed = decode(json.dumps({'draft_text': text, 'revision': self.saved['revision']}).encode())
        self.assertIs(type(parsed['draft']['dossier']['observations'][0]['time']['capture']['synthetic_count']), float)
        self.assertEqual(digest(parsed['draft']), digest(draft))
        for payload in ({'draft': draft, 'draft_text': text}, {'draft_text': None},
                        {'draft_text': ' ' * (MAX_DRAFT + 1)}, {'draft_text': '{"id":1,"id":2}'},
                        {'draft_text': '{"x":NaN}'}):
            with self.subTest(payload_keys=list(payload)), self.assertRaises(ValueError):
                decode(json.dumps(payload).encode())

    def test_last_current_reread_rejects_a_record_changed_during_application(self):
        current = self.advance(lambda d: d.update(summary='New fixture context.'))
        payload = self.payload(); plan = self.app.recover(payload)
        changed = copy.deepcopy(current); changed['summary'] = 'Changed during application.'
        with patch('atlas.curator.dossiers', side_effect=[[current], [changed]]):
            with self.assertRaisesRegex(Conflict, 'during recovery'):
                self.app.recover(self.selected(payload, plan), apply=True)
        self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)

    def test_different_addition_requires_choice_and_invalid_combination_cannot_save(self):
        private = copy.deepcopy(self.saved['draft'])
        own = evidence('shared-addition', 'Private addition', 'synthetic-source', 'Fixture', 'Private addition account.', 'Synthetic only.')
        private['dossier']['observations'].append(own)
        current = self.advance(lambda d: d['observations'].append(evidence('shared-addition', 'Current addition',
                                      'synthetic-source', 'Fixture', 'Current addition account.', 'Synthetic only.')))
        plan = self.app.recover(self.payload(private))
        self.assertEqual(plan['conflicts'][0]['field'], 'complete row')
        selected = self.app.recover(self.selected(self.payload(private), plan, {'0': 'private'}))
        self.assertEqual(selected['draft']['dossier']['observations'][-1], own)
        private = copy.deepcopy(self.saved['draft']); private['dossier']['sources'] = []; private['dossier']['observations'] = []
        plan = self.app.recover(self.payload(private))
        self.assertFalse(plan['valid']); self.assertIn('missing source', plan['validation_error'])
        with self.assertRaisesRegex(ValueError, 'does not validate'):
            self.app.recover(self.selected(self.payload(private), plan), apply=True)
        self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)

    def test_http_recovery_keeps_token_origin_and_bounded_shape_checks(self):
        self.advance(lambda d: d.update(summary='New fixture account.'))
        httpd = server(self.app)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True); thread.start()
        self.addCleanup(thread.join, 2); self.addCleanup(httpd.server_close); self.addCleanup(httpd.shutdown)
        def request(route, payload, overrides=None):
            conn = http.client.HTTPConnection('127.0.0.1', httpd.server_address[1], timeout=5)
            headers = {'X-Curator-Token': self.app.token, 'Origin': self.app.origin, 'Content-Type': 'application/json'}
            headers.update(overrides or {})
            conn.request('POST', route, json.dumps(payload), headers)
            response = conn.getresponse(); status, raw = response.status, response.read(); conn.close()
            return status, json.loads(raw)
        for route in ('/api/recovery-preview', '/api/recovery-save'):
            self.assertEqual(request(route, self.payload(), {'X-Curator-Token': ''})[0], 403)
            self.assertEqual(request(route, self.payload(), {'Origin': 'https://example.org'})[0], 403)
            self.assertEqual(request(route, {'draft': self.saved['draft']})[0], 400)
        status, plan = request('/api/recovery-preview', self.payload())
        self.assertEqual(status, 200); self.assertEqual(self.store.path('returning-draft').read_bytes(), self.before)
        status, result = request('/api/recovery-save', self.selected(self.payload(), plan))
        self.assertEqual(status, 200); self.assertEqual(result, self.store.load('returning-draft'))
        self.assertEqual(request('/api/recovery-save', self.selected(self.payload(), plan))[0], 409)


if __name__ == '__main__':
    unittest.main()
