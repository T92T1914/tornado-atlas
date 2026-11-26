"""One exact wording recast edge over the spaced El Reno publication.

The El Reno dossier keeps copies of the labels written around the values Nick
Nolte reported for his three photographs, and the timeline of the exhibit holds
the same labels. Six of those phrases were hyphenated compounds. This edge
admits the dossier version that rewrites them only when every changed string
is its predecessor with the phrases this edge names replaced, each as often as
this edge counts, and nothing else changed.

Only strings under reader prose keys may change. Capture, alignment and video
times, places, statuses, roles, identifiers, links and every provenance field
keep their exact bytes. Each named replacement keeps the digits of its phrase
in order and every held name. That guards the values. It cannot judge meaning,
so what each replacement says is read when the edge is reviewed, and the edge
then holds the version to those exact words. Nothing else may change apart
from the publication review, which has to name the recast, and the index
entry and the history have to extend the retained ones by exactly this step.
Every other edit and every later promotion still gets no allowance.

Historical preservation tests read the predecessor this module returns. Current
source, media, rights and reading tests keep reading the current dossier.
"""
import copy
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASIS = 'Wording recast. '
# Immutable predecessor and successor publications, both histories, both index
# identities and the reviewed candidate. Then the phrases: old wording, new
# wording and how many times the dossier held the old one.
RECAST_PROMOTIONS = {
    'el-reno-2013': {
        'previous_file': 'archive/el-reno-2013-f36f10f672a9e2e0a999.json',
        'previous_wire': '2c32832275b12e084d4c31bc7610218776b362930fae3a070de93293c78c5752',
        'previous': 'f36f10f672a9e2e0a999262a0a461f7c5dbadebc89a39f1d6fa41bad7823eefe',
        'current_file': 'archive/el-reno-2013-ba698502f89d644549c0.json',
        'current_wire': '9611a840ffbd7dc5b6978d5f4687b3dedf2021168b65866d55401014ebd70876',
        'current': 'ba698502f89d644549c0d29453e7f6fcf50a9c6a186f7bfd350c68d06495ee71',
        'previous_history_file': 'archive/el-reno-2013-history-df96498eb66dcba0f8cc.json',
        'previous_history_wire': 'de0581d074f5b4a65490d32ce4fbd62f8b640381f2910228b86575ab356b6418',
        'history_file': 'archive/el-reno-2013-history-d615347619a312d61d16.json',
        'history_wire': '861472a1de0d05fa3ac177d263a541d07135e455132eaca846b5ab5b1b83351d',
        'previous_index_sha256': '5fc168fcd2820be85660ba62f8c50acb2ae35e561bc1402421497f62d713a640',
        'current_index_sha256': '124e2f18a2162e739d08b6d549fcd14e55f15457768e537978949fe3233732a4',
        'candidate_sha256': '4b97239f0f677d5866cd7af72844d685decbfec59b7d459573d0cdaa2e7b34a5',
        'strings': 25,
        'recasts': (
            ('Creator-reported label: ', 'Label reported by the creator: ', 6),
            ('The movie marks are creator-reported navigation guides.',
             'The movie marks are navigation guides reported by the creator.', 6),
            ('Still-label offsets of 0, 22 and 85 seconds and creator movie-guide offsets of 0, 21 and 86 seconds '
             'remain distinct.',
             'The still labels are offset by 0, 22 and 85 seconds and the movie guides of the creator by 0, 21 and '
             '86 seconds, and the two sets remain distinct.', 3),
            ('Used with Nick Nolte’s item-specific permission for unchanged copies of',
             'Used with Nick Nolte’s permission, specific to each item, for unchanged copies of', 7),
            ('exports from his roof-mounted GoPro recording.',
             'exports from the recording made by his GoPro mounted on the roof.', 6),
            ('He reports using the GPS-equipped Sony HDR-PJ710V recording as a time reference',
             'He reports using the GPS equipped Sony HDR-PJ710V recording as a time reference', 6),
        ),
    },
}
# Only strings under these reader prose keys may be recast.
PROSE_KEYS = {'account', 'basis', 'caption', 'clock_disposition', 'limits', 'lineage', 'rights', 'rights_basis'}
# A recast never reaches a time, a place, a status, a role or a transformation record.
HELD_KEYS = {'alignment', 'capture', 'video', 'time', 'place', 'status', 'transformation', 'roles'}
NUMBER = re.compile(r'\d+(?:[:.]\d+)*')
# Names a recast has to carry over as they stand.
NAMES = ('Nick Nolte', 'GoPro', 'Sony', 'HDR-PJ710V', 'GPS')
ROW_KINDS = ('sources', 'observations', 'media', 'creators', 'records')
REVIEW_KEYS = ('basis', 'candidate_sha256', 'previous_dossier_sha256', 'reviewed_at')


def canonical(doc):
    return hashlib.sha256(json.dumps(doc, ensure_ascii=False, sort_keys=True,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def _bound(case, root, file, wire, logical=None):
    raw = (root / 'web' / file).read_bytes()
    case.assertEqual(hashlib.sha256(raw).hexdigest(), wire,
                     'Immutable reviewed recast bytes changed: ' + file)
    doc = json.loads(raw)
    if logical is not None:
        case.assertEqual(canonical(doc), logical, 'Immutable recast logical identity changed')
    return doc


def keeps_its_values(case, old, new):
    """A named replacement keeps the digits of its phrase in order and every held name. It cannot judge meaning."""
    case.assertNotEqual(old, new, 'A named recast must change its phrase: ' + old)
    case.assertEqual(NUMBER.findall(new), NUMBER.findall(old), 'A recast keeps every number of its phrase: ' + old)
    for name in NAMES:
        case.assertEqual(new.count(name), old.count(name), 'A recast keeps every name of its phrase: ' + name)


def recast(text, recasts, used=None):
    """text with every named phrase replaced, counting each replacement in used."""
    for index, (old, new, _) in enumerate(recasts):
        hits = text.count(old)
        if hits:
            if used is not None:
                used[index] = used.get(index, 0) + hits
            text = text.replace(old, new)
    return text


def recast_paths(case, before, after, recasts, used, path=()):
    """Return the path of every recast string, failing on any other kind of change."""
    where = '/'.join(map(str, path)) or 'dossier'
    case.assertIs(type(after), type(before), 'A recast edge keeps every JSON type: ' + where)
    if isinstance(before, dict):
        case.assertEqual(set(after), set(before), 'A recast edge keeps every key: ' + where)
        return [found for key in before for found in recast_paths(case, before[key], after[key], recasts, used, path + (key,))]
    if isinstance(before, list):
        case.assertEqual(len(after), len(before), 'A recast edge keeps every list length: ' + where)
        return [found for index, (old, new) in enumerate(zip(before, after))
                for found in recast_paths(case, old, new, recasts, used, path + (index,))]
    if not isinstance(before, str):
        case.assertEqual(after, before, 'A recast edge changes strings only: ' + where)
        return []
    counted = {}
    expected = recast(before, recasts, counted)
    if expected == before:
        case.assertEqual(after, before, 'A recast edge changes only the phrases it names: ' + where)
        return []
    case.assertNotEqual(path[0], 'provenance', 'A recast edge cannot change provenance: ' + where)
    case.assertFalse(HELD_KEYS & set(path), 'A recast edge cannot change a time, a place, a status or a role: ' + where)
    case.assertIn(path[-1], PROSE_KEYS, 'A recast edge may only change reader prose: ' + where)
    case.assertEqual(after, expected, 'A recast string is its predecessor with the named phrases replaced: ' + where)
    for index, hits in counted.items():
        used[index] = used.get(index, 0) + hits
    return [path]


def recast_history_changes(previous, paths):
    """The history rows these paths imply, in the order the archive history writes them."""
    rows = {}
    for path in paths:
        if path[0] not in ROW_KINDS:
            raise AssertionError('A recast path outside the dossier rows: ' + str(path))
        rows.setdefault((path[0], previous[path[0]][path[1]]['id']), set()).add(path[2])
    return [dict(kind=kind, id=identifier, change='updated', fields=sorted(rows[(kind, identifier)]))
            for kind in ROW_KINDS for identifier in sorted(i for k, i in rows if k == kind)]


def explain_recast(case, spec, previous, successor):
    """Explain the successor as its predecessor with the named phrases replaced, and return its changed paths.

    This step reads no pinned bytes, so it can be tried on a changed successor.
    """
    old_review = previous['provenance']['publication_review']
    new_review = successor['provenance']['publication_review']
    case.assertEqual(set(new_review), set(old_review), 'Publication review shape is retained')
    case.assertEqual(new_review['reviewer_kind'], old_review['reviewer_kind'])
    case.assertEqual(new_review['reviewer_kind'], 'agent')
    case.assertEqual(new_review['previous_dossier_sha256'], spec['previous'], 'The review names the exact predecessor')
    case.assertEqual(new_review['candidate_sha256'], spec['candidate_sha256'],
                     'The review names the exact reviewed candidate')
    case.assertTrue(new_review['basis'].startswith(BASIS), 'The review names the wording recast')
    for old, new, _ in spec['recasts']:
        keeps_its_values(case, old, new)
    view = copy.deepcopy(successor)
    for key in REVIEW_KEYS:
        view['provenance']['publication_review'][key] = old_review[key]
    used = {}
    paths = recast_paths(case, previous, view, spec['recasts'], used)
    case.assertEqual(len(paths), spec['strings'], 'The recast edge changes exactly its reviewed strings')
    case.assertEqual([used.get(index, 0) for index in range(len(spec['recasts']))],
                     [count for _, _, count in spec['recasts']],
                     'Each named phrase is replaced exactly as often as the edge counts')
    return paths, new_review


def _recast_edge(case, current, spec, root, index_entry):
    """Validate the exact recast edge and return (its predecessor, the index entry it retained)."""
    event = current['id']
    previous = _bound(case, root, spec['previous_file'], spec['previous_wire'], spec['previous'])
    frozen = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    case.assertEqual(current, frozen, 'Only the exact reviewed continuation changes are admitted')
    case.assertEqual(canonical(current), spec['current'], 'Only the exact reviewed continuation types are admitted')
    paths, new_review = explain_recast(case, spec, previous, frozen)

    if index_entry is None:
        index = json.loads((root / 'web/archive/index.json').read_bytes())
        entries = [row for row in index['events'] if row['id'] == event]
        case.assertEqual(len(entries), 1)
        index_entry = entries[0]
    entry = index_entry
    case.assertEqual(canonical(entry), spec['current_index_sha256'], 'Exact current recast index entry')
    case.assertEqual((entry['file'], entry['file_sha256'], entry['dossier_sha256'], entry['history_file']),
                     (spec['current_file'], spec['current_wire'], spec['current'], spec['history_file']))
    old_history = _bound(case, root, spec['previous_history_file'], spec['previous_history_wire'])
    history = _bound(case, root, spec['history_file'], spec['history_wire'])
    case.assertEqual(old_history['current_dossier_sha256'], spec['previous'])
    expected = copy.deepcopy(old_history)
    expected['current_dossier_sha256'] = spec['current']
    edge = {'dossier_sha256': spec['current'], 'file_sha256': spec['current_wire'],
            'file': spec['current_file'], 'review': new_review, 'predecessor_available': True,
            'changes': recast_history_changes(previous, paths)}
    expected['versions'] = [edge] + sorted(old_history['versions'], key=lambda row: row['dossier_sha256'])
    case.assertEqual(history, expected, 'Only the named recast edge may extend the retained history')
    retained = {**entry, 'file': spec['previous_file'], 'file_sha256': spec['previous_wire'],
                'dossier_sha256': spec['previous'], 'history_file': spec['previous_history_file']}
    # The index entry carries the creator rows, and a recast may reword an attribution basis there.
    for field in ('title', 'summary', 'coverage', 'creators'):
        retained[field] = copy.deepcopy(previous[field])
    case.assertEqual(canonical(retained), spec['previous_index_sha256'], 'Exact retained recast index entry')
    return copy.deepcopy(previous), retained


def recast_boundary(case, current, root=ROOT, index_entry=None):
    """Return (retained document, retained index entry) after exact validation.

    Events without a recast edge come back unchanged with the entry supplied.
    This is the newest edge of its dossier, so it is peeled before every other.
    """
    spec = RECAST_PROMOTIONS.get(current['id'])
    if spec is None:
        return copy.deepcopy(current), index_entry
    return _recast_edge(case, current, spec, root, index_entry)


def recast_predecessor(case, current, root=ROOT):
    return recast_boundary(case, current, root)[0]


def recast_index_entry(case, entry, root=ROOT):
    """A historical index view only. The real current index stays as it is."""
    spec = RECAST_PROMOTIONS.get(entry['id'])
    if spec is None:
        return entry
    current = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    return recast_boundary(case, current, root, entry)[1]
