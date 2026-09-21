"""Join published photographs to their exact DAT parent records, not nearby dots."""
import hashlib
import json
from urllib.parse import urlencode

from .survey import FOLDER, SERVICE


def attachment_query(ids):
    return SERVICE + '/0/queryAttachments?' + urlencode({
        'f': 'json', 'objectIds': ','.join(map(str, sorted(ids))), 'returnMetadata': 'true',
    })


def compile_attachments(response, survey, source_records):
    if response.get('error') or response.get('exceededTransferLimit'):
        raise ValueError('Incomplete attachment response')
    groups = response.get('attachmentGroups')
    if not isinstance(groups, list) or len(groups) > len(survey['points']):
        raise ValueError('Expected bounded attachment groups')
    selected = {p['id'] for p in survey['points']}
    parents = {f['attributes']['objectid']: f['attributes']['globalid']
               for f in source_records['features']}
    photos, seen_parents, seen_attachments = {}, set(), set()
    for group in groups:
        parent = group['parentObjectId']
        if type(parent) is not int or parent not in selected or parent in seen_parents:
            raise ValueError('Unrequested or duplicate photo parent')
        if not isinstance(parents.get(parent), str) or not parents[parent] or group.get('parentGlobalId') != parents[parent]:
            raise ValueError('Photo parent global ID does not match the preserved survey')
        seen_parents.add(parent)
        infos = group['attachmentInfos']
        if not isinstance(infos, list) or len(infos) > 100:
            raise ValueError('Unexpected attachment count')
        names = set()
        for info in infos:
            aid, name = info['id'], info['name']
            if type(aid) is not int or aid <= 0 or aid in seen_attachments:
                raise ValueError('Invalid or duplicate attachment ID')
            seen_attachments.add(aid)
            if not isinstance(name, str) or not name or name in names:
                raise ValueError('Missing or duplicate attachment filename')
            names.add(name)
            if info['contentType'] not in ('image/jpeg', 'image/png'):
                raise ValueError('Unreviewed attachment type')
            if type(info['size']) is not int or not 0 < info['size'] <= 32_000_000:
                raise ValueError('Invalid attachment size')
        originals = [a for a in infos if not a['name'].startswith('thumb_')]
        for thumbnail in (a for a in infos if a['name'].startswith('thumb_')):
            if thumbnail['name'][6:] not in {a['name'] for a in originals}:
                raise ValueError('Thumbnail has no corresponding original')
        photos[str(parent)] = []
        for info in originals:
            url = SERVICE + f'/0/{parent}/attachments/{info["id"]}'
            thumb = next((a for a in infos if a['name'] == 'thumb_' + info['name']), None)
            photos[str(parent)].append({'attachment_id': info['id'], 'source_name': info['name'],
                                       'url': url, 'content_type': info['contentType'], 'bytes': info['size'],
                                       'thumbnail_url': SERVICE + f'/0/{parent}/attachments/{thumb["id"]}' if thumb else url})
    return {'photos': photos, 'records_with_photos': sum(bool(v) for v in photos.values()),
            'photo_count': sum(len(v) for v in photos.values()),
            'thumbnail_count': len(seen_attachments) - sum(len(v) for v in photos.values())}


def load_survey_attachments(survey, folder=FOLDER):
    manifest = json.loads((folder / 'survey-attachments-source.json').read_text(encoding='utf-8'))
    raw = (folder / 'survey-attachments-response.json').read_bytes()
    ids = sorted(p['id'] for p in survey['points'])
    if manifest['schema'] != 1 or manifest['queried_record_ids'] != ids or manifest['query_url'] != attachment_query(ids):
        raise ValueError('Attachment query does not cover the selected survey')
    if hashlib.sha256(raw).hexdigest() != manifest['source_sha256'] or len(raw) != manifest['bytes']:
        raise ValueError('Attachment response hash or byte count mismatch')
    records = json.loads((folder / 'survey-response.json').read_bytes())
    result = compile_attachments(json.loads(raw), survey, records)
    counts = {k: result[k] for k in ('records_with_photos', 'photo_count', 'thumbnail_count')}
    if counts != manifest['reviewed_counts']:
        raise ValueError('Attachment coverage changed; review required')
    return {**result, 'source': manifest}
