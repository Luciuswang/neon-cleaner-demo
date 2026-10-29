"""Checkpoint safety tests. All Git mutations target disposable local repositories.

Private restore tests patch the vault and Git transport; no GitHub/API access.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
SHELL = shutil.which('powershell') or shutil.which('pwsh')


def load(name):
    spec = importlib.util.spec_from_file_location(name, REPO / 'tools/sync' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


private = load('private_assets')
claims = load('claim_task')


def command(repo, *args, check=True):
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
    result = subprocess.run(args, cwd=repo, env=env, text=True, capture_output=True,
                            encoding='utf8', errors='replace', timeout=60)
    if check and result.returncode:
        raise AssertionError(result.stdout + '\n' + result.stderr)
    return result


def git(repo, *args):
    return command(repo, 'git', *args).stdout.strip()


class RepositoryFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.origin = self.base / 'origin.git'
        self.repo = self.base / 'first'
        self.origin.mkdir(); self.repo.mkdir()
        git(self.origin, 'init', '--bare')
        git(self.repo, 'init', '-b', 'work/checkpoint')
        self.identity(self.repo)
        git(self.repo, 'remote', 'add', 'origin', str(self.origin))
        for name in ('sync_project_start.ps1', 'sync_project_finish.ps1'):
            shutil.copyfile(REPO / name, self.repo / name)
        (self.repo / 'tools/sync').mkdir(parents=True)
        shutil.copyfile(REPO / 'tools/sync/claim_task.py', self.repo / 'tools/sync/claim_task.py')
        (self.repo / '.gitignore').write_text('.local/\n')
        (self.repo / 'docs').mkdir()
        (self.repo / 'docs/handoff.md').write_text('# Fixture\n')
        self.commit(self.repo, 'baseline.txt', 'base')
        git(self.repo, 'push', '-u', 'origin', 'HEAD')

    @staticmethod
    def identity(repo):
        git(repo, 'config', 'user.name', 'Checkpoint Fixture')
        git(repo, 'config', 'user.email', 'fixture@example.invalid')

    @staticmethod
    def commit(repo, name, content):
        (repo / name).write_text(content)
        git(repo, 'add', '-A')
        git(repo, 'commit', '-m', 'Fixture ' + name)
        return git(repo, 'rev-parse', 'HEAD')

    def second_clone(self):
        other = self.base / 'second'
        git(self.base, 'clone', '--branch', 'work/checkpoint', str(self.origin), str(other))
        self.identity(other)
        return other

    def run_ps(self, name, *args):
        if not SHELL:
            self.skipTest('PowerShell unavailable')
        return command(self.repo, SHELL, '-NoProfile', '-ExecutionPolicy', 'Bypass',
                       '-File', str(self.repo / name), *args, check=False)

    def test_finish_default_pushes_clean_ahead_head(self):
        ahead = self.commit(self.repo, 'ahead.txt', 'saved locally')
        result = self.run_ps('sync_project_finish.ps1', '-SkipPrivateAssets')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('UPLOAD VERIFIED', result.stdout)
        self.assertEqual(git(self.origin, 'rev-parse', 'refs/heads/work/checkpoint'), ahead)
        self.assertEqual(git(self.repo, 'rev-parse', 'HEAD'), ahead)

    def test_finish_default_commits_dirty_without_prompt(self):
        (self.repo / 'new-work.txt').write_text('authorized work')
        result = self.run_ps('sync_project_finish.ps1', '-SkipPrivateAssets')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(git(self.repo, 'status', '--porcelain'), '')
        self.assertEqual(git(self.origin, 'rev-parse', 'refs/heads/work/checkpoint'), git(self.repo, 'rev-parse', 'HEAD'))

    def test_finish_rejected_push_is_failure_and_preserves_both_heads(self):
        other = self.second_clone()
        remote = self.commit(other, 'remote-only.txt', 'other computer')
        git(other, 'push', 'origin', 'HEAD')
        local = self.commit(self.repo, 'local-only.txt', 'local computer')
        result = self.run_ps('sync_project_finish.ps1', '-SkipPrivateAssets')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('UPLOAD VERIFIED', result.stdout)
        self.assertEqual(git(self.repo, 'rev-parse', 'HEAD'), local)
        self.assertEqual(git(self.origin, 'rev-parse', 'refs/heads/work/checkpoint'), remote)

    def test_precommit_failure_never_reports_uploaded(self):
        head = git(self.repo, 'rev-parse', 'HEAD')
        hook = self.repo / '.git/hooks/pre-commit'
        hook.write_text('#!/bin/sh\nexit 1\n', newline='\n')
        hook.chmod(0o755)
        (self.repo / 'uncommitted.txt').write_text('preserve this work')
        result = self.run_ps('sync_project_finish.ps1', '-SkipPrivateAssets')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('UPLOAD VERIFIED', result.stdout)
        self.assertEqual(git(self.repo, 'rev-parse', 'HEAD'), head)
        self.assertEqual((self.repo / 'uncommitted.txt').read_text(), 'preserve this work')

    def test_start_preserves_current_task_branch_and_dirty_state(self):
        if command(self.repo, 'git', 'lfs', 'version', check=False).returncode:
            self.skipTest('Git LFS unavailable for start script')
        git(self.repo, 'checkout', '-b', 'work/independent-task')
        (self.repo / 'baseline.txt').write_text('dirty task edit')
        (self.repo / 'untracked.txt').write_text('untracked work')
        before = git(self.repo, 'status', '--porcelain')
        head = git(self.repo, 'rev-parse', 'HEAD')
        result = self.run_ps('sync_project_start.ps1')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(git(self.repo, 'branch', '--show-current'), 'work/independent-task')
        self.assertEqual(git(self.repo, 'rev-parse', 'HEAD'), head)
        self.assertEqual(git(self.repo, 'status', '--porcelain'), before)
        self.assertEqual((self.repo / 'baseline.txt').read_text(), 'dirty task edit')

    def test_remote_overlap_lease_rejects_other_owner_without_worktree_change(self):
        other = self.second_clone()
        def claim(repo, task, scope):
            return command(repo, sys.executable, '-B', 'tools/sync/claim_task.py',
                           'acquire', task, '--scope', scope, check=False)
        status = git(self.repo, 'status', '--porcelain')
        head = git(self.repo, 'rev-parse', 'HEAD')
        first = claim(self.repo, 'TASK-A', 'ue/Shared.cpp')
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        self.assertEqual(git(self.origin, 'ls-tree', '--name-only', 'refs/heads/coordination/task-claims'), 'claims.json')
        second = claim(other, 'TASK-B', 'ue/shared.cpp')
        self.assertNotEqual(second.returncode, 0)
        self.assertIn('already claimed', second.stderr)
        disjoint = claim(other, 'TASK-C', 'docs/independent.md')
        self.assertEqual(disjoint.returncode, 0, disjoint.stdout + disjoint.stderr)
        registry = json.loads(git(self.origin, 'show', 'refs/heads/coordination/task-claims:claims.json'))
        self.assertEqual(set(registry['claims']), {'TASK-A', 'TASK-C'})
        self.assertEqual(git(self.repo, 'rev-parse', 'HEAD'), head)
        self.assertEqual(git(self.repo, 'status', '--porcelain'), status)


class ScopeSafetyTests(unittest.TestCase):
    def test_absolute_windows_and_traversal_scopes_rejected(self):
        for value in ('/ue/file', '\\ue\\file', '\\\\server\\share\\file', 'C:\\ue\\file',
                      '../file', 'ue/../file', 'ue/file:stream'):
            with self.subTest(scope=value), self.assertRaises(ValueError):
                claims.normalize(value)

    def test_aliases_cannot_bypass_overlap(self):
        for value in ('ue/./file.cpp', 'ue//file.cpp', 'ue/file.cpp.', 'ue/file.cpp '):
            with self.subTest(scope=value):
                try:
                    normalized = claims.normalize(value)
                except ValueError:
                    continue
                self.assertTrue(claims.overlaps(normalized, 'ue/file.cpp'), normalized)


class PrivateRestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        def cleanup_long_fixture():
            target = Path(self.temp.name).resolve()
            expected_parent = Path(tempfile.gettempdir()).resolve()
            if target.parent != expected_parent or not target.name.startswith('tmp'):
                raise RuntimeError('Refusing cleanup outside the exact temporary fixture')
            if target.exists():
                shutil.rmtree(private.native_path(target))
            self.temp.cleanup()
        self.addCleanup(cleanup_long_fixture)
        self.base = Path(self.temp.name)
        self.root = self.base / 'project'
        self.vault = self.base / 'vault'
        self.root.mkdir(); self.vault.mkdir()
        self.lock = self.root / 'lock.json'
        self.addCleanup(patch.stopall)
        patch.multiple(private, ROOT=self.root, VAULT=self.vault, LOCK=self.lock).start()
        self.transport = patch.object(private, 'git', return_value='').start()

    def snapshot(self, files):
        manifest = {'schema': 1, 'files': [{'path': p, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for p, data in files.items()]}
        payload = json.dumps(manifest, sort_keys=True).encode()
        digest = hashlib.sha256(payload).hexdigest()
        folder = self.vault / 'snapshots' / digest
        folder.mkdir(parents=True)
        (folder / 'manifest.json').write_bytes(payload)
        for relative, data in files.items():
            target = private.safe_path(folder / 'payload', relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        self.lock.write_text(json.dumps({'remote': private.URL, 'snapshot': digest, 'manifest_sha256': digest}))
        return folder

    def test_conflicting_destination_prevents_all_writes(self):
        self.snapshot({'first.uasset': b'new', 'conflict.uasset': b'remote'})
        (self.root / 'conflict.uasset').write_bytes(b'local work')
        with self.assertRaises(RuntimeError):
            private.restore()
        self.assertFalse((self.root / 'first.uasset').exists())
        self.assertEqual((self.root / 'conflict.uasset').read_bytes(), b'local work')

    def installed(self):
        return json.loads((self.root / '.local/private-assets-installed.json').read_text())['snapshot']

    def test_clean_managed_upgrade_preserves_backup_and_advances_marker(self):
        old = self.snapshot({'Content/mesh.uasset': b'old mesh', 'engine.dll': b'old dll'})
        private.restore()
        current = self.snapshot({'Content/mesh.uasset': b'new mesh', 'engine.dll': b'new dll'})
        private.restore()
        for relative, old_data, new_data in [('Content/mesh.uasset', b'old mesh', b'new mesh'),
                                             ('engine.dll', b'old dll', b'new dll')]:
            self.assertEqual((self.root / relative).read_bytes(), new_data)
            self.assertEqual((self.root / '.local/private-restore-backups' / old.name / relative).read_bytes(), old_data)
        self.assertEqual(self.installed(), current.name)
        with patch.object(private, 'copy_file', side_effect=AssertionError('Already installed')):
            private.restore()

    def test_legacy_lock_previous_snapshot_allows_clean_upgrade(self):
        old = self.snapshot({'mesh.uasset': b'old'})
        (self.root / 'mesh.uasset').write_bytes(b'old')
        current = self.snapshot({'mesh.uasset': b'new'})
        lock = json.loads(self.lock.read_text())
        lock['previous_snapshot'] = old.name
        self.lock.write_text(json.dumps(lock))
        private.restore()
        self.assertEqual((self.root / 'mesh.uasset').read_bytes(), b'new')
        self.assertEqual((self.root / '.local/private-restore-backups' / old.name / 'mesh.uasset').read_bytes(), b'old')
        self.assertEqual(self.installed(), current.name)

    def test_modified_managed_file_blocks_entire_upgrade_before_changes(self):
        old = self.snapshot({'first.uasset': b'old first', 'second.uasset': b'old second'})
        private.restore()
        (self.root / 'second.uasset').write_bytes(b'user edited')
        self.snapshot({'first.uasset': b'new first', 'added.uasset': b'new asset', 'second.uasset': b'new second'})
        with self.assertRaisesRegex(RuntimeError, 'Preserving differing local file'):
            private.restore()
        self.assertEqual((self.root / 'first.uasset').read_bytes(), b'old first')
        self.assertEqual((self.root / 'second.uasset').read_bytes(), b'user edited')
        self.assertFalse((self.root / 'added.uasset').exists())
        self.assertFalse((self.root / '.local/private-restore-backups').exists())
        self.assertEqual(self.installed(), old.name)

    def test_existing_backup_blocks_entire_upgrade(self):
        old = self.snapshot({'mesh.uasset': b'old'})
        private.restore()
        self.snapshot({'added.uasset': b'new asset', 'mesh.uasset': b'new'})
        backup = self.root / '.local/private-restore-backups' / old.name / 'mesh.uasset'
        backup.parent.mkdir(parents=True)
        backup.write_bytes(b'precious prior backup')
        with self.assertRaisesRegex(RuntimeError, 'Preserving existing restore backup'):
            private.restore()
        self.assertFalse((self.root / 'added.uasset').exists())
        self.assertEqual((self.root / 'mesh.uasset').read_bytes(), b'old')
        self.assertEqual(backup.read_bytes(), b'precious prior backup')
        self.assertEqual(self.installed(), old.name)

    def test_new_destination_race_keeps_competing_file_and_backup(self):
        old = self.snapshot({'mesh.uasset': b'old'})
        private.restore()
        self.snapshot({'mesh.uasset': b'new'})
        preserve = private.preserve_file
        def insert_competing_file(source, backup):
            preserve(source, backup)
            source.write_bytes(b'concurrent work')
        with patch.object(private, 'preserve_file', side_effect=insert_competing_file):
            with self.assertRaises(FileExistsError):
                private.restore()
        self.assertEqual((self.root / 'mesh.uasset').read_bytes(), b'concurrent work')
        self.assertEqual((self.root / '.local/private-restore-backups' / old.name / 'mesh.uasset').read_bytes(), b'old')
        self.assertEqual(self.installed(), old.name)

    def test_publish_retains_previous_snapshot_and_records_install_after_ack(self):
        old = self.snapshot({'mesh.uasset': b'old'})
        local = self.root / 'mesh.uasset'
        local.write_bytes(b'new')
        def transport(*args, **kwargs):
            if args[:2] == ('rev-parse', 'HEAD'): return 'verified-commit'
            if args[:2] == ('ls-remote', 'origin'): return 'verified-commit\trefs/heads/main'
            return ''
        with patch.object(private, 'inventory', return_value={'mesh.uasset': local}), \
             patch.object(private, 'git', side_effect=transport):
            private.publish()
            first = json.loads(self.lock.read_text())
            self.assertEqual(first['previous_snapshot'], old.name)
            self.assertEqual(self.installed(), first['snapshot'])
            private.publish()
            self.assertEqual(json.loads(self.lock.read_text())['previous_snapshot'], old.name)

    def test_failed_publish_does_not_advance_lock_or_install_marker(self):
        old = self.snapshot({'mesh.uasset': b'old'})
        private.restore()
        local = self.root / 'mesh.uasset'
        local.write_bytes(b'new')
        previous_lock = self.lock.read_bytes()
        def rejected_push(*args, **kwargs):
            if args[0] == 'push': raise RuntimeError('rejected push')
            return ''
        with patch.object(private, 'inventory', return_value={'mesh.uasset': local}), \
             patch.object(private, 'git', side_effect=rejected_push):
            with self.assertRaisesRegex(RuntimeError, 'rejected push'):
                private.publish()
        self.assertEqual(self.lock.read_bytes(), previous_lock)
        self.assertEqual(self.installed(), old.name)

    def test_corrupt_later_source_prevents_earlier_write(self):
        folder = self.snapshot({'first.uasset': b'new', 'second.uasset': b'expected'})
        (folder / 'payload/second.uasset').write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            private.restore()
        self.assertFalse((self.root / 'first.uasset').exists())
        self.assertFalse((self.root / 'second.uasset').exists())

    def test_manifest_checksum_failure_precedes_transport_or_write(self):
        folder = self.snapshot({'mesh.uasset': b'expected'})
        (folder / 'manifest.json').write_bytes(b'{}')
        with self.assertRaises(ValueError):
            private.restore()
        self.transport.assert_not_called()
        self.assertFalse((self.root / 'mesh.uasset').exists())

    def test_restore_checks_destination_after_copy(self):
        self.snapshot({'mesh.uasset': b'expected'})
        def corrupt_copy(source, destination):
            destination.write_bytes(b'corrupt during copy')
        with patch.object(private, 'copy_file', side_effect=corrupt_copy):
            with self.assertRaises((RuntimeError, ValueError)):
                private.restore()

    def test_restore_valid_long_path_and_idempotence(self):
        relative = '/'.join(['long-segment-' + str(i) + 'x' * 30 for i in range(7)]) + '/mesh.uasset'
        self.snapshot({relative: b'long path payload'})
        private.restore()
        destination = private.safe_path(self.root, relative)
        self.assertEqual(private.sha(destination), hashlib.sha256(b'long path payload').hexdigest())
        with patch.object(private, 'copy_file', side_effect=AssertionError('Must not overwrite identical file')):
            private.restore()

    def test_private_safe_path_rejects_escape_and_windows_absolute(self):
        for value in ('../file', 'a/../../file', '/absolute', 'C:\\absolute', '\\\\server\\share', 'file:stream'):
            with self.subTest(path=value), self.assertRaises(ValueError):
                private.safe_path(self.root, value)

    @unittest.skipUnless(os.name == 'nt', 'Windows UNC namespace')
    def test_native_unc_prefix_is_valid(self):
        class FakePath:
            def resolve(self):
                return '\\\\server\\share\\mesh.uasset'
        self.assertEqual(private.native_path(FakePath()), '\\\\?\\UNC\\server\\share\\mesh.uasset')


if __name__ == '__main__':
    unittest.main()
