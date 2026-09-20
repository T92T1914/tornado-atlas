import argparse
import json
from pathlib import Path

from .catalogue import connect, import_ncei, search, stats
from .sources import cached_retrieval, discover_ncei, retrieve


def main():
    parser = argparse.ArgumentParser(description="Local historical tornado catalogue")
    commands = parser.add_subparsers(dest="command", required=True)
    fetch = commands.add_parser("import-ncei", help="Fetch published annual files and import tornado records")
    fetch.add_argument("--years", type=int, nargs="+", required=True)
    commands.add_parser("stats")
    find = commands.add_parser("search")
    find.add_argument("query", nargs="?", default="")
    find.add_argument("--year", type=int)
    find.add_argument("--rating")
    find.add_argument("--limit", type=int, default=20)
    export = commands.add_parser("export", help="Export current normalized records as JSON")
    export.add_argument("--output", type=Path, default=Path("outputs/catalogue.json"))
    args = parser.parse_args()
    connection = connect()
    try:
        if args.command == "import-ncei":
            result = []
            for url in discover_ncei(args.years):
                metadata = cached_retrieval(url) or retrieve(url)
                imported = import_ncei(connection, metadata)
                result.append(imported)
        elif args.command == "stats":
            result = stats(connection)
        elif args.command == "search":
            records = search(connection, args.query, year=args.year, rating=args.rating, limit=args.limit)
            result = [{"id": r["id"], "title": r["title"], "local_time": r["time"]["begin"]["local"],
                       "rating": r["rating"]["reported"], "quality_notes": r["quality_notes"],
                       "source_url": r["provenance"]["source_url"]} for r in records]
        else:
            count = stats(connection)["current_source_records"]
            if count > 100_000:
                raise ValueError("Export exceeds current limit; use a paginated exporter")
            result = {"schema_version": 1, "coverage": stats(connection),
                      "records": search(connection, limit=max(1, count))}
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            result = {"output": str(args.output.resolve()), "records": count}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
