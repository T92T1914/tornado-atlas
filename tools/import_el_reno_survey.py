"""Stage the bounded public DAT snapshot for review; never fetched by visitors."""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from atlas.sources import retrieve, read_object
from atlas.survey import QUERY, FOLDER, SERVICE, compile_survey

if (FOLDER / 'survey-source.json').exists():
    raise SystemExit('A reviewed snapshot already exists. Preserve it before staging a new revision.')
metadata = retrieve(QUERY, max_bytes=4_000_000)
content = read_object(metadata)
geometry = json.loads((FOLDER / 'path.geojson').read_text(encoding='utf-8'))
result = compile_survey(json.loads(content), geometry)
manifest = {'schema': 1, 'query_url': QUERY, 'service_url': SERVICE,
            'retrieved_at': metadata['retrieved_at'], 'sha256': hashlib.sha256(content).hexdigest(),
            'bytes': len(content), 'office': 'OUN', 'spatial_reference': 'EPSG:4326',
            'reviewed_counts': {k: result[k] for k in ('queried_count', 'included_count', 'outside_count')},
            'selection': 'May 31 through June 1, 2013 UTC, within -98.1,35.35,-97.6,35.65. Display only points inside or on the published NWS El Reno outline.',
            'rights': 'Public NOAA/NWS survey attributes; no third-party photographs, names, casualty fields, device identifiers or comments requested.'}
(FOLDER / 'survey-response.json').write_bytes(content)
(FOLDER / 'survey-source.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))
