"""One exact source citation edge over the spaced Moore publication.

The Moore dossier says that a reported damage width is not the size of the
visible funnel. A dated research record then read a paper that measured both
on this tornado. This edge admits the dossier version that cites that paper
only when the version is its predecessor with one named source row added at
the end, one named observation row placed right after the row whose limit it
sits beside, and the research record added to the pinned inputs. Every older
row keeps its exact value.

The two new rows are held to the record. The observation cites the new source.
The source link is a DOI link the record gives, and the source row names the
record. The two rows quote exactly the passages this edge names, and each of
those stands inside a passage the record itself quotes. Outside its quotations
the observation states exactly the numbers this edge names, and each of those
stands in the record as a whole number. The observation registers no time,
place, camera or media. Nothing else may change
apart from the publication review, and the index and the history have to name
exactly this step. Every other edit and every later promotion still gets no
allowance.

Historical preservation tests read the predecessor this module returns. Current
source, media, rights and reading tests keep reading the current dossier.
"""
import copy
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASIS = 'Published source citation. '
# Immutable predecessor and successor publications, both histories, both index
# identities, the reviewed candidate, the research record and the rows it adds.
CITATION_PROMOTIONS = {
    'moore-2013': {
        'previous_file': 'archive/moore-2013-5c2ac0ec0006b1eee3e0.json',
        'previous_wire': 'b00333f3cc740e24dd9e8760e00f5ff640518b3ea543f4e7595ab42063c3965b',
        'previous': '5c2ac0ec0006b1eee3e08e0fd8fbf4402ee284c51bded881707e51e7a950ce72',
        'current_file': 'archive/moore-2013-2c71bdb17f121b0c00af.json',
        'current_wire': '7ba85ca684ea557d3c9c2d2899c520ad8dfad7e3cdcf6c30711047ede4ea2a80',
        'current': '2c71bdb17f121b0c00afb869aa7cc6482e1aad99fd51df238d2abbd92b24e167',
        'previous_history_file': 'archive/moore-2013-history-e2bb854718647fca37a8.json',
        'previous_history_wire': '620aa01b38724304bd86af569ecc958a1baa6057af1ba07821774fa8da2eb001',
        'history_file': 'archive/moore-2013-history-454e9d78f7850080b801.json',
        'history_wire': '0d265b232014cc7e5ede85e72f3ee12de3d6c6c70b685dd60d1ce3eb7edeb346',
        'previous_index_sha256': '209fd55f300bccf8d2fa074c59d4fdea695007c8d0f375f798c881d16324840f',
        'current_index_sha256': '4e616102f22d1b4664d3180b7a7b6d49f7ce2a83c726e889e95adb68195bb4fd',
        'candidate_sha256': 'ca1d5cbc5f6a0f3f746e9cb80d96ea145dc73779e9246fef40ab1d69822f15c6',
        'record': 'research/atkins-moore-funnel-damage-2026-11-25.md',
        'record_sha256': '9e07e5f9d27216cd30acf7c9c7888fe29c414c6e6129633c88bab74746cc2a45',
        'source': 'atkins-2014-moore-analysis',
        'observation': 'funnel-against-damage-width',
        # The row whose limit the new observation sits beside.
        'beside': 'reported-path-and-dimensions',
        # Every number the observation states outside its quotations, as often
        # as it states it: the day and year of the event once, and the scan
        # label the paper prints in the locator, the account and the event time.
        'numbers': ('20', '2013', '2016:43', '2016:43', '2016:43'),
        # Every passage the two rows put in quotation marks, as often as they do.
        'quotations': (
            'Damage survey, visual, and radar observations',
            'Damage survey, visual, and radar observations',
            'Photogrammetry',
            'Photogrammetry',
            'The condensation funnel diameter is estimated to be 18% and 8.4% of the width of the damage path and '
            'TDS, respectively.',
            'is not possible with the available photos of the Moore tornado.',
            'it is assumed that the condensation funnel center is collocated with the damage path centerline.',
            'the damaging winds extend well beyond the condensation funnel location.',
        ),
    },
}
REVIEW_KEYS = ('basis', 'candidate_sha256', 'previous_dossier_sha256', 'reviewed_at')
# A cited observation reports what its source says. It registers nothing.
UNREGISTERED = {'assertion': 'source_reported', 'spatial': 'unregistered', 'availability': 'reviewed_available',
                'rights': 'links_only'}
QUOTATION = re.compile(r'"([^"]+)"')
# A curly mark, or a single mark that opens a quotation and is no apostrophe.
OTHER_QUOTES = re.compile('[\\u2018\\u2019\\u201c\\u201d]|(?<!\\w)\'')
NUMBER = re.compile(r'\d+(?:[:.]\d+)*%?')
DOI_LINK = re.compile(r'https://doi\.org/10\.\d{4,9}/[^\s()\[\]<>"]+')
# What the observation reports. Its review line says how and when the source
# was read, so the dates there are not held to the record.
REPORTED_KEYS = ('title', 'locator', 'account', 'limits')


def canonical(doc):
    return hashlib.sha256(json.dumps(doc, ensure_ascii=False, sort_keys=True,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def _bound(case, root, file, wire, logical=None):
    raw = (root / 'web' / file).read_bytes()
    case.assertEqual(hashlib.sha256(raw).hexdigest(), wire,
                     'Immutable reviewed citation bytes changed: ' + file)
    doc = json.loads(raw)
    if logical is not None:
        case.assertEqual(canonical(doc), logical, 'Immutable citation logical identity changed')
    return doc


def _row(doc, kind, identity):
    rows = [row for row in doc[kind] if row['id'] == identity]
    if len(rows) != 1:
        raise AssertionError(f'Expected one {kind} row {identity}')
    return rows[0]


def _strings(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)
    elif isinstance(value, str):
        yield value


def _one_line(text):
    return re.sub(r'\s+', ' ', text)


def record_text(case, spec, root=ROOT):
    """The research record as one line of text, after checking it is the reviewed one."""
    raw = (root / spec['record']).read_bytes()
    case.assertEqual(hashlib.sha256(raw).hexdigest(), spec['record_sha256'],
                     'The research record differs from the reviewed one. A later change needs its own edge')
    return _one_line(raw.decode('utf-8'))


def whole_number(number):
    """A pattern that finds number in prose only where it is not part of a longer number, word or hash."""
    return r'(?<![\w.,:%-])' + re.escape(number) + r'(?![\w:%-]|[.,]\d)'


def citation_rows(case, spec, source, observation, record):
    """Hold the two new rows to the research record they cite."""
    case.assertEqual(observation['source_id'], source['id'], 'The new observation cites the new source')
    case.assertIn(source['url'], DOI_LINK.findall(record), 'The source link is a DOI link the record gives')
    case.assertIn(spec['record'], source['access'], 'The source row names the record of its reading')
    texts = [text for row in (source, observation) for text in _strings(row)]
    for text in texts:
        case.assertIsNone(OTHER_QUOTES.search(text),
                          'Quotations use straight double marks so every one is checked: ' + text)
    case.assertTrue(QUOTATION.search(observation['account']), 'The observation quotes its source')
    quotations = sorted(quote for text in texts for quote in QUOTATION.findall(text))
    case.assertEqual(quotations, sorted(spec['quotations']), 'The two rows quote exactly the passages this edge names')
    quoted_in_record = QUOTATION.findall(record)
    for quote in spec['quotations']:
        case.assertTrue(any(_one_line(quote) in passage for passage in quoted_in_record),
                        'Every quotation stands inside a passage the record quotes: ' + quote)
    reported = [observation[key] for key in REPORTED_KEYS]
    reported += [*_strings(observation['time']['event']), *_strings(observation['place']['reported']),
                 *_strings(observation['place']['basis'])]
    stated = sorted(number for text in reported for number in NUMBER.findall(QUOTATION.sub(' ', text)))
    case.assertEqual(stated, sorted(spec['numbers']),
                     'Outside its quotations the observation states exactly the numbers this edge names')
    for number in set(spec['numbers']):
        case.assertRegex(record, whole_number(number), 'Every named number stands whole in the record: ' + number)
    status = observation['status']
    case.assertEqual({key: status[key] for key in UNREGISTERED}, UNREGISTERED,
                     'A cited observation is source reported and registers no place')
    case.assertIn(status['temporal'], ('unregistered', 'source_label'), 'A cited observation aligns no clock')
    for role in ('capture', 'video', 'alignment'):
        case.assertIsNone(observation['time'][role], 'A cited observation registers no ' + role + ' time')
    case.assertIsNone(observation['place']['coordinates'], 'A cited observation registers no point')


def explain_successor(case, spec, previous, successor, record):
    """Rebuild the successor from its predecessor, the two named rows and the record.

    Anything the rebuild does not explain leaves the two unequal. The two named
    rows are then held to the record. This step reads no pinned bytes, so it can
    be tried on a changed successor.
    """
    old_review = previous['provenance']['publication_review']
    new_review = successor['provenance']['publication_review']
    case.assertEqual(set(new_review), set(old_review), 'Publication review shape is retained')
    case.assertEqual(new_review['reviewer_kind'], old_review['reviewer_kind'])
    case.assertEqual(new_review['reviewer_kind'], 'agent')
    case.assertEqual(new_review['previous_dossier_sha256'], spec['previous'],
                     'The review names the exact predecessor')
    case.assertEqual(new_review['candidate_sha256'], spec['candidate_sha256'],
                     'The review names the exact reviewed candidate')
    case.assertTrue(new_review['basis'].startswith(BASIS), 'The review names the source citation')

    source = _row(successor, 'sources', spec['source'])
    observation = _row(successor, 'observations', spec['observation'])
    expected = copy.deepcopy(previous)
    for kind, identity in (('sources', spec['source']), ('observations', spec['observation'])):
        case.assertNotIn(identity, [row['id'] for row in expected[kind]], 'A named addition must be new: ' + identity)
    expected['sources'].append(copy.deepcopy(source))
    place = [row['id'] for row in expected['observations']].index(spec['beside']) + 1
    expected['observations'].insert(place, copy.deepcopy(observation))
    inputs = expected['provenance']['inputs']
    case.assertNotIn(spec['record'], inputs)
    inputs[spec['record']] = spec['record_sha256']
    for key in REVIEW_KEYS:
        expected['provenance']['publication_review'][key] = new_review[key]
    case.assertEqual(expected, successor, 'The two named rows and the record must explain every change')
    case.assertEqual(canonical(expected), canonical(successor), 'The citation edge keeps exact JSON types')
    citation_rows(case, spec, source, observation, record)
    return new_review


def _citation_edge(case, current, spec, root, index_entry):
    """Validate the exact citation edge and return (its predecessor, the index entry it retained)."""
    event = current['id']
    previous = _bound(case, root, spec['previous_file'], spec['previous_wire'], spec['previous'])
    frozen = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    case.assertEqual(current, frozen, 'Only the exact reviewed continuation changes are admitted')
    case.assertEqual(canonical(current), spec['current'], 'Only the exact reviewed continuation types are admitted')
    new_review = explain_successor(case, spec, previous, frozen, record_text(case, spec, root))

    if index_entry is None:
        index = json.loads((root / 'web/archive/index.json').read_bytes())
        entries = [row for row in index['events'] if row['id'] == event]
        case.assertEqual(len(entries), 1)
        index_entry = entries[0]
    entry = index_entry
    case.assertEqual(canonical(entry), spec['current_index_sha256'], 'Exact current citation index entry')
    case.assertEqual((entry['file'], entry['file_sha256'], entry['dossier_sha256'], entry['history_file']),
                     (spec['current_file'], spec['current_wire'], spec['current'], spec['history_file']))
    old_history = _bound(case, root, spec['previous_history_file'], spec['previous_history_wire'])
    history = _bound(case, root, spec['history_file'], spec['history_wire'])
    case.assertEqual(old_history['current_dossier_sha256'], spec['previous'])
    expected_history = copy.deepcopy(old_history)
    expected_history['current_dossier_sha256'] = spec['current']
    edge = {'dossier_sha256': spec['current'], 'file_sha256': spec['current_wire'],
            'file': spec['current_file'], 'review': new_review, 'predecessor_available': True,
            'changes': [dict(kind='sources', id=spec['source'], change='added', fields=[]),
                        dict(kind='observations', id=spec['observation'], change='added', fields=[])]}
    expected_history['versions'] = [edge] + sorted(old_history['versions'], key=lambda row: row['dossier_sha256'])
    case.assertEqual(history, expected_history, 'Only the named citation edge may extend the retained history')
    retained = {**entry, 'file': spec['previous_file'], 'file_sha256': spec['previous_wire'],
                'dossier_sha256': spec['previous'], 'history_file': spec['previous_history_file']}
    for field in ('title', 'summary', 'coverage', 'creators'):
        case.assertEqual(retained[field], previous[field], 'The citation edge keeps the index field ' + field)
    case.assertEqual(canonical(retained), spec['previous_index_sha256'], 'Exact retained citation index entry')
    return copy.deepcopy(previous), retained


def citation_boundary(case, current, root=ROOT, index_entry=None):
    """Return (retained document, retained index entry) after exact validation.

    Events without a citation edge come back unchanged with the entry supplied.
    This is the newest edge of its dossier, so it is peeled before every other.
    """
    spec = CITATION_PROMOTIONS.get(current['id'])
    if spec is None:
        return copy.deepcopy(current), index_entry
    return _citation_edge(case, current, spec, root, index_entry)


def citation_predecessor(case, current, root=ROOT):
    return citation_boundary(case, current, root)[0]


def citation_index_entry(case, entry, root=ROOT):
    """A historical index view only. The real current index stays as it is."""
    spec = CITATION_PROMOTIONS.get(entry['id'])
    if spec is None:
        return entry
    current = _bound(case, root, spec['current_file'], spec['current_wire'], spec['current'])
    return citation_boundary(case, current, root, entry)[1]
