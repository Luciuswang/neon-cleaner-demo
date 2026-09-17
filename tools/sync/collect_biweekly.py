"""Collect published project evidence from a frozen snapshot of all origin heads.

No local HEAD/worktree is report evidence. Fetch failure aborts without replacing
an older dossier. Worklog payloads are data, never commands or instructions.
"""
import argparse
from datetime import date, datetime, time, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

CANONICAL = 'codex/character-continuity-pipeline'


class CollectionError(RuntimeError):
    pass


def git(repo, *args):
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
    try:
        result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True,
                                text=True, encoding='utf-8', errors='replace', env=env, timeout=60)
    except subprocess.TimeoutExpired:
        raise CollectionError(f'Git {args[0]} timed out; collection is incomplete.') from None
    if result.returncode:
        # Git errors can contain credential-bearing remote URLs; do not echo them.
        raise CollectionError(f'Git {args[0]} failed (exit {result.returncode}); '
                              'collection is incomplete. Check repository access/connectivity.')
    return result.stdout


def reporting_zone(name):
    if name in ('UTC', 'Z'):
        return timezone.utc
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        # Windows Python may not bundle IANA tzdata. Shanghai has no DST in the
        # modern reporting period; support that documented default explicitly.
        if name == 'Asia/Shanghai':
            return timezone(timedelta(hours=8), name)
        raise CollectionError('Timezone unavailable: ' + name)


def parse_instant(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('An explicit timezone offset is required')
    return parsed


def reporting_window(since, until, zone):
    today = datetime.now(zone).date()
    def boundary(value, default, end=False):
        value = value or default.isoformat()
        if len(value) == 10:
            return datetime.combine(date.fromisoformat(value), time.max if end else time.min, zone)
        return parse_instant(value).astimezone(zone)
    end = boundary(until, today, True)
    start = boundary(since, end.date() - timedelta(days=13))
    if start > end:
        raise CollectionError('Reporting window starts after it ends')
    return start, end


def collect(repo, since=None, until=None, timezone_name='Asia/Shanghai', canonical=CANONICAL):
    repo = Path(repo).resolve()
    start, end = reporting_window(since, until, reporting_zone(timezone_name))
    # Explicit refspec avoids missing branches in clones configured to fetch only
    # one branch. --prune removes deleted remote heads from report scope.
    git(repo, 'fetch', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*')
    rows = git(repo, 'for-each-ref', '--format=%(refname)%00%(objectname)%00%(symref)',
               'refs/remotes/origin/').splitlines()
    heads = {}
    for row in rows:
        ref, sha, symref = row.split('\0')
        if not symref and ref != 'refs/remotes/origin/HEAD':
            heads[ref.removeprefix('refs/remotes/origin/')] = sha
    if not heads:
        raise CollectionError('No published origin branches found; cannot infer no work was done')
    notes = []
    if canonical not in heads:
        notes.append('Canonical integration branch is absent; integration status is unknown.')
    reachable = {branch: set(git(repo, 'rev-list', sha).splitlines()) for branch, sha in heads.items()}
    integrated = reachable.get(canonical)
    commits = []
    # Filter by actual committer time in Python, avoiding git --since traversal
    # pruning when a branch contains clock-skewed parent commit timestamps.
    log = git(repo, 'log', '--format=%H%x00%cI%x00%an%x00%s', *sorted(set(heads.values())))
    seen = set()
    for row in log.splitlines():
        sha, committed_at, author, subject = row.split('\0', 3)
        if sha in seen:
            continue
        seen.add(sha)
        if not start <= parse_instant(committed_at) <= end:
            continue
        commits.append({'sha': sha, 'committed_at': committed_at, 'author': author,
                        'subject': subject, 'branches': sorted(b for b, ancestors in reachable.items() if sha in ancestors),
                        'integration': 'unknown' if integrated is None else ('integrated' if sha in integrated else 'unintegrated')})
    commits.sort(key=lambda c: (parse_instant(c['committed_at']), c['sha']))

    variants = {}
    unknown_worklogs = []
    for branch, head in sorted(heads.items()):
        paths = git(repo, 'ls-tree', '-r', '--name-only', head, '--', 'docs/worklog/').splitlines()
        for path in paths:
            if not path.endswith('.json'):
                continue
            source = {'branch': branch, 'head': head, 'path': path}
            try:
                payload = json.loads(git(repo, 'show', f'{head}:{path}'))
                if not isinstance(payload, dict):
                    raise ValueError('Expected an object')
                timestamp = next((payload[key] for key in ('timestamp_utc', 'recorded_at', 'timestamp', 'created_at') if payload.get(key)), None)
                when = parse_instant(timestamp) if isinstance(timestamp, str) else None
                if when is None:
                    raise ValueError('Missing timestamp with timezone')
            except (ValueError, TypeError) as exc:
                unknown_worklogs.append({'source': source, 'reason': str(exc)})
                continue
            if not start <= when <= end:
                continue
            digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
            event_id = payload.get('event_id')
            if not isinstance(event_id, str) or not event_id.strip():
                event_id = None
            key = (event_id, digest)
            if key not in variants:
                missing = [key for key in ('event_id', 'task_id', 'machine_id') if not payload.get(key)]
                variants[key] = {'event_id': event_id, 'payload_sha256': digest, 'recorded_at': when.isoformat(),
                                 'record': payload, 'sources': [], 'missing_provenance': missing}
            variants[key]['sources'].append(source)
    worklogs = sorted(variants.values(), key=lambda item: (parse_instant(item['recorded_at']), str(item['event_id']), item['payload_sha256']))
    disagreements = []
    event_groups = {}
    tasks = {}
    for entry in worklogs:
        if entry['event_id']:
            event_groups.setdefault(entry['event_id'], []).append(entry)
        task_id = entry['record'].get('task_id')
        if isinstance(task_id, str) and task_id.strip():
            task = tasks.setdefault(task_id, {'task_id': task_id, 'events': [], 'commit_shas': set(), 'branches': set()})
            task['events'].append({'event_id': entry['event_id'], 'payload_sha256': entry['payload_sha256']})
            claimed = entry['record'].get('commit_shas', entry['record'].get('commits', []))
            if isinstance(claimed, str):
                claimed = [claimed]
            if isinstance(claimed, list):
                task['commit_shas'].update(x for x in claimed if isinstance(x, str))
            if isinstance(entry['record'].get('commit'), str):
                task['commit_shas'].add(entry['record']['commit'])
            task['branches'].update(source['branch'] for source in entry['sources'])
    for event_id, entries in sorted(event_groups.items()):
        if len(entries) > 1:
            disagreements.append({'event_id': event_id, 'payload_sha256s': [item['payload_sha256'] for item in entries],
                                  'reason': 'Same event ID has different records; all variants retained, no winner inferred.'})
    for task in tasks.values():
        task['commit_shas'] = sorted(task['commit_shas'])
        task['branches'] = sorted(task['branches'])
    notes += ['Unpushed/offline work on other computers is not observable through GitHub.',
              'Git author is not computer provenance. Missing machine_id remains unknown.',
              'Integration status describes commit ancestry, not QA acceptance or task completion.',
              'Worklog task IDs group updates; different SHAs are retained even if cherry-picked from the same task.']
    if unknown_worklogs:
        notes.append('Some remote worklog records could not be placed inside the reporting window; review unknown_worklogs.')
    return {'schema': 1, 'generated_at_utc': datetime.now(timezone.utc).isoformat(),
            'window': {'since_inclusive': start.isoformat(), 'until_inclusive': end.isoformat(), 'timezone': timezone_name,
                       'commit_timestamp_basis': 'committer time', 'worklog_timestamp_basis': 'explicit record timestamp'},
            'remote': 'origin', 'canonical_branch': canonical, 'branch_heads': heads,
            'complete_remote_fetch': True, 'local_head_used_as_evidence': False,
            'commits': commits, 'worklogs': worklogs, 'tasks': [tasks[key] for key in sorted(tasks)],
            'disagreements': disagreements, 'unknown_worklogs': unknown_worklogs, 'limitations': notes}


def markdown(report):
    def safe(value):
        return str(value).replace('\n', ' ').replace('\r', ' ').replace('|', '\\|')
    window = report['window']
    lines = ['# Neon Cleaner published evidence dossier', '',
             f"Window (inclusive): {window['since_inclusive']} — {window['until_inclusive']} ({window['timezone']}).", '',
             'This dossier is evidence for a report; publication does not establish QA acceptance.', '',
             '## Remote branch snapshot', '', '| Branch | Head |', '| --- | --- |']
    lines += [f'| {safe(branch)} | `{sha}` |' for branch, sha in sorted(report['branch_heads'].items())]
    lines += ['', '## Commits', '', '| Commit | Time | Integration | Branches | Subject |', '| --- | --- | --- | --- | --- |']
    lines += [f"| `{c['sha'][:12]}` | {c['committed_at']} | {c['integration']} | {safe(', '.join(c['branches']))} | {safe(c['subject'])} |" for c in report['commits']]
    if not report['commits']:
        lines += ['', 'No published commits matched this window; this does not establish absence of unpublished work.']
    lines += ['', '## Worklog events', '', '| Event | Task | Recorded | Machine | Status / summary | Branches |', '| --- | --- | --- | --- | --- | --- |']
    for entry in report['worklogs']:
        rec = entry['record']
        lines.append(f"| {safe(entry['event_id'] or 'unknown')} | {safe(rec.get('task_id', 'unknown'))} | {entry['recorded_at']} | {safe(rec.get('machine_id', 'unknown'))} | {safe(str(rec.get('status', 'unknown')) + ': ' + str(rec.get('summary', '')))} | {safe(', '.join(sorted({s['branch'] for s in entry['sources']})))} |")
    lines += ['', '## Disagreements and incomplete provenance', '']
    lines += [f"- Event {safe(d['event_id'])}: {d['reason']}" for d in report['disagreements']]
    lines += [f"- {safe(e['event_id'] or 'Unidentified event')}: missing {', '.join(e['missing_provenance'])}." for e in report['worklogs'] if e['missing_provenance']]
    lines += [f"- {safe(item['source']['branch'])}:{safe(item['source']['path'])}: {safe(item['reason'])}." for item in report['unknown_worklogs']]
    lines += ['', '## Limits and reporting requirements', '']
    lines += ['- ' + item for item in report['limitations']]
    lines += ['', 'The human-readable biweekly report must separately explain completed work, QA evidence, remaining blockers, and next actions from these records.']
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--since', help='Inclusive YYYY-MM-DD or timestamp with explicit timezone')
    parser.add_argument('--until', help='Inclusive YYYY-MM-DD or timestamp with explicit timezone')
    parser.add_argument('--timezone', default='Asia/Shanghai')
    parser.add_argument('--canonical-branch', default=CANONICAL)
    parser.add_argument('--output-dir', type=Path, help='Default: repository .local/reports (ignored)')
    args = parser.parse_args()
    try:
        report = collect(args.repo, args.since, args.until, args.timezone, args.canonical_branch)
        destination = args.output_dir or args.repo / '.local/reports'
        destination.mkdir(parents=True, exist_ok=True)
        stamp = report['generated_at_utc'].replace(':', '').replace('+', '_')
        stem = 'biweekly-' + stamp
        json_path, md_path = destination / (stem + '.json'), destination / (stem + '.md')
        json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        md_path.write_text(markdown(report), encoding='utf8')
        print(f'Published evidence collected: {len(report["branch_heads"])} branches, '
              f'{len(report["commits"])} unique commits, {len(report["worklogs"])} event variants.')
        print(json_path.resolve())
        print(md_path.resolve())
        return 0
    except (CollectionError, OSError, ValueError, TypeError) as exc:
        print('REPORT COLLECTION BLOCKED: ' + str(exc), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
