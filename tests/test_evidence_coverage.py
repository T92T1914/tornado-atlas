import copy
import hashlib
import html
import json
import re
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from atlas.archive import digest, dossiers
from atlas.evidence_coverage import ROOT, coverage_rows, layer_references, publication, published_disputes, render_page, reviewed
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
        self.assertEqual(len(rows['el-reno-2013']['layers']['footage']['items']),14)
        self.assertEqual(rows['joplin-2011']['layers']['chronology']['state'],'documentary')
        for identifier in ('joplin-2011','blackwell-1955','tuscaloosa-birmingham-2011'):
            self.assertEqual(rows[identifier]['layers']['geography']['state'],'context')
            self.assertEqual(rows[identifier]['layers']['footage']['state'],'context')
            self.assertTrue(all(item['status']['temporal'] == 'unregistered' for _, item in rows[identifier]['layers']['footage']['items']))
        appearance=rows['el-reno-2013']['layers']['appearance']
        self.assertEqual(appearance['state'],'photo_samples')
        self.assertEqual(appearance['photo_sample_count'],8)
        self.assertEqual(appearance['photo_sequence_count'],4)
        self.assertEqual(appearance['partial_form_sample_count'],4)
        self.assertEqual(appearance['partial_margin_sample_count'],1)
        self.assertEqual(appearance['partial_condensation_sample_count'],3)
        sequences=appearance['photo_sequences']
        self.assertEqual([sequence['id'] for sequence in sequences],['nolte-reported-stills','wakimoto-visible-margin','wakimoto-visible-condensation','wakimoto-early-extension'])
        margins=sequences[1]['samples']
        self.assertEqual([sample['reported_utc'] for sample in margins],['2013-05-31T23:25:01Z','2013-05-31T23:25:09Z'])
        self.assertEqual(margins[0]['partial_form']['kind'],'visible_condensation_region')
        self.assertEqual(margins[1]['partial_form']['kind'],'visible_margin')
        self.assertEqual(len(margins[0]['partial_form']['points']),8)
        self.assertEqual(len(margins[1]['partial_form']['points']),17)
        self.assertNotEqual(margins[0]['partial_form']['points'],margins[1]['partial_form']['points'])
        condensation=sequences[2]['samples']
        self.assertEqual(len(condensation),1)
        self.assertEqual(condensation[0]['reported_utc'],'2013-05-31T23:24:41Z')
        self.assertEqual(condensation[0]['partial_form']['kind'],'visible_condensation_region')
        self.assertEqual(condensation[0]['partial_form']['closure'],'display_support_only')
        self.assertEqual(condensation[0]['partial_form']['completeness'],'partial')
        self.assertEqual(len(condensation[0]['partial_form']['points']),8)
        early=sequences[3]['samples']
        self.assertEqual(len(early),1)
        self.assertEqual(early[0]['id'],'wakimoto-2016-230510')
        self.assertEqual(early[0]['reported_utc'],'2013-05-31T23:05:10Z')
        self.assertIsNone(early[0]['timing']['uncertainty_seconds'])
        for sequence in sequences:
            for sample in sequence['samples']:
                self.assertIsNone(sample['shape']);self.assertIsNone(sample['extent'])
                for field in ('coordinates','bearing_degrees','pitch_degrees','roll_degrees','position_uncertainty_m','orientation_uncertainty_degrees','lens_calibration'):
                    self.assertIsNone(sample['viewpoint'][field])
        self.assertTrue(all(sample['partial_form'] is None for sample in sequences[0]['samples']))
        self.assertEqual(appearance['registered_interval_count'],0)
        for identifier in ('joplin-2011','blackwell-1955','tuscaloosa-birmingham-2011'):
            self.assertEqual(rows[identifier]['layers']['appearance']['state'],'not_admitted')


    def test_mixed_video_coverage_keeps_each_record_clock_and_source_route(self):
        rows = coverage_rows()
        row = next(row for row in rows if row['event']['id'] == 'el-reno-2013')
        footage = row['layers']['footage']
        expected = [item for item in reviewed(self.docs['el-reno-2013']['media'])
                    if item['kind'] == 'video']
        self.assertEqual(footage['items'], [('media', item) for item in expected])
        self.assertEqual(footage['state'], 'samples')
        self.assertEqual(footage['label'], 'Discrete video samples and separate documentary context')
        self.assertIn('7 linked video records retain discrete time anchors.', footage['basis'])
        self.assertIn('7 additional video records supply documentary context', footage['basis'])
        self.assertIn('do not inherit', footage['basis'])
        clip = next(item for _, item in footage['items'] if item['id']=='bohac-opening-documentary-motion')
        self.assertEqual(clip['parent'],'bohac-archived-extended-film')
        self.assertEqual(clip['status']['temporal'],'unregistered')
        self.assertIsNone(clip['time']['alignment'])
        self.assertEqual(clip['time']['video'],{'start_seconds':0,'end_seconds':4})
        untimed = next(item for _, item in footage['items']
                       if item['id'] == 'snyder-genesis-three-samples')
        self.assertEqual(untimed['status']['temporal'], 'unregistered')
        self.assertEqual(untimed['status']['spatial'], 'unregistered')
        self.assertEqual(untimed['status']['rights'], 'links_only')
        self.assertIsNone(untimed['place']['coordinates'])
        for role in ('event', 'capture', 'video', 'alignment'):
            self.assertIsNone(untimed['time'][role])
        text = render_page([row]).decode('utf-8')
        section = re.search(r'<section class="coverage-layer" data-layer="footage"[\s\S]*?</section>',
                            text).group()
        self.assertEqual(section.count('Time: Discrete time anchor'), 7)
        self.assertEqual(section.count('Time: Unregistered'), 5)
        self.assertEqual(section.count('Time: Source time or date label'), 2)
        for _, item in footage['items']:
            href = ('dossier.html?event=el-reno-2013&revision=' + row['dossier_sha256'] +
                    '&media=' + item['id'] + '#media-' + item['id'])
            self.assertIn(html.escape(href), section)
        self.assertEqual(row['layers']['appearance']['registered_interval_count'], 0)
        self.assertEqual(row['layers']['appearance']['photo_sample_count'], 8)
        self.assertEqual(self.docs['el-reno-2013']['reconstruction']['appearance'], 'unregistered')

    def test_unanchored_video_fixture_remains_context(self):
        # Authored aggregate fixture, without changing any historical source record.
        docs = copy.deepcopy(list(self.docs.values()))
        doc = next(doc for doc in docs if doc['id'] == 'el-reno-2013')
        doc['media'] = [item for item in doc['media']
                        if item['kind'] != 'video' or item['status']['temporal'] != 'discrete_anchor']
        def existing_references(root, candidate):
            return layer_references(root, self.docs[candidate['id']])
        with patch('atlas.evidence_coverage.dossiers', return_value=docs), \
                patch('atlas.evidence_coverage.layer_references', side_effect=existing_references):
            row = next(row for row in coverage_rows() if row['event']['id'] == doc['id'])
        footage = row['layers']['footage']
        self.assertEqual(footage['state'], 'context')
        self.assertEqual(footage['label'], 'Recorded video context')
        self.assertEqual([item['id'] for _, item in footage['items']], ['snyder-genesis-three-samples', 'bohac-archived-extended-film', 'conrady-roadside-opening', 'bohac-short-visibility-film', 'nolte-timecoded-context-231037', 'nolte-timecoded-context-231059', 'bohac-opening-documentary-motion'])
        self.assertNotIn('retain discrete time anchors', footage['basis'])
        section = re.search(r'<section class="coverage-layer" data-layer="footage"[\s\S]*?</section>',
                            render_page([row]).decode('utf-8')).group()
        self.assertNotIn('Time: Discrete time anchor', section)
        self.assertEqual(section.count('Time: Unregistered'), 5)
        self.assertEqual(section.count('Time: Source time or date label'), 2)

    def test_storm_photo_is_context_and_aftermath_does_not_join_appearance(self):
        rows = {row['event']['id']:row for row in coverage_rows()}
        linked = {item['id'] for _,item in rows['joplin-2011']['layers']['appearance']['items']}
        self.assertEqual(linked,{'friskey-joplin-storm'})
        appearance = rows['tuscaloosa-birmingham-2011']['layers']['appearance']['items']
        self.assertEqual([item['id'] for _, item in appearance], [
            'rosolowski-2022-panel-a', 'rosolowski-2022-panel-b',
            'rosolowski-2022-panel-c', 'rosolowski-2022-panel-d',
            'oliveira-2019-tornado-video-frames'])
        for kind, item in appearance[:4]:
            self.assertEqual(kind, 'observations')
            self.assertEqual(item['source_id'], 'oliveira-2022-trailing-vortices')
            self.assertEqual(item['status']['assertion'], 'source_reported')
            self.assertEqual(item['status']['rights'], 'links_only')
            self.assertIsNone(item['time']['capture'])
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['time']['video'])
            self.assertIsNone(item['place']['coordinates'])
        self.assertEqual(rows['tuscaloosa-birmingham-2011']['layers']['appearance']['state'], 'not_admitted')
        self.assertNotIn('nws-joplin-aftermath',linked)
        self.assertEqual(rows['blackwell-1955']['layers']['gaps']['state'],'disputed')

    def test_blackwell_online_previews_keep_damage_gap_membership_and_pinned_routes(self):
        doc = self.docs['blackwell-1955']
        row = next(row for row in coverage_rows() if row['event']['id'] == doc['id'])
        previews = {'ou-flora62-online-preview', 'ou-flora67-online-preview'}
        expected = {
            'damage': {'blackwell-debris-directions', 'ou-flora62-railroad-yard-caption',
                       'ou-flora67-fire-response-caption'} | previews,
            'gaps': {'blackwell-clocks', 'blackwell-injuries', 'ou-flora62-railroad-yard-caption',
                     'ou-flora67-fire-response-caption'} | previews,
        }
        article = re.search(r'<article class="coverage-event" data-event="blackwell-1955">([\s\S]*?)</article>',
                            publication()['coverage.html'].decode('utf-8'))
        self.assertIsNotNone(article)
        for layer, identifiers in expected.items():
            with self.subTest(layer=layer):
                items = row['layers'][layer]['items']
                self.assertEqual({item['id'] for kind, item in items if kind == 'observations'}, identifiers)
                self.assertEqual({item['id'] for kind, item in items if kind == 'media'},
                                 {'nws-blackwell-smoothed-map'} if layer == 'damage' else set())
                section = re.search(r'<section class="coverage-layer" data-layer="' + layer +
                                    r'"[^>]*>([\s\S]*?)</section>', article.group(1))
                self.assertIsNotNone(section)
                links = [urlparse(html.unescape(href)) for href in
                         re.findall(r'<h4><a href="([^"]+)">', section.group(1))]
                for identifier in previews:
                    item = next(item for kind, item in items if item['id'] == identifier)
                    self.assertEqual(item, next(item for item in doc['observations'] if item['id'] == identifier))
                    matches = [link for link in links if parse_qs(link.query).get('observation') == [identifier]]
                    self.assertEqual(len(matches), 1)
                    link = matches[0]
                    self.assertEqual(link.path, 'dossier.html')
                    self.assertEqual(parse_qs(link.query), {'event': ['blackwell-1955'],
                                     'revision': [digest(doc)], 'observation': [identifier]})
                    self.assertEqual(link.fragment, 'observation-' + identifier)
        self.assertEqual(row['layers']['appearance']['items'], [])
        basis = row['layers']['gaps']['basis']
        for anchor in ('October 6, 2026', 'October 10, 2026', 'Complete original-print coverage',
                       'remain unresolved', 'Permission to host or alter the images is not established'):
            self.assertIn(anchor, basis)

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

    def test_published_disagreement_selection_is_separate_from_positive_admission(self):
        item = next(item for item in self.docs['moore-2013']['observations']
                    if item['id'] == 'preliminary-precursor-difference')
        self.assertEqual(item['status']['intake'], 'published')
        self.assertEqual(item['status']['assertion'], 'disputed')
        self.assertEqual(item['status']['availability'], 'disputed')
        self.assertEqual(published_disputes([item]), [item])
        self.assertEqual(reviewed([item]), [])
        available = copy.deepcopy(item)
        available['status']['availability'] = 'reviewed_available'
        self.assertEqual(published_disputes([available]), [available])
        for change in ({'intake': 'candidate'}, {'availability': 'unavailable'},
                       {'availability': 'documented_no_result'},
                       {'assertion': 'not_researched'}, {'assertion': 'source_reported'}):
            candidate = copy.deepcopy(item)
            candidate['status'].update(change)
            with self.subTest(change=change):
                self.assertEqual(published_disputes([candidate]), [])
        # Disputed availability alone cannot admit an ordinary claim or media item.
        for kind in ('observations', 'media'):
            candidate = copy.deepcopy(self.docs['moore-2013'][kind][0])
            candidate['status']['availability'] = 'disputed'
            candidate['status']['assertion'] = 'source_reported'
            with self.subTest(kind=kind):
                self.assertEqual(published_disputes([candidate]), [])
                self.assertEqual(reviewed([candidate]), [])

    def test_moore_coverage_links_existing_outcomes_and_unresolved_source_roles(self):
        doc = self.docs['moore-2013']
        identity = '5ed36647a0e6141f8ddeeee30ef7be9e7bb6332613ed86428b3b9b5536b25e85'
        self.assertEqual(digest(doc), identity)
        self.assertEqual(len(doc['observations']), 14)
        raw = (ROOT/'web/archive/moore-2013-b871ef828cd8a1c475bc.json').read_bytes()
        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()),
                         (39046, 'c15c3c827585eec744ef91fb760d6b4a989e39cbc9e77c3b35b61049764aa7e8'))
        refs = layer_references(ROOT, doc)
        self.assertIsNone(refs['survey'])
        for layer in ('geography', 'appearance'):
            self.assertEqual(refs[layer]['observations'], [])
            self.assertEqual(refs[layer]['media'], [])
        expected_damage = {
            'facility-reconnaissance-scope', 'medical-center-function',
            'plaza-reported-refuge-change', 'plaza-roof-wall-performance',
            'briarwood-400-refuge-envelope',
        }
        expected_media = {'moore-briarwood-survey', 'moore-medical-center-survey'}
        expected_radar = {'moore-ktlx-reflectivity-loop', 'moore-ktlx-storm-relative-velocity-loop'}
        radar_row = next(value for value in coverage_rows() if value['event']['id'] == 'moore-2013')
        self.assertEqual(radar_row['layers']['radar']['state'], 'context')
        self.assertEqual({item['id'] for kind, item in radar_row['layers']['radar']['items']}, expected_radar)
        for kind, item in radar_row['layers']['radar']['items']:
            self.assertEqual(kind, 'media')
            self.assertEqual(item['kind'], 'radar')
            self.assertIsNone(item['time']['alignment'])
            self.assertIsNone(item['place']['coordinates'])
            self.assertEqual(item['status']['spatial'], 'unregistered')
        expected_gaps = {'reported-siren-clock', 'briarwood-rating-revision',
                         'preliminary-precursor-difference', 'survey-photo-source-group'}
        self.assertEqual(set(refs['damage']['observations']), expected_damage)
        self.assertEqual(set(refs['damage']['media']), expected_media)
        self.assertEqual(set(refs['gaps']['observations']), expected_gaps)
        self.assertEqual(refs['gaps']['media'], [])
        row = next(row for row in coverage_rows() if row['event']['id'] == 'moore-2013')
        self.assertEqual(row['layers']['damage']['state'], 'context')
        self.assertEqual(row['layers']['gaps']['state'], 'disputed')
        self.assertEqual(row['layers']['geography']['state'], 'not_classified')
        self.assertEqual(row['layers']['appearance']['state'], 'not_admitted')
        self.assertEqual(row['layers']['appearance']['items'], [])
        self.assertEqual(row['layers']['chronology']['state'], 'not_admitted')
        self.assertEqual({item['id'] for kind, item in row['layers']['damage']['items']
                          if kind == 'observations'}, expected_damage)
        self.assertEqual({item['id'] for kind, item in row['layers']['damage']['items']
                          if kind == 'media'}, expected_media)
        self.assertEqual({item['id'] for kind, item in row['layers']['gaps']['items']}, expected_gaps)
        for layer in ('damage', 'gaps'):
            for kind, item in row['layers'][layer]['items']:
                original = next(value for value in doc[kind] if value['id'] == item['id'])
                self.assertEqual(item, original)
                self.assertIsNone(item['time']['alignment'])
                self.assertIsNone(item['place']['coordinates'])
        text = render_page([row]).decode('utf-8')
        for identifier in expected_damage | expected_gaps | expected_media:
            kind = 'media' if identifier in expected_media else 'observation'
            href = ('dossier.html?event=moore-2013&revision=' + identity + '&' + kind +
                    '=' + identifier + '#' + kind + '-' + identifier)
            self.assertIn(html.escape(href), text)
        for locator in ('printed page 29 / PDF page 53', 'printed page 31 / PDF page 55',
                        'printed page 36 / PDF page 60', 'printed page 38 / PDF page 62'):
            self.assertIn(locator, text)
        for statement in ('thunderstorm wind', 'earlier short-lived EF0 tornado',
                          'not synchronized with the weather clock',
                          'not registered to Building 400', 'whole-track maximum'):
            self.assertIn(statement, text)
        for identifier, asset, size, sha in (
                ('moore-briarwood-survey', 'assets/moore-2013/IMG_2314-800.jpg', 410330,
                 'd53b38069c63ec7508cece9e4a70b11fabf45aad090fa072bc7f115efd2ac7e6'),
                ('moore-medical-center-survey', 'assets/moore-2013/IMG_9287-800.jpg', 339582,
                 'f10b6b33fbcecd2c228632d2d681bbef47e58876246b753a04721dda3a58c6bb')):
            item = next(item for item in doc['media'] if item['id'] == identifier)
            self.assertEqual(item['transformation']['asset'], asset)
            self.assertEqual(item['transformation']['sha256'], sha)
            content = (ROOT/'web'/asset).read_bytes()
            self.assertEqual((len(content), hashlib.sha256(content).hexdigest()), (size, sha))
            self.assertEqual(item['status']['temporal'], 'source_label')
            self.assertEqual(item['status']['spatial'], 'unregistered')
        self.assertNotIn('<img', text)
        self.assertNotIn('<iframe', text)
        self.assertNotIn('<canvas', text)

    def test_disputed_availability_does_not_promote_a_selected_damage_claim(self):
        docs = copy.deepcopy(list(self.docs.values()))
        doc = next(doc for doc in docs if doc['id'] == 'moore-2013')
        claim = next(item for item in doc['observations'] if item['id'] == 'medical-center-function')
        claim['status']['availability'] = 'disputed'
        claim['status']['assertion'] = 'disputed'
        def existing_references(root, candidate):
            return layer_references(root, self.docs[candidate['id']])
        with patch('atlas.evidence_coverage.dossiers', return_value=docs), \
                patch('atlas.evidence_coverage.layer_references', side_effect=existing_references):
            row = next(row for row in coverage_rows() if row['event']['id'] == 'moore-2013')
        self.assertNotIn('medical-center-function',
                         {item['id'] for _, item in row['layers']['damage']['items']})
        self.assertIn('medical-center-function',
                      {item['id'] for _, item in row['layers']['gaps']['items']})
        self.assertEqual(row['layers']['geography']['state'], 'not_classified')
        self.assertEqual(row['layers']['appearance']['state'], 'not_admitted')
        self.assertEqual(row['layers']['appearance']['items'], [])
        self.assertEqual(row['layers']['chronology']['state'], 'not_admitted')

    def test_moore_membership_rejects_foreign_missing_and_stale_references(self):
        doc = self.docs['moore-2013']
        original = json.loads((ROOT/'exhibits/moore-2013/layers.json').read_text())
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root/'exhibits/moore-2013/layers.json'
            target.parent.mkdir(parents=True)
            for case in ('foreign-event', 'foreign-item', 'missing-item', 'changed-dossier'):
                data = copy.deepcopy(original)
                if case == 'foreign-event': data['event_id'] = 'udall-1955'
                elif case == 'foreign-item': data['layers']['damage']['media'].append('nws-blackwell-smoothed-map')
                elif case == 'missing-item': data['layers']['gaps']['observations'].append('absent-moore-evidence')
                else: data['dossier_sha256'] = '0'*64
                target.write_text(json.dumps(data))
                with self.subTest(case=case), self.assertRaises(ValueError):
                    layer_references(root, doc)

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

    def synthetic_rows(self, event_id, *, registered=False, photo_only=False):
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
        # This fixture explicitly exercises photo-only coverage even as the real
        # collection acquires documentary video. Source records are not mutated.
        if photo_only:
            candidate = next(doc for doc in docs if doc['id'] == event_id)
            candidate['media'] = [item for item in candidate['media'] if item['kind'] != 'video']
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
        rows = self.synthetic_rows('joplin-2011', photo_only=True)
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
        self.assertEqual(len(row['layers']['footage']['items']),14)
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
