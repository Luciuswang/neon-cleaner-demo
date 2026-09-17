"""Append an immutable, portable work event. Publication is verified separately."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import uuid
from claim_task import ROOT, git, owner_id

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--task',required=True)
    parser.add_argument('--status',default='checkpoint')
    parser.add_argument('--summary',required=True)
    parser.add_argument('--commit',action='append',default=[])
    parser.add_argument('--evidence',action='append',default=[])
    parser.add_argument('--blocker',action='append',default=[])
    parser.add_argument('--next',default='Read the task packet and latest QA before continuing.')
    args=parser.parse_args()
    now=datetime.now(timezone.utc)
    event=now.strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:10]
    record=dict(schema=1,event_id=event,task_id=args.task,timestamp_utc=now.isoformat(),
                machine_id=owner_id(),branch=git('branch','--show-current'),status=args.status,
                summary=args.summary,commit_shas=args.commit or [git('rev-parse','HEAD')],
                evidence=args.evidence,blockers=args.blocker,next_action=args.next,
                provenance='Written on the producing workstation; commit_shas are existing source checkpoints. '
                           'The containing commit records this event; only remote events enter reports.')
    destination=ROOT/'docs/worklog'/ (event+'.json')
    destination.parent.mkdir(parents=True,exist_ok=True)
    with destination.open('x',encoding='utf8',newline='\n') as stream:
        json.dump(record,stream,ensure_ascii=False,indent=2)
        stream.write('\n')
    print(destination.relative_to(ROOT).as_posix())

if __name__=='__main__': main()
