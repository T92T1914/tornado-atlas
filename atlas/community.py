"""Validate curated discussion records without altering the historical record.

Source roles and conclusions are editorial judgments, not automated fact checks.
This validator prevents missing citations and promotion of unread forum leads.
"""
import re
from datetime import date
from urllib.parse import urlsplit


def _text(record, fields):
    if any(not isinstance(record.get(field), str) or not record[field].strip()
           for field in fields):
        raise ValueError('Discussion record is missing required text')


def validate_community(document, event_id):
    if document.get('schema') != 1 or document.get('event') != event_id:
        raise ValueError('Discussion must identify its exhibit and supported schema')
    _text(document, ('introduction', 'scope', 'updated'))
    updated = date.fromisoformat(document['updated'])
    sources = {}
    for source in document.get('sources', []):
        _text(source, ('id', 'title', 'publisher', 'url', 'coverage'))
        url = urlsplit(source['url'])
        if url.scheme != 'https' or not url.hostname or url.username or url.password:
            raise ValueError('Discussion sources require HTTPS without credentials')
        if source['id'] in sources:
            raise ValueError('Duplicate discussion source')
        if source.get('role') not in {'community', 'primary', 'secondary'}:
            raise ValueError('Unknown discussion source role')
        if source.get('access') not in {'text_reviewed', 'selected_sections_reviewed',
                                     'not_reviewed', 'unavailable'}:
            raise ValueError('Unknown source access status')
        sources[source['id']] = source
    ids = set()
    for entry in document.get('entries', []):
        _text(entry, ('id', 'title', 'claim', 'check', 'conclusion', 'remaining', 'reviewed'))
        if not re.fullmatch(r'[a-z][a-z0-9-]*', entry['id']) or entry['id'] in ids:
            raise ValueError('Discussion IDs must be unique URL anchors')
        ids.add(entry['id'])
        if date.fromisoformat(entry['reviewed']) > updated:
            raise ValueError('Review cannot be newer than the document update')
        if entry.get('status') not in {'supported_detail', 'disputed_interpretation', 'unresolved'}:
            raise ValueError('Unknown discussion conclusion status')
        for link in entry.get('exhibit_links', []):
            _text(link, ('label', 'href'))
            if link['href'] not in {'#history', '#path', '#survey-explorer', '#damage'}:
                raise ValueError('Discussion must link to a known exhibit section')
        for field in ('discussion_sources', 'evidence_sources'):
            refs = entry.get(field)
            if not isinstance(refs, list) or not refs or len(set(refs)) != len(refs):
                raise ValueError('Discussion and evidence citations are required and unique')
            if any(ref not in sources for ref in refs):
                raise ValueError('Discussion cites an unregistered source')
            if any(sources[ref]['access'] in {'unavailable', 'not_reviewed'} for ref in refs):
                raise ValueError('Unread sources cannot support a published discussion entry')
        if not any(sources[ref]['role'] == 'community' for ref in entry['discussion_sources']):
            raise ValueError('A discussion entry needs an inspected community lead')
        if any(sources[ref]['role'] != 'primary' for ref in entry['evidence_sources']):
            raise ValueError('Evidence checks must cite primary records, not repeat the discussion')
    if not ids:
        raise ValueError('Discussion collection is empty')
