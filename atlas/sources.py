"""Small, bounded downloads with content hashes and an append-only retrieval log."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
NCEI_BASE = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/"
NCEI_NAME = re.compile(r"StormEvents_details-ftp_v1\.0_d(\d{4})_c(\d{8})\.csv\.gz")
USER_AGENT = "TornadoAtlasLocalResearch/0.1 (historical data catalogue)"


def retrieve(url: str, *, data_dir: Path = DATA, max_bytes: int = 32_000_000) -> dict:
    """Store exact bytes. This is an integrity hash, not a publisher signature."""
    raw_dir = data_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    count = 0
    fd, temporary = tempfile.mkstemp(prefix="download-", suffix=".part", dir=raw_dir)
    try:
        with os.fdopen(fd, "wb") as target:
            with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=40) as response:
                resolved_url = response.url
                headers = dict(response.headers)
                while block := response.read(131072):
                    count += len(block)
                    if count > max_bytes:
                        raise ValueError(f"Download exceeded {max_bytes} bytes: {url}")
                    digest.update(block)
                    target.write(block)
        sha = digest.hexdigest()
        destination = raw_dir / sha
        if destination.exists():
            if hashlib.sha256(destination.read_bytes()).hexdigest() != sha:
                raise ValueError(f"Cached object is corrupt: {destination}")
            Path(temporary).unlink()
        else:
            os.replace(temporary, destination)
        metadata = {
            "url": url,
            "resolved_url": resolved_url,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "sha256": sha,
            "bytes": count,
            "path": str(destination.relative_to(data_dir)),
            "content_type": headers.get("Content-Type"),
            "last_modified": headers.get("Last-Modified"),
            "etag": headers.get("ETag"),
        }
        with (data_dir / "retrievals.jsonl").open("a", encoding="utf-8") as log:
            log.write(json.dumps(metadata, ensure_ascii=False) + "\n")
        return metadata
    finally:
        Path(temporary).unlink(missing_ok=True)


def read_object(metadata: dict, data_dir: Path = DATA) -> bytes:
    content = (data_dir / metadata["path"]).read_bytes()
    if hashlib.sha256(content).hexdigest() != metadata["sha256"]:
        raise ValueError("Source integrity check failed; original bytes must be restored")
    return content


def discover_ncei(years: list[int], data_dir: Path = DATA) -> list[str]:
    metadata = retrieve(NCEI_BASE, data_dir=data_dir, max_bytes=2_000_000)
    listing = read_object(metadata, data_dir).decode("utf-8")
    latest: dict[int, tuple[str, str]] = {}
    for match in NCEI_NAME.finditer(listing):
        year, revision = int(match[1]), match[2]
        if year not in latest or revision > latest[year][0]:
            latest[year] = (revision, match[0])
    missing = set(years) - latest.keys()
    if missing:
        raise ValueError(f"No published NCEI details file for years: {sorted(missing)}")
    return [NCEI_BASE + latest[year][1] for year in sorted(set(years))]


def cached_retrieval(url: str, data_dir: Path = DATA) -> dict | None:
    """Reuse immutable, revision-named NOAA files; mutable URLs are fetched afresh."""
    log = data_dir / "retrievals.jsonl"
    if not log.exists():
        return None
    matches = [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]
    for item in reversed(matches):
        if item["url"] == url:
            read_object(item, data_dir)
            return item
    return None
