"""Three exact response-reading edges over the retained November 1 boundary.

This test-only adapter validates the actual current document, index and both
histories before exposing an earlier subject to a historical preservation test.
It does not modify application inputs or grant later promotions an allowance.
Current source, media, rights and reading tests must still use current dossiers.
"""
import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTE = 'research/response-reading-2026-10-30.md'
NOTE_SHA = '737393e5e55620425019d3b083dede378c8431858639be6388d37bc3eabc95bc'
# Exact integration receipt plus retained immutable publication bytes. These
# pins establish identity, while test_response_reading checks source semantics.
RESPONSE_PROMOTIONS = {
    "moore-2013": {
        "previous_file": "archive/moore-2013-5ed36647a0e6141f8dde.json",
        "previous_wire": "0716a3b07a3b171686e9cf9b14f780327efc64b7074fcaddc379d59d1ba9a889",
        "previous": "5ed36647a0e6141f8ddeeee30ef7be9e7bb6332613ed86428b3b9b5536b25e85",
        "current_file": "archive/moore-2013-d7a6ec9d4ca0081f368b.json",
        "current_wire": "1541685e18bc57b125e1779658c39c5858dc05e2e4bad71af193b06f2ae3145f",
        "current": "d7a6ec9d4ca0081f368bd2703c2b65ac3ba6e05dcabfc333029f42af87c1f654",
        "previous_history_file": "archive/moore-2013-history-d166c31387c862453abd.json",
        "previous_history_wire": "4bb2dcc3ba2f322de8d36eb54867182a071bd185b650434f37a461fdde84109d",
        "history_file": "archive/moore-2013-history-54350a3c346d767b2a6d.json",
        "history_wire": "436e0328c8b61a386afd2e72d53840658c5393d52d04756f19f6ff76c0a2df88",
        "previous_index_sha256": "fd23360bdb167247c65393c66549fe267c3b9e6b72c7f944ba0806d1af449e8d",
        "current_index_sha256": "9a234226674fb11c5bf46af3782b73cb20da189602870aae048dcc240941d38c",
        "candidate_sha256": "70ec3fc9d4c2b6f827ce1f258bf582c3cf8a759b21784bdc1a2656c892ae27ec"
    },
    "udall-1955": {
        "previous_file": "archive/udall-1955-ea29259561776155de0d.json",
        "previous_wire": "e3f665325c67a5769e2f1d514d25229ffd2b702f73c60b56c23e077aa05b541e",
        "previous": "ea29259561776155de0dce541ee11642c175258d8b6af476c5b143f1fed47bcf",
        "current_file": "archive/udall-1955-33163d1731a0f30fae5e.json",
        "current_wire": "8296d1156ba922652b7e8a708a7e3e267fec69a923f2a8aec360fbf5494d70cc",
        "current": "33163d1731a0f30fae5e138ab18b67c7f97121ef229a7748a79f9a6b517ba802",
        "previous_history_file": "archive/udall-1955-history-d9f2d4467c010096990a.json",
        "previous_history_wire": "bb73b788c8d3c58c5b21ab5149cb40fac38fca34f9f15de0278fb27c9c6473b4",
        "history_file": "archive/udall-1955-history-aef7011884bc9ec7ac48.json",
        "history_wire": "4ef7ee0f0ab6ae37c2b3fdd5f8c1ef9b2f0c87af53914b99029f1e14d2a1fadc",
        "previous_index_sha256": "0521491bd1c3fd7cab783152f04f8d18cf48c0e1c55a749074de1f6bb18c4d90",
        "current_index_sha256": "b877850c6ad5c770e6e47cda0b812fe438fd091694877ae39db772156bbc8c86",
        "candidate_sha256": "6ac6d60d350e208e193186ca494a7ef0b739dbc40f3ea120a9b7649829c079f2"
    },
    "blackwell-1955": {
        "previous_file": "archive/blackwell-1955-c0ccacb0fa341a0989a4.json",
        "previous_wire": "c4459214136b7c1f026a53a65a815a667778bd35aa95393dd79a19a8f74ce68d",
        "previous": "c0ccacb0fa341a0989a4e16dc1d9e8ac040c07248ab3ceb1cb6a415daf0e29a2",
        "current_file": "archive/blackwell-1955-dcb7f27027e6e6192902.json",
        "current_wire": "d14d75d302f1236b507e7e583420ff9c6ac7a6c0ee2c7807efa37f3fd3a62cd5",
        "current": "dcb7f27027e6e619290215f8ae554e38ab2a45a51aff59861427b8d3285e6ae2",
        "previous_history_file": "archive/blackwell-1955-history-efcb0a168fc9aab08ff8.json",
        "previous_history_wire": "b18e915f43f0885e874006b3cc80ed95d86568cdc0680cd841a2b999bc238c7f",
        "history_file": "archive/blackwell-1955-history-c7ea0afdebd84c9e4d00.json",
        "history_wire": "ba6bb7d2bd8dd2a80fc39298ce9b24a55014b6b0fefa009652c451eff15a1129",
        "previous_index_sha256": "832c7d35f3be40495acc89c76222496324af576011f24c43b7315eb75510b864",
        "current_index_sha256": "5e8ef81876d3fd2a61a7128ddc1ea9540cc72f1f1061d71bde833d7ae1241447",
        "candidate_sha256": "81a524cdf42c04a7ab8b3fc5a6abb03803f66094b1992c2d9dfedef4e6ec3734"
    }
}
ADDITIONS = {
    'moore-2013': {'sources': ['nws-moore-command-post'], 'creators': ['bruce-thoren-nws'],
                   'media': ['moore-command-post'], 'observations': ['moore-response-weather-support']},
    'udall-1955': {'observations': ['udall-directional-damage-comparison']},
    'blackwell-1955': {'observations': ['blackwell-witness-weather-sequences']},
}
SOURCE_LEAVES = {'moore-2013': 'nws-event-hub', 'blackwell-1955': 'nws-wichita'}
ROUTES = {
    'moore-2013': [{'label': 'Weather support during the rescue effort',
                    'href': 'moore.html#weather-support-after-the-tornado'}],
    'blackwell-1955': [{'label': 'Read the separately located witness sequences',
                        'href': 'blackwell.html#observations'}],
    'udall-1955': [],
}
HISTORY_CHANGES = {
    'moore-2013': [
        {'kind': 'sources', 'id': 'nws-event-hub', 'change': 'updated', 'fields': ['access', 'locator', 'revision']},
        {'kind': 'sources', 'id': 'nws-moore-command-post', 'change': 'added', 'fields': []},
        {'kind': 'observations', 'id': 'moore-response-weather-support', 'change': 'added', 'fields': []},
        {'kind': 'media', 'id': 'moore-command-post', 'change': 'added', 'fields': []},
        {'kind': 'creators', 'id': 'bruce-thoren-nws', 'change': 'added', 'fields': []},
        {'kind': 'dossier', 'id': 'moore-2013', 'change': 'updated', 'fields': ['routes']}],
    'udall-1955': [
        {'kind': 'observations', 'id': 'udall-directional-damage-comparison', 'change': 'added', 'fields': []}],
    'blackwell-1955': [
        {'kind': 'sources', 'id': 'nws-wichita', 'change': 'updated', 'fields': ['access', 'locator', 'revision']},
        {'kind': 'observations', 'id': 'blackwell-witness-weather-sequences', 'change': 'added', 'fields': []},
        {'kind': 'dossier', 'id': 'blackwell-1955', 'change': 'updated', 'fields': ['routes']}],
}


def canonical(doc):
    return hashlib.sha256(json.dumps(doc, ensure_ascii=False, sort_keys=True,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def _bound(case, root, file, wire, logical=None):
    raw = (root / 'web' / file).read_bytes()
    case.assertEqual(hashlib.sha256(raw).hexdigest(), wire,
                     'Immutable reviewed response bytes changed: ' + file)
    doc = json.loads(raw)
    if logical is not None:
        case.assertEqual(canonical(doc), logical, 'Immutable response logical identity changed')
    return doc


def response_boundary(case, current, root=ROOT):
    """Return (retained document, retained index entry) after exact validation."""
    event = current['id']
    if event not in RESPONSE_PROMOTIONS:
        return copy.deepcopy(current), None
    spec = RESPONSE_PROMOTIONS[event]
    previous = _bound(case, root, spec['previous_file'], spec['previous_wire'], spec['previous'])
    frozen = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    case.assertEqual(current, frozen, 'Only the exact reviewed continuation changes are admitted')
    case.assertEqual(canonical(current), spec['current'], 'Only the exact reviewed continuation types are admitted')
    expected = copy.deepcopy(previous)
    for field in ('sources', 'creators', 'observations', 'media'):
        ids = ADDITIONS[event].get(field, [])
        case.assertEqual([row['id'] for row in frozen[field]],
                         [row['id'] for row in previous[field]] + ids)
        if field == 'sources' and event in SOURCE_LEAVES:
            source_id = SOURCE_LEAVES[event]
            before = next(row for row in expected[field] if row['id'] == source_id)
            after = next(row for row in frozen[field] if row['id'] == source_id)
            for leaf in ('locator', 'access', 'revision'):
                case.assertNotEqual(before[leaf], after[leaf], 'Named source leaf must actually change')
                case.assertTrue(after[leaf].startswith(before[leaf]), 'Prior inspection wording remains')
                before[leaf] = after[leaf]
        expected[field] += [copy.deepcopy(row) for row in frozen[field] if row['id'] in ids]
    expected['routes'] += copy.deepcopy(ROUTES[event])
    provenance = expected['provenance']
    case.assertNotIn(NOTE, provenance['inputs'])
    case.assertEqual(hashlib.sha256((root / NOTE).read_bytes()).hexdigest(), NOTE_SHA)
    provenance['inputs'][NOTE] = NOTE_SHA
    old_review, new_review = provenance['publication_review'], frozen['provenance']['publication_review']
    case.assertEqual(set(old_review), set(new_review))
    case.assertEqual(new_review['reviewer_kind'], old_review['reviewer_kind'])
    case.assertEqual(new_review['reviewer_kind'], 'agent')
    case.assertEqual(new_review['previous_dossier_sha256'], spec['previous'])
    case.assertEqual(new_review['candidate_sha256'], spec['candidate_sha256'])
    for key in ('basis', 'candidate_sha256', 'previous_dossier_sha256', 'reviewed_at'):
        old_review[key] = new_review[key]
    case.assertEqual(expected, frozen, 'Named response additions must explain every current field')
    case.assertEqual(canonical(expected), spec['current'], 'Response delta preserves exact JSON types')

    index = json.loads((root / 'web/archive/index.json').read_bytes())
    entries = [row for row in index['events'] if row['id'] == event]
    case.assertEqual(len(entries), 1)
    entry = entries[0]
    case.assertEqual(canonical(entry), spec['current_index_sha256'], 'Exact current response index entry')
    case.assertEqual((entry['file'], entry['file_sha256'], entry['dossier_sha256'], entry['history_file']),
                     (spec['current_file'], spec['current_wire'], spec['current'], spec['history_file']))
    case.assertEqual(entry['registered_media'], 0)
    old_history = _bound(case, root, spec['previous_history_file'], spec['previous_history_wire'])
    history = _bound(case, root, spec['history_file'], spec['history_wire'])
    case.assertEqual(old_history['current_dossier_sha256'], spec['previous'])
    expected_history = copy.deepcopy(old_history)
    expected_history['current_dossier_sha256'] = spec['current']
    new_version = {'dossier_sha256': spec['current'], 'file_sha256': spec['current_wire'],
        'file': spec['current_file'], 'review': new_review, 'predecessor_available': True,
        'changes': HISTORY_CHANGES[event]}
    expected_history['versions'] = [new_version] + sorted(old_history['versions'], key=lambda row: row['dossier_sha256'])
    case.assertEqual(history, expected_history, 'Only the named new edge may extend the retained history')
    retained_entry = {**entry, 'file': spec['previous_file'], 'file_sha256': spec['previous_wire'],
        'dossier_sha256': spec['previous'], 'history_file': spec['previous_history_file'],
        'creators': copy.deepcopy(previous['creators'])}
    case.assertEqual(canonical(retained_entry), spec['previous_index_sha256'], 'Exact retained response index entry')
    return copy.deepcopy(previous), retained_entry


def response_predecessor(case, current, root=ROOT):
    return response_boundary(case, current, root)[0]


def response_index_entry(case, entry, root=ROOT):
    """A historical index view only; the real current index remains unchanged."""
    if entry['id'] not in RESPONSE_PROMOTIONS:
        return entry
    spec = RESPONSE_PROMOTIONS[entry['id']]
    case.assertEqual(canonical(entry), spec['current_index_sha256'], 'Exact supplied response index entry')
    current = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    return response_boundary(case, current, root)[1]
