"""Every top-level Node unit test file must run in the verification workflow."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github' / 'workflows' / 'checks.yml'
NAMED = re.compile(r'(?<![\w/.-])tests/[\w.-]+\.test\.mjs(?![\w.-])')
IMPORTED = re.compile(r"""^\s*(?:import\s*['"]|import\b[^'"\n]*\bfrom\s*['"]|export\b[^'"\n]*\bfrom\s*['"])\./([\w.-]+\.test\.mjs)['"]""",
                      re.MULTILINE)
# A name filter or an ignored exit status means the line does not prove the file's tests run.
WEAKENED = ('--test-name-pattern', '--test-skip-pattern', '--test-only', '|| true', 'echo ')


def named_in_workflow(text):
    """Top-level test files named on uncommented `node --test` command lines, in order."""
    names = []
    for line in text.splitlines():
        command = line.split(' #', 1)[0].strip()
        for prefix in ('- run:', 'run:'):
            if command.startswith(prefix):
                command = command[len(prefix):].strip()
        if (not command.startswith('node --test')
                or any(marker in command for marker in WEAKENED)):
            continue
        names += NAMED.findall(command)
    return names


def covered_tests(text, read):
    """Files the workflow runs directly or reaches through a static import between test files.

    `read` returns a test file's source for a repository-relative path. A test file
    that imports another top-level test file runs that file's tests in the same
    process, which is how `atlas-model.test.mjs` already carries one other file.
    """
    pending, covered = list(named_in_workflow(text)), set()
    while pending:
        name = pending.pop()
        if name in covered:
            continue
        covered.add(name)
        pending += ['tests/' + child for child in IMPORTED.findall(read(name))]
    return covered


def read_test(name):
    return (ROOT / name).read_text(encoding='utf-8')


def top_level_tests():
    return {path.relative_to(ROOT).as_posix() for path in (ROOT / 'tests').glob('*.test.mjs')}


class NodeUnitCoverageTests(unittest.TestCase):
    def setUp(self):
        self.text = WORKFLOW.read_text(encoding='utf-8')

    def test_every_top_level_node_test_runs_in_the_workflow(self):
        missing = sorted(top_level_tests() - covered_tests(self.text, read_test))
        self.assertEqual(missing, [], 'Add these files to a node --test line in checks.yml')

    def test_every_named_test_file_exists(self):
        stale = sorted(set(named_in_workflow(self.text)) - top_level_tests())
        self.assertEqual(stale, [])

    def test_removing_a_file_from_the_workflow_is_reported(self):
        target = 'tests/photo-byte-check.test.mjs'
        self.assertIn(target, covered_tests(self.text, read_test))
        reduced = self.text.replace(' ' + target, '').replace(target, '')
        self.assertNotIn(target, covered_tests(reduced, read_test))

    def test_a_file_reached_only_through_an_import_is_covered_and_can_be_lost(self):
        sources = {'tests/a.test.mjs': "import './b.test.mjs';\n", 'tests/b.test.mjs': ''}
        self.assertEqual(covered_tests('run: node --test tests/a.test.mjs', sources.__getitem__),
                         {'tests/a.test.mjs', 'tests/b.test.mjs'})
        self.assertEqual(covered_tests('run: node --check web/a.js', sources.__getitem__), set())

    def test_lines_that_do_not_prove_a_run_do_not_count(self):
        text = '\n'.join(['# node --test tests/a.test.mjs',
                          'run: echo ok # node --test tests/b.test.mjs',
                          'echo "node --test tests/c.test.mjs"',
                          '- name: node --test tests/d.test.mjs',
                          "node --test --test-name-pattern='x' tests/e.test.mjs",
                          'node --test tests/f.test.mjs || true',
                          'node --test tests/g.test.mjs.bak',
                          'node --test tests/browser/h.test.mjs tests/browser/*.test.mjs'])
        self.assertEqual(named_in_workflow(text), [])
        self.assertEqual(named_in_workflow('run: node --test tests/i.test.mjs\n  - run: node --test tests/j.test.mjs'),
                         ['tests/i.test.mjs', 'tests/j.test.mjs'])

    def test_a_commented_import_does_not_carry_a_file(self):
        sources = {'tests/a.test.mjs': "// import './b.test.mjs';\n", 'tests/b.test.mjs': ''}
        self.assertEqual(covered_tests('node --test tests/a.test.mjs', sources.__getitem__), {'tests/a.test.mjs'})


if __name__ == '__main__':
    unittest.main()
