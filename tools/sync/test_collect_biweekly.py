"""Integration tests use disposable local repositories, never the project origin."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from collect_biweekly import CANONICAL, CollectionError, collect, reporting_window, reporting_zone


def git(repo, *args, when=None):
    env = os.environ.copy()
    if when:
        env.update(GIT_AUTHOR_DATE=when, GIT_COMMITTER_DATE=when)
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True,
                            text=True, encoding='utf8', env=env)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


class RemoteReportingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.origin = self.base / 'origin.git'
        self.writer = self.base / 'writer'
        self.reader = self.base / 'reader'
        self.origin.mkdir(); self.writer.mkdir()
        git(self.origin, 'init', '--bare')
        git(self.writer, 'init', '-b', CANONICAL)
        git(self.writer, 'config', 'user.name', 'Fixture Author')
        git(self.writer, 'config', 'user.email', 'fixture@example.invalid')
        git(self.writer, 'remote', 'add', 'origin', str(self.origin))
        event = {'event_id': 'E1', 'task_id': 'TASK-1', 'timestamp_utc': '2026-09-16T08:00:00Z',
                 'status': 'executing', 'summary': 'Base work', 'machine_id': 'fixture-A'}
        self.base_sha = self.commit('docs/worklog/base.json', event)
        git(self.writer, 'push', 'origin', CANONICAL)
        git(self.base, 'clone', '--single-branch', '--branch', CANONICAL, str(self.origin), str(self.reader))
        git(self.reader, 'config', 'user.name', 'Local Fixture')
        git(self.reader, 'config', 'user.email', 'local@example.invalid')

    def commit(self, name, payload, when='2026-09-16T08:00:00+00:00', repo=None):
        repo = repo or self.writer
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload) if isinstance(payload, dict) else payload, encoding='utf8')
        git(repo, 'add', name)
        git(repo, 'commit', '-m', 'Fixture change ' + name, when=when)
        return git(repo, 'rev-parse', 'HEAD')

    def report(self):
        return collect(self.reader, '2026-09-16', '2026-09-16')

    def test_branch_only_evidence_deduplicated_and_local_head_excluded(self):
        git(self.writer, 'checkout', '-b', 'work/other-machine')
        feature = self.commit('docs/worklog/feature.json', {
            'event_id': 'E2', 'task_id': 'TASK-1', 'timestamp_utc': '2026-09-16T09:00:00Z',
            'summary': 'Branch-only work', 'status': 'review'})
        git(self.writer, 'branch', 'work/mirror')
        git(self.writer, 'push', 'origin', 'work/other-machine', 'work/mirror')
        unpublished = self.commit('local-only.txt', 'Never published', repo=self.reader)
        report = self.report()
        self.assertEqual(len(report['branch_heads']), 3)
        self.assertEqual({c['sha'] for c in report['commits']}, {self.base_sha, feature})
        self.assertNotIn(unpublished, {c['sha'] for c in report['commits']})
        self.assertEqual(len(report['worklogs']), 2)
        self.assertEqual(len(report['tasks']), 1)
        event = next(e for e in report['worklogs'] if e['event_id'] == 'E2')
        self.assertEqual(len(event['sources']), 2)
        self.assertIn('machine_id', event['missing_provenance'])
        self.assertNotIn('machine_id', event['record'])
        self.assertEqual(next(c for c in report['commits'] if c['sha'] == feature)['integration'], 'unintegrated')
        self.assertEqual(git(self.reader, 'rev-parse', 'HEAD'), unpublished)

    def test_conflicting_event_id_retains_both_variants(self):
        git(self.writer, 'checkout', '-b', 'work/conflict')
        self.commit('docs/worklog/base.json', {
            'event_id': 'E1', 'task_id': 'TASK-1', 'timestamp_utc': '2026-09-16T08:00:00Z',
            'status': 'done', 'summary': 'Conflicting claim'})
        git(self.writer, 'push', 'origin', 'work/conflict')
        report = self.report()
        self.assertEqual(len(report['worklogs']), 2)
        self.assertEqual(report['disagreements'][0]['event_id'], 'E1')
        self.assertEqual(len(report['disagreements'][0]['payload_sha256s']), 2)

    def test_fetch_failure_cannot_use_stale_refs(self):
        self.assertTrue(self.report()['complete_remote_fetch'])
        git(self.reader, 'remote', 'set-url', 'origin', str(self.base / 'missing-origin.git'))
        with self.assertRaises(CollectionError):
            self.report()

    def test_deleted_remote_branch_is_pruned(self):
        git(self.writer, 'branch', 'work/deleted')
        git(self.writer, 'push', 'origin', 'work/deleted')
        self.assertIn('work/deleted', self.report()['branch_heads'])
        git(self.writer, 'push', 'origin', '--delete', 'work/deleted')
        self.assertNotIn('work/deleted', self.report()['branch_heads'])

    def test_inclusive_shanghai_day_boundary(self):
        boundary = self.commit('boundary.txt', 'Exact local midnight', when='2026-09-16T16:00:00+00:00')
        git(self.writer, 'push', 'origin', CANONICAL)
        self.assertNotIn(boundary, {c['sha'] for c in self.report()['commits']})
        next_day = collect(self.reader, '2026-09-17', '2026-09-17')
        self.assertIn(boundary, {c['sha'] for c in next_day['commits']})

    def test_invalid_worklog_time_is_visible_not_invented(self):
        self.commit('docs/worklog/undated.json', {'event_id': 'E3', 'summary': 'No timestamp'})
        git(self.writer, 'push', 'origin', CANONICAL)
        report = self.report()
        self.assertEqual(len(report['unknown_worklogs']), 1)
        self.assertIn('Missing timestamp', report['unknown_worklogs'][0]['reason'])


class WindowTests(unittest.TestCase):
    def test_until_only_anchors_default_fourteen_day_window(self):
        start, end = reporting_window(None, '2025-01-14', reporting_zone('Asia/Shanghai'))
        self.assertEqual(start.date().isoformat(), '2025-01-01')
        self.assertEqual(end.date().isoformat(), '2025-01-14')

    def test_explicit_offset_and_reversed_window(self):
        start, end = reporting_window('2026-09-16T00:00:00Z', '2026-09-16T00:00:00Z', reporting_zone('Asia/Shanghai'))
        self.assertEqual(start, end)
        self.assertEqual(start.hour, 8)
        with self.assertRaises(CollectionError):
            reporting_window('2026-09-17', '2026-09-16', reporting_zone('Asia/Shanghai'))


if __name__ == '__main__':
    unittest.main()
