"""Validate the explicitly unregistered video and photograph notebook."""
import math
import re
from datetime import date
from urllib.parse import urlsplit


def _record(value, fields, label):
    if not isinstance(value, dict) or set(value) != set(fields):
        raise ValueError(f'Photograph {label} requires exactly its supported fields')


def _text(value, fields):
    if any(not isinstance(value[field], str) or not value[field].strip() for field in fields):
        raise ValueError('Photograph provenance and review text must not be empty')


def _source_url(value):
    if any(character.isspace() or ord(character) < 32 for character in value) or '\\' in value:
        raise ValueError('Photograph source URL contains unsafe characters')
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Photograph sources require HTTPS without credentials')


def _validate_photograph(row):
    # This is a links-only notebook record, not a registered camera observation.
    # Explicit fields prevent an unsupported coordinate, clock or mirrored asset
    # from appearing to be reviewed simply because the build ignored that field.
    text_fields = ('id', 'title', 'visual_note', 'caption_note', 'uncertainty')
    _record(row, (*text_fields, 'source', 'review', 'source_time', 'place',
                  'processing', 'rights', 'historical_utc', 'camera_position'), 'record')
    _text(row, text_fields)
    if row['historical_utc'] is not None or row['camera_position'] is not None:
        raise ValueError('Photograph registration is not supported in this notebook')
    groups = {
        'source': ('author', 'title', 'url', 'original_url', 'locator', 'access', 'accessed_on'),
        'review': ('reviewed_on', 'status', 'coverage', 'not_reviewed'),
        'source_time': ('label', 'precision', 'calibration', 'accuracy'),
        'place': ('label', 'basis'),
        'processing': ('status', 'note'),
        'rights': ('credit', 'notice', 'usage'),
    }
    for name, fields in groups.items():
        _record(row[name], fields, name)
        _text(row[name], fields)
    for field in ('url', 'original_url'):
        _source_url(row['source'][field])
    for record, field in ((row['source'], 'accessed_on'), (row['review'], 'reviewed_on')):
        date.fromisoformat(record[field])
    if row['source']['access'] != 'page_and_still_inspected' or row['review']['status'] != 'still_and_caption_inspected':
        raise ValueError('Photograph needs an inspected original still and source caption')
    if (row['source_time']['precision'] != 'minute' or
            row['source_time']['calibration'] != 'unverified' or
            row['source_time']['accuracy'] != 'unknown' or
            not re.fullmatch(r'(?:0?[1-9]|1[0-2]):[0-5][0-9] (?:AM|PM)(?: [A-Z]{2,5})?',
                             row['source_time']['label'])):
        raise ValueError('Photograph source time remains minute-labeled and uncalibrated')
    if row['place']['basis'] != 'author_caption':
        raise ValueError('Photograph place must remain an attributed named place')
    if row['processing']['status'] not in {'not_documented', 'author_enhanced'}:
        raise ValueError('Unknown photograph processing status')
    if row['rights']['usage'] != 'credited_links_only':
        raise ValueError('Photograph rights only permit credited source links here')


def validate_notebook(notebook: dict, queue: list[dict], event_id: str) -> None:
    if notebook['event_id'] != event_id:
        raise ValueError('Notebook belongs to a different event')
    videos = {video['id']: video for video in queue}
    seen = set()
    for row in notebook['observations']:
        if row['id'] in seen:
            raise ValueError('Duplicate observation identifier')
        seen.add(row['id'])
        video = videos.get(row['video'])
        if not video or video['event_id'] != event_id:
            raise ValueError('Observation requires a matching source video')
        coverage = notebook['coverage'].get(row['video'])
        if not coverage:
            raise ValueError('Observation requires an inspection coverage record')
        values = [row['start_seconds'], row['end_seconds'], coverage['duration_seconds']]
        if not all(type(value) in (int, float) and math.isfinite(value) for value in values):
            raise ValueError('Video locators must be finite numbers')
        start, end, duration = values
        if not 0 <= start <= end < duration:
            raise ValueError('Observation is outside the source duration')
        if row['kind'] not in {'visual_sample', 'creator_annotation'}:
            raise ValueError('Unknown evidence kind')
        if row['kind'] == 'visual_sample':
            if start != end or start not in coverage['visual_samples_seconds']:
                raise ValueError('Still samples cannot claim uninspected intervals')
        # A future registered schema must require the supporting source, uncertainty
        # and coordinate/time basis before non-null placement can enter the map.
        if row['historical_utc'] is not None or row['camera_position'] is not None:
            raise ValueError('Registration evidence is not implemented in this notebook schema')
    photographs = notebook.get('photographs', [])
    if not isinstance(photographs, list):
        raise ValueError('Photographs must be a collection')
    for row in photographs:
        _validate_photograph(row)
        if row['id'] in seen:
            raise ValueError('Duplicate observation identifier')
        seen.add(row['id'])
