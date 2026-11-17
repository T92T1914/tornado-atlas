"""Exact spacing edges over the retained Tuscaloosa and Moore publications.

Text extraction removed the space between some words and numbers in these two
dossiers, so their pages read Table2 and at2:40p.m.CDT. Each edge here admits
the new version only when every changed string is its predecessor with spaces
put back, nothing else changed apart from the publication review, and the index
and the history name exactly this step. Every other edit and every later
promotion still gets no allowance.

Historical preservation tests read the predecessor this module returns. Current
source, media, rights and reading tests keep reading the current dossier.
"""
import copy
import hashlib
import json
from pathlib import Path
import re

from text_spacing_support import PROTECTED

ROOT = Path(__file__).resolve().parents[1]
BASIS = 'Text extraction defect. '
# Immutable predecessor and successor publications, both histories and both
# index identities. The candidate digest ties each edge to its reviewed draft.
SPACING_PROMOTIONS = {
    'tuscaloosa-birmingham-2011': {
        'previous_file': 'archive/tuscaloosa-birmingham-2011-22697c0e0b3bcdf5fce7.json',
        'previous_wire': 'fd8a0deb7a5dc0a7cf239a364dd46624b86a354e67a84cab110cf8bf1bcd353c',
        'previous': '22697c0e0b3bcdf5fce7b4ff7fb4e73e05186ae129d5fa65dc4830b982fe591e',
        'current_file': 'archive/tuscaloosa-birmingham-2011-a387d9b26b6ab7c237d9.json',
        'current_wire': 'c95ccb3915fe0b11582e4394a149c579a1715d2e7842b91363b291f1c26170a0',
        'current': 'a387d9b26b6ab7c237d94701368681540b14e18174a644c8bab01ef78ba768ef',
        'previous_history_file': 'archive/tuscaloosa-birmingham-2011-history-f05ca75ccb1f4a3034e0.json',
        'previous_history_wire': 'f82427eecf7f5eb8ba3fa62ba735cf3fd846c5f70ae81aa94201df4c82c60dc6',
        'history_file': 'archive/tuscaloosa-birmingham-2011-history-c84e48cd089233aee129.json',
        'history_wire': 'be35ea299f4cb9c27d1022e2882da674e32cc343313d596a482939667594d3ff',
        'previous_index_sha256': 'd89f61b8f4629d09ea66f9071f04846fc2751db578eb69f43d9539b9d79dbef4',
        'current_index_sha256': '83672de307f68441e0597a4ce6fb42c6c72f617ada9ad88b780f46551a3cdec7',
        'candidate_sha256': '5940959940e38be3c3087f8847004ffad41da042c8d2f015e84de010dc1e6a0b',
        'strings': 56,
    },
    'moore-2013': {
        'previous_file': 'archive/moore-2013-d7a6ec9d4ca0081f368b.json',
        'previous_wire': '1541685e18bc57b125e1779658c39c5858dc05e2e4bad71af193b06f2ae3145f',
        'previous': 'd7a6ec9d4ca0081f368bd2703c2b65ac3ba6e05dcabfc333029f42af87c1f654',
        'current_file': 'archive/moore-2013-5c2ac0ec0006b1eee3e0.json',
        'current_wire': 'b00333f3cc740e24dd9e8760e00f5ff640518b3ea543f4e7595ab42063c3965b',
        'current': '5c2ac0ec0006b1eee3e08e0fd8fbf4402ee284c51bded881707e51e7a950ce72',
        'previous_history_file': 'archive/moore-2013-history-54350a3c346d767b2a6d.json',
        'previous_history_wire': '436e0328c8b61a386afd2e72d53840658c5393d52d04756f19f6ff76c0a2df88',
        'history_file': 'archive/moore-2013-history-e2bb854718647fca37a8.json',
        'history_wire': '620aa01b38724304bd86af569ecc958a1baa6057af1ba07821774fa8da2eb001',
        'previous_index_sha256': '9a234226674fb11c5bf46af3782b73cb20da189602870aae048dcc240941d38c',
        'current_index_sha256': '209fd55f300bccf8d2fa074c59d4fdea695007c8d0f375f798c881d16324840f',
        'candidate_sha256': '5a2614e54d65bd3bafe1a2ba5c4283263a8430d310fb2c875725c6cf2bc6d4c6',
        'strings': 24,
    },
}
# Only strings under these reader prose keys may gain a space, and only between
# tokens. Every protected token of the old string survives byte for byte, no
# space may split a number or a clock, and capture, alignment and video times
# never change. Identifiers and every provenance field keep their exact bytes.
PROSE_KEYS = {'access', 'account', 'agent_processing', 'alt', 'basis', 'coverage', 'event', 'limits',
              'locator', 'publication', 'recipe', 'reported', 'revision', 'rights', 'summary', 'title'}
TIMING_KEYS = {'capture', 'alignment', 'video'}
NUMBER_LEFT = set('0123456789:./-\u00b0')
NUMBER_RIGHT = set('0123456789:.,/-\u00b0')
HASH = re.compile(r'[0-9a-f]{64}\b')
ROW_KINDS = ('sources', 'observations', 'media', 'creators', 'records')
DOSSIER_FIELDS = ('title', 'coverage', 'summary', 'routes', 'reconstruction')
REVIEW_KEYS = ('basis', 'candidate_sha256', 'previous_dossier_sha256', 'reviewed_at')


def canonical(doc):
    return hashlib.sha256(json.dumps(doc, ensure_ascii=False, sort_keys=True,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def _bound(case, root, file, wire, logical=None):
    raw = (root / 'web' / file).read_bytes()
    case.assertEqual(hashlib.sha256(raw).hexdigest(), wire,
                     'Immutable reviewed spacing bytes changed: ' + file)
    doc = json.loads(raw)
    if logical is not None:
        case.assertEqual(canonical(doc), logical, 'Immutable spacing logical identity changed')
    return doc


def inserted_spaces(before, after):
    """Return where after puts spaces into before, or None when after is anything else."""
    if not isinstance(before, str) or not isinstance(after, str) or len(after) <= len(before):
        return None
    positions = []
    position = 0
    for char in after:
        if position < len(before) and char == before[position]:
            position += 1
        elif char == ' ':
            positions.append(position)
        else:
            return None
    return positions if position == len(before) else None


def spaces_inserted(before, after):
    """True when after is before with at least one space added and nothing else changed."""
    return inserted_spaces(before, after) is not None


def splits_a_value(before, position):
    """True when a space at this position of before would split a number, a clock or a protected token.

    The one join between two digits that may open is a SHA256 label run into its hash.
    """
    if position in (0, len(before)):
        return True
    if before[position - 1] in NUMBER_LEFT and before[position] in NUMBER_RIGHT:
        return not (before[:position].endswith('SHA256') and HASH.match(before, position))
    return any(match.start() < position < match.end() for match in PROTECTED.finditer(before))


def spacing_paths(case, before, after, path=()):
    """Return the path of every changed string, failing on any other kind of change."""
    where = '/'.join(map(str, path)) or 'dossier'
    case.assertIs(type(after), type(before), 'A spacing edge keeps every JSON type: ' + where)
    if isinstance(before, dict):
        case.assertEqual(set(after), set(before), 'A spacing edge keeps every key: ' + where)
        return [found for key in before for found in spacing_paths(case, before[key], after[key], path + (key,))]
    if isinstance(before, list):
        case.assertEqual(len(after), len(before), 'A spacing edge keeps every list length: ' + where)
        return [found for index, (old, new) in enumerate(zip(before, after))
                for found in spacing_paths(case, old, new, path + (index,))]
    if after == before:
        return []
    case.assertNotEqual(path[0], 'provenance', 'A spacing edge cannot change provenance: ' + where)
    case.assertFalse(TIMING_KEYS & set(path), 'A spacing edge cannot change a capture, alignment or video time: ' + where)
    case.assertIn(path[-1], PROSE_KEYS, 'A spacing edge may only change reader prose: ' + where)
    positions = inserted_spaces(before, after)
    case.assertIsNotNone(positions, 'A spacing edge may only put spaces back: ' + where)
    case.assertEqual([position for position in positions if splits_a_value(before, position)], [],
                     'A spacing edge cannot split a number, a clock or a protected token: ' + where)
    return [path]


def spacing_history_changes(previous, paths):
    """The history rows these paths imply, in the order the archive history writes them."""
    rows = {}
    fields = set()
    for path in paths:
        if path[0] in ROW_KINDS:
            identifier = previous[path[0]][path[1]]['id']
            rows.setdefault((path[0], identifier), set()).add(path[2])
        else:
            if path[0] not in DOSSIER_FIELDS:
                raise AssertionError('A spacing path outside the recorded dossier fields: ' + str(path))
            fields.add(path[0])
    changes = [dict(kind=kind, id=identifier, change='updated', fields=sorted(rows[(kind, identifier)]))
               for kind in ROW_KINDS for identifier in sorted(i for k, i in rows if k == kind)]
    changes += [dict(kind='dossier', id=previous['id'], change='updated', fields=[field])
                for field in DOSSIER_FIELDS if field in fields]
    return changes


def spacing_boundary(case, current, root=ROOT, index_entry=None):
    """Return (retained document, retained index entry) after exact validation.

    Events without a spacing edge come back unchanged with the entry supplied.
    """
    event = current['id']
    if event not in SPACING_PROMOTIONS:
        return copy.deepcopy(current), index_entry
    spec = SPACING_PROMOTIONS[event]
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
    case.assertTrue(new_review['basis'].startswith(BASIS), 'The review names the text extraction defect')
    view = copy.deepcopy(frozen)
    for key in REVIEW_KEYS:
        view['provenance']['publication_review'][key] = old_review[key]
    paths = spacing_paths(case, previous, view)
    case.assertEqual(len(paths), spec['strings'], 'The spacing edge changes exactly its reviewed strings')

    if index_entry is None:
        index = json.loads((root / 'web/archive/index.json').read_bytes())
        entries = [row for row in index['events'] if row['id'] == event]
        case.assertEqual(len(entries), 1)
        index_entry = entries[0]
    entry = index_entry
    case.assertEqual(canonical(entry), spec['current_index_sha256'], 'Exact current spacing index entry')
    case.assertEqual((entry['file'], entry['file_sha256'], entry['dossier_sha256'], entry['history_file']),
                     (spec['current_file'], spec['current_wire'], spec['current'], spec['history_file']))
    old_history = _bound(case, root, spec['previous_history_file'], spec['previous_history_wire'])
    history = _bound(case, root, spec['history_file'], spec['history_wire'])
    case.assertEqual(old_history['current_dossier_sha256'], spec['previous'])
    expected = copy.deepcopy(old_history)
    expected['current_dossier_sha256'] = spec['current']
    edge = {'dossier_sha256': spec['current'], 'file_sha256': spec['current_wire'],
            'file': spec['current_file'], 'review': new_review, 'predecessor_available': True,
            'changes': spacing_history_changes(previous, paths)}
    expected['versions'] = [edge] + sorted(old_history['versions'], key=lambda row: row['dossier_sha256'])
    case.assertEqual(history, expected, 'Only the named spacing edge may extend the retained history')
    retained = {**entry, 'file': spec['previous_file'], 'file_sha256': spec['previous_wire'],
                'dossier_sha256': spec['previous'], 'history_file': spec['previous_history_file']}
    for field in ('title', 'summary', 'coverage', 'creators'):
        retained[field] = copy.deepcopy(previous[field])
    case.assertEqual(canonical(retained), spec['previous_index_sha256'], 'Exact retained spacing index entry')
    return copy.deepcopy(previous), retained


def spacing_predecessor(case, current, root=ROOT):
    return spacing_boundary(case, current, root)[0]


def spacing_index_entry(case, entry, root=ROOT):
    """A historical index view only. The real current index stays as it is."""
    if entry['id'] not in SPACING_PROMOTIONS:
        return entry
    spec = SPACING_PROMOTIONS[entry['id']]
    current = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    return spacing_boundary(case, current, root, entry)[1]
