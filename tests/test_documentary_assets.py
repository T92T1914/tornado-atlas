"""Protect published documentary source bytes and local reading links."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class PageLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.targets = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('src', 'href'):
            if key in attrs:
                self.targets.append(attrs[key])


class DocumentaryAssetsTests(unittest.TestCase):
    def test_preserved_sources_match_reviewed_manifest(self):
        manifest = json.loads((ROOT / 'exhibits/joplin-2011/manifest.json').read_text(encoding='utf-8'))
        for asset in manifest['assets']:
            with self.subTest(asset=asset['path']):
                path = (ROOT / asset['path']).resolve()
                self.assertTrue(path.is_relative_to(ROOT))
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), asset['sha256'])

    def test_reading_anchors_and_local_media_resolve(self):
        parser = PageLinks()
        parser.feed((ROOT / 'web/joplin.html').read_text(encoding='utf-8'))
        self.assertEqual(len(parser.ids), len(set(parser.ids)), 'Duplicate reading anchor')
        for target in parser.targets:
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc:
                continue
            with self.subTest(target=target):
                if parsed.path:
                    self.assertTrue((ROOT / 'web' / unquote(parsed.path)).is_file())
                elif parsed.fragment:
                    self.assertIn(unquote(parsed.fragment), parser.ids)


if __name__ == '__main__':
    unittest.main()
