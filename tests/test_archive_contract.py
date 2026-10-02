"""Malformed publication candidates must not acquire stronger evidence claims."""

import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from atlas.archive import clocks, digest, dossiers, evidence, place, public_url, source, status, validate_dossier


def specimen():
    """A synthetic link record, independent of mutable historical fixtures."""
    return {
        'schema_version': 1,
        'id': 'synthetic-contract',
        'title': 'Synthetic source contract',
        'coverage': 'Dossier',
        'summary': 'A validation fixture, not historical evidence.',
        'records': [{'id': 'ncei:123', 'basis': 'Synthetic association fixture.',
                     'status': 'reviewed_association', 'alternatives': []}],
        'routes': [{'label': 'Catalogue', 'href': 'atlas.html'}],
        'creators': [{'id': 'fixture-creator', 'name': 'Synthetic creator',
                      'basis': 'Synthetic attribution fixture.'}],
        'sources': [source('fixture-source', 'Synthetic page', 'https://example.com/source',
                           'Figure 1.', 'Synthetic access record.', 'Fixture revision 1.')],
        'observations': [],
        'media': [evidence(
            'fixture-media', 'Synthetic linked photograph', 'fixture-source', 'Figure 1.',
            'Synthetic account.', 'No historical claim is made.',
            kind='photograph', url='https://example.com/figure',
            roles={'creator': 'fixture-creator', 'uploader': None, 'rights_holder': None},
            parent=None, transformation='No bytes acquired.',
            status=status(), time=clocks(), place=place(role='camera'))],
        'reconstruction': {'appearance': 'unregistered', 'intervals': [],
                           'limits': 'No registered appearance.'},
        'provenance': {'adapter': 'synthetic test fixture', 'inputs': {}},
    }


class ArchiveContractTests(unittest.TestCase):
    def rejected(self, mutation):
        doc = specimen()
        mutation(doc)
        with self.assertRaises(ValueError):
            validate_dossier(doc)

    def test_dossier_title_rejects_nontext_values(self):
        for value in (None, False, True, 123, 1.5, [], ['title'], {}, {'title': 'text'}):
            with self.subTest(title=value):
                doc = specimen()
                doc['title'] = value
                with self.assertRaisesRegex(ValueError, '^Dossier title must be text$'):
                    validate_dossier(doc)

    def test_dossier_title_preserves_text_without_normalization(self):
        for title in ('Synthetic title', 'Unicode title Ω 測', 'Cafe\u0301', '', '  title  ', ' '):
            with self.subTest(title=title):
                doc = specimen()
                doc['title'] = title
                before = copy.deepcopy(doc)
                self.assertIs(validate_dossier(doc), doc)
                self.assertEqual(doc, before)
                self.assertEqual(doc['title'].encode('utf-8'), title.encode('utf-8'))

    def test_independent_restrictions_do_not_erase_a_valid_observation(self):
        doc = specimen()
        doc['media'][0]['status'].update(assertion='observed_sample', rights='restricted',
                                       availability='unavailable')
        self.assertIs(validate_dossier(doc), doc)
        self.assertEqual(doc['media'][0]['status']['assertion'], 'observed_sample')

    def test_unsafe_and_duplicate_object_identities_are_rejected(self):
        for bad in ['../other', '', 'space separated', 'two#fragments']:
            with self.subTest(identity=bad):
                self.rejected(lambda d: d.update(id=bad))
        for kind in ['sources', 'creators', 'media']:
            with self.subTest(duplicate_kind=kind):
                self.rejected(lambda d: d[kind].append(copy.deepcopy(d[kind][0])))

    def test_missing_typed_references_are_rejected(self):
        changes = [
            lambda d: d['media'][0].update(source_id='absent-source'),
            lambda d: d['media'][0]['roles'].update(uploader='absent-uploader'),
            lambda d: d['media'][0].update(parent='absent-media'),
        ]
        for index, change in enumerate(changes):
            with self.subTest(reference=index):
                self.rejected(change)

    def test_derivatives_cannot_be_their_own_ancestor(self):
        with self.subTest(cycle='self'):
            self.rejected(lambda d: d['media'][0].update(parent='fixture-media'))
        doc = specimen()
        second = copy.deepcopy(doc['media'][0])
        second.update(id='second-media', parent='fixture-media')
        doc['media'][0]['parent'] = 'second-media'
        doc['media'].append(second)
        with self.subTest(cycle='two nodes'), self.assertRaises(ValueError):
            validate_dossier(doc)

    def test_source_record_associations_have_safe_unique_identities(self):
        with self.subTest(identity='path'):
            self.rejected(lambda d: d['records'][0].update(id='../private-record'))
        with self.subTest(identity='duplicate'):
            self.rejected(lambda d: d['records'].append(copy.deepcopy(d['records'][0])))

    def test_public_routes_and_source_urls_remain_bounded(self):
        for href in ['../private.html', '//example.com/elsewhere', 'file:///private']:
            with self.subTest(route=href):
                self.rejected(lambda d: d['routes'][0].update(href=href))
        for url in ['https://localhost./source', 'https://server.internal./source']:
            with self.subTest(source_url=url):
                self.rejected(lambda d: d['sources'][0].update(url=url))
            with self.subTest(media_url=url):
                self.rejected(lambda d: d['media'][0].update(url=url))

    def test_registered_clock_requires_an_actual_explicit_utc_instant(self):
        for value in ['not-a-date', '2013-05-31T23:00:00', '2013-02-30T23:00:00Z', 123]:
            with self.subTest(alignment=value):
                doc = specimen()
                doc['media'][0]['status']['temporal'] = 'discrete_anchor'
                doc['media'][0]['time']['alignment'] = {
                    'utc': value, 'basis': 'Synthetic registration fixture.'}
                with self.assertRaises(ValueError):
                    validate_dossier(doc)

    def test_browser_normalized_private_hosts_cannot_enter_source_or_media_links(self):
        urls = [
            'https://127.1/source',
            'https://0177.0.0.1/source',
            'https://0x7f.0.0.1/source',
            'https://0300.0250.1.1/source',
            'https://%31%32%37.0.0.1/source',
            'https://１２７.０.０.１/source',
            r'https://127.0.0.1\example.org/source',
        ]
        for url in urls:
            with self.subTest(source_url=url):
                self.rejected(lambda d: d['sources'][0].update(url=url))
            with self.subTest(media_url=url):
                self.rejected(lambda d: d['media'][0].update(url=url))

    def test_public_host_spelling_keeps_paths_queries_and_source_bytes_intact(self):
        for url in ['https://www.weather.gov/source%20notes?loc=%31#figure-1',
                    'https://123.example.org/source', 'https://münich.example.org/source',
                    'https://8.8.8.8/source']:
            with self.subTest(url=url):
                self.assertIsNone(public_url(url))
                doc = specimen()
                doc['sources'][0]['url'] = url
                self.assertIs(validate_dossier(doc), doc)
                self.assertEqual(doc['sources'][0]['url'], url)

    def test_invalid_ports_cannot_enter_source_or_media_links(self):
        for port in ('65536', '99999', '-1', 'abc', '+443', '443.0'):
            url = f'https://example.org:{port}/source'
            with self.subTest(source_url=url):
                self.rejected(lambda d: d['sources'][0].update(url=url))
            with self.subTest(media_url=url):
                self.rejected(lambda d: d['media'][0].update(url=url))

    def test_valid_explicit_ports_preserve_original_source_links(self):
        for port in ('0', '443', '0443', '8443', '65535', ''):
            url = f'https://example.org:{port}/source%20notes?loc=%31#figure-1'
            with self.subTest(url=url):
                self.assertIsNone(public_url(url))
                doc = specimen()
                doc['sources'][0]['url'] = url
                doc['media'][0]['url'] = url
                self.assertIs(validate_dossier(doc), doc)
                self.assertEqual(doc['sources'][0]['url'], url)
                self.assertEqual(doc['media'][0]['url'], url)

    def test_bracketed_source_hosts_reject_surrounding_authority_text(self):
        for url in ('https://[::ffff:8.8.8.8]suffix:443/source',
                    'https://prefix[::ffff:8.8.8.8]:443/source'):
            with self.subTest(source_url=url):
                self.rejected(lambda d: d['sources'][0].update(url=url))
            with self.subTest(media_url=url):
                self.rejected(lambda d: d['media'][0].update(url=url))

    def test_bracketed_source_hosts_preserve_valid_ports_and_private_address_policy(self):
        for suffix in ('', ':', ':0', ':443', ':0443', ':8443', ':65535'):
            url = f'https://[::ffff:8.8.8.8]{suffix}/source%20notes?loc=%31#figure-1'
            with self.subTest(url=url):
                doc = specimen()
                doc['sources'][0]['url'] = url
                doc['media'][0]['url'] = url
                self.assertIs(validate_dossier(doc), doc)
                self.assertEqual(doc['sources'][0]['url'], url)
                self.assertEqual(doc['media'][0]['url'], url)
        for url in ('https://[::ffff:127.0.0.1]:443/source',
                    'https://[::ffff:192.168.1.1]:/source',
                    'https://[2606:4700:4700::1111]/source'):
            with self.subTest(existing_rejected_url=url):
                with self.assertRaises(ValueError):
                    public_url(url)

    def test_source_metadata_requires_nonempty_text_before_publication(self):
        for field in ('title', 'url', 'locator', 'access', 'revision', 'rights', 'agent_processing'):
            for value in ('', None, False, True, 7, [], ['Figure 1'], {}, {'figure': 1}):
                with self.subTest(field=field, value=value):
                    doc = specimen()
                    doc['sources'][0][field] = value
                    with self.assertRaises(ValueError):
                        validate_dossier(doc)

    def test_nonfinite_and_boolean_measurements_are_not_registered_values(self):
        for value in [float('nan'), float('inf'), True]:
            with self.subTest(video_value=value):
                self.rejected(lambda d: d['media'][0]['time'].update(
                    video={'start_seconds': 0, 'end_seconds': value}))
            with self.subTest(coordinate_value=value):
                doc = specimen()
                doc['media'][0]['status']['spatial'] = 'source_reported'
                doc['media'][0]['place'].update(coordinates=[value, 35])
                with self.assertRaises(ValueError):
                    validate_dossier(doc)

    def test_private_notes_do_not_hide_inside_public_nested_metadata(self):
        mutations = [
            lambda d: d['provenance'].update(private_note='Synthetic private curator note.'),
            lambda d: d['media'][0]['time'].update(
                capture={'label': 'Uncalibrated source label', 'private_note': 'Synthetic private note.'}),
            lambda d: d['media'][0].update(
                review={'coverage': 'Synthetic sample.', 'private_note': 'Synthetic private note.'}),
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(location=index):
                self.rejected(mutate)

    def test_reconstruction_coverage_cannot_outgrow_the_registered_evidence(self):
        self.rejected(lambda d: d.update(coverage='Reconstruction'))

    def test_selective_loading_limit_is_a_byte_budget(self):
        doc = specimen()
        doc['summary'] = '\u6e2c' * 70000
        self.assertGreater(len(json.dumps(doc, ensure_ascii=False).encode('utf-8')), 200000)
        with self.assertRaises(ValueError):
            validate_dossier(doc)

    def test_input_revision_changes_identity_without_rewriting_prior_projection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'research').mkdir()
            config = [{'id': 'synthetic-contract', 'title': 'Synthetic contract',
                       'coverage': 'Dossier', 'summary': 'Synthetic revision 1.',
                       'records': [], 'routes': [], 'sources': []}]
            source_path = root / 'research/archive-dossiers.json'
            source_path.write_text(json.dumps(config), encoding='utf-8')
            (root / 'research/record-aliases.json').write_text('{}', encoding='utf-8')
            first = dossiers(root)[0]
            old_bytes = source_path.read_bytes()
            self.assertEqual(first['provenance']['inputs']['research/archive-dossiers.json'],
                             hashlib.sha256(old_bytes).hexdigest())
            config[0]['summary'] = 'Synthetic revision 2.'
            source_path.write_text(json.dumps(config), encoding='utf-8')
            second = dossiers(root)[0]
            self.assertNotEqual(digest(first), digest(second))
            self.assertEqual(first['summary'], 'Synthetic revision 1.')
            self.assertEqual(second['summary'], 'Synthetic revision 2.')
            self.assertEqual(digest(second), digest(dossiers(root)[0]))


if __name__ == '__main__':
    unittest.main()
