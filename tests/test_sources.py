"""A source manifest must identify a verified object inside its own cache."""

import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from atlas.sources import cached_retrieval, read_object, retrieve


class SourceObjectTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name) / "cache"
        (self.root / "raw").mkdir(parents=True)
        self.content = b"Synthetic source bytes, not a historical record."
        self.sha = hashlib.sha256(self.content).hexdigest()
        self.path = self.root / "raw" / self.sha
        self.path.write_bytes(self.content)
        self.metadata = {"url": "https://example.test/source", "sha256": self.sha,
                         "path": f"raw/{self.sha}", "bytes": len(self.content)}

    def test_verified_object_supports_both_recorded_path_separators(self):
        for separator in ("/", "\\"):
            with self.subTest(separator=separator):
                metadata = dict(self.metadata, path=f"raw{separator}{self.sha}")
                self.assertEqual(read_object(metadata, self.root), self.content)

    def test_legacy_record_without_byte_count_still_checks_digest(self):
        metadata = dict(self.metadata)
        del metadata["bytes"]
        self.assertEqual(read_object(metadata, self.root), self.content)
        self.path.write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "integrity"):
            read_object(metadata, self.root)

    def test_metadata_cannot_select_an_external_file_with_matching_hash(self):
        outside = self.root.parent / "outside"
        outside.write_bytes(self.content)
        for path in (str(outside), "../outside", "..\\outside"):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "path"):
                read_object(dict(self.metadata, path=path), self.root)

    def test_only_the_named_content_object_is_valid(self):
        for path in (f"raw/../raw/{self.sha}", f"raw/./{self.sha}",
                     f"raw//{self.sha}", f"raw/{self.sha}/", "raw/another-object"):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "path"):
                read_object(dict(self.metadata, path=path), self.root)

    def test_malformed_metadata_is_rejected_before_reading_bytes(self):
        for changes in ({"path": None}, {"path": []}, {"sha256": None},
                        {"sha256": "x" * 64}, {"sha256": self.sha.upper()},
                        {"bytes": True}, {"bytes": -1}, {"bytes": "45"}):
            with self.subTest(changes=changes), patch.object(
                    Path, "read_bytes", return_value=self.content) as read:
                with self.assertRaises(ValueError):
                    read_object(dict(self.metadata, **changes), self.root)
                read.assert_not_called()

    def test_retrieve_records_portable_path_and_round_trips_exact_bytes(self):
        response = io.BytesIO(self.content)
        response.url = self.metadata["url"]
        response.headers = {"Content-Type": "application/octet-stream"}
        with patch("atlas.sources.urlopen", return_value=response):
            metadata = retrieve(self.metadata["url"], data_dir=self.root)
        self.assertEqual(metadata["path"], f"raw/{self.sha}")
        self.assertEqual(read_object(metadata, self.root), self.content)
        self.assertEqual(cached_retrieval(metadata["url"], self.root), metadata)

    def test_recorded_byte_count_must_match(self):
        with self.assertRaisesRegex(ValueError, "byte count"):
            read_object(dict(self.metadata, bytes=len(self.content) + 1), self.root)

    def test_linked_object_cannot_escape_cache(self):
        outside = self.root.parent / "outside"
        outside.write_bytes(self.content)
        self.path.unlink()
        try:
            self.path.symlink_to(outside)
        except OSError as exc:
            self.skipTest(f"host cannot create symlinks: {exc}")
        with self.assertRaisesRegex(ValueError, "path"):
            read_object(self.metadata, self.root)

    def test_invalid_latest_snapshot_cannot_fall_back_to_old_evidence(self):
        bad = dict(self.metadata, bytes=0)
        (self.root / "retrievals.jsonl").write_text(
            json.dumps(self.metadata) + "\n" + json.dumps(bad) + "\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "byte count"):
            cached_retrieval(self.metadata["url"], self.root)


if __name__ == "__main__":
    unittest.main()
