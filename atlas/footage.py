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
    if not 1 <= len(data['sources']) <= 8:
        raise ValueError('This player register supports one to eight source versions')
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
    source_seconds = set()
    for anchor in data['anchors']:
        if anchor['source_id'] not in sources:
            raise ValueError('Anchor needs a known source version')
        source = sources[anchor['source_id']]
        value = anchor['utc']
        if not isinstance(value, str) or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|\+00:00)', value):
            raise ValueError('Clock anchors require normalized UTC with whole seconds')
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if stamp.utcoffset() is None or stamp.utcoffset().total_seconds() != 0 or stamp.date().isoformat() != '2013-05-31':
            raise ValueError('Clock anchor requires event UTC')
        if last and stamp < last:
            raise ValueError('Anchors must be ordered')
        if (anchor['source_id'], stamp) in source_seconds:
            raise ValueError('Source clock anchors must be distinct')
        source_seconds.add((anchor['source_id'], stamp))
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
    if 'shot_register' in data:
        validate_shot_register(data['shot_register'], sources, data['anchors'])
    for item in data['guide']:
        if not item['id'] or not item['title'] or not item['text'] or not item['sources']:
            raise ValueError('Reading notes need evidence')
        for source in item['sources']:
            source_url(source['url'])


CDT_LABEL = re.compile(r'([0-9]{1,2}):([0-9]{2}):([0-9]{2}) (AM|PM) CDT')
STAMP = re.compile(r'[0-9]{4}/[0-9]{2}/[0-9]{2}- ([0-9]{2}):([0-9]{2}):([0-9]{2})')
CAMERAS = {'forward', 'rear'}
TRANSITION_KINDS = {'fade_in', 'dissolve', 'hard_cut', 'caption_jump', 'fade_out'}
OVERLAY_KINDS = {'caption', 'inset'}
EDGE = 1e-6


def _text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Shot register needs {label}')


def _seconds(value, low, high, label):
    if type(value) not in (float, int) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'Shot register {label} is missing or out of range')
    return value


def _identity(item, ids):
    if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id'] or item['id'] in ids:
        raise ValueError('Each transition and passage needs a distinct identity')
    ids.add(item['id'])


def _label_seconds(label):
    """Seconds after midnight CDT for a caption label read from a frame."""
    match = CDT_LABEL.fullmatch(label) if isinstance(label, str) else None
    if not match or not 1 <= int(match[1]) <= 12 or int(match[2]) > 59 or int(match[3]) > 59:
        raise ValueError('A clock read needs a CDT caption label')
    hour = int(match[1]) % 12 + (12 if match[4] == 'PM' else 0)
    return hour * 3600 + int(match[2]) * 60 + int(match[3])


def _utc(label):
    """The event UTC second a CDT label stands for. CDT is UTC minus five hours."""
    seconds = _label_seconds(label) + 5 * 3600
    if seconds >= 86400:
        raise ValueError('A clock read must stay on the event date in UTC')
    return f'2013-05-31T{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}Z'


def _clock_end(end, low, high):
    """Check one passage end: a player position and the clock label read on that frame."""
    if not isinstance(end, dict) or set(end) != {'video_seconds', 'clock_label', 'utc'}:
        raise ValueError('A passage end needs a player position and a read clock')
    if end['utc'] != _utc(end['clock_label']):
        raise ValueError('Passage UTC differs from the clock label it was read from')
    return _seconds(end['video_seconds'], low, high, 'passage end'), _label_seconds(end['clock_label'])


def _passage_at(seconds, passages):
    return next((p for p in passages if p['start'] <= seconds <= p['end']), None)


def validate_shot_register(register, sources, anchors):
    """Admit a passage only when both ends carry a read clock and no transition lies between them.

    A transition runs from the last frame of the passage before it to the first
    frame of the passage after it, or from the first frame or to the last frame of
    the upload. Transitions and passages must tile the whole inspected copy, and
    two passages never touch, so a gap or an unrecorded camera change cannot hide
    a cut. Labels are whole seconds, so every clock comparison allows one second.
    A passage registers the upload's edit and its caption clock. It says nothing
    about camera position, bearing or whether the caption clock is right.
    """
    try:
        _check_shot_register(register, sources, anchors)
    except (KeyError, TypeError, AttributeError, IndexError) as error:
        raise ValueError('Invalid shot register') from error


def _check_shot_register(register, sources, anchors):
    if not isinstance(register, dict):
        raise ValueError('Invalid shot register')
    source = sources.get(register.get('source_id'))
    if source is None or register.get('video_id') != source['video_id']:
        raise ValueError('Shot register needs a known source version')
    date.fromisoformat(register['reviewed'])
    reference = register['reference_copy']
    if not isinstance(reference.get('sha256'), str) or not re.fullmatch(r'[0-9a-f]{64}', reference['sha256']):
        raise ValueError('Shot register needs the digest of the inspected copy')
    duration = source['duration_seconds']
    copy_seconds = reference.get('video_seconds')
    if type(copy_seconds) not in (float, int) or not math.isfinite(copy_seconds) or not abs(copy_seconds - duration) <= 0.25:
        raise ValueError('The inspected copy must match the player duration')
    rate = register['clock_rate']
    _text(rate.get('method'), 'a clock rate method')
    value = _seconds(rate.get('value'), 0.9, 1.1, 'clock rate')
    tolerance = _seconds(rate.get('tolerance'), 0, 0.02, 'clock rate tolerance')
    review = register['cut_review']
    _text(review.get('method'), 'a cut review method')
    low = _seconds(review.get('start_seconds'), 0, duration, 'review start')
    high = _seconds(review.get('end_seconds'), 0, duration, 'review end')
    # Every cut means the whole copy: from its first frame to within two frames of its end.
    if low != 0 or not abs(high - copy_seconds) <= 0.07:
        raise ValueError('The review must cover the whole inspected copy')
    ids, transitions, passages = set(), [], []
    for item in register['transitions']:
        _identity(item, ids)
        if item.get('kind') not in TRANSITION_KINDS:
            raise ValueError('Each transition needs a known kind')
        _text(item.get('note'), 'a note for each transition')
        start = _seconds(item.get('start_seconds'), low, high, 'transition')
        end = _seconds(item.get('end_seconds'), low, high, 'transition')
        if end <= start:
            raise ValueError('A transition must be bracketed by two different frames')
        transitions.append((start, end))
    for passage in register['passages']:
        _identity(passage, ids)
        if passage.get('camera') not in CAMERAS:
            raise ValueError('A passage must name the forward or rear camera')
        _text(passage.get('note'), 'a note for each passage')
        start, start_clock = _clock_end(passage.get('start'), low, high)
        end, end_clock = _clock_end(passage.get('end'), low, high)
        if start >= end or end_clock < start_clock:
            raise ValueError('A passage must run forward in the upload and on its clock')
        if any(t_start < end and start < t_end for t_start, t_end in transitions):
            raise ValueError('A passage cannot cross a transition')
        span = end - start
        if abs(end_clock - start_clock - value * span) > 1 + tolerance * span:
            raise ValueError('A passage clock must advance at the measured rate')
        passages.append({'id': passage['id'], 'camera': passage['camera'], 'start': start, 'end': end,
                         'clock': start_clock})
    reach, last = low, None
    for start, end, kind in sorted([(s, e, 'transition') for s, e in transitions] +
                                   [(p['start'], p['end'], 'passage') for p in passages]):
        if abs(start - reach) > EDGE:
            raise ValueError('Transitions and passages must cover the reviewed range without gaps or overlaps')
        if kind == last == 'passage':
            raise ValueError('Two passages must be separated by a transition')
        reach, last = end, kind
    if abs(reach - high) > EDGE:
        raise ValueError('Transitions and passages must cover the reviewed range without gaps or overlaps')

    def on_line(seconds, label):
        passage = _passage_at(seconds, passages)
        if passage is not None:
            elapsed = seconds - passage['start']
            if abs(_label_seconds(label) - passage['clock'] - value * elapsed) > 1 + tolerance * elapsed:
                raise ValueError('A clock read disagrees with its passage')
        return passage

    published = {a['id']: a for a in anchors if a['source_id'] == register['source_id']}
    reads = register['anchor_reads']
    if sorted(str(r.get('anchor_id')) for r in reads) != sorted(published):
        raise ValueError('Every published anchor of this source needs one read in the register')
    for read in reads:
        anchor = published[read['anchor_id']]
        seconds = _seconds(read.get('video_seconds'), low, high, 'anchor read')
        if abs(seconds - anchor['video_seconds']) > 0.05:
            raise ValueError('An anchor read must use the anchor frame')
        if _utc(read.get('clock_label')) != anchor['utc'].replace('+00:00', 'Z'):
            raise ValueError('An anchor read disagrees with the published anchor')
        if on_line(seconds, read['clock_label']) is None:
            raise ValueError('An anchor read must sit inside a passage')
    offsets = {}
    for item in register['stamp_comparisons']:
        seconds = _seconds(item.get('video_seconds'), low, high, 'stamp comparison')
        passage = on_line(seconds, item.get('clock_label'))
        if passage is None or item.get('camera') != passage['camera']:
            raise ValueError('A stamp comparison must sit inside a passage of its camera')
        stamp = STAMP.fullmatch(item['stamp']) if isinstance(item.get('stamp'), str) else None
        if not stamp or int(stamp[1]) > 23 or int(stamp[2]) > 59 or int(stamp[3]) > 59:
            raise ValueError('A stamp comparison needs the camera stamp as printed')
        printed = int(stamp[1]) * 3600 + int(stamp[2]) * 60 + int(stamp[3])
        offsets.setdefault(passage['id'], []).append((printed - _label_seconds(item['clock_label'])) % 86400)
    # One camera clock keeps one offset from a caption that follows it. Offsets are
    # measured around the first one so that a pair either side of midnight compares.
    for found in offsets.values():
        centred = [(offset - found[0] + 43200) % 86400 - 43200 for offset in found]
        if max(centred) - min(centred) > 1:
            raise ValueError('A camera stamp must keep one offset from the caption inside a passage')
    previous = low
    for overlay in register['overlays']:
        if overlay.get('kind') not in OVERLAY_KINDS:
            raise ValueError('Each overlay needs a known kind')
        _text(overlay.get('text'), 'the text of each overlay')
        start = _seconds(overlay.get('start_seconds'), low, high, 'overlay')
        end = _seconds(overlay.get('end_seconds'), low, high, 'overlay')
        if end < start or start < previous:
            raise ValueError('Overlays must be ordered and run forward')
        previous = start


def load_footage(root=ROOT):
    data = json.loads((root / 'exhibits/el-reno-2013/footage.json').read_text(encoding='utf-8'))
    validate_footage(data)
    return data
