"""Build reviewed event-level media links without assigning camera positions."""
import hashlib
import json
from .publication import write_json
from .sources import ROOT


def build_media(root=ROOT):
    aliases = json.loads((root/'research/record-aliases.json').read_text(encoding='utf-8'))
    photos = json.loads((root/'exhibits/el-reno-2013/storm-photos.json').read_text(encoding='utf-8'))
    events = {'index.html': [], 'joplin.html': []}
    for photo in photos:
        events['index.html'].append({
            'id': photo['id'], 'asset': photo['file'], 'title': 'El Reno, May 31, 2013',
            'caption': photo['caption'], 'alt': photo['alt'], 'credit': photo['credit'],
            'source': photo['source'], 'license': photo['license'], 'licenseUrl': photo['license_url'],
            'sha256': photo['sha256'], 'location': photo['timing_note']})
    manifest=json.loads((root/'exhibits/joplin-2011/manifest.json').read_text(encoding='utf-8'))
    for item in manifest['assets']:
        if item['path'] not in ['web/assets/joplin-2011/storm.jpg','web/assets/joplin-2011/damage.jpg']:
            continue
        storm=item['path'].endswith('/storm.jpg')
        events['joplin.html'].append({
            'id': 'joplin-storm' if storm else 'joplin-damage', 'asset': item['path'][4:],
            'title': 'Joplin tornado' if storm else 'Joplin damage',
            'caption': 'May 22, 2011 tornado, photographed by Daniel Friskey.' if storm else 'Damage after the May 22, 2011 Joplin tornado.',
            'alt': 'The Joplin tornado beneath its storm.' if storm else 'Buildings and debris after the Joplin tornado.',
            'source': item['source'], 'credit': item['credit'], 'license': item['license'],
            'licenseUrl': item.get('license_url'), 'sha256':item['sha256'],
            'location': 'Event-level evidence. Camera location and exact historical time are not registered. '+item.get('date_note','')})
    for collection in events.values():
        for photo in collection:
            path=(root/'web'/photo['asset']).resolve()
            if not path.is_relative_to((root/'web').resolve()) or hashlib.sha256(path.read_bytes()).hexdigest()!=photo['sha256']:
                raise ValueError('Photograph differs from its reviewed source: '+photo['id'])
    records={identifier:{'scope':'Reviewed event association, not a photograph of the reported start or county segment.',
                         'photos':events[annotation['exhibit']]}
             for identifier,annotation in aliases.items() if annotation.get('exhibit') in events}
    return {'schema_version':1,'records':records}


if __name__=='__main__':
    write_json(ROOT/'web/catalogue/media.json',build_media())
