"""Publish essential El Reno reading from the same records used by its clock.

Generated regions live in the existing HTML page. Scripts enhance those regions;
they do not supply a second historical account. Original media remains separate
from its smaller reading versions and from registered reconstruction evidence.
"""
import argparse
import hashlib
import json
import re
from datetime import date
from html import escape
from pathlib import Path


def text(value):
    return escape(str(value), quote=True)


def element(tag, content, **attrs):
    attributes = ''.join(f' {key.rstrip("_").replace("_", "-")}="{text(value)}"'
                         for key, value in attrs.items())
    return f'<{tag}{attributes}>{content}</{tag}>'


def p(value, **attrs):
    return element('p', text(value), **attrs)


def link(label, url, **attrs):
    return element('a', text(label), href=url, **attrs)


def photo_figure(photo, index, hero=False):
    versions = photo['reading_versions']
    preferred = next(row for row in versions if row['width'] == 1280)
    sizes = '(min-width: 1081px) 56vw, (min-width: 701px) 50vw, 100vw'
    image = (f'<img src="{text(preferred["file"])}" '
             f'srcset="{text(", ".join(row["file"]+" "+str(row["width"])+"w" for row in versions))}" '
             f'sizes="{sizes}" width="{photo["width"]}" height="{photo["height"]}" '
             f'alt="{text(photo["alt"])}" loading="{"eager" if hero else "lazy"}" decoding="async"'
             + (' fetchpriority="high"' if hero else '') + '>')
    image_link = element('a', image, href=photo['file'], class_='storm-photo-button',
                         data_storm_photo=index, aria_label=f'Enlarge storm photograph {index+1}')
    caption = p('El Reno, photographed on May 31, 2013. Select to enlarge.' if hero else photo['caption'])
    caption += link(photo['credit'], photo['source']) + ' · ' + link(photo['license'], photo['license_url'])
    if photo.get('creator_url'):
        caption += p('Original creator title: '+photo['creator_title']+'. The historical title uses EF5; the final NWS damage rating is EF3.', class_='fineprint')
        caption += link('Original creator page and caption', photo['creator_url'])
    caption += p('Reading versions resized and JPEG compressed from the preserved original. '
                 + photo['timing_note'], class_='fineprint')
    caption += link('Open the preserved full resolution photograph', photo['file'])
    return element('figure', image_link + element('figcaption', caption))


def regions(bundle):
    exhibit, history = bundle['exhibit'], bundle['history']
    reading, photos = bundle['reading'], bundle['storm_photos']
    impacts, memorial = history['impacts'], history['remembrance']
    names = {row['url']: row['publisher'] for row in reading['sources']}
    result = {
        'place': text(exhibit['location']),
        'introduction': text(exhibit['introduction']) + ' ' + link('NWS account', exhibit['introduction_source']),
        'history-introduction': text(history['introduction']),
        'map-note': text(exhibit['map_note']) + ' ' + link(exhibit['facts'][2]['value'] + ' ' + exhibit['facts'][2]['label'], exhibit['facts'][2]['source']),
        'time-note': text(exhibit['time_note']),
        'coverage': text(exhibit['coverage']['video_review']),
        'remaining': text(exhibit['coverage']['remaining']),
        'impact-scope': text(impacts['scope'] + ' Source revision ' + impacts['snapshot'] + '.'),
        'impact-definitions': text(impacts['note']),
        'impact-discrepancy': text(impacts['discrepancy']) + ' ' + link('Contemporary reporting', impacts['discrepancy_source']),
        'remembrance-title': text(memorial['title']),
        'remembrance-introduction': text(memorial['introduction']),
        'remembrance-scope': text(memorial['scope']),
        'remembrance-source-note': text(memorial['source_note']),
    }
    facts = exhibit['facts'][:2] + [{'value':str(impacts['deaths_direct']), 'label':'Direct tornado deaths', 'source':impacts['source']}]
    result['facts'] = ''.join(element('div', element('strong', text(row['value'])) + link(row['label'], row['source']), class_='fact') for row in facts)
    result['impact-counts'] = ''.join(element('div', element('strong', text(value)) + link(label, impacts['source']), class_='fact')
                                    for label, value in [('Direct fatalities', impacts['deaths_direct']), ('Direct injuries reported', impacts['injuries_direct'])])
    result['historical-context'] = ''.join(element('article', element('h3', text(row['title'])) + p(row['text']) + link('Read the account', row['source']), class_='note') for row in history['context'])
    report = element('nav', element('strong', 'In this history') + ''.join(link(row['title'], '#'+row['id']) for row in history['report']), class_='report-contents', aria_label='In this history')
    for row in history['report']:
        report += element('article', element('h3', link(row['title'], '#'+row['id'])) + ''.join(p(value) for value in row['paragraphs'])
                          + element('div', ''.join(link(source['label'], source['url']) for source in row['sources']), class_='report-links'), id=row['id'])
    result['documentary-report'] = report
    result['hero-photograph'] = photo_figure(photos[0], 0, True)
    result['storm-photographs'] = ''.join(photo_figure(photo, index) for index, photo in enumerate(photos))
    result['visitor-questions'] = ''.join(element('details', element('summary', text(row['question'])) + p(row['answer'])
        + element('p', ''.join(link(source['label'], source['url']) for source in row['sources']), class_='guide-sources'), id=row['id']) for row in bundle['visitor_guide'])
    result['memorial-names'] = ''.join(element('li', element('strong', text(person['name']))
        + (p(person['note']) if person.get('note') else '')
        + element('div', ''.join(link(names.get(url, 'Public source'), url) for url in person['sources']), class_='memorial-sources')) for person in memorial['people'])
    result['notes'] = ''.join(element('article', element('h3', text(row['title'])) + p(row['text'])
        + ''.join(link(names.get(url, 'Source'), url) for url in row['sources']), class_='note') for row in exhibit['discrepancies'])
    times = {int(row['properties']['source_name'].split(':')[1]):row['properties']['display_time']
             for row in bundle['geometry']['features'] if row['geometry']['type'] == 'Point'}
    result['storm-chronology'] = ''.join(element('li', element('span', text(row['time']), class_='chapter-time')
        + element('h4', text(row['title'])) + p(row['text'])
        + element('div', link('View '+times[row['minute']]+' on the map', '#path', data_chapter_minute=row['minute'])
                  + link('NWS account', row['source']), class_='chapter-links'), id='chronology-'+str(row['minute'])) for row in history['chapters'])
    result['forecast-sequence'] = ''.join(element('li', p(local_stamp(row['issued']), class_='eyebrow')
        + element('h3', text(row['title'])) + p(row['summary']) + link('Original NWS text, preserved by IEM', row['source']), id=row['id']) for row in bundle['documentary']['warnings'])
    grouped = {}
    for row in reading['sources']:
        grouped.setdefault(row['group'], []).append(row)
    result['source-register'] = ''.join(element('div', element('h3', text(group)) + element('ol', ''.join(element('li',
        p(row['publisher'], class_='source-publisher') + element('h4', link(row['title'], row['url'])) + p(row['use'])) for row in rows)), class_='source-group') for group, rows in grouped.items())
    updated = date.fromisoformat(reading['updated'])
    result['exhibit-updated'] = 'Exhibit updated ' + element('time', text(updated.strftime('%B')+' '+str(updated.day)+', '+str(updated.year)), datetime=reading['updated'])
    return result


def local_stamp(value):
    from datetime import datetime, timedelta
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00')) - timedelta(hours=5)
    return f'{(stamp.hour-1)%12+1}:{stamp.minute:02d} {"PM" if stamp.hour >= 12 else "AM"} CDT'


def rendered_page(template, bundle):
    for name, content in regions(bundle).items():
        start, end = f'<!-- reading:{name} -->', f'<!-- /reading:{name} -->'
        pattern = re.escape(start) + r'.*?' + re.escape(end)
        template, count = re.subn(pattern, lambda match:start+content+end, template, flags=re.S)
        if count != 1:
            raise ValueError(f'Expected exactly one generated reading region: {name}')
    return template


def publish(root, bundle, check=False):
    path = root / 'web/index.html'
    current = path.read_text(encoding='utf-8')
    generated = rendered_page(current, bundle)
    if check:
        if current != generated:
            raise ValueError('El Reno reading differs from its source records; rebuild museum reading')
    else:
        path.write_text(generated, encoding='utf-8', newline='\n')


def validate_versions(photos, web):
    for photo in photos:
        versions = photo['reading_versions']
        if [row['width'] for row in versions] != [640, 1280, 1920]:
            raise ValueError('Expected three ordered, full-frame reading versions')
        for row in versions:
            path = Path(row['file'])
            if path.as_posix() != f'assets/el-reno-2013/{Path(photo["file"]).stem}-{row["width"]}.jpg':
                raise ValueError('Reading version outside its original photograph family')
            raw = (web / path).read_bytes()
            if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
                raise ValueError('Reading version bytes differ from its record')
            if row['height'] != round(row['width'] * photo['height'] / photo['width']):
                raise ValueError('Reading version changes original framing')
            if not row['changes'] or row['original_sha256'] != photo['sha256']:
                raise ValueError('Reading version needs its change and original identity')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Regenerate essential reading from the checked exhibit bundle')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    bundle = json.loads((root / 'web/data.json').read_text(encoding='utf-8'))
    validate_versions(bundle['storm_photos'], root / 'web')
    publish(root, bundle, args.check)
    print('El Reno reading agrees with its exhibit records.' if args.check else 'El Reno reading published.')
