"""Reproducible CC0 audio preparation. Requires numpy/scipy; no network.

python tools/prepare-audio.py --source-dir <download/extraction directory>
The archive, CSV and exact source member hashes are recorded in the manifest.
We lower gain; we do not claim to repair saturation present in source masters.
"""
import argparse
import hashlib
import json
import math
import warnings
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / "assets" / "audio"
out.mkdir(parents=True, exist_ok=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
library = "https://opengameart.org/content/the-free-firearm-sound-library"
reloads = "https://opengameart.org/content/gun-reload-sound-effects"
specs = [
    ("player", "Prepared SFX Library/AR-15/D_32P.wav", 1.8, .84, library,
     "Recorded AR-15/M4 near single shot, front, stereo source downmixed to mono."),
    ("enemy", "Prepared SFX Library/AR-15/D_24P.wav", 1.7, .74, library,
     "Recorded AR-15/M4 mid-distance single shot, front, stereo source downmixed to mono."),
    ("magout", "clipload1.wav", None, .60, reloads, "CC0 mechanical reload effect; recording method unspecified."),
    ("magin", "clipload2.wav", None, .65, reloads, "CC0 mechanical reload effect; recording method unspecified."),
    ("confirm", "singlebullet1.wav", None, .48, reloads, "CC0 mechanical effect used as restrained UI hit confirmation, not a bullet impact recording."),
]
files = []
for key, member, tail, peak, url, description in specs:
    src = args.source_dir / member
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", wavfile.WavFileWarning)
        rate, raw = wavfile.read(src)
    # scipy represents 24-bit PCM in a left-justified int32.
    scale = float(2 ** (raw.dtype.itemsize * 8 - 1)) if raw.dtype.kind == "i" else 1.
    signal = raw.astype(np.float64) / scale
    saturation = int(np.count_nonzero(np.abs(signal) >= .9999))
    mono = signal.mean(axis=1) if signal.ndim > 1 else signal
    onset = int(np.flatnonzero(np.abs(mono) >= max(.005, np.max(np.abs(mono)) * .045))[0])
    start = max(0, onset - int(rate * .008))
    end = min(len(mono), start + int(rate * tail)) if tail else len(mono)
    cropped = mono[start:end].copy()
    # DC removal, 1ms entrance and 80ms exit taper; preserve the recorded attack.
    cropped -= cropped.mean()
    entrance = min(int(rate * .001), len(cropped))
    exit_n = min(int(rate * .08), len(cropped) // 3)
    cropped[:entrance] *= np.linspace(0, 1, entrance)
    cropped[-exit_n:] *= np.linspace(1, 0, exit_n)
    gcd = math.gcd(rate, 44100)
    sample = resample_poly(cropped, 44100 // gcd, rate // gcd)
    sample *= peak / np.max(np.abs(sample))
    pcm = np.rint(sample * 32767).astype("<i2")
    dest = out / (key + ".wav")
    wavfile.write(dest, 44100, pcm)
    files.append({
        "id": key, "path": "assets/audio/" + dest.name, "bytes": dest.stat().st_size,
        "sha256": sha(dest), "sourcePage": url, "license": "CC0-1.0",
        "sourceMember": member, "sourceSha256": sha(src), "description": description,
        "sourceRate": rate, "sourceChannels": 1 if signal.ndim == 1 else signal.shape[1],
        "sourceDuration": len(signal) / rate, "sourceSaturatedSamples": saturation,
        "cropSeconds": [start / rate, end / rate],
        "processing": "mono mean; crop at threshold onset minus 8ms; DC removal; 1ms/80ms tapers; scipy resample_poly to 44100; peak gain; PCM16",
        "duration": len(pcm) / 44100, "rate": 44100, "channels": 1,
        "peak": float(np.max(np.abs(pcm.astype(float))) / 32768),
        "rms": float(np.sqrt(np.mean((pcm.astype(float) / 32768) ** 2))),
    })
manifest = {
    "schema": "sunbreak-recorded-audio-v1", "prepared": "2026-11-16",
    "firearmCreators": ["Ben Jaszczak", "Brian Nelson", "Kevin Heras", "Matthew Nanney"],
    "firearmArchiveSubmitter": "bart", "mechanicalCreator": "BMacZero / Brian MacIntosh",
    "archive": {"url": "https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z",
                "bytes": (args.source_dir / "Prepared-SFX-Library.7z").stat().st_size,
                "sha256": sha(args.source_dir / "Prepared-SFX-Library.7z")},
    "masterSheet": {"member": "Prepared SFX Library/Prepared Master Sheet.csv",
                    "sha256": sha(args.source_dir / "Prepared SFX Library/Prepared Master Sheet.csv")},
    "limitations": ["Redistribution licensed CC0 on preserved OpenGameArt distribution; original team websites no longer available.",
                   "Gain reduction does not restore any saturation in the prepared source masters.",
                   "Two recorded single-shot perspectives, not multiple recorded takes per event.",
                   "Mechanical source does not specify recording method; confirm is a UI cue, not a flesh impact."],
    "files": files,
}
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(manifest, indent=2))
