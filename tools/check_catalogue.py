"""Check the published static atlas without needing the research database."""
import hashlib
import gzip
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'web/catalogue'
index = json.loads((folder/'index.json').read_text(encoding='utf-8'))
assert gzip.decompress((folder/'index.json.gz').read_bytes()) == (folder/'index.json').read_bytes()
records = index['records']
assert len(records) == index['coverage']['current_source_records']
assert len({row['id'] for row in records}) == len(records)
cache = {}
counts = {}
for row in records:
    target = (folder / row['detail_file']).resolve()
    assert target.is_relative_to(folder.resolve()), 'Detail file escaped publication directory'
    if target not in cache:
        cache[target] = json.loads(target.read_text(encoding='utf-8'))
        content = json.dumps(cache[target],ensure_ascii=False,separators=(',', ':'),allow_nan=False).encode()
        assert hashlib.sha256(content).hexdigest()[:20] in target.name, 'Detail content differs from its filename'
    detail = cache[target][row['id']]
    assert row['rating'] == detail['rating']['reported']
    assert row['source_snapshot'] == detail['provenance']['snapshot_id']
    assert row['source_snapshot'] in index['sources']
    assert (row.get('location_quality') == 'disputed') == bool(detail.get('location_review'))
    if detail.get('location_review'):
        review = detail['location_review']
        assert review['snapshot_id'] == row['source_snapshot']
        assert review['reported_start'] == detail['spatial']['begin_point']
        assert review['reported_end'] == detail['spatial']['end_point']
        assert review['source_sha256'] == detail['provenance']['sha256']
    point = row['point']
    assert point is None or (len(point)==2 and -180<=point[0]<=180 and -90<=point[1]<=90)
    counts[str(row['year'])] = counts.get(str(row['year']),0)+1
assert counts == index['coverage']['by_year']
assert sum(len(value) for value in cache.values()) == len(records), 'Unindexed details in current shards'
print(f'Static catalogue verified: {len(records)} records, {len(cache)} immutable detail files.')
