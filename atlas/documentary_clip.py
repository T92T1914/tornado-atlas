"""Join the bounded documentary clip to its reviewed item and served bytes."""
import hashlib
import re
from .archive import dossiers

CLIP_ID = 'bohac-opening-documentary-motion'
PARENT_ID = 'bohac-archived-extended-film'
SOURCE_ID = 'bohac-licensed-archive-publication'

def validate_clip(doc, web):
    rows = {row['id']: row for row in doc['media']}
    row, parent = rows[CLIP_ID], rows[PARENT_ID]
    source = next(s for s in doc['sources'] if s['id'] == SOURCE_ID)
    clip = row['transformation']
    poster = rows['bohac-opening-film-still']['transformation']
    if (row['parent'] != PARENT_ID or row['source_id'] != SOURCE_ID
            or parent['source_id'] != SOURCE_ID or row['url'] != parent['url']
            or row['roles'] != parent['roles'] or parent['status']['rights'] != 'links_only'
            or row['kind'] != 'video' or row['status']['rights'] != 'permitted_hosting'
            or row['status']['intake'] != 'published' or row['status']['assertion'] != 'observed_sample'
            or row['status']['availability'] != 'reviewed_available'
            or row['status']['temporal'] != 'unregistered' or row['status']['spatial'] != 'unregistered'
            or row['time']['alignment'] is not None or row['time']['capture'] is not None
            or row['place']['coordinates'] is not None
            or row['time']['video'] != {'start_seconds': 0, 'end_seconds': 4}
            or not isinstance(clip['source_sha256'], str)
            or re.fullmatch('[0-9a-f]{64}', clip['source_sha256']) is None
            or clip['source_sha256'] != poster['parent_sha256']
            or clip['source_sha256'] not in re.findall(r'\b[0-9a-f]{64}\b', source['revision'])
            or clip['license_url'] != 'https://creativecommons.org/licenses/by/3.0/'
            or clip['creator'] != 'Ray Bohac' or clip['frames'] != 120
            or clip['frame_rate'] != '30000/1001' or clip['duration_seconds'] != 4.004
            or clip['width'] != 1280 or clip['height'] != 720 or clip['audio_streams'] != 0):
        raise ValueError('Documentary clip differs from its reviewed source, rights or unregistered bounds')
    poster = rows['bohac-opening-film-still']['transformation']
    if clip['poster'] != poster['asset']:
        raise ValueError('Documentary clip needs its retained full-frame poster')
    assets = clip['assets']
    if len(assets) != 2 or [a['type'] for a in assets] != ['video/mp4', 'video/webm']:
        raise ValueError('Documentary clip needs its two reviewed codec alternatives')
    for asset, suffix in zip(assets, ['mp4', 'webm']):
        expected = 'assets/el-reno-2013/bohac-opening-source-relative.' + suffix
        path = web / expected
        if (asset['asset'] != expected or path.is_symlink() or not 0 < asset['bytes'] <= 2_000_000
                or path.stat().st_size != asset['bytes']
                or hashlib.sha256(path.read_bytes()).hexdigest() != asset['sha256']):
            raise ValueError('Documentary clip asset identity differs from its reviewed full-frame encode')
    return dict(id=row['id'], source_url=row['url'], record_url='dossier.html?event=el-reno-2013&media='+row['id']+'#media-'+row['id'], **clip)

def load_clip(root):
    doc = next(d for d in dossiers(root) if d['id'] == 'el-reno-2013')
    return validate_clip(doc, root / 'web')
