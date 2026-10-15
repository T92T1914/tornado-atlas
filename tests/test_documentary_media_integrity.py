"""Museum media additions preserve historical records and their evidence limits."""
import copy
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
            "commons-stratosphere",
            "ray-bohac-archived-film",
            "bidgee-commons-archive-upload",
            "david-conrady-publication-account",
            "ray-bohac-short-archived-film",
            "bidgee-commons-short-film-transfer",
            "nick-nolte-timecoded-publication-account"
        ],
        "sources": [
            "commons-nolte-el-reno",
            "youtube-snyder-provider-playback",
            "bohac-licensed-archive-publication",
            "conrady-el-reno-primary-publication",
            "bohac-short-licensed-archive",
            "nolte-original-timecoded-publication"
        ],
        "media": [
            "nolte-el-reno-documentary-photo",
            "bohac-archived-extended-film",
            "bohac-opening-film-still",
            "conrady-roadside-opening",
            "bohac-short-visibility-film",
            "nolte-timecoded-context-231037",
            "nolte-timecoded-context-231059"
        ],
        "observations": ["conrady-later-description"],
        "routes": [
            {
                "label": "Photographs and film",
                "href": "index.html#photos"
            }
        ]
    },
    "joplin-2011": {
        "creators": [
            "piotrowski-joplin-original-uploader",
            "nws-sgf-storymap-publisher"
        ],
        "sources": [
            "piotrowski-joplin-original-publication",
            "nws-joplin-storymap-damage-photos"
        ],
        "media": [
            "piotrowski-joplin-original",
            "nws-joplin-st-johns-aftermath",
            "nws-joplin-high-school-aftermath"
        ],
        "routes": [
            {
                "label": "Photographs and film",
                "href": "joplin.html#photographs-and-film"
            },
            {
                "label": "St. John's: the hospital and its surroundings",
                "href": "joplin.html?photo=nws-joplin-st-johns-aftermath#hospital-services"
            },
            {
                "label": "Joplin High School: damage beside the refuge account",
                "href": "joplin.html?photo=nws-joplin-high-school-aftermath#school-refuge"
            }
        ]
    },
    "blackwell-1955": {
        "observations": ["nws-parent-storm-separate-tornadoes"],
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
            "john-brown-tuscaloosa-maker",
            "jason-rosolowski-creator-upload",
            "oliveira-2019-figure-authors",
            "mike-wilhelm-tuscaloosa-film",
            "noaa-institutional-repository"
        ],
        "sources": [
            "brown-tuscaloosa-original-publication",
            "rosolowski-tuscaloosa-creator-publication",
            "oliveira-2019-tuscaloosa-figure6",
            "oliveira-2022-trailing-vortices"
        ],
        "observations": [
            "rosolowski-2022-reported-viewpoint",
            "rosolowski-2022-panel-a", "rosolowski-2022-panel-b",
            "rosolowski-2022-panel-c", "rosolowski-2022-panel-d"
        ],
        "media": [
            "brown-tuscaloosa-original",
            "rosolowski-tuscaloosa-original",
            "oliveira-2019-tornado-video-frames"
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

    def test_only_named_documentary_extensions_change_the_previous_publications(self):
        for event, identity in PREVIOUS.items():
            with self.subTest(event=event):
                old = json.loads((ROOT / f'web/archive/{event}-{identity[:20]}.json').read_bytes())
                self.assertEqual(digest(old), identity)
                current = self.docs[event]
                self.assertIs(validate_dossier(current), current)
                self.assertEqual(set(current), set(old))
                for field in old:
                    if field in ADDITIONS[event]:
                        retained = copy.deepcopy(current[field][:len(old[field])])
                        if event == 'el-reno-2013' and field == 'sources':
                            for before, after in zip(old[field], retained):
                                if before['id'] == 'wakimoto-aerial-2016':
                                    for key in ('access', 'locator'):
                                        self.assertTrue(after[key].startswith(before[key]))
                                        self.assertGreater(len(after[key]), len(before[key]))
                                        after[key] = before[key]
                        self.assertEqual(retained, old[field], field)
                        extra = current[field][len(old[field]):]
                        nolte = {'creators':['nick-nolte-three-permitted-exports'], 'sources':['nolte-three-permitted-full-exports'],
                                 'media':['nolte-231037-full-documentary','nolte-231059-full-documentary','nolte-231202-full-documentary']}
                        learning = {'media':['bohac-opening-documentary-motion'], 'observations':['wakimoto-2016-dust-feature-radar-comparison']}
                        expected = ADDITIONS[event][field] + (nolte.get(field, []) + learning.get(field, []) if event == 'el-reno-2013' else [])
                        self.assertEqual(extra if field == 'routes' else [row['id'] for row in extra], expected, field)
                    elif field == 'provenance':
                        expected_keys = set(old[field]) | ({'source_relationship_2022_increment'}
                            if event == 'tuscaloosa-birmingham-2011' else set())
                        self.assertEqual(set(current[field]), expected_keys)
                        for key in old[field]:
                            if key == 'inputs' and event == 'el-reno-2013':
                                expected_inputs = dict(old[field][key])
                                expected_inputs['exhibits/el-reno-2013/footage.json'] = '4cc3ab95635d9b63a763dc5b635c8f53435eccad0d564cecc0f9d711b3f83860'
                                self.assertEqual(current[field][key], expected_inputs, key)
                            elif key != 'publication_review':
                                self.assertEqual(current[field][key], old[field][key], key)
                    else:
                        self.assertEqual(current[field], old[field], field)
                self.assertIn(identity, {v['dossier_sha256'] for v in dossier_history(current)['versions']})

    def test_media_use_basis_does_not_register_capture_or_camera(self):
        hosted = {
            'nws-joplin-st-johns-aftermath': ('assets/joplin-2011/nws-st-johns-aftermath.jpg', 4038164, '8c28031659db5d046b78eb1b510cbeb8a794855c385e52556a48afb1015f19ae'),
            'nws-joplin-high-school-aftermath': ('assets/joplin-2011/nws-high-school-aftermath.jpg', 132606, '34121880416d15911ec9cc29957eb04a4961dcfb4528a597b63f729c39678da1'),
            'nolte-el-reno-documentary-photo': ('assets/el-reno-2013/storm03.jpg', 56622, 'a3cd7a67eb7d3ab91309c71251ce0e9c1c3af71d85147887b9527c438d43e3d5'),
            'nara-blackwell-aerial-aftermath': ('assets/blackwell-1955/nara-283884.jpg', 1649278, '66ea06de076b831c60710ee56168484ce90c7ef510cb1d6f87e3b28c67d58e34'),
            'bohac-opening-film-still': ('assets/el-reno-2013/bohac-opening-film-still.png', 209071, 'a93d6b3a156ebf5ae7008e8e6e6bb18e11eb3467dc92e046f95aaa965b4c6af6'),
            'oliveira-2019-tornado-video-frames': ('assets/tuscaloosa-birmingham-2011/tornado-video-frames-oliveira2019.png', 361114, 'd8e89044ea98c4beab8d568598ea3a1711b73bfe3a425e5afd304af491e48d4f'),
        }
        for event, added in ADDITIONS.items():
            for identity in added['media']:
                with self.subTest(event=event, media=identity):
                    item = next(m for m in self.docs[event]['media'] if m['id'] == identity)
                    self.assertEqual(item['status']['spatial'], 'unregistered')
                    if identity not in ('nolte-timecoded-context-231037', 'nolte-timecoded-context-231059'):
                        self.assertEqual(item['status']['temporal'], 'unregistered')
                    self.assertIsNone(item['place']['coordinates'])
                    self.assertIsNone(item['time']['alignment'])
                    movie_context = {
                        'nolte-timecoded-context-231037': (1241.223333, '2013-05-31T23:10:37.254Z', 'millisecond_label_readable', 'nolte-231037', '2013-05-31T23:10:37Z'),
                        'nolte-timecoded-context-231059': (1263.223333, '2013-05-31T23:10:59Z', 'whole_second_label_readable', 'nolte-231059', '2013-05-31T23:10:59Z'),
                    }.get(identity)
                    if movie_context:
                        locator, label, precision, photo, photo_label = movie_context
                        self.assertEqual(item['time']['video'], {'start_seconds':locator, 'end_seconds':locator})
                        self.assertEqual(item['time']['capture'], {'reported':label, 'precision':precision})
                        self.assertEqual(item['status']['temporal'], 'source_label')
                        self.assertEqual(item['status']['assertion'], 'observed_sample')
                        self.assertEqual(item['status']['rights'], 'links_only')
                        self.assertEqual(item['kind'], 'video')
                        self.assertEqual(item['source_id'], 'nolte-original-timecoded-publication')
                        self.assertEqual(item['url'], 'https://www.youtube.com/watch?v=jsBDFA6_81M')
                        self.assertEqual(item['roles'], {'creator':'nick-nolte-timecoded-publication-account', 'uploader':'nick-nolte-timecoded-publication-account', 'rights_holder':None})
                        self.assertIsNone(item['parent'])
                        self.assertEqual(item['review']['photo_sample_id'], photo)
                        self.assertEqual(item['review']['photo_reported_utc'], photo_label)
                        self.assertEqual(item['review']['source_comparison']['exposure_identity'], 'unknown')
                        self.assertEqual(item['review']['source_comparison']['reuse'], 'external_links_only')
                        continue
                    self.assertIsNone(item['time']['video'])
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
                        if identity == 'oliveira-2019-tornado-video-frames':
                            self.assertEqual(item['kind'], 'photograph')
                            self.assertEqual(item['transformation']['content_role'], 'published_video_frame_figure')
                            self.assertEqual((item['transformation']['width'], item['transformation']['height']), (1351, 767))
                            self.assertEqual(raw[:8], b'\x89PNG\r\n\x1a\n')
                            self.assertEqual((int.from_bytes(raw[16:20], 'big'), int.from_bytes(raw[20:24], 'big')), (1351, 767))
                            self.assertEqual(item['source_id'], 'oliveira-2019-tuscaloosa-figure6')
                            self.assertEqual(item['url'], 'https://repository.library.noaa.gov/view/noaa/26149/noaa_26149_DS1.pdf#page=10')
                            self.assertEqual(item['roles'], {'creator':'oliveira-2019-figure-authors', 'uploader':'noaa-institutional-repository', 'rights_holder':None})
                            self.assertIsNone(item['parent'])
                            self.assertIn('estimated', item['time']['event'])
                            self.assertEqual(item['time']['publication'], '2019-11-16')
                            figure_source = next(source for source in self.docs[event]['sources'] if source['id'] == item['source_id'])
                            self.assertIn('CC BY4.0', figure_source['rights'])
                            self.assertIn('This does not license the complete original recordings', figure_source['rights'])
                    elif identity == 'bohac-archived-extended-film':
                        self.assertEqual(item['kind'], 'video')
                        self.assertEqual(item['status']['rights'], 'links_only')
                        self.assertEqual(item['source_id'], 'bohac-licensed-archive-publication')
                        self.assertEqual(item['roles'], {'creator':'ray-bohac-archived-film', 'uploader':'bidgee-commons-archive-upload', 'rights_holder':'ray-bohac-archived-film'})
                        self.assertEqual(item['url'], 'https://commons.wikimedia.org/wiki/File:May_31_El_Reno_EF5_Extended_Version_filmed_up_close_in_the_TVN_Dominator_1.ogv')
                    elif identity == 'bohac-short-visibility-film':
                        self.assertEqual(item['kind'], 'video')
                        self.assertEqual(item['status']['rights'], 'links_only')
                        self.assertEqual(item['status']['assertion'], 'observed_sample')
                        self.assertEqual(item['source_id'], 'bohac-short-licensed-archive')
                        self.assertEqual(item['roles'], {'creator':'ray-bohac-short-archived-film', 'uploader':'bidgee-commons-short-film-transfer', 'rights_holder':'ray-bohac-short-archived-film'})
                        self.assertEqual(item['url'], 'https://commons.wikimedia.org/wiki/File:May_31,_2013_EF5_El_Reno,_OK_Tornado_showing_multiple_sub_vortices.ogv')
                        self.assertIsNone(item['parent'])
                        self.assertEqual(item['transformation'], 'External source-page film link. No Atlas-hosted video, still, generated imagery or automatic third-party player request.')
                    else:
                        self.assertEqual(item['kind'], 'video')
                        self.assertEqual(item['status']['rights'], 'links_only')
                        expected = {
                            'piotrowski-joplin-original': ('wuU-nFuIZN4', None, 'piotrowski-joplin-original-uploader', None),
                            'brown-tuscaloosa-original': ('9KjWtBrEYHY', 'john-brown-tuscaloosa-maker', 'brown-tuscaloosa-original-uploader', 'john-brown-tuscaloosa-maker'),
                            'tulsa-blackwell-enhanced-edition': ('Em5HbYt0Fsk', None, 'tulsa-blackwell-enhanced-edition-uploader', None),
                            'rosolowski-tuscaloosa-original': ('5ohIVzIZLuQ', 'jason-rosolowski-creator-upload', 'jason-rosolowski-creator-upload', None),
                            'conrady-roadside-opening': ('s-W92EOU138', None, 'david-conrady-publication-account', None),
                        }
                        video, creator, uploader, holder = expected[identity]
                        source = {'rosolowski-tuscaloosa-original': 'rosolowski-tuscaloosa-creator-publication',
                                  'conrady-roadside-opening': 'conrady-el-reno-primary-publication'}.get(identity, identity+'-publication')
                        self.assertEqual(item['source_id'], source)
                        self.assertEqual(item['url'], 'https://www.youtube.com/watch?v='+video)
                        self.assertEqual(item['roles'], {'creator':creator, 'uploader':uploader, 'rights_holder':holder})
        blackwell = next(m for m in self.docs['blackwell-1955']['media'] if m['id'] == 'tulsa-blackwell-enhanced-edition')
        source = next(s for s in self.docs['blackwell-1955']['sources'] if s['id'] == blackwell['source_id'])
        for technique in ('upscaling', 'noise reduction', 'AI-interpolated frames'):
            self.assertIn(technique, ' '.join(source.values()))
        still = next(m for m in self.docs['el-reno-2013']['media'] if m['id'] == 'bohac-opening-film-still')
        parent = next(m for m in self.docs['el-reno-2013']['media'] if m['id'] == still['parent'])
        self.assertEqual((still['kind'], parent['kind']), ('photograph', 'video'))
        self.assertEqual(still['source_id'], parent['source_id'])
        self.assertEqual(still['roles'], parent['roles'])
        self.assertEqual(still['transformation']['parent_sha256'], 'b869bf7799b4d388e047216f5343e5aa85cc681f5bda8a760899a6261b698932')
        self.assertEqual((still['transformation']['width'], still['transformation']['height']), (1280, 720))
        self.assertIn('not a separately taken photograph', still['account'])

    def test_snyder_provider_qualification_does_not_count_the_same_clip_twice(self):
        doc = self.docs['el-reno-2013']
        removed = 'snyder-standard-provider-playback'
        self.assertNotIn(removed, {m['id'] for m in doc['media']})
        provider = 'youtube-snyder-provider-playback'
        self.assertEqual(sum(s['id'] == provider for s in doc['sources']), 1)
        self.assertFalse(any(m['source_id'] == provider for m in doc['media']))
        self.assertFalse(any(o['source_id'] == provider for o in doc['observations']))
        self.assertEqual(sum(m['url'] == 'https://www.youtube.com/watch?v=EFwJAlg0qWc' for m in doc['media']), 1)
        version = next(v for v in dossier_history(doc)['versions']
                       if v['dossier_sha256'] == '97a07ec3d61c194c95320bd50481999cc995d6069fb59ecd24aac55e41a5691f')
        self.assertEqual(version['review']['previous_dossier_sha256'], '914e492d77149643665815a4d192980dce1507707b736e2b951ea1b866b1c499')
        self.assertEqual(version['changes'], [{'kind':'media','id':removed,'change':'removed','fields':[]}])
