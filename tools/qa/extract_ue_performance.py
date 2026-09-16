"""Preserve UE CSV and derive wall-clock frame samples, excluding boot/warmup.

Use on a real-time run (no -benchmark/-usefixedtimestep). The caller must record
the command line, render settings and hardware alongside this output.
"""
import argparse
import csv
import hashlib
import json
import math
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--skip-frames', type=int, default=300)
    args = parser.parse_args()
    if args.skip_frames < 0:
        raise ValueError('Warmup frame count must be nonnegative')
    csv.field_size_limit(16 * 1024 * 1024)  # Boot EVENTS packs many engine markers.
    with args.source.open(encoding='utf-8-sig', newline='') as stream:
        rows = csv.DictReader(stream)
        if 'FrameTime' not in rows.fieldnames:
            raise ValueError('UE FrameTime column missing')
        values = []
        for row in rows:
            try:
                value = float(row['FrameTime'])
            except (ValueError, TypeError):
                continue  # UE repeats the header and appends metadata.
            if not math.isfinite(value) or value <= 0:
                raise ValueError('Invalid UE frame duration')
            values.append(value)
    retained = values[args.skip_frames:]
    if len(retained) < 2:
        raise ValueError('Insufficient frame samples after warmup')
    args.destination.mkdir(parents=True, exist_ok=True)
    raw = args.destination / 'ue-original.csv'
    shutil.copyfile(args.source, raw)
    normalized = args.destination / 'frame-times.csv'
    timestamp = 0.0
    with normalized.open('w', encoding='utf8', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['timestamp_seconds', 'frame_ms'])
        for value in retained:
            timestamp += value / 1000
            writer.writerow([f'{timestamp:.9f}', f'{value:.6f}'])
    ordered = sorted(retained)
    def percentile(q):
        x = (len(ordered) - 1) * q
        lo = int(x)
        return ordered[lo] + (ordered[min(lo + 1, len(ordered)-1)] - ordered[lo]) * (x-lo)
    report = dict(source=str(args.source), original_sha256=hashlib.sha256(raw.read_bytes()).hexdigest(),
                  original_frames=len(values), excluded_boot_warmup_frames=args.skip_frames,
                  retained_frames=len(retained), duration_seconds=timestamp-retained[0]/1000,
                  p50_frame_ms=percentile(.5), p95_frame_ms=percentile(.95),
                  max_frame_ms=max(retained), fixed_timestep=False,
                  note='UE wall-clock FrameTime, including frame cap waits; not fixed-step video FPS. '
                       'Runtime invocation and settings must be independently verified.')
    (args.destination / 'performance-summary.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
