"""Constructed source rows exercise the Japanese adapter without networking."""

import csv
import contextlib
import hashlib
import gzip
import io
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atlas.catalogue import connect, import_jma, import_ncei, search, search_jma_cases, stats
from atlas.jma import HEADERS, PHENOMENA, URL, iter_cases, normalize


def row(identifier="2000010101", **changes):
    cells = ["-9999"] * 89
    cells[0:9] = [identifier, "1", "2000", "1", "1", "12", "30", "10", "30"]
    cells[9:20] = ["35", "30", "0", "-8888", "139", "45", "0", "10", "44", "東京都", "構成した試験事例"]
    cells[35:38] = ["-9999", "未設定", ""]
    cells[38:42] = ["0", "10", "2", "4"]
    cells[46:48] = ["1", "1"]
    for index in range(78, 88, 2):
        cells[index + 1] = "未設定"
    for index, value in changes.items():
        cells[int(index)] = value
    return cells


def csv_bytes(rows, header=HEADERS):
    text = io.StringIO(newline="")
    writer = csv.writer(text)
    writer.writerow(header)
    writer.writerows(rows)
    return text.getvalue().encode("cp932")


class JMANormalizationTests(unittest.TestCase):
    def test_all_classes_are_preserved_and_only_code_one_is_confirmed(self):
        for code, (kind, original) in PHENOMENA.items():
            with self.subTest(code=code):
                result = normalize(row(**{"1": code}))
                self.assertEqual(result["classification"], kind)
                self.assertEqual(result["classification_reported"], original)
                self.assertEqual(result["confirmed_tornado"], code == "1")

    def test_duplicate_blank_headers_and_prefecture_names_remain_ordered(self):
        source = row()
        source[79], source[81] = "第一", "第二"
        [(number, raw, record)] = list(iter_cases(csv_bytes([source])))
        self.assertEqual(number, 2)
        self.assertEqual(raw, {"headers": list(HEADERS), "values": source})
        self.assertEqual(raw["values"][79:82:2], ["第一", "第二"])
        self.assertEqual(record["administrative_area"], "東京都")

    def test_unknown_unset_and_zero_counts_do_not_collapse(self):
        result = normalize(row(**{"54": "-9999", "56": "-8888", "58": "0"}))
        self.assertEqual(result["impacts"]["死者"]["count"]["status"], "unset")
        self.assertEqual(result["impacts"]["負傷者合計"]["count"]["status"], "unknown")
        self.assertEqual(result["impacts"]["負傷者(重傷)"]["count"]["value"], 0)

    def test_shared_scope_can_name_another_case_and_is_not_summed(self):
        result = normalize(row(**{"54": "2", "55": "2000010102"}))
        self.assertEqual(result["impacts"]["死者"]["shared_scope_reported"], "2000010102")
        self.assertEqual(result["impacts"]["死者"]["aggregation"], "not_aggregated")
        self.assertNotIn("deaths_direct", result["impacts"])

    def test_f_and_jef_cutoff_and_rating_intervals_are_distinct(self):
        before = normalize(row(**{"2": "2016", "3": "3", "4": "31"}))
        after = normalize(row(**{"2": "2016", "3": "4", "4": "1", "47": "3"}))
        self.assertEqual(before["rating"]["reported"], "F1")
        self.assertEqual(after["rating"]["reported"], "JEF1..JEF3")
        self.assertIsNone(after["rating"]["value"])
        self.assertEqual(after["rating"]["maximum"], 3)
        unresolved = normalize(row(**{"2": "2016", "3": "-8888"}))
        self.assertIsNone(unresolved["rating"]["scale"])

    def test_time_precision_and_uncertainty_do_not_invent_utc(self):
        result = normalize(row())
        time = result["time"]["begin"]
        self.assertEqual(time["local"], "2000-01-01T12:30")
        self.assertIsNone(time["utc"])
        self.assertIsNone(time["zone"])
        self.assertEqual(time["uncertainty_minus_minutes"]["value"], 10)
        self.assertEqual(time["uncertainty_plus_minutes"]["value"], 30)
        self.assertIsNone(normalize(row(**{"6": "-8888"}))["time"]["begin"]["local"])
        invalid = normalize(row(**{"5": "24"}))
        self.assertIsNone(invalid["time"]["begin"]["local"])
        self.assertIn("invalid_calendar_time:column_3", invalid["quality_notes"])

    def test_dms_positions_retain_uncertainty_without_a_track(self):
        result = normalize(row())
        self.assertEqual(result["spatial"]["begin_point"], [139.75, 35.5])
        self.assertEqual(result["spatial"]["begin"]["reported_components"][3]["status"], "unknown")
        self.assertIsNone(result["spatial"]["track"])
        self.assertIsNone(normalize(row(**{"10": "60"}))["spatial"]["begin_point"])
        self.assertIsNone(normalize(row(**{"9": "-8888"}))["spatial"]["begin_point"])

    def test_length_units_and_intervals_do_not_become_a_funnel_width(self):
        result = normalize(row())
        self.assertEqual(result["dimensions"]["length_interval"]["minimum_m"], 200)
        self.assertEqual(result["dimensions"]["length_interval"]["maximum_m"], 400)
        self.assertEqual(result["dimensions"]["width_interval"]["minimum_m"], 0)
        self.assertIsNone(result["dimensions"]["width_m"])
        self.assertIsNone(result["dimensions"]["visible_funnel_width_m"])
        invalid = normalize(row(**{"40": "1e308", "41": "1e308"}))
        self.assertIsNone(invalid["dimensions"]["length_interval"]["maximum_m"])
        json.dumps(invalid, allow_nan=False)

    def test_schema_and_malformed_classification_require_review(self):
        bad_header = list(HEADERS)
        bad_header[17], bad_header[18] = bad_header[18], bad_header[17]
        for content in (csv_bytes([row()], bad_header), csv_bytes([row()[:-1]]), csv_bytes([row() + ["extra"]])):
            with self.subTest(content=content[:20]), self.assertRaises(ValueError):
                list(iter_cases(content))
        with self.assertRaises(ValueError):
            normalize(row(**{"1": "99"}))


class JMAImportTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.connection = connect(self.root / "catalogue.sqlite3")

    def tearDown(self):
        self.connection.close()
        self.folder.cleanup()

    def metadata(self, rows, modified="Wed, 30 Sep 2026 06:10:03 GMT"):
        content = csv_bytes(rows)
        sha = hashlib.sha256(content).hexdigest()
        (self.root / "raw").mkdir(exist_ok=True)
        (self.root / "raw" / sha).write_bytes(content)
        return {"url": URL, "resolved_url": URL, "last_modified": modified,
                "retrieved_at": "2026-10-02T00:00:00+00:00", "bytes": len(content),
                "sha256": sha, "path": "raw/" + sha}

    def test_all_cases_are_retained_but_search_counts_only_confirmed_tornadoes(self):
        rows = [row(f"20000101{number:02}", **{"1": str(number)}) for number in range(1, 10)]
        metadata = self.metadata(rows)
        result = import_jma(self.connection, metadata, self.root)
        self.assertEqual((result["cases"], result["records"]), (9, 1))
        self.assertEqual(stats(self.connection)["current_source_records"], 1)
        self.assertEqual(len(search(self.connection, country="jp")), 1)
        self.assertEqual(search(self.connection, country="US"), [])
        self.assertEqual(len(search_jma_cases(self.connection)), 9)
        self.assertEqual([item["classification"] for item in search_jma_cases(self.connection, classification_code="6")], ["unknown"])
        retained = self.connection.execute("SELECT raw_record FROM jma_cases ORDER BY id").fetchall()
        self.assertEqual(len(retained), 9)
        self.assertEqual(json.loads(retained[0][0])["values"], rows[0])
        self.assertEqual(import_jma(self.connection, metadata, self.root)["status"], "already_imported")

    def test_new_revision_replaces_current_cases_but_preserves_old_source(self):
        import_jma(self.connection, self.metadata([row()]), self.root)
        new = self.metadata([row("2000010102")], "Thu, 01 Oct 2026 06:10:03 GMT")
        import_jma(self.connection, new, self.root)
        self.assertEqual([item["id"] for item in search(self.connection)], ["jma:2000010102"])
        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM jma_cases").fetchone()[0], 2)
        self.assertEqual([item["id"] for item in search_jma_cases(self.connection)], ["jma:2000010102"])

    def test_duplicate_or_malformed_revision_rolls_back_and_keeps_old_current(self):
        import_jma(self.connection, self.metadata([row()]), self.root)
        for rows in ([row("2000010102"), row("2000010102")], [row("2000010102"), row("2000010103", **{"1": "99"})]):
            with self.subTest(rows=rows), self.assertRaises((ValueError, sqlite3.IntegrityError)):
                import_jma(self.connection, self.metadata(rows, "Thu, 01 Oct 2026 06:10:03 GMT"), self.root)
            self.assertEqual(stats(self.connection)["source_snapshots"], 1)
            self.assertEqual([item["id"] for item in search(self.connection)], ["jma:2000010101"])

    def test_changed_same_revision_and_bad_integrity_do_not_rewrite_source(self):
        import_jma(self.connection, self.metadata([row()]), self.root)
        with self.assertRaisesRegex(ValueError, "different bytes"):
            import_jma(self.connection, self.metadata([row("2000010102")]), self.root)
        changed = self.metadata([row("2000010102")], "Thu, 01 Oct 2026 06:10:03 GMT")
        (self.root / changed["path"]).write_bytes(b"changed")
        with self.assertRaises(ValueError):
            import_jma(self.connection, changed, self.root)
        self.assertEqual(stats(self.connection)["source_snapshots"], 1)

    def test_unversioned_empty_or_no_confirmed_revision_requires_review(self):
        for rows, modified in (([], "Wed, 30 Sep 2026 06:10:03 GMT"), ([row(**{"1": "6"})], "Wed, 30 Sep 2026 06:10:03 GMT"), ([row()], "")):
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                import_jma(self.connection, self.metadata(rows, modified), self.root)
        self.assertEqual(stats(self.connection)["source_snapshots"], 0)

    def test_actual_cli_import_and_country_search_use_the_separate_cache(self):
        from atlas.__main__ import main

        metadata = self.metadata([row(), row("2000010102", **{"1": "6"})])
        metadata_path = self.root / "retrieval.json"
        metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
        self.connection.close()
        self.connection = connect(self.root / "unused.sqlite3")
        calls = [(["import-jma", "--metadata", str(metadata_path)], lambda v: v["records"] == 1),
                 (["search", "--country", "JP"], lambda v: len(v) == 1 and v[0]["id"] == "jma:2000010101"),
                 (["jma-cases", "--classification-code", "6"], lambda v: len(v) == 1 and not v[0]["confirmed_tornado"])]
        for arguments, check in calls:
            output = io.StringIO()
            with (self.subTest(arguments=arguments),
                  patch("sys.argv", ["atlas", "--data-dir", str(self.root), *arguments]),
                  patch("atlas.__main__.retrieve") as retrieval,
                  contextlib.redirect_stdout(output)):
                main()
                retrieval.assert_not_called()
                self.assertTrue(check(json.loads(output.getvalue())))

    def test_pending_international_browser_export_cannot_replace_the_old_index(self):
        from atlas.publication import export_catalogue

        import_jma(self.connection, self.metadata([row()]), self.root)
        destination = self.root / "published"
        destination.mkdir()
        original = b"preserved original index"
        (destination / "index.json").write_bytes(original)
        with (patch("atlas.publication.write_bytes") as write,
              self.assertRaisesRegex(ValueError, "reviewed browser presentation")):
            export_catalogue(self.connection, destination, {})
        write.assert_not_called()
        self.assertEqual((destination / "index.json").read_bytes(), original)

    def test_noaa_partition_and_country_filters_survive_a_mixed_local_catalogue(self):
        source = {"EVENT_ID": "1", "EVENT_TYPE": "Tornado", "YEAR": "2000", "STATE": "TEST",
                  "CZ_NAME": "CONSTRUCTED", "TOR_F_SCALE": "F1", "BEGIN_YEARMONTH": "200001",
                  "BEGIN_DAY": "1", "BEGIN_TIME": "1230", "CZ_TIMEZONE": "CST-6"}
        text = io.StringIO(newline="")
        writer = csv.DictWriter(text, fieldnames=list(source))
        writer.writeheader()
        writer.writerow(source)
        content = gzip.compress(text.getvalue().encode(), mtime=0)
        sha = hashlib.sha256(content).hexdigest()
        (self.root / "raw").mkdir(exist_ok=True)
        (self.root / "raw" / sha).write_bytes(content)
        metadata = {"url": "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d2000_c20261001.csv.gz",
                    "sha256": sha, "path": "raw/" + sha, "bytes": len(content),
                    "retrieved_at": "2026-10-02T00:00:00+00:00"}
        import_ncei(self.connection, metadata, self.root)
        import_jma(self.connection, self.metadata([row(), row("2000010102", **{"1": "7"})]), self.root)
        self.assertEqual(stats(self.connection)["current_source_records"], 2)
        self.assertEqual([item["id"] for item in search(self.connection, country="US")], ["ncei:1"])
        self.assertEqual([item["id"] for item in search(self.connection, country="JP")], ["jma:2000010101"])
        self.assertEqual(len(search_jma_cases(self.connection)), 2)

    def test_cli_cache_and_refresh_paths_make_only_the_requested_retrieval(self):
        from atlas.__main__ import main

        metadata = self.metadata([row()])
        self.connection.close()
        self.connection = connect(self.root / "unused.sqlite3")
        for refresh in (False, True):
            arguments = ["atlas", "--data-dir", str(self.root), "import-jma"] + (["--refresh"] if refresh else [])
            with (self.subTest(refresh=refresh), patch("sys.argv", arguments),
                  patch("atlas.__main__.cached_retrieval", return_value=metadata) as cache,
                  patch("atlas.__main__.retrieve", return_value=metadata) as retrieval,
                  contextlib.redirect_stdout(io.StringIO())):
                main()
                if refresh:
                    cache.assert_not_called()
                    retrieval.assert_called_once_with(URL, data_dir=self.root, max_bytes=16_000_000)
                else:
                    cache.assert_called_once_with(URL, data_dir=self.root)
                    retrieval.assert_not_called()


if __name__ == "__main__":
    unittest.main()
