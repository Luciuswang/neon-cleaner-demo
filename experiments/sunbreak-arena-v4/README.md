# SUNBREAK v4 — FULL AUTO

Separate single-player input/animation iteration. v1/v2/v3 are unchanged,
including the manually edited cabin. Not Unreal Engine, AAA or network 4v4.

## Play

Run `node experiments/sunbreak-arena-v4/serve.mjs`, then open
`http://127.0.0.1:5189/v4/`.

Hold left mouse button (or F) for automatic fire; release to stop. Right mouse
aims. R changes the magazine in 2.25 seconds; firing is disabled during the
sequence. Ammo transfers exactly once on completion. Pause freezes the action;
death/restart cancels it. Blur, hidden page, pointer cancellation/lock loss,
pause and presentation mode clear held input. Returning never fires old input.

The support hand visibly leaves the forend, moves to the magazine, withdraws it,
returns with a replacement, seats it and returns to the original held pose.
The animation is authored/procedural, not mocap. It uses fixed-length two-bone
IK plus the source skin weights on the previously repaired visible arm mesh.
No original GLB, texture, house geometry or right-hand grip is modified.
Mechanical sounds fire at shared reload progress markers, not delayed timers
that can leak through a pause. Audio still uses the previously credited
AR15/M4 recordings: not an MP5-specific field recording.

Core shot interval105ms, damage/spread, player movement, NPC cover behavior and
combat layout remain inherited v3. Reload intentionally changes from1.2s to2.25s
for visible hand/magazine motion. This is not a claim of entirely unchanged
gameplay timing. Existing right-shoulder and source finger/material polish
limitations remain; a numeric limb-length test is not visual acceptance.

## Shared dependencies / publishing

v4 is a small overlay below the existing `sunbreak/` release. Its HTML base is
the parent folder; all assets/vendor remain pinned parent v3 files. Local
modules are explicitly at `v4/`. This avoids duplicating large licensed assets.
Do not open the HTML directly from disk or host the v4 directory by itself.

`node experiments/sunbreak-arena-v4/tools/package.mjs` verifies shared local
assets against the published parent manifest and packages only allowlisted
public runtime files to ignored `.local/sunbreak-v4-build/`. No local server,
diagnostic hooks, QA artifacts or authoring/private assets are published.

After a clean source checkpoint, `tools/publish.mjs --prepare` submits only
`sunbreak/v4/` through a normal protected-main PR; `--pr=N --merge` checks normal
requirements and merges without bypass. Public hash/browser verification is a
separate step. Earlier Pages entries, original/v2 and v3 remain unchanged.

Note: the old v3 full-root publisher asserted an exact closed root file list.
After v4 exists, use a reviewed subtree-aware publishing flow for future v3
releases; never delete v4 to satisfy that older assertion.

## QA

- `node experiments/sunbreak-arena-v4/qa/unit.mjs`
- `node experiments/sunbreak-arena-v4/qa/browser.mjs --phase=checks`
- `--phase=inspect`: actual1920x1080 game-canvas held/reload pose samples.
- `--phase=movie`: actual canvas captureStream recording with live reload timer.
- `--phase=benchmark`: separate30s native-hardware mixed combat/rendering sample;
  its ordinary90reserve runs out, so it is NOT sustained automatic-fire stress.
- `node experiments/sunbreak-arena-v4/qa/sustained.mjs --phase=benchmark` reuses
  the exact harness with one documented QA-only initial reserve3000 adaptation.
  Runtime ammunition remains30/90. Same10s contiguous combat warmup and strict30s
  measurement, every warmup/measured frame retained, no threshold/timing change.
- `--phase=public`: actual anonymous public startup/mouse hold/release/reload.
- Use `node experiments/sunbreak-arena-v4/qa/public.mjs --phase=public` for the
  public input check. It reuses the exact harness and existing synchronous
  read-only production snapshot, rather than the200ms HUD mirror. No hooks,
  runtime mutation, changed delay or weakened assertion. The first HUD-based
  public release assertion failed on stale data; that attempt is retained.
- `qa/collect-release.mjs --published` separately binds local gates, the
  uploaded runtime, anonymous shared/earlier-demo hashes and public input result.

Local hooks are injected only by the local server; public HTML has none.
All attempts retain separate evidence paths. Sampled poses and a recorded
canvas sequence do not certify a full human playthrough, continuous independent
review, universal frame pacing or UE cinematic acceptance.
Both short recording attempts decoded but failed the required frame density;
container/requested FPS is not delivered FPS. Their videos and failed decode
reports are retained. Only sampled poses/functional timing are accepted here.

## 4v4 assessment / next slice

Current code contains no rooms, replication, authoritative match service,
remote-player controls or public multiplayer endpoint. Six existing enemies
are bots, not six connected players. GitHub Pages hosts the static client,
not a persistent match server.

Suggested first multiplayer milestone: invite-code rooms, up to eight real
clients, two teams of four, team colors, synchronized movement/aim/fire/reload,
server-verified health/ammunition/hits, respawns and team scoreboard. Bomb
planting, economy, voice chat, matchmaking and anti-cheat are separate work.

Use a server-authoritative real-time service: never accept arbitrary client
damage, kills, ammunition or teleports. Client prediction/interpolation and
disconnect/reconnect handling are required. Share the exact collider/door/floor
contract rather than trusting decorative render meshes as server geometry.

Before a public 4v4 claim: select a permitted hosting destination/budget, deploy
HTTPS/WSS with origin checks/rate and room caps, run independent-client tests
(including separate networks), enforce4+4 capacity, test disconnects, lag,
forged packets, closed-door occlusion and concurrent shooting/reloading.
Do not spend on or deploy a new external server without that hosting choice.
No fake network mode or unverified lobby button is shipped in this slice.

Primary hosting reference:
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
