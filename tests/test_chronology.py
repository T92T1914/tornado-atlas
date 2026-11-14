import copy
import json
from pathlib import Path
import tempfile
import unittest

from atlas.chronology import validate_chronology
from atlas.event_package import publication_artifacts, validate_index

ROOT = Path(__file__).resolve().parents[1]


class ChronologyTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'exhibits/joplin-2011/chronology.json').read_text())

    def test_source_bytes_and_clock_conversion(self):
        validate_chronology(self.data, 'joplin-2011', ROOT)
        self.assertEqual(self.data['entries'][4]['utc'], '2011-05-22T22:34:00Z')
        self.assertEqual(self.data['entries'][4]['precision'], 'approximate_minute')
        self.assertEqual(self.data['entries'][0]['utc'], '2011-05-22T18:30:00Z')

    def test_rejects_unknown_time_precision_identity_and_source(self):
        mutations = [lambda d: d.update(event_id='another-event'),
                     lambda d: d['entries'][0].update(precision='exact'),
                     lambda d: d['clock'].update(time_zone=None),
                     lambda d: d['sources'][0].update(url='https://user:password@example.test/report.pdf'),
                     lambda d: d['entries'][0].update(utc=None),
                     lambda d: d['entries'][0].update(utc='2011-02-30T18:30:00Z'),
                     lambda d: d['entries'][0].update(utc='2011-05-22T18:30:01Z'),
                     lambda d: d['entries'][0].update(source_id='missing'),
                     lambda d: d['entries'][0].update(page=True),
                     lambda d: d['entries'][0].update(limits=''),
                     lambda d: d['entries'][0].update(coordinates=[0, 0]),
                     lambda d: d['sources'][0].update(archive='../private.pdf'),
                     lambda d: d['sources'][0].update(url='javascript:alert(1)'),
                     lambda d: d['entries'].reverse(),
                     lambda d: d['entries'][1].update(id=d['entries'][0]['id'])]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                data = copy.deepcopy(self.data)
                mutate(data)
                with self.assertRaises(ValueError):
                    validate_chronology(data, 'joplin-2011')

    def test_changed_source_is_not_silently_republished(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / self.data['sources'][0]['archive']
            source.parent.mkdir(parents=True)
            source.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError, 'bytes have changed'):
                validate_chronology(self.data, 'joplin-2011', root)

    def test_generated_chronology_matches_curated_evidence(self):
        artifacts = publication_artifacts(ROOT, (ROOT / 'web/data.json').read_bytes())
        self.assertEqual(artifacts['events/joplin-2011-chronology.json'], self.data)
        self.assertIsNone(artifacts['events.json']['events'][1]['replay'])
        self.assertIsNone(artifacts['events.json']['events'][2]['chronology'])


    def test_later_assessment_routes_preserve_exact_entries_and_separate_clocks(self):
        validate_chronology(self.data, 'joplin-2011', ROOT)
        context = self.data['reading_context']
        distinction = 'intake-nws-local-siren-warning-distinction-2011'
        cessation = 'intake-nws-siren-cessation-2011'
        self.assertEqual(context['reference'], self.data['radar_context']['reference'])
        self.assertEqual(context['associations'], [
            dict(entry_id='warning-30', observation_ids=[distinction]),
            dict(entry_id='first-siren', observation_ids=[distinction, cessation])])
        self.assertEqual([(row['report_page'], row['documentary_anchor']) for row in context['observations']],
                         [(19, 'warning-context'), (11, 'siren-response')])
        self.assertEqual(len(self.data['entries']), 7)
        # Chapter routes are checked here without making selective chronology
        # publication depend on the chapter's content or other event pages.
        chapter = (ROOT / 'web/joplin.html').read_text(encoding='utf-8')
        for route in context['observations']:
            self.assertIn('id="' + route['documentary_anchor'] + '"', chapter)
        dossier = json.loads((ROOT / 'web' / context['reference']['file']).read_text(encoding='utf-8'))
        for identity in (distinction, cessation):
            observation = next(row for row in dossier['observations'] if row['id'] == identity)
            self.assertEqual(observation['status']['temporal'], 'unregistered')
            self.assertEqual(observation['status']['spatial'], 'unregistered')
            self.assertEqual(observation['status']['rights'], 'links_only')
            for clock in ('event', 'capture', 'video', 'alignment'):
                self.assertIsNone(observation['time'][clock])
            self.assertIsNone(observation['place']['coordinates'])

    def test_reading_context_rejects_missing_duplicate_and_unsafe_routes(self):
        mutations = [
            lambda c: c.update(event_id='other'),
            lambda c: c['reference'].update(file_sha256='0' * 64),
            lambda c: c['observations'][0].update(source_id='missing'),
            lambda c: c['observations'][0].update(report_page=True),
            lambda c: c['observations'][0].update(documentary_anchor='../unsafe'),
            lambda c: c['observations'].append(c['observations'][0]),
            lambda c: c['associations'][0].update(entry_id='missing'),
            lambda c: c['associations'].append(c['associations'][0]),
            lambda c: c['associations'][0]['observation_ids'].append(c['associations'][0]['observation_ids'][0]),
            lambda c: c['associations'][0].update(observation_ids=['missing']),
            lambda c: c['associations'].pop()]
        for mutate in mutations:
            changed = copy.deepcopy(self.data)
            mutate(changed['reading_context'])
            with self.subTest(mutation=mutate), self.assertRaises(ValueError):
                validate_chronology(changed, 'joplin-2011')

    def test_schema_two_remains_compatible_without_later_assessment_context(self):
        old = copy.deepcopy(self.data)
        old['schema_version'] = 2
        old.pop('reading_context')
        validate_chronology(old, 'joplin-2011', ROOT)

    def test_index_versions_do_not_tolerate_unreviewed_paths(self):
        index = json.loads((ROOT / 'exhibits/events.json').read_text(encoding='utf-8'))
        index['events'][1]['chronology'] = 'events/blackwell-1955-chronology.json'
        with self.assertRaisesRegex(ValueError, 'Chronology path'):
            validate_index(index)
        index['events'][1]['chronology'] = 'events/joplin-2011-chronology.json'
        index['events'][1]['replay'] = 'events/joplin-2011.json'
        with self.assertRaisesRegex(ValueError, 'synchronization'):
            validate_index(index)
        index['schema_version'] = 1
        for event in index['events']:
            del event['chronology']
        validate_index(index)


class TuscaloosaChronologyTests(unittest.TestCase):
    """A survey web page can be a source once its text is archived and pinned."""

    def setUp(self):
        self.event = 'tuscaloosa-birmingham-2011'
        self.data = json.loads((ROOT / f'exhibits/{self.event}/chronology.json').read_text(encoding='utf-8'))

    def test_archived_sources_and_printed_clocks(self):
        validate_chronology(self.data, self.event, ROOT)
        entries = {row['id']: row for row in self.data['entries']}
        # The survey prints 443 pm and 614 pm. Read as CDT they are the NCEI
        # CST begin and end, 15:43 and 17:14.
        self.assertEqual((entries['survey-start']['source_time'], entries['survey-start']['utc']), ('443 pm', '2011-04-27T21:43:00Z'))
        self.assertEqual((entries['survey-end']['source_time'], entries['survey-end']['utc']), ('614 pm', '2011-04-27T23:14:00Z'))
        # Table 1 is converted as printed under its Time (CST) column.
        self.assertEqual(entries['assessment-table-start']['utc'], '2011-04-27T21:50:00Z')
        self.assertEqual(entries['assessment-table-end']['utc'], '2011-04-27T22:45:00Z')
        for key in ('assessment-table-start', 'assessment-table-end'):
            self.assertIn('3:50 – 4:45 p.m.', entries[key]['source_time'])
            self.assertIn('Time (CST)', entries[key]['source_time'])
            self.assertIn('disagrees with the survey', entries[key]['limits'])
            self.assertEqual(entries[key]['page'], 14)
        for key in ('survey-start', 'survey-end'):
            self.assertIsNone(entries[key]['page'])
            self.assertEqual(entries[key]['precision'], 'approximate_minute')
        # The assessment does not tie its 4:15 p.m. warning to this tornado.
        self.assertFalse(any('4:15' in json.dumps(row) for row in self.data['entries']))
        archive = (ROOT / self.data['sources'][0]['archive']).read_text(encoding='utf-8')
        self.assertIn('33.0297/-87.9350 at 443 pm', archive)
        self.assertIn('33.6311/-86.7436 at 614 pm', archive)
        self.assertIn('Retrieved: 2026-11-14T07:05:59Z', archive)

    def test_text_and_pdf_sources_keep_their_citation_forms(self):
        mutations = [lambda d: d['entries'][0].update(page=1),
                     lambda d: d['entries'][1].update(page=None),
                     lambda d: d['sources'][0].update(archive='exhibits/tuscaloosa-birmingham-2011/survey.html'),
                     lambda d: d['sources'][0].update(archive='exhibits/joplin-2011/survey.txt'),
                     lambda d: d['sources'][0].update(archive=None),
                     lambda d: d['sources'].append(copy.deepcopy(d['sources'][0]))]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                data = copy.deepcopy(self.data)
                mutate(data)
                with self.assertRaises(ValueError):
                    validate_chronology(data, self.event)

    def test_changed_archived_text_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for source in self.data['sources']:
                path = root / source['archive']
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes((ROOT / source['archive']).read_bytes())
            validate_chronology(self.data, self.event, root)
            text = root / self.data['sources'][0]['archive']
            text.write_bytes(text.read_bytes().replace(b'443 pm', b'433 pm'))
            with self.assertRaisesRegex(ValueError, 'bytes have changed'):
                validate_chronology(self.data, self.event, root)

    def test_published_package_and_archive_tag(self):
        artifacts = publication_artifacts(ROOT, (ROOT / 'web/data.json').read_bytes())
        self.assertEqual(artifacts[f'events/{self.event}-chronology.json'], self.data)
        index = json.loads((ROOT / 'web/archive/index.json').read_text(encoding='utf-8'))
        tagged = {row['id'] for row in index['events'] if 'chronology' in row['evidence']}
        self.assertEqual(tagged, {'joplin-2011', self.event})
