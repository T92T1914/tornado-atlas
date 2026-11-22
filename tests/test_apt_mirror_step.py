"""The hosted mirror step leaves apt only the HTTPS Ubuntu archive entries."""
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github' / 'workflows' / 'checks.yml'
OPEN = "sudo python3 - <<'ATLAS_APT_MIRROR_PY'"
CLOSE = 'ATLAS_APT_MIRROR_PY'
TARGET = "Path('/etc/apt/apt-mirrors.txt')"

ARCHIVE = b'https://archive.ubuntu.com/ubuntu/\tpriority:2\n'
SECURITY = b'https://security.ubuntu.com/ubuntu/\tpriority:3\n'
# The 152 byte list of runner image 20261111.82.6, whose EC2 mirror fetched
# 139 MB in 15 and 22 minutes on the two main runs of 2026-11-17.
EC2 = b'http://us-east-2.ec2.archive.ubuntu.com/ubuntu/\tpriority:1\n' + ARCHIVE + SECURITY
# The list of image 20261111.196.1, which becomes 93 bytes once the Azure entry goes.
AZURE = b'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n' + ARCHIVE + SECURITY


def mirror_scripts(text):
    """Each embedded mirror script in the workflow, dedented."""
    lines = text.splitlines(keepends=True)
    scripts = []
    for index, line in enumerate(lines):
        if line.strip() == OPEN:
            end = next(i for i in range(index + 1, len(lines)) if lines[i].strip() == CLOSE)
            scripts.append(textwrap.dedent(''.join(lines[index + 1:end])))
    return scripts


class MirrorStepTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scripts = mirror_scripts(WORKFLOW.read_text(encoding='utf-8'))

    def run_script(self, script, content):
        with tempfile.TemporaryDirectory() as folder:
            mirror = Path(folder) / 'apt-mirrors.txt'
            mirror.write_bytes(content)
            self.assertEqual(script.count(TARGET), 1)
            source = script.replace(TARGET, f'Path({str(mirror)!r})')
            result = subprocess.run([sys.executable, '-I', '-c', source],
                                    capture_output=True, text=True, timeout=30)
            return result, mirror.read_bytes()

    def test_both_jobs_carry_the_same_script(self):
        self.assertEqual(len(self.scripts), 2)
        self.assertEqual(self.scripts[0], self.scripts[1])

    def test_the_ec2_http_mirror_is_removed(self):
        result, after = self.run_script(self.scripts[0], EC2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(EC2), 152)
        self.assertEqual(after, ARCHIVE + SECURITY)
        self.assertIn('Removed 1 plain HTTP mirror entries.', result.stdout)

    def test_the_azure_http_mirror_is_still_removed(self):
        result, after = self.run_script(self.scripts[0], AZURE)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(after, ARCHIVE + SECURITY)
        self.assertEqual(len(after), 93)

    def test_an_https_only_list_is_left_alone(self):
        result, after = self.run_script(self.scripts[0], ARCHIVE + SECURITY)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(after, ARCHIVE + SECURITY)
        self.assertIn('Removed 0 plain HTTP mirror entries.', result.stdout)

    def test_a_list_without_the_https_archive_is_refused_unchanged(self):
        content = b'http://us-east-2.ec2.archive.ubuntu.com/ubuntu/\tpriority:1\n' + SECURITY
        result, after = self.run_script(self.scripts[0], content)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('HTTPS Ubuntu archive fallback is missing', result.stderr)
        self.assertEqual(after, content)


if __name__ == '__main__':
    unittest.main()
