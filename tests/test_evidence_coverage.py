import copy
import hashlib
import html
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from atlas.archive import dossiers
from atlas.evidence_coverage import ROOT, coverage_rows, layer_references, publication, render_page, reviewed
from atlas.event_package import build_event_packages, replay_inputs, reviewed_index, utc, validate_appearance_timeline


class EvidenceCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']:doc for doc in dossiers(ROOT)}

    def test_layers_retain_current_replay_chronology_and_unknown_states(self):
        rows = {row['event']['id']:row for row in coverage_rows()}
        self.assertEqual(set(rows),set(self.docs))
        self.assertEqual(rows['el-reno-2013']['layers']['geography']['state'],'replay')
        self.assertEqual(rows['el-reno-2013']['layers']['damage']['state'],'survey')
        self.assertEqual(rows['el-reno-2013']['layers']['footage']['state'],'samples')
        self.assertEqual(len(rows['el-reno-2013']['layers']['footage']['items']),7)
        self.assertEqual(rows['joplin-2011']['layers']['chronology']['state'],'documentary')
        for identifier in ('joplin-2011','blackwell-1955','tuscaloosa-birmingham-2011'):
            self.assertEqual(rows[identifier]['layers']['geography']['state'],'context')
            self.assertEqual(rows[identifier]['layers']['footage']['state'],'not_linked')
        for row in rows.values():
            self.assertEqual(row['layers']['appearance']['state'],'not_admitted')

    def test_storm_photo_is_context_and_aftermath_does_not_join_appearance(self):
        rows = {row['event']['id']:row for row in coverage_rows()}
        linked = {item['id'] for _,item in rows['joplin-2011']['layers']['appearance']['items']}
        self.assertEqual(linked,{'friskey-joplin-storm'})
        self.assertEqual(rows['tuscaloosa-birmingham-2011']['layers']['appearance']['items'],[])
        self.assertNotIn('nws-joplin-aftermath',linked)
        self.assertEqual(rows['blackwell-1955']['layers']['gaps']['state'],'disputed')

    def test_layer_membership_rejects_foreign_references_and_changed_source_accounts(self):
        doc = self.docs['joplin-2011']
        original = json.loads((ROOT/'exhibits/joplin-2011/layers.json').read_text())
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root/'exhibits/joplin-2011/layers.json'
            target.parent.mkdir(parents=True)
            for case in ('foreign-event','missing-item','changed-dossier','boolean-version'):
                data = copy.deepcopy(original)
                if case == 'foreign-event': data['event_id'] = 'blackwell-1955'
                elif case == 'missing-item': data['layers']['damage']['media'].append('nws-blackwell-smoothed-map')
                elif case == 'changed-dossier': data['dossier_sha256'] = '0'*64
                else: data['schema_version'] = True
                target.write_text(json.dumps(data))
                with self.subTest(case=case),self.assertRaises(ValueError):
                    layer_references(root,doc)
            target.write_text(json.dumps(original))
            changed = copy.deepcopy(doc)
            changed['observations'][0]['account'] += ' Changed account with the same identifier.'
            with self.assertRaisesRegex(ValueError,'changed dossier'):
                layer_references(root,changed)

    def test_missing_classification_does_not_promote_available_bundle_survey(self):
        with patch('atlas.evidence_coverage.layer_references',return_value=None):
            rows = coverage_rows()
        el_reno = next(row for row in rows if row['event']['id']=='el-reno-2013')
        self.assertEqual(el_reno['layers']['geography']['state'],'replay')
        self.assertEqual(el_reno['layers']['damage']['state'],'not_classified')
        self.assertEqual(el_reno['layers']['appearance']['items'],[])

    def test_changed_survey_cannot_inherit_reviewed_coverage(self):
        original = layer_references
        def changed(root,doc):
            refs = original(root,doc)
            if doc['id'] == 'el-reno-2013': refs['survey']['sha256'] = '0'*64
            return refs
        with patch('atlas.evidence_coverage.layer_references',side_effect=changed):
            with self.assertRaisesRegex(ValueError,'survey coverage differs'):
                coverage_rows()

    def test_research_leads_and_unavailable_items_are_not_promoted(self):
        item = copy.deepcopy(self.docs['joplin-2011']['media'][0])
        for change in ({'intake':'candidate'},{'availability':'unavailable'},{'assertion':'not_researched'}):
            candidate = copy.deepcopy(item)
            candidate['status'].update(change)
            self.assertEqual(reviewed([candidate]),[])

    def test_generated_view_is_exact_and_contains_source_and_no_script_routes(self):
        raw = publication()['coverage.html']
        self.assertEqual(raw,(ROOT/'web/coverage.html').read_bytes())
        text = raw.decode('utf-8')
        self.assertIn('<noscript>',text)
        for doc in self.docs.values():
            self.assertIn(doc['id'],text)
        self.assertIn('Source links only',text)
        self.assertIn('Hosting basis recorded',text)
        self.assertIn('Inspection scope, retained from source card:',text)
        self.assertNotIn('<iframe',text)
        self.assertNotIn('<canvas',text)

    def test_source_text_is_escaped_and_dossier_route_keeps_revision(self):
        rows = copy.deepcopy(coverage_rows())
        row = rows[0]
        row['event']['title'] = '<script>untrusted title</script>'
        _,item = row['layers']['footage']['items'][0]
        item['account'] = '<img src=x onerror=untrusted>'
        raw = render_page(rows).decode('utf-8')
        self.assertNotIn('<script>untrusted title',raw)
        self.assertNotIn('<img src=x',raw)
        self.assertIn('&lt;script&gt;untrusted title',raw)
        self.assertIn('&lt;img src=x',raw)
        self.assertIn('revision='+row['dossier_sha256'],raw)

    def test_gaps_include_media_uncertainties_without_promoting_assertions(self):
        rows = {row['event']['id']:row for row in coverage_rows()}
        gaps = rows['joplin-2011']['layers']['gaps']
        items = {item['id']:item for _,item in gaps['items']}
        self.assertEqual(set(items),{'friskey-joplin-storm','nws-joplin-aftermath',
                                    'usace-joplin-temporary-housing','nist-joplin-radar-sequence',
                                    'barbe-joplin-temporary-care-phases','mercy-joplin-temporary-care-phases'})
        self.assertTrue(all(item['status']['assertion']=='source_reported' for item in items.values()))
        self.assertEqual(gaps['state'],'unknown')
        self.assertIn('revision='+rows['joplin-2011']['dossier_sha256'],gaps['routes'][0][1])

    def test_static_provenance_retains_source_revision_item_scope_and_clock_roles(self):
        raw = publication()['coverage.html'].decode('utf-8')
        self.assertIn('Source time or date label',raw)
        self.assertNotIn('Time: Source clock label',raw)
        self.assertIn('Generating this coverage does not repeat source inspection.',raw)
        self.assertNotIn(self.docs['tuscaloosa-birmingham-2011']['reconstruction']['limits'],raw)
        for identifier in ('ER13-HARK-PHOTO-604','photogrammetry-figure-samples'):
            doc=self.docs['el-reno-2013']
            item=next(item for item in doc['observations']+doc['media'] if item['id']==identifier)
            source=next(source for source in doc['sources'] if source['id']==item['source_id'])
            self.assertIn(html.escape(source['revision']),raw)
            if isinstance(item['review'],str):self.assertIn(html.escape(item['review']),raw)
            else:
                for value in item['review'].values():
                    if isinstance(value,str):self.assertIn(html.escape(value),raw)
        self.assertIn('camera metadata with unverified clock',raw)
        self.assertIn('Capture time or date',raw)


class PhotoEvidenceCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']:doc for doc in dossiers(ROOT)}
        cls.packages = build_event_packages(ROOT, replay_inputs(ROOT))
        cls.index = reviewed_index(ROOT)
        text = (ROOT/'tests/photo-observations.test.mjs').read_text(encoding='utf-8')
        match = __import__('re').search(r'/\* PHOTO_CASES\r?\n([\s\S]*?)\r?\nPHOTO_CASES \*/', text)
        if match is None:
            raise ValueError('Shared synthetic photo cases are missing')
        cls.spec = json.loads(match.group(1))

    def synthetic_rows(self, event_id, *, registered=False):
        spec = self.spec
        packages = copy.deepcopy(self.packages)
        index = copy.deepcopy(self.index)
        config = copy.deepcopy(packages['events/el-reno-2013.json'])
        original_bundle = json.loads(packages[config['bundle']])
        origin = utc('2001-01-01T12:00:00Z')
        def shifted(value):
            return (origin+(utc(value)-utc(spec['clock']['start_utc']))).isoformat().replace('+00:00','Z')
        clock = copy.deepcopy(spec['clock'])
        clock.update(start_utc=shifted(spec['clock']['start_utc']),
                     end_utc=shifted(spec['clock']['end_utc']),
                     basis='Authored coverage fixture clock. No historical alignment.')
        source = copy.deepcopy(spec['source'])
        source['id'] = 'synthetic-coverage-publication'
        source['title'] = 'Synthetic <script>resource title</script>'
        source['url'] = 'https://example.test/coverage-fixture?edition=1&resource=synthetic'
        sequences = []
        for descriptor in spec['sequences']:
            samples = []
            for entry in descriptor['samples']:
                sample = copy.deepcopy(spec['sample'])
                sample.update(id='coverage-'+entry['id'], source_id=source['id'],
                              exposure_id='coverage-'+entry['exposure_id'],
                              reported_utc=shifted(entry['reported_utc']))
                sample['image'].update(
                    panel_locator='Synthetic <panel> '+entry['panel_locator'],
                    original_url=source['url']+'#'+sample['exposure_id'],
                )
                samples.append(sample)
            sequences.append({'id':'coverage-'+descriptor['id'],
                              'basis':descriptor['basis'], 'samples':samples})
        timeline = {'schema_version':2, 'event':event_id, 'windows':[],
                    'photo_sources':[source], 'photo_sequences':sequences}
        sources = []
        if registered:
            sources = [copy.deepcopy(spec['registered_source'])]
            window = copy.deepcopy(spec['registered_window'])
            window['start_utc'] = shifted(window['start_utc'])
            window['end_utc'] = shifted(window['end_utc'])
            for anchor in window['registration']['timing']['anchors']:
                anchor['utc'] = shifted(anchor['utc'])
            timeline['windows'] = [window]
        validate_appearance_timeline(timeline, event_id, utc(clock['start_utc']),
                                     utc(clock['end_utc']), sources)
        provenance = {'url':'https://example.test/synthetic-coverage-geography', 'sha256':'a'*64}
        def properties(role, **extra):
            return {'role':role, 'source_url':provenance['url'],
                    'source_sha256':provenance['sha256'], **extra}
        features = [
            {'geometry':{'type':'Point','coordinates':[0,0]},
             'properties':properties('published_center_position',utc=clock['start_utc'],
                                     display_time='Synthetic start')},
            {'geometry':{'type':'Point','coordinates':[0.02,0.02]},
             'properties':properties('published_center_position',utc=clock['end_utc'],
                                     display_time='Synthetic end')},
            {'geometry':{'type':'LineString','coordinates':[[0,0],[0.02,0.02]]},
             'properties':properties('published_center_path')},
            {'geometry':{'type':'Polygon','coordinates':[[[0,0],[0.02,0],[0.02,0.02],[0,0]]]},
             'properties':properties('published_tornado_outline')},
        ]
        bundle = {
            'exhibit':{'id':event_id},
            'geometry':{'source':provenance,'features':features},
            'timeline_media':{'event':event_id},
            'footage':{'event':event_id,'sources':sources,'anchors':[]},
            'appearance_timeline':timeline,
        }
        if event_id == 'el-reno-2013':
            bundle['survey'] = copy.deepcopy(original_bundle['survey'])
        raw = json.dumps(bundle, ensure_ascii=False).encode('utf-8')
        config.update(schema_version=2,event_id=event_id,bundle='synthetic-coverage-photo.json',
                      bundle_sha256=hashlib.sha256(raw).hexdigest(),clock=clock,
                      geography_source=provenance)
        config['coverage']['appearance'] = 'bounded_timeline'
        packages[config['bundle']] = raw
        packages[f'events/{event_id}.json'] = config
        event = next(row for row in index['events'] if row['id'] == event_id)
        event.update(title='Synthetic coverage fixture for '+event_id,
                     replay=f'events/{event_id}.json',chronology=None)
        docs = copy.deepcopy(list(self.docs.values()))
        if registered:
            next(doc for doc in docs if doc['id'] == event_id)['reconstruction']['appearance'] = 'registered'
        def existing_references(root, doc):
            return layer_references(root, self.docs[doc['id']])
        with patch('atlas.evidence_coverage.reviewed_index',return_value=index), \
                patch('atlas.evidence_coverage.replay_inputs',return_value={}), \
                patch('atlas.evidence_coverage.build_event_packages',return_value=packages) as builder, \
                patch('atlas.evidence_coverage.dossiers',return_value=docs), \
                patch('atlas.evidence_coverage.layer_references',side_effect=existing_references):
            rows = coverage_rows()
        builder.assert_called_once_with(ROOT,{})
        return rows

    def test_photo_only_coverage_retains_unregistered_dossier_and_existing_context(self):
        rows = self.synthetic_rows('joplin-2011')
        row = next(row for row in rows if row['event']['id'] == 'joplin-2011')
        appearance = row['layers']['appearance']
        self.assertEqual(row['doc']['reconstruction']['appearance'],'unregistered')
        self.assertEqual(appearance['state'],'photo_samples')
        self.assertEqual(appearance['registered_interval_count'],0)
        self.assertEqual(appearance['photo_sample_count'],3)
        self.assertEqual(appearance['photo_sequence_count'],2)
        self.assertEqual(row['layers']['footage']['state'],'not_linked')
        self.assertEqual({item['id'] for _,item in appearance['items']},{'friskey-joplin-storm'})
        self.assertIn('does not repeat inspection',appearance['basis'])
        self.assertIn("do not change the dossier's appearance classification",appearance['basis'])
        single,pair = appearance['photo_sequences']
        self.assertEqual(len(single['samples']),1)
        self.assertEqual(len(pair['samples']),2)
        self.assertNotIn('duration_seconds',single)
        for sequence in appearance['photo_sequences']:
            for sample in sequence['samples']:
                query = parse_qs(urlparse(sample['player_url']).query)
                self.assertEqual(query['event'],['joplin-2011'])
                self.assertEqual(query['appearance_view'],['photo'])
                self.assertEqual(query['appearance_photo'],[sequence['id']])
                expected = (utc(sample['reported_utc'])-utc('2001-01-01T12:00:00Z')).total_seconds()
                self.assertEqual(float(query['t'][0]),expected)
                self.assertNotIn('footage',query)
                self.assertIsNone(sample['shape'])
                self.assertIsNone(sample['extent'])
        raw = render_page(rows).decode('utf-8')
        self.assertIn('data-state="photo_samples"',raw)
        self.assertIn('Before, between and after samples, photographic appearance remains unknown.',raw)
        self.assertNotIn('<iframe',raw)
        self.assertNotIn('<canvas',raw)

    def test_mixed_coverage_keeps_video_classification_counts_and_dossier_routes(self):
        rows = self.synthetic_rows('el-reno-2013',registered=True)
        row = next(row for row in rows if row['event']['id'] == 'el-reno-2013')
        appearance = row['layers']['appearance']
        self.assertEqual(appearance['state'],'registered')
        self.assertEqual(appearance['label'],'Registered video intervals and separate photo instants')
        self.assertEqual(appearance['registered_interval_count'],1)
        self.assertEqual(appearance['photo_sample_count'],3)
        self.assertEqual(appearance['photo_sequence_count'],2)
        self.assertEqual(row['layers']['footage']['state'],'samples')
        self.assertEqual(len(row['layers']['footage']['items']),7)
        self.assertEqual(row['layers']['damage']['state'],'survey')
        raw = render_page(rows).decode('utf-8')
        self.assertIn('revision='+row['dossier_sha256'],raw)
        self.assertIn('These photo declarations supply no continuously registered appearance interval.',raw)
        for source in self.docs['el-reno-2013']['sources']:
            if source['id'] in {item['source_id'] for _,item in row['layers']['footage']['items']}:
                self.assertIn(html.escape(source['url']),raw)

    def test_photo_resource_panel_and_declared_text_are_escaped(self):
        rows = self.synthetic_rows('joplin-2011')
        row = next(row for row in rows if row['event']['id'] == 'joplin-2011')
        sample = row['layers']['appearance']['photo_sequences'][0]['samples'][0]
        sample['characteristics'][0] = 'Synthetic <img src=x onerror=untrusted> characteristic'
        sample['boundary_limits'][0] = 'Synthetic <script>boundary</script>'
        raw = render_page(rows).decode('utf-8')
        self.assertNotIn('<script>resource title',raw)
        self.assertNotIn('<script>boundary',raw)
        self.assertNotIn('<img src=x',raw)
        self.assertNotIn('<panel>',raw)
        self.assertIn('&lt;script&gt;resource title&lt;/script&gt;',raw)
        self.assertIn('&lt;script&gt;boundary&lt;/script&gt;',raw)
        self.assertIn('&lt;img src=x',raw)
        self.assertIn('&lt;panel&gt;',raw)
        self.assertIn(html.escape(sample['source']['url']),raw)
        self.assertIn(html.escape(sample['image']['original_url']),raw)
        self.assertIn('Unquantified.',raw)
        self.assertIn(html.escape(sample['source']['rights']['basis']),raw)
