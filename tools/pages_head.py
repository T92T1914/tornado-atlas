"""Decide whether a deploy job may publish its revision.

Two merges a few seconds apart start two publish runs. The `pages` concurrency
group runs their deploy jobs one at a time, but in the order they reach it, so
the older revision can finish last and replace the newer site. This guard runs
inside the deploy job, after that group admits it, and allows publication only
when the run's revision is still the head of `main`.

Usage: python3 tools/pages_head.py <expected sha>

It reads the head with `git ls-remote`, prints one ATLAS_PAGES_HEAD line with
the reason, and writes `publish=true` or `publish=false` to $GITHUB_OUTPUT when
that variable is set. When the head cannot be read it exits 1, so a failed
lookup stops the job instead of publishing or skipping without a reason.
"""
import os
import re
import subprocess
import sys

SHA = re.compile(r'[0-9a-f]{40}')
REF = 'refs/heads/main'


def remote_head(lines, ref=REF):
    """The sha `git ls-remote` reports for `ref`, or None when it is absent."""
    for line in lines.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1] == ref and SHA.fullmatch(parts[0]):
            return parts[0]
    return None


def decide(expected, head):
    """Return (publish, reason) for a run of `expected` while `main` is at `head`."""
    if not SHA.fullmatch(expected or ''):
        raise ValueError(f'expected sha is not a full lowercase sha: {expected!r}')
    if head is None:
        raise ValueError(f'{REF} was not found on origin')
    if head == expected:
        return True, 'this revision is the head of main'
    return False, f'main has moved to {head}, so publishing {expected} would replace a newer site'


def main(argv, run=subprocess.run, environ=os.environ):
    if len(argv) != 2:
        print('usage: pages_head.py <expected sha>', file=sys.stderr)
        return 2
    expected = argv[1]
    listing = run(['git', 'ls-remote', 'origin', REF], capture_output=True, text=True)
    if listing.returncode != 0:
        print(f'ATLAS_PAGES_HEAD error=ls-remote exit {listing.returncode}: {listing.stderr.strip()}')
        return 1
    head = remote_head(listing.stdout)
    try:
        publish, reason = decide(expected, head)
    except ValueError as error:
        print(f'ATLAS_PAGES_HEAD error={error}')
        return 1
    print(f'ATLAS_PAGES_HEAD sha={expected} main={head} publish={str(publish).lower()} reason={reason}')
    if not publish:
        # The run of the newer head publishes unless the pages group cancelled
        # its pending deploy, so the skip is raised where a reader will see it.
        print(f'::warning title=Publication skipped::{reason}. Confirm that the run for {head} deployed.')
    output = environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as handle:
            handle.write(f'publish={str(publish).lower()}\n')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
