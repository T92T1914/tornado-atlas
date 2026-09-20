import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atlas.damage import validate_gallery, restore_assets
from atlas.sources import ROOT


class SurveyPhotoTests(unittest.TestCase):
    def setUp(self):
        self.gallery = json.loads((ROOT / 'exhibits/el-reno-2013/damage.json').read_text(encoding='utf-8'))

    def test_published_assets_match_reviewed_originals(self):
        validate_gallery(self.gallery, ROOT / 'web')

    def test_unverified_geolocation_and_times_cannot_be_published(self):
        for key, value in [('coordinates', [-97.9, 35.4]), ('captured_at', '2013-05-31T23:20:00Z')]:
            changed = copy.deepcopy(self.gallery)
            changed['photos'][0][key] = value
            with self.assertRaisesRegex(ValueError, 'no verified'):
                validate_gallery(changed)

    def test_asset_path_cannot_escape_gallery(self):
        self.gallery['photos'][0]['asset'] = '../private.jpg'
        with self.assertRaisesRegex(ValueError, 'outside'):
            validate_gallery(self.gallery)

    def test_duplicate_photo_is_rejected(self):
        self.gallery['photos'].append(copy.deepcopy(self.gallery['photos'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            validate_gallery(self.gallery)

    def test_existing_corrupt_asset_is_not_overwritten_or_redownloaded(self):
        with tempfile.TemporaryDirectory() as tmp, patch('atlas.damage.retrieve') as download:
            root = Path(tmp)
            target = root / self.gallery['photos'][0]['asset']
            target.parent.mkdir(parents=True)
            target.write_bytes(b'corrupt original')
            with self.assertRaisesRegex(ValueError, 'integrity'):
                restore_assets(self.gallery, root)
            self.assertEqual(target.read_bytes(), b'corrupt original')
            download.assert_not_called()

    def test_missing_asset_restores_exact_bytes_and_reuses_verified_file(self):
        self.gallery['photos'] = self.gallery['photos'][:1]
        photo = self.gallery['photos'][0]
        content = (ROOT / 'web' / photo['asset']).read_bytes()
        with tempfile.TemporaryDirectory() as tmp, patch('atlas.damage.cached_retrieval', return_value={'cached': True}), \
                patch('atlas.damage.read_object', return_value=content) as read, patch('atlas.damage.retrieve') as download:
            self.assertEqual(restore_assets(self.gallery, Path(tmp)), 1)
            self.assertEqual((Path(tmp) / photo['asset']).read_bytes(), content)
            self.assertEqual(restore_assets(self.gallery, Path(tmp)), 0)
            read.assert_called_once()
            download.assert_not_called()

    def test_changed_remote_bytes_are_rejected_before_publication(self):
        with tempfile.TemporaryDirectory() as tmp, patch('atlas.damage.cached_retrieval', return_value=None), \
                patch('atlas.damage.retrieve', return_value={}), patch('atlas.damage.read_object', return_value=b'new bytes'):
            with self.assertRaisesRegex(ValueError, 'integrity'):
                restore_assets(self.gallery, Path(tmp))
            self.assertFalse((Path(tmp) / self.gallery['photos'][0]['asset']).exists())

    def test_hash_alone_does_not_accept_html_as_a_photograph(self):
        content = b'<html>access denied</html>'
        self.gallery['photos'] = self.gallery['photos'][:1]
        self.gallery['photos'][0].update(sha256=hashlib.sha256(content).hexdigest(), bytes=len(content))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / self.gallery['photos'][0]['asset']
            path.parent.mkdir(parents=True)
            path.write_bytes(content)
            with self.assertRaisesRegex(ValueError, 'JPEG'):
                validate_gallery(self.gallery, Path(tmp))


if __name__ == '__main__':
    unittest.main()
