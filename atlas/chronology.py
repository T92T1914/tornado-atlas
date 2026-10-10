"""Reviewed documentary clocks, without geographic or media registration."""
import hashlib
import json
import re
import struct
from urllib.parse import urlsplit

from .event_package import fields, utc, asset_path
from .history import source_url


def validate_chronology(data, event_id, root=None):
    version = data.get('schema_version') if isinstance(data, dict) else None
    fields(data, ('schema_version', 'event_id', 'title', 'clock', 'sources', 'entries') +
           (('radar_context',) if version in (2, 3) else ()) +
           (('reading_context',) if version == 3 else ()), 'chronology')
    if type(version) is not int or version not in (1, 2, 3) or data['event_id'] != event_id:
        raise ValueError('Chronology schema or event identity differs')
    def text(value):
        if not isinstance(value, str) or not value.strip():
            raise ValueError('Chronology needs nonempty evidence text')
    text(data['title'])
    fields(data['clock'], ('time_zone', 'precision', 'basis'), 'documentary clock')
    if data['clock']['precision'] != 'minute' or not isinstance(data['clock']['time_zone'], str) or not re.fullmatch(r'[A-Za-z_]+(?:/[A-Za-z_+-]+)*', data['clock']['time_zone']):
        raise ValueError('Unsupported documentary clock')
    text(data['clock']['basis'])
    if not isinstance(data['sources'], list) or not data['sources']:
        raise ValueError('Chronology needs sources')
    sources = set()
    for source in data['sources']:
        fields(source, ('id', 'title', 'url', 'archive', 'sha256'), 'chronology source')
        text(source['id'])
        if source['id'] in sources:
            raise ValueError('Duplicate chronology source')
        sources.add(source['id'])
        text(source['title'])
        source_url(source['url'])
        if urlsplit(source['url']).username or urlsplit(source['url']).password:
            raise ValueError('Source URL must not contain credentials')
        asset_path(source['archive'], 'pdf')
        if not source['archive'].startswith(f'exhibits/{event_id}/') or not re.fullmatch(r'[a-f0-9]{64}', source['sha256']):
            raise ValueError('Invalid chronology source provenance')
        if root is not None and hashlib.sha256((root / source['archive']).read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Chronology source bytes have changed')
    if not isinstance(data['entries'], list) or len(data['entries']) < 2:
        raise ValueError('Chronology needs at least two reviewed entries')
    seen, previous = set(), None
    for entry in data['entries']:
        fields(entry, ('id', 'utc', 'source_time', 'precision', 'title', 'account', 'limits', 'source_id', 'page', 'locator'), 'chronology entry')
        for name in ('id', 'source_time', 'title', 'account', 'limits', 'locator'):
            text(entry[name])
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', entry['id']) or entry['id'] in seen:
            raise ValueError('Invalid or duplicate chronology entry')
        seen.add(entry['id'])
        stamp = utc(entry['utc'])
        if stamp.second or (previous is not None and stamp <= previous):
            raise ValueError('Chronology entries require increasing minute timestamps')
        previous = stamp
        if entry['precision'] not in ('reported_minute', 'approximate_minute'):
            raise ValueError('Unsupported chronology precision')
        if entry['source_id'] not in sources or type(entry['page']) is not int or entry['page'] < 1:
            raise ValueError('Chronology entry needs a known source and PDF page')
    if version in (2, 3):
        validate_radar_context(data, event_id, root)
    if version == 3:
        validate_reading_context(data, event_id, root)
    return data


def validate_radar_context(data, event_id, root=None):
    """Printed radar labels select context, without creating an alignment."""
    context = data['radar_context']
    fields(context, ('event_id', 'reference', 'media_id', 'snapshots', 'navigation_basis'), 'radar context')
    reference = context['reference']
    fields(reference, ('file', 'dossier_sha256', 'file_sha256'), 'retained radar reference')
    if (context['event_id'] != event_id or not isinstance(context['media_id'], str)
            or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', context['media_id'])
            or not isinstance(context['navigation_basis'], str) or not context['navigation_basis'].strip()
            or any(not isinstance(reference[key], str) or not re.fullmatch(r'[a-f0-9]{64}', reference[key])
                   for key in ('dossier_sha256', 'file_sha256'))
            or reference['file'] != f"archive/{event_id}-{reference['dossier_sha256'][:20]}.json"):
        raise ValueError('Invalid retained radar association')
    snapshots = context['snapshots']
    if not isinstance(snapshots, list) or len(snapshots) != 7:
        raise ValueError('Radar context needs the seven complete figure labels')
    seen, previous = set(), None
    day = utc(data['entries'][0]['utc']).date()
    for snapshot in snapshots:
        fields(snapshot, ('id', 'utc', 'source_label'), 'radar snapshot')
        stamp = utc(snapshot['utc'])
        prefix = stamp.strftime('%B %d, %Y').replace(' 0', ' ') + ': ' if not seen else ''
        if (not isinstance(snapshot['id'], str) or not re.fullmatch(r'radar-[0-9]{4}', snapshot['id'])
                or snapshot['id'] != 'radar-' + stamp.strftime('%H%M')
                or snapshot['id'] in seen or stamp.second or stamp.date() != day
                or (previous is not None and stamp <= previous)
                or snapshot['source_label'] != prefix + stamp.strftime('%H%M UTC')):
            raise ValueError('Radar labels require increasing distinct source minutes')
        seen.add(snapshot['id']); previous = stamp
    if root is None:
        return context
    from .archive import archive_bytes, digest, validate_dossier, verify_dossier_files
    # Reuse the publication association check. The immutable pin must be retained
    # in this event's actual published history as well as valid in isolation.
    index = json.loads(archive_bytes(root / 'web/archive/index.json', 100_000))
    verify_dossier_files(index, root)
    event = next((row for row in index['events'] if row['id'] == event_id), None)
    if event is None:
        raise ValueError('Radar event is missing from the published archive')
    history = json.loads(archive_bytes(root / 'web' / event['history_file'], 100_000))
    if not any(all(row.get(key) == value for key, value in reference.items()) for row in history['versions']):
        raise ValueError('Radar reference is not a retained published dossier')
    raw = archive_bytes(root / 'web' / reference['file'], 200_000)
    dossier = validate_dossier(json.loads(raw))
    if (dossier['id'] != event_id or digest(dossier) != reference['dossier_sha256']
            or hashlib.sha256(raw).hexdigest() != reference['file_sha256']):
        raise ValueError('Retained radar dossier bytes have changed')
    media = next((row for row in dossier['media'] if row['id'] == context['media_id']), None)
    expected_status = dict(intake='published', assertion='source_reported', temporal='source_label',
                           spatial='unregistered', availability='reviewed_available', rights='permitted_hosting')
    if (media is None or media['kind'] != 'radar' or media['status'] != expected_status
            or media['time']['alignment'] is not None or media['time']['video'] is not None
            or media['place']['coordinates'] is not None
            or media['time']['event'] != {'reported': [row['source_label'] for row in snapshots]}):
        raise ValueError('Retained radar record does not support these source labels')
    transform = media['transformation']
    fields(transform, ('recipe', 'asset', 'sha256', 'width', 'height', 'alt'), 'complete radar figure')
    if (not isinstance(transform['recipe'], str) or not transform['recipe'].strip()
            or not isinstance(transform['alt'], str) or not transform['alt'].strip()
            or not isinstance(transform['asset'], str)
            or not re.fullmatch(r'assets/' + re.escape(event_id) + r'/[a-z0-9-]+\.png', transform['asset'])
            or not isinstance(transform['sha256'], str) or not re.fullmatch('[a-f0-9]{64}', transform['sha256'])
            or any(type(transform[key]) is not int or not 0 < transform[key] <= 4096 for key in ('width', 'height'))
            or media['roles']['creator'] is None):
        raise ValueError('Invalid complete radar figure identity')
    image = archive_bytes(root / 'web' / transform['asset'], 2_000_000)
    if (hashlib.sha256(image).hexdigest() != transform['sha256'] or len(image) < 24
            or image[:8] != b'\x89PNG\r\n\x1a\n' or image[12:16] != b'IHDR'
            or struct.unpack('>II', image[16:24]) != (transform['width'], transform['height'])):
        raise ValueError('Complete radar figure bytes or dimensions have changed')
    return context


def validate_reading_context(data, event_id, root=None):
    """Link later assessment accounts without registering them on the clock."""
    context = data['reading_context']
    fields(context, ('event_id', 'reference', 'observations', 'associations', 'navigation_basis'), 'reading context')
    reference = context['reference']
    fields(reference, ('file', 'dossier_sha256', 'file_sha256'), 'retained reading reference')
    if (context['event_id'] != event_id or reference != data['radar_context']['reference']
            or not isinstance(context['navigation_basis'], str) or not context['navigation_basis'].strip()):
        raise ValueError('Reading context must reuse the retained radar dossier')
    # The radar validator checks this same immutable reference and history.
    observations = context['observations']
    if not isinstance(observations, list) or not 0 < len(observations) <= 32:
        raise ValueError('Reading context needs bounded declared observations')
    entries = {row['id'] for row in data['entries']}
    sources = {row['id']: row for row in data['sources']}
    seen = set()
    for row in observations:
        fields(row, ('id', 'source_id', 'report_page', 'documentary_anchor'), 'reading observation route')
        if (any(not isinstance(row[key], str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', row[key]) for key in ('id', 'documentary_anchor'))
                or row['id'] in seen or not isinstance(row['source_id'], str) or row['source_id'] not in sources
                or type(row['report_page']) is not int or row['report_page'] < 1):
            raise ValueError('Invalid reading observation route')
        seen.add(row['id'])
    associations = context['associations']
    if not isinstance(associations, list) or not 0 < len(associations) <= len(entries):
        raise ValueError('Invalid reading associations')
    associated, used = set(), set()
    for row in associations:
        fields(row, ('entry_id', 'observation_ids'), 'reading association')
        ids = row['observation_ids']
        if (not isinstance(row['entry_id'], str) or row['entry_id'] not in entries or row['entry_id'] in associated
                or not isinstance(ids, list) or not ids or any(not isinstance(value, str) or value not in seen for value in ids)
                or len(set(ids)) != len(ids)):
            raise ValueError('Reading context needs distinct known entry and observation IDs')
        associated.add(row['entry_id']); used.update(ids)
    if used != seen:
        raise ValueError('Reading observations must have declared entry associations')
    if root is None:
        return context
    from .archive import archive_bytes, validate_dossier
    dossier = validate_dossier(json.loads(archive_bytes(root / 'web' / reference['file'], 200_000)))
    expected = dict(intake='published', assertion='source_reported', temporal='unregistered',
                    spatial='unregistered', availability='reviewed_available', rights='links_only')
    for route in observations:
        observation = next((row for row in dossier['observations'] if row['id'] == route['id']), None)
        source = next((row for row in dossier['sources'] if row['id'] == route['source_id']), None)
        if (observation is None or source is None or observation['source_id'] != route['source_id']
                or source['url'] != sources[route['source_id']]['url'] or observation['status'] != expected
                or any(observation['time'][key] is not None for key in ('event', 'capture', 'video', 'alignment'))
                or observation['place']['coordinates'] is not None):
            raise ValueError('Retained reading record must remain qualified and unregistered')
    return context
