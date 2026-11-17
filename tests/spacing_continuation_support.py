"""Exact spacing edges over the retained publications of six dossiers.

Text extraction removed the space between some words and numbers in these
dossiers, so their pages read Table2, at2:40p.m.CDT and May31,2013. Each edge
here admits
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

from footage_continuation_support import footage_boundary, footage_index_entry
from text_spacing_support import PROTECTED

ROOT = Path(__file__).resolve().parents[1]
BASIS = 'Text extraction defect. '
# Immutable predecessor and successor publications, both histories and both
# index identities, oldest edge first. The candidate digest ties each edge to
# its reviewed draft. Tuscaloosa has two edges because the first one missed the
# words that ran into video IDs.
SPACING_PROMOTIONS = {
    'tuscaloosa-birmingham-2011': [
        {
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
        {
            'previous_file': 'archive/tuscaloosa-birmingham-2011-a387d9b26b6ab7c237d9.json',
            'previous_wire': 'c95ccb3915fe0b11582e4394a149c579a1715d2e7842b91363b291f1c26170a0',
            'previous': 'a387d9b26b6ab7c237d94701368681540b14e18174a644c8bab01ef78ba768ef',
            'current_file': 'archive/tuscaloosa-birmingham-2011-8f81c2eb355da5d9dc72.json',
            'current_wire': '22b204454d86d3b7891bc307aa5b90395278d893db4ac25f4aeb852798da0d5d',
            'current': '8f81c2eb355da5d9dc72d27aaf7ee0a77036472a974d72ffe9d012a1be9e3097',
            'previous_history_file': 'archive/tuscaloosa-birmingham-2011-history-c84e48cd089233aee129.json',
            'previous_history_wire': 'be35ea299f4cb9c27d1022e2882da674e32cc343313d596a482939667594d3ff',
            'history_file': 'archive/tuscaloosa-birmingham-2011-history-deeae5f97fe06b23ac9d.json',
            'history_wire': '4f16f0969da5f128cce54e8a359792d5f9c63210ebd700920ca5ff32a17927a4',
            'previous_index_sha256': '83672de307f68441e0597a4ce6fb42c6c72f617ada9ad88b780f46551a3cdec7',
            'current_index_sha256': '0657c643a708070c372a311e791e0f5a6fbff7c03fa27e39a6b481954ff383b8',
            'candidate_sha256': 'd614147a20e8a8cb79bfa313d2e7cdf8ca325e7ad30035ce025c6b0058abb344',
            'strings': 7,
        },
    ],
    'moore-2013': [
        {
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
    ],
    'el-reno-2013': [
        {
            'previous_file': 'archive/el-reno-2013-3a4374318d08b471b959.json',
            'previous_wire': 'fda8f908acffe9b264a19c3a6f1303dd709533138c20c97cdfee641e11503813',
            'previous': '3a4374318d08b471b95970693f1ef0d5c3a31f8935d978fd8ca39709987a93a9',
            'current_file': 'archive/el-reno-2013-be9fdcbfb14a0da6b850.json',
            'current_wire': '5b3c010a2440b44ed667108a4a8e986d82077eeebf49b3e459d97bc21019ae9a',
            'current': 'be9fdcbfb14a0da6b8507ca6f885f917a9173d5a73643d48d2876f658a024fcb',
            'previous_history_file': 'archive/el-reno-2013-history-83bf806718d6548fb2ef.json',
            'previous_history_wire': '8f0285a05864e5767596a116132428f6b1cad5e565e1771b9bc01e8bdb5041f3',
            'history_file': 'archive/el-reno-2013-history-4c88ba2e6e622c431a2f.json',
            'history_wire': '87f33ed64cfcb6881596828c131417c82d82d5258e6ef77aa097dfdf631e1cf5',
            'previous_index_sha256': '7bf6c98a1012fea5af62b5646b8219f6496704df45fe855727b7a68e162d5eec',
            'current_index_sha256': '47da3a3fe03363b893c19976729a20ebaf12782703f56cfcc6fcf35f94bb9888',
            'candidate_sha256': 'a4458976d8f05846e24c1880e8d088bf5cab07d854c2b89806a6baff28bc0f55',
            'strings': 17,
        },
    ],
    'joplin-2011': [
        {
            'previous_file': 'archive/joplin-2011-287b0f5e3036c9f76549.json',
            'previous_wire': '9133b8b962c879c395a9125e78567d47dae2cd8c5f4b221b8da06ebbf0c52dc0',
            'previous': '287b0f5e3036c9f765497b6e5e9b4c6e3994699345decfd4c99f768373d6190c',
            'current_file': 'archive/joplin-2011-bbea762ba1a842484b4f.json',
            'current_wire': 'b9eabfcd3d794e438f7c43d5bc8618ce04685aa24bf0bf4c0dff2b2ec604f5a0',
            'current': 'bbea762ba1a842484b4fd887ec830a1bc897ed5d8e5f5a75ffcf1ebae080ebc7',
            'previous_history_file': 'archive/joplin-2011-history-87a76b5d14e2151ac81c.json',
            'previous_history_wire': '1349373855c3baef67ca7aa46096771e06751f5d8682b72170cbc8fdecbfe00d',
            'history_file': 'archive/joplin-2011-history-2d379396a30a776dda4a.json',
            'history_wire': '607ae3a158994608cf0ff9980c6f444f99672c1d7517390bb840bdfb5a07f854',
            'previous_index_sha256': 'd367899c0c9f3a0da8dcf0f9409ae32d676f5701515c0eda908bd0b5b55709c7',
            'current_index_sha256': '5b3d7001f54f1eec8928408fe7ec7455e4f63b268350f5267c0384646acf9cdc',
            'candidate_sha256': 'a2224cba5b1582ae6136d7034839b8e0766770dfaad36c7b2cb489261236e5bb',
            'strings': 9,
        },
    ],
    'blackwell-1955': [
        {
            'previous_file': 'archive/blackwell-1955-dcb7f27027e6e6192902.json',
            'previous_wire': 'd14d75d302f1236b507e7e583420ff9c6ac7a6c0ee2c7807efa37f3fd3a62cd5',
            'previous': 'dcb7f27027e6e619290215f8ae554e38ab2a45a51aff59861427b8d3285e6ae2',
            'current_file': 'archive/blackwell-1955-de028afdf56eed787a3e.json',
            'current_wire': '7c44f21d1f8279ec4e3988f167361a34db6612e5caab96300f72f2e5cd5f1030',
            'current': 'de028afdf56eed787a3e666c7e3364acbd20bcda152dabf194f499ed99db55a5',
            'previous_history_file': 'archive/blackwell-1955-history-c7ea0afdebd84c9e4d00.json',
            'previous_history_wire': 'ba6bb7d2bd8dd2a80fc39298ce9b24a55014b6b0fefa009652c451eff15a1129',
            'history_file': 'archive/blackwell-1955-history-63663155541cf8afb8d8.json',
            'history_wire': '67b979389cfeb7d1958443660a8aad20f36e7eed443d50357b86afb5bb0e92fe',
            'previous_index_sha256': '5e8ef81876d3fd2a61a7128ddc1ea9540cc72f1f1061d71bde833d7ae1241447',
            'current_index_sha256': 'bd5a9766a1e691b5803127a2bcdcd19054ae7f3cfdaac66517090cc7800f8662',
            'candidate_sha256': 'fb76a14030b4bd8209f2faf8646d37d7ba4bd0667c18b0da9b36e26cd7452c8e',
            'strings': 11,
        },
    ],
    'udall-1955': [
        {
            'previous_file': 'archive/udall-1955-33163d1731a0f30fae5e.json',
            'previous_wire': '8296d1156ba922652b7e8a708a7e3e267fec69a923f2a8aec360fbf5494d70cc',
            'previous': '33163d1731a0f30fae5e138ab18b67c7f97121ef229a7748a79f9a6b517ba802',
            'current_file': 'archive/udall-1955-38073d38c17d165d603c.json',
            'current_wire': 'f2f4f092e6317cae482906f03f3afbf9ae353df03dd3a0d08b0f9f1f25ccfd76',
            'current': '38073d38c17d165d603c0d4522981f61ff42813ecbbae0fee43b4a84241331c1',
            'previous_history_file': 'archive/udall-1955-history-aef7011884bc9ec7ac48.json',
            'previous_history_wire': '4ef7ee0f0ab6ae37c2b3fdd5f8c1ef9b2f0c87af53914b99029f1e14d2a1fadc',
            'history_file': 'archive/udall-1955-history-99b266abb180fa33d7ee.json',
            'history_wire': '7ef6f0ff0b0a6a5058e59d9d1bba04e1c4a22eed974a17ca18931f418cb6d838',
            'previous_index_sha256': 'b877850c6ad5c770e6e47cda0b812fe438fd091694877ae39db772156bbc8c86',
            'current_index_sha256': 'accc4f3fc8a469106b6d76c991e120357b6c2720139352583d3dc60e4aec4829',
            'candidate_sha256': 'badaa48963f65e0474e9354696d4909823b1ba6b6d86ce0bb6c20288892bf599',
            'strings': 2,
        },
    ],
}
# Only strings under these reader prose keys may gain a space, one at a time and
# only where two tokens ran together. Every protected token of the old string
# survives byte for byte, no space may split a number or a clock, and alignment
# and video times never change. A reported capture time may gain only the space
# before its zone. Identifiers and every provenance field keep their exact
# bytes.
PROSE_KEYS = {'access', 'account', 'agent_processing', 'alt', 'basis', 'coverage', 'event', 'inspection',
              'limits', 'locator', 'opening_motion_review', 'publication', 'recipe', 'reported', 'review',
              'revision', 'rights', 'scope', 'summary', 'time_conflict', 'title'}
TIMING_KEYS = {'alignment', 'video'}
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


def opens_a_join(before, position):
    """True when a space at this position separates two tokens that text extraction ran together.

    That is a letter and a digit, a list comma and a digit, a.m. or p.m. and a
    capital, a lower case letter and a capital, an acronym and a lower case word,
    a word and a lone panel letter, a word and a held identifier, or SHA256 and
    its hash. A space beside another space, or inside a word, is not one.
    """
    left, right = before[position - 1], before[position]
    if ' ' in (left, right):
        return False
    if left.isalnum() and right.isalnum() and left.isdigit() != right.isdigit():
        return True
    if (left == ',' and right.isdigit()) or (left.islower() and right.isupper()):
        return True
    if before[:position].endswith(('a.m.', 'p.m.')) and right.isupper():
        return True
    if left.isupper() and right.islower() and position > 1 and before[position - 2].isupper():
        return True
    if left.islower() and re.match(r'[a-d](?![A-Za-z0-9])', before[position:]):
        return True
    if before[:position].endswith('SHA256') and HASH.match(before, position):
        return True
    return any(match.start() == position for match in PROTECTED.finditer(before))


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
    case.assertFalse(TIMING_KEYS & set(path), 'A spacing edge cannot change an alignment or video time: ' + where)
    case.assertIn(path[-1], PROSE_KEYS, 'A spacing edge may only change reader prose: ' + where)
    positions = inserted_spaces(before, after)
    case.assertIsNotNone(positions, 'A spacing edge may only put spaces back: ' + where)
    case.assertEqual(len(positions), len(set(positions)), 'A spacing edge puts back one space at a time: ' + where)
    case.assertEqual([position for position in positions if splits_a_value(before, position)], [],
                     'A spacing edge cannot split a number, a clock or a protected token: ' + where)
    case.assertEqual([position for position in positions if not opens_a_join(before, position)], [],
                     'A spacing edge only separates tokens that ran together: ' + where)
    if 'capture' in path:
        case.assertEqual([position for position in positions
                          if not (before[position - 1].isdigit() and before[position].isupper())], [],
                         'A reported capture time may gain only the space before its zone: ' + where)
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


def _spacing_edge(case, current, spec, root, index_entry):
    """Validate one exact spacing edge and return (its predecessor, the index entry it retained)."""
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


def spacing_boundary(case, current, root=ROOT, index_entry=None):
    """Return (retained document, retained index entry) after exact validation.

    The edges of a dossier are peeled newest first, and each older edge reads
    the index entry the newer one retained. Events without a spacing edge come
    back unchanged with the entry supplied. Without an entry, the current
    document first passes its later footage register edge, and the spacing
    edges then read the entry that edge retained.
    """
    current = copy.deepcopy(current)
    if index_entry is None:
        current, index_entry = footage_boundary(case, current, root)
    for spec in reversed(SPACING_PROMOTIONS.get(current['id'], ())):
        current, index_entry = _spacing_edge(case, current, spec, root, index_entry)
    return current, index_entry


def spacing_predecessor(case, current, root=ROOT):
    return spacing_boundary(case, current, root)[0]


def spacing_index_entry(case, entry, root=ROOT):
    """A historical index view only. The real current index stays as it is."""
    entry = footage_index_entry(case, entry, root)
    if entry['id'] not in SPACING_PROMOTIONS:
        return entry
    spec = SPACING_PROMOTIONS[entry['id']][-1]
    current = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    return spacing_boundary(case, current, root, entry)[1]
