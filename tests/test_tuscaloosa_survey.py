import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from atlas.tuscaloosa_survey import (ROOT, FOLDER, ITEM, AREA_LAYER, POINT_LAYER,
    DATA_SHA256, compile_survey, load_survey, publication, native_section, build)


class TuscaloosaSurveyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / FOLDER / 'survey-map-response.json').read_bytes())
        cls.item = json.loads((ROOT / FOLDER / 'survey-map-item.json').read_bytes())
        cls.survey = load_survey(ROOT)

    def test_every_original_feature_and_composite_identity_survives(self):
        for layer, published in ((AREA_LAYER, self.survey['polygons']), (POINT_LAYER, self.survey['points'])):
            source = next(row for row in self.data['operationalLayers'] if row['id'] == layer)
            originals = source['featureCollection']['layers'][0]['featureSet']['features']
            self.assertEqual([row['source_feature'] for row in published], originals)
            for row in published:
                self.assertEqual(row['id'], f'{ITEM}:{layer}:{row["source_feature"]["attributes"]["FID"]}')
        ids = [row['id'] for row in self.survey['points'] + self.survey['polygons']]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertNotEqual(self.survey['points'][0]['id'], self.survey['polygons'][0]['id'])

    def test_outside_and_coincident_accounts_are_not_removed(self):
        outside = [row['fid'] for row in self.survey['points'] if row['overall_relation'] == 'outside']
        self.assertEqual(outside, [16, 58, 71])
        self.assertEqual(self.survey['inventory']['duplicate_projected_groups'], [
            [0,158], [168,169,188,189,190], [173,174], [178,179],
            [184,191], [185,192], [186,193], [187,194]])
        local_points = [row for row in self.survey['points'] if row['local_area_ids']]
        self.assertEqual(len(local_points), 46)
        self.assertEqual({row['source_feature']['attributes']['efscale'] for row in local_points}, {'EF1','EF2','EF3','EF4'})

    def test_source_placeholders_and_later_calendar_labels_remain_literal(self):
        attrs = [row['source_feature']['attributes'] for row in self.survey['points']]
        self.assertEqual((attrs[196]['damage_txt'], attrs[196]['dod_txt']), ('Null', 'Null'))
        self.assertEqual(attrs[162]['windspeed'], '200')
        self.assertEqual(sum(row['windspeed'] == ' ' for row in attrs), 5)
        self.assertEqual(sum(row['windspeed'] == 'N/A' for row in attrs), 138)
        self.assertEqual([row['FID'] for row in attrs if row['surveydate'] == 1310428800000], [165,166,167])
        self.assertEqual(attrs[126]['surveydate'], 1306627200000)
        self.assertTrue(attrs[16]['dod_txt'].endswith('('))
        self.assertEqual([row['source_feature']['attributes']['width'] for row in self.survey['polygons'][1:]], [-99] * 7)
        self.assertIsNone(self.survey['source']['point_wind_unit'])

    def test_structural_changes_fail_without_borrowing_other_source_contracts(self):
        mutations = [lambda data: data['spatialReference'].update(wkid=4326),
            lambda data: data['operationalLayers'][2]['featureCollection']['layers'][0]['featureSet']['features'][0]['attributes'].update(FID=False),
            lambda data: data['operationalLayers'][2]['featureCollection']['layers'][0]['featureSet']['features'].pop(),
            lambda data: data['operationalLayers'][2]['featureCollection']['layers'][0]['featureSet']['features'][0]['geometry'].update(x=float('nan')),
            lambda data: data['operationalLayers'][1]['featureCollection']['layers'][0]['featureSet']['features'][0]['geometry']['rings'][0].pop()]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                data = copy.deepcopy(self.data);mutate(data)
                with self.assertRaises(ValueError):compile_survey(data, self.item)

    def test_changed_original_bytes_fail_before_any_publication_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);folder = root / FOLDER;folder.mkdir(parents=True)
            for name in ('survey-map-response.json', 'survey-map-item.json'):
                shutil.copyfile(ROOT / FOLDER / name, folder / name)
            path = folder / 'survey-map-response.json';path.write_bytes(path.read_bytes() + b' ')
            with self.assertRaises(ValueError):build(root)
            self.assertFalse((root / 'web').exists())

    def test_publication_digest_and_native_targets_bind_exact_current_source(self):
        artifacts = publication(ROOT)
        index = json.loads(artifacts['events/tuscaloosa-birmingham-2011-survey-index.json'])
        raw = artifacts[index['file']]
        self.assertEqual(hashlib.sha256(raw).hexdigest(), index['sha256'])
        self.assertEqual(index['source_data_sha256'], DATA_SHA256)
        section = native_section(self.survey, index['file'], raw)
        self.assertEqual(section.count('class="damage-account"'), 198)
        for fid in range(198):self.assertIn(f'id="survey-account-{fid}"', section)
        self.assertIn('2011-07-12', section)
        self.assertIn('Outside the estimated overall footprint.', section)
        self.assertNotIn('<img', section)
        self.assertEqual(list(self.survey['inventory']['ratings']), sorted(self.survey['inventory']['ratings']))

    def test_native_source_text_is_escaped(self):
        survey = copy.deepcopy(self.survey)
        survey['points'][0]['source_feature']['attributes']['dod_txt'] = '<script>untrusted</script>'
        section = native_section(survey, 'events/example.json', b'{}')
        self.assertNotIn('<script>untrusted', section)
        self.assertIn('&lt;script&gt;untrusted&lt;/script&gt;', section)


if __name__ == '__main__':unittest.main()
