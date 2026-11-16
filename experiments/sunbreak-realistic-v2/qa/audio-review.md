# SUNBREAK recorded audio and independent original page

Date: 2026-11-16

## Scope and current status

Main-integrator engineering gate: PASS, 85/85 release checks.
Independent reviewer: Planck; final bounded verdict PASS. Review was read-only:
code, ten source bindings, twenty artifact hashes and measured evidence were
inspected; the reviewer did not independently rerun the browser.
Subjective listening: NOT PERFORMED. No hearing-safety certification.
Art/reference parity: unchanged REWORK, not claimed by this slice.

An intermediate independent REWORK identified swallowed key releases, mandatory
audio-module loading and insufficient suspended-restart testing. These were
fixed, regression-tested, source-frozen and re-reviewed before the final PASS.
An intermediate wrong-viewport benchmark was rejected by the existing >=1080
gate; the accepted final run is actual 1920x1080 and capture sizes are now gated.

This slice replaces the old oscillator effects with local samples only in the
realistic version. Damage, cooldown, ammo, 1.2-second reload, AI, RNG order,
collision and camera behavior are preserved after nine complete unique exact
render/audio substitutions. The comparator also rejects gameplay-adjacent
audio mutations, RNG/state writes and altered proxy contracts.

## Version separation

- `/`: realistic recorded-audio page.
- `/original/`: exact bytes from `../sunbreak-fable52/index.html`; no injection.
- Baseline SHA256:
  `4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85`.
- The actual browser digested the independently served original page and
  matched that pin. A normal menu link opens the original in another tab.
- Both pages were opened in the actual browser and retained their distinct
  titles/UI. The original file remains outside this slice's write set.

## Audio and provenance

Two AR-15/M4 recorded singles from the preserved CC0 Free Firearm Sound Library
distribution are used for near player and mid-distance enemy shots. Creators:
Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney.
Mechanical reload effects are by BMacZero / Brian MacIntosh, CC0; their
recording method is not documented. Hit confirmation is a quiet mechanical UI
cue, not a claim of a recorded body/bullet impact.

`assets/audio/manifest.json` records source archive/member/output hashes,
master-sheet identity and crop/resample/gain transformations. `NOTICE.md`,
`qa/audio-license-evidence.json` and preserved distribution pages supply
permission/credit evidence. `tools/prepare-audio.py` reproduces the five PCM16
assets using numpy/scipy. Saturated samples in the prepared masters are
explicitly disclosed; lowering output gain does not repair source saturation.

## Measured evidence

`qa/evidence/audio-current.json`: 38/38 checks, PASS.

- Trusted browser click unlocks audio; five local WAVs actually decode.
- Actual running source-player counters cover player/enemy fire, both reload
  steps and confirmation. Natural end, mute, volume-zero, pause, presentation,
  synthetic focus loss and suspend/resume clean active/scheduled voices.
- A second trusted browser click on the actual restart button resumes the
  actual suspended integrated AudioContext and triggers a decoded shot.
- Key-release regression covers W/F presses that began in-game but whose
  releases land on the audio controls; new control keystrokes remain isolated.
- No queued playback after loading/resume; unavailable samples/Web Audio fail
  without a synthesized gunshot fallback.
- Per-source panning and distance filtering are measured by offline rendered
  stereo channel energy, not merely a formula assertion.
- 200 simultaneous stress notifications obey a 24-voice cap; production-graph
  offline output peak 0.66153, finite, nonblank, no samples >=0.999.
- Actual original player fire/reload fixtures produce identical target HP,
  ammo, reserve and RNG seed/call counts with enabled/muted/unavailable audio.
  Enemy damage/LOS are covered separately by the original runtime fixtures;
  the deterministic audio fixture is not an entire enemy-AI simulation.

`qa/evidence/audio-load-failure-current.json`: 5/5 checks, PASS. A dedicated
server diagnostic substitutes exactly the audio-module import URL with a
missing resource. The real fallback status/controls and original fire/reload
functions remain usable; production also bounds a stalled audio import to 4 s.

`qa/evidence/runtime-current.json`: original 19/19 smoke fixtures and 217/217
proxy/geometry/state/weather invariants, zero diagnostic global RNG calls.

`qa/evidence/performance-current.json`: actual 1920x1080 rain combat, 180-frame
warm-up plus 30.0163 seconds, 1,801 frame samples, RTX 5070 / ANGLE D3D11.
P95/P99 about 16.8 ms, maximum 17.3 ms, zero >50 ms.
Real running audio counters:
160 player shots, 51 enemy shots, eight confirmations, four reload pairs,
zero audio errors and no pre-ready/dropped sound events.
One automatic restart occurred. This is a single-device scripted workload,
not a manual full playthrough.

Eight browser WebGL canvas captures and metadata were regenerated. The mobile
390x844 browser UI was inspected for control overlap; this does not imply touch
input support or a new independent art/continuous-motion acceptance.

## Build binding and limits

All current browser evidence records ten source hashes, including the audio
module, manifest, server and both audio-test modules. The release verifier checks
sample/license-page integrity and exact baseline preservation.

- Index: `761c48f0b63a542c48f2f29d5b2021464736f583acda5f43244bc896deb7c991`
- Audio: `b1d79072ec9eb99c4fe5a2793e34f2c31dca8214f51b538a038569e171c48fff`
- Manifest: `a68ed816350196bc05587a9965380baef287661b48a9360c2cdd7b5cbad9562c`

The preparer explicitly writes LF manifest bytes. Raw downloaded license pages
and WAVs have binary Git attributes so checkout does not normalize their bytes.
This prevents platform line endings from invalidating the recorded hashes.
All browser suites/captures were freshly rerun after that packaging correction;
old source bindings were not manually edited to appear current.
Pre-checkpoint Git-index byte audit: 37/37 staged blob hashes matched the ten
source hashes, five WAVs, two license pages and twenty evidence artifact hashes.
The original-demo directory has no staged changes.

No assistant audition or human listening verdict is implied. Output limiting is
not a device-volume or hearing-safety guarantee. No exclusive Fable-model claim,
UE/private-asset acceptance, or current reference-quality realism PASS is made.
Private-vault restore remains independently blocked by pre-existing local vault
modifications; this browser/public-assets checkpoint does not depend on them.
