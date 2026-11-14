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
PUBLISHED_CATALOGUE = ROOT / "web" / "catalogue" / "index.json"
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
            "path": destination.relative_to(data_dir).as_posix(),
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
    """Verify a content-addressed cache object, never an arbitrary manifest path."""
    if not isinstance(metadata, dict):
        raise ValueError("Source metadata must be an object")
    sha, recorded_path = metadata.get("sha256"), metadata.get("path")
    if not isinstance(sha, str) or re.fullmatch(r"[0-9a-f]{64}", sha) is None:
        raise ValueError("Source sha256 must be a lowercase SHA-256 digest")
    # Earlier Windows retrievals recorded backslashes. Accept that spelling
    # on every platform while keeping the content-addressed layout exact.
    if not isinstance(recorded_path, str) or recorded_path.replace("\\", "/") != f"raw/{sha}":
        raise ValueError("Source path must identify its digest inside raw/")
    count = metadata.get("bytes")
    if "bytes" in metadata and (type(count) is not int or count < 0):
        raise ValueError("Source byte count must be a nonnegative integer")
    base = data_dir.resolve()
    path = base / "raw" / sha
    if path.resolve() != path:
        raise ValueError("Source path must not redirect outside its cache object")
    content = path.read_bytes()
    if "bytes" in metadata and len(content) != count:
        raise ValueError("Source byte count does not match the cached object")
    if hashlib.sha256(content).hexdigest() != sha:
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


def logged_retrievals(data_dir: Path = DATA) -> list[dict]:
    """Every retrieval this cache has logged, oldest first."""
    log = data_dir / "retrievals.jsonl"
    if not log.exists():
        return []
    return [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines() if line.strip()]


def published_retrievals(index: Path = PUBLISHED_CATALOGUE) -> list[dict]:
    """The source retrievals the published browser catalogue already cites."""
    if not index.exists():
        return []
    sources = json.loads(index.read_text(encoding="utf-8")).get("sources", {})
    return [{"url": item["source_url"], "sha256": item["sha256"], "retrieved_at": item["retrieved_at"]}
            for item in sources.values()]


def _instant(value, url: str) -> datetime:
    try:
        moment = datetime.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"Retrieval time is not an ISO 8601 timestamp: {url}") from error
    if moment.tzinfo is None:
        raise ValueError(f"Retrieval time needs a UTC offset: {url}")
    return moment


def first_retrieval(metadata: dict, earlier: list[dict]) -> dict:
    """Keep the first retrieval time when a refetch returns the same bytes.

    Fetching identical bytes from the same URL again observes nothing new, so
    the source keeps the time it was first retrieved. The refetch time stays in
    `refetched_at` and in the retrieval log. Different bytes keep their own time.
    """
    url, sha = metadata["url"], metadata["sha256"]
    current = _instant(metadata["retrieved_at"], url)
    matches = [(_instant(item["retrieved_at"], url), item["retrieved_at"]) for item in earlier
               if item.get("url") == url and item.get("sha256") == sha]
    if not matches:
        return metadata
    first, recorded = min(matches)
    if first >= current:
        return metadata
    return {**metadata, "retrieved_at": recorded, "refetched_at": metadata["retrieved_at"]}


def cached_retrieval(url: str, data_dir: Path = DATA) -> dict | None:
    """Return the last integrity-checked snapshot; callers choose when to refresh."""
    for item in reversed(logged_retrievals(data_dir)):
        if item["url"] == url:
            read_object(item, data_dir)
            return item
    return None
