"""Every image the site serves is named by a record that carries its rights.

Third party images count only when an exhibit record or a research record names
the exact file and that same record states its rights. A note that only warns
about rights is not a statement of them. Images this project draws itself are
listed once in PROJECT_MADE, each with the file that makes or describes it, and
that file has to name the image. KNOWN_GAPS lists each served image that still
has no rights basis, and the test fails if that list is not exactly the gaps it
finds, so a gap can be closed but never added quietly.
"""

import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'
IMAGE_SUFFIXES = {'.apng', '.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp'}

# Images made by this project, mapped to the file that makes or describes each
# one and the text that file must contain to name it. The synthetic ground view
# references describe themselves, so each one has to carry its own camera and
# second in its description.
PROJECT_MADE = {
    'mechanism-obscur-narrow.png': ('docs/mechanism-rendering.json', 'web/mechanism-obscur-narrow.png'),
    'mechanism-obscur-narrow.svg': ('docs/mechanism-rendering.json', 'web/mechanism-obscur-narrow.svg'),
    'mechanism-obscur-wide.png': ('docs/mechanism-rendering.json', 'web/mechanism-obscur-wide.png'),
    'mechanism-obscur-wide.svg': ('docs/mechanism-rendering.json', 'web/mechanism-obscur-wide.svg'),
    'share-preview.png': ('docs/sharing-card.json', 'web/share-preview.png'),
    **{f'assets/ground-view-demo/synthetic-{camera}-{second}.svg':
       (f'web/assets/ground-view-demo/synthetic-{camera}-{second}.svg',
        f'Camera synthetic-{camera}, shared-player second {second}. No historical source image')
       for camera in ('front', 'oblique') for second in (120, 130, 140)},
}

# Served images whose only record names them without a rights basis. Each one
# is an open defect, not an accepted state.
KNOWN_GAPS = {
    'assets/joplin-2011/nws-track.png':
        'The manifest says the report figure may hold third party basemap parts and is not licensed here, '
        'but records no basis for hosting it.',
}


def _text(value):
    return isinstance(value, str) and value.strip() != ''


def _load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def _dossier_records(dossier, where):
    sources = {source['id']: source for source in dossier.get('sources', [])}
    for item in dossier.get('media', []):
        made = item.get('transformation')
        if not isinstance(made, dict):
            continue
        names = [made.get('asset'), made.get('poster')]
        names += [entry.get('asset') for entry in made.get('assets', []) if isinstance(entry, dict)]
        if isinstance(made.get('animation'), dict):
            names.append(made['animation'].get('asset'))
        source = sources.get(item.get('source_id'), {})
        rights = (item.get('status', {}).get('rights') == 'permitted_hosting'
                  and _text(source.get('rights')))
        for name in filter(None, names):
            yield name, f"{where} media {item.get('id')}", rights


def rights_records():
    """Yield (image path under web, record label, whether the record states rights)."""
    for path in sorted(ROOT.glob('exhibits/*/dossier.json')):
        yield from _dossier_records(_load(path), path.relative_to(ROOT).as_posix())
    for path in sorted(ROOT.glob('research/archive-curated/*.json')):
        yield from _dossier_records(_load(path)['dossier'], path.relative_to(ROOT).as_posix())

    el_reno = ROOT / 'exhibits' / 'el-reno-2013'
    for photo in _load(el_reno / 'damage.json')['photos']:
        yield photo['asset'], f"damage.json {photo['id']}", _text(photo.get('credit')) and _text(photo.get('rights_basis'))
    for photo in _load(el_reno / 'storm-photos.json'):
        stated = all(_text(photo.get(key)) for key in ('credit', 'license', 'license_url'))
        yield photo['file'], f"storm-photos.json {photo['id']}", stated
        for version in photo.get('reading_versions', []):
            yield version['file'], f"storm-photos.json {photo['id']} reading version", stated
    radar = _load(el_reno / 'timeline-media.json')
    stated = all(_text(radar.get(key)) for key in ('credit', 'license', 'license_url'))
    for frame in radar['frames']:
        yield frame['file'], f"timeline-media.json frame {frame['frame_index']}", stated
    comparison = _load(el_reno / 'documentary.json')['comparison']
    stated = _text(comparison.get('credit')) and _text(comparison.get('rights'))
    for name in (comparison['original_asset'], comparison['before']['asset'], comparison['after']['asset']):
        yield name, 'documentary.json comparison', stated
    for sequence in _load(el_reno / 'appearance-timeline.json')['photo_sequences']:
        for sample in sequence['samples']:
            hosted = sample.get('hosted_image')
            if hosted:
                yield hosted['asset'], f"appearance-timeline.json {hosted['record_id']}", _text(hosted.get('rights_basis'))

    for asset in _load(ROOT / 'exhibits' / 'joplin-2011' / 'manifest.json')['assets']:
        if not asset['path'].startswith('web/'):
            continue
        name = asset['path'].removeprefix('web/')
        yield name, f"joplin-2011 manifest {name}", _text(asset.get('credit')) and _text(asset.get('license'))


def served_images():
    return sorted(path.relative_to(WEB).as_posix() for path in WEB.rglob('*')
                  if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES)


def uncovered(images, records):
    """Return each image no rights record names, and each record that names an image without stating rights."""
    stated = {name for name, _, rights in records if rights}
    unstated = sorted({f'{name} ({label})' for name, label, rights in records if not rights and name in images})
    missing = sorted(name for name in images if name not in stated and name not in PROJECT_MADE)
    return missing, unstated


class ImageRightsCoverageTests(unittest.TestCase):
    def test_every_served_image_has_a_rights_record(self):
        missing, unstated = uncovered(served_images(), list(rights_records()))
        self.assertEqual(missing, sorted(KNOWN_GAPS), 'Images under web/ that no rights record covers')
        self.assertEqual([line for line in unstated if line.split(' (')[0] not in KNOWN_GAPS], [],
                         'Records that name a served image without stating its rights')

    def test_project_made_images_are_named_by_their_maker(self):
        images = set(served_images())
        for name, (maker, mention) in PROJECT_MADE.items():
            with self.subTest(image=name):
                self.assertIn(name, images, 'A listed project image is no longer served')
                self.assertIn(mention, (ROOT / maker).read_text(encoding='utf-8'))
                self.assertNotIn(name, {record for record, _, _ in rights_records()},
                                 'A third party record names an image listed as project made')

    def test_every_record_names_a_served_file(self):
        served = {path.relative_to(WEB).as_posix() for path in WEB.rglob('*') if path.is_file()}
        for name, label, _ in rights_records():
            with self.subTest(record=label):
                self.assertTrue(name in served, f'{name} is not served under web/')

    def test_an_image_no_record_names_is_reported(self):
        images = served_images() + ['assets/el-reno-2013/unrecorded.jpg']
        missing, _ = uncovered(images, list(rights_records()))
        self.assertEqual(missing, sorted([*KNOWN_GAPS, 'assets/el-reno-2013/unrecorded.jpg']))

    def test_a_record_without_rights_is_reported(self):
        name = 'assets/el-reno-2013/storm01.jpg'
        records = [(record, label, rights and record != name) for record, label, rights in rights_records()]
        missing, unstated = uncovered(served_images(), records)
        self.assertEqual(missing, sorted([*KNOWN_GAPS, name]))
        self.assertTrue(any(line.startswith(name) for line in unstated))

    def test_a_warning_note_is_not_a_rights_statement(self):
        manifest = _load(ROOT / 'exhibits' / 'joplin-2011' / 'manifest.json')['assets']
        track = next(asset for asset in manifest if asset['path'] == 'web/assets/joplin-2011/nws-track.png')
        self.assertIn('rights_note', track)
        self.assertNotIn('license', track)
        labels = [rights for name, _, rights in rights_records() if name == 'assets/joplin-2011/nws-track.png']
        self.assertEqual(labels, [False])


if __name__ == '__main__':
    unittest.main()
