"""Reviewed documentary clocks, without geographic or media registration."""
import hashlib
import re
from urllib.parse import urlsplit

from .event_package import fields, utc, asset_path
from .history import source_url


def validate_chronology(data, event_id, root=None):
    fields(data, ('schema_version', 'event_id', 'title', 'clock', 'sources', 'entries'), 'chronology')
    if type(data['schema_version']) is not int or data['schema_version'] != 1 or data['event_id'] != event_id:
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
    return data
