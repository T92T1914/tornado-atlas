"""Normalize NOAA records conservatively; never infer a funnel from a damage rating."""

from __future__ import annotations

import csv
import gzip
import io
import math
import re
from datetime import datetime, timedelta, timezone


def normalize(row: dict[str, str]) -> dict:
    if row.get("EVENT_TYPE") != "Tornado":
        raise ValueError("Only explicitly classified tornado records may enter this adapter")
    if not row.get("EVENT_ID", "").isdigit():
        raise ValueError("A numeric NOAA event ID is required")
    issues: list[str] = []

    def number(key: str, *, nonnegative: bool = True) -> float | None:
        value = row.get(key, "").strip()
        if not value:
            return None
        try:
            parsed = float(value)
            if not math.isfinite(parsed) or (nonnegative and parsed < 0):
                raise ValueError
            return parsed
        except ValueError:
            issues.append(f"invalid_numeric:{key}")
            return None

    def timestamp(prefix: str) -> dict:
        # Numeric year avoids the ambiguous century in NOAA's two-digit date string.
        zone = row.get("CZ_TIMEZONE", "").strip()
        result = {"reported": row.get(prefix + "_DATE_TIME"), "zone": zone,
                  "local": None, "utc": None, "basis": "reported_local_standard_time"}
        try:
            ym = row[prefix + "_YEARMONTH"]
            hhmm = int(row[prefix + "_TIME"])
            hour, minute = divmod(hhmm, 100)
            if not (0 <= hour <= 24 and 0 <= minute < 60) or (hour == 24 and minute):
                raise ValueError
            value = datetime(int(ym[:4]), int(ym[4:]), int(row[prefix + "_DAY"]))
            value += timedelta(hours=hour, minutes=minute)
            result["local"] = value.isoformat(timespec="minutes")
            match = re.fullmatch(r"[A-Z]+([+-]\d{1,2})", zone)
            if match and abs(int(match[1])) <= 14:
                offset = timezone(timedelta(hours=int(match[1])))
                result["utc"] = value.replace(tzinfo=offset).astimezone(timezone.utc).isoformat()
            else:
                issues.append(f"unresolved_timezone:{prefix}")
        except (ValueError, KeyError):
            issues.append(f"invalid_or_missing_time:{prefix}")
        return result

    def count(key: str) -> int | None:
        raw = row.get(key, '').strip()
        if not raw:
            return None
        if not re.fullmatch(r'[0-9]+', raw):
            issues.append(f'invalid_count:{key}')
            return None
        return int(raw)

    def metres(value: float | None, factor: float, key: str) -> float | None:
        if value is None:
            return None
        converted = value * factor
        if not math.isfinite(converted):
            issues.append(f'unit_conversion_overflow:{key}')
            return None
        return round(converted, 6)

    def position(prefix: str) -> list[float] | None:
        lat = number(prefix + "_LAT", nonnegative=False)
        lon = number(prefix + "_LON", nonnegative=False)
        if lat is None or lon is None:
            return None
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
            issues.append(f"invalid_or_placeholder_coordinates:{prefix}")
            return None
        return [lon, lat]  # GeoJSON order, but these are points, not a surveyed track.

    def money(key: str) -> dict:
        raw = row.get(key, "").strip()
        value = None
        if raw:
            match = re.fullmatch(r"(\d+(?:\.\d+)?)([KMB]?)", raw.upper())
            if match:
                value = float(match[1]) * {"": 1, "K": 1000, "M": 1_000_000, "B": 1_000_000_000}[match[2]]
                if not math.isfinite(value):
                    value = None
            if value is None:
                issues.append(f"unparsed_damage_amount:{key}")
        return {"reported": raw or None, "nominal_usd": value, "inflation_adjusted": False}

    raw_rating = row.get("TOR_F_SCALE", "").strip()
    match = re.fullmatch(r"(EF|F)([0-5])", raw_rating)
    rating = {"reported": raw_rating or None, "scale": match[1] if match else None,
              "value": int(match[2]) if match else None, "basis": "reported_damage_rating"}
    if raw_rating and not match:
        issues.append("unrated_or_unrecognized_rating")

    begin, end = timestamp("BEGIN"), timestamp("END")
    if begin["utc"] and end["utc"] and end["utc"] < begin["utc"]:
        issues.append("end_precedes_begin")
    if begin["local"] == end["local"] and begin["local"]:
        issues.append("same_reported_start_end_not_proof_of_zero_duration")
    narrative = row.get("EVENT_NARRATIVE", "")
    episode = row.get("EPISODE_NARRATIVE", "")
    if "\ufffd" in narrative + episode:
        issues.append("replacement_character_in_published_text")
    begin_point, end_point = position("BEGIN"), position("END")
    length, width = number("TOR_LENGTH"), number("TOR_WIDTH")
    place = row.get("BEGIN_LOCATION") or row.get("CZ_NAME") or row.get("STATE") or "Unnamed record"
    year = int(row["YEAR"])
    return {
        "schema_version": 1,
        "id": "ncei:" + row["EVENT_ID"],
        "source": "noaa_ncei_storm_events",
        "source_record_id": row["EVENT_ID"],
        "source_episode_id": row.get("EPISODE_ID") or None,
        "record_kind": "tornado_or_tornado_segment",
        "title": f"{place.title()}, {row.get('STATE', '').title()}",
        "country_code": "US", "year": year,
        "administrative_area": row.get("STATE"), "local_area": row.get("CZ_NAME"),
        "classification": "tornado", "rating": rating,
        "time": {"begin": begin, "end": end},
        "spatial": {"begin_point": begin_point, "end_point": end_point,
                    "coordinate_order": "longitude_latitude", "track": None,
                    "basis": "reported_segment_endpoints", "interpolation": None},
        "dimensions": {
            "reported_length_miles": length,
            "length_m": metres(length, 1609.344, 'TOR_LENGTH'),
            "reported_width_yards": width,
            "width_m": metres(width, 0.9144, 'TOR_WIDTH'),
            "scope": "reported_tornado_or_segment", "visible_funnel_width_m": None,
        },
        "impacts": {"deaths_direct": count("DEATHS_DIRECT"),
                    "deaths_indirect": count("DEATHS_INDIRECT"),
                    "injuries_direct": count("INJURIES_DIRECT"),
                    "injuries_indirect": count("INJURIES_INDIRECT"),
                    "property_damage": money("DAMAGE_PROPERTY"),
                    "crop_damage": money("DAMAGE_CROPS")},
        "reporting_entity": row.get("SOURCE") or None,
        "narrative": narrative, "episode_narrative": episode,
        "continuation": {key: row.get(key) or None for key in (
            "TOR_OTHER_WFO", "TOR_OTHER_CZ_STATE", "TOR_OTHER_CZ_FIPS", "TOR_OTHER_CZ_NAME")},
        "reconstruction": {"status": "not_built", "observed_appearance": None},
        "quality_notes": issues,
    }


def iter_records(content: bytes):
    with gzip.GzipFile(fileobj=io.BytesIO(content)) as compressed:
        with io.TextIOWrapper(compressed, encoding="utf-8-sig", errors="strict", newline="") as text:
            reader = csv.DictReader(text)
            required = {"EVENT_ID", "EVENT_TYPE", "YEAR", "TOR_F_SCALE", "BEGIN_YEARMONTH"}
            if not required.issubset(reader.fieldnames or []):
                raise ValueError("Unsupported NCEI CSV schema; expected headers are missing")
            if len(reader.fieldnames) != len(set(reader.fieldnames)):
                raise ValueError('Unsupported NCEI CSV schema; duplicate column header')
            # row_number is the logical CSV record, not a physical line in multiline narratives.
            for row_number, row in enumerate(reader, start=2):
                if row.get("EVENT_TYPE") == "Tornado":
                    if None in row:
                        raise ValueError(f"Unexpected extra columns in CSV record {row_number}")
                    if None in row.values():
                        raise ValueError(f'Missing columns in CSV record {row_number}')
                    yield row_number, row, normalize(row)
