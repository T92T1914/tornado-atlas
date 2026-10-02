import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

from atlas.archive import digest, dossiers, validate_dossier
from atlas.curator import App, Conflict, MAX_BODY, MAX_DRAFT, ROOT, Store, candidate, decode, encoded, intake, server


def sample():
    return {'key': 'robinson-clock-lead', 'kind': 'video', 'title': 'Retained paused dashcam sample',
            'url': 'https://www.youtube.com/watch?v=MxgU1QcFMJM', 'locator': 'Paused sample at presentation second 5',
            'account': 'Retained source clock sample, not a continuous reconstruction.',
            'limits': 'No newly inspected footage, camera position or bearing.', 'creator': 'Dan Robinson',
            'uploader': '', 'rights_holder': '', 'attribution_basis': 'Retained source attribution',
            'rights': 'links_only', 'rights_note': 'Original source link only. No footage acquired.',
            'capture_text': 'Reported GPS synchronized CDT clock, exact source claim retained.',
            'publication_text': '', 'retrieval_text': 'Retained record, no new access', 'place_text': 'Unregistered camera',
            'video_start': 5, 'video_end': 5}


class CuratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = dossiers()[0]

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = Store(Path(self.temp.name) / 'private')
        self.draft = {'schema_version': 1, 'id': 'el-reno-review',
                      'target': {'kind': 'event', 'id': self.base['id'], 'title': self.base['title']},
                      'base': {'event_id': self.base['id'], 'dossier_sha256': digest(self.base)},
                      'dossier': copy.deepcopy(self.base), 'private_notes': 'Private permission question', 'intake': {}}

    def test_save_reopen_conflict_and_atomic_failure(self):
        first = self.store.save(self.draft, None)
        changed = copy.deepcopy(self.draft)
        changed['private_notes'] = 'A later edit'
        saved = self.store.save(changed, first['revision'])
        self.assertEqual(saved, self.store.load(self.draft['id']))
        with self.assertRaises(Conflict):
            self.store.save(self.draft, first['revision'])
        with patch('atlas.curator.write_bytes', side_effect=OSError('simulated disk failure')):
            with self.assertRaises(OSError):
                self.store.save(self.draft, saved['revision'])
        self.assertEqual(saved, self.store.load(self.draft['id']))
        self.assertEqual(saved, self.store.save(changed, saved['revision']))

    def test_save_preserves_distinct_canonical_numeric_values(self):
        for index, (before, after) in enumerate(((1, True), (1, 1.0), (0, False), (0, -0.0))):
            with self.subTest(before=before, after=after):
                original = copy.deepcopy(self.draft)
                original['id'] = f'numeric-save-{index}'
                original['dossier']['provenance']['synthetic_count'] = before
                saved = self.store.save(original, None)
                changed = copy.deepcopy(original)
                changed['dossier']['provenance']['synthetic_count'] = after
                self.assertEqual(original, changed)
                self.assertNotEqual(digest(original), digest(changed))
                updated = self.store.save(changed, saved['revision'])
                self.assertEqual(digest(updated['draft']), digest(changed))
                self.assertNotEqual(updated['revision'], saved['revision'])
                self.assertEqual(self.store.load(original['id']), updated)
                with self.assertRaises(Conflict):
                    self.store.save(original, saved['revision'])

    def test_restore_rejects_distinct_canonical_numeric_values_before_writing(self):
        for index, (before, after) in enumerate(((1, True), (1, 1.0), (0, False), (0, -0.0))):
            with self.subTest(before=before, after=after):
                original = copy.deepcopy(self.draft)
                original['id'] = f'numeric-restore-{index}'
                original['dossier']['provenance']['synthetic_count'] = before
                saved = self.store.save(original, None)
                changed = copy.deepcopy(original)
                changed['dossier']['provenance']['synthetic_count'] = after
                extra = copy.deepcopy(self.draft)
                extra['id'] = f'new-before-numeric-conflict-{index}'
                backup = {'schema_version': 1, 'kind': 'private-curator-backup',
                          'drafts': [extra, changed]}
                raw = self.store.path(original['id']).read_bytes()
                self.assertEqual(original, changed)
                self.assertNotEqual(digest(original), digest(changed))
                with self.assertRaises(Conflict):
                    self.store.restore(backup)
                self.assertFalse(self.store.path(extra['id']).exists())
                self.assertEqual(self.store.path(original['id']).read_bytes(), raw)
                self.assertEqual(self.store.load(original['id']), saved)

    def test_canonical_identity_keeps_equivalent_saved_bytes_and_restore(self):
        saved = self.store.save(self.draft, None)
        path = self.store.path(self.draft['id'])
        raw = (json.dumps(self.draft, ensure_ascii=False, separators=(',', ':')) + '\r\n').encode()
        path.write_bytes(raw)
        saved = self.store.load(self.draft['id'])
        reordered = dict(reversed(list(self.draft.items())))
        self.assertEqual(digest(reordered), digest(self.draft))
        self.assertEqual(self.store.save(reordered, saved['revision']), saved)
        self.assertEqual(self.store.restore({'schema_version': 1, 'kind': 'private-curator-backup',
                                             'drafts': [reordered]}),
                         {'restored': [], 'unchanged': 1})
        self.assertEqual(path.read_bytes(), raw)

    def test_idempotent_intake_and_distinct_clocks_roles(self):
        changed, added = intake(self.draft, sample())
        self.assertTrue(added)
        repeated, added = intake(changed, sample())
        self.assertFalse(added)
        self.assertEqual(changed, repeated)
        different = sample() | {'account': 'A source revision needs its own key'}
        with self.assertRaises(Conflict):
            intake(changed, different)
        item = changed['dossier']['media'][-1]
        self.assertEqual(item['time']['video'], {'start_seconds': 5, 'end_seconds': 5})
        self.assertIsNone(item['time']['alignment'])
        self.assertIsNone(item['place']['coordinates'])
        self.assertIsNone(item['roles']['uploader'])
        self.assertIsNone(item['roles']['rights_holder'])
        self.assertEqual(item['status']['availability'], 'not_researched')
        self.assertEqual(item['status']['intake'], 'candidate')

    def test_serialized_size_limit_cannot_poison_saved_store_or_partial_restore(self):
        saved = self.store.save(self.draft, None)
        oversized = copy.deepcopy(self.draft)
        template = copy.deepcopy(oversized['dossier']['observations'][0])
        for i in range(1000):
            item = copy.deepcopy(template)
            item['id'] = f'bounded-size-{i}'
            oversized['dossier']['observations'].append(item)
            if len(encoded(oversized)) > MAX_DRAFT:
                break
        self.assertLess(len(json.dumps(oversized, ensure_ascii=False).encode('utf-8')), MAX_DRAFT)
        with self.assertRaisesRegex(ValueError, 'Draft exceeds'):
            self.store.save(oversized, saved['revision'])
        self.assertEqual(saved, self.store.load(self.draft['id']))

        self.assertEqual(len(self.store.listing()), 1)
        self.assertEqual(self.store.backup()['drafts'], [self.draft])
        new = copy.deepcopy(self.draft)
        new['id'] = 'new-before-oversized'
        oversized['id'] = 'oversized-rejected'
        backup = {'schema_version': 1, 'kind': 'private-curator-backup', 'drafts': [new, oversized]}
        with self.assertRaisesRegex(ValueError, 'Draft exceeds'):
            self.store.restore(backup)
        self.assertFalse(self.store.path(new['id']).exists())
        self.assertFalse(self.store.path(oversized['id']).exists())
        self.assertEqual(saved, self.store.load(self.draft['id']))

    def test_intake_rejects_noncanonical_private_hosts_without_changing_draft(self):
        original = copy.deepcopy(self.draft)
        for url in ['https://127.1/source', 'https://0300.0250.1.1/source',
                    'https://%31%32%37.0.0.1/source']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                intake(self.draft, sample() | {'url': url})
            self.assertEqual(self.draft, original)

    def test_export_is_candidate_with_base_and_no_private_notes(self):
        original = copy.deepcopy(self.draft)
        exported = candidate(self.draft)
        self.assertEqual(exported['base']['dossier_sha256'], digest(self.base))
        self.assertNotIn('Private permission question', json.dumps(exported))
        self.assertNotIn('private_notes', exported)
        self.assertEqual(exported['kind'], 'atlas-curator-candidate')
        validate_dossier(exported['dossier'])
        for before, after in zip(original['dossier']['media'], exported['dossier']['media']):
            self.assertEqual(before['status'] | {'intake': 'candidate'}, after['status'])
            self.assertEqual(before['time'], after['time'])
            self.assertEqual(before['place'], after['place'])
        self.assertEqual(original, self.draft)

    def test_malformed_source_text_cannot_save_export_or_partially_restore(self):
        saved = self.store.save(self.draft, None)
        before = self.store.path(self.draft['id']).read_bytes()
        valid_new = copy.deepcopy(self.draft)
        valid_new['id'] = 'before-malformed-source'
        bad_values = {'title': '', 'url': None, 'locator': {'figure': 1},
                      'access': 7, 'revision': True, 'rights': ['links only'],
                      'agent_processing': 42}
        for field, value in bad_values.items():
            with self.subTest(field=field):
                bad = copy.deepcopy(self.draft)
                bad['dossier']['sources'][0][field] = value
                with self.assertRaises(ValueError):
                    candidate(bad)
                with self.assertRaises(ValueError):
                    self.store.save(bad, saved['revision'])
                backup = {'schema_version': 1, 'kind': 'private-curator-backup',
                          'drafts': [valid_new, bad]}
                with self.assertRaises(ValueError):
                    self.store.restore(backup)
                self.assertFalse(self.store.path(valid_new['id']).exists())
                self.assertEqual(self.store.path(self.draft['id']).read_bytes(), before)
                self.assertEqual(self.store.load(self.draft['id']), saved)
        self.assertEqual(self.draft['dossier'], self.base)

    def test_backup_restore_preflight_conflicts_and_idempotency(self):
        self.store.save(self.draft, None)
        backup = self.store.backup()
        other = Store(Path(self.temp.name) / 'restored')
        self.assertEqual(other.restore(backup)['restored'], [self.draft['id']])
        self.assertEqual(other.restore(backup)['unchanged'], 1)
        bad = copy.deepcopy(backup)
        bad['drafts'][0]['private_notes'] = 'Conflicting version'
        extra = copy.deepcopy(self.draft); extra['id'] = 'new-before-conflict'
        bad['drafts'].insert(0, extra)
        with self.assertRaises(Conflict):
            other.restore(bad)
        self.assertFalse(other.path(extra['id']).exists())
        self.assertEqual(other.backup(), backup)

    def test_one_saved_draft_recovers_private_content_when_whole_backup_is_too_large(self):
        selected, _ = intake(self.draft, sample())
        selected['private_notes'] = 'PRIVATE selected research notes ' * 800
        saved = self.store.save(selected, None)
        for number in range(99):
            other = copy.deepcopy(self.draft)
            other['id'] = f'unrelated-{number}'
            other['private_notes'] = 'PRIVATE unrelated research notes ' * 800
            self.store.save(other, None)
            # Stop at the first supported store that cannot use a whole backup.
            try:
                self.store.backup()
            except ValueError as error:
                self.assertIn('Export individual drafts', str(error))
                break
        else:
            self.fail('The bounded fixture did not reach the whole-backup limit')
        before = {p.name: p.read_bytes() for p in self.store.root.glob('*.json')}
        with self.assertRaisesRegex(ValueError, 'Export individual drafts'):
            self.store.backup()
        backup = self.store.backup_draft(selected['id'], saved['revision'])
        self.assertEqual(backup, {'schema_version': 1, 'kind': 'private-curator-backup',
                                  'drafts': [selected]})
        self.assertLessEqual(len(encoded(backup)), MAX_BODY)
        self.assertNotIn('PRIVATE unrelated research notes', json.dumps(backup))
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.store.root.glob('*.json')})

        recovered = Store(Path(self.temp.name) / 'one-draft-recovery')
        self.assertEqual(recovered.restore(backup), {'restored': [selected['id']], 'unchanged': 0})
        self.assertEqual(recovered.load(selected['id']), saved)
        self.assertEqual(recovered.restore(backup), {'restored': [], 'unchanged': 1})
        conflict = copy.deepcopy(backup)
        conflict['drafts'][0]['private_notes'] = 'A different saved version'
        extra = copy.deepcopy(self.draft)
        extra['id'] = 'before-private-backup-conflict'
        conflict['drafts'].insert(0, extra)
        with self.assertRaises(Conflict):
            recovered.restore(conflict)
        self.assertFalse(recovered.path(extra['id']).exists())
        self.assertEqual(recovered.load(selected['id']), saved)

        public = candidate(selected)
        self.assertNotIn('private_notes', public)
        self.assertNotIn(selected['private_notes'], json.dumps(public))
        self.assertNotIn('intake', public)
        with self.assertRaisesRegex(ValueError, 'Expected a private curator backup'):
            recovered.restore(public)

    def test_saved_draft_backup_checks_revision_identity_and_size_without_writing(self):
        first = self.store.save(self.draft, None)
        changed = copy.deepcopy(self.draft)
        changed['private_notes'] = 'Newer saved notes'
        latest = self.store.save(changed, first['revision'])
        before = self.store.path(self.draft['id']).read_bytes()
        with self.assertRaisesRegex(Conflict, 'Reopen it before downloading'):
            self.store.backup_draft(self.draft['id'], first['revision'])
        for identity in ('../outside', 'x/y', 'UPPER', 'a' * 81, None):
            with self.subTest(identity=identity), self.assertRaises(ValueError):
                self.store.backup_draft(identity, latest['revision'])
        with self.assertRaises(FileNotFoundError):
            self.store.backup_draft('missing-saved-draft', latest['revision'])
        backup = self.store.backup_draft(self.draft['id'], latest['revision'])
        with patch('atlas.curator.MAX_BODY', len(encoded(backup))):
            self.assertEqual(self.store.backup_draft(self.draft['id'], latest['revision']), backup)
        with patch('atlas.curator.MAX_BODY', len(encoded(backup)) - 1):
            with self.assertRaisesRegex(ValueError, 'bounded import size'):
                self.store.backup_draft(self.draft['id'], latest['revision'])
        self.store.path('oversized-saved-draft').write_bytes(b' ' * (MAX_DRAFT + 1))
        with self.assertRaisesRegex(ValueError, 'Saved draft exceeds'):
            self.store.backup_draft('oversized-saved-draft', None)
        self.assertEqual(self.store.path(self.draft['id']).read_bytes(), before)

    def test_invalid_paths_payload_and_media_are_rejected(self):
        for identity in ('../outside', 'x/y', 'UPPER', 'a' * 81):
            with self.assertRaises(ValueError):
                self.store.path(identity)
        with self.assertRaises(ValueError):
            Store(ROOT / 'web/private-test')
        with self.assertRaises(ValueError):
            decode(b'{"id":1,"id":2}')
        with self.assertRaises(ValueError):
            decode(b'{"x":NaN}')
        for row in (sample() | {'url': 'https://127.0.0.1/private'}, sample() | {'video_end': 4},
                    sample() | {'rights': 'permitted_hosting'}, sample() | {'attribution_basis': ''}):
            with self.assertRaises(ValueError):
                intake(self.draft, row)
        self.store.path('oversized').write_bytes(b' ' * (MAX_DRAFT + 1))
        with self.assertRaises(ValueError):
            self.store.load('oversized')

    def test_http_loopback_nonce_origin_and_private_store_boundaries(self):
        app = App.__new__(App)
        app.store, app.root, app.token, app.origin = self.store, ROOT, 'test-session-only', None
        app.events = {self.base['id']: copy.deepcopy(self.base)}
        app.records = [{'id': 'ncei:432342', 'title': 'A sparse source', 'date': '2013-01-01'}]
        httpd = server(app)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True); thread.start()
        self.addCleanup(thread.join, 2)
        self.addCleanup(httpd.server_close)
        self.addCleanup(httpd.shutdown)
        def request(method, path, value=None, headers=None):
            connection = http.client.HTTPConnection('127.0.0.1', httpd.server_address[1], timeout=5)
            payload = json.dumps(value) if value is not None else None
            base = {'X-Curator-Token': app.token, 'Origin': app.origin, 'Content-Type': 'application/json'}
            base.update(headers or {})
            connection.request(method, path, body=payload, headers=base)
            response = connection.getresponse(); content = response.read(); status = response.status; connection.close()
            return status, content
        self.assertEqual(request('GET', '/api/session', headers={'X-Curator-Token': ''})[0], 403)
        self.assertEqual(request('GET', '/api/session', headers={'Host': 'untrusted.example'})[0], 403)
        self.assertEqual(request('POST', '/api/new', {}, {'Origin': 'https://example.org'})[0], 403)
        self.assertEqual(request('GET', '/private/el-reno-review.json')[0], 404)
        self.assertEqual(request('GET', '/../README.md')[0], 404)
        self.assertEqual(request('GET', '/api/session')[0], 200)
        status, raw = request('POST', '/api/new', {'id': 'event-copy', 'kind': 'event', 'target': self.base['id']})
        self.assertEqual(status, 201)
        saved = json.loads(raw)
        backup_request = {'id': saved['draft']['id'], 'revision': saved['revision']}
        self.assertEqual(request('POST', '/api/backup-draft', backup_request,
                                 {'X-Curator-Token': ''})[0], 403)
        self.assertEqual(request('POST', '/api/backup-draft', backup_request,
                                 {'Origin': 'https://example.org'})[0], 403)
        self.assertEqual(request('POST', '/api/backup-draft', {'id': '../outside',
                                 'revision': saved['revision']})[0], 400)
        self.assertEqual(request('POST', '/api/backup-draft', {'id': 'missing-draft',
                                 'revision': saved['revision']})[0], 404)
        self.assertEqual(request('POST', '/api/backup-draft', {'id': saved['draft']['id']})[0], 400)
        self.assertEqual(request('POST', '/api/backup-draft', backup_request | {'revision': 'stale'})[0], 409)
        status, raw = request('POST', '/api/backup-draft', backup_request)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw), {'schema_version': 1, 'kind': 'private-curator-backup',
                                          'drafts': [saved['draft']]})
        self.assertEqual(self.store.load(saved['draft']['id']), saved)
        self.assertEqual(request('POST', '/api/save', {'draft': saved['draft'], 'revision': 'stale'})[0], 409)
        status, raw = request('POST', '/api/new', {'id': 'record-copy', 'kind': 'record', 'target': 'ncei:432342'})
        self.assertEqual(status, 201)
        record = json.loads(raw)['draft']
        self.assertEqual(record['dossier']['records'], [])
        self.assertIsNone(candidate(record)['base']['event_id'])
        contender = Store(self.store.root)
        with self.assertRaises(Conflict):
            contender.acquire_writer()


if __name__ == '__main__':
    unittest.main()
