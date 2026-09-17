"""Immutable private snapshots for cross-PC assets and evidence. Stdlib only.

Credentials stay in memory, supplied by Git Credential Manager. No credentials
or signed URLs are written to manifests. The remote must be PRIVATE on GitHub.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
REMOTE = 'Luciuswang/neon-cleaner-private-assets'
URL = 'https://github.com/' + REMOTE + '.git'
VAULT = ROOT / '.local/private-vault'
LOCK = ROOT / 'docs/sync/private-assets-lock.json'
PRIVATE_DIRS = ['ue/NeonCleanerUE/Content/' + s for s in ('KellyLowSource','KellySource','CinematicBike')]
REQUIRED_MESH = 'ue/NeonCleanerUE/Content/KellyLowSource/asda.uasset'


def git(*args, cwd=ROOT, data=None, env=None):
    result = subprocess.run(['git', *args], cwd=cwd, input=data, text=True,
                            capture_output=True, env=env)
    if result.returncode:
        raise RuntimeError('git '+ ' '.join(args[:3]) +' failed: '+result.stderr[-1800:])
    return result.stdout.strip()


def api(path, payload=None):
    raw = git('credential','fill',data='protocol=https\nhost=github.com\n\n')
    credential = dict(x.split('=',1) for x in raw.splitlines() if '=' in x)
    token = credential.get('password')
    if not token:
        raise RuntimeError('GitHub credential unavailable; sign in to Git Credential Manager')
    request = urllib.request.Request('https://api.github.com/'+path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'NeonCleaner-Sync'})
    try:
        with urllib.request.urlopen(request,timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f'GitHub API HTTP {exc.code} for {path}') from None


def ensure_private(initialize=False):
    try:
        info = api('repos/'+REMOTE)
    except RuntimeError as exc:
        if initialize and 'HTTP 404 ' in str(exc):
            info = api('user/repos', {'name':REMOTE.split('/')[1], 'private':True,
                       'description':'Private Neon Cleaner project assets and immutable cross-PC evidence snapshots'})
        else:
            raise
    if info.get('private') is not True or info.get('full_name') != REMOTE:
        raise RuntimeError('Refusing asset transfer: vault is not the expected PRIVATE repository')


def prepare_vault():
    environment = dict(os.environ, GIT_LFS_SKIP_SMUDGE='1')
    if not (VAULT/'.git').is_dir():
        VAULT.parent.mkdir(parents=True, exist_ok=True)
        git('clone','-c','core.longpaths=true',URL,str(VAULT),env=environment)
    if git('remote','get-url','origin',cwd=VAULT) != URL:
        raise RuntimeError('Unexpected private-vault remote')
    git('config','core.longpaths','true',cwd=VAULT)
    if git('status','--porcelain',cwd=VAULT):
        raise RuntimeError('Private vault has unfinished local changes; preserve and inspect before retry')
    git('fetch','origin','--prune',cwd=VAULT,env=environment)
    refs = git('for-each-ref','--format=%(refname)','refs/remotes/origin/main',cwd=VAULT)
    if refs:
        git('checkout','main',cwd=VAULT,env=environment)
        git('merge','--ff-only','origin/main',cwd=VAULT,env=environment)
    else:
        git('checkout','-B','main',cwd=VAULT,env=environment)
    git('lfs','install','--local',cwd=VAULT)


def sha(path):
    h = hashlib.sha256()
    with open(native_path(path),'rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()


def native_path(path):
    value=str(path.resolve())
    if os.name=='nt' and value.startswith('\\\\') and not value.startswith('\\\\?\\'):
        return '\\\\?\\UNC\\'+value[2:]
    return '\\\\?\\'+value if os.name=='nt' and not value.startswith('\\\\?\\') else value


def copy_file(source, destination):
    # Exclusive creation closes the preflight-to-copy race between local sessions.
    with open(native_path(source),'rb') as src, open(native_path(destination),'xb') as dst:
        shutil.copyfileobj(src,dst,1024*1024)
    shutil.copystat(native_path(source),native_path(destination))


def safe_path(base, relative):
    relative = relative.replace('\\','/')
    if relative.startswith('/') or ':' in relative or '..' in relative.split('/'):
        raise ValueError('Unsafe snapshot path')
    target = (base/relative).resolve()
    if not target.is_relative_to(base.resolve()):
        raise ValueError('Snapshot path escapes root')
    return Path(native_path(target))


def inventory(extra=None):
    files = {}
    if not (ROOT/REQUIRED_MESH).is_file():
        raise RuntimeError('Active private Kelly mesh missing; restore before publishing a playable checkpoint')
    for folder in PRIVATE_DIRS+['.local/private-sources']:
        for path in (ROOT/folder).rglob('*'):
            if path.is_file():
                files[path.relative_to(ROOT).as_posix()] = path
    # Preserve exact reviewed binaries separately from generated compiler caches.
    for name in ('UnrealEditor-NeonCleanerUE.dll','UnrealEditor.modules','NeonCleanerUEEditor.target'):
        relative = 'ue/NeonCleanerUE/Binaries/Win64/'+name
        if (ROOT/relative).is_file(): files[relative] = ROOT/relative
    report = ROOT/'docs/qa/cinematic-upgrade-2026-09-16.json'
    if report.is_file():
        data = json.loads(report.read_text(encoding='utf8'))
        for item in data.get('evidence',[]):
            for entry in [item,item.get('ue_frame_log',{})]:
                if entry.get('path'):
                    relative = entry['path']
                    path = safe_path(ROOT,relative)
                    if not path.is_file(): raise RuntimeError('Missing recorded evidence: '+relative)
                    if relative.startswith(('.local/','ue/NeonCleanerUE/Saved/')):
                        files[relative] = path
    quality = ROOT/'ue/NeonCleanerUE/Saved/Quality'
    for pattern in ('cinematic-performance/*','cinematic-performance.log','cinematic-motion-reviewed/motion-report.json'):
        for path in quality.glob(pattern):
            if path.is_file(): files[path.relative_to(ROOT).as_posix()] = path
    if extra:
        for entry in json.loads(Path(extra).read_text(encoding='utf-8-sig'))['files']:
            relative = entry['destination']
            if not relative.startswith('.local/private-sources/'):
                raise ValueError('Extra source destinations must be under .local/private-sources/')
            safe_path(ROOT,relative)
            path = Path(entry['source'])
            if not path.is_file(): raise FileNotFoundError(path)
            local = safe_path(ROOT,relative)
            if local.exists() and sha(local)!=sha(path):
                raise RuntimeError('Preserving differing private source: '+relative)
            if not local.exists():
                local.parent.mkdir(parents=True,exist_ok=True)
                copy_file(path,local)
            files[relative] = local
    return files


def publish(extra=None):
    files = inventory(extra)
    manifest = dict(schema=1, engine='5.8.1', files=[dict(path=k,bytes=v.stat().st_size,sha256=sha(v)) for k,v in sorted(files.items())])
    payload = json.dumps(manifest,sort_keys=True,indent=2)+'\n'
    snapshot = hashlib.sha256(payload.encode()).hexdigest()
    destination = VAULT/'snapshots'/snapshot
    if not destination.exists():
        destination.mkdir(parents=True)
        for entry in manifest['files']:
            output = safe_path(destination/'payload',entry['path'])
            output.parent.mkdir(parents=True,exist_ok=True)
            copy_file(files[entry['path']],output)
            if sha(output) != entry['sha256']: raise RuntimeError('Source changed while snapshotting: '+entry['path'])
        (destination/'manifest.json').write_text(payload,encoding='utf8')
        (VAULT/'README.md').write_text('# Private Neon Cleaner asset vault\n\nImmutable snapshots; restore with the public project tools/sync/private_assets.py.\nDo not make this repository public. No Epic Marketplace redistribution.\n',encoding='utf8')
    (VAULT/'.gitattributes').write_text('snapshots/**/payload/** filter=lfs diff=lfs merge=lfs -text\nsnapshots/**/manifest.json text eol=lf\nREADME.md text eol=lf\n.gitattributes text eol=lf\n',encoding='utf8')
    git('add','--','.gitattributes','README.md','snapshots/'+snapshot,cwd=VAULT)
    if git('diff','--cached','--name-only',cwd=VAULT):
        git('-c','user.name='+git('config','user.name'),'-c','user.email='+git('config','user.email'),
            'commit','-m','Snapshot '+snapshot[:16],cwd=VAULT)
    # Never overwrite a concurrent vault publication. A rejected push is a real failure.
    git('push','-u','origin','main',cwd=VAULT)
    commit = git('rev-parse','HEAD',cwd=VAULT)
    remote = git('ls-remote','origin','refs/heads/main',cwd=VAULT).split()[0]
    if remote != commit: raise RuntimeError('Private remote acknowledgement differs from local snapshot commit')
    LOCK.parent.mkdir(parents=True,exist_ok=True)
    lock = dict(schema=1,remote=URL,commit=commit,snapshot=snapshot,manifest_sha256=snapshot,
                file_count=len(files),bytes=sum(e['bytes'] for e in manifest['files']),engine='5.8.1')
    LOCK.write_text(json.dumps(lock,indent=2)+'\n',encoding='utf8')
    print('PRIVATE SNAPSHOT VERIFIED',snapshot[:16],len(files),'files',lock['bytes'],'bytes')


def restore():
    lock = json.loads(LOCK.read_text(encoding='utf8'))
    if lock['remote'] != URL: raise ValueError('Unexpected vault in lock file')
    snapshot = lock['snapshot']
    if len(snapshot)!=64 or any(c not in '0123456789abcdef' for c in snapshot): raise ValueError('Invalid snapshot ID')
    manifest_path = VAULT/'snapshots'/snapshot/'manifest.json'
    raw = manifest_path.read_bytes().replace(b'\r\n',b'\n')
    if hashlib.sha256(raw).hexdigest()!=lock['manifest_sha256']: raise ValueError('Manifest checksum mismatch')
    manifest = json.loads(raw)
    git('lfs','pull','origin','--include=snapshots/'+snapshot+'/payload/**','--exclude=',cwd=VAULT)
    actions=[]
    for entry in manifest['files']:
        source=safe_path(manifest_path.parent/'payload',entry['path'])
        destination=safe_path(ROOT,entry['path'])
        if sha(source)!=entry['sha256']: raise ValueError('Corrupt vault content: '+entry['path'])
        if destination.exists():
            if sha(destination)!=entry['sha256']:
                raise RuntimeError('Preserving differing local file; inspect before restoring: '+entry['path'])
        else: actions.append((source,destination,entry['sha256']))
    for source,destination,expected in actions:
        destination.parent.mkdir(parents=True,exist_ok=True)
        copy_file(source,destination)
        if sha(destination)!=expected: raise RuntimeError('Restored file checksum mismatch: '+str(destination))
    print('PRIVATE RESTORE VERIFIED',len(manifest['files']),'files;',len(actions),'restored')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['publish','restore'])
    parser.add_argument('--initialize',action='store_true')
    parser.add_argument('--extra-sources',type=Path)
    args=parser.parse_args()
    ensure_private(args.initialize)
    prepare_vault()
    if args.action=='publish': publish(args.extra_sources)
    else: restore()


if __name__=='__main__':
    main()
