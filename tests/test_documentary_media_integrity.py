"""Museum media additions preserve historical records and their evidence limits."""
import hashlib
import json
from pathlib import Path
import unittest
from atlas.archive import digest, dossiers, dossier_history, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = {
    "el-reno-2013": "2b90f2a01971831df78bf5ec0405c734fc1eea2d2d583f5ee2aa34cb6a2f6739",
    "joplin-2011": "1eae340b5ad5a8bd297b716895b2772f164c386aabb6f0383e473f7c4f5fa6bd",
    "blackwell-1955": "35e98413c80a66e59d2427176127a9cb987a368480948150286647bd19000638",
    "tuscaloosa-birmingham-2011": "2d248fb261debf757e75465ef4549fdc4a42b2e4737fe10fa49c066345c7cf5b"
}
ADDITIONS = {
    "el-reno-2013": {
        "creators": [
            "nick-nolte-commons",
            "commons-stratosphere"
        ],
        "sources": [
            "commons-nolte-el-reno",
            "youtube-snyder-provider-playback"
        ],
        "media": [
            "nolte-el-reno-documentary-photo"
        ],
        "routes": [
            {
                "label": "Photographs and film",
                "href": "index.html#photos"
            }
        ]
    },
    "joplin-2011": {
        "creators": [
            "piotrowski-joplin-original-uploader"
        ],
        "sources": [
            "piotrowski-joplin-original-publication"
        ],
        "media": [
            "piotrowski-joplin-original"
        ],
        "routes": [
            {
                "label": "Photographs and film",
                "href": "joplin.html#photographs-and-film"
            }
        ]
    },
    "blackwell-1955": {
        "creators": [
            "nara-commons-publication",
            "tulsa-blackwell-enhanced-edition-uploader"
        ],
        "sources": [
            "nara-blackwell-283884",
            "tulsa-blackwell-enhanced-edition-publication"
        ],
        "media": [
            "nara-blackwell-aerial-aftermath",
            "tulsa-blackwell-enhanced-edition"
        ],
        "routes": [
            {
                "label": "Photographs and film",
                "href": "blackwell.html#photographs-and-film"
            }
        ]
    },
    "tuscaloosa-birmingham-2011": {
        "creators": [
            "brown-tuscaloosa-original-uploader",
            "john-brown-tuscaloosa-maker"
        ],
        "sources": [
            "brown-tuscaloosa-original-publication"
        ],
        "media": [
            "brown-tuscaloosa-original"
        ],
        "routes": [
            {
                "label": "Photographs and film",
                "href": "tuscaloosa.html#photographs-and-film"
            }
        ]
    }
}

class DocumentaryMediaIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = {doc['id']: doc for doc in dossiers(ROOT)}

    def test_only_named_media_extensions_change_the_previous_publications(self):
        for event, identity in PREVIOUS.items():
            with self.subTest(event=event):
                old = json.loads((ROOT / f'web/archive/{event}-{identity[:20]}.json').read_bytes())
                self.assertEqual(digest(old), identity)
                current = self.docs[event]
                self.assertIs(validate_dossier(current), current)
                self.assertEqual(set(current), set(old))
                for field in old:
                    if field in ADDITIONS[event]:
                        self.assertEqual(current[field][:len(old[field])], old[field], field)
                        extra = current[field][len(old[field]):]
                        self.assertEqual(extra if field == 'routes' else [row['id'] for row in extra], ADDITIONS[event][field], field)
                    elif field == 'provenance':
                        self.assertEqual(set(current[field]), set(old[field]))
                        for key in old[field]:
                            if key != 'publication_review':
                                self.assertEqual(current[field][key], old[field][key], key)
                    else:
                        self.assertEqual(current[field], old[field], field)
                self.assertIn(identity, {v['dossier_sha256'] for v in dossier_history(current)['versions']})

    def test_media_use_basis_does_not_register_capture_or_camera(self):
        hosted = {
            'nolte-el-reno-documentary-photo': ('assets/el-reno-2013/storm03.jpg', 56622, 'a3cd7a67eb7d3ab91309c71251ce0e9c1c3af71d85147887b9527c438d43e3d5'),
            'nara-blackwell-aerial-aftermath': ('assets/blackwell-1955/nara-283884.jpg', 1649278, '66ea06de076b831c60710ee56168484ce90c7ef510cb1d6f87e3b28c67d58e34'),
        }
        for event, added in ADDITIONS.items():
            for identity in added['media']:
                with self.subTest(event=event, media=identity):
                    item = next(m for m in self.docs[event]['media'] if m['id'] == identity)
                    self.assertEqual(item['status']['spatial'], 'unregistered')
                    self.assertEqual(item['status']['temporal'], 'unregistered')
                    self.assertIsNone(item['place']['coordinates'])
                    for clock in ('video', 'alignment'):
                        self.assertIsNone(item['time'][clock])
                    if identity == 'nolte-el-reno-documentary-photo':
                        self.assertEqual(item['time']['capture'], {'reported':'2013-05-31 23:28:34, Commons label', 'clock_accuracy_and_time_zone':'unestablished'})
                    else:
                        self.assertIsNone(item['time']['capture'])
                    if identity in hosted:
                        asset, size, sha = hosted[identity]
                        raw = (ROOT / 'web' / asset).read_bytes()
                        self.assertEqual((len(raw), hashlib.sha256(raw).hexdigest()), (size, sha))
                        self.assertEqual(item['status']['rights'], 'permitted_hosting')
                        self.assertEqual(item['transformation']['asset'], asset)
                        self.assertEqual(item['transformation']['sha256'], sha)
                    else:
                        self.assertEqual(item['kind'], 'video')
                        self.assertEqual(item['status']['rights'], 'links_only')
                        expected = {
                            'piotrowski-joplin-original': ('wuU-nFuIZN4', None, 'piotrowski-joplin-original-uploader', None),
                            'brown-tuscaloosa-original': ('9KjWtBrEYHY', 'john-brown-tuscaloosa-maker', 'brown-tuscaloosa-original-uploader', 'john-brown-tuscaloosa-maker'),
                            'tulsa-blackwell-enhanced-edition': ('Em5HbYt0Fsk', None, 'tulsa-blackwell-enhanced-edition-uploader', None),
                        }
                        video, creator, uploader, holder = expected[identity]
                        self.assertEqual(item['source_id'], identity+'-publication')
                        self.assertEqual(item['url'], 'https://www.youtube.com/watch?v='+video)
                        self.assertEqual(item['roles'], {'creator':creator, 'uploader':uploader, 'rights_holder':holder})
        blackwell = next(m for m in self.docs['blackwell-1955']['media'] if m['id'] == 'tulsa-blackwell-enhanced-edition')
        source = next(s for s in self.docs['blackwell-1955']['sources'] if s['id'] == blackwell['source_id'])
        for technique in ('upscaling', 'noise reduction', 'AI-interpolated frames'):
            self.assertIn(technique, ' '.join(source.values()))

    def test_snyder_provider_qualification_does_not_count_the_same_clip_twice(self):
        doc = self.docs['el-reno-2013']
        removed = 'snyder-standard-provider-playback'
        self.assertNotIn(removed, {m['id'] for m in doc['media']})
        provider = 'youtube-snyder-provider-playback'
        self.assertEqual(sum(s['id'] == provider for s in doc['sources']), 1)
        self.assertFalse(any(m['source_id'] == provider for m in doc['media']))
        self.assertFalse(any(o['source_id'] == provider for o in doc['observations']))
        self.assertEqual(sum(m['url'] == 'https://www.youtube.com/watch?v=EFwJAlg0qWc' for m in doc['media']), 1)
        version = dossier_history(doc)['versions'][0]
        self.assertEqual(version['review']['previous_dossier_sha256'], '914e492d77149643665815a4d192980dce1507707b736e2b951ea1b866b1c499')
        self.assertEqual(version['changes'], [{'kind':'media','id':removed,'change':'removed','fields':[]}])
