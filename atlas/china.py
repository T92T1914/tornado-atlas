"""Read the mainland China tornado database of Zhang and colleagues, version 2.

The dataset is published under CC BY 4.0. Its own Parameters sheet says the
dates, times, time notes, Chinese locations and damage descriptions come from
the Yearbook of Meteorological Disasters in China, and that the English
locations are translated from it. The yearbook's terms have not been read, so
this adapter keeps the structured fields, which are the case label, the
recorded date, the recorded times, the geocoded position and the EF value, and
leaves out every column of yearbook text. Positions are the authors' geocoded
points for a place description, not survey positions. Times are UTC+8 as the
dataset states.
"""

from __future__ import annotations

import hashlib
import math
import re

from .xls import read_workbook

SOURCE = "zhang_china_mainland_tornadoes_v2"
DOI = "https://doi.org/10.4121/19801633.v2"
RECORD_URL = "https://data.4tu.nl/v2/articles/19801633"
FILE_URL = "https://data.4tu.nl/file/d314491c-1f96-460c-870e-9e9f81b4791f/6973b1b8-e64c-4904-b872-12ed2d2330fe"
FILE_NAME = "v.2 Tornado database in China mainland from 2003 to 2019.xls"
FILE_BYTES = 384_000
FILE_MD5 = "f5622b1553a1fec7bbd7d21e3f5d8163"
FILE_SHA256 = "d1c1b2164c732e0583c7c72a9a8d68c9e909677a43a795fac69f59ced0528279"
LICENSE = "CC BY 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
TITLE = "Tornado database in China mainland from 2003 to 2019"
# Creator names as the 4TU.ResearchData record lists them.
CREATORS = ("Yi Zhang","Genshen Fang", "Weichiang Pang", "Jinxin Cao", "Shuyang Cao", "Yaojun Ge")
TERMS_RECORD = "research/international-reuse-terms-2026-11-21.md"
SHEET = "Data"
HEADERS = (
    "Event", "Recorded Date", "Starting Time", "End Time", "Notes on time",
    "longitude", "latitude", "Detailed locations in Chinese",
    "Detailed locations in English", "Damage Descriptions in Chinese",
    "Damage Descriptions in English", "EF scale",
)
# Columns of text copied or translated from the yearbook. They are read only to
# prove the row shape and are never published.
OMITTED = ("Notes on time", "Detailed locations in Chinese", "Detailed locations in English",
           "Damage Descriptions in Chinese", "Damage Descriptions in English")
TEMPLATE_NOTE = ("Date/Time must be provided in the ISO-format (e.g. 1954-04-07T13:34:11) "
                 "as coordinated universal time (UTC).")
PERIODS = ("early morning", "morning", "noon", "afternoon", "evening", "night",
           "midnight", "night to early morning")
DATE = r"(20[0-9]{2})-([01][0-9])-([0-3][0-9])"


def _date(value) -> dict:
    if not isinstance(value, str):
        raise ValueError("Each case needs a recorded date")
    single = re.fullmatch(DATE, value)
    if single:
        return {"reported": value, "kind": "single_date", "first": value, "last": value,
                "approximate": False}
    span = re.fullmatch(DATE + "/" + DATE, value)
    if span:
        first, last = value.split("/")
        if first > last:
            raise ValueError("A recorded date range runs backward")
        # The dataset's parameter sheet calls a range the approximate dates of
        # occurrence, not the duration of the tornado.
        return {"reported": value, "kind": "approximate_date_range", "first": first,
                "last": last, "approximate": True}
    raise ValueError("Unsupported recorded date: " + value)


def _time(value) -> dict:
    zone = "UTC+8 as the dataset states"
    if value is None:
        return {"reported": None, "kind": "not_recorded", "local": None, "zone": None, "utc": None}
    if isinstance(value, str):
        if value not in PERIODS:
            raise ValueError("Unsupported recorded time of day: " + value)
        return {"reported": value, "kind": "period_of_day", "local": None, "zone": zone, "utc": None}
    if isinstance(value, float) and math.isfinite(value) and 0 <= value < 1:
        minutes = value * 1440
        if abs(minutes - round(minutes)) > 1e-6:
            raise ValueError("A recorded clock time is not a whole minute")
        minutes = round(minutes)
        return {"reported": value, "kind": "clock_time", "local": f"{minutes // 60:02d}:{minutes % 60:02d}",
                "zone": zone, "utc": None,
                "basis": "Spreadsheet time of day read as hours and minutes. No date or UTC conversion is applied."}
    raise ValueError("Unsupported recorded time value")


def normalize(row: list, sheet_row: int) -> dict:
    """Keep one case's structured fields and drop the copied yearbook text."""
    if len(row) != len(HEADERS):
        raise ValueError("A China case must have twelve columns")
    label, date, start, end, note, longitude, latitude, place_zh, place_en, _, _, scale = row
    match = re.fullmatch(r"China_tornado_([1-9][0-9]*)", label or "")
    if not match:
        raise ValueError("Unsupported case label")
    point = None
    if longitude is not None or latitude is not None:
        if not (isinstance(longitude, float) and isinstance(latitude, float)
                and 73 <= longitude <= 136 and 17 <= latitude <= 54):
            raise ValueError(f"{label} has a position outside mainland China")
        point = [longitude, latitude]
    if note is not None and re.fullmatch(r"lasted [0-9]+ (minutes|hour)", note) is None:
        raise ValueError(f"{label} has an unsupported time note")
    if scale is not None and scale not in (0.0, 1.0, 2.0, 3.0, 4.0, 5.0):
        raise ValueError(f"{label} has an unsupported EF value")
    for name, value in (("Chinese", place_zh), ("English", place_en)):
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise ValueError(f"{label} has an empty {name} location")
    recorded = _date(date)
    return {
        "schema_version": 1,
        "id": "cn-zhang:" + match.group(1),
        "source": SOURCE,
        "case_label": label,
        "sequence": int(match.group(1)),
        "year": int(recorded["first"][:4]),
        "country_code": "CN",
        "recorded_date": recorded,
        "start_time": _time(start),
        "end_time": _time(end),
        "position": {"point": point, "coordinate_order": "longitude_latitude",
                     "basis": "geocoded_from_place_description" if point else "not_geocoded",
                     "datum": None},
        "rating": {"reported": None if scale is None else f"EF{int(scale)}",
                   "scale": "EF" if scale is not None else None,
                   "value": None if scale is None else int(scale),
                   "basis": "reported_in_dataset" if scale is not None else "unrated"},
        "provenance": {"sheet": SHEET, "sheet_row": sheet_row + 1, "doi": DOI,
                       "md5": FILE_MD5, "sha256": FILE_SHA256},
    }


def iter_cases(content: bytes):
    """Yield every case of the version 2 file after its digests are checked."""
    if not isinstance(content, bytes) or len(content) != FILE_BYTES:
        raise ValueError("The China source must be the 384,000 byte version 2 file")
    if hashlib.md5(content).hexdigest() != FILE_MD5 or hashlib.sha256(content).hexdigest() != FILE_SHA256:
        raise ValueError("The China source does not match the version 2 digests")
    cells = read_workbook(content)[SHEET]
    width = len(HEADERS)
    if tuple(cells.get((0, column)) for column in range(width)) != HEADERS:
        raise ValueError("Unsupported China sheet headers")
    if any(column >= width for _, column in cells):
        raise ValueError("Unexpected column beyond the published headers")
    last = max(row for row, _ in cells)
    expected = 1
    for row in range(1, last + 1):
        values = [cells.get((row, column)) for column in range(width)]
        if values[0] is None and all(value is None for value in values):
            continue
        if values[0] == TEMPLATE_NOTE and all(value is None for value in values[1:]):
            continue
        record = normalize(values, row)
        if record["sequence"] != expected:
            raise ValueError("China case labels are not in unbroken order")
        expected += 1
        yield record
