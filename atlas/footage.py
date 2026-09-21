"""Validate discrete historical clock anchors without inventing interval coverage."""
import json
import math
import re
from datetime import datetime, date
from .sources import ROOT
from .history import source_url


def validate_footage(data):
    if data.get('schema') != 1 or data.get('event') != 'el-reno-2013':
        raise ValueError('Unsupported footage register')
    date.fromisoformat(data['reviewed'])
    if data['mode'] != 'discrete_clock_anchors':
        raise ValueError('Continuous registration needs a separate coverage review')
    if len(data['sources']) != 1:
        raise ValueError('This player register supports one source version')
    sources = {}
    for source in data['sources']:
        if source['id'] in sources or not re.fullmatch(r'[A-Za-z0-9_-]{11}', source['video_id']):
            raise ValueError('Duplicate or invalid video identity')
        source_url(source['url'])
        if source['url'] != 'https://www.youtube.com/watch?v=' + source['video_id']:
            raise ValueError('Source link and playable version differ')
        if not all(source.get(k) for k in ('creator', 'title', 'rights', 'clock_basis', 'limits')):
            raise ValueError('Missing attribution or clock limits')
        if not isinstance(source['duration_seconds'], (float, int)) or not math.isfinite(source['duration_seconds']) or source['duration_seconds'] <= 0:
            raise ValueError('Invalid duration')
        sources[source['id']] = source
    seen = set()
    last = None
    for anchor in data['anchors']:
        source = sources[anchor['source_id']]
        stamp = datetime.fromisoformat(anchor['utc'].replace('Z', '+00:00'))
        if stamp.utcoffset() is None or stamp.utcoffset().total_seconds() != 0 or stamp.date().isoformat() != '2013-05-31':
            raise ValueError('Clock anchor requires event UTC')
        if last and stamp <= last:
            raise ValueError('Anchors must be ordered and distinct')
        last = stamp
        seconds = anchor['video_seconds']
        if type(seconds) not in (float, int) or not math.isfinite(seconds) or not 0 <= seconds < source['duration_seconds']:
            raise ValueError('Anchor outside source video')
        if anchor['id'] in seen or not anchor['note'] or anchor['evidence'] != 'onscreen_clock_sample':
            raise ValueError('Anchor must identify the inspected evidence')
        seen.add(anchor['id'])
        # A clock reading does not geolocate a camera or establish a fatal impact.
        if anchor.get('coordinates') is not None or anchor.get('bearing') is not None:
            raise ValueError('Spatial registration needs independent evidence')
        if 'end_utc' in anchor or 'end_seconds' in anchor:
            raise ValueError('A paused sample cannot become a continuous reviewed passage')
    if not seen:
        raise ValueError('At least one checked clock anchor required')
    for item in data['guide']:
        if not item['id'] or not item['title'] or not item['text'] or not item['sources']:
            raise ValueError('Reading notes need evidence')
        for source in item['sources']:
            source_url(source['url'])


def load_footage(root=ROOT):
    data = json.loads((root / 'exhibits/el-reno-2013/footage.json').read_text(encoding='utf-8'))
    validate_footage(data)
    return data
