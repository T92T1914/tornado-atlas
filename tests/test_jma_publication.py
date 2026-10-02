"""Source-aware static exports must verify the archive before publishing."""
import contextlib
import gzip
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atlas.catalogue import connect, import_jma
from atlas.jma import URL
from atlas.jma_publication import export_jma_cases
from atlas.publication import write_bytes
from test_jma import csv_bytes, row


class JMAPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.connection = connect(self.root / "catalogue.sqlite3")
        self.rows = [row(), row("2000010102", **{"1": "6"}),
                     row("2000010103", **{"1": "7", "54": "2", "55": "2000010101"})]
        self.metadata = self.retain(self.rows)
        import_jma(self.connection, self.metadata, self.root)
        self.destination = self.root / "published"

    def tearDown(self):
        self.connection.close()
        self.temporary.cleanup()

    def retain(self, rows, modified="Wed, 30 Sep 2026 06:10:03 GMT"):
        content = csv_bytes(rows)
        digest = hashlib.sha256(content).hexdigest()
        (self.root / "raw").mkdir(exist_ok=True)
        (self.root / "raw" / digest).write_bytes(content)
        return {"url": URL, "sha256": digest, "path": "raw/" + digest,
                "bytes": len(content), "retrieved_at": "2026-10-02T00:00:00+00:00",
                "last_modified": modified}

    def publish(self):
        return export_jma_cases(self.connection, self.destination, self.root)

    def untouched_failure(self, exception=ValueError):
        self.destination.mkdir(exist_ok=True)
        old = b"prior index"
        (self.destination / "index.json").write_bytes(old)
        with patch("atlas.jma_publication.write_bytes") as writer, self.assertRaises(exception):
            self.publish()
        writer.assert_not_called()
        self.assertEqual(list(self.destination.iterdir()), [self.destination / "index.json"])
        self.assertEqual((self.destination / "index.json").read_bytes(), old)
        self.assertFalse(self.connection.in_transaction)

    def test_all_classes_source_attribution_and_immutable_details_are_exported(self):
        result = self.publish()
        self.assertEqual((result["cases"], result["classified_tornado_records"]), (3, 1))
        content = (self.destination / "index.json").read_bytes()
        self.assertEqual(gzip.decompress((self.destination / "index.json.gz").read_bytes()), content)
        index = json.loads(content)
        self.assertEqual(index["coverage"]["classification_counts"], {"1": 1, "6": 1, "7": 1})
        self.assertEqual(index["source"]["sha256"], self.metadata["sha256"])
        self.assertNotIn("path", index["source"])
        self.assertIn("Japan Meteorological Agency", index["attribution"])
        self.assertIn("not a JMA publication", index["transformation"])
        self.assertEqual(len(index["records"]), 3)
        details = {}
        for item in index["details"]:
            value = (self.destination / item["path"]).read_bytes()
            self.assertEqual(hashlib.sha256(value).hexdigest(), item["sha256"])
            self.assertEqual(len(value), item["bytes"])
            details.update(json.loads(value))
        uncertain = details["jma:2000010103"]
        self.assertFalse(uncertain["confirmed_tornado"])
        self.assertEqual(uncertain["impacts"]["死者"]["shared_scope_reported"], "2000010101")
        self.assertEqual(uncertain["impacts"]["死者"]["aggregation"], "not_aggregated")
        self.assertIsNone(uncertain["time"]["begin"]["zone"])
        self.assertIsNone(uncertain["spatial"]["datum"])
        self.assertIsNone(uncertain["wind"]["unit"])
        self.assertFalse(self.connection.in_transaction)

    def test_repeated_export_is_deterministic_and_retains_old_detail_objects(self):
        self.publish()
        before = {p.relative_to(self.destination).as_posix(): p.read_bytes()
                  for p in self.destination.rglob("*") if p.is_file()}
        self.publish()
        self.assertEqual(before, {p.relative_to(self.destination).as_posix(): p.read_bytes()
                                 for p in self.destination.rglob("*") if p.is_file()})
        new = self.retain([row("2000010104")], "Thu, 01 Oct 2026 06:10:03 GMT")
        import_jma(self.connection, new, self.root)
        self.publish()
        index = json.loads((self.destination / "index.json").read_bytes())
        self.assertEqual([r["id"] for r in index["records"]], ["jma:2000010104"])
        for name, content in before.items():
            if name.startswith("details/"):
                self.assertEqual((self.destination / name).read_bytes(), content)

    def test_source_corruption_is_rejected_before_any_output_changes(self):
        path = self.root / self.metadata["path"]
        path.write_bytes(b"X" + path.read_bytes()[1:])
        self.untouched_failure()

    def test_boolean_numeric_alias_in_saved_payload_is_not_trusted(self):
        source = self.connection.execute("SELECT payload FROM jma_cases WHERE id='jma:2000010101'").fetchone()[0]
        payload = json.loads(source)
        payload["rating"]["minimum"] = True
        self.connection.execute("UPDATE jma_cases SET payload=? WHERE id='jma:2000010101'", (json.dumps(payload),))
        self.connection.commit()
        self.untouched_failure()

    def test_raw_row_mutation_is_rejected(self):
        raw = json.loads(self.connection.execute("SELECT raw_record FROM jma_cases LIMIT 1").fetchone()[0])
        raw["values"][19] = "changed"
        self.connection.execute("UPDATE jma_cases SET raw_record=? WHERE id='jma:2000010101'", (json.dumps(raw),))
        self.connection.commit()
        self.untouched_failure()

    def test_omitted_extra_and_mislocated_cases_are_rejected(self):
        for statement in ("DELETE FROM jma_cases WHERE id='jma:2000010102'",
                          "UPDATE jma_cases SET csv_record=99 WHERE id='jma:2000010102'",
                          "UPDATE jma_cases SET classification_code='2' WHERE id='jma:2000010102'"):
            with self.subTest(statement=statement):
                self.connection.execute("SAVEPOINT test_change")
                self.connection.execute(statement)
                self.connection.execute("RELEASE test_change")
                self.untouched_failure()
                self.connection.execute("DELETE FROM jma_cases")
                self.connection.execute("DELETE FROM records")
                self.connection.execute("DELETE FROM snapshots")
                self.connection.commit()
                import_jma(self.connection, self.metadata, self.root)

    def test_pending_caller_transaction_is_neither_committed_nor_rolled_back(self):
        self.connection.execute("UPDATE jma_cases SET classification_code='2' WHERE id='jma:2000010102'")
        with self.assertRaisesRegex(ValueError, "caller"):
            self.publish()
        self.assertTrue(self.connection.in_transaction)
        self.assertFalse(self.destination.exists())
        self.assertEqual(self.connection.execute("SELECT classification_code FROM jma_cases WHERE id='jma:2000010102'").fetchone()[0], "2")
        self.connection.rollback()

    def test_case_and_processed_byte_limits_fail_before_writing(self):
        for name, value in (("MAX_CASES", 2), ("MAX_PROCESSED_BYTES", 20)):
            with self.subTest(name=name), patch("atlas.jma_publication." + name, value):
                self.untouched_failure()

    def test_write_failure_retains_an_existing_index_and_source_database(self):
        self.destination.mkdir()
        (self.destination / "index.json").write_bytes(b"old index")
        calls = 0
        def fail_after_one(path, content):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("constructed storage failure")
            write_bytes(path, content)
        with patch("atlas.jma_publication.write_bytes", side_effect=fail_after_one), self.assertRaises(OSError):
            self.publish()
        self.assertEqual((self.destination / "index.json").read_bytes(), b"old index")
        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM jma_cases").fetchone()[0], 3)
        self.assertFalse(self.connection.in_transaction)

    def test_snapshot_identity_mutation_is_rejected(self):
        self.connection.execute("UPDATE snapshots SET sha256=?", ("0" * 64,))
        self.connection.commit()
        self.untouched_failure()

    def test_cli_publishes_only_to_the_selected_local_destination_without_network(self):
        from atlas.__main__ import main
        self.connection.close()
        self.connection = connect(self.root / "unused.sqlite3")
        output = io.StringIO()
        with patch("sys.argv", ["atlas", "--data-dir", str(self.root), "publish-jma", "--output", str(self.destination)]), patch("atlas.__main__.retrieve") as network, contextlib.redirect_stdout(output):
            main()
        network.assert_not_called()
        self.assertEqual(json.loads(output.getvalue())["cases"], 3)
        self.assertEqual(len(json.loads((self.destination / "index.json").read_bytes())["records"]), 3)
