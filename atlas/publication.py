"""Publish a bounded, static catalogue for the browser without a database server."""
from __future__ import annotations

import hashlib
import copy
import re
import gzip
import json
import os
import subprocess
import tempfile
from pathlib import Path

from .catalogue import connect, search, stats
from .sources import ROOT, cached_retrieval, read_object, retrieve

LAND_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
# GitHub Pages publishes a site of at most 1 GB. Stop well before it.
SITE_BUDGET_BYTES = 900 * 1024 * 1024
DETAIL_NAME = re.compile(r'details/[0-9a-f]{2}-[0-9a-f]{20}\.json')


def json_bytes(data) -> bytes:
    """Plan the same UTF8 and terminating LF bytes used by publication writes."""
    content = bytearray()
    encoder = json.JSONEncoder(ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    for chunk in encoder.iterencode(data):
        content.extend(chunk.encode('utf-8'))
    content.extend(b'\n')
    return bytes(content)


def write_json(path: Path, data) -> bytes:
    content = json_bytes(data)
    write_bytes(path,content)
    return content


def write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix='build-', suffix='.tmp')
    try:
        with os.fdopen(descriptor, 'wb') as file:
            file.write(content)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def location_review(record: dict, reviews: dict) -> dict | None:
    review = reviews.get(record['id'])
    if review is None:
        return None
    if (review.get('status') != 'disputed'
            or review.get('snapshot_id') != record['provenance']['snapshot_id']
            or review.get('source_sha256') != record['provenance']['sha256']
            or review.get('source_url') != record['provenance']['source_url']
            or review.get('csv_record') != record['provenance']['csv_record']
            or review.get('reported_start') != record['spatial']['begin_point']
            or review.get('reported_end') != record['spatial']['end_point']
            or not review.get('reason')):
        raise ValueError(f"Location review is stale or incomplete: {record['id']}")
    return review


def reviewed_catalogue_aliases(aliases: dict, links: dict, event_index: dict,
                               reviewed_dossiers: list[dict]) -> dict:
    """Reconcile catalogue reading routes without changing historical inputs."""
    if (not isinstance(aliases, dict) or not isinstance(links, dict)
            or set(links) != {'schema_version', 'associations'}
            or type(links['schema_version']) is not int or links['schema_version'] != 1
            or not isinstance(links['associations'], list)):
        raise ValueError('Malformed catalogue dossier annotations')
    routes = {}
    destinations = set()
    for event in event_index.get('events', []):
        identifier, route = event.get('id'), event.get('documentary')
        if (not isinstance(identifier, str) or not identifier or identifier in routes
                or not isinstance(route, str)
                or re.fullmatch(r'[a-z0-9][a-z0-9-]*\.html', route) is None
                or route in destinations):
            raise ValueError('Missing, duplicate or unsafe reviewed article route')
        routes[identifier] = route
        destinations.add(route)
    accepted = {}
    events = set()
    for dossier in reviewed_dossiers:
        event_id = dossier['id']
        if event_id in events or event_id not in routes:
            raise ValueError('Reviewed dossier has no unique article route')
        events.add(event_id)
        for record in dossier['records']:
            if record['status'] != 'reviewed_association':
                continue
            identifier = record['id']
            if identifier in accepted:
                raise ValueError('Ambiguous or duplicate reviewed source association: ' + identifier)
            if not isinstance(record['basis'], str) or not record['basis'].strip():
                raise ValueError('Reviewed source association requires its retained basis')
            accepted[identifier] = (event_id, routes[event_id], record['basis'])
    result = copy.deepcopy(aliases)
    assigned = set()
    linked_events = set()
    for association in links['associations']:
        if (not isinstance(association, dict)
                or set(association) != {'event_id', 'records', 'names'}):
            raise ValueError('Malformed catalogue dossier association')
        event_id = association['event_id']
        identifiers, names = association['records'], association['names']
        if (event_id not in events or event_id in linked_events
                or not isinstance(identifiers, list) or not identifiers
                or not isinstance(names, list) or not names
                or any(not isinstance(name, str) or not name.strip() for name in names)):
            raise ValueError('Catalogue association needs one reviewed event and literal names')
        linked_events.add(event_id)
        for identifier in identifiers:
            if not isinstance(identifier, str) or identifier not in accepted:
                raise ValueError('Catalogue annotation references an unreviewed source record')
            if identifier in assigned or accepted[identifier][0] != event_id:
                raise ValueError('Conflicting catalogue source association: ' + identifier)
            assigned.add(identifier)
            _, route, basis = accepted[identifier]
            annotation = result.get(identifier, {})
            if not isinstance(annotation, dict):
                raise ValueError('Malformed retained catalogue annotation')
            previous_names = annotation.get('names', [])
            if (not isinstance(previous_names, list)
                    or any(not isinstance(name, str) or not name.strip() for name in previous_names)):
                raise ValueError('Retained catalogue names must be literal text')
            if annotation.get('exhibit') not in (None, route):
                raise ValueError('Conflicting retained article route: ' + identifier)
            result[identifier] = {
                **annotation, 'names': list(dict.fromkeys(previous_names + names)),
                'exhibit': route, 'basis': annotation.get('basis', basis),
            }
    if assigned != set(accepted):
        raise ValueError('Catalogue annotations do not cover every reviewed source association')
    for identifier, annotation in result.items():
        route = annotation.get('exhibit') if isinstance(annotation, dict) else None
        if route is not None and (identifier not in accepted or route != accepted[identifier][1]):
            raise ValueError('Article route has no accepted source association: ' + identifier)
    return result


def load_catalogue_aliases(root: Path = ROOT) -> dict:
    # The legacy alias file is a hashed historical adapter input. Keep its bytes
    # intact and apply the catalogue annotations after checking accepted joins.
    # Import locally because archive also imports publication's write helpers.
    from .archive import dossiers
    aliases = json.loads((root / 'research/record-aliases.json').read_text(encoding='utf-8'))
    links = json.loads((root / 'research/catalogue-dossier-links.json').read_text(encoding='utf-8'))
    event_index = json.loads((root / 'exhibits/events.json').read_text(encoding='utf-8'))
    result = reviewed_catalogue_aliases(aliases, links, event_index, dossiers(root))
    for annotation in result.values():
        route = annotation.get('exhibit')
        if route is not None and not (root / 'web' / route).is_file():
            raise ValueError('Reviewed article file is unavailable: ' + route)
    return result


def select_index(record: dict, aliases: dict, detail_file: str, reviews: dict | None = None) -> dict:
    annotation = aliases.get(record['id'], {})
    start = record['spatial']['begin_point']
    end = record['spatial']['end_point']
    result = {
        'id': record['id'], 'title': record['title'], 'aliases': annotation.get('names', []),
        'year': record['year'], 'country': record['country_code'],
        'state': record['administrative_area'], 'area': record['local_area'],
        'rating': record['rating']['reported'],
        'date': (record['time']['begin']['local'] or '')[:10] or None,
        'local_time': record['time']['begin']['local'], 'zone': record['time']['begin']['zone'],
        'point': start if start is not None else end,
        'point_basis': 'reported_start' if start is not None else ('reported_end_only' if end is not None else 'unlocated'),
        'detail_file': detail_file, 'exhibit': annotation.get('exhibit'),
        'source_snapshot': record['provenance']['snapshot_id'],
    }
    if location_review(record, reviews or {}):
        result['location_quality'] = 'disputed'
    return result


def site_bytes(web: Path) -> int:
    """Count every file the Pages artifact would carry."""
    return sum(path.stat().st_size for path in web.rglob('*') if path.is_file())


def check_site_budget(web: Path, limit: int = SITE_BUDGET_BYTES) -> int:
    size = site_bytes(web)
    if size > limit:
        raise ValueError(f'{web} holds {size} bytes, over the {limit} byte publication budget')
    return size


def archived_detail_files(archive: Path | None) -> set[str]:
    """Detail files that the archive index or an archived page names."""
    if archive is None or not archive.is_dir():
        return set()
    names = set()
    for path in archive.rglob('*'):
        if path.is_file():
            names.update(DETAIL_NAME.findall(path.read_text(encoding='utf-8', errors='replace')))
    return names


def indexed_detail_files(content: bytes | None) -> set[str] | None:
    """Detail files a published index names, or None when it cannot be read."""
    if content is None:
        return None
    try:
        return {row['detail_file'] for row in json.loads(content)['records']}
    except (ValueError, KeyError, TypeError):
        return None


def published_detail_files(root: Path, ref: str = 'origin/main') -> set[str]:
    """Detail files the index on the published branch names, or none when Git cannot say."""
    try:
        content = subprocess.run(['git', 'show', f'{ref}:web/catalogue/index.json'], cwd=root,
                                 capture_output=True, check=True, timeout=120).stdout
    except (OSError, subprocess.SubprocessError):
        return set()
    return indexed_detail_files(content) or set()


def prune_details(destination: Path, current: set[str], previous: set[str], protected: set[str]) -> list[str]:
    """Remove detail files that neither of the last two generations nor the archive names."""
    keep = current | previous | protected
    removed = []
    for path in sorted((destination / 'details').glob('*.json')):
        relative = f'details/{path.name}'
        if DETAIL_NAME.fullmatch(relative) and relative not in keep:
            path.unlink()
            removed.append(relative)
    return removed


def export_catalogue(connection, destination: Path, aliases: dict, reviews: dict | None = None,
                     archive: Path | None = None, keep: set[str] | None = None) -> dict:
    reviews = reviews or {}
    coverage = stats(connection)
    count = coverage['current_source_records']
    if not 0 < count <= 100_000:
        raise ValueError('Import between 1 and 100000 records before exporting the static atlas')
    records = search(connection, limit=count)
    if any(record['source'] != 'noaa_ncei_storm_events' for record in records):
        raise ValueError('International records require reviewed browser presentation before static export')
    identifiers = {record['id'] for record in records}
    if set(reviews) - identifiers:
        raise ValueError('Location review references an unavailable record')
    unmatched = sorted(set(aliases) - identifiers)
    groups = {}
    sources = {}
    for record in records:
        # Fixed buckets keep each on-demand response small; filenames identify content.
        bucket = hashlib.sha256(record['id'].encode()).hexdigest()[:2]
        detail = {key: value for key, value in record.items() if key != 'episode_narrative'}
        detail['curation'] = aliases.get(record['id'])
        review = location_review(record, reviews)
        if review:
            detail['location_review'] = review
        groups.setdefault(bucket, {})[record['id']] = detail
        provenance = record['provenance']
        sources[provenance['snapshot_id']] = {
            key: provenance[key] for key in ('snapshot_id', 'source_url', 'sha256', 'retrieved_at')}
    lookup = {}
    for bucket, group in sorted(groups.items()):
        encoded = json.dumps(group, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
        digest = hashlib.sha256(encoded).hexdigest()[:20]
        relative = f'details/{bucket}-{digest}.json'
        write_json(destination / relative, group)
        lookup.update({identifier: relative for identifier in group})
    index = [select_index(record, aliases, lookup[record['id']], reviews) for record in records]
    payload = {
        'schema_version': 1, 'coverage': coverage, 'sources': sources,
        'search_scope': 'Published locality, state, county, source ID and reviewed aliases; not episode narratives.',
        'spatial_scope': 'A marker is a reported start position, or explicitly labeled end fallback. No interpolated tracks.',
        'unmatched_aliases': unmatched, 'records': index,
    }
    detail_count = len(groups)
    current = set(lookup.values())
    # Narratives and detail payloads are no longer needed when encoding the index.
    del records, groups, lookup, identifiers, group, encoded
    index_path = destination/'index.json'
    previous_bytes = index_path.read_bytes() if index_path.is_file() else None
    # Publish the index last, after all its immutable detail files exist.
    index_bytes = json_bytes(payload)
    write_bytes(destination/'index.json.gz',gzip.compress(index_bytes,mtime=0))
    write_bytes(index_path,index_bytes)
    # A loaded page reads only the index it loaded, which is this one or the one before it.
    # An unchanged index starts no new generation, and an unreadable one leaves every file.
    previous = indexed_detail_files(previous_bytes)
    removed = []
    if previous is not None and previous_bytes != index_bytes:
        protected = archived_detail_files(archive) | set(keep or ())
        removed = prune_details(destination, current, previous, protected)
    return {'records': count, 'detail_files': detail_count, 'unmatched_aliases': unmatched,
            'located': sum(record['point'] is not None for record in index),
            'removed_detail_files': len(removed)}


def export_land(destination: Path) -> dict:
    metadata = cached_retrieval(LAND_URL) or retrieve(LAND_URL, max_bytes=2_000_000)
    original = json.loads(read_object(metadata))
    if original.get('type') != 'FeatureCollection':
        raise ValueError('Expected Natural Earth FeatureCollection')
    features = []
    for feature in original['features']:
        if feature['geometry']['type'] not in {'Polygon', 'MultiPolygon'}:
            raise ValueError('Unexpected Natural Earth geometry')
        features.append({'type': 'Feature', 'properties': {'name': feature['properties']['NAME']},
                         'geometry': feature['geometry']})
    result = {'type': 'FeatureCollection', 'features': features, 'source': metadata,
              'attribution': 'Made with Natural Earth. Public domain, 1:110m countries.',
              'transformation': 'Geographic coordinates unchanged. Attributes reduced to display name. Modern boundaries provide orientation, not historical jurisdiction.'}
    write_json(destination, result)
    return {'countries': len(features), 'source_sha256': metadata['sha256']}


def build() -> dict:
    aliases = load_catalogue_aliases(ROOT)
    connection = connect()
    try:
        reviews = json.loads((ROOT / 'research/location-reviews.json').read_text(encoding='utf-8'))
        # The index on disk may be a local export that never published, so the live one is kept too.
        result = export_catalogue(connection, ROOT / 'web/catalogue', aliases, reviews, ROOT / 'web/archive',
                                  published_detail_files(ROOT))
    finally:
        connection.close()
    result['land'] = export_land(ROOT / 'web/land.json')
    return result


if __name__ == '__main__':
    print(json.dumps(build(), indent=2))
