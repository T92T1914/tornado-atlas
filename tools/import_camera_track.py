"""Preserve the selected Tim Marshall literal and its source provenance."""
import hashlib
import json
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from atlas.cameras import FOLDER, URL, parse_track
from atlas.sources import cached_retrieval, read_object, retrieve

metadata = cached_retrieval(URL) or retrieve(URL)
source = read_object(metadata).decode('utf-8-sig')
matches = re.findall(r'chaserMetaData\.Marshall\s*=\s*(\[.*?\])\s*,', source, re.S)
if len(matches) != 1 or len(parse_track(matches[0])) != 22:
    raise ValueError('Expected the one reviewed 22-sample Marshall track')
excerpt = (matches[0] + '\n').encode('utf-8')
manifest = {
    'schema': 1, 'event': 'el-reno-2013', 'observer': 'Tim Marshall',
    'source': URL, 'project': 'https://el-reno-survey.net/',
    'participants': 'https://el-reno-survey.net/participants/',
    'locator': 'chaserMetaData.Marshall', 'source_sha256': metadata['sha256'],
    'retrieved_at': metadata['retrieved_at'], 'excerpt_sha256': hashlib.sha256(excerpt).hexdigest(),
    'display_max_age_seconds': 90,
    'credit': 'El Reno Survey Project; Tim Marshall camera track.',
    'method': 'Published UTC timestamps, latitude, longitude and camera 1 azimuth. Directions are shown clockwise from north, following the source viewer. Camera positions are not interpolated.',
    'limits': 'The marker shows the latest preceding recorded camera location for at most 90 seconds, then disappears. This is a display rule, not a measured error bound. Location, clock and direction uncertainty are not quantified. The arrow has no distance or field-of-view meaning. No photograph or video frame is assigned to this track here.',
}
(FOLDER / 'camera-marshall-literal.txt').write_bytes(excerpt)
(FOLDER / 'cameras.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Preserved 22 Tim Marshall samples; no downloaded code executed.')
