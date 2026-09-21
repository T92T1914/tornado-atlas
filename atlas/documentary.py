"""Preserved warning records and matched historical imagery, with explicit limits."""
import hashlib
import math
from datetime import datetime, date
from pathlib import Path
from .history import source_url


def validate_documentary(data, root):
    if data.get('schema') != 1 or data.get('event') != 'el-reno-2013':
        raise ValueError('Unsupported documentary exhibit')
    date.fromisoformat(data['reviewed'])
    seen = set()
    previous = None
    def preserved(relative, digest, base=root):
        path = (base / relative).resolve()
        if not path.is_relative_to(base.resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Invalid or changed preserved evidence: {relative}')
    for record in data['warnings']:
        stamp = datetime.fromisoformat(record['issued'])
        if stamp.tzinfo is None or (previous and stamp <= previous) or record['id'] in seen:
            raise ValueError('Warnings need unique IDs and ordered timezone-aware issue times')
        previous = stamp
        seen.add(record['id'])
        source_url(record['source'])
        preserved(record['preserved'], record['sha256'])
        if not record['title'] or not record['summary']:
            raise ValueError('Warning account missing')
        if record['event_id']:
            expiry = datetime.fromisoformat(record['expires'])
            ring = record['polygon']
            if expiry <= stamp or len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError('Invalid warning validity or polygon')
            for lon, lat in ring:
                if not all(math.isfinite(v) for v in (lon, lat)) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
                    raise ValueError('Invalid warning coordinate')
    pair = data['comparison']
    for key in ('source', 'rights', 'original_url'):
        source_url(pair[key])
    preserved(pair['original_asset'], pair['original_sha256'], root / 'web')
    for side in ('before', 'after'):
        preserved(pair[side]['asset'], pair[side]['sha256'], root / 'web')
        if not pair[side]['date'] or not pair[side]['alt']:
            raise ValueError('Image needs a date and description')
    for record in data['log'] + data['unmapped_fatalities']:
        if not record['sources']:
            raise ValueError('Research accounts need sources')
        for source in record['sources']:
            source_url(source['url'])
    if any('coordinates' in item for item in data['unmapped_fatalities']):
        raise ValueError('Unresolved locations cannot silently acquire map pins')


def load_documentary(root):
    import json
    data = json.loads((root / 'exhibits/el-reno-2013/documentary.json').read_text(encoding='utf-8'))
    validate_documentary(data, root)
    return data
