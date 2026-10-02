"""Failure controls for the checked-in source-case publication validator."""
import gzip
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from atlas.catalogue import connect, import_jma
from atlas.jma import URL
from atlas.jma_publication import export_jma_cases, encoded
from test_jma import csv_bytes, row
from tools.check_jma_cases import validate

class StaticJMACasesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        content = csv_bytes([row(), row("2000010102", **{"1": "6"})])
        digest = hashlib.sha256(content).hexdigest()
        (self.root / "raw").mkdir()
        (self.root / "raw" / digest).write_bytes(content)
        metadata = {"url": URL, "sha256": digest, "path": "raw/" + digest,
                    "bytes": len(content), "retrieved_at": "2026-10-02T00:00:00+00:00",
                    "last_modified": "Wed, 30 Sep 2026 06:10:03 GMT"}
        connection = connect(self.root / "catalogue.sqlite3")
        import_jma(connection, metadata, self.root)
        self.folder = self.root / "published"
        export_jma_cases(connection, self.folder, self.root)
        connection.close()
        self.index = json.loads((self.folder / "index.json").read_bytes())

    def tearDown(self):
        self.temp.cleanup()

    def write_index(self):
        content = encoded(self.index)
        (self.folder / "index.json").write_bytes(content)
        (self.folder / "index.json.gz").write_bytes(gzip.compress(content, mtime=0))

    def mutate_detail(self, change):
        record = self.index["records"][0]
        old = record["detail_file"]
        group = json.loads((self.folder / old).read_bytes())
        change(group[record["id"]])
        content = encoded(group)
        digest = hashlib.sha256(content).hexdigest()
        new = old.split("-")[0] + "-" + digest[:20] + ".json"
        (self.folder / new).write_bytes(content)
        for item in self.index["details"]:
            if item["path"] == old:
                item.update(path=new, sha256=digest, bytes=len(content))
        for item in self.index["records"]:
            if item["detail_file"] == old:
                item["detail_file"] = new
        self.write_index()

    def test_complete_publication_is_verified(self):
        self.assertEqual(validate(self.folder)["cases"], 2)
        self.assertEqual(validate(self.folder)["classified_tornado_records"], 1)

    def test_hash_mismatch_is_rejected(self):
        path = self.folder / self.index["details"][0]["path"]
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "bytes"):
            validate(self.folder)

    def test_coverage_and_companion_mismatch_are_rejected(self):
        self.index["coverage"]["source_cases"] = 3
        self.write_index()
        with self.assertRaisesRegex(ValueError, "Coverage"):
            validate(self.folder)
        (self.folder / "index.json.gz").write_bytes(gzip.compress(b"{}"))
        with self.assertRaisesRegex(ValueError, "Gzip"):
            validate(self.folder)

    def test_escaped_detail_path_is_rejected(self):
        self.index["details"][0]["path"] = "../outside.json"
        self.write_index()
        with self.assertRaisesRegex(ValueError, "filename"):
            validate(self.folder)

    def test_rehashed_wrong_index_field_is_rejected(self):
        self.mutate_detail(lambda detail: detail.update(year=True))
        with self.assertRaisesRegex(ValueError, "Indexed field"):
            validate(self.folder)

    def test_rehashed_unsupported_inference_is_rejected(self):
        self.mutate_detail(lambda detail: detail["time"]["begin"].update(zone="UTC"))
        with self.assertRaisesRegex(ValueError, "inference"):
            validate(self.folder)

    def test_rehashed_ending_timezone_is_rejected(self):
        self.mutate_detail(lambda detail: detail["time"]["end"].update(zone="UTC"))
        with self.assertRaisesRegex(ValueError, "inference"):
            validate(self.folder)

    def test_rehashed_ending_utc_is_rejected(self):
        self.mutate_detail(lambda detail: detail["time"]["end"].update(utc="2026-01-01T00:00:00+00:00"))
        with self.assertRaisesRegex(ValueError, "inference"):
            validate(self.folder)

    def test_rehashed_interpolation_is_rejected(self):
        self.mutate_detail(lambda detail: detail["spatial"].update(interpolation="linear"))
        with self.assertRaisesRegex(ValueError, "inference"):
            validate(self.folder)

    def test_rehashed_visible_funnel_width_is_rejected(self):
        self.mutate_detail(lambda detail: detail["dimensions"].update(visible_funnel_width_m=15))
        with self.assertRaisesRegex(ValueError, "inference"):
            validate(self.folder)

    def test_rehashed_damage_midpoint_is_rejected(self):
        self.mutate_detail(lambda detail: detail["dimensions"].update(length_m=1500))
        with self.assertRaisesRegex(ValueError, "inference"):
            validate(self.folder)

    def test_rehashed_observed_reconstruction_is_rejected(self):
        self.mutate_detail(lambda detail: detail["reconstruction"].update(observed_appearance="reviewed"))
        with self.assertRaisesRegex(ValueError, "inference"):
            validate(self.folder)

    def test_rehashed_source_mismatch_is_rejected(self):
        self.mutate_detail(lambda detail: detail["provenance"].update(sha256="0" * 64))
        with self.assertRaisesRegex(ValueError, "provenance"):
            validate(self.folder)

    def test_unindexed_case_is_rejected(self):
        self.index["records"].pop()
        self.write_index()
        with self.assertRaisesRegex(ValueError, "Unindexed"):
            validate(self.folder)
