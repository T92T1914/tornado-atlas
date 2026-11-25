"""The deploy job publishes only while its revision is still the head of main."""
from contextlib import redirect_stdout
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from pages_head import decide, main, remote_head  # noqa: E402

WORKFLOW = ROOT / '.github' / 'workflows' / 'checks.yml'
GATE = "if: ${{ steps.pages_head.outputs.publish == 'true' }}"
OLD = '7df4f2b' + '0' * 33
NEW = 'a94b54a' + '1' * 33


def listing(sha, ref='refs/heads/main'):
    return f'{sha}\t{ref}\n'


def fake_run(stdout='', returncode=0, stderr=''):
    calls = []

    def run(command, **options):
        calls.append(command)
        return subprocess.CompletedProcess(command, returncode, stdout, stderr)
    return run, calls


def deploy_steps(text):
    """The step blocks of the deploy job, each as its list of lines."""
    lines = text.splitlines()
    start = lines.index('  deploy:')
    end = next((i for i in range(start + 1, len(lines))
                if lines[i].startswith('  ') and not lines[i].startswith('   ')), len(lines))
    job = lines[start:end]
    first = job.index('    steps:') + 1
    steps = []
    for line in job[first:]:
        if line.startswith('      - '):
            steps.append([line])
        elif steps:
            steps[-1].append(line)
    return steps


def gated(step):
    return any(line.strip() == GATE for line in step)


class DecisionTests(unittest.TestCase):
    def test_head_of_main_publishes(self):
        self.assertEqual(decide(NEW, NEW), (True, 'this revision is the head of main'))

    def test_an_older_revision_skips_and_names_the_newer_head(self):
        publish, reason = decide(OLD, NEW)
        self.assertFalse(publish)
        self.assertIn(NEW, reason)
        self.assertIn(OLD, reason)

    def test_a_missing_head_or_a_short_sha_is_an_error_not_a_skip(self):
        with self.assertRaises(ValueError):
            decide(NEW, None)
        with self.assertRaises(ValueError):
            decide(NEW[:7], NEW)

    def test_only_the_main_ref_is_read(self):
        text = listing(OLD, 'refs/heads/main-old') + listing(NEW) + listing(OLD, 'refs/tags/main')
        self.assertEqual(remote_head(text), NEW)
        self.assertIsNone(remote_head(listing(OLD, 'refs/heads/release/main')))
        self.assertIsNone(remote_head('not a sha\trefs/heads/main\n'))


class CommandTests(unittest.TestCase):
    def run_main(self, expected, **result):
        run, calls = fake_run(**result)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'output'
            output.write_text('', encoding='utf-8')
            log = io.StringIO()
            with redirect_stdout(log):
                code = main(['pages_head.py', expected], run=run, environ={'GITHUB_OUTPUT': str(output)})
            self.log = log.getvalue()
            return code, output.read_text(encoding='utf-8'), calls

    def test_the_race_of_2026_11_15_skips_the_older_deploy_and_says_why(self):
        code, output, calls = self.run_main(OLD, stdout=listing(NEW))
        self.assertEqual((code, output), (0, 'publish=false\n'))
        self.assertEqual(calls, [['git', 'ls-remote', 'origin', 'refs/heads/main']])
        self.assertIn(f'ATLAS_PAGES_HEAD sha={OLD} main={NEW} publish=false reason=main has moved to {NEW}', self.log)
        self.assertIn(f'::warning title=Publication skipped::', self.log)
        self.assertIn(f'Confirm that the run for {NEW} deployed.', self.log)

    def test_the_head_publishes_without_a_warning(self):
        self.assertEqual(self.run_main(NEW, stdout=listing(NEW))[:2], (0, 'publish=true\n'))
        self.assertIn(f'ATLAS_PAGES_HEAD sha={NEW} main={NEW} publish=true reason=', self.log)
        self.assertNotIn('::warning', self.log)

    def test_a_failed_lookup_stops_the_job_without_an_output(self):
        self.assertEqual(self.run_main(NEW, returncode=128, stderr='fatal')[:2], (1, ''))
        self.assertEqual(self.run_main(NEW, stdout='')[:2], (1, ''))


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.steps = deploy_steps(WORKFLOW.read_text(encoding='utf-8'))

    def test_the_guard_runs_before_anything_is_published(self):
        names = [' '.join(step) for step in self.steps]
        guard = next(i for i, step in enumerate(names) if 'id: pages_head' in step)
        self.assertIn('python3 tools/pages_head.py "$ATLAS_EXPECTED_SHA"', names[guard])
        self.assertIn('ATLAS_EXPECTED_SHA: ${{ github.sha }}', names[guard])
        self.assertFalse(gated(self.steps[guard]))
        # A failed lookup must fail the job. Ignoring its exit status would skip every gated step in silence.
        self.assertFalse(any('continue-on-error' in line for line in self.steps[guard]))
        for i, step in enumerate(names):
            if 'actions/checkout' in step:
                self.assertLess(i, guard)

    def test_every_step_after_the_guard_waits_for_its_answer(self):
        guard = next(i for i, step in enumerate(self.steps) if any('id: pages_head' in line for line in step))
        later = self.steps[guard + 1:]
        self.assertTrue(any('actions/deploy-pages' in ' '.join(step) for step in later))
        self.assertEqual([step[0] for step in later if not gated(step)], [])

    def test_an_ungated_publishing_step_is_reported(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        loosened = text.replace('id: deployment\n        ' + GATE + '\n', 'id: deployment\n', 1)
        self.assertNotEqual(loosened, text)
        steps = deploy_steps(loosened)
        self.assertEqual([step[0].strip() for step in steps if 'deploy-pages' in step[0] and not gated(step)],
                         ['- uses: actions/deploy-pages@v4'])


class ArtifactWaitTests(unittest.TestCase):
    """deploy-pages starts only after the run lists the artifact the job uploaded."""
    NAME = 'github-pages-${{ github.run_attempt }}'

    def setUp(self):
        self.steps = [' '.join(step) for step in deploy_steps(WORKFLOW.read_text(encoding='utf-8'))]

    def index(self, needle):
        found = [i for i, step in enumerate(self.steps) if needle in step]
        self.assertEqual(len(found), 1, needle)
        return found[0]

    def test_the_wait_sits_between_the_upload_and_the_deployment(self):
        upload = self.index('actions/upload-pages-artifact')
        wait = self.index('tools/pages_artifact_wait.mjs')
        deploy = self.index('actions/deploy-pages')
        self.assertEqual((wait, deploy), (upload + 1, upload + 2))

    def test_all_three_steps_name_the_same_artifact(self):
        upload = self.steps[self.index('actions/upload-pages-artifact')]
        wait = self.steps[self.index('tools/pages_artifact_wait.mjs')]
        deploy = self.steps[self.index('actions/deploy-pages')]
        self.assertIn(f'name: {self.NAME}', upload)
        self.assertIn(f'ATLAS_PAGES_ARTIFACT: {self.NAME}', wait)
        self.assertIn(f'artifact_name: {self.NAME}', deploy)

    def test_the_wait_runs_in_an_action_and_can_stop_the_deployment(self):
        step = self.steps[self.index('tools/pages_artifact_wait.mjs')]
        # Only an action receives the runtime token the artifact service needs.
        self.assertIn('uses: actions/github-script@', step)
        self.assertIn(GATE, step)
        # A failed wait must fail the job, so deploy-pages never runs on a guess.
        self.assertNotIn('continue-on-error', step)
        deploy = self.steps[self.index('actions/deploy-pages')]
        self.assertNotIn('always()', deploy)
        self.assertNotIn('failure()', deploy)

    def test_the_module_is_checked_and_tested_in_the_workflow(self):
        text = WORKFLOW.read_text(encoding='utf-8')
        self.assertIn('node --check tools/pages_artifact_wait.mjs', text)
        self.assertIn('node --test tests/pages-artifact-wait.test.mjs', text)


if __name__ == '__main__':
    unittest.main()
