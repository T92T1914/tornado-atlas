"""Transactional catalogue with immutable source revisions and literal-text search."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .ncei import iter_records
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


def search(connection: sqlite3.Connection, query: str = "", *, year: int | None = None,
           rating: str | None = None, limit: int = 20) -> list[dict]:
    if not 1 <= limit <= 100_000:
        raise ValueError("Limit must be between 1 and 100000")
    conditions, values = ["instr(search_text, ?) > 0"], [query.lower()]
    if year is not None:
        conditions.append("year=?")
        values.append(year)
    if rating is not None:
        conditions.append("rating=?")
        values.append(rating.upper())
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
