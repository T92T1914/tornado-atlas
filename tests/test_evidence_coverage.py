import copy
import html
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from atlas.archive import dossiers
from atlas.evidence_coverage import ROOT, coverage_rows, layer_references, publication, render_page, reviewed


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
