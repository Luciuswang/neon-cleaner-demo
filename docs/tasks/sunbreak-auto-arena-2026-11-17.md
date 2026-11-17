# Task Packet: SUNBREAK automatic fire and magazine reload

- Task: sunbreak-auto-arena-2026-11-17
- State: QA
- Owner: main Producer; single runtime writer
- Created: 2026-11-17
- Branch: codex/character-continuity-pipeline
- Baseline: 9008376cafd48e16160bc70ce374629f612e491f
- Gate: browser-demo input and first-person animation; not UE cinematic acceptance
- Worker budget: two bounded read-only gate/QA reviewers
- Authority: user requested held automatic fire, magazine reload animation and
  preferably CS-like 4v4. Normal source/LFS/configured GitHub publishing authorized.

## Objective / plan

Deliver a separately playable fourth version with held left-button automatic
fire and an actual visible magazine-change sequence. Preserve all three earlier
experiments and the user's edited cabin. Assess network dependencies truthfully;
do not disguise bots or multiple local tabs as Internet 4v4.

1. Freeze the first three versions; mechanically copy only the v3 public runtime
   to an isolated fourth experiment. Reference the pinned shared v3 public
   assets/vendor via the page base URL instead of duplicating large asset files.
2. Explicit trigger state: left button or F, existing 105ms shot cooldown, stop
   immediately on release/blur/pause/hidden document/pointer-lock loss, and never
   queue a post-pause burst. Ignore non-left clicks and UI/text-entry controls.
3. Visible reload: left support hand releases, removes the magazine, brings a
   replacement and seats it, then returns to grip. Preserve repaired held-pose
   geometry, original source assets, right-hand grip and fixed limb lengths.
   Author a longer demo reload duration if needed; one shared duration/progress
   contract for ammunition, mesh animation and sound. No firing during reload.
4. Verify actual-browser held mouse input, shot rate/ammunition, released input,
   lifecycle clearing, reload interruption and reserve conservation. Capture
   actual game-canvas reload phases at 1080p without desktop/window interaction.
   Independent engineering and bounded art review; retain all failed attempts.
5. Publish a new /sunbreak/v4/ subtree through normal protected-main workflow
   only after source checkpoint and scoped QA. Earlier three URLs unchanged.

## Networking boundary

Existing project is static single-player WebGL, with no authoritative match
server, rooms, team replication or multiplayer transport. A public 4v4 match
needs a reachable real-time service and tests with separate clients. Inspect
available architecture/options, document the next concrete step and any new
hosting/cost choice. Do not buy hosting, publish an unsecured new service or
claim Internet multiplayer without actual end-to-end evidence.

## Write set

- Main only: experiments/sunbreak-arena-v4/**, this task packet, a new immutable
  docs/worklog event and finish-appended docs/handoff.md note.
- Read only: v1/v2/v3 runtime, assets, prior evidence, user F: source, UE/private
  assets and the pre-existing dirty private vault.
- Task lease acquired before writes. No concurrent writers.

## Acceptance / verification

- [x] Earlier three runtime trees preserved byte-for-byte.
- [x] Holding left mouse produces multiple real shots at the original rate.
- [x] Release/right-click/blur/hidden/pause do not leave a stuck trigger.
- [x] Empty magazine never goes negative; R consumes reserve only on completion.
- [x] Actual hand/magazine movement is visible, with rigid limb motion rather
      than arm stretching; restored held pose has no accumulated drift.
- [x] Current-build browser assertions and representative canvas poses;
      independent engineering/art verdicts describe exact review limits.
- [ ] Public start/hold/release/reload check and scoped file hashes verified.
- [x] 4v4 status and hosting requirement are explicit, not a false delivery claim.

## Review decision / results

Gatekeeper Planck: PASS TO IMPLEMENT (read-only). Required actual visible mesh
deformation (v3 baked/disposed the arm skeleton), independent mouse/F input,
capturing release listeners, one shared reload clock and progress-based audio,
actual browser/lifecycle/ammunition tests and scoped preservation/publication.
Internet 4v4 is assessment only until a real match-server/hosting slice.

Tests, source hashes, evidence, independent verdict,
publication acknowledgement and any blockers will be appended after execution.

## Implementation / retained iterations

v4 shares the existing parent public assets through a page base URL and has
explicit v4 game-module URLs. Only a small allowlisted overlay will be published;
no earlier demo, shared asset, UE file or private vault is edited.

Original105ms shot cooldown/damage/spread/player/world/cover logic retained.
Reload intentionally changes1.2s to2.25s. Actual source-arm skin weights are
retained as three joint groups on the repaired visible geometry, driven by
fixed-length two-bone IK. The right-only vertices and original held pose restore
exactly in Planck's independent CPU geometry check. Attribute buffers are
explicitly marked dynamic for the now-animated mesh. No source asset changes.

First producer pose had a cuff/hand discontinuity. It was rejected, not accepted
from joint-length metrics. Corrected orientation and GLTF-sanitized left twist
bone classification; original and intermediate images remain under qa/evidence/.
Zeno inspected all nine images from inspect-2026-11-17T10-20-03-211Z and returned
CONDITIONAL PASS: choreography readable; no new stretch/cuff hole/gross contact
blocker in samples. Exchange partly below frame and dark contact remain limits.
That is sampled art acceptance only, not full continuous motion review.

Planck initially returned REWORK for repeated-F rearming after pause and existing
held fire surviving focus on UI. Corrected fresh-press gating, capturing focus
clear and start/restart button blur. Browser integration subsequently passed32
groups including those cases, independent mouse/F release, simulated hidden
lifecycle, pointer cancel/lock loss, death/reset reload cancellation, partial/
zero/full reserves and once-only mechanical cues. Final frozen rerun pending.

First 30s native1080p benchmark (180 idle warmup frames) retained an unexplained
1333.2ms hitch, p95/p99 about16.8ms; strict FAIL. Never trim or discard it.
Subsequent measurement declares a contiguous10s SAME combat/reload warmup before
30s measurement, retaining all warmup samples. This does not prove the cause
or promise universally hitch-free startup.

First VP9 canvas recording decoded only19 frames despite30fps container metadata.
It fails motion evidence density and is retained with decode report; never claim
30fps continuous proof from captureStream's requested rate. Retry uses VP8 and
also fails density (31frames, container60fps). Neither is accepted as continuous
motion proof. This recording is not a performance sample and
has no audio track; mechanical event counts/timing are separately tested.

Planck final bounded engineering PASS:32/32 browser groups and21 bound source/
harness hashes match;103 shared dependencies verified. Zeno sampled-art
CONDITIONAL PASS has no visible blocker in the reviewed poses, but exchange
cropping/dark contact and absence of continuous review remain explicit.

Two final ordinary-reserve mixed combat/rendering samples PASS (p95/p99 about
16.8ms, max17.2/33.3ms) but run out of reserve. Planck correctly rejected calling
these sustained stress. A separate qa/sustained.mjs adapter gives3000 reserve
immediately after the existing benchmark reset and before the first gameplay
frame; original gameplay, damage, fire/reload timing, warmup and thresholds are
unchanged. Adapter/base/generated-program hashes and raw frames are retained.
User-facing ammunition remains30/90. Sustained reruns/public receipt pending.

## Final local gate - 2026-11-17

32/32 final functional browser groups PASS; 8 unit groups PASS. The final
9-pose1920x1080 set is inspect-2026-11-17T10-36-04-248Z. Zeno reinspected all
nine bound final images and returned PASS for the bounded sampled-art gate:
no visible Blocker/Major contact error, renewed stretching or cuff hole.
This supersedes only the earlier sampled-image verdict. Cropping at48/60 and
dark fine contact remain limits; continuous motion remains UNVERIFIED.
The liveops-art-precheck guided proportion/contact/readability inspection.

All four sustained attempts retain raw measured and warmup frames. The first
PASS is10-43-40-096Z; the second10-44-34-752Z is strict FAIL for one52.6ms frame
during reload.4667 (cause unknown). No threshold/runtime was changed.
The final declared pair10-47-09-607Z/10-48-02-632Z both PASS: p95 about18.3ms,
p99 about18.5ms, max20.2/18.7ms, zero frames over50ms. They fire230/229shots
with2790reserve remaining, so unlike earlier mixed samples they sustain fire
and reload throughout. All failures remain evidence; no universal no-hitch claim.

Overall local gate is CONDITIONAL PASS for a single-player browser prototype.
Continuous-motion density, subjective audio, multiplayer and UE/AAA clearance
are not passed. Publication is PENDING a clean source checkpoint, normal
protected-main PR and separate anonymous public hash and input checks.
