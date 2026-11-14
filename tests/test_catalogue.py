import contextlib
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
from atlas.sources import first_retrieval, published_retrievals, read_object


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


class FirstRetrievalTests(unittest.TestCase):
    URL = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2013_c20260323.csv.gz"
    FIRST = "2026-09-20T08:30:10.335058+00:00"
    REFETCH = "2026-11-13T21:04:00.000000+00:00"

    def refetch(self, sha="a" * 64, url=URL, retrieved_at=REFETCH):
        return {"url": url, "sha256": sha, "path": f"raw/{sha}", "retrieved_at": retrieved_at}

    def test_byte_identical_refetch_keeps_first_retrieval_time(self):
        kept = first_retrieval(self.refetch(), [{"url": self.URL, "sha256": "a" * 64, "retrieved_at": self.FIRST}])
        self.assertEqual(kept["retrieved_at"], self.FIRST)
        self.assertEqual(kept["refetched_at"], self.REFETCH)

    def test_changed_bytes_or_another_revision_keep_their_own_time(self):
        earlier = [{"url": self.URL, "sha256": "a" * 64, "retrieved_at": self.FIRST}]
        for metadata in (self.refetch(sha="b" * 64), self.refetch(url=self.URL.replace("c20260323", "c20261026"))):
            with self.subTest(metadata=metadata):
                self.assertIs(first_retrieval(metadata, earlier), metadata)

    def test_earliest_of_several_matching_retrievals_wins(self):
        # As text the first entry sorts earlier. As instants the second one is.
        earlier = [{"url": self.URL, "sha256": "a" * 64, "retrieved_at": "2026-09-20T23:00:00-05:00"},
                   {"url": self.URL, "sha256": "a" * 64, "retrieved_at": "2026-09-21T01:00:00+00:00"}]
        self.assertEqual(first_retrieval(self.refetch(), earlier)["retrieved_at"], "2026-09-21T01:00:00+00:00")

    def test_later_matching_entry_does_not_move_the_time(self):
        metadata = self.refetch(retrieved_at=self.FIRST)
        earlier = [{"url": self.URL, "sha256": "a" * 64, "retrieved_at": self.REFETCH}]
        self.assertIs(first_retrieval(metadata, earlier), metadata)

    def test_retrieval_time_without_offset_is_rejected(self):
        earlier = [{"url": self.URL, "sha256": "a" * 64, "retrieved_at": "2026-09-20T08:30:10"}]
        with self.assertRaisesRegex(ValueError, "UTC offset"):
            first_retrieval(self.refetch(), earlier)

    def test_published_index_supplies_cited_retrievals(self):
        with tempfile.TemporaryDirectory() as folder:
            index = Path(folder) / "index.json"
            self.assertEqual(published_retrievals(index), [])
            index.write_text(json.dumps({"sources": {"ncei:2013:20260323": {
                "snapshot_id": "ncei:2013:20260323", "source_url": self.URL,
                "sha256": "a" * 64, "retrieved_at": self.FIRST}}}), encoding="utf-8")
            self.assertEqual(published_retrievals(index),
                             [{"url": self.URL, "sha256": "a" * 64, "retrieved_at": self.FIRST}])

    def test_cli_refetch_keeps_published_time_and_a_new_revision_gets_its_own(self):
        from atlas.__main__ import main

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "raw").mkdir()
            files = {}
            for year, revision, rating in (("2012", "20260323", "EF2"), ("2013", "20260323", "EF3"),
                                           ("2012", "20261026", "EF1")):
                buffer = io.StringIO(newline="")
                rows = [sample(EVENT_ID=year, YEAR=year, BEGIN_YEARMONTH=f"{year}07",
                               END_YEARMONTH=f"{year}07", TOR_F_SCALE=rating)]
                writer = csv.DictWriter(buffer, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
                content = gzip.compress(buffer.getvalue().encode(), mtime=0)
                sha = hashlib.sha256(content).hexdigest()
                (root / "raw" / sha).write_bytes(content)
                url = self.URL.replace("d2013_c20260323", f"d{year}_c{revision}")
                files[(year, revision)] = {"url": url, "sha256": sha, "path": f"raw/{sha}",
                                           "bytes": len(content), "retrieved_at": self.REFETCH}
            index = root / "index.json"
            index.write_text(json.dumps({"sources": {
                f"ncei:{year}:{revision}": {"snapshot_id": f"ncei:{year}:{revision}", "source_url": item["url"],
                                            "sha256": item["sha256"], "retrieved_at": self.FIRST}
                for (year, revision), item in files.items() if revision == "20260323"}}), encoding="utf-8")
            current = [files[("2012", "20261026")], files[("2013", "20260323")]]
            output = io.StringIO()
            with (patch("sys.argv", ["atlas", "--data-dir", str(root), "import-ncei", "--years", "2012", "2013",
                                     "--published-catalogue", str(index)]),
                  patch("atlas.__main__.discover_ncei", return_value=[item["url"] for item in current]),
                  patch("atlas.__main__.retrieve", side_effect=current),
                  contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO())):
                main()
            database = connect(root / "catalogue.sqlite3")
            try:
                times = {record["year"]: record["provenance"]["retrieved_at"] for record in search(database)}
            finally:
                database.close()
            self.assertEqual(times, {2012: self.REFETCH, 2013: self.FIRST})

    def test_cli_keeps_the_first_logged_time_when_the_cache_returns_a_later_line(self):
        from atlas.__main__ import main

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "raw").mkdir()
            buffer = io.StringIO(newline="")
            writer = csv.DictWriter(buffer, fieldnames=list(sample()))
            writer.writeheader()
            writer.writerow(sample())
            content = gzip.compress(buffer.getvalue().encode(), mtime=0)
            sha = hashlib.sha256(content).hexdigest()
            (root / "raw" / sha).write_bytes(content)
            entry = {"url": self.URL, "sha256": sha, "path": f"raw/{sha}", "bytes": len(content)}
            (root / "retrievals.jsonl").write_text(
                json.dumps({**entry, "retrieved_at": self.FIRST}) + "\n\n"
                + json.dumps({**entry, "retrieved_at": self.REFETCH}) + "\n", encoding="utf-8")
            with (patch("sys.argv", ["atlas", "--data-dir", str(root), "import-ncei", "--years", "2013",
                                     "--published-catalogue", str(root / "absent.json")]),
                  patch("atlas.__main__.discover_ncei", return_value=[self.URL]),
                  patch("atlas.__main__.retrieve") as retrieval,
                  contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO())):
                main()
            retrieval.assert_not_called()
            database = connect(root / "catalogue.sqlite3")
            try:
                record = search(database)[0]
                stored = json.loads(database.execute("SELECT metadata FROM snapshots").fetchone()[0])
            finally:
                database.close()
            self.assertEqual(record["provenance"]["retrieved_at"], self.FIRST)
            self.assertEqual((stored["retrieved_at"], stored["refetched_at"]), (self.FIRST, self.REFETCH))


if __name__ == "__main__":
    unittest.main()
