"""Bounded GET checks for every distinct external URL in the curated exhibit.

Does not crawl the 80,000 source catalogue records. HTTP reachability is not
source verification. Access errors stay separate from confirmed missing pages.
"""
import concurrent.futures
import argparse
import datetime
import json
import re
import threading
from collections import Counter
from html import unescape
from pathlib import Path
from urllib.parse import urlsplit, urldefrag
import requests

ROOT = Path(__file__).resolve().parents[1]


def urls(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from urls(child)
    elif isinstance(value, list):
        for child in value:
            yield from urls(child)
    elif isinstance(value, str) and value.startswith(('https://', 'http://')):
        yield value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--new-only', action='store_true', help='Keep dated results for unchanged URLs and check newly added links.')
    args = parser.parse_args()
    links = set(urls(json.loads((ROOT / 'web/data.json').read_text(encoding='utf-8'))))
    for path in (ROOT / 'web').glob('*.html'):
        links.update(unescape(u) for u in re.findall(r'(?:href|src)=[\"\'](https?://[^\"\']+)', path.read_text(encoding='utf-8')))
    for path in list((ROOT / 'web').glob('*.mjs')) + list((ROOT / 'web').glob('*.js')):
        links.update(u for u in re.findall(r'[\"\'](https://[^\"\'\s]+)[\"\'](?!\s*\+)', path.read_text(encoding='utf-8')) if 'example.invalid' not in u)
    links = sorted({urldefrag(u)[0] for u in links})
    previous = {}
    destination = ROOT / 'web/source-audit.json'
    if args.new_only and destination.exists():
        saved = json.loads(destination.read_text(encoding='utf-8'))
        previous = {r['url']: dict(r, checked_at=r.get('checked_at', saved['checked_at'])) for r in saved['results']}
    locks = {urlsplit(u).hostname: threading.Semaphore(2) for u in links}
    def check(url):
        if url in previous:
            return previous[url]
        result = {'url': url, 'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'claim_review': 'Reachability only; see bibliography use notes and research ledger.'}
        domain = urlsplit(url).hostname
        result['role'] = ('government source' if domain.endswith(('.gov', '.noaa.gov')) else
                          'research institution or institutional archive' if domain.endswith(('.edu', '.ac.uk')) else
                          'creator platform, publisher or secondary source; check item attribution')
        try:
            with locks[domain], requests.get(url, stream=True, timeout=(8, 20), headers={'User-Agent':'TornadoAtlas-LinkAudit/1.0 (+https://github.com/T92T1914/tornado-atlas)'}) as response:
                result.update(http_status=response.status_code, final_url=response.url, content_type=response.headers.get('Content-Type',''))
                status = response.status_code
                result['access'] = 'reachable' if 200 <= status < 300 else 'missing' if status in (404,410) else 'access_unresolved'
                # ArcGIS errors can arrive as a successful JSON response.
                if result['access']=='reachable' and ('json' in result['content_type'] or '/query?' in url):
                    prefix=next(response.iter_content(2048),b'').decode('utf-8',errors='replace').lstrip()
                    if re.match(r'\{\s*"error"\s*:',prefix):result['access']='service_error'
                if urlsplit(response.url).hostname != domain:result['redirect_review']='Changed host; review destination identity.'
        except requests.RequestException as error:
            result.update(access='access_unresolved', error=type(error).__name__)
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(check,links))
    report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'scope':'Every distinct external URL in the curated El Reno data bundle, top-level museum HTML and fixed browser-module links. Catalogue-generated event URLs and browser-generated service requests are outside this list. Fragment anchors and claim support require separate checks.',
            'method':'Bounded GET, at most two concurrent requests per host. HTTP 403, 429 and timeouts are unresolved access, not proof of a dead source. Successful HTTP does not establish content truth or exclude a soft error page.',
            'counts':dict(Counter(r['access'] for r in results)),'results':results}
    (ROOT/'web/source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'links':len(results),'counts':report['counts'],'needs_review':[r for r in results if r['access']!='reachable']},indent=2))


if __name__=='__main__':
    main()
