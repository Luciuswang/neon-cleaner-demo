"""Isolated private backup/restore of Riverfall user imports; no UE vault edits.

Uses the already-configured PRIVATE repository and a separate clean checkout.
Never publishes these assets to the public game repository or overwrites local edits.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[3]
STORE = REPO / '.local/river-downloaded-assets'
CHECKOUT = REPO / '.local/river-import-backup-full-sparse'
POINTER = REPO / 'experiments/sunbreak-river-v4/qa/downloaded-private-backup.json'
REMOTE = 'https://github.com/Luciuswang/neon-cleaner-private-assets.git'
BRANCH = 'work/sunbreak-river-downloaded-assets-2026-11-19/c962db33'
ENV = dict(os.environ, GIT_LFS_SKIP_SMUDGE='1')

def git(*args, cwd=CHECKOUT):
    # Command-line config also overrides branch-owned .lfsconfig and propagates
    # through pre-push hooks; every LFS transfer stays on the verified repository.
    endpoints = [part for key in ['lfs.url','lfs.pushurl','remote.origin.lfsurl','remote.origin.lfspushurl'] for part in ['-c',key+'='+REMOTE+'/info/lfs']]
    r = subprocess.run(['git', *endpoints, *args], cwd=cwd, env=ENV, capture_output=True, text=True, timeout=240)
    if r.returncode:
        raise RuntimeError('git ' + ' '.join(args[:3]) + ': ' + r.stderr[-1200:])
    return r.stdout.strip()

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def private_check():
    spec = importlib.util.spec_from_file_location('neon_private_helpers', REPO / 'tools/sync/private_assets.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if module.URL != REMOTE:
        raise RuntimeError('Private helper targets a different configured repository')
    module.ensure_private()  # Reads account auth in memory; never prints credentials.

def checkout(branch='main'):
    if any(os.environ.get(k) for k in ['GIT_DIR','GIT_COMMON_DIR','GIT_WORK_TREE','GIT_INDEX_FILE']):
        raise RuntimeError('Refusing redirected Git environment')
    for root in [CHECKOUT, STORE]:
        if root.resolve() != root.absolute():
            raise RuntimeError('Refusing redirected local import root')
    private_check()
    if not CHECKOUT.exists():
        git('clone', '-c', 'core.longpaths=true', '--no-checkout', '--depth=1', '--single-branch', '--branch', branch, REMOTE, str(CHECKOUT), cwd=REPO)
        # Do not materialize unrelated UE snapshot trees (very long Windows paths).
        git('sparse-checkout', 'init', '--cone')
        git('sparse-checkout', 'set', 'imports')
        git('checkout', branch)
    if git('remote', 'get-url', 'origin') != REMOTE:
        raise RuntimeError('Unexpected backup remote')
    if git('remote', 'get-url', '--push', '--all', 'origin').splitlines() != [REMOTE]:
        raise RuntimeError('Unexpected effective push destination')
    if Path(git('rev-parse', '--show-toplevel')).resolve() != CHECKOUT.resolve() or (CHECKOUT / git('rev-parse', '--git-common-dir')).resolve() != (CHECKOUT / '.git').resolve():
        raise RuntimeError('Refusing shared or redirected backup Git directory')
    for key in ['lfs.url','lfs.pushurl','remote.origin.lfsurl','remote.origin.lfspushurl']:
        configured = subprocess.run(['git','config','--get',key],cwd=CHECKOUT,env=ENV,capture_output=True,text=True)
        if configured.returncode not in [0,1] or (configured.returncode == 0 and configured.stdout.strip() != REMOTE + '/info/lfs'):
            raise RuntimeError('Refusing unexpected LFS endpoint override: ' + key)
    if git('status', '--porcelain'):
        raise RuntimeError('Backup checkout dirty; preserve and inspect, no overwrite')
    git('lfs', 'install', '--local')
    git('config', 'core.longpaths', 'true')

def payloads(manifest, folder):
    result = []
    seen = set()
    for item in manifest['assets']:
        name = item['file']
        if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*\.glb', name) or name in seen:
            raise RuntimeError('Unsafe payload name')
        seen.add(name)
        source = folder / name
        if source.resolve().parent != folder.resolve():
            raise RuntimeError('Payload leaves approved folder')
        if not source.is_file() or source.stat().st_size != item['bytes'] or sha(source) != item['sha256']:
            raise RuntimeError('Payload identity mismatch: ' + name)
        result.append((item, source))
    return result

def publish():
    manifest_bytes = (STORE / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    files = payloads(manifest, STORE)
    digest = hashlib.sha256(manifest_bytes).hexdigest()
    # Continue the acknowledged snapshot branch when it already exists.
    remote_ref = git('ls-remote', REMOTE, 'refs/heads/' + BRANCH, cwd=REPO)
    checkout(BRANCH if remote_ref else 'main')
    if git('branch', '--show-current') != BRANCH:
        if git('branch', '--list', BRANCH):
            git('switch', BRANCH)
        else:
            git('switch', '-c', BRANCH)
    target = CHECKOUT / 'imports' / digest
    if target.exists():
        if (target / 'manifest.json').read_bytes() != manifest_bytes:
            raise RuntimeError('Immutable snapshot conflict')
        # Clean fresh clones contain LFS pointers because smudging is disabled.
        git('lfs', 'pull', '--include=imports/' + digest + '/payload/**', '--exclude=', 'origin')
        payloads(manifest, target / 'payload')
    else:
        (target / 'payload').mkdir(parents=True)
        with (target / 'manifest.json').open('xb') as out:
            out.write(manifest_bytes)
        for item, source in files:
            with (target / 'payload' / item['file']).open('xb') as out, source.open('rb') as incoming:
                shutil.copyfileobj(incoming, out)
        payloads(manifest, target / 'payload')
    attributes = CHECKOUT / '.gitattributes'
    # Migrate only the two rules introduced by this tool's first private checkpoint.
    # Never touch the canonical snapshots/** rules or unrelated attributes.
    old_rules = {'imports/**/payload/** filter=lfs diff=lfs merge=lfs -text', 'imports/**/manifest.json -text'}
    lines = attributes.read_text(encoding='utf-8').splitlines()
    if old_rules.intersection(lines):
        attributes.write_text('\n'.join(line for line in lines if line not in old_rules)+'\n', encoding='utf-8', newline='\n')
    git('lfs', 'track', 'imports/' + digest + '/payload/**')
    # Manifest hash names the immutable directory; never normalize its newlines.
    rule = 'imports/' + digest + '/manifest.json -text'
    if rule not in attributes.read_text(encoding='utf-8').splitlines():
        with attributes.open('a', encoding='utf-8', newline='\n') as out:
            out.write('\n' + rule + '\n')
    git('add', '--', '.gitattributes', 'imports/' + digest)
    for path in git('diff', '--cached', '--name-only').splitlines():
        if path != '.gitattributes' and not path.startswith('imports/' + digest + '/'):
            raise RuntimeError('Unrelated staged private path')
    if git('diff', '--cached', '--name-only'):
        git('commit', '-m', 'Private immutable Riverfall user scan derivatives ' + digest[:12])
    git('push', '-u', 'origin', 'HEAD:refs/heads/' + BRANCH)
    commit = git('rev-parse', 'HEAD')
    if git('ls-remote', 'origin', 'refs/heads/' + BRANCH).split()[0] != commit:
        raise RuntimeError('Remote backup acknowledgement mismatch')
    # Independent empty LFS cache verifies remote availability, not local cache hits.
    cache_root = REPO / '.local/river-import-verified-lfs'
    cache_root.mkdir(parents=True, exist_ok=True)
    storage = Path(tempfile.mkdtemp(prefix=digest[:12]+'-', dir=cache_root))
    git('-c', 'lfs.storage=' + str(storage), 'lfs', 'fetch', '--include=imports/' + digest + '/payload/**', '--exclude=', 'origin', commit)
    for item, _ in files:
        h = item['sha256']
        remote_object = storage / 'objects' / h[:2] / h[2:4] / h
        if sha(remote_object) != h:
            raise RuntimeError('Remote LFS payload unavailable or wrong')
    record = dict(schema='river-private-import-backup-v1', status='VERIFIED', remote=REMOTE, branch=BRANCH,
                  commit=commit, snapshot='imports/' + digest, manifestSHA256=digest,
                  files=len(files), bytes=sum(a['bytes'] for a, _ in files),
                  remoteLFSFreshCacheVerified=True, sourceLicense='UNVERIFIED - same-owner private backup only',
                  scope='Selected browser derivatives only. Existing dirty UE private vault and canonical private-assets-lock untouched.')
    POINTER.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(record))

def restore():
    record = json.loads(POINTER.read_text(encoding='utf-8'))
    if record['remote'] != REMOTE or record['status'] != 'VERIFIED':
        raise RuntimeError('Unexpected backup pointer')
    if not re.fullmatch('[0-9a-f]{40}', record['commit']) or not re.fullmatch('[0-9a-f]{64}', record['manifestSHA256']) or record['snapshot'] != 'imports/' + record['manifestSHA256']:
        raise RuntimeError('Unsafe backup identity')
    checkout(record['branch'])
    git('fetch', 'origin', record['commit'])
    git('checkout', '--detach', record['commit'])
    git('lfs', 'pull', '--include=' + record['snapshot'] + '/payload/**', '--exclude=', 'origin')
    folder = CHECKOUT / record['snapshot']
    if folder.resolve().parent != (CHECKOUT / 'imports').resolve() or sha(folder / 'manifest.json') != record['manifestSHA256']:
        raise RuntimeError('Snapshot identity mismatch')
    manifest = json.loads((folder / 'manifest.json').read_bytes())
    files = payloads(manifest, folder / 'payload') + [({'file':'manifest.json','sha256':record['manifestSHA256']},folder / 'manifest.json')]
    # Whole-batch preflight: never partially restore over a modified local model.
    for item, source in files:
        destination = STORE / item['file']
        if destination.resolve().parent != STORE.resolve():
            raise RuntimeError('Restore destination leaves approved local store')
        if destination.exists() and sha(destination) != item['sha256']:
            raise RuntimeError('Preserve modified local import: ' + item['file'])
    STORE.mkdir(parents=True, exist_ok=True)
    for item, source in files:
        destination = STORE / item['file']
        if not destination.exists():
            with destination.open('xb') as out, source.open('rb') as incoming:
                shutil.copyfileobj(incoming, out)
        if sha(destination) != item['sha256']:
            raise RuntimeError('Restored bytes mismatch')
    print('RESTORED selected local browser imports; UE vault untouched')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['publish','restore'])
    args = parser.parse_args()
    publish() if args.mode == 'publish' else restore()
