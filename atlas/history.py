"""Checks for curated history, named remembrance and credited storm photographs."""
import hashlib
import math
import re
from pathlib import Path
from urllib.parse import urlsplit


def source_url(value):
    if not isinstance(value, str) or urlsplit(value).scheme != 'https' or not urlsplit(value).netloc:
        raise ValueError('A public HTTPS source is required')


def validate_history(history, photos, web_root=None):
    if history.get('schema') != 1 or history.get('event') != 'el-reno-2013':
        raise ValueError('Unsupported history exhibit')
    for context in history['context']:
        if not context.get('title') or not context.get('text'):
            raise ValueError('Historical context needs a title and account')
        source_url(context['source'])
    impacts = history['impacts']
    for key in ('deaths_direct', 'injuries_direct', 'deaths_indirect', 'injuries_indirect'):
        if type(impacts[key]) is not int or impacts[key] < 0:
            raise ValueError('Impact counts must be explicit nonnegative integers')
    source_url(impacts['source'])
    if not impacts['scope'] or not history['remembrance']['scope']:
        raise ValueError('Impact and remembrance scope are required')
    names = set()
    for person in history['remembrance']['people']:
        name = person['name'].strip()
        if not name or name.casefold() in names:
            raise ValueError('Empty or duplicate memorial name')
        names.add(name.casefold())
        if not person['sources']:
            raise ValueError('Every memorial name needs a public source')
        for url in person['sources']:
            source_url(url)
    if len(names) > impacts['deaths_direct']:
        raise ValueError('Remembrance exceeds the declared tornado death count')
    ids = set()
    for section in history.get('report', []):
        if not re.fullmatch('[a-z][a-z0-9-]*', section['id']) or section['id'] in ids:
            raise ValueError('Report needs unique section anchors')
        ids.add(section['id'])
        if not section.get('title') or not section.get('paragraphs') or not section.get('sources'):
            raise ValueError('Report sections need prose and sources')
        if any(not isinstance(p, str) or not p.strip() for p in section['paragraphs']):
            raise ValueError('Report paragraphs must be nonempty text')
        for source in section['sources']:
            source_url(source['url'])
    for place in history['remembrance'].get('places', []):
        if place.get('kind') != 'vehicle_recovery' or place.get('coordinate_basis') != 'published_approximate':
            raise ValueError('Only reviewed approximate vehicle recovery records are currently supported')
        if not re.fullmatch('[a-z][a-z0-9-]*', place['id']) or place['id'] in ids:
            raise ValueError('Place needs a unique section anchor')
        ids.add(place['id'])
        for key in ('label', 'title', 'account', 'precision_note', 'time_note', 'source_locator'):
            if not isinstance(place.get(key), str) or not place[key].strip():
                raise ValueError('Place needs evidence and precision notes')
        coords = place.get('coordinates')
        if (not isinstance(coords, list) or len(coords) != 2
                or any(type(x) not in (float,int) or not math.isfinite(x) for x in coords)
                or not -180 <= coords[0] <= 180 or not -90 <= coords[1] <= 90):
            raise ValueError('Place requires finite longitude and latitude')
        if not place.get('people') or any(name.casefold() not in names for name in place['people']):
            raise ValueError('Place must refer to publicly sourced memorial names')
        source_url(place['source'])
    minutes=[]
    for chapter in history['chapters']:
        minute=chapter['minute']
        if type(minute) is not int or not 4 <= minute <= 42:
            raise ValueError('Chapter must select a published minute')
        minutes.append(minute)
        source_url(chapter['source'])
    if minutes != sorted(set(minutes)):
        raise ValueError('Chapters must be ordered and unique')
    for photo in photos:
        for key in ('source','original_url','license_url'):
            source_url(photo[key])
        if not photo['credit'] or not photo['license'] or not photo['changes'] or not photo['timing_note']:
            raise ValueError('Photographs require attribution and evidence limits')
        path=Path(photo['file'])
        if path.as_posix() not in ('assets/el-reno-2013/storm01.jpg','assets/el-reno-2013/storm02.jpg'):
            raise ValueError('Photograph outside curated asset set')
        if web_root is not None and hashlib.sha256((web_root/path).read_bytes()).hexdigest()!=photo['sha256']:
            raise ValueError('Storm photograph integrity mismatch')
