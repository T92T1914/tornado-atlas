"""Stream node:test output and retain a bounded public CI diagnostic copy."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

LOG_LIMIT = 128 * 1024
MARKER = b'\n[CI diagnostic copy truncated; complete output remains in the job log]\n'


class Capture:
    def __init__(self, limit=LOG_LIMIT):
        self.limit = limit
        self.half = (limit - len(MARKER)) // 2
        self.first = bytearray()
        self.last = bytearray()
        self.total = 0

    def append(self, chunk):
        self.total += len(chunk)
        take = min(len(chunk), self.half - len(self.first))
        self.first.extend(chunk[:take])
        self.last.extend(chunk[take:])
        if len(self.last) > self.half:
            del self.last[:-self.half]

    def bytes(self):
        if self.total <= self.half * 2:
            return bytes(self.first + self.last)
        return bytes(self.first) + MARKER + bytes(self.last)


def run(command, engine, output):
    capture = Capture()
    try:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        with process.stdout:
            while chunk := process.stdout.read1(16 * 1024):
                capture.append(chunk)
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
        code = process.wait()
    except OSError as error:
        code = 127
        capture.append(('Browser command could not start: ' + str(error) + '\n').encode())
    context = {name: os.environ.get(name) for name in
               ('GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_JOB',
                'GITHUB_SHA', 'GITHUB_REF', 'GITHUB_EVENT_NAME')}
    metadata = {'engine': engine, 'test_exit_code': code, 'context': context,
                'python': sys.version.split()[0], 'observed_output_bytes': capture.total,
                'retained_log_bytes': len(capture.bytes()), 'retained_log_limit': LOG_LIMIT,
                'truncated': capture.total > capture.half * 2,
                'scope': 'Owned public fixture output; no browser profile, cookies or environment dump'}
    try:
        output.mkdir(parents=True, exist_ok=True)
        (output / (engine + '.log')).write_bytes(capture.bytes())
        (output / (engine + '.json')).write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    except OSError as error:
        print('CI_DIAGNOSTIC_COLLECTION_FAILED ' + json.dumps({
            'engine': engine, 'test_exit_code': code, 'error': str(error)}), file=sys.stderr)
        return code if code else 1
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('engine', choices=('chromium', 'webkit', 'firefox'))
    parser.add_argument('--output', type=Path, default=Path('ci-diagnostics'))
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('An explicit browser test command is required')
    return run(command, args.engine, args.output)


if __name__ == '__main__':
    raise SystemExit(main())
