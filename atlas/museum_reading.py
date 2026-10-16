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
    preferred = min(versions, key=lambda row: abs(row['width']-1280))
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
    presentation = ('Original photograph preserved and displayed in full frame. '
        if len(versions) == 1 and versions[0]['file'] == photo['file']
        else 'Reading versions resized and JPEG compressed from the preserved original. ')
    caption += p(presentation + photo['timing_note'], class_='fineprint')
    caption += link('Open the preserved full resolution photograph', photo['file'])
    return element('figure', image_link + element('figcaption', caption))


def simulator_early_region(bundle):
    observation = bundle['documentary']['reported_appearance']['observations'][0]
    drawing = element('canvas', '', id='early-condensation-canvas', role='img',
                      aria_label='Independent schematic of the lighter condensation taper in the earlier photograph',
                      aria_describedby='early-condensation-caption early-condensation-omission early-condensation-time', hidden='hidden')
    record = json.dumps(observation, ensure_ascii=False).replace('<', chr(92) + 'u003c')
    return (element('h3', text(observation['title']))
        + p('Reported '+observation['reported_time']['local']+' / '+observation['reported_time']['utc'], class_='eyebrow')
        + element('figure', drawing + element('figcaption', p(observation['caption'], id='early-condensation-caption')
            + p(observation['omission'], id='early-condensation-omission')))
        + p('The source account and interpretation remain readable here. The drawing loads when available.', id='early-condensation-status', role='status', class_='fineprint')
        + p(observation['clock_note'], id='early-condensation-time')
        + element('p', link('Open Reid’s original photograph', observation['original_url'])+' · '
            + link('Read the creator’s account and caption', observation['account_url'])+' · '
            + link('Compare the later appearance study', 'reconstruction.html?event=el-reno-2013&t=1241&appearance_view=photo&appearance_photo=wakimoto-visible-condensation#replay-appearance'))
        + element('details', element('summary', 'What this view can tell us')
            + p('The photograph supports a coarse visible form, not measured tornado height, radius, ground contact or damaging-wind extent. The earlier group’s camera lens is not assigned to this relocated view. The original photograph remains at its creator publication; source pixels are not hosted here.'))
        + '<script type="application/json" id="early-condensation-record">'+record+'</script>')


def documentary_photographs(bundle):
    from datetime import datetime
    timeline = bundle.get('appearance_timeline', {})
    groups = []
    for sequence in timeline.get('photo_sequences', []):
        samples = [sample for sample in sequence['samples'] if sample.get('hosted_image')]
        if not samples:
            continue
        report = samples[0]['hosted_image']['creator_report']
        content = element('h3', 'Three moments in Nick Nolte’s El Reno account')
        content += p('Creator-attributed discrete documentary observations. These full published GoPro exports retain their complete location, time and copyright marks.')
        content += p(report['limits'])
        content += element('details', element('summary', 'Camera and publication context') + p(report['lineage']) + p(report['viewpoint']))
        for sample in samples:
            image = sample['hosted_image']
            guide = image['creator_report']
            bitmap = (f'<img src="{text(image["asset"])}" width="{image["width"]}" height="{image["height"]}" '
                      f'alt="{text(image["alt"])}" loading="lazy" decoding="async">')
            view = element('a', bitmap, href=image['asset'], data_documentary_photo=sample['id'],
                           class_='documentary-photo-link', aria_label='View complete '+sample['id']+'.jpg by '+image['creator'])
            record = 'dossier.html?event=el-reno-2013&media='+image['record_id']+'#media-'+image['record_id']
            seconds = int((datetime.fromisoformat(sample['reported_utc'].replace('Z','+00:00'))-
                           datetime.fromisoformat(min(row['properties']['utc'] for row in bundle['geometry']['features'] if row['geometry']['type']=='Point'))).total_seconds())
            player = ('reconstruction.html?event=el-reno-2013&t='+str(seconds)+'&appearance_view=photo&appearance_photo='
                      +sequence['id']+'#replay-appearance')
            caption = p(image['caption']) + p(image['creator']+' · '+image['rights_basis'])
            caption += element('p', link('Open the unchanged full resolution JPEG', image['asset'])+' · '
                +link('Original full JPEG at the creator’s site', image['original_url'])+' · '
                +link('Source and item permission', record)+' · '+link('Read this reported instant in the player',player))
            caption += element('p', link('Creator-reported movie guide '+guide['movie_locator'],guide['movie_url']+'&t='+str(guide['movie_seconds'])+'s')
                +' (navigation guide, not a source frame number or calibrated UTC).')
            caption += element('details', element('summary','Identity and clock limits')
                +p('Unchanged '+str(image['width'])+' × '+str(image['height'])+' JPEG; '+str(image['bytes'])+' bytes; SHA256 '+image['sha256'])
                +p(guide['clock_disposition']))
            content += element('figure',view+element('figcaption',caption),id='documentary-'+sample['id'])
        groups.append(element('section',content,id='nolte-documentary-photographs',class_='documentary-media'))
    return ''.join(groups)


def documentary_motion(clip):
    sources = ''.join('<source src="'+text(a['asset'])+'" type="'+text(a['type'])+'">' for a in clip['assets'])
    video = ('<video controls playsinline preload="none" width="1280" height="720" poster="'+text(clip['poster'])+'" '
             'aria-label="Ray Bohac: four seconds of changing viewpoint" aria-describedby="bohac-motion-description bohac-motion-limits" data-documentary-clip>'
             +sources+'Your browser cannot play these formats. Use the clip or archived source links below.</video>')
    content = element('h3', 'Watch the foreground before judging the shape')
    content += p('Play this short, silent passage, then pause and move through it with the video controls. It stays still until you choose to play.')
    content += '<button type="button" hidden data-clip-action>Play short clip</button><p data-clip-status role="status">The silent clip plays only when selected. Native video controls and original links remain available.</p>'
    content += element('figure', video + element('figcaption',
        p('Ray Bohac · Silent opening passage, preserved in full frame. Shortened and compressed from the archived extended film.') + element('details', element('summary', 'How this clip was prepared') + p(clip['recipe'])) + element('p', link('Archived extended film', clip['source_url'])+' · '+link('CC BY 3.0',clip['license_url'])+' · '+link('Clip, parent and reuse record',clip['record_url']))))
    content += p('Follow the tree beside the dark lowering, the roadside pole and the vehicle mirror. As the view shifts and tilts, the tree moves from in front of the lower region toward its right side. The pole crosses the view. These foreground changes help explain why the visible outline can change without supplying a measurement of the tornado’s growth.',id='bohac-motion-description')
    content += p('The controls show elapsed time in this clip, not UTC. The 120 consecutive source presentations occupy 4.004 seconds at the original cadence. Camera motion, perspective, obstruction and storm evolution are not separated here. This passage supplies no calibrated viewpoint, physical dimensions or historical appearance interval.',id='bohac-motion-limits')
    content += element('p',link('Open the MP4 clip',clip['assets'][0]['asset'])+' · '+link('Open the WebM clip',clip['assets'][1]['asset']))
    return content


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
        media_route = {'tracked-feature-radar': ('Compare the source-relative motion example', '#bohac-opening-motion'), 'reading-films-and-encyclopedias': ('Inspect the permitted documentary photographs', '#nolte-documentary-photographs')}.get(row['id'])
        report += element('article', element('h3', link(row['title'], '#'+row['id'])) + ''.join(p(value) for value in row['paragraphs'])
                          + element('div', ''.join(link(source['label'], source['url']) for source in row['sources'])
                              + (link('Inspect the feature-tracking observation and limits', 'dossier.html?event=el-reno-2013&observation=wakimoto-2016-dust-feature-radar-comparison#observation-wakimoto-2016-dust-feature-radar-comparison') if row['id']=='tracked-feature-radar' else ''), class_='report-links') + (element('div', link(*media_route), class_='article-branch') if media_route else ''), id=row['id'])
        if row['id'] == 'early-downward-extension':
            report += element('p', link('Inspect the reported 23:05:10 instant and its limits', 'reconstruction.html?event=el-reno-2013&t=70&appearance_view=photo&appearance_photo=wakimoto-early-extension#replay-appearance') + ' · ' + link('Read the source observation', 'dossier.html?event=el-reno-2013&observation=wakimoto-2016-early-extension#observation-wakimoto-2016-early-extension'), class_='article-branch')
    result['documentary-report'] = report
    observation = bundle['documentary']['reported_appearance']['observations'][0]
    result['early-condensation'] = (element('h3', 'An earlier photograph by William T. Reid')
        + p('Creator caption: '+observation['reported_time']['local']+' / '+observation['reported_time']['utc'], class_='eyebrow')
        + p('Open the original photograph and read Reid’s account of this earlier view. The photograph remains at its creator’s publication.')
        + element('p', link('Open Reid’s original photograph', observation['original_url'])+' · '
            + link('Read the creator’s account and caption', observation['account_url']))
        + p('The caption supplies a reported minute. The exposure second, camera clock accuracy and calibrated viewpoint remain unknown.', class_='fineprint')
        + element('p', link('Open the appearance study in the simulator', 'reconstruction.html?event=el-reno-2013#replay-reported-appearance')))
    result['hero-photograph'] = photo_figure(photos[0], 0, True)
    result['storm-photographs'] = ''.join(photo_figure(photo, index) for index, photo in enumerate(photos))
    result['documentary-photographs'] = documentary_photographs(bundle)
    result['bohac-opening-motion'] = documentary_motion(bundle['documentary_clip'])
    result['visitor-questions'] = ''.join(element('details', element('summary', text(row['question'])) + p(row['answer'])
        + element('p', ''.join(link(source['label'], source['url']) for source in row['sources']), class_='guide-sources'), id=row['id']) for row in bundle['visitor_guide'])
    result['footage-guide'] = ''.join(element('article', element('h3', text(row['title'])) + p(row['text'])
        + ''.join(link(source['label'], source['url'], target='_blank', rel='noopener')
                  for source in row['sources']), id=row['id']) for row in bundle['footage']['guide'])
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
    article = root / 'web/index.html'
    simulator = root / 'web/reconstruction.html'
    current_article = article.read_text(encoding='utf-8')
    current_simulator = simulator.read_text(encoding='utf-8')
    generated_article = rendered_page(current_article, bundle)
    start, end = '<!-- reading:simulator-early-condensation -->', '<!-- /reading:simulator-early-condensation -->'
    generated_simulator, count = re.subn(re.escape(start)+r'.*?'+re.escape(end),
        lambda match: start+simulator_early_region(bundle)+end, current_simulator, flags=re.S)
    if count != 1:
        raise ValueError('Expected one simulator appearance reading region')
    if check:
        if current_article != generated_article or current_simulator != generated_simulator:
            raise ValueError('Museum or simulator reading differs from its source records; rebuild museum reading')
    else:
        article.write_text(generated_article, encoding='utf-8', newline='\n')
        simulator.write_text(generated_simulator, encoding='utf-8', newline='\n')


def validate_versions(photos, web):
    for photo in photos:
        versions = photo['reading_versions']
        original_only = (photo['width'] < 1280 and len(versions) == 1
            and versions[0]['file'] == photo['file']
            and versions[0]['width'] == photo['width']
            and versions[0]['height'] == photo['height']
            and versions[0]['sha256'] == photo['sha256'])
        if not original_only and [row['width'] for row in versions] != [640, 1280, 1920]:
            raise ValueError('Expected three ordered reading versions or the unchanged smaller original')
        for row in versions:
            path = Path(row['file'])
            if not original_only and path.as_posix() != f'assets/el-reno-2013/{Path(photo["file"]).stem}-{row["width"]}.jpg':
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
