import argparse
import json
import sys
from pathlib import Path

from .catalogue import connect, import_jma, import_ncei, search, search_jma_cases, stats
from .jma import URL as JMA_URL
from .sources import DATA, cached_retrieval, discover_ncei, retrieve


def main():
    parser = argparse.ArgumentParser(description="Local historical tornado catalogue")
    parser.add_argument("--data-dir", type=Path, default=DATA, help="Content-addressed source cache and database directory")
    commands = parser.add_subparsers(dest="command", required=True)
    fetch = commands.add_parser("import-ncei", help="Fetch published annual files and import tornado records")
    period=fetch.add_mutually_exclusive_group(required=True)
    period.add_argument("--years", type=int, nargs="+")
    period.add_argument("--year-range",type=int,nargs=2,metavar=("FIRST","LAST"),help="Inclusive range of published years")
    jma = commands.add_parser("import-jma", help="Import an already retained JMA source snapshot")
    jma_source = jma.add_mutually_exclusive_group()
    jma_source.add_argument("--metadata", type=Path, help="Retrieval metadata for a raw/sha256 cache object")
    jma_source.add_argument("--refresh", action="store_true", help="Retrieve a new JMA snapshot while preserving old objects")
    cases = commands.add_parser("jma-cases", help="Read retained gust cases without counting them as confirmed tornadoes")
    cases.add_argument("--classification-code", help="Original JMA phenomenon code, for example 6 for unknown")
    cases.add_argument("--limit", type=int, default=20)
    publish_jma = commands.add_parser("publish-jma", help="Publish reviewed Japanese source cases separately from the US map")
    publish_jma.add_argument("--output", type=Path, default=Path("outputs/jma-cases"))
    commands.add_parser("stats")
    find = commands.add_parser("search")
    find.add_argument("query", nargs="?", default="")
    find.add_argument("--year", type=int)
    find.add_argument("--rating")
    find.add_argument("--country", help="Source country code, for example JP or US")
    find.add_argument("--limit", type=int, default=20)
    export = commands.add_parser("export", help="Export current normalized records as JSON")
    export.add_argument("--output", type=Path, default=Path("outputs/catalogue.json"))
    args = parser.parse_args()
    connection = connect(args.data_dir / "catalogue.sqlite3")
    try:
        if args.command == "import-ncei":
            years=args.years
            if args.year_range:
                first,last=args.year_range
                if not 1950<=first<=last<=2100:
                    parser.error('Expected an ascending year range from 1950 onward, ending no later than 2100')
                years=list(range(first,last+1))
            result = []
            for number,url in enumerate(discover_ncei(years, data_dir=args.data_dir),1):
                print(f'[{number}/{len(set(years))}] {url.rsplit("/",1)[-1]}',file=sys.stderr,flush=True)
                metadata = cached_retrieval(url, data_dir=args.data_dir) or retrieve(url, data_dir=args.data_dir)
                imported = import_ncei(connection, metadata, data_dir=args.data_dir)
                result.append(imported)
        elif args.command == "import-jma":
            if args.metadata:
                metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
            else:
                metadata = None if args.refresh else cached_retrieval(JMA_URL, data_dir=args.data_dir)
                metadata = metadata or retrieve(JMA_URL, data_dir=args.data_dir, max_bytes=16_000_000)
            result = import_jma(connection, metadata, data_dir=args.data_dir)
        elif args.command == "jma-cases":
            result = search_jma_cases(connection, classification_code=args.classification_code, limit=args.limit)
        elif args.command == "publish-jma":
            from .jma_publication import export_jma_cases
            result = export_jma_cases(connection, args.output, data_dir=args.data_dir)
        elif args.command == "stats":
            result = stats(connection)
        elif args.command == "search":
            records = search(connection, args.query, year=args.year, rating=args.rating,
                             country=args.country, limit=args.limit)
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
