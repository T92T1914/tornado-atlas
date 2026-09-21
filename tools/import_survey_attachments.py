"""Refresh attachment metadata for the preserved exhibit survey, not image files."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from atlas.sources import cached_retrieval, read_object, retrieve
from atlas.survey import FOLDER, load_survey
from atlas.survey_attachments import attachment_query, compile_attachments

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--refresh', action='store_true')
args = parser.parse_args()
geometry = json.loads((FOLDER / 'path.geojson').read_bytes())
survey = load_survey(geometry)
ids = sorted(p['id'] for p in survey['points'])
url = attachment_query(ids)
meta = (None if args.refresh else cached_retrieval(url)) or retrieve(url, max_bytes=5_000_000)
raw = read_object(meta)
result = compile_attachments(json.loads(raw), survey, json.loads((FOLDER / 'survey-response.json').read_bytes()))
manifest = {
    'schema': 1, 'query_url': url, 'source_sha256': meta['sha256'], 'bytes': len(raw),
    'retrieved_at': meta['retrieved_at'], 'queried_record_ids': ids,
    'reviewed_counts': {k: result[k] for k in ('records_with_photos', 'photo_count', 'thumbnail_count')},
    'credit': 'Photographs linked by the NOAA/NWS Damage Assessment Toolkit. Individual photographers are not identified in this attachment metadata.',
    'association': 'Exact attachment parent object ID and global ID; event association remains geographic overlap.',
    'timing': 'Survey and attachment records do not establish when the tornado damaged the feature or the photograph was taken.',
    'rights': 'Images remain hosted by NOAA/NWS. Linking an attachment does not establish its photographer or transfer reuse rights.',
}
(FOLDER / 'survey-attachments-response.json').write_bytes(raw)
(FOLDER / 'survey-attachments-source.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps(manifest['reviewed_counts']))
