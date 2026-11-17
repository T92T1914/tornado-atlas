"""One exact footage register edge over the spaced El Reno publication.

The El Reno dossier pins the bytes of its footage register among its reviewed
inputs. When that register took the reviewed shot register of Robinson's
upload, the dossier needed a version of its own. This edge admits that version
only when the footage register has the reviewed bytes, every changed leaf is
the one the adapter projects from that register, the hand written source
locator keeps its old text and gains one named sentence, nothing else changed
apart from the publication review, and the index and the history name exactly
this step. Every other edit and every later promotion still gets no allowance.

Historical preservation tests read the predecessor this module returns. Current
source, media, rights and reading tests keep reading the current dossier.
"""
import copy
import hashlib
import json
from pathlib import Path

from atlas.archive import digest, dossiers

ROOT = Path(__file__).resolve().parents[1]
BASIS = 'Footage register amendment. '
FOOTAGE = 'exhibits/el-reno-2013/footage.json'
LOCATOR = (' A cut review of the whole upload registers four passages, at 2.002 to 353.120, 354.555 to 628.361,'
           ' 628.394 to 646.312 and 646.346 to 867.066 seconds, against its caption clock.')
# Immutable predecessor and successor publications, both histories, both index
# identities, the reviewed candidate, both footage register digests and the
# adapter projection the curated dossier is pinned to.
FOOTAGE_PROMOTIONS = {
    'el-reno-2013': {
        'previous_file': 'archive/el-reno-2013-be9fdcbfb14a0da6b850.json',
        'previous_wire': '5b3c010a2440b44ed667108a4a8e986d82077eeebf49b3e459d97bc21019ae9a',
        'previous': 'be9fdcbfb14a0da6b8507ca6f885f917a9173d5a73643d48d2876f658a024fcb',
        'current_file': 'archive/el-reno-2013-43a94910978a0feaddcc.json',
        'current_wire': '30e49dada90e17051f8b3631d96d5233982ab636a79a69d6a44713934c748b6a',
        'current': '43a94910978a0feaddcc816509e8bba20dc681f35d6753454155b7a72bbd877a',
        'previous_history_file': 'archive/el-reno-2013-history-4c88ba2e6e622c431a2f.json',
        'previous_history_wire': '87f33ed64cfcb6881596828c131417c82d82d5258e6ef77aa097dfdf631e1cf5',
        'history_file': 'archive/el-reno-2013-history-bcb92a1086aff33a4bc4.json',
        'history_wire': '1aaa05c48bad2f154cc8ce3c91f2d712f5952df8237b83f0d17a74c532f86d10',
        'previous_index_sha256': '47da3a3fe03363b893c19976729a20ebaf12782703f56cfcc6fcf35f94bb9888',
        'current_index_sha256': '97e6bcd61ae3ea5eef20ea485b882d912e66d0883be2f1d0765fa3c97abcc616',
        'candidate_sha256': '718d5ef097b92019d24b0e027b9ff1d089d399572db5f3e434a0bb112f136946',
        'previous_footage_sha256': '4cc3ab95635d9b63a763dc5b635c8f53435eccad0d564cecc0f9d711b3f83860',
        'footage_sha256': 'a4ce45f396de55b4ae8ea8fad8cb5ca2ef8a942da980d0aef53e043492ec49fa',
        'adapter_sha256': 'dda68a0d1415896010dee87fec773b34e834cbf3c336a9e8fd6b700f7095e84e',
        # The leaves this edge changes, by row. Every one except the locator is
        # copied from the adapter's projection of the reviewed footage register.
        'changes': [
            ('sources', 'robinson-dashcam', ['access', 'locator', 'revision', 'rights']),
            ('media', 'robinson-01', ['account', 'limits', 'review', 'time']),
            ('media', 'robinson-02', ['limits', 'review', 'time']),
            ('media', 'robinson-03', ['limits', 'review', 'time']),
            ('media', 'robinson-04', ['account', 'limits', 'review', 'time']),
            ('media', 'robinson-05', ['account', 'limits', 'review', 'time']),
            ('media', 'robinson-06', ['account', 'limits', 'review', 'time']),
            ('media', 'robinson-07', ['account', 'limits', 'review', 'time']),
        ],
    },
}
REVIEW_KEYS = ('basis', 'candidate_sha256', 'previous_dossier_sha256', 'reviewed_at')


def canonical(doc):
    return hashlib.sha256(json.dumps(doc, ensure_ascii=False, sort_keys=True,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def _bound(case, root, file, wire, logical=None):
    raw = (root / 'web' / file).read_bytes()
    case.assertEqual(hashlib.sha256(raw).hexdigest(), wire,
                     'Immutable reviewed footage register bytes changed: ' + file)
    doc = json.loads(raw)
    if logical is not None:
        case.assertEqual(canonical(doc), logical, 'Immutable footage register logical identity changed')
    return doc


def projected_dossier(case, spec, root=ROOT):
    """The adapter's projection of the reviewed footage register, after checking both are the reviewed ones."""
    case.assertEqual(hashlib.sha256((root / FOOTAGE).read_bytes()).hexdigest(), spec['footage_sha256'],
                     'The footage register differs from the reviewed one. A later change needs its own edge')
    adapter = next(doc for doc in dossiers(root, include_curated=False) if doc['id'] == 'el-reno-2013')
    case.assertEqual(digest(adapter), spec['adapter_sha256'], 'The adapter projection changed')
    curated = json.loads((root / 'research/archive-curated/el-reno-2013.json').read_bytes())
    case.assertEqual(curated['adapter_sha256'], spec['adapter_sha256'], 'The curated dossier is pinned to this projection')
    return adapter


def _row(doc, kind, identity):
    rows = [row for row in doc[kind] if row['id'] == identity]
    if len(rows) != 1:
        raise AssertionError(f'Expected one {kind} row {identity}')
    return rows[0]


def _footage_edge(case, current, spec, root, index_entry):
    """Validate the exact footage register edge and return (its predecessor, the index entry it retained)."""
    event = current['id']
    previous = _bound(case, root, spec['previous_file'], spec['previous_wire'], spec['previous'])
    frozen = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    case.assertEqual(current, frozen, 'Only the exact reviewed continuation changes are admitted')
    case.assertEqual(canonical(current), spec['current'], 'Only the exact reviewed continuation types are admitted')

    old_review = previous['provenance']['publication_review']
    new_review = frozen['provenance']['publication_review']
    case.assertEqual(set(new_review), set(old_review), 'Publication review shape is retained')
    case.assertEqual(new_review['reviewer_kind'], old_review['reviewer_kind'])
    case.assertEqual(new_review['reviewer_kind'], 'agent')
    case.assertEqual(new_review['previous_dossier_sha256'], spec['previous'])
    case.assertEqual(new_review['candidate_sha256'], spec['candidate_sha256'])
    case.assertTrue(new_review['basis'].startswith(BASIS), 'The review names the footage register amendment')

    # Rebuild the successor from its predecessor and the projection. Anything
    # the rebuild does not explain leaves the two unequal.
    adapter = projected_dossier(case, spec, root)
    expected = copy.deepcopy(previous)
    inputs = expected['provenance']['inputs']
    case.assertEqual(inputs[FOOTAGE], spec['previous_footage_sha256'])
    inputs[FOOTAGE] = spec['footage_sha256']
    for key in REVIEW_KEYS:
        expected['provenance']['publication_review'][key] = new_review[key]
    for kind, identity, keys in spec['changes']:
        before = _row(expected, kind, identity)
        projected = _row(adapter, kind, identity)
        for key in keys:
            after = before[key] + LOCATOR if key == 'locator' else projected[key]
            case.assertNotEqual(before[key], after, f'A named change must change its leaf: {identity}/{key}')
            before[key] = copy.deepcopy(after)
        if kind == 'media':
            unchanged = {key: value for key, value in projected.items() if key not in keys}
            case.assertEqual({key: before[key] for key in unchanged}, unchanged,
                             'Every other leaf of a projected sample row already matches the projection: ' + identity)
    case.assertEqual(expected, frozen, 'The footage register projection must explain every changed leaf')
    case.assertEqual(canonical(expected), spec['current'], 'The footage register edge keeps exact JSON types')

    if index_entry is None:
        index = json.loads((root / 'web/archive/index.json').read_bytes())
        entries = [row for row in index['events'] if row['id'] == event]
        case.assertEqual(len(entries), 1)
        index_entry = entries[0]
    entry = index_entry
    case.assertEqual(canonical(entry), spec['current_index_sha256'], 'Exact current footage register index entry')
    case.assertEqual((entry['file'], entry['file_sha256'], entry['dossier_sha256'], entry['history_file']),
                     (spec['current_file'], spec['current_wire'], spec['current'], spec['history_file']))
    old_history = _bound(case, root, spec['previous_history_file'], spec['previous_history_wire'])
    history = _bound(case, root, spec['history_file'], spec['history_wire'])
    case.assertEqual(old_history['current_dossier_sha256'], spec['previous'])
    expected_history = copy.deepcopy(old_history)
    expected_history['current_dossier_sha256'] = spec['current']
    edge = {'dossier_sha256': spec['current'], 'file_sha256': spec['current_wire'],
            'file': spec['current_file'], 'review': new_review, 'predecessor_available': True,
            'changes': [dict(kind=kind, id=identity, change='updated', fields=keys)
                        for kind, identity, keys in spec['changes']]}
    expected_history['versions'] = [edge] + sorted(old_history['versions'], key=lambda row: row['dossier_sha256'])
    case.assertEqual(history, expected_history, 'Only the named footage register edge may extend the retained history')
    retained = {**entry, 'file': spec['previous_file'], 'file_sha256': spec['previous_wire'],
                'dossier_sha256': spec['previous'], 'history_file': spec['previous_history_file']}
    for field in ('title', 'summary', 'coverage', 'creators'):
        case.assertEqual(retained[field], previous[field], 'The footage register edge keeps the index field ' + field)
    case.assertEqual(canonical(retained), spec['previous_index_sha256'], 'Exact retained footage register index entry')
    return copy.deepcopy(previous), retained


def footage_boundary(case, current, root=ROOT, index_entry=None):
    """Return (retained document, retained index entry) after exact validation.

    Events without a footage register edge come back unchanged with the entry supplied.
    """
    spec = FOOTAGE_PROMOTIONS.get(current['id'])
    if spec is None:
        return copy.deepcopy(current), index_entry
    return _footage_edge(case, current, spec, root, index_entry)


def footage_predecessor(case, current, root=ROOT):
    return footage_boundary(case, current, root)[0]


def footage_index_entry(case, entry, root=ROOT):
    """A historical index view only. The real current index stays as it is."""
    spec = FOOTAGE_PROMOTIONS.get(entry['id'])
    if spec is None:
        return entry
    current = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    return footage_boundary(case, current, root, entry)[1]
