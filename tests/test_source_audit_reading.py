import json
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch

from atlas.museum_reading import audit_reading, publish, rendered_audit

ROOT = Path(__file__).resolve().parents[1]
START, END = '<!-- reading:source-audit -->', '<!-- /reading:source-audit -->'


class Reading(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.hrefs, self.words = [], []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.hrefs.append(dict(attrs)['href'])

    def handle_data(self, value):
        self.words.append(value)


def report():
    return {'checked_at': '2026-10-30T23:30:00-05:00',
            'counts': {'reachable': 1, 'access_unresolved': 1, 'missing': 1},
            'results': [
                {'url': 'https://example.org/ok', 'access': 'reachable', 'http_status': 200},
                {'url': 'https://example.org/blocked?a=1&b=2', 'access': 'access_unresolved', 'http_status': 403},
                {'url': 'https://example.org/missing', 'access': 'missing', 'http_status': 404}]}


class SourceAuditReadingTests(unittest.TestCase):
    def test_retained_report_keeps_all_unresolved_sources_and_dated_counts(self):
        raw = json.loads((ROOT / 'web/source-audit.json').read_text(encoding='utf-8'))
        rendered = Reading(audit_reading(raw))
        self.assertIn('2026-09-21', rendered.words)
        self.assertIn('524 distinct URLs, 511 reachable, 13 with unresolved access, 0 returned missing pages', ''.join(rendered.words))
        self.assertEqual(rendered.hrefs, [
            'https://doi.org/10.1175/BAMS-D-13-00221.1',
            'https://doi.org/10.1175/BAMS-D-15-00174.1',
            'https://doi.org/10.1175/MWR-D-15-0367.1',
            'https://doi.org/10.1175/MWR-D-18-0073.1',
            'https://doi.org/10.1175/WAF-D-14-00152.1',
            'https://player.vimeo.com/video/142010192',
            'https://player.vimeo.com/video/143033121',
            'https://www.joplinmo.org/Archive.aspx?ADID=219',
            'https://www.legacy.com/us/obituaries/legacyremembers/dustin-bridges-obituary?id=22638694',
            'https://www.legacy.com/us/obituaries/oklahoman/name/richard-henderson-obituary?id=22636764',
            'https://www.legacy.com/us/obituaries/oklahoman/name/william-oneal-obituary?id=11764894',
            'https://www.nssl.noaa.gov/education/svrwx101/tornadoes/',
            'https://www.tributearchive.com/obituaries/26979897/dustin-bridges'])

    def test_utc_date_and_access_classes_are_not_inferred_from_status(self):
        rendered = audit_reading(report())
        self.assertEqual(rendered.count('target="_blank" rel="noopener"'), 2)
        self.assertIn('>2026-10-31</time>', rendered)
        self.assertIn('datetime="2026-10-30T23:30:00-05:00"', rendered)
        self.assertIn('1 with unresolved access, 1 returned missing pages', rendered)
        self.assertIn('HTTP 403', rendered)
        self.assertIn('HTTP 404', rendered)

    def test_empty_unresolved_list_and_literal_error_text(self):
        value = report()
        value['results'] = value['results'][:1]
        value['counts'] = {'reachable': 1}
        self.assertNotIn('<details>', audit_reading(value))
        value = report()
        value['results'][1].update(http_status=None, error='<script>bad & "quoted"</script>')
        rendered = audit_reading(value)
        self.assertNotIn('<script>', rendered)
        self.assertIn('&lt;script&gt;bad &amp; &quot;quoted&quot;&lt;/script&gt;', rendered)
        self.assertEqual(Reading(rendered).hrefs[0], 'https://example.org/blocked?a=1&b=2')

    def test_invalid_or_ambiguous_reports_fail(self):
        mutations = [
            lambda r: r.update(checked_at='2026-10-30T23:30:00'),
            lambda r: r.update(checked_at='not a timestamp'),
            lambda r: r['counts'].update(reachable=2),
            lambda r: r['counts'].update(reachable=True),
            lambda r: r['counts'].update(other=0),
            lambda r: r['results'][1].update(access='unknown'),
            lambda r: r['results'][1].update(url=r['results'][0]['url']),
            lambda r: r['results'][1].update(url='javascript:alert(1)'),
            lambda r: r['results'][1].update(url='https://user:secret@example.org/'),
            lambda r: r['results'][1].update(url='https://example.org/\nprivate'),
            lambda r: r['results'][1].update(http_status=True),
            lambda r: r['results'][1].update(http_status=700),
            lambda r: r['results'][1].update(http_status=None),
        ]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                value = report()
                mutation(value)
                with self.assertRaises(ValueError):
                    audit_reading(value)

    def test_only_the_single_marked_region_changes(self):
        template = 'before & literal\n' + START + 'old' + END + '\nafter'
        rendered = rendered_audit(template, report())
        self.assertTrue(rendered.startswith('before & literal\n' + START))
        self.assertTrue(rendered.endswith(END + '\nafter'))
        for invalid in ['', START, END + START, START + END + START + END]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                rendered_audit(invalid, report())

    def test_existing_publisher_checks_audit_freshness_without_network(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            web = root / 'web'
            web.mkdir()
            index = web / 'index.html'
            index.write_text('before' + START + 'old' + END + 'after', encoding='utf-8')
            simulator = web / 'reconstruction.html'
            simulator.write_text('<!-- reading:simulator-early-condensation -->same<!-- /reading:simulator-early-condensation -->', encoding='utf-8')
            audit = web / 'source-audit.json'
            audit.write_text(json.dumps(report()), encoding='utf-8')
            original_raw = audit.read_bytes()
            with patch('atlas.museum_reading.rendered_page', side_effect=lambda text, bundle: text), patch('atlas.museum_reading.simulator_early_region', return_value='same'):
                with self.assertRaises(ValueError):
                    publish(root, {}, check=True)
                publish(root, {})
                publish(root, {}, check=True)
                self.assertEqual(audit.read_bytes(), original_raw)
                value = report()
                value['results'][1]['http_status'] = 503
                audit.write_text(json.dumps(value), encoding='utf-8')
                with self.assertRaises(ValueError):
                    publish(root, {}, check=True)
                audit.write_text('{broken', encoding='utf-8')
                with self.assertRaises(ValueError):
                    publish(root, {}, check=True)
                audit.unlink()
                with self.assertRaises(FileNotFoundError):
                    publish(root, {}, check=True)
