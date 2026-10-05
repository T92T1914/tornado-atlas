"""Forecast issue clocks must remain separate from warning and event evidence."""

import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest
from urllib.parse import parse_qs, urlsplit

from atlas.archive import digest, dossiers, validate_dossier

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'tuscaloosa-birmingham-2011'
SOURCE = 'bmx-pre-event-outlooks'
OBSERVATION = 'pre-event-outlook-progression'
URL = 'https://www.weather.gov/bmx/event_04272011hwo'
PRIOR = '35b450a43834125500a844d47856b6248f24bc00defcc6d746ecafdf8da6544a'
WARNING_SHA = 'f0b3a4ff2c42e16e6c43f2540f4ad714bfd2dfc6854a0d19b2769b4f96e5468e'
ISSUES = [('2011-04-22T06:49', 'April 22, 2011', '6:49 a.m. CDT'),
          ('2011-04-26T05:54', 'April 26, 2011', '5:54 a.m. CDT'),
          ('2011-04-27T03:19', 'April 27, 2011', '3:19 a.m. CDT')]


class OutlookHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.times, self.rows, self.text = [], [], [], [], []
        self.depth = 0
        self.row = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'div' and attrs.get('id') == 'pre-event-outlooks':
            self.depth = 1
        elif self.depth and tag not in {'br', 'img', 'hr', 'input', 'meta', 'link'}:
            self.depth += 1
        if self.depth:
            if tag == 'a':
                self.links.append(attrs['href'])
            if tag == 'time':
                self.times.append(attrs['datetime'])
            if tag == 'li':
                self.row = []
                self.rows.append(self.row)

    def handle_endtag(self, tag):
        if self.depth:
            if tag == 'li':
                self.row = None
            if tag not in {'br', 'img', 'hr', 'input', 'meta', 'link'}:
                self.depth -= 1

    def handle_data(self, text):
        if self.depth:
            self.text.append(text)
            if self.row is not None:
                self.row.append(text)


class TuscaloosaOutlookHTMLTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = (ROOT / 'web/tuscaloosa.html').read_bytes()
        cls.html = cls.raw.decode('utf-8')
        cls.view = OutlookHTML()
        cls.view.feed(cls.html)

    def test_three_native_rows_preserve_exact_printed_issue_clocks(self):
        self.assertEqual(self.view.times, [row[0] for row in ISSUES])
        self.assertEqual(len(self.view.rows), 3)
        for text, (_, date, clock) in zip(self.view.rows, ISSUES):
            self.assertIn(date, ' '.join(text))
            self.assertIn(clock, ' '.join(text))
        self.assertIn('aria-label="Regional outlook issue times"', self.html)
        self.assertIn('class="documentary-timeline"', self.html)
        self.assertEqual(len(self.view.ids), len(set(self.view.ids)))
        self.assertIn('href="#pre-event-outlooks"', self.html)

    def test_new_text_explains_forecast_scope_and_routes_without_alignment(self):
        text = ' '.join(self.view.text)
        for required in ('regional outlooks', 'forecast issue times',
                         'not tornado arrival', 'warning lead time',
                         'individual reception', 'publication date is unknown'):
            self.assertIn(required, text)
        self.assertLessEqual(len(re.findall(r"\b[\w'-]+\b", text)), 150)
        self.assertIn(URL, self.view.links)
        for field, identifier in [('source', SOURCE), ('observation', OBSERVATION)]:
            href = next(url for url in self.view.links if f'{field}=' in url)
            parsed = urlsplit(href)
            self.assertEqual(parsed.path, 'dossier.html')
            self.assertEqual(parse_qs(parsed.query), {'event': [EVENT], field: [identifier]})
            self.assertEqual(parsed.fragment, f'{field}-{identifier}')
        for forbidden in ('UTC', 'C:/Users/', 'C:\\Users\\', '\u2014', '\u2013', 'access_token'):
            self.assertNotIn(forbidden, text)

    def test_original_warning_chapter_survives_without_prose_or_link_changes(self):
        start = self.raw.index(b'<section id="warnings"')
        end = self.raw.index(b'</section>', start) + len(b'</section>')
        warning = self.raw[start:end]
        retained, count = re.subn(
            rb'\r?\n        <div id="pre-event-outlooks".*?</div>\r?\n      ',
            b'', warning, flags=re.S)
        self.assertEqual(count, 1)
        self.assertEqual(hashlib.sha256(retained).hexdigest(), WARNING_SHA)


class TuscaloosaOutlookPublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = next(doc for doc in dossiers() if doc['id'] == EVENT)
        cls.prior = json.loads((ROOT / 'web/archive' / f'{EVENT}-{PRIOR[:20]}.json').read_text(encoding='utf-8'))
        cls.source = next(source for source in cls.doc['sources'] if source['id'] == SOURCE)
        cls.item = next(item for item in cls.doc['observations'] if item['id'] == OBSERVATION)

    def test_new_forecast_observation_preserves_unregistered_source_status(self):
        self.assertEqual(self.source['url'], URL)
        self.assertEqual(self.item['source_id'], SOURCE)
        for field, value in {'assertion': 'source_reported', 'temporal': 'source_label',
                             'spatial': 'unregistered', 'availability': 'reviewed_available',
                             'rights': 'links_only'}.items():
            self.assertEqual(self.item['status'][field], value)
        for clock in ('capture', 'publication', 'video', 'alignment'):
            self.assertIsNone(self.item['time'][clock])
        self.assertIsNone(self.item['place']['coordinates'])
        self.assertIs(validate_dossier(self.doc), self.doc)

    def test_current_publication_keeps_every_prior_evidence_value(self):
        self.assertEqual(digest(self.prior), PRIOR)
        for field in ('title', 'coverage', 'summary', 'records', 'creators', 'media', 'reconstruction'):
            self.assertEqual(self.doc[field], self.prior[field], field)
        self.assertEqual(self.doc['sources'][:-1], self.prior['sources'])
        self.assertEqual(self.doc['observations'][:-1], self.prior['observations'])
        self.assertEqual(self.doc['provenance']['publication_review']['previous_dossier_sha256'], PRIOR)

    def test_forecast_context_cannot_acquire_a_guessed_map_point(self):
        doc = copy.deepcopy(self.doc)
        next(item for item in doc['observations'] if item['id'] == OBSERVATION)['place']['coordinates'] = [-87.54, 33.21]
        with self.assertRaisesRegex(ValueError, 'Unregistered evidence cannot acquire a map point'):
            validate_dossier(doc)


if __name__ == '__main__':
    unittest.main()
