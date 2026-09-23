"""Publish a bounded, static catalogue for the browser without a database server."""
from __future__ import annotations

import hashlib
import gzip
import json
import os
import tempfile
from pathlib import Path

from .catalogue import connect, search, stats
from .sources import ROOT, cached_retrieval, read_object, retrieve

LAND_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'


def write_json(path: Path, data) -> bytes:
    content = (json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()
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


def export_catalogue(connection, destination: Path, aliases: dict, reviews: dict | None = None) -> dict:
    reviews = reviews or {}
    coverage = stats(connection)
    count = coverage['current_source_records']
    if not 0 < count <= 100_000:
        raise ValueError('Import between 1 and 100000 records before exporting the static atlas')
    records = search(connection, limit=count)
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
    # Publish the index last, after all its immutable detail files exist.
    index_bytes=(json.dumps(payload,ensure_ascii=False,separators=(',', ':'),allow_nan=False)+'\n').encode()
    write_bytes(destination/'index.json.gz',gzip.compress(index_bytes,mtime=0))
    write_bytes(destination/'index.json',index_bytes)
    return {'records': count, 'detail_files': len(groups), 'unmatched_aliases': unmatched,
            'located': sum(record['point'] is not None for record in index)}


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
    aliases = json.loads((ROOT / 'research/record-aliases.json').read_text(encoding='utf-8'))
    connection = connect()
    try:
        reviews = json.loads((ROOT / 'research/location-reviews.json').read_text(encoding='utf-8'))
        result = export_catalogue(connection, ROOT / 'web/catalogue', aliases, reviews)
    finally:
        connection.close()
    result['land'] = export_land(ROOT / 'web/land.json')
    return result


if __name__ == '__main__':
    print(json.dumps(build(), indent=2))
