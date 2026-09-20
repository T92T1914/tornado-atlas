import io
import unittest
import zipfile
from datetime import date

from atlas.exhibit import convert_kmz, coordinates, label_time


def kmz(placemarks):
    xml = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' + placemarks + '</Document></kml>'
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as archive:
        archive.writestr('doc.kml', xml)
    return stream.getvalue()


def point(label, coordinate='-98,35,0'):
    return f'<Placemark><name>{label}</name><Point><coordinates>{coordinate}</coordinates></Point></Placemark>'


def convert(content):
    return convert_kmz(content, event_date=date(2013, 5, 31), utc_offset_hours=-5,
                       meridiem='PM', provenance={'url': 'https://example.test/source.kmz', 'sha256': 'test'})


class GeographicEvidenceTests(unittest.TestCase):
    def test_time_order_is_not_archive_order_and_cdt_is_not_cst(self):
        result = convert(kmz(point('6:17') + point('6:16')))
        first = result['features'][0]
        self.assertEqual(first['properties']['source_name'], '6:16')
        self.assertEqual(first['properties']['utc'], '2013-05-31T23:16:00+00:00')
        self.assertEqual(first['geometry']['coordinates'], [-98, 35])

    def test_polygon_hole_and_longitude_latitude_preserved(self):
        ring = '-98,35,0 -97,35,0 -97,36,0 -98,35,0'
        hole = '-97.8,35.1 -97.6,35.1 -97.6,35.2 -97.8,35.1'
        xml = f'<Placemark><name>Outline</name><Polygon><outerBoundaryIs><LinearRing><coordinates>{ring}</coordinates></LinearRing></outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>{hole}</coordinates></LinearRing></innerBoundaryIs></Polygon></Placemark>'
        result = convert(kmz(xml))['features'][0]['geometry']['coordinates']
        self.assertEqual(len(result), 2)
        self.assertEqual(result[1][0], [-97.8, 35.1])

    def test_unclosed_ring_is_not_silently_repaired(self):
        xml = '<Placemark><name>Outline</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-98,35 -97,35 -97,36 -98,36</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>'
        with self.assertRaisesRegex(ValueError, 'closed'):
            convert(kmz(xml))

    def test_missing_or_duplicate_timing_needs_review(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            convert(kmz(point('6:17') + point('6:17')))
        with self.assertRaisesRegex(ValueError, 'explicit'):
            convert(kmz(point('Unknown')))

    def test_invalid_coordinates_do_not_enter_map(self):
        for value in ('nan,35', '-98,inf', '200,35', '-98,91', '', '-98,35,0,4'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                coordinates(value)

    def test_point_cannot_hide_multiple_positions(self):
        with self.assertRaisesRegex(ValueError, 'one coordinate'):
            convert(kmz(point('6:17', '-98,35 -97,36')))

    def test_ambiguous_clock_context_rejected(self):
        with self.assertRaises(ValueError):
            label_time('6:17', event_date=date(2013, 5, 31), utc_offset_hours=-5, meridiem='')
        with self.assertRaises(ValueError):
            label_time('6:75', event_date=date(2013, 5, 31), utc_offset_hours=-5, meridiem='PM')

    def test_entity_declaration_and_empty_archive_rejected(self):
        with self.assertRaises(ValueError):
            convert(kmz('<!DOCTYPE anything>'))
        with self.assertRaises(ValueError):
            convert(kmz(''))

    def test_unsupported_geometry_needs_an_adapter(self):
        with self.assertRaisesRegex(ValueError, 'Unsupported'):
            convert(kmz('<Placemark><name>Model</name><Model/></Placemark>'))

    def test_duplicate_archive_entry_rejected(self):
        import warnings
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive, warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            archive.writestr('doc.kml', '<kml/>')
            archive.writestr('doc.kml', '<kml/>')
        with self.assertRaisesRegex(ValueError, 'one bounded'):
            convert(stream.getvalue())


if __name__ == '__main__':
    unittest.main()
