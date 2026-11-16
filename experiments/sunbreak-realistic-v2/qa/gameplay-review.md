# SUNBREAK realistic v2: independent gameplay QA

Date: 2026-11-16

Historical verdict notice: the review below applies to pre-audio commit
`6aa4387`, not the subsequently edited index. The original historical evidence
is recoverable at that commit. Current recorded-audio evidence is under
`qa/evidence/`, source-bound by the current `qa/release-report.json`; consult
`qa/audio-review.md` for this slice's separate review and coverage limits.

## Verdict

**Final-build engineering: PASS. Gameplay source/proxy preservation: PASS.**

This verdict is bound to the current build:

- Index: `52fef5c3484e3f37bdb064d8ce26b90bd333b7e6a051421f0bed4b9ced0ac206`
- World: `7f073620646f939a3552203bcea8b4129451bac18e0fe547be687d2363747621`
- Weapon: `afe1d7bb36b1cac1bc6a4772c34b36a8f98dc504350ef3df5cefbc6300f5b5bd`

The final runtime, performance and screenshot reports all record these hashes.
The release report's 65/65 engineering checks therefore describe the same
source inspected here, rather than an earlier implementation snapshot.

The approval is limited to automated gameplay preservation and the measured
scenario. It is not a manual full playthrough, continuous motion/art acceptance,
reference visual parity, a second-device performance claim, or approval of
every decorative object's visible-cover behavior.

## Evidence Reviewed

`qa/evidence/runtime-current.json` records:

- 19/19 original smoke and 217/217 runtime checks passing.
- 18 exact original proxy geometries, matrices, collider bounds and descendant
  checks, plus six-sided and eye-height ray probes.
- Independent reconstruction and raycast comparison within `1e-7`.
- Six style/weather cases with frozen gameplay state, proxy identity, raycast
  results and restoration preserved.
- Zero global RNG calls during switches, updates, renders and restoration.
- 174 probe definitions and no failed checks.

The runtime diagnostic correctly refreshes world matrices before sampling,
uses retained hidden proxies for raycasts, and restores style, weather,
presentation and renderer state. These are substantive checks, not only counts.

`qa/evidence/performance-current.json` records a current-build, 1920x1080,
30.016-second animated rain scene with original movement, fire, reload and AI
paths:

- 1,801 recorded samples; p50 `16.7 ms`, p95 `16.8 ms`, p99 `16.8 ms`.
- Maximum `17.2 ms`; zero frames over `50 ms`; two scripted restarts.
- NVIDIA RTX 5070 / ANGLE D3D11, one device and one weather/style workload.

This supports frame pacing for that workload. It does not establish identical
results on other GPUs, browsers, resolutions, or mobile devices. The run
recorded no kills or victory/defeat state during its 30-second measurement
window despite two restarts, so it is not proof of a complete six-target
combat progression.

The final hero, courtyard, wall, ground, weapon, rain, overcast and mobile
captures are bound to the same source. Their PNG dimensions match recorded
canvas sizes, pixel checks report nonblank output, assets loaded without texture
errors, and HUD bounds stay within the viewport. The mobile capture only proves
that particular 390x844 still frame; it does not prove touch controls or motion.

## Inherited Crate/Cover Mismatch

This remains an intentional preservation constraint, not a candidate
regression.

Baseline `crate(x,z,n,ry)` creates every visible crate but registers collision
only when `i===0`. The level has nine visible crates at six positions; three
two-crate stacks register only their bottom crate. Therefore:

- At `(-6,2)`, `(8,8)` and `(0,-12)`, the upper crate has no player collision,
  player-shot blocker, or enemy-shot blocker.
- Upper-crate rays pass through at the relevant height in both baseline and
  candidate. Adding collision would change gameplay.
- Bottom crates still block movement and projectiles exactly as baseline.

Severity: **P2 visual/gameplay communication limitation, inherited.** Players
may reasonably expect an opaque upper box to block shots or movement. Keep the
mismatch explicit in release notes; do not silently add collision during a
preservation-only visual pass.

## Remaining Findings

### P2: Render-only scenery still needs visible-cover judgment

The 18 original proxies are proved intact, but new lamps, palms and facade
projections are render-only where not aligned to those proxies. Runtime probes
do not enumerate every newly visible opaque surface. Review reachable lanes and
close-up views for solid-looking props that do not block as expected. Keep
decorative objects out of combat lanes or align them with existing blocking
volumes.

### P2: Scripted combat is not a manual playthrough

The performance harness drives real movement/fire/reload/AI code, but it is
not human adversarial input testing. Pointer-lock fallback, edge-case input
ordering, long-session combat, cover-peeking tactics and subjective motion
quality remain outside the automation.

### P3: Performance scope is one desktop workload

The measured result is strong, but a single device/browser/resolution/weather
run cannot establish general performance. Retain the hardware and scope in any
release claim, and avoid generalizing the mobile still capture into a mobile
performance PASS.

## Main-Agent Release Notes

State the result as: **current-build engineering/gameplay automation PASS;
inherited upper-crate collision mismatch; synthetic and scripted coverage
limits; visual/art verdict remains independently gated.**

Do not claim manual full-playthrough acceptance, continuous subjective motion
quality, reference parity, universal device performance, or complete visual
cover alignment from the 65-check automated report.

## Final Checks Performed

- Compared current hashes with all fresh report bindings.
- Inspected runtime checks and representative evidence contents.
- Recomputed the performance percentiles' scope and recorded game states.
- Reviewed final desktop and mobile screenshots for obvious blank/crush and
  visible-cover concerns.
- Reconfirmed the baseline crate registration behavior and 18-proxy contract.

No browser rerun, implementation edit, code QA edit, git mutation or sync action
was performed.
