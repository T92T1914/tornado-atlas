import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'run_browser_checks.py'
spec = importlib.util.spec_from_file_location('ci_browser_output', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BrowserOutputTests(unittest.TestCase):
    def test_capture_preserves_short_output_and_bounds_large_output(self):
        capture = module.Capture()
        capture.append(b'first failure\n')
        self.assertEqual(capture.bytes(), b'first failure\n')
        capture.append(b'x' * (module.LOG_LIMIT * 4))
        capture.append(b'last test result\n')
        self.assertLessEqual(len(capture.bytes()), module.LOG_LIMIT)
        self.assertTrue(capture.bytes().startswith(b'first failure\n'))
        self.assertTrue(capture.bytes().endswith(b'last test result\n'))
        self.assertIn(module.MARKER, capture.bytes())

    def test_real_child_failure_remains_failure_with_useful_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            result = subprocess.run([sys.executable, str(SCRIPT), 'chromium', '--',
                                     sys.executable, '-c',
                                     "print('not ok 1 - controlled assertion'); raise SystemExit(7)"],
                                    cwd=temporary, capture_output=True, timeout=10)
            self.assertEqual(result.returncode, 7)
            directory = Path(temporary) / 'ci-diagnostics'
            self.assertIn(b'controlled assertion', (directory / 'chromium.log').read_bytes())
            metadata = json.loads((directory / 'chromium.json').read_text())
            self.assertEqual(metadata['test_exit_code'], 7)
            self.assertFalse(metadata['truncated'])

    def test_real_child_success_is_separate_from_collection_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            blocked = Path(temporary) / 'not-a-directory'
            blocked.write_text('preserve')
            with contextlib.redirect_stderr(io.StringIO()) as evidence:
                # No output means the test does not need a stdout-buffer substitute.
                result = module.run([sys.executable, '-c', 'raise SystemExit(0)'], 'firefox', blocked)
            self.assertEqual(result, 1)
            self.assertIn('"test_exit_code": 0', evidence.getvalue())
            self.assertEqual(blocked.read_text(), 'preserve')

    def test_collection_failure_does_not_replace_original_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            blocked = Path(temporary) / 'not-a-directory'
            blocked.write_text('preserve')
            with contextlib.redirect_stderr(io.StringIO()) as evidence:
                result = module.run([sys.executable, '-c', 'raise SystemExit(7)'], 'webkit', blocked)
            self.assertEqual(result, 7)
            self.assertIn('CI_DIAGNOSTIC_COLLECTION_FAILED', evidence.getvalue())


if __name__ == '__main__':
    unittest.main()
