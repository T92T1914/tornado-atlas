"""Versioned geographic replay and evidence-qualified appearance packages."""
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlsplit

from .history import source_url
from .cameras import validate_camera_context

COVERAGE = {"positions": "published_minute_samples",
            "between_positions": "linear_longitude_latitude",
            "camera": "free_orbit", "appearance": "illustrative_symbol"}
TIMELINE_COVERAGE = {**COVERAGE, "appearance": "bounded_timeline"}


def fields(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise ValueError(f"Unexpected {label} fields; schema review required")


def asset_path(value, suffix):
    if not isinstance(value, str) or not re.fullmatch(r"(?:[a-z0-9][a-z0-9-]*/)*[a-z0-9][a-z0-9-]*\." + suffix, value):
        raise ValueError("Expected a relative public asset path")


def utc(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|\+00:00)", value):
        raise ValueError("Expected normalized UTC time with whole seconds")
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.utcoffset() is None or stamp.utcoffset().total_seconds() != 0:
        raise ValueError("Expected explicit UTC time")
    return stamp


def _text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Appearance {label} requires nonempty text")


def _number(value, label, minimum=None, maximum=None):
    try:
        finite = type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        finite = False
    if (not finite or
            (minimum is not None and value < minimum) or
            (maximum is not None and value > maximum)):
        raise ValueError(f"Invalid appearance {label}")


def _appearance_url(value):
    _text(value, "source locator")
    if any(character.isspace() or ord(character) < 32 for character in value) or "\\" in value:
        raise ValueError("Invalid appearance source locator")
    parsed = urlsplit(value)
    try:
        parsed.port
    except ValueError as error:
        raise ValueError("Invalid appearance source locator") from error
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Appearance sources require public HTTPS without credentials")


def _validate_registration(registration, source, start, end):
    # This admits an explicit evidence record. It cannot authenticate inspection,
    # calibration or rights claims, and assigns no physical scale to form presets.
    fields(registration, ("source", "inspection", "timing", "camera", "rights", "uncertainty"), "appearance registration")
    identity = registration["source"]
    fields(identity, ("url", "video_id", "original_locator", "edit_identity", "sha256", "identity_basis"), "appearance source identity")
    for name in ("url", "original_locator"):
        _appearance_url(identity[name])
    for name in ("video_id", "edit_identity", "identity_basis"):
        _text(identity[name], name)
    if identity["url"] != source.get("url") or identity["video_id"] != source.get("video_id"):
        raise ValueError("Appearance edit identity differs from the selected footage source")
    digest = identity["sha256"]
    if digest is not None and (not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest)):
        raise ValueError("Invalid appearance media digest")
    inspection = registration["inspection"]
    fields(inspection, ("status", "start_video_seconds", "end_video_seconds", "reviewed_on", "discontinuities", "basis"), "appearance inspection")
    if inspection["status"] != "continuous_video_inspected":
        raise ValueError("Registered appearance requires continuous video inspection")
    if inspection["discontinuities"] != "none_observed":
        raise ValueError("Registered appearance cannot bridge a source discontinuity")
    _number(source.get("duration_seconds"), "source duration", 0)
    for name in ("start_video_seconds", "end_video_seconds"):
        _number(inspection[name], name, 0, source["duration_seconds"])
    if inspection["start_video_seconds"] >= inspection["end_video_seconds"]:
        raise ValueError("Appearance inspection requires a positive source interval")
    reviewed = inspection["reviewed_on"]
    if not isinstance(reviewed, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", reviewed):
        raise ValueError("Appearance review requires YYYY-MM-DD")
    date.fromisoformat(reviewed)
    _text(inspection["basis"], "inspection basis")
    timing = registration["timing"]
    fields(timing, ("method", "anchors", "uncertainty_seconds", "basis"), "appearance timing")
    if timing["method"] != "linear_verified":
        raise ValueError("Unsupported appearance time registration")
    _number(timing["uncertainty_seconds"], "time uncertainty", 0)
    if timing["uncertainty_seconds"] == 0:
        raise ValueError("Appearance clock uncertainty must remain explicit and positive")
    _text(timing["basis"], "timing basis")
    anchors = timing["anchors"]
    if not isinstance(anchors, list) or not 3 <= len(anchors) <= 128:
        raise ValueError("Appearance timing needs endpoints and an inspected interior anchor")
    stamps = []
    for index, anchor in enumerate(anchors):
        fields(anchor, ("video_seconds", "utc"), "appearance time anchor")
        _number(anchor["video_seconds"], "video anchor", inspection["start_video_seconds"], inspection["end_video_seconds"])
        stamp = utc(anchor["utc"])
        if index and (stamp <= stamps[-1] or anchor["video_seconds"] <= anchors[index - 1]["video_seconds"]):
            raise ValueError("Appearance time anchors must be strictly ordered")
        stamps.append(stamp)
    if stamps[0] != start or stamps[-1] != end:
        raise ValueError("Appearance time anchors do not bound the registered window")
    if (anchors[0]["video_seconds"] != inspection["start_video_seconds"] or
            anchors[-1]["video_seconds"] != inspection["end_video_seconds"]):
        raise ValueError("Appearance time anchors do not bound the inspected source interval")
    historical_span = (end - start).total_seconds()
    first_video, last_video = anchors[0]["video_seconds"], anchors[-1]["video_seconds"]
    for anchor, stamp in zip(anchors[1:-1], stamps[1:-1]):
        predicted = (anchor["video_seconds"] - first_video) * historical_span / (last_video - first_video)
        if abs((stamp - start).total_seconds() - predicted) > timing["uncertainty_seconds"] + 1e-9:
            raise ValueError("Appearance time anchors disagree with linear registration")
    camera = registration["camera"]
    fields(camera, ("mode", "coordinates", "bearing_degrees", "pitch_degrees", "roll_degrees", "position_uncertainty_m", "orientation_uncertainty_degrees", "lens_calibration", "basis"), "appearance camera")
    if camera["mode"] != "fixed_view":
        raise ValueError("Appearance schema supports a qualified fixed view only")
    coordinates = camera["coordinates"]
    if not isinstance(coordinates, list) or len(coordinates) != 2:
        raise ValueError("Appearance camera requires longitude and latitude")
    _number(coordinates[0], "camera longitude", -180, 180)
    _number(coordinates[1], "camera latitude", -90, 90)
    _number(camera["bearing_degrees"], "camera bearing", 0, 360)
    if camera["bearing_degrees"] == 360:
        raise ValueError("Appearance bearing must be below 360 degrees")
    _number(camera["pitch_degrees"], "camera pitch", -90, 90)
    _number(camera["roll_degrees"], "camera roll", -180, 180)
    _number(camera["position_uncertainty_m"], "position uncertainty", 0)
    _number(camera["orientation_uncertainty_degrees"], "orientation uncertainty", 0, 180)
    for name in ("lens_calibration", "basis"):
        _text(camera[name], "camera " + name)
    rights = registration["rights"]
    fields(rights, ("reuse", "creator", "uploader", "rights_holder", "basis"), "appearance rights")
    if rights["reuse"] != "external_links_only":
        raise ValueError("Appearance schema permits original source links only")
    for name in ("creator", "uploader", "rights_holder", "basis"):
        _text(rights[name], "rights " + name)
    if rights["creator"] != source.get("creator"):
        raise ValueError("Appearance creator differs from the selected footage source")
    _text(registration["uncertainty"], "registration uncertainty")
    return {(stamp - start).total_seconds() / historical_span: anchor["video_seconds"]
            for anchor, stamp in zip(anchors, stamps)}


def validate_appearance_timeline(timeline, event_id, start, end, footage_sources):
    """Check bounded normalized forms and the evidence required for admission."""
    fields(timeline, ("schema_version", "event", "windows"), "appearance timeline")
    if type(timeline["schema_version"]) is not int or timeline["schema_version"] != 1 or timeline["event"] != event_id:
        raise ValueError("Appearance timeline identity or schema differs")
    windows = timeline["windows"]
    if not isinstance(windows, list) or len(windows) > 16:
        raise ValueError("Appearance timeline requires at most 16 bounded windows")
    if not isinstance(footage_sources, list) or not 1 <= len(footage_sources) <= 8:
        raise ValueError("Appearance timeline requires reviewed footage source identities")
    sources = {}
    for source in footage_sources:
        if (not isinstance(source, dict) or not isinstance(source.get("id"), str) or
                not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", source["id"]) or source["id"] in sources):
            raise ValueError("Invalid or duplicate appearance footage source identity")
        sources[source["id"]] = source
    ids, lane_ends = set(), {}
    previous_start = None
    for window in windows:
        fields(window, ("id", "start_utc", "end_utc", "source_id", "kind", "basis", "registration", "keys"), "appearance window")
        identifier = window["id"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identifier) or identifier in ids:
            raise ValueError("Invalid or duplicate appearance window identity")
        ids.add(identifier)
        window_start, window_end = utc(window["start_utc"]), utc(window["end_utc"])
        if not start <= window_start < window_end <= end or (previous_start is not None and window_start < previous_start):
            raise ValueError("Appearance windows must be ordered within replay coverage")
        previous_start = window_start
        _text(window["basis"], "window basis")
        source_id = window["source_id"]
        registered_keys = None
        if window["kind"] == "illustrative":
            if source_id is not None or window["registration"] is not None:
                raise ValueError("Illustrative appearance cannot claim source registration")
        elif window["kind"] == "registered":
            if not isinstance(source_id, str) or source_id not in sources:
                raise ValueError("Registered appearance requires a matching footage source")
            registered_keys = _validate_registration(window["registration"], sources[source_id], window_start, window_end)
        else:
            raise ValueError("Unsupported appearance window kind")
        if source_id in lane_ends and window_start <= lane_ends[source_id]:
            raise ValueError("Appearance windows overlap within the same source")
        lane_ends[source_id] = window_end
        keys = window["keys"]
        if not isinstance(keys, list) or not 2 <= len(keys) <= 64:
            raise ValueError("Appearance window requires two through 64 form keys")
        for index, key in enumerate(keys):
            fields(key, ("at", "shape", "extent", "label"), "appearance form key")
            _number(key["at"], "form key position", 0, 1)
            _number(key["extent"], "condensation extent", 0, 1)
            if not isinstance(key["shape"], str) or key["shape"] not in {"cone", "wedge", "rope"}:
                raise ValueError("Unsupported normalized appearance form")
            _text(key["label"], "form observation")
            if index and key["at"] <= keys[index - 1]["at"]:
                raise ValueError("Appearance form keys must be strictly ordered")
        if keys[0]["at"] != 0 or keys[-1]["at"] != 1:
            raise ValueError("Appearance form keys must cover their own window")
        if registered_keys is not None and any(key["at"] not in registered_keys for key in keys):
            raise ValueError("Observed appearance form keys require an exact inspected timing anchor")
    return timeline


def validate_index(index):
    fields(index, ("schema_version", "default_event", "events"), "event index")
    if type(index["schema_version"]) is not int or index["schema_version"] not in (1, 2):
        raise ValueError("Unsupported event index version")
    if not isinstance(index["events"], list) or not index["events"]:
        raise ValueError("An event index needs entries")
    seen = set()
    for event in index["events"]:
        fields(event, ("id", "title", "documentary", "replay") + (("chronology",) if index["schema_version"] == 2 else ()), "event")
        if not isinstance(event["id"], str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", event["id"]) or event["id"] in seen:
            raise ValueError("Invalid or duplicate event identity")
        if not isinstance(event["title"], str) or not event["title"].strip():
            raise ValueError("Event title required")
        asset_path(event["documentary"], "html")
        if event["replay"] is not None:
            if event["replay"] != f"events/{event['id']}.json":
                raise ValueError("Replay path must identify its event")
        if event.get("chronology") is not None and event["chronology"] != f"events/{event['id']}-chronology.json":
            raise ValueError("Chronology path must identify its event")
        if event.get("chronology") is not None and event["replay"] is not None:
            raise ValueError("Combined chronology and replay synchronization is not supported yet")
        seen.add(event["id"])
    if index["default_event"] not in seen:
        raise ValueError("Default event is absent")


def validate_replay(config, bundle):
    fields(config, ("schema_version", "event_id", "bundle", "clock", "geography_source", "coverage"), "replay")
    if type(config["schema_version"]) is not int or config["schema_version"] not in (1, 2):
        raise ValueError("Unsupported replay version")
    if config["event_id"] != bundle["exhibit"]["id"]:
        raise ValueError("Replay and exhibit identities differ")
    asset_path(config["bundle"], "json")
    coverage = COVERAGE if config["schema_version"] == 1 else TIMELINE_COVERAGE
    if config["coverage"] != coverage:
        raise ValueError("Unsupported coverage; historical appearance needs a reviewed schema")
    if config["schema_version"] == 1 and "appearance_timeline" in bundle:
        raise ValueError("Appearance timeline requires replay schema version 2")
    clock = config["clock"]
    fields(clock, ("start_utc", "end_utc", "time_zone", "precision", "basis"), "clock")
    for bound in ("start_utc", "end_utc"):
        # Match the browser contract before a valid Python-only spelling is
        # published as a replay that the shared loader cannot open.
        value = clock[bound]
        if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00(?:Z|\+00:00)", value):
            raise ValueError("Clock bounds require minute UTC format YYYY-MM-DDTHH:MM:00Z or +00:00")
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
    if bundle.get("cameras") is not None:
        validate_camera_context(bundle["cameras"], config["event_id"])
    footage_ids = {source['id'] for source in bundle['footage']['sources']}
    for anchor in bundle["footage"]["anchors"]:
        if anchor["source_id"] not in footage_ids:
            raise ValueError("Footage anchor does not identify the supported source")
        if not start <= utc(anchor["utc"]) <= end:
            raise ValueError("Footage anchor outside geographic coverage")
    if config["schema_version"] == 2:
        validate_appearance_timeline(bundle.get("appearance_timeline"), config["event_id"], start, end,
                                     bundle["footage"]["sources"])


def reviewed_index(root: Path):
    index = json.loads((root / "exhibits/events.json").read_text(encoding="utf-8"))
    validate_index(index)
    if any(not (root / "web" / entry["documentary"]).is_file() for entry in index["events"]):
        raise ValueError("Registered documentary page is missing")
    return index


def selected_events(index, event_ids):
    if event_ids is None:
        return index['events']
    if not event_ids or len(set(event_ids)) != len(event_ids):
        raise ValueError('Select distinct reviewed event identities')
    if set(event_ids) - {row['id'] for row in index['events']}:
        raise ValueError('Event is absent from the reviewed index')
    return [row for row in index['events'] if row['id'] in event_ids]


def replay_inputs(root: Path, event_ids=None, *, overrides=None):
    """Read reviewed replay inputs without requiring documentary events to invent one."""
    events = selected_events(reviewed_index(root), event_ids)
    overrides = overrides or {}
    if set(overrides) - {event['id'] for event in events if event['replay'] is not None}:
        raise ValueError('Replay override is not a selected reviewed replay')
    result = {}
    for event in events:
        if event['replay'] is not None:
            if event['id'] in overrides:
                result[event['id']] = overrides[event['id']]
                continue
            config = json.loads((root / 'exhibits' / event['id'] / 'replay.json').read_text(encoding='utf-8'))
            asset_path(config['bundle'], 'json')
            result[event['id']] = (config['bundle'], (root / 'web' / config['bundle']).read_bytes())
    return result


def build_event_packages(root: Path, bundles, *, event_ids=None):
    """Validate all selected inputs before returning a publication packet.

    Bundles map reviewed event identities to (public path, exact UTF-8 bytes).
    A selected documentary chronology has no replay input. Partial publication
    omits the index so it cannot advertise packages absent from that packet.
    """
    index = reviewed_index(root)
    events = selected_events(index, event_ids)
    required = {event['id'] for event in events if event['replay'] is not None}
    if not isinstance(bundles, dict) or set(bundles) != required:
        raise ValueError('Replay inputs must exactly match the selected reviewed events')
    reserved = {'events.json'} | {row['replay'] for row in index['events'] if row['replay']}
    reserved |= {row['chronology'] for row in index['events'] if row.get('chronology')}
    configs = {}
    declared_paths = set()
    for row in index['events']:
        if row['replay'] is not None:
            config = json.loads((root / 'exhibits' / row['id'] / 'replay.json').read_text(encoding='utf-8'))
            if config.get('event_id') != row['id']:
                raise ValueError('Replay configuration differs from its reviewed event identity')
            asset_path(config['bundle'], 'json')
            if config['bundle'] in reserved or config['bundle'] in declared_paths:
                raise ValueError('Replay bundle path collides with another publication asset')
            declared_paths.add(config['bundle'])
            configs[row['id']] = config
    artifacts = {'events.json': index} if event_ids is None else {}
    bundle_paths = set()
    from .chronology import validate_chronology
    for event in events:
        if event['replay'] is not None:
            name, raw = bundles[event['id']]
            asset_path(name, 'json')
            if name in reserved or name in bundle_paths:
                raise ValueError('Replay bundle path collides with another publication asset')
            if not isinstance(raw, bytes):
                raise ValueError('Replay publication requires exact bundle bytes')
            config = configs[event['id']]
            validate_replay(config, json.loads(raw.decode('utf-8')))
            if config['bundle'] != name:
                raise ValueError('Replay bundle path differs from generated destination')
            bundle_paths.add(name)
            artifacts[name] = raw
            artifacts[event['replay']] = {**config, 'bundle_sha256': hashlib.sha256(raw).hexdigest()}
        if event.get('chronology'):
            data = json.loads((root / 'exhibits' / event['id'] / 'chronology.json').read_text(encoding='utf-8'))
            artifacts[event['chronology']] = validate_chronology(data, event['id'], root)
    return artifacts


def publication_artifacts(root: Path, bundle_bytes: bytes, bundle_name="data.json"):
    """Compatibility entry point for the existing source converter."""
    event_id = json.loads(bundle_bytes)['exhibit']['id']
    if not any(row['id'] == event_id and row['replay'] is not None for row in reviewed_index(root)['events']):
        raise ValueError('Exhibit is not registered for geographic replay')
    inputs = replay_inputs(root, overrides={event_id: (bundle_name, bundle_bytes)})
    return {path: data for path, data in build_event_packages(root, inputs).items()
            if not isinstance(data, bytes)}


def write_packages(web: Path, artifacts):
    for relative, data in artifacts.items():
        path = web / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        raw = data if isinstance(data, bytes) else (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if not isinstance(data, bytes) and path.is_file():
            try:
                if json.loads(path.read_bytes()) == data:
                    continue
            except (ValueError, UnicodeError):
                pass
        path.write_bytes(raw)


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Publish packages from the reviewed event index')
    parser.add_argument('--event', action='append', help='Publish only this reviewed event, without replacing the index')
    parser.add_argument('--output', type=Path, help='Output directory, defaulting to the museum web directory')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    artifacts = build_event_packages(root, replay_inputs(root, args.event), event_ids=args.event)
    write_packages(args.output or root / 'web', artifacts)
    print(json.dumps({'published': sorted(artifacts)}, indent=2))


if __name__ == '__main__':
    main()
