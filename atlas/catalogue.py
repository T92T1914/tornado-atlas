"""Transactional catalogue with immutable source revisions and literal-text search."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .ncei import iter_records
from .jma import SOURCE as JMA_SOURCE, URL as JMA_URL, iter_cases
from .sources import DATA, NCEI_NAME, read_object


def connect(path: Path = DATA / "catalogue.sqlite3") -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id TEXT PRIMARY KEY, source TEXT NOT NULL, partition_key TEXT NOT NULL,
            revision TEXT NOT NULL, sha256 TEXT NOT NULL, metadata TEXT NOT NULL,
            UNIQUE(source, partition_key, revision)
        );
        CREATE TABLE IF NOT EXISTS records (
            snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
            id TEXT NOT NULL, year INTEGER NOT NULL, country TEXT NOT NULL,
            rating TEXT, search_text TEXT NOT NULL, payload TEXT NOT NULL,
            raw_record TEXT NOT NULL, csv_record INTEGER NOT NULL,
            PRIMARY KEY(snapshot_id, id)
        );
        CREATE VIEW IF NOT EXISTS current_records AS
            SELECT r.* FROM records r JOIN snapshots s ON s.id=r.snapshot_id
            WHERE NOT EXISTS (
                SELECT 1 FROM snapshots newer
                WHERE newer.source=s.source AND newer.partition_key=s.partition_key
                AND newer.revision>s.revision
            );
        CREATE INDEX IF NOT EXISTS records_year_rating ON records(year, rating);
        CREATE TABLE IF NOT EXISTS jma_cases (
            snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
            id TEXT NOT NULL, classification_code TEXT NOT NULL,
            payload TEXT NOT NULL, raw_record TEXT NOT NULL, csv_record INTEGER NOT NULL,
            PRIMARY KEY(snapshot_id, id)
        );
    """)
    return connection


def import_ncei(connection: sqlite3.Connection, metadata: dict, data_dir: Path = DATA) -> dict:
    match = NCEI_NAME.fullmatch(metadata["url"].rsplit("/", 1)[-1])
    if not match:
        raise ValueError("A versioned NCEI details filename is required")
    year, revision = match.groups()
    identifier = f"ncei:{year}:{revision}"
    content = read_object(metadata, data_dir)
    existing = connection.execute("SELECT sha256 FROM snapshots WHERE id=?", (identifier,)).fetchone()
    if existing:
        if existing["sha256"] != metadata["sha256"]:
            raise ValueError("Same publisher revision has different bytes; manual source review required")
        count = connection.execute("SELECT COUNT(*) FROM records WHERE snapshot_id=?", (identifier,)).fetchone()[0]
        return {"snapshot": identifier, "records": count, "status": "already_imported"}
    count = 0
    # A bad row or duplicate ID rolls back the whole revision, leaving the previous one current.
    with connection:
        connection.execute("INSERT INTO snapshots VALUES (?,?,?,?,?,?)", (
            identifier, "noaa_ncei_storm_events", year, revision, metadata["sha256"], json.dumps(metadata)))
        for row_number, raw, record in iter_records(content):
            if record["year"] != int(year):
                raise ValueError(f"Event year disagrees with annual file: {record['id']}")
            record["provenance"] = {"snapshot_id": identifier, "source_url": metadata["url"],
                                    "sha256": metadata["sha256"], "csv_record": row_number,
                                    "retrieved_at": metadata["retrieved_at"]}
            search_text = " ".join(str(value) for value in raw.values() if value).lower()
            connection.execute("INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?)", (
                identifier, record["id"], record["year"], record["country_code"],
                record["rating"]["reported"], search_text, json.dumps(record, ensure_ascii=False, allow_nan=False),
                json.dumps(raw, ensure_ascii=False), row_number))
            count += 1
        if not count:
            raise ValueError("Empty tornado revision requires review before replacing current records")
    return {"snapshot": identifier, "records": count, "status": "imported"}


def import_jma(connection: sqlite3.Connection, metadata: dict, data_dir: Path = DATA) -> dict:
    """Retain every case, while admitting only class 1 to tornado search."""
    from datetime import timezone
    from email.utils import parsedate_to_datetime

    if not isinstance(metadata, dict):
        raise ValueError("JMA retrieval metadata must be an object")
    if type(metadata.get("bytes")) is not int or not 0 <= metadata["bytes"] <= 16_000_000:
        raise ValueError("JMA metadata must record a byte count within 16 MB")
    if metadata.get("url") != JMA_URL or metadata.get("resolved_url", JMA_URL) != JMA_URL:
        raise ValueError("The reviewed JMA case CSV URL is required")
    try:
        modified = parsedate_to_datetime(metadata["last_modified"])
        if modified.tzinfo is None:
            raise ValueError
        revision = modified.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    except (KeyError, TypeError, ValueError, OverflowError) as error:
        raise ValueError("JMA import needs a timezone-bearing Last-Modified header") from error
    content = read_object(metadata, data_dir)
    identifier = f"jma:{revision}"
    existing = connection.execute("SELECT sha256 FROM snapshots WHERE id=?", (identifier,)).fetchone()
    if existing:
        if existing["sha256"] != metadata["sha256"]:
            raise ValueError("Same observed JMA revision has different bytes; source review required")
        cases = connection.execute("SELECT COUNT(*) FROM jma_cases WHERE snapshot_id=?", (identifier,)).fetchone()[0]
        count = connection.execute("SELECT COUNT(*) FROM records WHERE snapshot_id=?", (identifier,)).fetchone()[0]
        return {"snapshot": identifier, "cases": cases, "records": count, "status": "already_imported"}
    cases, count = 0, 0
    classes = {}
    with connection:
        connection.execute("INSERT INTO snapshots VALUES (?,?,?,?,?,?)", (
            identifier, JMA_SOURCE, "all_cases", revision, metadata["sha256"], json.dumps(metadata)))
        for row_number, raw, record in iter_cases(content):
            record["provenance"] = {"snapshot_id": identifier, "source_url": metadata["url"],
                                    "sha256": metadata["sha256"], "csv_record": row_number,
                                    "retrieved_at": metadata["retrieved_at"],
                                    "revision_basis": "observed_http_last_modified"}
            payload = json.dumps(record, ensure_ascii=False, allow_nan=False)
            raw_json = json.dumps(raw, ensure_ascii=False)
            connection.execute("INSERT INTO jma_cases VALUES (?,?,?,?,?,?)", (
                identifier, record["id"], record["classification_code"], payload, raw_json, row_number))
            cases += 1
            classes[record["classification"]] = classes.get(record["classification"], 0) + 1
            if record["confirmed_tornado"]:
                search_text = " ".join(raw["values"]).lower()
                connection.execute("INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?)", (
                    identifier, record["id"], record["year"], "JP", record["rating"]["reported"],
                    search_text, payload, raw_json, row_number))
                count += 1
        if not cases or not count:
            raise ValueError("Empty or no-confirmed-tornado JMA revision requires source review")
    return {"snapshot": identifier, "cases": cases, "records": count, "by_classification": classes,
            "status": "imported", "count_basis": "Only explicitly classified tornado cases enter tornado search"}


def search_jma_cases(connection: sqlite3.Connection, *, classification_code: str | None = None,
                     limit: int = 20) -> list[dict]:
    """Read retained current gust cases separately from the tornado catalogue."""
    if type(limit) is not int or not 1 <= limit <= 100_000:
        raise ValueError("Limit must be between 1 and 100000")
    conditions = ["NOT EXISTS (SELECT 1 FROM snapshots newer WHERE newer.source=s.source "
                  "AND newer.partition_key=s.partition_key AND newer.revision>s.revision)"]
    values = []
    if classification_code is not None:
        conditions.append("c.classification_code=?")
        values.append(classification_code)
    values.append(limit)
    rows = connection.execute("SELECT c.payload FROM jma_cases c JOIN snapshots s ON s.id=c.snapshot_id "
                              "WHERE " + " AND ".join(conditions) + " ORDER BY c.id DESC LIMIT ?", values)
    return [json.loads(row[0]) for row in rows]


def search(connection: sqlite3.Connection, query: str = "", *, year: int | None = None,
           rating: str | None = None, country: str | None = None, limit: int = 20) -> list[dict]:
    if not 1 <= limit <= 100_000:
        raise ValueError("Limit must be between 1 and 100000")
    conditions, values = ["instr(search_text, ?) > 0"], [query.lower()]
    if year is not None:
        conditions.append("year=?")
        values.append(year)
    if rating is not None:
        conditions.append("rating=?")
        values.append(rating.upper())
    if country is not None:
        conditions.append("country=?")
        values.append(country.upper())
    values.append(limit)
    rows = connection.execute("SELECT payload FROM current_records WHERE " + " AND ".join(conditions)
                              + " ORDER BY year DESC, id LIMIT ?", values)
    return [json.loads(row[0]) for row in rows]


def stats(connection: sqlite3.Connection) -> dict:
    rows = connection.execute("SELECT year, COUNT(*) AS count FROM current_records GROUP BY year ORDER BY year")
    years = {str(row["year"]): row["count"] for row in rows}
    return {"current_source_records": sum(years.values()), "by_year": years,
            "count_basis": "source records, including tornado segments; not deduplicated physical tornadoes",
            "source_snapshots": connection.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]}
