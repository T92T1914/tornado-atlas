import copy
import json
import unittest
from atlas.sources import ROOT
from atlas.impacts import validate_fatality_places


class FatalityPlaceTests(unittest.TestCase):
    def setUp(self):
        self.history = json.loads((ROOT/'exhibits/el-reno-2013/history.json').read_text(encoding='utf-8'))
        self.places = copy.deepcopy(self.history['remembrance']['places'])
        self.people = self.history['remembrance']['people']

    def check(self):
        validate_fatality_places(self.places, self.people, 8)

    def test_counts_cannot_invent_or_contradict_documented_deaths(self):
        for count in (True, 0, -1, 2, 9, 3.5):
            with self.subTest(count=count):
                self.places[0]['deaths'] = count
                with self.assertRaises(ValueError):
                    self.check()

    def test_fatalities_are_not_damage_ratings(self):
        self.places[0]['category'] = 'EF3'
        with self.assertRaisesRegex(ValueError, 'category'):
            self.check()

    def test_duplicate_people_and_reused_anchors_fail(self):
        self.places[0]['people'][1] = self.places[0]['people'][0]
        with self.assertRaisesRegex(ValueError, 'distinct'):
            self.check()
        self.setUp()
        with self.assertRaisesRegex(ValueError, 'unique'):
            validate_fatality_places(self.places, self.people, 8, {'twistex-recovery'})

    def test_contract_is_not_tied_to_one_event_or_vehicle(self):
        place=self.places[0]
        place.update(id='another-incident', kind='documented_incident_site',
                     coordinate_basis='published_location', people=[], deaths=1)
        # An explicitly sourced count can be displayed without inventing names.
        validate_fatality_places(self.places, [], 1)
