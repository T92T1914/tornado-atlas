"""Read a preserved numerical camera-track excerpt without executing JavaScript."""
from datetime import datetime, timezone
import hashlib
import json
import math
import re
from urllib.parse import urlsplit

from .sources import ROOT

URL = 'https://el-reno-survey.net/ted/ted-elreno-metadata.js'
FOLDER = ROOT / 'exhibits/el-reno-2013'


def validate_camera_context(data, event_id):
    """Check derived observer context before a shared player can render it."""
    from .history import source_url
    if not isinstance(data, dict) or type(data.get('schema')) is not int or data['schema'] != 1 or data.get('event') != event_id:
        raise ValueError('Camera evidence belongs to a different event or schema')
    for key in ('observer', 'source', 'locator', 'credit', 'method', 'limits'):
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise ValueError('Camera evidence needs attribution and display limits')
    source_url(data['source'])
    source = urlsplit(data['source'])
    if source.username is not None or source.password is not None:
        raise ValueError('Camera source must not contain credentials')
    for key in ('source_sha256', 'excerpt_sha256'):
        if not isinstance(data.get(key), str) or not re.fullmatch(r'[a-f0-9]{64}', data[key]):
            raise ValueError('Camera source digest is missing')
    if data.get('display_max_age_seconds') != 90:
        raise ValueError('Camera display age requires review')
    samples = data.get('samples')
    if not isinstance(samples, list) or not 1 <= len(samples) <= 100:
        raise ValueError('Camera evidence needs a bounded sample list')
    previous = None
    for sample in samples:
        if not isinstance(sample, dict) or set(sample) != {'utc', 'coordinates', 'azimuth'}:
            raise ValueError('Unsupported camera sample fields')
        value = sample['utc']
        if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|\+00:00)', value):
            raise ValueError('Camera samples require normalized UTC')
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if previous is not None and stamp <= previous:
            raise ValueError('Camera samples require ordered UTC')
        previous = stamp
        point, azimuth = sample['coordinates'], sample['azimuth']
        if not isinstance(point, list) or len(point) != 2 or any(type(v) not in (int, float) or not math.isfinite(v) for v in (*point, azimuth)):
            raise ValueError('Invalid recorded camera coordinates or bearing')
        if not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90 and 0 <= azimuth <= 360):
            raise ValueError('Invalid recorded camera coordinates or bearing')
    return data


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
    return validate_camera_context({**manifest, 'samples': samples}, manifest['event'])
