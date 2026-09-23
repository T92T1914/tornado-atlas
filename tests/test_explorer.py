import hashlib
import json
import unittest
from pathlib import Path
from atlas.explorer import build_media

ROOT=Path(__file__).resolve().parents[1]


class ExplorerAssetsTests(unittest.TestCase):
    def test_checked_media_matches_existing_reviewed_assets_and_associations(self):
        generated=build_media()
        self.assertEqual(generated,json.loads((ROOT/'web/catalogue/media.json').read_text(encoding='utf-8')))
        aliases=json.loads((ROOT/'research/record-aliases.json').read_text(encoding='utf-8'))
        for identifier,collection in generated['records'].items():
            self.assertTrue(aliases[identifier]['exhibit'])
            self.assertIn('not a photograph',collection['scope'])
            self.assertEqual(len({p['id'] for p in collection['photos']}),len(collection['photos']))
            for photo in collection['photos']:
                self.assertNotIn('point',photo)
                self.assertTrue(photo['source'].startswith('https://'))
                self.assertTrue(photo['credit'])

    def test_pinned_renderer_bytes_match_manifest(self):
        folder=ROOT/'web/vendor/leaflet'
        manifest=json.loads((folder/'sources.json').read_text())
        for name,item in manifest['files'].items():
            self.assertEqual(hashlib.sha256((folder/name).read_bytes()).hexdigest(),item['sha256'])

    def test_location_review_is_carried_by_published_record(self):
        review=json.loads((ROOT/'research/location-reviews.json').read_text())['ncei:5599610']
        index=json.loads((ROOT/'web/catalogue/index.json').read_text(encoding='utf-8'))
        row=next(r for r in index['records'] if r['id']=='ncei:5599610')
        detail=json.loads((ROOT/'web/catalogue'/row['detail_file']).read_text(encoding='utf-8'))[row['id']]
        self.assertEqual(detail['location_review'],review)
        self.assertEqual(row['point'],[-12.18,34.6])
        self.assertEqual(review['source_sha256'],detail['provenance']['sha256'])
