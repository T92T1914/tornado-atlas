"""Publish the mainland China source cases separately from the US map catalogue."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from . import china
from .publication import write_bytes

RETRIEVED_AT = "2026-11-22T06:23:54Z"
ATTRIBUTION = ("Zhang, Y., G. Fang, W. Pang, J. Cao, S. Cao and Y. Ge. "
               "Tornado database in China mainland from 2003 to 2019, version 2. "
               "4TU.ResearchData, doi:10.4121/19801633.v2. CC BY 4.0.")
CHANGES = ("Tornado Atlas reads the Data sheet, keeps the case label, recorded date, start and end time, "
           "geocoded position and EF value, and leaves out the time notes, the Chinese and English locations "
           "and both damage description columns. Clock times stored as spreadsheet fractions of a day are shown "
           "as hours and minutes. This is not a publication of the dataset's authors or an endorsement by them.")
LIMITS = ("Each position is the dataset authors' geocoded point for a place description, not a survey position "
          "or a path. A date range gives the approximate dates of occurrence, not a duration. Times are UTC+8 "
          "as recorded and are not converted. The dataset says its place names, time notes and damage "
          "descriptions come from the Yearbook of Meteorological Disasters in China, whose terms are not read, "
          "so they are not shown. Cases are source records, not a complete count of tornadoes in China.")


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def build_index(content: bytes) -> dict:
    records = list(china.iter_cases(content))
    ratings = Counter(record["rating"]["reported"] or "unrated" for record in records)
    return {
        "schema_version": 1,
        "source": {
            "title": china.TITLE, "version": 2, "creators": list(china.CREATORS),
            "doi": china.DOI, "record_url": china.RECORD_URL, "file_name": china.FILE_NAME,
            "file_url": china.FILE_URL, "bytes": china.FILE_BYTES, "md5": china.FILE_MD5,
            "sha256": china.FILE_SHA256, "retrieved_at": RETRIEVED_AT,
            "license": china.LICENSE, "license_url": china.LICENSE_URL,
            "terms_record": china.TERMS_RECORD,
        },
        "coverage": {
            "source_cases": len(records),
            "geocoded_positions": sum(record["position"]["point"] is not None for record in records),
            "approximate_date_ranges": sum(record["recorded_date"]["approximate"] for record in records),
            "rating_counts": dict(sorted(ratings.items())),
            "occurrence_years": sorted({record["year"] for record in records}),
            "count_basis": "Source cases in version 2 of the dataset, not a complete count of physical storms.",
        },
        "attribution": ATTRIBUTION,
        "changes": CHANGES,
        "omitted_columns": list(china.OMITTED),
        "limits": LIMITS,
        "records": records,
    }


def export_china_cases(source: Path, destination: Path) -> dict:
    """Check the retained version 2 file, then write one canonical index."""
    index = build_index(Path(source).read_bytes())
    content = encoded(index)
    write_bytes(Path(destination) / "index.json", content)
    return {"cases": index["coverage"]["source_cases"], "bytes": len(content),
            "source_md5": china.FILE_MD5}
