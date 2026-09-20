"""Keep the visitor bibliography tied to sources actually used in the exhibit."""
from datetime import date
from urllib.parse import urlsplit


def _urls(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from _urls(item)
    elif isinstance(value, list):
        for item in value:
            yield from _urls(item)
    elif isinstance(value, str) and value.startswith('https://'):
        yield value


def validate_reading(reading, documents):
    dossier = documents['exhibit']
    if reading.get('schema') != 1 or reading.get('event') != dossier['id']:
        raise ValueError('Reading guide must identify the exhibit and supported schema')
    date.fromisoformat(reading['updated'])
    cited = set(_urls(documents))
    registered = set()
    if not reading.get('sources'):
        raise ValueError('A bibliography requires sources')
    for source in reading['sources']:
        if any(not isinstance(source.get(field), str) or not source[field].strip()
               for field in ('group', 'title', 'publisher', 'url', 'use')):
            raise ValueError('A source needs a title, publisher, URL, group and use note')
        url = source['url']
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('Source URL must be HTTPS without credentials')
        if url in registered:
            raise ValueError('Duplicate source URL')
        if url not in cited:
            raise ValueError('Bibliography source is not used by this exhibit')
        registered.add(url)
    if dossier.get('introduction_source') not in registered:
        raise ValueError('The historical introduction needs a registered source')
