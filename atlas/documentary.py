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
    for item in data['unmapped_fatalities']:
        if 'location_review' not in item:
            continue
        review = item['location_review']
        date.fromisoformat(review['date'])
        if not review['needed'] or not review['evidence']:
            raise ValueError('Location reviews must explain evidence and what remains unresolved')
        for row in review['evidence']:
            if not all(row.get(key, '').strip() for key in ('title', 'finding', 'limit', 'source_label')):
                raise ValueError('Location evidence needs an account, source label and limitation')
            source_url(row['source'])


def load_documentary(root):
    import json
    data = json.loads((root / 'exhibits/el-reno-2013/documentary.json').read_text(encoding='utf-8'))
    validate_documentary(data, root)
    return data


def validate_remembrance_coverage(history, documentary):
    """Every named victim must have one visible, sourced location status."""
    people = [person['name'] for person in history['remembrance']['people']]
    if len(people) != history['impacts']['deaths_direct'] or len(people) != len(set(people)):
        raise ValueError('El Reno remembrance must account for all eight recorded deaths')
    located = [name for place in history['remembrance']['places'] for name in place['people']]
    unresolved = [name for record in documentary['unmapped_fatalities'] for name in record['people']]
    coverage = located + unresolved
    if len(coverage) != len(set(coverage)) or set(coverage) != set(people):
        raise ValueError('Every remembered person needs exactly one location status')
    ids = [record['id'] for record in documentary['unmapped_fatalities']]
    if len(ids) != len(set(ids)) or any(not value.startswith('location-') for value in ids):
        raise ValueError('Unresolved location records need distinct stable links')
    if any(not record['account'] or not record['reason'] for record in documentary['unmapped_fatalities']):
        raise ValueError('Explain each unresolved location without inventing a pin')
