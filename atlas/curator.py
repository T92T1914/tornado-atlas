"""Private loopback authoring for validated archive dossier candidates.

Run with an explicit store outside the repository. Nothing in this service
publishes a draft, fetches media, or changes the checked-in source catalogue.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import re
import secrets
import threading
from urllib.parse import parse_qs, urlsplit

from .archive import ROOT, archive_bytes, clocks, digest, dossier_changes, dossiers, public_url, validate_dossier
from .publication import write_bytes

MAX_BODY = 2_000_000
MAX_DRAFT = 250_000
ID = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*\Z')
ASSETS = {'curator.html', 'curator.mjs', 'curator.css', 'style.css', 'appearance.css', 'appearance.js'}


class Conflict(ValueError):
    """The saved revision changed or an intake key has conflicting content."""


def bounded(value, depth=0):
    if depth > 16:
        raise ValueError('Nested data exceeds the editor limit')
    if isinstance(value, str) and len(value) > 30_000:
        raise ValueError('Text field exceeds the editor limit')
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError('Nonfinite numbers are not supported')
    if isinstance(value, (dict, list)):
        if len(value) > 2_000:
            raise ValueError('Collection exceeds the editor limit')
        for item in value.values() if isinstance(value, dict) else value:
            bounded(item, depth + 1)


def decode(raw):
    if len(raw) > MAX_BODY:
        raise ValueError('Request exceeds the editor limit')
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('Repeated JSON key')
            result[key] = value
        return result
    value = json.loads(raw, object_pairs_hook=pairs)
    # A literal draft envelope avoids JavaScript Number normalization. Parse it
    # once with the same duplicate-key and finite/editor checks as normal JSON.
    if isinstance(value, dict) and 'draft_text' in value:
        text = value.pop('draft_text')
        if 'draft' in value or not isinstance(text, str) or len(text.encode('utf-8')) > MAX_DRAFT:
            raise ValueError('One bounded literal draft is required')
        value['draft'] = json.loads(text, object_pairs_hook=pairs)
    bounded(value)
    return value


def encoded(value):
    """Use the same bounded UTF-8 representation for stored and backup files."""
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def check_draft(draft):
    if not isinstance(draft, dict) or set(draft) != {'schema_version', 'id', 'target', 'base', 'dossier', 'private_notes', 'intake'}:
        raise ValueError('Unexpected draft fields')
    if draft['schema_version'] != 1 or not isinstance(draft['id'], str) or not ID.fullmatch(draft['id']):
        raise ValueError('Invalid draft identity')
    if len(draft['id']) > 80 or not isinstance(draft['private_notes'], str):
        raise ValueError('Invalid draft identity or notes')
    if set(draft['target']) != {'kind', 'id', 'title'} or draft['target']['kind'] not in {'event', 'record'}:
        raise ValueError('Explicit event or source-record context required')
    if not all(isinstance(draft['target'][k], str) for k in ('id', 'title')):
        raise ValueError('Target fields must be text')
    if set(draft['base']) != {'event_id', 'dossier_sha256'}:
        raise ValueError('Base identity is required')
    if draft['target']['kind'] == 'event':
        if draft['base']['event_id'] != draft['target']['id'] or not isinstance(draft['base']['dossier_sha256'], str) or not re.fullmatch('[0-9a-f]{64}', draft['base']['dossier_sha256']):
            raise ValueError('Event draft needs its original generated dossier identity')
    elif draft['base'] != {'event_id': None, 'dossier_sha256': None}:
        raise ValueError('A source-record draft has no reviewed event base')
    if not isinstance(draft['intake'], dict) or any(not ID.fullmatch(k) for k in draft['intake']):
        raise ValueError('Invalid intake ledger')
    validate_dossier(draft['dossier'])
    bounded(draft)
    if len(encoded(draft)) > MAX_DRAFT:
        raise ValueError('Draft exceeds the editor limit')
    return draft


class Store:
    def __init__(self, location: Path):
        self.root = location.resolve()
        if self.root == ROOT or ROOT in self.root.parents:
            raise ValueError('Choose a private store outside the repository and public web tree')
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.writer = None

    def acquire_writer(self):
        """One cooperating local server can write this store at a time."""
        path = self.root / '.writer.lock'
        if path.is_symlink():
            raise ValueError('Store lock cannot be a link')
        stream = path.open('a+b')
        try:
            if path.stat().st_size == 0:
                stream.write(b'0')
                stream.flush()
            stream.seek(0)
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            stream.close()
            raise Conflict('Another curator server owns this private store') from error
        self.writer = stream

    def release_writer(self):
        if self.writer is not None:
            self.writer.close()
            self.writer = None

    def path(self, identity):
        if not isinstance(identity, str) or len(identity) > 80 or not ID.fullmatch(identity):
            raise ValueError('Invalid draft identity')
        path = self.root / (identity + '.json')
        if path.is_symlink() or path.resolve().parent != self.root:
            raise ValueError('Draft links are not supported')
        return path

    def load(self, identity):
        path = self.path(identity)
        if not path.exists():
            raise FileNotFoundError('Draft not found')
        with self.lock:
            if path.stat().st_size > MAX_DRAFT:
                raise ValueError('Saved draft exceeds the editor limit')
            raw = path.read_bytes()
            draft = check_draft(decode(raw))
            if draft['id'] != identity:
                raise ValueError('Saved draft identity does not match its filename')
            return {'draft': draft, 'revision': hashlib.sha256(raw).hexdigest()}

    def save(self, draft, expected):
        check_draft(draft)
        path = self.path(draft['id'])
        with self.lock:
            current = self.load(draft['id']) if path.exists() else None
            revision = current['revision'] if current else None
            if expected != revision:
                raise Conflict('Saved draft changed. Reopen it before applying this edit. No file was overwritten.')
            if current and digest(current['draft']) == digest(draft):
                return current
            if not current and len(list(self.root.glob('*.json'))) >= 100:
                raise ValueError('Store is limited to 100 drafts')
            raw = encoded(draft)
            write_bytes(path, raw)
            return {'draft': copy.deepcopy(draft), 'revision': hashlib.sha256(raw).hexdigest()}

    def listing(self):
        with self.lock:
            result = []
            for p in sorted(self.root.glob('*.json')):
                record = self.load(p.stem)
                result.append({'id': p.stem, 'title': record['draft']['dossier']['title'], 'revision': record['revision']})
            return result

    def backup(self):
        with self.lock:
            result = {'schema_version': 1, 'kind': 'private-curator-backup',
                      'drafts': [self.load(row['id'])['draft'] for row in self.listing()]}
            if len(encoded(result)) > MAX_BODY:
                raise ValueError('Backup exceeds the bounded import size. Export individual drafts instead.')
            return result

    def backup_draft(self, identity, expected):
        """Back up one saved revision without including another draft or saving edits."""
        with self.lock:
            saved = self.load(identity)
            if expected != saved['revision']:
                raise Conflict('Saved draft changed. Reopen it before downloading its private backup.')
            result = {'schema_version': 1, 'kind': 'private-curator-backup',
                      'drafts': [saved['draft']]}
            if len(encoded(result)) > MAX_BODY:
                raise ValueError('Saved draft backup exceeds the bounded import size')
            return result

    def restore(self, backup):
        if not isinstance(backup, dict) or set(backup) != {'schema_version', 'kind', 'drafts'} or backup['schema_version'] != 1 or backup['kind'] != 'private-curator-backup':
            raise ValueError('Expected a private curator backup')
        if not isinstance(backup['drafts'], list) or len(backup['drafts']) > 100:
            raise ValueError('Too many backup drafts')
        drafts = [check_draft(d) for d in backup['drafts']]
        if len({d['id'] for d in drafts}) != len(drafts):
            raise ValueError('Duplicate draft in backup')
        with self.lock:
            # Preflight the complete batch. Existing differing content is never replaced.
            existing = self.listing()
            names = {d['id'] for d in existing}
            if len(names | {d['id'] for d in drafts}) > 100:
                raise ValueError('Restored store would exceed 100 drafts')
            for draft in drafts:
                if draft['id'] in names and digest(self.load(draft['id'])['draft']) != digest(draft):
                    raise Conflict('Backup differs from an existing draft. Restore into a separate private store.')
            restored = []
            for draft in drafts:
                if draft['id'] not in names:
                    self.save(draft, None)
                    restored.append(draft['id'])
            return {'restored': restored, 'unchanged': len(drafts) - len(restored)}


def candidate(draft):
    check_draft(draft)
    result = copy.deepcopy(draft['dossier'])
    for item in result['observations'] + result['media']:
        item['status']['intake'] = 'candidate'
    result['provenance']['curator'] = {'draft_id': draft['id'], 'state': 'candidate',
                                     'target': draft['target'], 'private_notes_included': False}
    return {'schema_version': 1, 'kind': 'atlas-curator-candidate',
            'base': copy.deepcopy(draft['base']), 'dossier': validate_dossier(result)}


def intake(draft, row):
    required = {'key', 'kind', 'title', 'url', 'locator', 'account', 'limits', 'creator', 'uploader',
                'rights_holder', 'attribution_basis', 'rights', 'rights_note', 'capture_text',
                'publication_text', 'retrieval_text', 'place_text', 'video_start', 'video_end'}
    if not isinstance(row, dict) or set(row) != required or not ID.fullmatch(row.get('key', '')):
        raise ValueError('Complete bounded intake fields and a stable key are required')
    if row['kind'] not in {'lead', 'photograph', 'video', 'radar', 'map'} or row['rights'] not in {'links_only', 'unknown', 'restricted'}:
        raise ValueError('Intake supports leads and source links, never automatic media hosting')
    for key in required - {'video_start', 'video_end'}:
        if not isinstance(row[key], str) or len(row[key]) > 8000:
            raise ValueError('Intake text field is invalid or too long')
    if len(row['key']) > 60 or not all(row[k].strip() for k in ('title', 'locator', 'account', 'limits', 'rights_note')):
        raise ValueError('Title, exact locator, account, limits and rights note are required')
    public_url(row['url'])
    start, end = row['video_start'], row['video_end']
    if row['kind'] == 'video':
        if any(type(v) not in {int, float} or not math.isfinite(v) for v in (start, end)) or not 0 <= start <= end <= 24 * 60 * 60:
            raise ValueError('Video annotation needs a bounded start and end in presentation seconds')
    elif start is not None or end is not None:
        raise ValueError('Only video records have presentation-time segments')
    row_hash = digest(row)
    known = draft['intake'].get(row['key'])
    if known:
        if known != row_hash:
            raise Conflict('This intake key already has different content. Keep the original and use a new revision key.')
        return copy.deepcopy(draft), False
    result = copy.deepcopy(draft)
    doc = result['dossier']
    prefix = 'intake-' + row['key']
    creators = {}
    for role in ('creator', 'uploader', 'rights_holder'):
        name = row[role].strip()
        if name and not row['attribution_basis'].strip():
            raise ValueError('Attributed names require a source basis')
        identifier = prefix + '-' + role if name else None
        creators[role] = identifier
        if identifier:
            doc['creators'].append({'id': identifier, 'name': name, 'basis': row['attribution_basis']})
    source_id = prefix + '-source'
    doc['sources'].append({'id': source_id, 'title': row['title'], 'url': row['url'], 'locator': row['locator'],
                          'access': 'Curator intake. Source content has not been independently reviewed by this editor.',
                          'revision': 'Intake content SHA-256 ' + row_hash,
                          'rights': row['rights_note'], 'agent_processing': 'Local structured intake. No human approval or source inspection is inferred.'})
    item = {'id': prefix, 'title': row['title'], 'source_id': source_id, 'locator': row['locator'],
            'account': row['account'], 'limits': row['limits'],
            'status': {'intake': 'candidate', 'assertion': 'not_researched', 'temporal': 'unregistered',
                       'spatial': 'unregistered', 'availability': 'not_researched', 'rights': row['rights']},
            'time': clocks(capture={'reported_text': row['capture_text']} if row['capture_text'] else None,
                           publication=row['publication_text'] or None, retrieval=row['retrieval_text'] or None,
                           video={'start_seconds': start, 'end_seconds': end} if row['kind'] == 'video' else None),
            'place': {'role': 'camera' if row['kind'] in {'video', 'photograph'} else 'not_applicable',
                      'reported': row['place_text'] or None, 'coordinates': None,
                      'basis': 'Unregistered intake text. No camera or subject coordinate is inferred.'},
            'review': 'Unreviewed curator lead. No temporal or spatial registration has been accepted.'}
    if row['kind'] != 'lead':
        item.update(kind=row['kind'], url=row['url'], roles=creators, parent=None,
                    transformation='Source link and annotation only. No media bytes acquired, altered or hosted.')
        doc['media'].append(item)
    else:
        doc['observations'].append(item)
    result['intake'][row['key']] = row_hash
    return check_draft(result), True


def empty_record(record):
    identity = 'record-' + re.sub('[^a-z0-9]+', '-', record['id'].lower()).strip('-')
    return {'schema_version': 1, 'id': identity, 'title': record['title'], 'coverage': 'Catalogued',
            'summary': 'Private source-record research draft. No whole-event association is inferred.',
            'records': [], 'routes': [], 'creators': [], 'sources': [], 'observations': [], 'media': [],
            'reconstruction': {'appearance': 'unregistered', 'intervals': [], 'limits': 'Not researched.'},
            'provenance': {'curator_target_record': record['id']}}


def recovery_plan(original, draft, current, choices=None):
    """Carry private field edits onto a fresh account using the archive classifier.

    Values are atomic at the existing field boundary. Order and authored
    provenance need separate deliberate choices because dossier_changes keeps
    them outside its historical field account. No publication review is created.
    """
    check_draft(draft)
    private = draft['dossier']
    if not all(doc['id'] == draft['base']['event_id'] for doc in (original, private, current)):
        raise ValueError('Recovery requires the same reviewed event identity')
    if digest(original) != draft['base']['dossier_sha256']:
        raise ValueError('Retained original does not match the complete draft base identity')
    def value(mapping, key):
        return {'present': key in mapping, 'value': mapping.get(key)}
    if digest(value(private['provenance'], 'publication_review')) != digest(value(original['provenance'], 'publication_review')):
        raise ValueError('Private publication review changed. Keep this draft and inspect its provenance manually; recovery cannot treat it as new approval.')
    choices = {} if choices is None else choices
    if not isinstance(choices, dict) or any(not isinstance(k, str) or v not in ('private', 'current') for k, v in choices.items()):
        raise ValueError('Each recovery choice must select private or current')
    result = copy.deepcopy(current)
    conflicts, carried = [], []
    def collision(kind, identifier, field, before, edited, latest):
        key = str(len(conflicts))
        conflicts.append({'key': key, 'kind': kind, 'id': identifier, 'field': field,
                          'original': copy.deepcopy(before), 'private': copy.deepcopy(edited), 'current': copy.deepcopy(latest)})
        return choices.get(key) == 'private'
    def put(mapping, field, selected):
        if selected['present']:
            mapping[field] = copy.deepcopy(selected['value'])
        else:
            mapping.pop(field, None)
    private_changes = dossier_changes(original, private)
    current_changes = dossier_changes(original, current)
    for change in private_changes:
        kind, identifier = change['kind'], change['id']
        if kind == 'dossier':
            before, edited, latest, output = original, private, current, result
        else:
            old = {r['id']: r for r in original[kind]}
            own = {r['id']: r for r in private[kind]}
            new = {r['id']: r for r in current[kind]}
            before, edited, latest = old.get(identifier), own.get(identifier), new.get(identifier)
            if change['change'] != 'updated' or latest is None:
                if digest(edited) == digest(latest):
                    continue
                use_private = digest(latest) == digest(before)
                if not use_private:
                    use_private = collision(kind, identifier, 'complete row', before, edited, latest)
                if use_private:
                    result[kind] = [r for r in result[kind] if r['id'] != identifier]
                    if edited is not None:
                        result[kind].append(copy.deepcopy(edited))
                    carried.append(change)
                continue
            output = next(r for r in result[kind] if r['id'] == identifier)
        for field in change['fields']:
            b, d, u = value(before, field), value(edited, field), value(latest, field)
            if digest(d) == digest(u):
                continue
            use_private = digest(u) == digest(b)
            if not use_private:
                use_private = collision(kind, identifier, field, b, d, u)
            if use_private:
                put(output, field, d)
                carried.append({'kind': kind, 'id': identifier, 'change': 'updated', 'fields': [field]})
    for kind in ('sources', 'observations', 'media', 'creators', 'records'):
        b = [r['id'] for r in original[kind]]
        d = [r['id'] for r in private[kind]]
        u = [r['id'] for r in current[kind]]
        rows = {r['id']: r for r in result[kind]}
        # Current order stays intact. Compatible private additions follow their
        # private order after current content, independent of sorted changes.
        order = [i for i in u if i in rows] + [i for i in d if i in rows and i not in u]
        expected = [i for i in b if i in d] + [i for i in d if i not in b]
        if d != expected:
            if collision(kind, private['id'], 'row order', b, d, u):
                order = [i for i in d if i in rows] + [i for i in u if i in rows and i not in d]
        result[kind] = [rows[i] for i in order]
    for field in sorted((original['provenance'].keys() | private['provenance'].keys()) - {'publication_review'}):
        b = value(original['provenance'], field)
        d = value(private['provenance'], field)
        u = value(current['provenance'], field)
        if digest(b) != digest(d) and digest(d) != digest(u):
            if collision('provenance', private['id'], field, b, d, u):
                put(result['provenance'], field, d)
    keys = {c['key'] for c in conflicts}
    if choices.keys() - keys:
        raise ValueError('Recovery choices do not match this preview')
    recovered = copy.deepcopy(draft)
    recovered['base'] = {'event_id': current['id'], 'dossier_sha256': digest(current)}
    recovered['dossier'] = result
    unresolved = [c['key'] for c in conflicts if c['key'] not in choices]
    # An unresolved deletion can temporarily break references. Do not present
    # an invalid intermediate result as a validated or savable draft.
    valid = False
    problem = None
    try:
        check_draft(recovered)
        valid = True
    except ValueError as error:
        problem = str(error)
    plan = {'event_id': current['id'], 'original_sha256': digest(original),
            'current_sha256': digest(current), 'edited_sha256': digest(draft),
            'private_changes': private_changes, 'current_changes': current_changes,
            'carried': carried, 'conflicts': conflicts, 'unresolved': unresolved, 'choices': copy.deepcopy(choices),
            'valid': valid, 'validation_error': problem, 'draft': recovered,
            'context': {'original': original, 'private': private, 'current': current}}
    bounded(plan)
    if len(encoded(plan)) > MAX_BODY:
        raise ValueError('Recovery context exceeds the editor limit. Keep the private backup and inspect the complete records manually.')
    return plan


class App:
    def __init__(self, store, root=ROOT):
        self.store, self.root = store, root
        self.token = secrets.token_urlsafe(32)
        self.events = {d['id']: d for d in dossiers(root)}
        self.records = json.loads((root / 'web/catalogue/index.json').read_text(encoding='utf-8'))['records']
        self.origin = None

    def new(self, payload):
        if set(payload) != {'id', 'kind', 'target'}:
            raise ValueError('Choose an explicit event or source record')
        if payload['kind'] == 'event':
            dossier = copy.deepcopy(self.events[payload['target']])
        elif payload['kind'] == 'record':
            record = next((r for r in self.records if r['id'] == payload['target']), None)
            if record is None:
                raise ValueError('Record is not in the retained catalogue')
            dossier = empty_record(record)
        else:
            raise ValueError('Unknown target kind')
        draft = {'schema_version': 1, 'id': payload['id'],
                 'target': {'kind': payload['kind'], 'id': payload['target'], 'title': dossier['title']},
                 'base': {'event_id': dossier['id'], 'dossier_sha256': digest(dossier)} if payload['kind'] == 'event' else {'event_id': None, 'dossier_sha256': None},
                 'dossier': dossier, 'private_notes': '', 'intake': {}}
        return self.store.save(draft, None)

    def recover(self, payload, apply=False):
        selected = apply or isinstance(payload, dict) and bool({'current_sha256', 'edited_sha256', 'choices'} & payload.keys())
        required = {'draft', 'revision'} | ({'current_sha256', 'edited_sha256', 'choices'} if selected else set())
        if not isinstance(payload, dict) or set(payload) != required:
            raise ValueError('Recovery needs the exact edited draft and saved revision; saving also needs the preview identities and choices')
        draft = check_draft(payload['draft'])
        if draft['target']['kind'] != 'event':
            raise ValueError('Source-record drafts have no reviewed event base to recover')
        with self.store.lock:
            saved = self.store.load(draft['id'])
            if saved['revision'] != payload['revision']:
                raise Conflict('Saved draft changed. Reopen it before recovery. No file was overwritten.')
            for field in ('target', 'base'):
                if digest(saved['draft'][field]) != digest(draft[field]):
                    raise ValueError('Recovery cannot replace the saved target or original base')
            current = next((d for d in dossiers(self.root) if d['id'] == draft['base']['event_id']), None)
            if current is None:
                raise ValueError('Current reviewed event is unavailable. Keep the saved draft and its private backup.')
            identity = draft['base']['dossier_sha256']
            if digest(current) == identity:
                original = current
            else:
                path = self.root / 'web/archive' / f"{current['id']}-{identity[:20]}.json"
                try:
                    original = validate_dossier(decode(archive_bytes(path, 200_000)))
                except (ValueError, OSError):
                    raise ValueError('Verified retained original is unavailable. Keep the saved draft and its private backup.') from None
            if digest(original) != identity or original['id'] != current['id']:
                raise ValueError('Retained original identity does not match the draft base. No file was overwritten.')
            if selected and (payload['current_sha256'] != digest(current) or payload['edited_sha256'] != digest(draft)):
                raise Conflict('Recovery preview changed. Preview the current edited draft and reviewed record again. No file was overwritten.')
            plan = recovery_plan(original, draft, current, payload['choices'] if selected else None)
            if not apply:
                return plan
            if plan['unresolved']:
                raise ValueError('Choose private or current for every recovery conflict before saving')
            if not plan['valid']:
                raise ValueError('Chosen recovery result does not validate: ' + plan['validation_error'])
            # Reread just before the private save. Later public advancement still
            # meets the unchanged promotion-time base check.
            fresh = next((d for d in dossiers(self.root) if d['id'] == current['id']), None)
            if fresh is None or digest(fresh) != plan['current_sha256']:
                raise Conflict('Reviewed record changed during recovery. Preview again. No file was overwritten.')
            return self.store.save(plan['draft'], payload['revision'])


def server(app, port=0):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Do not log private drafts or session credentials.

        def send(self, status, value, content_type='application/json; charset=utf-8'):
            if isinstance(value, dict) and self.headers.get('X-Curator-Text') == '1':
                value = copy.deepcopy(value)
                literal = lambda item: json.dumps(item, ensure_ascii=False, indent=2, allow_nan=False)
                if 'draft' in value and 'revision' in value:
                    value['dossier_text'] = literal(value['draft']['dossier'])
                    value['draft_context_text'] = literal({k: v for k, v in value['draft'].items() if k not in {'dossier', 'private_notes'}})
                if 'candidate' in value:
                    value['candidate_text'] = literal(value['candidate'])
                if 'conflicts' in value and 'context' in value:
                    for conflict in value['conflicts']:
                        conflict['literal'] = {k: literal(conflict[k]) for k in ('original', 'private', 'current')}
            raw = value if isinstance(value, bytes) else encoded(value)
            if not isinstance(value, bytes) and len(raw) > MAX_BODY:
                raise ValueError('Response exceeds the editor limit. Keep the saved private backup and inspect the records manually.')
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(raw)

        def route(self, write=False):
            try:
                if self.headers.get('Host') != urlsplit(app.origin).netloc:
                    return self.send(403, {'error': 'Only the exact loopback host is supported'})
                if self.headers.get('Origin') not in (None, app.origin) or self.headers.get('Sec-Fetch-Site') == 'cross-site':
                    return self.send(403, {'error': 'Cross-origin requests are not supported'})
                parsed = urlsplit(self.path)
                if parsed.query and parsed.path != '/api/search':
                    raise ValueError('Unexpected query parameters')
                if not parsed.path.startswith('/api/'):
                    name = 'curator.html' if parsed.path == '/' else parsed.path[1:]
                    if write or name not in ASSETS:
                        return self.send(404, {'error': 'Not found'})
                    kind = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript'}[Path(name).suffix]
                    return self.send(200, (app.root / 'web' / name).read_bytes(), kind + '; charset=utf-8')
                if not secrets.compare_digest(self.headers.get('X-Curator-Token', ''), app.token):
                    return self.send(403, {'error': 'Open the local session URL printed by the curator command'})
                if write:
                    if self.headers.get('Origin') != app.origin or self.headers.get('Content-Type') != 'application/json' or self.headers.get('Transfer-Encoding'):
                        return self.send(403, {'error': 'Same-origin JSON writes are required'})
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= MAX_BODY:
                        return self.send(413, {'error': 'Invalid or oversized request'})
                    self.connection.settimeout(5)
                    payload = decode(self.rfile.read(length))
                route = parsed.path
                if not write and route == '/api/session':
                    return self.send(200, {'events': [{'id': d['id'], 'title': d['title']} for d in app.events.values()], 'drafts': app.store.listing()})
                if not write and route == '/api/search':
                    q = parse_qs(parsed.query).get('q', [''])[0].strip().casefold()
                    if not 2 <= len(q) <= 160:
                        raise ValueError('Enter 2 to 160 search characters')
                    rows = [r for r in app.records if q in ' '.join(str(r.get(k) or '') for k in ('id', 'title', 'date', 'state', 'area', 'rating')).casefold()][:30]
                    return self.send(200, {'records': [{'id': r['id'], 'title': r['title'], 'date': r.get('date'), 'rating': r.get('rating')} for r in rows]})
                if not write and route == '/api/backup':
                    return self.send(200, app.store.backup())
                if write and route == '/api/backup-draft':
                    if set(payload) != {'id', 'revision'}:
                        raise ValueError('Saved draft identity and expected revision are required')
                    return self.send(200, app.store.backup_draft(payload['id'], payload['revision']))
                if write and route == '/api/new':
                    return self.send(201, app.new(payload))
                if write and route == '/api/save':
                    if set(payload) != {'draft', 'revision'}:
                        raise ValueError('Draft and expected revision are required')
                    return self.send(200, app.store.save(payload['draft'], payload['revision']))
                if write and route in {'/api/recovery-preview', '/api/recovery-save'}:
                    return self.send(200, app.recover(payload, apply=route == '/api/recovery-save'))
                if write and route == '/api/intake':
                    if set(payload) != {'draft', 'revision', 'item'}:
                        raise ValueError('Draft, expected revision and intake item are required')
                    updated, added = intake(payload['draft'], payload['item'])
                    return self.send(200, app.store.save(updated, payload['revision']) | {'added': added})
                if write and route == '/api/restore':
                    return self.send(200, app.store.restore(payload))
                if write and route == '/api/candidate':
                    if set(payload) != {'draft'}:
                        raise ValueError('Draft is required')
                    return self.send(200, {'candidate': candidate(payload['draft']), 'state': 'validated candidate, not published'})
                if not write and route.startswith('/api/draft/'):
                    return self.send(200, app.store.load(route.removeprefix('/api/draft/')))
                return self.send(404, {'error': 'Not found'})
            except Conflict as error:
                return self.send(409, {'error': str(error)})
            except FileNotFoundError:
                return self.send(404, {'error': 'Draft or resource not found'})
            except (ValueError, KeyError, TypeError, AttributeError, OverflowError, RecursionError) as error:
                return self.send(400, {'error': str(error)[:300]})
            except OSError:
                return self.send(500, {'error': 'Storage failed. No success is recorded. Reopen the draft to check its saved revision.'})

        def do_GET(self):
            self.route()

        def do_POST(self):
            self.route(write=True)

    class CuratorServer(ThreadingHTTPServer):
        def server_close(self):
            try:
                super().server_close()
            finally:
                app.store.release_writer()

    app.store.acquire_writer()
    try:
        http = CuratorServer(('127.0.0.1', port), Handler)
    except OSError:
        app.store.release_writer()
        raise
    http.daemon_threads = True
    app.origin = f'http://127.0.0.1:{http.server_address[1]}'
    return http


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--store', type=Path, required=True, help='Private draft directory outside the checkout')
    parser.add_argument('--port', type=int, default=0)
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('Port is out of range')
    app = App(Store(args.store))
    http = server(app, args.port)
    print(json.dumps({'url': app.origin + '/#token=' + app.token,
                      'state': 'private loopback editor, no automatic browser launch or publication'}), flush=True)
    try:
        http.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        http.server_close()


if __name__ == '__main__':
    main()
