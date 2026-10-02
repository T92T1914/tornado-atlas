"""Compatible archive projection over retained exhibits and source records.

This adapter does not migrate or rewrite the source catalogue. Public dossiers
are small immutable documents. The index is replaced only after validation.
"""
from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from .publication import write_json

ROOT = Path(__file__).resolve().parents[1]
STATUS = {
    'intake': {'published', 'candidate'},
    'assertion': {'source_reported', 'observed_sample', 'disputed', 'not_researched'},
    'temporal': {'unregistered', 'source_label', 'discrete_anchor'},
    'spatial': {'unregistered', 'source_reported'},
    'availability': {'reviewed_available', 'unavailable', 'not_researched', 'documented_no_result', 'not_applicable', 'disputed'},
    'rights': {'links_only', 'permitted_hosting', 'unknown', 'restricted'},
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def status(**overrides):
    return dict(intake='published', assertion='source_reported', temporal='unregistered',
                spatial='unregistered', availability='reviewed_available',
                rights='links_only', **{}) | overrides


def public_url(value):
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Expected a public HTTPS source URL')
    if '%' in parsed.hostname or '\\' in parsed.netloc:
        raise ValueError('Encoded or backslash source hosts require an explicit public hostname')
    try:
        host = parsed.hostname.encode('idna').decode('ascii').lower().rstrip('.')
    except UnicodeError as error:
        raise ValueError('Invalid public source hostname') from error
    if '.' not in host or host.endswith(('.local', '.localhost', '.internal', '.test', '.invalid')):
        raise ValueError('Local or private source URL cannot be published')
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        # Browsers interpret number-ending hosts as IPv4, including abbreviated,
        # octal and hexadecimal forms. Require an explicit canonical IP literal.
        tail = host.rsplit('.', 1)[-1]
        if re.fullmatch(r'[0-9]+|0x[0-9a-f]*', tail):
            raise ValueError('Noncanonical numeric source address cannot be published')
    else:
        if not address.is_global:
            raise ValueError('Private address cannot be published')


def validate_dossier(doc):
    try:
        return _validate_dossier(doc)
    except (KeyError, TypeError, AttributeError, OverflowError) as error:
        raise ValueError('Malformed archive document') from error


def _validate_dossier(doc):
    required = {'schema_version', 'id', 'title', 'coverage', 'summary', 'records', 'routes',
                'creators', 'sources', 'observations', 'media', 'reconstruction', 'provenance'}
    if set(doc) != required or doc['schema_version'] != 1:
        raise ValueError('Unsupported dossier fields or version')
    if not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', doc['id']):
        raise ValueError('Invalid dossier identity')
    if doc['coverage'] not in {'Catalogued', 'Dossier', 'Exhibit', 'Reconstruction'}:
        raise ValueError('Unknown coverage description')
    if doc['coverage'] == 'Reconstruction':
        raise ValueError('No registered historical appearance contract is supported yet')
    def privacy_fields(value):
        if isinstance(value, dict):
            if {'private_notes', 'private_note', 'exif', 'credentials', 'access_token'} & set(value):
                raise ValueError('Private curator fields cannot enter public metadata')
            for child in value.values():
                privacy_fields(child)
        elif isinstance(value, list):
            for child in value:
                privacy_fields(child)
    privacy_fields(doc)
    ids = {}
    for kind in ('creators', 'sources', 'observations', 'media'):
        rows = doc[kind]
        ids[kind] = {r['id'] for r in rows}
        if len(ids[kind]) != len(rows) or any(not re.fullmatch('[A-Za-z0-9][A-Za-z0-9_-]*', i) for i in ids[kind]):
            raise ValueError('Duplicate or unsafe archive identity')
    for source in doc['sources']:
        if set(source) != {'id', 'title', 'url', 'locator', 'access', 'revision', 'rights', 'agent_processing'}:
            raise ValueError('Unexpected source fields')
        public_url(source['url'])
        if not all(source[k] for k in ('locator', 'access', 'revision', 'rights', 'agent_processing')):
            raise ValueError('Source locator, revision and processing must remain explicit')
    for creator in doc['creators']:
        if set(creator) != {'id', 'name', 'basis'} or not creator['basis']:
            raise ValueError('Attribution basis required; no inferred biography')
    for item in doc['observations'] + doc['media']:
        required_item = {'id', 'title', 'source_id', 'locator', 'account', 'limits', 'status',
                         'time', 'place', 'review'}
        if item in doc['media']:
            required_item |= {'kind', 'url', 'roles', 'parent', 'transformation'}
        if set(item) != required_item or item['source_id'] not in ids['sources']:
            raise ValueError('Unexpected evidence fields or missing source')
        if not all(item[k] for k in ('locator', 'account', 'limits', 'review')):
            raise ValueError('Evidence needs a locator, scope and review')
        if set(item['status']) != set(STATUS) or any(item['status'][k] not in v for k, v in STATUS.items()):
            raise ValueError('Independent evidence status dimensions required')
        if set(item['time']) != {'event', 'capture', 'publication', 'retrieval', 'video', 'alignment'}:
            raise ValueError('Clock roles must remain separate')
        if item['status']['temporal'] == 'unregistered' and item['time']['alignment'] is not None:
            raise ValueError('Unregistered evidence cannot acquire an alignment')
        alignment = item['time']['alignment']
        if alignment is not None:
            if set(alignment) != {'utc', 'basis'} or not alignment['basis']:
                raise ValueError('Alignment requires a UTC value and evidence basis')
            stamp = datetime.fromisoformat(alignment['utc'].replace('Z', '+00:00'))
            if stamp.tzinfo is None or stamp.utcoffset().total_seconds() != 0:
                raise ValueError('Alignment needs explicit UTC; source labels are preserved separately')
        if item['status']['temporal'] == 'discrete_anchor' and (not isinstance(alignment, dict) or not alignment.get('utc') or not alignment.get('basis')):
            raise ValueError('Discrete anchors need a time and an explicit basis')
        video = item['time']['video']
        if video is not None and (not isinstance(video, dict) or set(video) != {'start_seconds', 'end_seconds'} or
                any(type(v) not in (int, float) or not math.isfinite(v) for v in video.values()) or
                not 0 <= video['start_seconds'] <= video['end_seconds'] <= 86400):
            raise ValueError('Video presentation bounds must be finite and ordered')
        if set(item['place']) != {'role', 'reported', 'coordinates', 'basis'}:
            raise ValueError('Position roles and basis required')
        if item['status']['spatial'] == 'unregistered' and item['place']['coordinates'] is not None:
            raise ValueError('Unregistered evidence cannot acquire a map point')
        coordinates = item['place']['coordinates']
        if item['status']['spatial'] == 'source_reported' and (not isinstance(coordinates, list) or len(coordinates) != 2 or
                any(type(v) not in (int, float) or not math.isfinite(v) for v in coordinates) or
                not (-180 <= coordinates[0] <= 180 and -90 <= coordinates[1] <= 90) or not item['place']['basis']):
            raise ValueError('Source reported position needs valid coordinates and basis')
        if item['status']['availability'] == 'documented_no_result' and not isinstance(item['review'], dict):
            raise ValueError('No result requires a documented search record')
        if item['status']['availability'] == 'documented_no_result' and not all(item['review'].get(k) for k in ('searched_on', 'scope', 'method')):
            raise ValueError('No result requires date, scope and search method')
        if item in doc['media']:
            public_url(item['url'])
            if item['kind'] not in {'photograph', 'video', 'radar'}:
                raise ValueError('Unknown media kind')
            if set(item['roles']) != {'creator', 'uploader', 'rights_holder'}:
                raise ValueError('Creator and uploader roles must be separate')
            if any(v is not None and v not in ids['creators'] for v in item['roles'].values()):
                raise ValueError('Unknown attribution identity')
            if item['parent'] is not None and item['parent'] not in ids['media']:
                raise ValueError('Unknown media parent')
    for row in doc['records']:
        if set(row) != {'id', 'basis', 'status', 'alternatives'} or row['status'] != 'reviewed_association' or not row['basis']:
            raise ValueError('Record associations require a reversible review basis')
        if not re.fullmatch(r'ncei:\d+', row['id']) or not isinstance(row['alternatives'], list):
            raise ValueError('Unsupported source record association')
    if len({r['id'] for r in doc['records']}) != len(doc['records']):
        raise ValueError('Duplicate source record association')
    parents = {m['id']: m['parent'] for m in doc['media']}
    for identifier in parents:
        visited = set()
        while identifier is not None:
            if identifier in visited:
                raise ValueError('Media derivation cannot contain a cycle')
            visited.add(identifier)
            identifier = parents[identifier]
    for row in doc['routes']:
        if set(row) != {'label', 'href'} or not re.fullmatch(r'[a-z0-9-]+\.html(?:[?#][a-zA-Z0-9=&#%:._-]+)?', row['href']):
            raise ValueError('Invalid local dossier route')
    if set(doc['reconstruction']) != {'appearance', 'intervals', 'limits'} or doc['reconstruction']['appearance'] != 'unregistered' or doc['reconstruction']['intervals']:
        raise ValueError('Historical appearance needs its own reviewed contract')
    if len(json.dumps(doc, ensure_ascii=False).encode('utf-8')) > 200_000:
        raise ValueError('Dossier exceeds selective loading budget')
    return doc


def clocks(**values):
    return dict(event=None, capture=None, publication=None, retrieval=None, video=None, alignment=None) | values


def place(reported=None, role='not_applicable'):
    return {'role': role, 'reported': reported, 'coordinates': None,
            'basis': 'Attributed source text only; no registered point.'}


def source(identifier, title, url, locator, access, revision, rights='Metadata and credited links only.'):
    return dict(id=identifier, title=title, url=url, locator=locator, access=access,
                revision=revision, rights=rights,
                agent_processing='Agent projection of retained evidence. No new human review is claimed.')


def evidence(identifier, title, source_id, locator, account, limits, **extras):
    return dict(id=identifier, title=title, source_id=source_id, locator=locator,
                account=account, limits=limits, status=status(), time=clocks(), place=place(),
                review='Retained exhibit review; adapted without expanding inspection coverage.') | extras


def dossiers(root=ROOT, *, include_curated=True):
    config = read(root / 'research/archive-dossiers.json')
    aliases = read(root / 'research/record-aliases.json')
    result = []
    for entry in config:
        doc = dict(schema_version=1, id=entry['id'], title=entry['title'], coverage=entry['coverage'],
                   summary=entry['summary'], records=[], routes=entry['routes'], creators=[], sources=[],
                   observations=[], media=[], reconstruction={'appearance': 'unregistered',
                       'intervals': [], 'limits': 'No interval of historically registered visual appearance is published.'},
                   provenance={'adapter': 'atlas.archive schema 1', 'inputs': {}})
        for identifier in entry['records']:
            doc['records'].append(dict(id=identifier, basis=aliases[identifier]['basis'],
                                      status='reviewed_association', alternatives=[]))
        for item in entry['sources']:
            doc['sources'].append(source(**item))
        doc['observations'].extend(entry.get('observations', []))
        inputs = ['research/archive-dossiers.json', 'research/record-aliases.json']
        if doc['id'] == 'el-reno-2013':
            relative = 'exhibits/el-reno-2013/observations.json'
            notebook = read(root / relative); inputs.append(relative)
            doc['creators'].append(dict(id='hark', name='William T. Hark', basis='Retained author account and photograph credits.'))
            first = notebook['photographs'][0]
            doc['sources'].append(source('hark-account', first['source']['title'], first['source']['url'],
                'Selected 6:04 PM and 6:09 PM caption and image pairs.', first['source']['access'],
                'Accessed ' + first['source']['accessed_on'], first['rights']['notice']))
            for photo in notebook['photographs']:
                doc['media'].append(evidence(photo['id'], photo['title'], 'hark-account', photo['source']['locator'],
                    photo['visual_note'] + ' ' + photo['caption_note'], photo['uncertainty'],
                    kind='photograph', url=photo['source']['original_url'],
                    roles=dict(creator='hark', uploader=None, rights_holder='hark'), parent=None,
                    transformation=photo['processing']['note'], status=status(temporal='source_label'),
                    time=clocks(capture=photo['source_time'], retrieval=photo['source']['accessed_on']),
                    place=place(photo['place'], role='camera'), review=photo['review']))
            relative = 'exhibits/el-reno-2013/footage.json'
            footage = read(root / relative); inputs.append(relative)
            film = footage['sources'][0]
            doc['creators'].append(dict(id='robinson', name=film['creator'], basis='Retained original upload attribution.'))
            doc['sources'].append(source(film['id'], film['title'], film['url'],
                'Seven retained paused clock samples; no continuous audit.', footage['coverage'] + ' ' + film['limits'],
                'Reviewed ' + footage['reviewed'], film['rights']))
            for anchor in footage['anchors']:
                doc['media'].append(evidence(anchor['id'], 'Dashcam clock sample', film['id'],
                    f"Video position {anchor['video_seconds']} seconds; paused sample, not an interval.",
                    anchor['note'], footage['method'] + ' ' + film['limits'], kind='video', url=film['url'] + '&t=' + str(int(anchor['video_seconds'])),
                    roles=dict(creator='robinson', uploader='robinson', rights_holder='robinson'), parent=None,
                    transformation='No bytes acquired or hosted. Original player link only.',
                    status=status(temporal='discrete_anchor', assertion='observed_sample'),
                    time=clocks(video={'start_seconds': anchor['video_seconds'], 'end_seconds': anchor['video_seconds']},
                        capture={'reported_utc': anchor['utc'], 'basis': film['clock_basis']},
                        alignment={'utc': anchor['utc'], 'basis': 'Retained paused onscreen clock reading, not continuous coverage.'}),
                    place=place(role='camera'), review=footage['coverage']))
            relative = 'exhibits/el-reno-2013/timeline-media.json'
            radar = read(root / relative); inputs.append(relative)
            doc['creators'].append(dict(id='noaa-nws', name='NOAA / National Weather Service', basis=radar['credit']))
            doc['sources'].append(source('nwrt-loop', 'NWRT reflectivity loop', radar['source'],
                radar['original_url'], radar['changes'], radar['original_sha256'], radar['license']))
            frame = radar['frames'][0]
            doc['media'].append(evidence('nwrt-151', 'Historical NWRT reflectivity at source label 23:01:37',
                'nwrt-loop', f"GIF frame {frame['frame_index']}; {frame['source_label']}", radar['interpretation'],
                radar['clock_basis'], kind='radar', url=radar['original_url'],
                roles=dict(creator='noaa-nws', uploader='noaa-nws', rights_holder=None), parent=None,
                transformation={'recipe': radar['changes'], 'parent_sha256': radar['original_sha256'],
                    'asset': frame['file'], 'sha256': frame['sha256']},
                status=status(temporal='source_label', rights='permitted_hosting'),
                time=clocks(capture={'label': frame['source_label']}, retrieval=radar['retrieved_at'],
                    alignment={'utc': frame['utc'], 'basis': radar['clock_basis']}), place=place(role='regional_radar_image')))
        if doc['id'] == 'joplin-2011':
            relative = 'exhibits/joplin-2011/chronology.json'
            chronology = read(root / relative); inputs.append(relative)
            for row in chronology['entries']:
                doc['observations'].append(evidence(row['id'], row['title'], row['source_id'], row['locator'],
                    row['account'], row['limits'], status=status(temporal='source_label'),
                    time=clocks(event={'reported': row['source_time'], 'precision': row['precision']},
                        alignment={'utc': row['utc'], 'basis': chronology['clock']['basis']})))
        doc['provenance']['inputs'] = {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in inputs}
        validate_dossier(doc)
        curated = root / 'research/archive-curated' / (doc['id'] + '.json')
        if include_curated and curated.exists():
            override = read(curated)
            if set(override) != {'schema_version', 'adapter_sha256', 'review', 'dossier'} or override['schema_version'] != 1:
                raise ValueError('Malformed reviewed candidate')
            if override['adapter_sha256'] != digest(doc):
                raise ValueError('Retained source projection changed; rebase and review the candidate before publication')
            if override['review']['reviewer_kind'] != 'agent' or not override['review']['basis']:
                raise ValueError('Reviewed candidate requires an explicit processing basis')
            reviewed = validate_dossier(override['dossier'])
            if reviewed['id'] != doc['id']:
                raise ValueError('Candidate changed its canonical event identity')
            doc = reviewed
        result.append(doc)
    return result


def promote_candidate(path, basis, root=ROOT):
    """Explicit review action. This changes intake only, never evidence certainty."""
    candidate = read(path)
    if set(candidate) != {'schema_version', 'kind', 'base', 'dossier'} or candidate['schema_version'] != 1 or candidate['kind'] != 'atlas-curator-candidate':
        raise ValueError('Expected a notes-free curator candidate')
    if not isinstance(basis, str) or not basis.strip():
        raise ValueError('A public review basis is required')
    doc = validate_dossier(candidate['dossier'])
    current = next((d for d in dossiers(root) if d['id'] == doc['id']), None)
    if current is None or candidate['base'] != {'event_id': doc['id'], 'dossier_sha256': digest(current)}:
        raise ValueError('Candidate base changed or lacks a reviewed event association')
    adapter = next(d for d in dossiers(root, include_curated=False) if d['id'] == doc['id'])
    review = dict(reviewer_kind='agent', reviewed_at=datetime.now(timezone.utc).isoformat(),
                  basis=basis.strip(), candidate_sha256=digest(candidate), previous_dossier_sha256=digest(current))
    # Local draft IDs and author notes are not required for the public account.
    doc['provenance'].pop('curator', None)
    doc['provenance']['publication_review'] = review
    for item in doc['observations'] + doc['media']:
        item['status']['intake'] = 'published'
    validate_dossier(doc)
    write_json(root / 'research/archive-curated' / (doc['id'] + '.json'),
               dict(schema_version=1, adapter_sha256=digest(adapter), review=review, dossier=doc))
    return {'event': doc['id'], 'dossier_sha256': digest(doc), 'review': review}


def dossier_changes(before, after):
    """Describe retained field differences without inferring a correction's cause."""
    changes = []
    for kind in ('sources', 'observations', 'media', 'creators', 'records'):
        old = {row['id']: row for row in before[kind]}
        new = {row['id']: row for row in after[kind]}
        for identifier in sorted(old.keys() | new.keys()):
            if identifier not in old:
                changes.append(dict(kind=kind, id=identifier, change='added', fields=[]))
            elif identifier not in new:
                changes.append(dict(kind=kind, id=identifier, change='removed', fields=[]))
            else:
                fields = sorted(key for key in old[identifier].keys() | new[identifier].keys()
                                if old[identifier].get(key) != new[identifier].get(key))
                if fields:
                    changes.append(dict(kind=kind, id=identifier, change='updated', fields=fields))
    for key in ('title', 'coverage', 'summary', 'routes', 'reconstruction'):
        if before[key] != after[key]:
            changes.append(dict(kind='dossier', id=after['id'], change='updated', fields=[key]))
    return changes


def dossier_history(doc, root=ROOT):
    """Index available immutable snapshots using declared predecessor identities."""
    current = digest(doc)
    retained = {current: doc}
    pattern = re.compile(re.escape(doc['id']) + r'-[0-9a-f]{20}\.json')
    for path in sorted((root / 'web/archive').glob(doc['id'] + '-*.json')):
        if not pattern.fullmatch(path.name):
            continue
        if path.is_symlink() or path.stat().st_size > 200_000:
            raise ValueError('Unsafe retained dossier file')
        old = validate_dossier(read(path))
        if old['id'] != doc['id'] or path.name != f"{doc['id']}-{digest(old)[:20]}.json":
            raise ValueError('Retained dossier identity does not match its filename')
        retained[digest(old)] = old
    if len(retained) > 64:
        raise ValueError('Dossier revision list exceeds selective loading budget')
    versions = []
    for identity in sorted(retained, key=lambda value: (value != current, value)):
        snapshot = retained[identity]
        review = snapshot['provenance'].get('publication_review')
        previous = None
        if review is not None:
            required = {'reviewer_kind', 'reviewed_at', 'basis', 'candidate_sha256', 'previous_dossier_sha256'}
            if not isinstance(review, dict) or set(review) != required or not all(isinstance(review[k], str) and review[k] for k in required):
                raise ValueError('Malformed retained publication review')
            if review['reviewer_kind'] != 'agent' or any(not re.fullmatch('[0-9a-f]{64}', review[k])
                                                       for k in ('candidate_sha256', 'previous_dossier_sha256')):
                raise ValueError('Invalid retained publication review identity')
            stamp = datetime.fromisoformat(review['reviewed_at'].replace('Z', '+00:00'))
            if stamp.tzinfo is None or stamp.utcoffset().total_seconds() != 0:
                raise ValueError('Publication review timestamp requires explicit UTC')
            previous = review['previous_dossier_sha256']
        if previous == identity:
            raise ValueError('A dossier cannot be its own predecessor')
        versions.append(dict(dossier_sha256=identity,
                             file=f"archive/{doc['id']}-{identity[:20]}.json",
                             review=review, predecessor_available=previous in retained,
                             changes=dossier_changes(retained[previous], snapshot) if previous in retained else None))
    for identity in retained:
        visited = set()
        while identity in retained:
            if identity in visited:
                raise ValueError('Retained dossier predecessors cannot form a cycle')
            visited.add(identity)
            review = retained[identity]['provenance'].get('publication_review')
            identity = review['previous_dossier_sha256'] if review else None
    history = dict(schema_version=1, event_id=doc['id'], current_dossier_sha256=current,
                   scope='Retained snapshots and recorded publication reviews only. Missing predecessors and unrecorded decisions remain gaps. Identifier order is not chronological order.',
                   versions=versions)
    if len(json.dumps(history, ensure_ascii=False).encode()) > 100_000:
        raise ValueError('Dossier history exceeds selective loading budget')
    return history


def publication(root=ROOT):
    docs = dossiers(root)
    catalogue = read(root / 'web/catalogue/index.json')
    shards = {r['detail_file'].split('/')[-1][:2]: r['detail_file'] for r in catalogue['records']}
    result = {}; entries = []
    for doc in docs:
        filename = f"archive/{doc['id']}-{digest(doc)[:20]}.json"
        result[filename] = doc
        history = dossier_history(doc, root)
        history_file = f"archive/{doc['id']}-history-{digest(history)[:20]}.json"
        result[history_file] = history
        entries.append({k: doc[k] for k in ('id', 'title', 'coverage', 'summary')} | {
            'file': filename, 'history_file': history_file, 'records': [r['id'] for r in doc['records']],
            'evidence': sorted({m['kind'] for m in doc['media'] if m['status']['availability'] == 'reviewed_available'
                                and m['status']['assertion'] != 'not_researched'} |
                               ({'chronology'} if doc['id'] == 'joplin-2011' else set()) |
                               ({'source_disagreement'} if any(o['status']['assertion'] == 'disputed' for o in doc['observations']) else set())),
            'registered_media': sum(m['status']['availability'] == 'reviewed_available' and
                                    m['status']['temporal'] == 'discrete_anchor' and
                                    m['status']['spatial'] != 'unregistered' for m in doc['media']),
            'creators': doc['creators']})
    result['archive/index.json'] = dict(schema_version=1, events=entries,
        coverage=catalogue['coverage'], record_shards=shards,
        sparse_example='ncei:432342', coverage_definitions={
            'Catalogued': 'An identified source record. Further evidence may not have been researched.',
            'Dossier': 'A sourced account with explicit research gaps.',
            'Exhibit': 'A dossier with an interactive evidence presentation.',
            'Reconstruction': 'A view with explicitly registered historical appearance intervals. None is claimed here.'})
    return result


def build(root=ROOT):
    artifacts = publication(root)
    for relative, payload in artifacts.items():
        path = root / 'web' / relative
        if relative != 'archive/index.json' and path.exists():
            if read(path) != payload:
                raise ValueError('An immutable archive document cannot be overwritten')
            continue
        write_json(path, payload)
    index = artifacts['archive/index.json']
    return {'dossiers': len(index['events']), 'records': index['coverage']['current_source_records']}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', type=Path)
    parser.add_argument('--basis')
    args = parser.parse_args()
    if args.candidate:
        if not args.basis:
            parser.error('--candidate requires --basis with the reviewed publication reason')
        print(json.dumps(promote_candidate(args.candidate, args.basis)))
    print(json.dumps(build()))
