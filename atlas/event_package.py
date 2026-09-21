"""Versioned geographic replay packages. No historical appearance registration."""
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime
from pathlib import Path

from .history import source_url

COVERAGE = {"positions": "published_minute_samples",
            "between_positions": "linear_longitude_latitude",
            "camera": "free_orbit", "appearance": "illustrative_symbol"}


def fields(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise ValueError(f"Unexpected {label} fields; schema review required")


def asset_path(value, suffix):
    if not isinstance(value, str) or not re.fullmatch(r"(?:[a-z0-9][a-z0-9-]*/)*[a-z0-9][a-z0-9-]*\." + suffix, value):
        raise ValueError("Expected a relative public asset path")


def utc(value):
    if not isinstance(value, str):
        raise ValueError("Expected explicit UTC time")
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.utcoffset() is None or stamp.utcoffset().total_seconds() != 0:
        raise ValueError("Expected explicit UTC time")
    return stamp


def validate_index(index):
    fields(index, ("schema_version", "default_event", "events"), "event index")
    if type(index["schema_version"]) is not int or index["schema_version"] != 1:
        raise ValueError("Unsupported event index version")
    if not isinstance(index["events"], list) or not index["events"]:
        raise ValueError("An event index needs entries")
    seen = set()
    for event in index["events"]:
        fields(event, ("id", "title", "documentary", "replay"), "event")
        if not isinstance(event["id"], str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", event["id"]) or event["id"] in seen:
            raise ValueError("Invalid or duplicate event identity")
        if not isinstance(event["title"], str) or not event["title"].strip():
            raise ValueError("Event title required")
        asset_path(event["documentary"], "html")
        if event["replay"] is not None:
            if event["replay"] != f"events/{event['id']}.json":
                raise ValueError("Replay path must identify its event")
        seen.add(event["id"])
    if index["default_event"] not in seen:
        raise ValueError("Default event is absent")


def validate_replay(config, bundle):
    fields(config, ("schema_version", "event_id", "bundle", "clock", "geography_source", "coverage"), "replay")
    if type(config["schema_version"]) is not int or config["schema_version"] != 1:
        raise ValueError("Unsupported replay version")
    if config["event_id"] != bundle["exhibit"]["id"]:
        raise ValueError("Replay and exhibit identities differ")
    asset_path(config["bundle"], "json")
    if config["coverage"] != COVERAGE:
        raise ValueError("Unsupported coverage; historical appearance needs a reviewed schema")
    clock = config["clock"]
    fields(clock, ("start_utc", "end_utc", "time_zone", "precision", "basis"), "clock")
    start, end = utc(clock["start_utc"]), utc(clock["end_utc"])
    if start >= end or clock["precision"] != "minute" or not isinstance(clock["basis"], str) or not clock["basis"].strip():
        raise ValueError("Invalid clock interval or evidence basis")
    # Windows stdlib Python may have no IANA database. Check identifier syntax
    # here; the browser/Node loader verifies it through Intl before playback.
    if not isinstance(clock["time_zone"], str) or not re.fullmatch(r"[A-Za-z_]+(?:/[A-Za-z_+-]+)*", clock["time_zone"]):
        raise ValueError("Invalid display time zone identifier")
    source = config["geography_source"]
    fields(source, ("url", "sha256"), "geography source")
    source_url(source["url"])
    if not isinstance(source["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", source["sha256"]):
        raise ValueError("Invalid geography source digest")
    if any(bundle["geometry"]["source"].get(key) != value for key, value in source.items()):
        raise ValueError("Geography source differs from reviewed package")
    kinds = {kind: [] for kind in ("Point", "LineString", "Polygon")}
    roles = {"Point": "published_center_position", "LineString": "published_center_path", "Polygon": "published_tornado_outline"}
    for feature in bundle["geometry"]["features"]:
        kind = feature["geometry"]["type"]
        if kind not in kinds or feature["properties"].get("role") != roles[kind]:
            raise ValueError("Unsupported geographic feature role")
        if feature["properties"].get("source_sha256") != source["sha256"] or feature["properties"].get("source_url") != source["url"]:
            raise ValueError("Geographic feature provenance differs")
        kinds[kind].append(feature)
    if len(kinds["Point"]) < 2 or len(kinds["LineString"]) != 1 or len(kinds["Polygon"]) != 1:
        raise ValueError("Replay requires timed points, one path and one outline")
    stamps = [utc(point["properties"]["utc"]) for point in kinds["Point"]]
    if any(not isinstance(point["properties"].get("display_time"), str) or not point["properties"]["display_time"].strip() for point in kinds["Point"]):
        raise ValueError("Source positions need their reviewed display labels")
    if stamps[0] != start or stamps[-1] != end or any(a >= b for a, b in zip(stamps, stamps[1:])):
        raise ValueError("Clock does not match ordered source positions")
    if any(stamp.second or stamp.microsecond for stamp in stamps):
        raise ValueError("Minute coverage cannot imply subminute observations")
    for feature in bundle["geometry"]["features"]:
        coordinates = feature["geometry"]["coordinates"]
        kind = feature["geometry"]["type"]
        points = [coordinates] if kind == "Point" else coordinates if kind == "LineString" else [p for ring in coordinates for p in ring]
        for point in points:
            if len(point) != 2 or not all(type(v) in (int, float) and math.isfinite(v) for v in point) or not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90):
                raise ValueError("Invalid geographic coordinates")
        if kind == "LineString" and len(coordinates) < 2:
            raise ValueError("Replay path needs at least two coordinates")
        if kind == "Polygon" and (len(coordinates) != 1 or any(len(ring) < 4 or ring[0] != ring[-1] for ring in coordinates)):
            raise ValueError("Replay outline must retain closed source rings")
    for key in ("timeline_media", "footage"):
        if bundle[key]["event"] != config["event_id"]:
            raise ValueError("Evidence belongs to a different event")
    if len(bundle["footage"]["sources"]) != 1:
        raise ValueError("Replay currently supports one registered footage source")
    footage_id = bundle["footage"]["sources"][0]["id"]
    for anchor in bundle["footage"]["anchors"]:
        if anchor["source_id"] != footage_id:
            raise ValueError("Footage anchor does not identify the supported source")
        if not start <= utc(anchor["utc"]) <= end:
            raise ValueError("Footage anchor outside geographic coverage")


def publication_artifacts(root: Path, bundle_bytes: bytes, bundle_name="data.json"):
    index = json.loads((root / "exhibits/events.json").read_text(encoding="utf-8"))
    validate_index(index)
    if any(not (root / "web" / entry["documentary"]).is_file() for entry in index["events"]):
        raise ValueError("Registered documentary page is missing")
    bundle = json.loads(bundle_bytes)
    event = next((row for row in index["events"] if row["id"] == bundle["exhibit"]["id"]), None)
    if event is None or event["replay"] is None:
        raise ValueError("Exhibit is not registered for geographic replay")
    config = json.loads((root / "exhibits" / event["id"] / "replay.json").read_text(encoding="utf-8"))
    validate_replay(config, bundle)
    if config["bundle"] != bundle_name:
        raise ValueError("Replay bundle path differs from generated destination")
    package = {**config, "bundle_sha256": hashlib.sha256(bundle_bytes).hexdigest()}
    return {"events.json": index, event["replay"]: package}


def write_packages(web: Path, artifacts):
    for relative, data in artifacts.items():
        path = web / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
