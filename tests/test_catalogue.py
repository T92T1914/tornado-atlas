import csv
import gzip
import hashlib
import io
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from atlas.catalogue import connect, import_ncei, search, stats
from atlas.ncei import iter_records, normalize
from atlas.sources import read_object


def sample(**changes):
    row = {"EVENT_ID": "1", "EVENT_TYPE": "Tornado", "YEAR": "2013", "STATE": "OKLAHOMA",
           "CZ_NAME": "CANADIAN", "TOR_F_SCALE": "EF3", "TOR_LENGTH": "2", "TOR_WIDTH": "100",
           "BEGIN_YEARMONTH": "201307", "BEGIN_DAY": "1", "BEGIN_TIME": "1730",
           "END_YEARMONTH": "201307", "END_DAY": "1", "END_TIME": "1740",
           "CZ_TIMEZONE": "CST-6", "BEGIN_LAT": "35", "BEGIN_LON": "-98",
           "END_LAT": "35.1", "END_LON": "-97.9", "DAMAGE_PROPERTY": "",
           "DAMAGE_CROPS": "0", "EVENT_NARRATIVE": "Test fixture, not a historical observation."}
    row.update(changes)
    return row


class NormalizationTests(unittest.TestCase):
    def test_summer_timestamp_uses_source_standard_offset_not_dst(self):
        result = normalize(sample())
        self.assertEqual(result["time"]["begin"]["utc"], "2013-07-01T23:30:00+00:00")

    def test_unknown_timezone_does_not_invent_utc(self):
        result = normalize(sample(CZ_TIMEZONE="CST"))
        self.assertIsNone(result["time"]["begin"]["utc"])
        self.assertEqual(result["time"]["begin"]["local"], "2013-07-01T17:30")

    def test_1950_does_not_turn_into_2050(self):
        result = normalize(sample(YEAR="1950", BEGIN_YEARMONTH="195004", BEGIN_DAY="28"))
        self.assertTrue(result["time"]["begin"]["local"].startswith("1950-04-28"))

    def test_midnight_rollover_and_invalid_minutes(self):
        self.assertEqual(normalize(sample(BEGIN_TIME="2400"))["time"]["begin"]["local"], "2013-07-02T00:00")
        self.assertIsNone(normalize(sample(BEGIN_TIME="2365"))["time"]["begin"]["local"])

    def test_unknown_is_not_zero(self):
        result = normalize(sample())
        self.assertIsNone(result["impacts"]["property_damage"]["nominal_usd"])
        self.assertEqual(result["impacts"]["crop_damage"]["nominal_usd"], 0)
        self.assertIsNone(result["impacts"]["deaths_direct"])

    def test_rating_scales_stay_distinct_and_unrated_is_not_ef0(self):
        self.assertEqual(normalize(sample(TOR_F_SCALE="F3"))["rating"]["scale"], "F")
        self.assertEqual(normalize(sample())["rating"]["scale"], "EF")
        self.assertIsNone(normalize(sample(TOR_F_SCALE="EFU"))["rating"]["value"])

    def test_points_and_width_do_not_become_a_funnel_or_surveyed_track(self):
        result = normalize(sample())
        self.assertEqual(result["spatial"]["begin_point"], [-98, 35])
        self.assertIsNone(result["spatial"]["track"])
        self.assertAlmostEqual(result["dimensions"]["width_m"], 91.44)
        self.assertIsNone(result["dimensions"]["visible_funnel_width_m"])

    def test_invalid_coordinates_and_negative_dimensions_are_flagged(self):
        result = normalize(sample(BEGIN_LAT="0", BEGIN_LON="0", END_LAT="nan", TOR_WIDTH="-9999"))
        self.assertIsNone(result["spatial"]["begin_point"])
        self.assertIsNone(result["spatial"]["end_point"])
        self.assertIsNone(result["dimensions"]["width_m"])
        self.assertGreaterEqual(len(result["quality_notes"]), 3)

    def test_wrong_phenomenon_rejected(self):
        with self.assertRaises(ValueError):
            normalize(sample(EVENT_TYPE="Thunderstorm Wind"))

    def test_overflow_is_unknown_with_source_values_preserved(self):
        raw = '9' * 309 + 'B'
        result = normalize(sample(DAMAGE_PROPERTY=raw, TOR_LENGTH='1e308'))
        self.assertEqual(result['impacts']['property_damage']['reported'], raw)
        self.assertIsNone(result['impacts']['property_damage']['nominal_usd'])
        self.assertEqual(result['dimensions']['reported_length_miles'], 1e308)
        self.assertIsNone(result['dimensions']['length_m'])
        self.assertIn('unparsed_damage_amount:DAMAGE_PROPERTY', result['quality_notes'])
        self.assertIn('unit_conversion_overflow:TOR_LENGTH', result['quality_notes'])
        json.dumps(result, allow_nan=False)

    def test_person_counts_are_integral_and_never_rounded(self):
        for field in ('DEATHS_DIRECT', 'DEATHS_INDIRECT', 'INJURIES_DIRECT', 'INJURIES_INDIRECT'):
            with self.subTest(field=field):
                result = normalize(sample(**{field: '1.5'}))
                self.assertIsNone(result['impacts'][field.lower()])
                self.assertIn(f'invalid_count:{field}', result['quality_notes'])
                self.assertEqual(normalize(sample(**{field: '2'}))['impacts'][field.lower()], 2)
                self.assertEqual(normalize(sample(**{field: '0'}))['impacts'][field.lower()], 0)

    def test_duplicate_csv_header_cannot_silently_replace_source_value(self):
        content = gzip.compress(
            b'EVENT_ID,EVENT_TYPE,YEAR,TOR_F_SCALE,BEGIN_YEARMONTH,TOR_F_SCALE\n'
            b'1,Tornado,2013,EF3,201305,EF0\n')
        with self.assertRaisesRegex(ValueError, 'duplicate.*header'):
            list(iter_records(content))

    def test_truncated_csv_record_is_rejected_with_row_number(self):
        content = gzip.compress(
            b'EVENT_ID,EVENT_TYPE,YEAR,TOR_F_SCALE,BEGIN_YEARMONTH\n'
            b'1,Tornado,2013\n')
        with self.assertRaisesRegex(ValueError, 'Missing columns.*record 2'):
            list(iter_records(content))


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.db = connect(self.root / "test.sqlite3")

    def tearDown(self):
        self.db.close()
        self.folder.cleanup()

    def snapshot(self, rows, revision="20260323"):
        buffer = io.StringIO(newline="")
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
        content = gzip.compress(buffer.getvalue().encode(), mtime=0)
        sha = hashlib.sha256(content).hexdigest()
        (self.root / "raw").mkdir(exist_ok=True)
        (self.root / "raw" / sha).write_bytes(content)
        return {"url": f"https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2013_c{revision}.csv.gz",
                "sha256": sha, "path": f"raw/{sha}", "retrieved_at": "2026-09-20T00:00:00+00:00"}

    def test_idempotent_import_keeps_exact_raw_record(self):
        raw = sample(EVENT_NARRATIVE="A literal % and _ and 日本 test.")
        meta = self.snapshot([raw])
        self.assertEqual(import_ncei(self.db, meta, self.root)["status"], "imported")
        self.assertEqual(import_ncei(self.db, meta, self.root)["status"], "already_imported")
        self.assertEqual(stats(self.db)["current_source_records"], 1)
        stored = self.db.execute("SELECT raw_record FROM records").fetchone()[0]
        self.assertEqual(json.loads(stored), raw)
        self.assertEqual(len(search(self.db, "%")), 1)
        self.assertEqual(len(search(self.db, "' OR 1=1 --")), 0)

    def test_revised_year_replaces_current_set_without_erasing_history(self):
        import_ncei(self.db, self.snapshot([sample(), sample(EVENT_ID="2")]), self.root)
        import_ncei(self.db, self.snapshot([sample(TOR_F_SCALE="EF2")], "20260920"), self.root)
        self.assertEqual(stats(self.db)["current_source_records"], 1)
        self.assertEqual(len(search(self.db, rating="EF2")), 1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM records").fetchone()[0], 3)

    def test_older_import_cannot_replace_newer_revision(self):
        import_ncei(self.db, self.snapshot([sample(TOR_F_SCALE="EF2")], "20260920"), self.root)
        import_ncei(self.db, self.snapshot([sample()], "20260323"), self.root)
        self.assertEqual(search(self.db)[0]["rating"]["reported"], "EF2")

    def test_duplicate_id_rolls_back_entire_revision(self):
        import_ncei(self.db, self.snapshot([sample()]), self.root)
        with self.assertRaises(Exception):
            import_ncei(self.db, self.snapshot([sample(), sample()], "20260920"), self.root)
        self.assertEqual(stats(self.db)["source_snapshots"], 1)
        self.assertEqual(stats(self.db)["current_source_records"], 1)

    def test_same_publisher_revision_with_different_bytes_needs_review(self):
        import_ncei(self.db, self.snapshot([sample()]), self.root)
        with self.assertRaisesRegex(ValueError, "different bytes"):
            import_ncei(self.db, self.snapshot([sample(TOR_F_SCALE="EF2")]), self.root)

    def test_integrity_failure_prevents_import(self):
        meta = self.snapshot([sample()])
        (self.root / meta["path"]).write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "integrity"):
            read_object(meta, self.root)
        with self.assertRaises(ValueError):
            import_ncei(self.db, meta, self.root)
        self.assertEqual(stats(self.db)["source_snapshots"], 0)

    def test_nonfinite_normalized_value_rolls_back_revision(self):
        import_ncei(self.db, self.snapshot([sample()]), self.root)
        raw = sample(TOR_F_SCALE='EF2')
        record = normalize(raw)
        record['dimensions']['length_m'] = float('inf')
        with patch('atlas.catalogue.iter_records', return_value=iter([(2, raw, record)])):
            with self.assertRaises(ValueError):
                import_ncei(self.db, self.snapshot([raw], '20260920'), self.root)
        self.assertEqual(stats(self.db)['source_snapshots'], 1)
        self.assertEqual(search(self.db)[0]['rating']['reported'], 'EF3')


if __name__ == "__main__":
    unittest.main()
