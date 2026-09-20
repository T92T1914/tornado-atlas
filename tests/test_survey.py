import copy
import json
import unittest

from atlas.survey import FOLDER, compile_survey, load_survey, polygon_location


class SurveyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.geometry = json.loads((FOLDER / 'path.geojson').read_text(encoding='utf-8'))
        cls.response = json.loads((FOLDER / 'survey-response.json').read_text(encoding='utf-8'))

    def test_reviewed_snapshot_and_bundle_preserve_source_coordinates(self):
        survey = load_survey(self.geometry)
        self.assertEqual((survey['queried_count'], survey['included_count'], survey['outside_count']), (424, 336, 88))
        originals = {f['attributes']['objectid']: f for f in self.response['features']}
        for point in survey['points']:
            raw = originals[point['id']]
            self.assertEqual(point['coordinates'], [raw['geometry']['x'], raw['geometry']['y']])
            self.assertEqual(point['rating'], raw['attributes']['efscale'])
            self.assertNotIn('impact_time', point)
        self.assertEqual(survey['association'], 'geographic_overlap_only')
        self.assertEqual(sum(p['rating'] == 'TSTM/Wind' for p in survey['points']), 2)

    def test_incomplete_or_error_response_cannot_be_published(self):
        for addition in ({'exceededTransferLimit': True}, {'error': {'code': 400}}):
            with self.subTest(addition=addition), self.assertRaisesRegex(ValueError, 'Incomplete'):
                compile_survey({**self.response, **addition}, self.geometry)

    def test_duplicate_ids_are_rejected_even_when_outside_outline(self):
        data = copy.deepcopy(self.response)
        data['features'].append(copy.deepcopy(data['features'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            compile_survey(data, self.geometry)

    def test_nonfinite_or_out_of_region_coordinates_are_rejected(self):
        for x in (float('nan'), float('inf'), -100, True):
            data = copy.deepcopy(self.response)
            data['features'][0]['geometry']['x'] = x
            with self.subTest(x=x), self.assertRaisesRegex(ValueError, 'coordinate'):
                compile_survey(data, self.geometry)

    def test_wrong_coordinate_system_or_changed_event_join_requires_review(self):
        data = copy.deepcopy(self.response)
        data['spatialReference']['wkid'] = 3857
        with self.assertRaisesRegex(ValueError, 'WGS84'):
            compile_survey(data, self.geometry)
        data = copy.deepcopy(self.response)
        data['features'][0]['attributes']['event_id'] = 'new-link'
        with self.assertRaisesRegex(ValueError, 'association'):
            compile_survey(data, self.geometry)

    def test_out_of_period_records_are_rejected(self):
        data = copy.deepcopy(self.response)
        data['features'][0]['attributes']['stormdate'] = 0
        with self.assertRaisesRegex(ValueError, 'date outside'):
            compile_survey(data, self.geometry)

    def test_polygon_holes_and_boundaries_are_not_silently_filled(self):
        rings = [[[0,0],[10,0],[10,10],[0,10],[0,0]], [[3,3],[7,3],[7,7],[3,7],[3,3]]]
        for point, expected in [([1,1],'inside'), ([5,5],'outside'), ([11,5],'outside'),
                                ([0,5],'boundary'), ([3,5],'boundary'), ([0,0],'boundary')]:
            with self.subTest(point=point):
                self.assertEqual(polygon_location(point, rings), expected)


if __name__ == '__main__':
    unittest.main()
