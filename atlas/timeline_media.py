"""Validate curated time-linked stills, including their clock interpretation."""
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path
from .history import source_url


def validate_timeline_media(manifest, web_root=None):
    if manifest.get('schema') != 1 or manifest.get('event') != 'el-reno-2013':
        raise ValueError('Unsupported timeline media manifest')
    if manifest.get('max_age_seconds') != 240:
        raise ValueError('Reviewed frame age limit must be explicit')
    for key in ('clock_basis', 'credit', 'license', 'changes', 'interpretation'):
        if not isinstance(manifest.get(key), str) or not manifest[key].strip():
            raise ValueError('Media provenance and interpretation are required')
    for key in ('source', 'original_url', 'license_url'):
        source_url(manifest[key])
    if not re.fullmatch('[a-f0-9]{64}', manifest['original_sha256']):
        raise ValueError('Original integrity hash required')
    times, indices, files = [], [], []
    for frame in manifest['frames']:
        stamp = datetime.fromisoformat(frame['utc'])
        if stamp.tzinfo is None or stamp.utcoffset().total_seconds() != 0:
            raise ValueError('Media time needs an explicit UTC offset')
        if stamp.astimezone(timezone.utc).date().isoformat() != '2013-05-31':
            raise ValueError('Frame is outside the event date')
        label = stamp.strftime('%Y%m%d-%H%M%S')
        if frame['source_label'] != f'wseNWRT_Reflectivity_{label}_00.51.png':
            raise ValueError('Frame time disagrees with its transcribed source label')
        if type(frame['frame_index']) is not int or not 0 <= frame['frame_index'] < 242:
            raise ValueError('Invalid original GIF frame index')
        if not re.fullmatch(r'assets/el-reno-2013/radar/frame-\d{3}\.png', frame['file']):
            raise ValueError('Frame outside the curated asset directory')
        if not re.fullmatch('[a-f0-9]{64}', frame['sha256']) or not frame.get('alt'):
            raise ValueError('Frame needs a hash and text alternative')
        if web_root is not None:
            content = (Path(web_root) / frame['file']).read_bytes()
            if hashlib.sha256(content).hexdigest() != frame['sha256']:
                raise ValueError('Frame integrity mismatch')
        times.append(stamp); indices.append(frame['frame_index']); files.append(frame['file'])
    if not times or times != sorted(set(times)) or indices != sorted(set(indices)) or len(files) != len(set(files)):
        raise ValueError('Frames must be unique and chronologically ordered')
