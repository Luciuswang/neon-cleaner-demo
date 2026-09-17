"""Atomic cross-PC task/path leases. Ordinary fast-forward push resolves races.

The isolated coordination branch has only claims.json; no index/worktree changes.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import uuid
ROOT=Path(__file__).resolve().parents[2]
REF='refs/heads/coordination/task-claims'

def git(*args,data=None):
    # Binary stdin avoids Windows text-mode CRLF rewriting git mktree records.
    result=subprocess.run(['git',*args],cwd=ROOT,input=data.encode('utf8') if data is not None else None,capture_output=True)
    if result.returncode: raise RuntimeError('git '+' '.join(args[:3])+' failed: '+result.stderr.decode('utf8','replace')[-1200:])
    return result.stdout.decode('utf8','replace').strip()

def owner_id():
    path=ROOT/'.local/workstation-id'
    path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists(): path.write_text(str(uuid.uuid4())+'\n',encoding='ascii')
    return path.read_text().strip()

def normalize(path):
    path=path.replace('\\','/')
    if path.startswith('/'):
        raise ValueError('Absolute/UNC paths are not repository-relative scopes')
    parts=path.split('/')
    if (not path or ':' in path or '..' in parts or '*' in path
            or any(p and p!='.' and (p.endswith('.') or p.endswith(' ')) for p in parts)):
        raise ValueError('Use explicit repository-relative files/directories as scopes')
    path='/'.join(p for p in parts if p and p!='.')
    if not path: raise ValueError('Empty scope')
    return path

def overlaps(a,b):
    a,b=normalize(a).casefold(),normalize(b).casefold()
    return a==b or a.startswith(b+'/') or b.startswith(a+'/')

def read_registry():
    remote=git('ls-remote','origin',REF)
    if not remote: return None,dict(schema=1,claims={})
    git('fetch','origin',REF)
    head=git('rev-parse','FETCH_HEAD')
    try:
        content=git('show',head+':claims.json')
    except RuntimeError:
        # Repair the first Windows text-mode registry without discarding its lease.
        content=git('show',head+':claims.json\r')
    return head,json.loads(content)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['list','acquire','renew','release'])
    parser.add_argument('task',nargs='?')
    parser.add_argument('--scope',action='append',default=[])
    parser.add_argument('--hours',type=float,default=8)
    args=parser.parse_args()
    head,registry=read_registry()
    if args.action=='list': print(json.dumps(registry,indent=2)); return
    if not args.task or not 0<args.hours<=24: raise ValueError('Task ID and lease of0..24hours required')
    now=datetime.now(timezone.utc)
    owner=owner_id()
    claims=registry['claims']
    existing=claims.get(args.task)
    active=lambda c: datetime.fromisoformat(c['expires_at'])>now
    if args.action in ('release','renew'):
        if not existing or existing['owner']!=owner:
            raise RuntimeError('Cannot change another workstation\'s task claim')
    if args.action=='release': del claims[args.task]
    else:
        scopes=[normalize(p) for p in (args.scope or (existing or {}).get('scopes',[]))]
        if not scopes: raise ValueError('At least one explicit --scope is required')
        for key,claim in claims.items():
            if not active(claim): continue
            if key==args.task and claim['owner']==owner: continue
            if key==args.task or any(overlaps(a,b) for a in scopes for b in claim['scopes']):
                raise RuntimeError('Task/path already claimed: '+key+' until '+claim['expires_at'])
        claims[args.task]=dict(owner=owner,task_id=args.task,scopes=scopes,
            branch=git('branch','--show-current'),base_commit=git('rev-parse','HEAD'),
            updated_at=now.isoformat(),expires_at=(now+timedelta(hours=args.hours)).isoformat())
    blob=git('hash-object','-w','--stdin',data=json.dumps(registry,indent=2,sort_keys=True)+'\n')
    tree=git('mktree',data='100644 blob '+blob+'\tclaims.json\n')
    parents=['-p',head] if head else []
    commit=git('commit-tree',tree,*parents,'-m',args.action+' '+args.task)
    if json.loads(git('show',commit+':claims.json'))!=registry:
        raise RuntimeError('Registry serialization did not round-trip; refusing push')
    # Concurrent updates reject this push. Never force-push or retry blindly.
    git('push','origin',commit+':'+REF)
    git('fetch','origin',REF)
    git('merge-base','--is-ancestor',commit,git('rev-parse','FETCH_HEAD'))
    print('CLAIM '+args.action.upper()+' VERIFIED',args.task)

if __name__=='__main__': main()
