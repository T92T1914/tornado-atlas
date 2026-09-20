import copy
import unittest

from atlas.reading import validate_reading


class ReadingTests(unittest.TestCase):
    def setUp(self):
        self.documents = {'exhibit': {'id': 'sample', 'introduction_source': 'https://example.org/event'}}
        self.reading = {'schema': 1, 'event': 'sample', 'updated': '2026-09-20', 'sources': [
            {'group': 'Official records', 'title': 'Event account', 'publisher': 'Publisher',
             'url': 'https://example.org/event', 'use': 'Supports the historical introduction.'}]}

    def test_registered_introduction(self):
        validate_reading(self.reading, self.documents)

    def test_unused_source_cannot_pad_bibliography(self):
        source = copy.deepcopy(self.reading['sources'][0])
        source['url'] = 'https://example.org/unread'
        self.reading['sources'].append(source)
        with self.assertRaisesRegex(ValueError, 'not used'):
            validate_reading(self.reading, self.documents)

    def test_duplicate_source_rejected(self):
        self.reading['sources'].append(copy.deepcopy(self.reading['sources'][0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            validate_reading(self.reading, self.documents)

    def test_introduction_requires_its_source(self):
        self.documents['exhibit']['introduction_source'] = 'https://example.org/other'
        self.documents['other_source'] = 'https://example.org/event'
        with self.assertRaisesRegex(ValueError, 'introduction'):
            validate_reading(self.reading, self.documents)

    def test_wrong_event_rejected(self):
        self.reading['event'] = 'another-storm'
        with self.assertRaisesRegex(ValueError, 'identify'):
            validate_reading(self.reading, self.documents)

    def test_unsafe_source_rejected_even_if_cited(self):
        self.reading['sources'][0]['url'] = 'javascript:alert(1)'
        with self.assertRaisesRegex(ValueError, 'HTTPS'):
            validate_reading(self.reading, self.documents)
