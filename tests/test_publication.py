import json
import gzip
import unittest

from atlas.catalogue import import_ncei
from atlas.ncei import normalize
from atlas.publication import export_catalogue, select_index, location_review
import test_catalogue as fixtures
from test_catalogue import sample


class BrowserIndexTests(unittest.TestCase):
    def test_review_flags_original_point_without_replacing_it(self):
        record = normalize(sample(BEGIN_LAT='34.60', BEGIN_LON='-12.18', END_LAT='34.63', END_LON='-117.03'))
        record['provenance'] = {'snapshot_id':'fixture','sha256':'a'*64,'source_url':'https://example.com/source','csv_record':2}
        review = {'status':'disputed','snapshot_id':'fixture','reported_start':[-12.18,34.6],
                  'reported_end':[-117.03,34.63],'reason':'Conflicting source geography','source_url':'https://example.com/source',
                  'source_sha256':'a'*64,'csv_record':2}
        result = select_index(record, {}, 'details/fixture.json', {'ncei:1':review})
        self.assertEqual(result['point'], [-12.18,34.6])
        self.assertEqual(result['location_quality'], 'disputed')
        self.assertEqual(result['point_basis'], 'reported_start')
        for key,value in [('snapshot_id','new-revision'),('reported_start',[-117.18,34.6]),('reported_end',None),('reason',''),
                          ('source_sha256','b'*64),('source_url','https://example.com/other'),('csv_record',3)]:
            with self.subTest(key=key), self.assertRaisesRegex(ValueError,'stale or incomplete'):
                location_review(record, {'ncei:1':{**review,key:value}})

    def test_end_fallback_is_labeled_and_never_connects_endpoints(self):
        record = normalize(sample(BEGIN_LAT='', BEGIN_LON=''))
        record['provenance'] = {'snapshot_id':'fixture'}
        result = select_index(record, {}, 'details/fixture.json')
        self.assertEqual(result['point_basis'], 'reported_end_only')
        self.assertEqual(result['point'], [-97.9,35.1])
        self.assertNotIn('track', result)

    def test_missing_coordinates_do_not_become_zero_or_disappear(self):
        record = normalize(sample(BEGIN_LAT='',BEGIN_LON='',END_LAT='',END_LON=''))
        record['provenance'] = {'snapshot_id':'fixture'}
        result = select_index(record, {}, 'details/fixture.json')
        self.assertIsNone(result['point'])
        self.assertEqual(result['point_basis'],'unlocated')
        self.assertEqual(result['id'],'ncei:1')

    def test_annotation_does_not_replace_source_title_or_rating(self):
        record = normalize(sample(TOR_F_SCALE='F3'))
        record['provenance'] = {'snapshot_id':'fixture'}
        aliases = {'ncei:1':{'names':['Reviewed name'],'exhibit':None}}
        result = select_index(record, aliases, 'details/fixture.json')
        self.assertEqual(result['title'], record['title'])
        self.assertEqual(result['rating'], 'F3')
        self.assertEqual(result['aliases'], ['Reviewed name'])


class StaticPublicationTests(unittest.TestCase):
    def setUp(self):
        # Reuse a source fixture builder, without inheriting its test methods.
        self.fixture = fixtures.PersistenceTests()
        self.fixture.setUp()
        self.output = self.fixture.root / 'public'

    def tearDown(self):
        self.fixture.tearDown()

    def publish(self, rows, revision='20260323', aliases=None):
        metadata = self.fixture.snapshot(rows, revision)
        import_ncei(self.fixture.db, metadata, self.fixture.root)
        result = export_catalogue(self.fixture.db, self.output, aliases or {})
        index = json.loads((self.output / 'index.json').read_text(encoding='utf-8'))
        return result,index

    def test_every_index_entry_resolves_without_the_local_database(self):
        result,index = self.publish([sample(),sample(EVENT_ID='2')])
        self.assertEqual(result['records'],2)
        for row in index['records']:
            detail = json.loads((self.output / row['detail_file']).read_text(encoding='utf-8'))[row['id']]
            self.assertEqual(detail['provenance']['snapshot_id'],row['source_snapshot'])
            self.assertEqual(detail['rating']['reported'],row['rating'])
            self.assertNotIn('episode_narrative',detail)
        self.assertEqual(gzip.decompress((self.output/'index.json.gz').read_bytes()),(self.output/'index.json').read_bytes())

    def test_new_revision_cannot_mutate_an_older_detail_link(self):
        _,before = self.publish([sample()])
        previous = self.output / before['records'][0]['detail_file']
        content = previous.read_bytes()
        _,after = self.publish([sample(TOR_F_SCALE='EF2')],'20260920')
        self.assertNotEqual(before['records'][0]['detail_file'],after['records'][0]['detail_file'])
        self.assertEqual(previous.read_bytes(),content)
        self.assertEqual(after['records'][0]['rating'],'EF2')

    def test_unknown_alias_cannot_create_a_fake_record(self):
        result,index = self.publish([sample()],aliases={'ncei:99':{'names':['Imaginary']}})
        self.assertEqual(result['unmatched_aliases'],['ncei:99'])
        self.assertEqual(len(index['records']),1)

    def test_empty_database_cannot_replace_a_valid_preview(self):
        self.output.mkdir()
        (self.output/'index.json').write_text('existing',encoding='utf-8')
        with self.assertRaises(ValueError):
            export_catalogue(self.fixture.db,self.output,{})
        self.assertEqual((self.output/'index.json').read_text(),'existing')


if __name__ == '__main__':
    unittest.main()
