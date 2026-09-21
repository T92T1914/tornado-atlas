"""Read a preserved numerical camera-track excerpt without executing JavaScript."""
from datetime import datetime, timezone
import hashlib
import json
import math
import re

from .sources import ROOT

URL = 'https://el-reno-survey.net/ted/ted-elreno-metadata.js'
FOLDER = ROOT / 'exhibits/el-reno-2013'


def parse_track(excerpt):
    # Accept the reviewed literal only. Functions, expressions and extra statements
    # fail JSON parsing; the downloaded JavaScript is never evaluated.
    literal = re.sub(r'([{,]\s*)([A-Za-z0-9_]+)\s*:', r'\1"\2":', excerpt)
    rows = json.loads(literal)
    if not isinstance(rows, list) or not 1 <= len(rows) <= 100:
        raise ValueError('Expected a bounded camera sample array')
    samples, previous = [], None
    for row in rows:
        if set(row) != {'DateTime', 'Latitude', 'Longitude', 'AzimuthCam1', 'AzimuthCam2', 'AzimuthCam3'}:
            raise ValueError('Camera source fields changed')
        stamp = datetime.fromisoformat(row['DateTime'].replace('Z', '+00:00'))
        if stamp.utcoffset() != timezone.utc.utcoffset(stamp) or stamp.date().isoformat() != '2013-05-31':
            raise ValueError('Expected explicit UTC on the event date')
        if previous is not None and stamp <= previous:
            raise ValueError('Camera samples must have unique increasing times')
        previous = stamp
        lat, lon, azimuth = row['Latitude'], row['Longitude'], row['AzimuthCam1']
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in (lat, lon, azimuth)):
            raise ValueError('Invalid camera number')
        if not (35.3 <= lat <= 35.7 and -98.2 <= lon <= -97.5 and 0 <= azimuth <= 360):
            raise ValueError('Camera sample outside reviewed region or azimuth range')
        if row['AzimuthCam2'] is not None or row['AzimuthCam3'] is not None:
            raise ValueError('Additional camera directions require review')
        samples.append({'utc': row['DateTime'], 'coordinates': [lon, lat], 'azimuth': azimuth})
    return samples


def load_cameras(folder=FOLDER):
    manifest = json.loads((folder / 'cameras.json').read_text(encoding='utf-8'))
    excerpt = (folder / 'camera-marshall-literal.txt').read_bytes()
    if hashlib.sha256(excerpt).hexdigest() != manifest['excerpt_sha256']:
        raise ValueError('Camera excerpt hash mismatch')
    if manifest['schema'] != 1 or manifest['event'] != 'el-reno-2013' or manifest['source'] != URL:
        raise ValueError('Camera manifest changed; review source context')
    if manifest['locator'] != 'chaserMetaData.Marshall' or manifest['observer'] != 'Tim Marshall':
        raise ValueError('Camera attribution changed')
    if not re.fullmatch(r'[0-9a-f]{64}', manifest['source_sha256']):
        raise ValueError('Missing full-source hash')
    if manifest['display_max_age_seconds'] != 90:
        raise ValueError('Camera display age policy requires review')
    samples = parse_track(excerpt.decode('utf-8'))
    if len(samples) != 22:
        raise ValueError('Reviewed track sample count changed')
    return {**manifest, 'samples': samples}
