"""Exact October 29 reviewed continuations over retained historical contracts.

A historical increment is tested at its accepted publication boundary. Before
returning that boundary, these controls require the actual current document,
its immutable bytes and history, and every difference to match the four named
reviewed promotions. Unknown edits or future promotions receive no allowance.
"""
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Independently reviewed immutable old/current publications, not runtime adapter
# expectations. New source qualification requires a new explicit amendment.
PROMOTIONS = {'el-reno-2013': {'previous': '854b56dffaf8720e27beab95bf091450f3de80ba8d0f8f678ee21986b6fa410c',
                  'previous_file': 'archive/el-reno-2013-854b56dffaf8720e27be.json',
                  'previous_wire': '7033875ffc69f083f131ddfb31136afab6d5af418e4d0bb9dbfa3d69b5c5b131',
                  'current': '3a4374318d08b471b95970693f1ef0d5c3a31f8935d978fd8ca39709987a93a9',
                  'current_file': 'archive/el-reno-2013-3a4374318d08b471b959.json',
                  'current_wire': 'fda8f908acffe9b264a19c3a6f1303dd709533138c20c97cdfee641e11503813',
                  'history_file': 'archive/el-reno-2013-history-83bf806718d6548fb2ef.json',
                  'history_wire': '8f0285a05864e5767596a116132428f6b1cad5e565e1771b9bc01e8bdb5041f3'},
 'joplin-2011': {'previous': '68dca24097277ba2afb70a2430ed89cda500cd4e833c804347b2dee2e4ebe326',
                 'previous_file': 'archive/joplin-2011-68dca24097277ba2afb7.json',
                 'previous_wire': '05d6966cb4c1e6469c1b1cae9ed26b0799f330ecfb696ab80efb2d11d2315bd2',
                 'current': '287b0f5e3036c9f765497b6e5e9b4c6e3994699345decfd4c99f768373d6190c',
                 'current_file': 'archive/joplin-2011-287b0f5e3036c9f76549.json',
                 'current_wire': '9133b8b962c879c395a9125e78567d47dae2cd8c5f4b221b8da06ebbf0c52dc0',
                 'history_file': 'archive/joplin-2011-history-87a76b5d14e2151ac81c.json',
                 'history_wire': '1349373855c3baef67ca7aa46096771e06751f5d8682b72170cbc8fdecbfe00d'},
 'blackwell-1955': {'previous': '9e74182ea8d0076dae452b9a29e44158793d5b2bafe7a237d7969ec336ea5b8b',
                    'previous_file': 'archive/blackwell-1955-9e74182ea8d0076dae45.json',
                    'previous_wire': '7d4aad53d4bdaa7fd9813a5b4f962145bfe484fd0d0a0b9195128364b8232dd1',
                    'current': 'c0ccacb0fa341a0989a4e16dc1d9e8ac040c07248ab3ceb1cb6a415daf0e29a2',
                    'current_file': 'archive/blackwell-1955-c0ccacb0fa341a0989a4.json',
                    'current_wire': 'c4459214136b7c1f026a53a65a815a667778bd35aa95393dd79a19a8f74ce68d',
                    'history_file': 'archive/blackwell-1955-history-efcb0a168fc9aab08ff8.json',
                    'history_wire': 'b18e915f43f0885e874006b3cc80ed95d86568cdc0680cd841a2b999bc238c7f'},
 'tuscaloosa-birmingham-2011': {'previous': 'e0ed6012db7845157367bfb80aef9b9f22efd21fb3857fe32308d994de93bdfd',
                                'previous_file': 'archive/tuscaloosa-birmingham-2011-e0ed6012db7845157367.json',
                                'previous_wire': 'e97e0a32c9888a7dfc359ef8a1d954e0c092ea900d69d031e3c1464c1cc07f63',
                                'current': '22697c0e0b3bcdf5fce7b4ff7fb4e73e05186ae129d5fa65dc4830b982fe591e',
                                'current_file': 'archive/tuscaloosa-birmingham-2011-22697c0e0b3bcdf5fce7.json',
                                'current_wire': 'fd8a0deb7a5dc0a7cf239a364dd46624b86a354e67a84cab110cf8bf1bcd353c',
                                'history_file': 'archive/tuscaloosa-birmingham-2011-history-f05ca75ccb1f4a3034e0.json',
                                'history_wire': 'f82427eecf7f5eb8ba3fa62ba735cf3fd846c5f70ae81aa94201df4c82c60dc6'}}

CHANGED_FIELDS = {
    'el-reno-2013': [('summary',), ('media', 'bohac-archived-extended-film', 'limits'),
                    ('media', 'bohac-archived-extended-film', 'transformation')],
    'joplin-2011': [('media', 'piotrowski-joplin-original', 'limits')],
    'blackwell-1955': [('media', 'tulsa-blackwell-enhanced-edition', 'account'),
                      ('media', 'tulsa-blackwell-enhanced-edition', 'limits'),
                      ('media', 'tulsa-blackwell-enhanced-edition', 'review', 'coverage')],
    'tuscaloosa-birmingham-2011': [('media', 'brown-tuscaloosa-original', 'account'),
                                ('media', 'brown-tuscaloosa-original', 'limits'),
                                ('media', 'brown-tuscaloosa-original', 'review', 'coverage'),
                                ('reconstruction', 'limits')],
}
JOPLIN_ADDITIONS = {
    'records': ['ncei:296616'],
    'sources': ['ncei-joplin-county-segments'],
    'observations': ['joplin-three-county-segments',
                     'joplin-whole-track-length-alternatives',
                     'joplin-source-segment-clocks'],
}


def canonical(doc):
    return hashlib.sha256(json.dumps(doc, ensure_ascii=False, sort_keys=True,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def _bound(case, root, file, wire, logical=None):
    raw = (root / 'web' / file).read_bytes()
    case.assertEqual(hashlib.sha256(raw).hexdigest(), wire,
                     'Immutable reviewed publication bytes changed: ' + file)
    doc = json.loads(raw)
    if logical is not None:
        case.assertEqual(canonical(doc), logical, 'Immutable logical identity changed')
    return doc


def _parent(doc, path):
    node = doc
    for part in path[:-1]:
        node = next(row for row in node if row['id'] == part) if isinstance(node, list) else node[part]
    return node, path[-1]


def reviewed_predecessor(case, current, root=ROOT):
    """Validate the complete current continuation, then expose its retained base.

    Call only at a historical preservation comparison. Actual current behavior,
    rights and image consumers keep using the current document. Unlisted events
    are returned unchanged for the caller's original strict preservation check.
    """
    event = current['id']
    if event not in PROMOTIONS:
        return copy.deepcopy(current)
    spec = PROMOTIONS[event]
    previous = _bound(case, root, spec['previous_file'], spec['previous_wire'], spec['previous'])
    frozen = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    expected = copy.deepcopy(previous)
    for path in CHANGED_FIELDS[event]:
        before, key = _parent(expected, path)
        after, _ = _parent(frozen, path)
        case.assertNotEqual(before[key], after[key], 'An amendment must name an actual changed leaf')
        before[key] = copy.deepcopy(after[key])
    if event == 'joplin-2011':
        for field, ids in JOPLIN_ADDITIONS.items():
            additions = [next(row for row in frozen[field] if row['id'] == id) for id in ids]
            expected[field] = (copy.deepcopy(additions) + expected[field] if field == 'records'
                               else expected[field] + copy.deepcopy(additions))
    old_review = expected['provenance']['publication_review']
    new_review = frozen['provenance']['publication_review']
    case.assertEqual(set(old_review), set(new_review), 'Publication-review shape is retained')
    case.assertEqual(new_review['previous_dossier_sha256'], spec['previous'])
    for key in ('basis', 'candidate_sha256', 'previous_dossier_sha256', 'reviewed_at'):
        old_review[key] = new_review[key]
    case.assertEqual(expected, frozen, 'The named amendments must explain every immutable current field')
    case.assertEqual(current, expected, 'Only the exact reviewed continuation changes are admitted')
    case.assertEqual(canonical(current), spec['current'])
    index = json.loads((root / 'web/archive/index.json').read_bytes())
    entry = next(row for row in index['events'] if row['id'] == event)
    case.assertEqual((entry['file'], entry['file_sha256'], entry['dossier_sha256']),
                     (spec['current_file'], spec['current_wire'], spec['current']))
    case.assertEqual(entry['records'], [row['id'] for row in current['records']])
    for field in ('title', 'summary', 'coverage', 'creators'):
        case.assertEqual(entry[field], current[field], 'Current index field: ' + field)
    case.assertEqual(entry['registered_media'], 0)
    history = _bound(case, root, spec['history_file'], spec['history_wire'])
    case.assertEqual(entry['history_file'], spec['history_file'])
    case.assertEqual(history['current_dossier_sha256'], spec['current'])
    versions = {row['dossier_sha256']: row for row in history['versions']}
    for logical, file, wire in [(spec['previous'], spec['previous_file'], spec['previous_wire']),
                                (spec['current'], spec['current_file'], spec['current_wire'])]:
        case.assertEqual((versions[logical]['file'], versions[logical]['file_sha256']), (file, wire))
    case.assertEqual(versions[spec['current']]['review']['previous_dossier_sha256'], spec['previous'])
    case.assertTrue(versions[spec['current']]['predecessor_available'])
    return copy.deepcopy(previous)


def retained_index_entry(case, entry, root=ROOT):
    """Retain the earlier index identity after validating its exact successor.

    The current history stays available to existing edge checks. This is a
    test-local historical view, never an index rewrite or an application input.
    """
    event = entry['id']
    if event not in PROMOTIONS:
        return entry
    spec = PROMOTIONS[event]
    current = json.loads((root / 'web' / entry['file']).read_bytes())
    previous = reviewed_predecessor(case, current, root)
    return {**entry, 'file': spec['previous_file'], 'file_sha256': spec['previous_wire'],
            'dossier_sha256': spec['previous'], 'summary': previous['summary'],
            'records': [row['id'] for row in previous['records']]}
