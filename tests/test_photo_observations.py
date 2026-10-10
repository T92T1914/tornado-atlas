"""Synthetic modality checks. These records admit no historical appearance."""
import copy
import hashlib
import json
from datetime import timedelta
from pathlib import Path
import re
import unittest
from unittest.mock import patch

from atlas.event_package import (
    build_event_packages,
    utc,
    validate_appearance_timeline,
    validate_replay,
)


def load_spec():
    text = Path(__file__).with_name("photo-observations.test.mjs").read_text(encoding="utf-8")
    match = re.search(r"/\* PHOTO_CASES\r?\n([\s\S]*?)\r?\nPHOTO_CASES \*/", text)
    if match is None:
        raise ValueError("Shared synthetic photo cases are missing")
    return json.loads(match.group(1))


SPEC = load_spec()


def fixture():
    sequences = []
    for descriptor in SPEC["sequences"]:
        samples = []
        for entry in descriptor["samples"]:
            identity = copy.deepcopy(entry)
            panel = identity.pop("panel_locator")
            sample = copy.deepcopy(SPEC["sample"])
            sample.update(identity)
            sample["image"]["panel_locator"] = panel
            sample["image"]["original_url"] = SPEC["source"]["url"] + "#" + entry["exposure_id"]
            samples.append(sample)
        sequences.append({"id": descriptor["id"], "basis": descriptor["basis"], "samples": samples})
    return {"schema_version": 2, "event": SPEC["event"], "windows": [],
            "photo_sources": [copy.deepcopy(SPEC["source"])], "photo_sequences": sequences}


def at_path(value, path):
    for key in path:
        value = value[key]
    return value


def unique_sample(template, lane, index):
    sample = copy.deepcopy(template)
    identity = f"{lane}-{index}"
    sample["id"] = f"sample-{identity}"
    sample["exposure_id"] = f"exposure-{identity}"
    sample["image"]["panel_locator"] = f"Synthetic panel {identity}"
    sample["reported_utc"] = (
        utc(SPEC["clock"]["start_utc"]) + timedelta(seconds=index)
    ).isoformat().replace("+00:00", "Z")
    return sample


def change(value, changes):
    for step in changes:
        parent = at_path(value, step["path"][:-1])
        key = step["path"][-1]
        operation = step["op"]
        if operation == "delete":
            del parent[key]
        elif operation == "set":
            parent[key] = copy.deepcopy(step["value"])
        elif operation == "copy":
            parent[key] = copy.deepcopy(at_path(value, step["from"]))
        elif operation == "append_copy":
            at_path(value, step["path"]).append(copy.deepcopy(at_path(value, step["from"])))
        elif operation == "reverse":
            at_path(value, step["path"]).reverse()
        elif operation == "repeat":
            parent[key] = (step.get("prefix", "") + step["value"] * step["count"] +
                           step.get("suffix", ""))
        elif operation == "number":
            parent[key] = {"nan": float("nan"), "infinity": float("inf")}[step["value"]]
        elif operation == "fill":
            item = copy.deepcopy(at_path(value, step["from"]))
            parent[key] = [copy.deepcopy(item) for _ in range(step["count"])]
        elif operation == "fill_unique":
            item = copy.deepcopy(at_path(value, step["from"]))
            items = []
            for index in range(step["count"]):
                if step["kind"] == "sources":
                    row = copy.deepcopy(item)
                    if index:
                        row["id"] = f"resource-{index}"
                        row["url"] = f"{item['url']}?resource={index}"
                elif step["kind"] == "sequences":
                    row = copy.deepcopy(item)
                    row["id"] = f"sequence-{index}"
                    row["samples"] = [
                        unique_sample(item["samples"][sample_index % len(item["samples"])],
                                      index, sample_index)
                        for sample_index in range(step.get("sample_count", len(item["samples"])))
                    ]
                elif step["kind"] == "samples":
                    row = unique_sample(item, "filled", index)
                else:
                    raise ValueError(f"Unsupported unique fixture kind {step['kind']}")
                items.append(row)
            parent[key] = items
        else:
            raise ValueError(f"Unsupported fixture operation {operation}")
    return value


def validate(value, sources=None):
    return validate_appearance_timeline(
        value, SPEC["event"], utc(SPEC["clock"]["start_utc"]),
        utc(SPEC["clock"]["end_utc"]), [] if sources is None else sources,
    )


def package_fixture(timeline):
    provenance = {"url": "https://example.test/geography-fixture", "sha256": "a" * 64}

    def properties(role, **extra):
        return {"role": role, "source_url": provenance["url"],
                "source_sha256": provenance["sha256"], **extra}

    features = [
        {"geometry": {"type": "Point", "coordinates": [0, 0]},
         "properties": properties("published_center_position",
                                  utc=SPEC["clock"]["start_utc"], display_time="Synthetic start")},
        {"geometry": {"type": "Point", "coordinates": [1, 1]},
         "properties": properties("published_center_position",
                                  utc=SPEC["clock"]["end_utc"], display_time="Synthetic end")},
        {"geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
         "properties": properties("published_center_path")},
        {"geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
         "properties": properties("published_tornado_outline")},
    ]
    config = {
        "schema_version": 2, "event_id": SPEC["event"], "bundle": "photo-fixture.json",
        "clock": copy.deepcopy(SPEC["clock"]), "geography_source": copy.deepcopy(provenance),
        "coverage": {"positions": "published_minute_samples",
                     "between_positions": "linear_longitude_latitude",
                     "camera": "free_orbit", "appearance": "bounded_timeline"},
    }
    bundle = {
        "exhibit": {"id": SPEC["event"]},
        "geometry": {"source": copy.deepcopy(provenance), "features": features},
        "timeline_media": {"event": SPEC["event"]},
        "footage": {"event": SPEC["event"], "sources": [], "anchors": []},
        "appearance_timeline": copy.deepcopy(timeline),
    }
    if timeline["schema_version"] == 1:
        bundle["footage"]["sources"] = [{"id": "legacy-source"}]
    index = {
        "schema_version": 1, "default_event": SPEC["event"],
        "events": [{"id": SPEC["event"], "title": "Synthetic package",
                    "documentary": "fixture.html", "replay": f"events/{SPEC['event']}.json"}],
    }
    return config, bundle, index


class PhotoObservationTests(unittest.TestCase):
    def test_shared_valid_cases_preserve_input(self):
        for entry in SPEC["valid"]:
            with self.subTest(case=entry["name"]):
                value = change(fixture(), entry["changes"])
                before = copy.deepcopy(value)
                self.assertIs(validate(value), value)
                self.assertEqual(value, before)
                self.assertIs(type(value["schema_version"]), type(before["schema_version"]))

    def test_shared_invalid_cases(self):
        for entry in SPEC["invalid"]:
            with self.subTest(case=entry["name"]), \
                    self.assertRaisesRegex(ValueError, entry.get("error", ".*")):
                validate(change(fixture(), entry["changes"]))

    def test_aggregate_bound_across_otherwise_valid_sequences(self):
        value = fixture()
        template = copy.deepcopy(value["photo_sequences"][0]["samples"][0])
        sequences = []
        for lane in range(16):
            samples = []
            for index in range(17):
                sample = copy.deepcopy(template)
                sample["id"] = f"sample-{lane}-{index}"
                sample["exposure_id"] = f"exposure-{lane}-{index}"
                sample["reported_utc"] = f"2000-01-01T00:00:{index:02d}Z"
                sample["image"]["panel_locator"] = f"Synthetic panel {lane}/{index}"
                samples.append(sample)
            sequences.append({"id": f"sequence-{lane}",
                              "basis": "Authored independent sparse sequence.", "samples": samples})
        value["photo_sequences"] = sequences
        with self.assertRaisesRegex(ValueError, "256"):
            validate(value)

    def test_legacy_windows_and_rejections_in_both_timeline_versions(self):
        for version in (1, 2):
            value = ({"schema_version": 1, "event": SPEC["event"], "windows": []}
                     if version == 1 else fixture())
            value["windows"] = [copy.deepcopy(SPEC["legacy_window"])]
            with self.subTest(version=version):
                self.assertIs(validate(value, [{"id": "legacy-source"}]), value)
            for entry in SPEC["legacy_invalid"]:
                with self.subTest(version=version, case=entry["name"]), self.assertRaises(ValueError):
                    validate(change(copy.deepcopy(value), entry["changes"]), [{"id": "legacy-source"}])
        with self.assertRaisesRegex(ValueError, "footage"):
            validate({"schema_version": 1, "event": SPEC["event"], "windows": []})
        with self.assertRaisesRegex(ValueError, "schema"):
            validate({"schema_version": 1.0, "event": SPEC["event"], "windows": []},
                     [{"id": "legacy-source"}])
        value = fixture()
        value["schema_version"] = 1
        with self.assertRaisesRegex(ValueError, "fields"):
            validate(value, [{"id": "legacy-source"}])
        mixed = fixture()
        mixed["windows"] = [copy.deepcopy(SPEC["legacy_window"])]
        validate(mixed)

    def test_v2_photos_preserve_continuous_registered_footage_requirements(self):
        value = fixture()
        sources = [copy.deepcopy(SPEC["registered_source"])]
        value["windows"] = [copy.deepcopy(SPEC["registered_window"])]
        before = copy.deepcopy((value, sources))
        self.assertIs(validate(value, sources), value)
        self.assertEqual((value, sources), before)
        for entry in SPEC["registered_invalid"]:
            with self.subTest(case=entry["name"]), \
                    self.assertRaisesRegex(ValueError, entry["error"]):
                validate(change(copy.deepcopy(value), entry["changes"]), sources)

    def test_replay_v2_accepts_either_timeline_version_and_preserves_input(self):
        legacy = {"schema_version": 1, "event": SPEC["event"],
                  "windows": [copy.deepcopy(SPEC["legacy_window"])]}
        for timeline in (legacy, fixture()):
            config, bundle, _ = package_fixture(timeline)
            before = copy.deepcopy((config, bundle))
            with self.subTest(version=timeline["schema_version"]):
                validate_replay(config, bundle)
                self.assertEqual((config, bundle), before)
        config, bundle, _ = package_fixture(fixture())
        config["schema_version"] = 1
        config["coverage"]["appearance"] = "illustrative_symbol"
        with self.assertRaisesRegex(ValueError, "schema version 2"):
            validate_replay(config, bundle)

    def test_existing_package_path_binds_exact_bytes_without_filesystem_writes(self):
        legacy = {"schema_version": 1, "event": SPEC["event"],
                  "windows": [copy.deepcopy(SPEC["legacy_window"])]}
        for timeline in (legacy, fixture()):
            config, bundle, index = package_fixture(timeline)
            root = Path("synthetic-package-root")
            config_path = root / "exhibits" / SPEC["event"] / "replay.json"
            documentary = root / "web" / "fixture.html"

            def read_text(path, *args, **kwargs):
                if path != config_path:
                    raise AssertionError(f"Unexpected synthetic read: {path}")
                return json.dumps(config)

            def is_file(path):
                return path == documentary

            with self.subTest(version=timeline["schema_version"]), \
                    patch("atlas.event_package.reviewed_index", return_value=index), \
                    patch.object(Path, "read_text", read_text), \
                    patch.object(Path, "is_file", is_file):
                raw = json.dumps(bundle, ensure_ascii=False).encode("utf-8")
                first = build_event_packages(root, {SPEC["event"]: (config["bundle"], raw)})
                manifest = first[f"events/{SPEC['event']}.json"]
                self.assertEqual(manifest["schema_version"], 2)
                self.assertEqual(manifest["bundle_sha256"], hashlib.sha256(raw).hexdigest())
                self.assertEqual(first[config["bundle"]], raw)
                second_raw = raw + b"\n"
                second = build_event_packages(root, {SPEC["event"]: (config["bundle"], second_raw)})
                second_manifest = second[f"events/{SPEC['event']}.json"]
                self.assertEqual(second_manifest["bundle_sha256"],
                                 hashlib.sha256(second_raw).hexdigest())
                self.assertNotEqual(manifest["bundle_sha256"], second_manifest["bundle_sha256"])
                self.assertEqual(second[config["bundle"]], second_raw)
                if timeline["schema_version"] == 2:
                    bundle["appearance_timeline"]["photo_sequences"][1]["samples"][1]["exposure_id"] = \
                        "exposure-first"
                    with self.assertRaisesRegex(ValueError, "exposure"):
                        build_event_packages(root, {
                            SPEC["event"]: (config["bundle"], json.dumps(bundle).encode("utf-8")),
                        })


if __name__ == "__main__":
    unittest.main()
