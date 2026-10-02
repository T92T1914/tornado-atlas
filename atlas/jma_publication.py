"""Publish JMA source cases separately from the US map catalogue."""
from __future__ import annotations

import gzip
import hashlib
import json
from collections import Counter
from datetime import timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from .jma import SOURCE, URL, GUIDE_URL, iter_cases
from .publication import write_bytes
from .sources import DATA, read_object

MAX_CASES = 10_000
MAX_PROCESSED_BYTES = 64_000_000
TERMS_URL = "https://www.jma.go.jp/jma/kishou/info/coment.html"
LICENSE_URL = "https://www.digital.go.jp/resources/open_data/public_data_license_v1.0"


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def _verified_cases(connection, data_dir: Path):
    # A read transaction makes current-source selection and all rows one view.
    # Do not commit or roll back somebody else's pending transaction.
    if connection.in_transaction:
        raise ValueError("Finish the caller's transaction before publishing JMA cases")
    connection.execute("BEGIN")
    try:
        snapshots = connection.execute(
            "SELECT * FROM snapshots s WHERE source=? AND partition_key='all_cases' "
            "AND NOT EXISTS (SELECT 1 FROM snapshots newer WHERE newer.source=s.source "
            "AND newer.partition_key=s.partition_key AND newer.revision>s.revision)",
            (SOURCE,)).fetchall()
        if len(snapshots) != 1:
            raise ValueError("Import one reviewed current JMA source snapshot first")
        snapshot = snapshots[0]
        metadata = json.loads(snapshot["metadata"])
        if (metadata.get("url") != URL or metadata.get("resolved_url", URL) != URL
                or metadata.get("sha256") != snapshot["sha256"]):
            raise ValueError("JMA source identity disagrees with its snapshot")
        modified = parsedate_to_datetime(metadata["last_modified"])
        if modified.tzinfo is None:
            raise ValueError("JMA observed source revision needs a timezone")
        revision = modified.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        if snapshot["id"] != "jma:" + revision or snapshot["revision"] != revision:
            raise ValueError("JMA observed revision disagrees with its snapshot")
        rows = connection.execute(
            "SELECT * FROM jma_cases WHERE snapshot_id=? ORDER BY csv_record",
            (snapshot["id"],)).fetchall()
        if not 0 < len(rows) <= MAX_CASES:
            raise ValueError("JMA publication requires between 1 and 10000 cases")
        content = read_object(metadata, data_dir)
        records = []
        for offset, (logical_row, raw, record) in enumerate(iter_cases(content)):
            if offset >= len(rows):
                raise ValueError("JMA catalogue omits source cases")
            stored = rows[offset]
            record["provenance"] = {
                "snapshot_id": snapshot["id"], "source_url": URL,
                "sha256": metadata["sha256"], "csv_record": logical_row,
                "retrieved_at": metadata["retrieved_at"],
                "revision_basis": "observed_http_last_modified",
            }
            # Canonical JSON comparison also distinguishes true from numeric 1.
            if (stored["csv_record"] != logical_row
                    or stored["id"] != record["id"]
                    or stored["classification_code"] != record["classification_code"]
                    or encoded(json.loads(stored["raw_record"])) != encoded(raw)
                    or encoded(json.loads(stored["payload"])) != encoded(record)):
                raise ValueError("JMA catalogue disagrees with its verified source row")
            records.append(record)
        if len(records) != len(rows):
            raise ValueError("JMA catalogue contains cases absent from the source")
        return metadata, snapshot["id"], records
    finally:
        connection.rollback()


def export_jma_cases(connection, destination: Path, data_dir: Path = DATA) -> dict:
    """Validate all cases and bytes before writing immutable details and index."""
    metadata, snapshot_id, records = _verified_cases(connection, data_dir)
    groups = {}
    for record in records:
        bucket = hashlib.sha256(record["id"].encode()).hexdigest()[:2]
        groups.setdefault(bucket, {})[record["id"]] = record
    outputs, lookup = [], {}
    processed_bytes = 0
    for bucket, group in sorted(groups.items()):
        content = encoded(group)
        processed_bytes += len(content)
        if processed_bytes > MAX_PROCESSED_BYTES:
            raise ValueError("JMA processed details exceed the 64 MB export limit")
        digest = hashlib.sha256(content).hexdigest()
        relative = f"details/{bucket}-{digest[:20]}.json"
        outputs.append((relative, content, digest))
        lookup.update({identifier: relative for identifier in group})
    classification_counts = Counter(record["classification_code"] for record in records)
    index = [{
        "id": record["id"], "case_id": record["source_record_id"],
        "title": record["title"], "language": record["language"],
        "year": record["year"], "rating": record["rating"]["reported"],
        "classification": record["classification"],
        "classification_code": record["classification_code"],
        "classification_reported": record["classification_reported"],
        "confirmed_tornado": record["confirmed_tornado"],
        "detail_file": lookup[record["id"]],
    } for record in records]
    manifest = {
        "schema_version": 1,
        "source": {
            "title": "Japan Meteorological Agency tornado and gust cases",
            "url": URL, "guide_url": GUIDE_URL, "terms_url": TERMS_URL,
            "license_url": LICENSE_URL, "snapshot_id": snapshot_id,
            "sha256": metadata["sha256"], "retrieved_at": metadata["retrieved_at"],
            "last_modified": metadata["last_modified"],
            "revision_basis": "observed_http_last_modified",
        },
        "coverage": {
            "source_cases": len(records),
            "classified_tornado_records": classification_counts["1"],
            "classification_counts": dict(sorted(classification_counts.items())),
            "occurrence_years": sorted({record["year"] for record in records}),
            "count_basis": "Source cases, not deduplicated physical storms or complete coverage.",
        },
        "attribution": "Source: Japan Meteorological Agency.",
        "transformation": "Tornado Atlas processes source classifications, missing states and reported uncertainty. This is not a JMA publication or endorsement.",
        "limits": "No map reconstruction, scientific verification of every account, shared-impact aggregation, inferred timezone, coordinate datum or wind unit.",
        "details": [{"path": relative, "sha256": digest, "bytes": len(content)}
                    for relative, content, digest in outputs],
        "records": index,
    }
    index_bytes = encoded(manifest)
    if processed_bytes + len(index_bytes) > MAX_PROCESSED_BYTES:
        raise ValueError("JMA index and details exceed the 64 MB export limit")
    # Old content-addressed details remain usable. The index is published last.
    for relative, content, _ in outputs:
        write_bytes(destination / relative, content)
    write_bytes(destination / "index.json.gz", gzip.compress(index_bytes, mtime=0))
    write_bytes(destination / "index.json", index_bytes)
    return {"cases": len(records), "classified_tornado_records": classification_counts["1"],
            "detail_files": len(outputs), "processed_bytes": processed_bytes + len(index_bytes),
            "source_sha256": metadata["sha256"], "snapshot_id": snapshot_id}
