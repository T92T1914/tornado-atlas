import copy
import json
import unittest
from pathlib import Path
from atlas.footage import load_footage, validate_footage


class FootageTests(unittest.TestCase):
    def setUp(self):
        self.data = copy.deepcopy(load_footage())

    def test_preserved_register_is_valid(self):
        validate_footage(self.data)

    def test_player_rejects_duplicate_versions(self):
        self.data['sources'].append(copy.deepcopy(self.data['sources'][0]))
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_two_sources_keep_separate_samples_at_the_same_second(self):
        source = copy.deepcopy(self.data['sources'][0])
        source.update(id='synthetic-other-source', video_id='abcdefghijk',
                      url='https://www.youtube.com/watch?v=abcdefghijk')
        anchor = copy.deepcopy(self.data['anchors'][0])
        anchor.update(id='synthetic-other-anchor', source_id=source['id'], video_seconds=20)
        self.data['sources'].append(source)
        self.data['anchors'].insert(1, anchor)
        validate_footage(self.data)
        self.data['anchors'].insert(2, copy.deepcopy(anchor))
        with self.assertRaisesRegex(ValueError, 'distinct'):
            validate_footage(self.data)

    def test_bounded_source_count_and_unknown_source_are_rejected(self):
        self.data['anchors'][0]['source_id'] = 'not-in-register'
        with self.assertRaisesRegex(ValueError, 'known source'):
            validate_footage(self.data)
        self.data['sources'] *= 9
        with self.assertRaisesRegex(ValueError, 'one to eight'):
            validate_footage(self.data)

    def test_rejects_invented_continuous_coverage(self):
        self.data['anchors'][0]['end_utc'] = self.data['anchors'][1]['utc']
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_unverified_camera_coordinate(self):
        self.data['anchors'][0]['coordinates'] = [-97.9, 35.48]
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_non_utc_clock(self):
        self.data['anchors'][0]['utc'] = '2013-05-31T18:17:03'
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_browser_incompatible_or_subsecond_anchor_times(self):
        for value in ('20130531T231703Z', '2013-W22-5T23:17:03Z',
                      '2013-05-31T23:17:03.125Z'):
            with self.subTest(value=value):
                self.data['anchors'][0]['utc'] = value
                with self.assertRaises(ValueError):
                    validate_footage(self.data)

    def test_second_precision_anchors_keep_both_supported_utc_suffixes(self):
        for suffix in ('Z', '+00:00'):
            with self.subTest(suffix=suffix):
                self.data['anchors'][0]['utc'] = '2013-05-31T23:17:03' + suffix
                validate_footage(self.data)

    def test_rejects_wrong_video_version(self):
        self.data['sources'][0]['video_id'] = '0Wdv6zsvsI0'
        with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_out_of_range_seek(self):
        for value in (-1, float('nan'), float('inf'), 1000):
            self.data['anchors'][0]['video_seconds'] = value
            with self.assertRaises(ValueError): validate_footage(self.data)

    def test_rejects_duplicate_or_reversed_utc(self):
        self.data['anchors'][1]['utc'] = self.data['anchors'][0]['utc']
        with self.assertRaises(ValueError): validate_footage(self.data)


REGISTER = Path(__file__).resolve().parents[1] / 'research/robinson-shot-register-2026-11-16.json'


class ShotRegisterTests(unittest.TestCase):
    """The reviewed shot register of the Robinson upload, checked inside a copy of the footage register."""

    def setUp(self):
        self.data = copy.deepcopy(load_footage())
        self.register = json.loads(REGISTER.read_text(encoding='utf-8'))
        self.data['shot_register'] = self.register
        self.passages = {p['id']: p for p in self.register['passages']}

    def drop_transition(self, identity):
        self.register['transitions'] = [t for t in self.register['transitions'] if t['id'] != identity]

    def test_reviewed_register_is_admitted_beside_the_published_anchors(self):
        validate_footage(self.data)
        self.assertEqual([p['id'] for p in self.register['passages']], ['forward-1', 'rear-1', 'forward-2', 'forward-3'])
        self.assertEqual([t['kind'] for t in self.register['transitions']],
                         ['fade_in', 'dissolve', 'hard_cut', 'caption_jump', 'fade_out'])

    def test_published_footage_register_carries_no_shot_register_yet(self):
        self.assertNotIn('shot_register', load_footage())

    def test_two_passages_cannot_touch_without_a_transition(self):
        self.drop_transition('switch-to-rear')
        self.passages['rear-1']['start'] = {'video_seconds': 353.12, 'clock_label': '6:22:45 PM CDT',
                                            'utc': '2013-05-31T23:22:45Z'}
        with self.assertRaisesRegex(ValueError, 'separated by a transition'):
            validate_footage(self.data)

    def test_the_review_must_cover_the_whole_copy(self):
        self.register['cut_review']['end_seconds'] = 800.0
        self.drop_transition('closing-fade')
        self.passages['forward-3']['end'] = {'video_seconds': 800.0, 'clock_label': '6:29:31 PM CDT',
                                             'utc': '2013-05-31T23:29:31Z'}
        with self.assertRaisesRegex(ValueError, 'whole inspected copy'):
            validate_footage(self.data)

    def test_an_anchor_read_inside_a_transition_is_refused(self):
        self.register['transitions'][0]['end_seconds'] = 6.006
        self.passages['forward-1']['start'] = {'video_seconds': 6.006, 'clock_label': '6:17:04 PM CDT',
                                               'utc': '2013-05-31T23:17:04Z'}
        with self.assertRaisesRegex(ValueError, 'anchor read must sit inside a passage'):
            validate_footage(self.data)

    def test_a_copy_duration_that_is_not_a_number_is_refused(self):
        self.register['reference_copy']['video_seconds'] = float('nan')
        with self.assertRaisesRegex(ValueError, 'player duration'):
            validate_footage(self.data)

    def test_a_malformed_register_raises_a_value_error(self):
        self.register['transitions'] = None
        with self.assertRaisesRegex(ValueError, 'Invalid shot register'):
            validate_footage(self.data)

    def test_stamp_offsets_either_side_of_midnight_still_compare(self):
        rear = [c for c in self.register['stamp_comparisons'] if c['camera'] == 'rear']
        rear[0]['stamp'] = '2012/07/23- 18:22:51'
        rear[1]['stamp'] = '2012/07/23- 18:25:09'
        rear[2]['stamp'] = '2012/07/23- 18:27:07'
        validate_footage(self.data)
        rear[2]['stamp'] = '2012/07/23- 18:27:09'
        with self.assertRaisesRegex(ValueError, 'one offset'):
            validate_footage(self.data)

    def test_a_passage_across_the_cut_is_refused(self):
        self.passages['rear-1']['end'] = copy.deepcopy(self.passages['forward-2']['end'])
        self.register['passages'].remove(self.passages['forward-2'])
        with self.assertRaisesRegex(ValueError, 'cannot cross a transition'):
            validate_footage(self.data)
        self.drop_transition('cut-to-forward')
        with self.assertRaisesRegex(ValueError, 'measured rate'):
            validate_footage(self.data)

    def test_a_caption_step_inside_one_camera_passage_is_refused(self):
        self.passages['forward-2']['end'] = copy.deepcopy(self.passages['forward-3']['end'])
        self.register['passages'].remove(self.passages['forward-3'])
        self.drop_transition('caption-step')
        with self.assertRaisesRegex(ValueError, 'measured rate'):
            validate_footage(self.data)

    def test_a_passage_needs_a_read_clock_at_both_ends(self):
        del self.passages['forward-1']['end']['clock_label']
        with self.assertRaisesRegex(ValueError, 'read clock'):
            validate_footage(self.data)

    def test_utc_must_be_the_label_that_was_read(self):
        self.passages['forward-1']['start']['utc'] = '2013-05-31T23:17:01Z'
        with self.assertRaisesRegex(ValueError, 'differs from the clock label'):
            validate_footage(self.data)

    def test_a_gap_in_the_review_is_refused(self):
        self.drop_transition('caption-step')
        with self.assertRaisesRegex(ValueError, 'without gaps'):
            validate_footage(self.data)

    def test_the_inspected_copy_must_match_the_player_duration(self):
        self.register['reference_copy']['video_seconds'] = 860.0
        with self.assertRaisesRegex(ValueError, 'player duration'):
            validate_footage(self.data)

    def test_every_published_anchor_needs_a_matching_read(self):
        self.register['anchor_reads'][6]['clock_label'] = '6:29:13 PM CDT'
        with self.assertRaisesRegex(ValueError, 'disagrees with the published anchor'):
            validate_footage(self.data)
        self.register['anchor_reads'].pop()
        with self.assertRaisesRegex(ValueError, 'one read'):
            validate_footage(self.data)

    def test_a_camera_stamp_keeps_one_offset_inside_a_passage(self):
        comparison = next(c for c in self.register['stamp_comparisons'] if c['video_seconds'] == 700.0)
        comparison['stamp'] = '2013/05/31- 18:31:41'
        with self.assertRaisesRegex(ValueError, 'one offset'):
            validate_footage(self.data)

    def test_the_forward_stamp_shows_the_caption_basis_changing_between_passages(self):
        offsets = {}
        for item in self.register['stamp_comparisons']:
            if item['camera'] != 'forward':
                continue
            passage = next(p['id'] for p in self.register['passages']
                           if p['start']['video_seconds'] <= item['video_seconds'] <= p['end']['video_seconds'])
            hour, minute, second = (int(x) for x in item['stamp'].split(' ')[1].split(':'))
            clock = [int(x) for x in item['clock_label'].split(' ')[0].split(':')]
            offsets.setdefault(passage, set()).add(hour * 3600 + minute * 60 + second
                                                   - ((clock[0] + 12) * 3600 + clock[1] * 60 + clock[2]))
        self.assertEqual(offsets, {'forward-1': {273}, 'forward-2': {229, 230}, 'forward-3': {219}})
