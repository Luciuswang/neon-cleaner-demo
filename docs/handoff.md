# Project Handoff

Last updated: 2026-10-29


## Weighted leather jacket candidate - 2026-11-09

After the earlier checkpoint, resolved same-named FBX Dummy versus skinned
body and removed an extra export root. A 2521-vertex jacket candidate has
complete numerical weights and four arm/elbow deformation checks. Root-only
FBX imported in scratch UE and a new process confirmed persisted skeleton and
material. Copy is SK_LeatherJacket_Experimental_V2 in private workspace.
UE warns about absent smoothing groups; visual fit, clipping and actual riding
are NOT checked. See task packet and tools/assets/fit_metahuman_jacket.md.
No assembled MetaHuman, in-game replacement or final game test exists. Epic
device authorization is needed for the official rig/texture assembly.

## Historical checkpoint before weighted candidate - 2026-11-09

User explicitly wants the saved MetaHuman to replace the old motorcycle rider.
Read docs/tasks/metahuman-rider-2026-11-09.md before continuing. Original
character and prior rider remain intact. Jacket source/PBR imported as an
UNFITTED, UNRIGGED candidate, body reference FBX exported and initial A-pose
fit experiment preserved privately. Max skin transfer failed; no game-ready
jacket, assembled rider, riding pose or game replacement exists yet.
Epic device authorization timed out; retry after account-holder action.

## MetaHuman leather outfit request - 2026-11-09

The user has customized and saved Heroine_MetaHuman. Preserve that face and body.
No leather clothing has been applied yet. See docs/tasks/metahuman-leather-2026-11-09.md
for free CC-BY FBX and paid parametric Fab candidates and access limitations.
Obtain a licensed garment and test fit/identity/clipping; do not recreate the character.

## MetaHuman starter created - 2026-11-09

Core Data readiness passed after user installation. The actual project now has
/Game/MetaHumanWorkspace/Characters/Heroine_MetaHuman, created and saved by
the starter commandlet; editor was launched. See docs/metahuman-quickstart.md.
This is a starting asset, not Kelly or a completed assembled character.
Creator, camera and audio expression still need interactive validation.

## MetaHuman creation setup - 2026-11-09

User wants a simple Creator and facial-expression workflow. Read
docs/metahuman-quickstart.md and docs/tasks/metahuman-setup-2026-11-09.md.
Creator/Animator/Live Link configured; starter creation verified twice in an
isolated project. Core Data is missing and the active editor has not restarted.
Install via Epic Launcher after saving and closing UE, then start with
ue/Start-MetaHuman.bat. Webcam/audio expression is not yet end-to-end tested.
Both workspace and default MetaHumans folders are private snapshot inputs.
Changing the project descriptor invalidates current-build cinematic fingerprint;
previous quality evidence is historical, and cinematic approval stays blocked.

## Current continuation - cinematic polish 2026-10-29

Read docs/tasks/cinematic-polish-2026-10-29.md, docs/qa/polish-2026-10-29.json
and docs/qa/polish-2026-10-29-review.md. Do not repeat completed source research,
material imports or offscreen setup. Epic5.8 AI tools are documented in
docs/research/ue-ai-2026-10-29.md; no external AI server/plugin is needed here.

Implemented actual forearm-driven wrist alignment, private Kelly dielectric
material response, facade/endwall/window/roof details and lighting refinement.
The standalone SceneCapture2D renderer works without desktop screenshots or
window focus; direct bone-tracking fixes moving closeups. Use Render-NeonOffscreen
and the strict offscreen-cinematic-v1 evidence profile, not legacy screenshot QA.

Fresh-process verification caught and fixed material slot-array/save persistence.
V3 is authoritative: all six PBR assignments survive mesh/map reload; matte
cloth/hair improvement is visible. V1/v2 did not have those assignments active.
The asset validator now checks exact approved PBR slots and texture dependencies.

Final build, map/assets and Clean/Damaged/Lost gameplay outcomes PASS. Offscreen
side/hands videos are12s each, bridge4s, all1080p30fps. Independent QA still
REWORK / AI BLOCKED: visible hand skin deformation/open fingers, low-detail hero
and motorcycle, static wheel/fork, prototype architecture and bridge occlusion.
Real-time p99=16.977ms but max=241.070ms; one hitch exceeds50ms. Full continuous
subjective review remains incomplete; successful decode cannot substitute it.

Next: repair source hand skin/chain mapping and author mechanically segmented
bike/LODs; restore hero maps/groom; improve architecture and profile the hitch.
Do not replace this work with another blind joint-angle tweak or declare cinema
quality from numeric endpoint tests. Current report fingerprint starts416a82e9.
Sources, private resources and evidence are published by the mandatory checkpoint
workflow; other PCs restore the pinned snapshot and read immutable worklogs.

## Cross-PC verification completed - 2026-09-17

Task crosspc-sync-2026-09-17 is DONE. Actual GitHub clone and fresh private
restore recovered all 745 files. UE5.8.1 map validation and Clean smoke passed.
All 725 Content binary/media files and 22 report artifact entries match exactly.
Portable QA fingerprint is explicit/versioned; only source/config/project CRLF
normalization is allowed. Historical evidence/verdicts remain unchanged.
Read docs/qa/crosspc-sync-2026-09-17.md and its restore evidence JSON.

The September 4-17 biweekly report in docs/reports/ covers all 12 remote branches
as of its stated cutoff. Future reports must fetch all branches again. Continue
the cinematic task from current REWORK/BLOCKED findings, not source discovery.

## Authoritative cross-PC continuation - 2026-09-17

The user now requires automatic save/upload at every completed checkpoint, with
no repeated permission or routine announcements. This supersedes older "no push
requested" and local-only instructions. Read docs/project-sync.md and AGENTS.md.

Code/public assets: origin/codex/character-continuity-pipeline and task branches.
Private resources: Luciuswang/neon-cleaner-private-assets, pinned by
docs/sync/private-assets-lock.json. The private snapshot has 745 files, including
editable Kelly/city source, current private Content, exact checkpoint module,
and current video/image/log/performance evidence. Restore it before redoing work.
Use sync_project_start.ps1 -RestorePrivateAssets on another computer; no drive-D
source assumption is required. Original missing Kelly maps/groom are still missing.

Before parallel writes, claim stable task ID and explicit paths using
tools/sync/claim_task.py; use separate task branches and renew leases before expiry.
Finish updates worklog/QA/handoff and calls sync_project_finish.ps1 (push defaults
on); verify remote/LFS/private snapshot, then release claim. Never force push.
The prior Fab registration-script local edit is included in this save as requested.

Biweekly reports MUST fetch all remote branches using tools/sync/collect_biweekly.py
and combine all machines' published commits and immutable docs/worklog events.
Deduplicate task/event/commit IDs; include unintegrated work and failed QA. Unknown
offline work cannot be called absent. Do not report only this PC or this chat.

Cinematic implementation 12dd722 remains ENGINEERING PASS / CINEMATIC REWORK /
AI VIDEO BLOCKED. Resource portability is not visual acceptance. Continue from
docs/qa/cinematic-upgrade-2026-09-16.md, without repeating completed asset imports.

## Authoritative continuation - cinematic upgrade 2026-09-16

Branch: `codex/character-continuity-pipeline`. Read
`docs/qa/cinematic-upgrade-2026-09-16.md`, its evidence JSON and
`docs/cinematic-quality-contract.md` before using older prototype acceptance.

This PC now has private low Kelly restored and can run UE 5.8.1. The playable
chase has an actual elevated deck above lowered city/harbor, 4K CC0 PBR surfaces,
corrected instanced materials/rotations, authored enemy bodies and separate
wheels, measured grip-driven rider fitting, smoother steering and swept collision
sliding. Build, full Gate 3 engineering and Clean/Damaged/Lost encounter smoke pass.
The automatic-driver regression caused by larger cars was fixed with earlier
avoidance and braking, without weakening damage/outcome tests.

**CINEMATIC REWORK / AI VIDEO BLOCKED.** Independent review rejects remaining
prototype architecture/lighting, low hero closeup quality, unnatural wrist/finger
contact and unarticulated bike wheels/fork. Palm-proxy 0 and engineering PASS do
not grant visual acceptance. Production and QA agents now use seven independent
domains and schema 2 evidence integrity. Current evidence is local under
`ue/NeonCleanerUE/Saved/Quality/`; no final AI reference pack/film is approved.

Resources/source checksums are recorded in `docs/assets/`. High-bike candidate
with 4K maps is imported privately under `/Game/CinematicBike` but needs mechanical
rig, cleanup/LODs and rider refit before activation. High Kelly source has 47
missing images plus groom dependencies; see the hero resource audit. Local city
FBX lacks source material associations. Restore or author these properly; do not
switch untextured high geometry into the final build.

Next production: detailed mechanically rigged motorcycle/contact animation;
high-Kelly identity/material/groom restoration; detailed foreground architecture
and motivated relighting; vehicle dressing/LODs; current-build independent visual,
temporal and AI-reference acceptance. User authorized routine downloads and
production on 2026-09-16, so repeated permission requests are unnecessary.

Keep pre-existing user edit `ue/Register-EpicProjectForFab.ps1` separate from this
slice. Private Kelly, candidate bike, caches and captures remain ignored. No push
or publishing requested. Older continuation sections below are historical.

## Away contact

- If Baomin is away and user approval is truly required, contact:
  `baomin.wang@garena.com`.

## Repo and live demo

- GitHub repo: https://github.com/Luciuswang/neon-cleaner-demo
- Live mobile test URL: https://luciuswang.github.io/neon-cleaner-demo/
- Main branch: `main`
- GitHub Pages source: `main` branch, `/ (root)`

## Current status

This repo contains the first playable prototype for `éœ“è™¹æ¸…é“å¤« / Neon Cleaner`.

The demo is an interactive film/game hybrid:

- A cinematic video-style background.
- A story opening node.
- A playable car-chase decision segment.
- Branching outcomes based on player performance.
- A boss-interrupt segment.
- Three ending paths.

The current web build uses the silent AI video background here:

```text
web/assets/neon-cleaner-bg-noaudio.mp4
```

The original local source video with audio is intentionally not committed:

```text
source/video/*.mp4
```

## How to continue at the company

Clone the repo:

```powershell
git clone https://github.com/Luciuswang/neon-cleaner-demo.git
cd neon-cleaner-demo
```

Open locally:

```powershell
cd web
python -m http.server 5177
```

Then open:

```text
http://127.0.0.1:5177/
```

If Python is not available, opening `web/index.html` directly also works for basic testing.

## Suggested prompt for continuing with Codex

Use this when starting a new Codex session:

```text
è¯·é˜…è¯»è¿™ä¸ªä»“åº“çš„ README.md å’Œ docs/handoff.mdã€‚æˆ‘ä»¬æ­£åœ¨åšä¸€ä¸ªåä¸ºâ€œéœ“è™¹æ¸…é“å¤« / Neon Cleanerâ€çš„äº’åŠ¨ç”µå½±æ¸¸æˆ demoã€‚è¯·å…ˆç†è§£å½“å‰ç»“æž„ã€çŽ©æ³•åˆ†æ”¯ã€GitHub Pages éƒ¨ç½²çŠ¶æ€ï¼Œç„¶åŽç»§ç»­å¼€å‘ä¸‹ä¸€ç‰ˆã€‚
```

## Good next steps

1. Generate and approve storyboard still frames before making video.
2. Start with `SB-A0-01`, `SB-A0-02`, `SB-A0-03`, and `SB-I1-01`.
3. Use approved still frames as first frames for Sulphur2/LTX-2.3 I2V.
4. Improve the playable handoff only after `SB-I1-01` is visually approved.
5. Add generated branch clips for `C1`, `C2`, and `C3` after the visual language is locked.

## Stills-first storyboard workflow

The current production rule is:

```text
script beat -> storyboard still -> approval -> image-to-video -> game handoff
```

Do not start by running the video workflow. First generate and approve still frames.

Primary docs:

```text
docs/weekly-progress-2026-06-08.md
web/reports/weekly-progress-2026-06-08.html
docs/video/storyboard-stills-operation-guide.md
docs/video/topview-storyboard-stills-first.md
docs/video/topview-storyboard-stills.json
docs/video/next-step-storyboard-stills.md
docs/daily-summary-2026-06-08.md
```

Print the first still-frame prompt:

```powershell
node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
```

Candidate stills go here:

```text
source/storyboard/drafts/
```

Approved stills go here:

```text
source/storyboard/approved/
```

## Local ComfyUI storyboard pipeline

Use this only after the still-frame phase is approved:

```text
docs/video/topview-local-comfyui-storyboard-template.md
docs/video/topview-local-comfyui-storyboard.json
```

Print a shot prompt for ComfyUI:

```powershell
node tools/comfy/print_storyboard_prompt.mjs A0-S02
```

Build a shot-specific ComfyUI workflow:

```powershell
node tools/comfy/build_storyboard_t2v_workflow.mjs A0-S02 --root D:\AI\SULPHUR2_ComfyUI
```

The current local Sulphur2/LTX-2.3 workflow entry is:

```text
D:\AI\SULPHUR2_ComfyUI\ComfyUI\user\default\workflows\00_OPEN_THIS_CAR_CHASE_T2V.json
```

ComfyUI local server:

```text
http://127.0.0.1:8190
```

## Important files

```text
README.md
docs/story-bible.md
docs/branch-map.md
docs/ai-shot-list.md
docs/handoff.md
docs/weekly-progress-2026-06-08.md
docs/daily-summary-2026-06-08.md
docs/video/storyboard-stills-operation-guide.md
docs/video/topview-storyboard-stills-first.md
docs/video/topview-storyboard-stills.json
docs/video/next-step-storyboard-stills.md
docs/video/topview-local-comfyui-storyboard-template.md
docs/video/topview-local-comfyui-storyboard.json
docs/character-continuity-pipeline.md
docs/ue-heroine-character-brief.md
docs/ue-install-checklist.md
tools/comfy/print_storyboard_still_prompt.mjs
tools/comfy/print_storyboard_prompt.mjs
tools/comfy/build_storyboard_t2v_workflow.mjs
web/reports/weekly-progress-2026-06-08.html
web/index.html
web/styles.css
web/script.js
web/assets/neon-cleaner-bg-noaudio.mp4
web/assets/neon-cleaner-keyframe.png
```

## Character continuity update

The next UE-facing production rule is:

```text
UE character is the source of truth. AI video is generated from UE references.
```

Start from:

```text
docs/character-continuity-pipeline.md
docs/ue-heroine-character-brief.md
docs/ue-install-checklist.md
ue/NeonCleanerUE/Docs/CharacterContinuity-Day2.md
source/reference/linxia/README.md
```

## UE Playable Lin Xia Preview - 2026-08-21

Current local UE status:

- Engine: Unreal Engine 5.8, installed at `C:\Program Files\Epic Games\UE_5.8`.
- Project: `ue/NeonCleanerUE/NeonCleanerUE.uproject`.
- Startup map: `/Game/LinxiaPreview/LVL_Linxia_CharacterPreview`.
- Playable C++ character: `/Script/NeonCleanerUE.PlayablePhaseCharacter`.
- Character source asset: Epic/Fab `Paragon: Phase`.
- Controls: `WASD` / arrow keys to move, mouse to look, `Space` to jump.

Important repository note:

```text
ue/NeonCleanerUE/Content/ParagonPhase/
```

is intentionally not committed because this GitHub repo is public and that folder contains Epic/Fab Marketplace content. Restore it from the user's Epic/Fab library instead of redistributing it through GitHub.

To restore this preview on another PC:

1. Install Unreal Engine 5.8 through Epic Games Launcher.
2. Clone this repo and open `ue/NeonCleanerUE/NeonCleanerUE.uproject`.
3. In Epic/Fab Library, add `Paragon: Phase` to this UE project.
4. Run these scripts from UE or through `UnrealEditor.exe -ExecutePythonScript=...`:

```text
ue/scripts/tune_phase_hair_materials.py
ue/scripts/create_linxia_preview_level.py
ue/scripts/validate_linxia_preview_level.py
```

The critical fix for the skating/sideways animation issue is in `PlayablePhaseCharacter`: the Phase skeletal mesh must keep the original Paragon relative transform, especially mesh yaw `-90` / `270` degrees. Do not reset the mesh component rotation to zero.

Known UE 5.8 note: the local Epic/Fab `PhasePlayerCharacter` blueprint can log
old `ResetOrientationAndPosition` node errors when Paragon assets load. The
current playable path uses the C++ `PlayablePhaseCharacter` with the Phase mesh
and animation blueprint; the smoke test still passes despite those local
Marketplace blueprint warnings.

## Agent Workflow - 2026-08-24

This project now uses an adaptive multi-agent production loop with a mandatory
QA gate:

```text
INTAKE -> PLAN -> REVIEW/VETO -> DISPATCH -> EXECUTE -> QA -> DONE
```

Workflow and quality gates live in:

```text
docs/agent-production-workflow.md
docs/multi-agent-production-system.md
docs/agent-task-template.md
docs/sprint-2026-08-24.md
```

Use the workflow before moving between major slices: playable Lin Xia baseline,
rider / motorcycle proxy, handoff camera match, short chase prototype, and
GitHub handoff.

To refresh the current UE reference image:

```powershell
powershell -ExecutionPolicy Bypass -File ue/Capture-LinxiaReference.ps1
```

The capture uses `-LinxiaReferencePose` so the gameplay animation blueprint stays
unchanged during normal play.

## Cross-PC Sync - 2026-08-24

Use GitHub plus repo-local handoff docs as the project memory across the user's
home PC and two office PCs. At the start of any session, run:

```powershell
.\sync_project_start.ps1
```

At the end of a productive session, run:

```powershell
.\sync_project_finish.ps1 -Note "what changed / what is next" -CommitMessage "short commit message" -Push
```

Codex should read `AGENTS.md` first when the user says "start Neon Cleaner" or
asks to continue this project from another PC.

## Cross-PC Sync Note - 2026-08-24 13:56 +08:00

Added cross-PC Codex project sync entrypoint: AGENTS.md, docs/project-sync.md, start sync script, and finish sync script. Future sessions should run sync_project_start.ps1 before work and sync_project_finish.ps1 at handoff.

## Cross-PC Sync Note - 2026-08-24 20:36 +08:00

Gate 3 playable Linxia motorcycle chase uses imported player-motorcycle asset; smoke/validation passed; rider pose still needs retargeted riding animation.

## Cross-PC Sync Note - 2026-08-24 20:53 +08:00

Rider pose switched to local bone-space PoseableMeshComponent and passed background build/validation/smoke. Visual QA deferred because user locked screen.

## Cross-PC Sync Note - 2026-08-25 20:26 +08:00

Added repo-sourced biweekly reporting rule and created new automation 'Neon Cleaner åŒå‘¨é¡¹ç›®æŠ¥å‘Š' that syncs GitHub before reporting. User should cancel the old other-PC report to avoid duplicate/inaccurate reports.

## Cross-PC Sync Note - 2026-08-25 20:28 +08:00

Updated automation 'Neon Cleaner åŒå‘¨é¡¹ç›®æŠ¥å‘Š' to start on the weekend biweekly cadence and email baomin.wang@garena.com plus zhaot@garena.com. Report source remains GitHub/repo facts, not local Codex chat memory.

## Cross-PC Sync Note - 2026-08-25 20:48 +08:00

Gate 3 motorcycle chase build / validation / smoke passed after aligning the imported motorcycle mesh to pawn forward yaw `0`. Smoke now prints the bike/rider visual alignment marker. Visual screenshot QA is still pending because the Windows desktop was locked during capture.

## Cross-PC Sync Note - 2026-08-25 20:49 +08:00

Gate 3 motorcycle chase: aligned imported motorcycle yaw to pawn forward, added visual alignment markers to validation/smoke, and documented lock-screen visual QA blocker.

## Cross-PC Sync Note - 2026-08-26 11:39 +08:00

Gate 3 now has an in-game chase HUD showing speed, target distance, pursuit status, and controls. Added `ue/Capture-LinxiaMotorcycleChase.ps1` for UE-rendered proof captures; current proof is `source/reference/linxia/ue-captures/linxia_motorcycle_capture_2026-08-26.png`. Build / validation / smoke passed. QA verdict: playable chase feedback PASS, rider pose remains prototype CONDITIONAL until a real seated riding animation or IK pass is added.

## Cross-PC Sync Note - 2026-08-26 11:39 +08:00

Gate 3 playable chase feedback pass: added in-game HUD, UE-rendered capture script, proof image, and validation coverage for HUD binding.

## Cross-PC Sync Note - 2026-08-26 20:04 +08:00

Added the private cross-PC asset vault workflow for Baidu Netdisk. Paragon: Phase is saved in Fab My Library but still needs Launcher installation. Next session: install the Windows C++ toolchain and restore ParagonPhase, then run UE build and validation.

## Cross-PC Sync Note - 2026-08-27 12:37 +08:00

Added hard Gate 3 quality control: `ue/Run-Gate3QualityCheck.ps1`, `docs/quality-control.md`, and `docs/qa/gate3-quality-report-2026-08-27.md`. The one-command check passed build, validation, smoke, UE-rendered proof capture, and proof-frame sanity checks. QA verdict remains: playable feedback PASS, engineering recoverability PASS, rider pose CONDITIONAL, AI-video continuity BLOCKED until a real seated riding animation or IK pass.

## Cross-PC Sync Note - 2026-08-27 12:40 +08:00

Strengthened quality control: added Gate 3 one-command QA script, quality-control rules, QA report, dynamic capture output, and startup context entries so every PC reads the same gate status.

## Cross-PC Sync Note - 2026-08-27 12:44 +08:00

Adjusted Gate 3 quality check default proof output to ignored Saved/Quality so routine QA does not dirty the Git worktree; verified with -SkipBuild.

## Cross-PC Sync Note - 2026-08-27 13:14 +08:00

Rider IK spike completed. Direct component-space hand/foot locking was rejected after QA because it stretched limbs. Current committed direction keeps a safer local bone-space riding pose with rider pitch `4`, rider contact-pose logging, and `Run-Gate3QualityCheck.ps1 -FullVisualQA` for default / side / rear captures. Next slice should use a real seated motorcycle FBX, Control Rig, or a two-bone IK solver; AI-video continuity remains blocked.

## Cross-PC Sync Note - 2026-08-27 13:18 +08:00

Rider IK spike: rejected direct leaf-bone locks after QA because they stretched limbs; kept safer local bone-space rider pitch 4 pose, added contact-pose logging, and added FullVisualQA default/side/rear captures for Gate 3. AI-video continuity remains blocked until seated animation, Control Rig, or two-bone IK.

## Cross-PC Sync Note - 2026-08-27 13:29 +08:00

Follow-up quick C++ two-bone IK attempt was rejected by side / rear capture QA. It avoided limb stretch but bent the Phase arm / leg chains in unreliable directions, so the mainline remains on the safer local pose from `f92d03c`. Next real pass should use a seated animation source or a UE Control Rig asset pass, not more blind C++ target-point tuning.

## Cross-PC Sync Note - 2026-08-27 13:26 +08:00

Quick C++ two-bone IK follow-up was rejected by side/rear QA because it bent Phase limbs in unreliable directions; keep f92d03c safe local pose and move next to seated animation source or UE Control Rig asset pass.

## Cross-PC Sync Note - 2026-08-27 13:29 +08:00

Strengthened Gate 3 rider pose quality gate: FullVisualQA can now carry explicit rider pose PASS/CONDITIONAL/REJECT verdicts, and StrictRiderPoseGate fails unless reviewer verdict is PASS.

## Cross-PC Sync Note - 2026-08-28 19:38 +08:00

Continued rider animation / IK work. Added command-line rider pose profiles and `ue/Test-LinxiaRiderPoseProfiles.ps1` so candidate poses can be captured side/rear into ignored `Saved/Quality` without dirtying Git. Tested `Compact`, `Bars`, and `AsymBars`; all remain rejected / conditional, so `Default` remains the stable fallback. Explicitly enabled UE `ControlRig` and `IKRig` plugins and added `docs/rider-animation-source-plan-2026-08-28.md`; next production path is a seated riding FBX or a Phase-specific Control Rig / IK Rig asset pass.

## Cross-PC Sync Note - 2026-08-28 19:35 +08:00

Rider animation/IK continuation: added reproducible rider pose profile capture tooling, verified Default remains stable while Compact/Bars/AsymBars are not accepted, enabled ControlRig/IKRig plugins, and documented next path as seated FBX or Phase-specific Control Rig asset pass.

## Cross-PC Sync Note - 2026-08-28 20:04 +08:00

Asset route started for Lin Xia rider quality. Added Phase-specific IK Rig and Control Rig assets under `/Game/LinxiaRig`, added one-command setup / validation scripts, and wired rig asset validation into Gate 3. Full Gate 3 with `-SkipBuild -FullVisualQA -RiderPoseProfile Default` passed engineering checks; rider pose remains CONDITIONAL until a seated FBX or authored Control Rig riding pose passes strict review.

## Cross-PC Sync Note - 2026-08-28 20:39 +08:00

First playable animation asset pass completed. Added `/Game/LinxiaRig/Animations/AN_Linxia_MotorcycleRide_Idle`, switched the Gate 3 rider from runtime `UPoseableMeshComponent` bone deltas to `USkeletalMeshComponent` single-node animation playback, and strengthened setup / Gate 3 log-marker validation so UE Python errors cannot silently pass. Full Gate 3 passed with build, rig/animation validation, smoke, and default/side/rear proof captures. Verdict: playable ride animation CONDITIONAL PASS; AI-video continuity still blocked until hand-bar and leg-bike contact pass strict visual QA.

## Cross-PC Sync Note - 2026-08-31 13:31 +08:00

Adopted a lightweight Edict-inspired multi-agent workflow: repo-portable task packets, INTAKE-to-QA state flow, pre-execution Gatekeeper veto, bounded read-only parallel reviews, single-writer UE rules, evidence contract, human approval boundaries, and a Gate 3 rider-pose task packet. No Redis/Postgres/dashboard or credential syncing was added. Next: run the task packet's parallel reviews, then only dispatch one bounded UE writer if visual evidence identifies a concrete rider-contact defect.

## Cross-PC Sync Note - 2026-08-31 13:43 +08:00

Closed the local Codex Neon Cleaner biweekly report automation (the other two PCs remain unchanged). Continued Gate 3 rider-pose strict QA using the new multi-agent task packet: two read-only reviews were dispatched, the local -SkipBuild -FullVisualQA check was run, and the result is ENGINEERING BLOCKED because Win64 SDK 10.0.22621.0 is invalid and the NeonCleanerUE compiled module plus local ParagonPhase asset are missing. Existing visual proof remains conditional; AI-video continuity remains blocked. Next: restore the C++/Windows SDK toolchain and ParagonPhase, then rerun the full Gate 3 check before any pose implementation.

## Cross-PC Sync Note - 2026-08-31 18:01 +08:00

2026-08-31: »Ö¸´±¾»ú UE 5.8 C++/MSVC/Windows SDK/.NET ¹¤¾ßÁ´²¢ÑéÖ¤ÍêÕû±à¼­Æ÷¹¹½¨Í¨¹ý¡£ÐÞ¸´Á½¸ö UE Python ×Ô¶¯»¯½Å±¾ÔÚ´ø¿Õ¸ñ¹¤×÷ÇøÂ·¾¶ÏÂµÄµ÷ÓÃ·½Ê½£¬Gate 3 ÒÑ½øÈëÕæÊµ Python ×Ê²úÐ£Ñé£»µ±Ç°Î¨Ò»¹¤³Ì×èÈûÊÇ±¾»úÈ±ÉÙ ParagonPhase£¨Phase_GDC Óë Phase_AnimBlueprint£©£¬Òò´ËÎ´Éú³ÉÐÂµÄ¶àÊÓ½Ç½ØÍ¼¡£ÏÂÒ»²½´Ó Epic/Fab »Ö¸´×Ê²úºóÔËÐÐÍêÕû Gate 3¡£

## Cross-PC Sync Note - 2026-09-02 19:10 +08:00

Gate 3 rider animation continuation on the office PC: local ParagonPhase is restored and the asset route is active. Refined `AN_Linxia_MotorcycleRide_Idle`, adjusted the motorcycle pawn rider attach transform, delayed rider contact logging until after animation update, and hardened UE automation for DDC / first-run shader delays. Full Gate 3 passed build, map validation, LinxiaRig validation, smoke, and default / side / rear proof captures using `Run-Gate3QualityCheck.ps1 -FullVisualQA -RiderPoseVerdict CONDITIONAL`. Latest proof frames are under ignored `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_190548*.png`. QA verdict: engineering PASS, playable rider CONDITIONAL PASS, AI-video continuity still BLOCKED until Control Rig / IK or a stronger seated source animation locks hands to bars and feet to pegs.

## Cross-PC Sync Note - 2026-09-02 22:32 +08:00

Gate 3 motorcycle/rider correction pass: fixed the imported motorcycle's baked OBJ axis mismatch by setting the player bike visual to `Roll=90`, kept the player pawn forward yaw at `0`, and exposed small dark seat/handlebar contact anchors so the Phase rider reads as mounted rather than standing beside the bike. Rebuilt `LVL_Linxia_MotorcycleChase` with a darker wet road, city mass silhouettes, underpass pieces, neon guide strips, fog, and reduced lighting to move away from the previous whitebox/overexposed read. Full Gate 3 passed with `powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 -SkipBuild -FullVisualQA -RiderPoseVerdict CONDITIONAL`. Latest proof frames are under ignored `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_222854*.png`. QA verdict: engineering PASS, playable motorcycle/rider read CONDITIONAL PASS, strict AI-video continuity still not signed off because hands/feet are visually acceptable for gameplay but not yet true IK-locked.

## Cross-PC Sync Note - 2026-09-02 22:39 +08:00

Final Gate 3 proof after footpeg anchor: C++ build passed, map regenerated, and `Run-Gate3QualityCheck.ps1 -SkipBuild -FullVisualQA -RiderPoseVerdict CONDITIONAL` passed. Latest ignored proof frames are `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_223644*.png`. This is the current cross-PC baseline: motorcycle orientation fixed, Lin Xia mounted on the bike, controls/smoke test pass, scene has dark neon prototype art. Remaining quality work is environment asset replacement and true IK/source-animation hand-foot locking before strict AI-video continuity sign-off.

## Cross-PC Sync Note - 2026-09-02 22:39 +08:00

Gate 3 motorcycle axis and mounted rider baseline fixed; final proof 2026-09-02_223644 passed FullVisualQA conditional.

## Cross-PC Sync Note - 2026-09-14 13:40 +08:00

2026-09-14: playable Kelly film chase engineering PASS. Added wet-night industrial scene, combat enemies/outcomes/HUD, robust film bridge and four HUD-free MP4s, real gameplay proof capture, motorcycle lighting, and final quality automation. Run-NeonChaseQualityCheck PASS; Gate 3 PASS with rider pose CONDITIONAL. Independent QA pending because sub-agent usage limit was reached.

## Sync note - 2026-10-10T17:34:57.8306531+08:00

Generated repository-facts-only Chinese biweekly report for 2026-09-26 through 2026-10-10; email delivery remains blocked by prior Gmail safety review; next action is rerun from an email-capable session after explicit authorization.

## Sync note - 2026-10-24

Generated the repository-facts-only Chinese biweekly report for 2026-10-10 through 2026-10-24. The remote dossier covered 12 origin branches, one window commit (36d3d2e), and zero new worklog events. Current status remains engineering PASS, rider pose CONDITIONAL, cinematic REWORK, and AI-video continuity BLOCKED. Email delivery remains blocked by the prior Gmail safety review; do not retry without explicit user authorization in an email-capable session.

## Sync note - 2026-10-24T17:35:14.1401898+08:00

Generated repository-facts-only biweekly report for 2026-10-10 through 2026-10-24; remote dossier covered 12 branches, one commit, and zero worklog events. Email remains blocked by prior Gmail safety review.

## Sync note - 2026-10-24T17:36:16.8740631+08:00

Generated repository-facts-only biweekly report for 2026-10-10 through 2026-10-24; remote dossier covered 12 branches, one commit, and zero worklog events. Email remains blocked by prior Gmail safety review.

## Biweekly reporting checkpoint - 2026-11-07

The repository-facts-only report for 2026-10-24 through 2026-11-07 is in docs/reports/biweekly-2026-10-24-to-2026-11-07.md. The all-origin dossier covered 12 branches, 9 unique commits and 10 worklog event variants. This period's cinematic polish, PBR persistence and V3 restore/audit work are published and verified. Keep the current verdict as engineering PASS, cinematic REWORK, AI VIDEO BLOCKED: hand contact, hero/bike detail and rigging, architecture/occlusion and the 241.070 ms hitch still require rework. Email delivery was not retried because the prior Gmail safety review requires explicit user authorization for this nonpublic automation report.

## Sync note - 2026-11-07T17:34:56.8851383+08:00

Generated repository-facts-only biweekly report for 2026-10-24 through 2026-11-07; remote dossier covered 12 branches, 9 unique commits, and 10 worklog event variants. Cinematic polish and V3 restore/audit are published; cinematic remains REWORK and AI video BLOCKED. Email delivery remains blocked by prior Gmail safety review.

## Sync note - 2026-11-07T17:35:36.2448822+08:00

Generated repository-facts-only biweekly report for 2026-10-24 through 2026-11-07; remote dossier covered 12 branches, 9 unique commits, and 10 worklog event variants. Cinematic polish and V3 restore/audit are published; cinematic remains REWORK and AI video BLOCKED. Email delivery remains blocked by prior Gmail safety review.

## MetaHuman rider assembly checkpoint - 2026-11-10

Epic binding and 2K preview texture download succeeded on a verified isolated copy.
The optimized medium assembly generated 283 assets; a fresh UE process reloaded
all of them. Generated assets and comparison evidence are in the private snapshot.
Old and newly bound body reference bones match, but topology differs and jacket fit
is not established. No rider replacement or playable new-character test exists yet.
Original saved character and open editor remain intact. See
`docs/tasks/metahuman-rider-2026-11-09.md` for the precise next steps and limits.
QA remains REWORK; cinematic/AI-video use remains BLOCKED.

## UE 5.9 AI preview research â€” 2026-11-11

Epic's 5.9 MegaJam Preview adds experimental agent tooling, animation generation
and retargeting features relevant to the rider. The machine has 5.8.1, not 5.9;
launcher automation was rejected, so no 5.9 installation or test occurred.
A blank 5.8 isolated MCP probe connected and enumerated toolsets. See
`docs/tasks/ue59-ai-evaluation-2026-11-11.md` for sources, limits and next steps.
Production remains on 5.8 and the rider and cinematic QA remain unfinished.

## UE 5.9 isolated MetaHuman and MCP validation â€” 2026-11-13

5.9.0 CL 60351404 is installed. An isolated copy loaded all 283 assembled
MetaHuman assets and a 5.9 MCP read-only call returned the character Blueprint's
five graphs. No migration, generated animation or game test was performed.
Kimodo needs additional model dependencies and gated access; investigate before
claiming a working animation workflow. See `docs/tasks/ue59-ai-evaluation-2026-11-11.md`.
Private restore preflight preserved one locally changed jacket source material;
its earlier snapshot must also be retained. A pre-existing editor configuration
change remains local. Cinematic QA remains REWORK and AI video BLOCKED.

## Sync note - 2026-11-16T12:41:30.7792501+08:00

Preserved the current SUNBREAK browser FPS under experiments/sunbreak-fable52 with exact original game SHA256, run instructions, briefs and prior QA record. Snapshot identity and syntax PASS; art remains REVISE. Raw model streams/account diagnostics excluded. Isolated code-only checkpoint: no UE/private asset changes or portability claim; UE restoration remains unverified. See docs/tasks/sunbreak-fable52-snapshot-2026-11-16.md. Next: retain baseline, then agree a visual reference before any requested art revision.

## Sync note - 2026-11-16T14:43:17.3256442+08:00

SUNBREAK realistic v2 saved separately under experiments/sunbreak-realistic-v2; original preserved. Frozen-build engineering PASS (65 release checks, 19 original smoke, 217 runtime invariants). 1080p rain automated combat P95/P99 about 16.8 ms, max 17.2 ms on RTX 5070. Independent playable-PBR art CONDITIONAL PASS; reference realism remains REWORK, primarily weapon/hands and enemy assets. Next: licensed production-quality viewmodel and character render assets, preserving gameplay contracts, then repeat current-build engineering/art QA. See docs/tasks/sunbreak-realistic-v2-2026-11-16.md. Isolated browser/public-CC0 checkpoint only: pre-existing private-vault changes preserved; no UE/private portability or cinematic/AI-video acceptance claim.

## Sync note - 2026-11-16T17:19:53.4933876+08:00

SUNBREAK recorded-audio slice complete. Realistic page http://127.0.0.1:5187/ and byte-identical earliest demo http://127.0.0.1:5187/original/ are separate. Added local CC0 recorded AR-15/M4 shots, mechanical reload/confirm cues, directional-distance mixing, volume/mute and lifecycle cleanup without gameplay changes. Independent bounded audio/gameplay QA PASS; release85/85, audio38/38, missing-module fallback5/5, original smoke19/19, runtime217/217; staged source/media/evidence bytes37/37 match. Final actual1080p rain30.0163s P95/P99~16.8ms max17.3ms, audio errors0. See docs/tasks/sunbreak-audio-2026-11-16.md and experiments/sunbreak-realistic-v2/qa/audio-review.md. Next: user audition and original-vs-realistic comparison; subjective listening and reference-art parity remain unapproved. Isolated browser/public-assets checkpoint; pre-existing private-vault restore modifications preserved, no UE/private portability claim.

## Sync note - 2026-11-16T19:52:42.7458967+08:00

SUNBREAK BLACK SQUALL v3 playable checkpoint is isolated at experiments/sunbreak-storm-v3 (localhost5188); v1/v2 pinned hashes unchanged. Wet scanned ground/reflections, storm HDR/rain/lightning, warm parallax rooms, plants, licensed MP5/arms and tactical display skins added without combat/layout changes. Exact gameplay audit, startup RNG0/8vs8, weather38 and weather-audio12 pass. Final hero art CONDITIONAL PASS for WIP only; final quality REWORK, not Unreal Engine or AAA parity. Current source-bound30s combat is background-throttled at about1fps and fails strict pacing; original smoke5 failures block dependent runtime217. Prior lightning triptych is explicitly stale. Next: foreground unchanged regression/performance rerun and remaining art refinement. Sites creation failed with provider backfill invariant; local playable only. Dirty private vault preserved; isolated public browser assets/code only, no UE/private portability claim. See task packet and qa/release-report.json.

## Sync note - 2026-11-16T20:44:32.8734818+08:00

SUNBREAK timber house slice CONDITIONAL PASS: reference-led enterable MERCADO12 with live E door, real interior and local floor/headroom. House28+browser47+storm38+audio12 pass; exact local-hook source audit and v1/v2 pins pass. Current1080p30s combat/audio frame pacing passes (P95 18.2ms, max18.8ms, zero over50ms); independent limited art review conditional, not UE5/AAA. Public browser assets only; dirty private vault preserved, no UE portability claim. Next: collect all-origin daily evidence, upload report and confirm one email delivery.

## Sync note - 2026-11-16T20:49:56.0131979+08:00

Daily SUNBREAK report prepared from frozen all-origin evidence at2026-11-16T12:46:10Z:12 branches,16 deduplicated commits (5 production,11 coordination). Production cb718135 is already remote-verified; all22 evidence-bound source files match committed bytes; v1/v2 preserved. Report distinguishes old failed QA from current bounded1080p pass and limited art conditional result. Next: after this report upload acknowledgement, send one requested self-email and record confirmed send outcome.

## Sync note - 2026-11-16T20:52:16.1591921+08:00

Requested browser slice delivered: production cb718135 and daily report c6d36bfe remote-verified. Daily HTML report sent exactly once to connected self; mail service acknowledged SENT and INBOX, not user read. No account address/mail IDs published. Normal5188 game restored, viewport reset, test tab closed and no startup errors. Limited house art remains CONDITIONAL PASS; current1080p combat/audio PASS is one bounded sample, not Unreal/AAA/full human acceptance. Next: user three-version comparison and optional minor wood grain/highlight/furniture polish. Public browser-only checkpoint; existing private vault unchanged.

## Sync note - 2026-11-17T12:44:58.1938094+08:00

Completed scoped third-demo cabin wood-grain correction: horizontal front/back/side/gable timbers and corner laps follow beam length; moving door/default fitting UVs and all geometry, collision and combat remain unchanged. UV31/31, house logic28/28, browser house47/47, exact combat+mutation tests and exact-byte build passed. Planck independently reviewed four current1920x1080 WebGL canvas frames against before; PASS for this correction only. Evidence: experiments/sunbreak-storm-v3/qa/timber-uv-report.json. v1/v2 and historical QA untouched; normal5188 game restored. No new performance/full-playthrough/UE cinematic claim. Preserved pre-existing dirty private vault; private transfer skipped because this isolated public web fix needs no private dependencies. Next: refresh third demo and inspect cabin.

## Sync note - 2026-11-17T13:33:23.0557204+08:00

SUNBREAK v3 tactical/public slice: cover navigation, aligned production fire, skeletal IK, black tile roof and wet-field rain impacts implemented. Exact player contract9, AI10, actor19, environment16, browser24 and house47 checks PASS; source-bound canvas sequences archived. Final1080p30s combat/audio run p95/p9916.8ms max50ms zero>50; earlier160.6ms hitch retained, bounded engineering CONDITIONAL PASS. Source checkpoint precedes separate sanitized GitHub Pages sunbreak/ publication and anonymous live verification. Earlier v1/v2 source unchanged. Unrelated dirty private vault preserved; private transfer skipped, no full UE portability claim.

## Sync note - 2026-11-17T13:36:33.0888301+08:00

Pages preparation stopped before publishing on original whitespace in ten pinned third-party license/vendor snapshots. Preserve their byte hashes; limit formatting-lint exceptions to those exact files. Authored code, asset/staged blob hashes and full publication whitelist remain enforced. Browser runtime and validated evidence unchanged; retry sanitized main:/sunbreak release next.

## Sync note - 2026-11-17T13:54:48.8359051+08:00

SUNBREAK public release COMPLETE. Normal protected-main PR6 merged without bypass as ba995a1d6a753aff0a9d547afc8801e6eee8dd06, deployed source97a20ca402c6c2478a85a0e3be1d4b75b094c9f3. Public https://luciuswang.github.io/neon-cleaner-demo/sunbreak/ plus original/ and v2/ all started/fired in browser; v3 reload30/89, NPC combat, audio and restart verified. All138 static files101465774 bytes match anonymous HTTPS hashes and root/web entries unchanged. One initial transient CDN503 passed retry; first report retained. Runtime remains exact validated release; this checkpoint adds PR-safe publishing tools and live evidence only. Overall demo delivered, engineering remains bounded CONDITIONAL due earlier isolated hitch; no UE/AAA/continuous-motion acceptance. Private vault unchanged/skipped.

## Sync note - 2026-11-17T15:18:10.1610122+08:00

SUNBREAK v3 editable cabin export/real Blender edit/reimport and left-arm repair accepted at bounded browser-demo scope. Source-bound collector41 PASS, independent engineering/art PASS, two final1080p30s combat/audio strict pacing passes. Earlier428ms hitch retained with unknown cause. v1/v2 and whole player module preserved. Public Pages publication and live hashes/smoke pending. Pre-existing dirty private vault preserved; this public-only slice skips private transfer, no full UE portability claim.

## Sync note - 2026-11-17T15:20:56.8338210+08:00

Pages preflight retained exact pinned upstream TextureUtils bytes using the existing archive-only whitespace exclusion family, after actual staged SHA checks. No runtime or QA-bound source changed. Source a32056a is uploaded; retrying normal Pages publication with this publishing-tool correction.

## Sync note - 2026-11-17T15:27:27.6771396+08:00

DONE: SUNBREAK v3 editable cabin and left-arm slice. Live https://luciuswang.github.io/neon-cleaner-demo/sunbreak/ ; art ZIP at assets/house/timber-house-art-kit.zip . Normal PR7 merged as b208c68 from source e9dfc92. Anonymous146/146 SHA verification and public start/fire/reload/download smoke PASS; v1/v2 and root/web preserved. Bounded art/engineering PASS and final two strict1080p30s pacing passes; earlier428ms hitch/remaining original right shoulder/full reload limitations retained. Public self-contained assets/LFS verified; pre-existing private vault unchanged, no full UE portability claim. Task packet and durable live QA reports complete.

## Sync note - 2026-11-17T17:35:47.5829110+08:00

SUNBREAK user house import local QA accepted: exact saved user Blender project preserved, actual packed Hello/red paint and4 object edits imported; reviewed3 foundation contract records plus matching low-step support. Preservation19/unit33/browser36+47+24 and source-bound staged collector29 PASS; independent engineering/art PASS. Final two1080p30s combat/audio samples pass; first unexplained568.5ms hitch retained. v1/v2, combat/weapon, original art kit and historical QA exact. Public Pages publication/live verification pending. Pre-existing private vault changes preserved; isolated public web slice skips private transfer, no UE portability claim.

## Sync note - 2026-11-17T17:44:16.5077015+08:00

DONE: manual house-edit control verified and live at https://luciuswang.github.io/neon-cleaner-demo/sunbreak/ . Exact saved user Blender project/packed Hello-red paint and geometry/material edits preserved, source28a7cb9; normal PR8 merge49d79ba. Anonymous146/146 SHA checks and public actual start/fire/reload PASS. Independent bounded engineering/art PASS; v1/v2 and original art kit untouched. Prior568.5ms hitch and first70s public cold-start timeout retained; final two strict1080p30s samples and public repeat PASS, not universal performance/startup guarantees. User original F files unchanged. Private vault conflict preserved, isolated public-only checkpoint; no UE portability claim. Next: user reviews actual result; no production/email pending.

## Sync note - 2026-11-17T18:51:19.3006590+08:00

SUNBREAK v4 local single-player auto-fire/reload checkpoint:32 browser groups and8 unit groups PASS; independent engineering and bounded sampled-art PASS. Final sustained1080p pair PASS; prior1333.2ms and52.6ms hitches retained. Continuous-motion recording density FAIL/UNVERIFIED, no4v4 claim. Previous3demos/shared assets unchanged. Publication pending normal protected-main PR and anonymous public verification. Existing private-vault dirty state untouched; this public-web slice has no new private asset dependencies.

## Sync note - 2026-11-17T18:59:30.0577235+08:00

SUNBREAK v4 DONE bounded single-player CONDITIONAL PASS: https://luciuswang.github.io/neon-cleaner-demo/sunbreak/v4/ . Public runtime source f5fc3012a775995052dac5fc7fb623d12fea7f85; normal PR9 publication e2c0faf2c51b79c44e3589e08987b6feb225294a; Pages action44068884546SUCCESS. Anonymous126file hashes and7actual-public input checks PASS; Planck publication review PASS. Earlier3demos unchanged. Prior hitches, failed capture density and stale-HUD first public test retained. Continuous motion UNVERIFIED;4v4 NOT IMPLEMENTED, next choose authorized real-time host/budget. Existing private-vault state untouched; no full UE/private portability claim. No SeaTalk/email sent.

## Sync note - 2026-11-17T21:39:56.4922022+08:00

Riverfall local source-bound CONDITIONAL PASS. Fable5.2 village contribution; independent river map, paired houses/ruins, wet terrain and scanned forest. Earlier four demos and v4 guns/NPC animation unchanged. CPU18/AI62/terrain175/architecture76, controls32/traversal40 and8views pass. Final1080p30s pair max18.7/18.8ms zeroover50; Planck runtime PASS, Zeno sampled art CONDITIONAL PASS. Prior176-318ms stalls retained, cause unknown; no AAA/4v4/continuous-motion acceptance. New sunbreak/river Pages publication pending. Dirty private vault untouched; isolated public browser checkpoint skips private assets.

## Sync note - 2026-11-17T21:45:18.7684283+08:00

River map publication preflight: exact prepared PR and full manifest now pinned with 12 contract checks. Runtime unchanged and local gates retained. Public deployment pending; dirty pre-existing private vault remains untouched.

## Sync note - 2026-11-17T21:52:38.5619759+08:00

DELIVERED Riverfall map: https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/ . Source98e650e, PR10 merged91924b3, Pages44096139814 SUCCESS. Pinned anonymous154checks and actual public7input checks PASS; independent publication PASS. Overall bounded single-player prototype CONDITIONAL PASS; no real4v4/AAA/continuous-motion acceptance. Earlier four demos preserved. Current task packet records next optional playtest; pre-existing dirty private vault untouched, no full private portability claim.

## Sync note - 2026-11-18T12:35:46.7366138+08:00

Riverfall reference-led art WIP checkpoint: two diagonally paired enterable timber cabins, scanned foliage and wet ground, static layered ruins, bounded Fable5.2 chipped-slab contribution. Final source-bound 6 unit suites, 15 cabin interactions, 32 controls and 40 traversal checks pass. Independent geometry/input PASS; art REVISE and strict performance BLOCKED (53ms max, 2 frames above50ms; diagnostic53.2ms). Retain all failed evidence, including corrected pointer-lock test lifecycle race. qa/release.json is BLOCKED; prior accepted release archived separately. No Pages update; local preview http://127.0.0.1:5190/river/. Older four demos and weapon/NPC animations unchanged. Next: resolve cabin bright seams, layered ruin breaks, understory/water-edge transitions and diagnose long frames before fresh acceptance. Pre-existing unrelated dirty private vault untouched, private transfer explicitly skipped; no UE/private portability claim.

## Sync note - 2026-11-18T15:44:48.0070397+08:00

Riverfall after-rain daylight and layered valley WIP: verified CC0 clear HDR/pebble-rock assets, coherent sun/sky, lower eroded ridges, wet banks, leafy groundcover redistribution; gameplay and earlier demos preserved. Final seven headless functional/evidence phases and nine CPU suites PASS with all144 runtime bindings. Independent engineering approves WIP only; art REVISE and performance BLOCKED (storm max53/247.4ms; sunny53.2ms). Historical failed performance binding gaps and cabin harness lifecycle failure retained. No Pages deployment or AAA parity. Next: local river glare/bank naturalism, rocky ridge/forest-foot transition, profile retained hitches. Pre-existing dirty private vault preserved; private transfer explicitly skipped, no UE/private portability claim. Canonical task packet and experiments/sunbreak-river-v4/qa/release.json contain evidence.

## Sync note - 2026-11-18T18:02:03.6176319+08:00

Riverfall reference-water WIP: irregular compound grass clumps, mixed modeled/submerged stones, warped moving shallow water, brighter aligned daylight and corrected SSAO shadow preservation. Final145runtime bindings and staged identities match; eight current browser phases and11CPU suites PASS, earlier four demos/gameplay preserved. Descartes approves WIP only (engineering CONDITIONAL PASS); Lovelace current still art REVISE. Strict pacing BLOCKED: sunny max53.3ms, storm52.7/390.6ms; recordings timed out, cause unknown, sampled frames only and continuous motion UNVERIFIED. Local preview5190/river; no Pages/AAA/UE5 acceptance. Next: close-bank sediment depth, pale shore reflection, natural leafier clumps and retained hitch diagnosis. Existing dirty private vault preserved; isolated public-browser checkpoint skips private transfer, no UE/private portability claim. See task packet and qa/release.json.

## Sync note - 2026-11-18T20:01:14.1334664+08:00

Riverfall wildbank source-only WIP: CC0 atlas-based mixed grass, two connected submerged fords and irregular wet-bank to dry-soil transition implemented; bridge, older demos, combat, weapons/NPC animation and buildings preserved. Final12 CPU suites and9 current browser phases PASS;182 runtime bindings and245 staged byte identities verified. Descartes engineering CONDITIONAL PASS for WIP, Lovelace four final target stills PASS for the three annotated corrections only; overall reference art REVISE, continuous motion UNVERIFIED. Strict release BLOCKED: sunny max1173.1ms/3 frames>50ms; storms52.6ms/1 and53.6ms/4. Causes unknown, failed evidence retained, no retry-until-pass. No Pages update; local http://127.0.0.1:5190/river/ . Next: diagnose retained hitches, then pale water-edge reflection and sediment relief. See task packet and experiments/sunbreak-river-v4/qa/release.json. Pre-existing dirty private vault preserved/skipped; no full UE/private portability or AAA claim.

## Sync note - 2026-11-19T12:44:30.9233284+08:00

River surface-atmosphere 2026-11-19: three PBR terrain zones and low foundation weeds; material-only exposed masonry; physical SSAO depth/projection fix; original analytic height haze with reflection clipping. Scoped independent art PASS, engineering CONDITIONAL PASS for source-only WIP. 15 CPU suites and 10 current native browser phases pass, 51 images/194 runtime bindings; staged audit352 PASS. Sunny strict sample PASS; storms retained FAIL max66.7ms with2/3 hitches. AAA REVISE, motion UNVERIFIED, release BLOCKED; Pages unchanged. Next: investigate storm hitches and continuous motion; optional close aggregate/path polish. Unrelated dirty private vault preserved; private transfer skipped, no full UE portability claim. Task and current QA: docs/tasks/sunbreak-river-surface-atmosphere-2026-11-19.md and experiments/sunbreak-river-v4/qa/release.json.

## Sync note - 2026-11-19T15:29:12.9132879+08:00

Riverfall downloaded-asset checkpoint (sunbreak-river-downloaded-assets-2026-11-19): 12 local-only GLBs, 2 peripheral houses, 6 wall fragments, 24 rubble patches and 429 grass clumps. Original downloads, old demos and gameplay unchanged. All 16 CPU suites and six current WebGL functional phases PASS; limited independent art/engineering CONDITIONAL PASS. Three strict performance samples FAIL; AAA/public release BLOCKED, continuous motion UNVERIFIED. Canonical QA and complete staged runtime/evidence audit are bound to current bytes. Imported GLBs+manifest privately backed up and fresh-cache LFS verified at cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407; restore preflight tested. Existing dirty canonical UE vault untouched; not whole-project portability. No public deployment or unverified model binaries in public Git. Next: profile layer draw/reflection cost, refine grass/debris transitions, confirm licenses and obtain continuous-motion evidence. See task packet and experiments/sunbreak-river-v4/qa/downloaded-release.json.

## Sync note - 2026-11-19T17:21:27.3528369+08:00

River material/combat polish checkpoint: six bounded stone covers, stronger wall/ground relief, clustered meadow, distant canopy, world-responsive gun lighting and actual-hit feedback. Prior demos and gameplay preserved. CPU21/21 and six native functional phases PASS; engineering CONDITIONAL PASS; sampled art REVISE (surface artifacts, weapon material balance, impact evolution). All three strict performance samples FAIL; AAA/public release BLOCKED, continuous motion UNVERIFIED. Source/evidence staged audit434 PASS; Pages unchanged. Private import snapshot cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407 unchanged and already verified; no new binaries, dirty UE vault preserved, no whole-UE portability claim. Next: controlled material/AO isolation, delayed-hit/motion review and frame-pacing profiling. Task: docs/tasks/sunbreak-river-material-combat-polish-2026-11-19.md; canonical QA: experiments/sunbreak-river-v4/qa/polish-release.json; preview http://127.0.0.1:5190/river/.

## Sync note - 2026-11-19T21:00:17.0965863+08:00

Procedural material lab on port5191: pinned MIT reference, code-generated materials, wetness/ripples/light presets and offline A/B. Original demos unchanged. Reference-level sampled art PASS; engineering demonstration CONDITIONAL PASS. Strict pixel repeat and realtime hitch gates FAIL; continuous motion UNVERIFIED, Riverfall migration BLOCKED. Task remains REWORK; next isolate hitches and 28 one-level pixel differences. Canonical record: experiments/procedural-material-lab/qa/release.json. Public-code/generated-evidence checkpoint only; private UE vault preserved and not certified.

## Sync note - 2026-11-19T22:06:19.8205712+08:00

River procedural migration completed as bounded local playable checkpoint after explicit user approval. Canonical QA: experiments/sunbreak-river-v4/qa/migration-release.json. Final24capture/16pair visual assertions and24CPU suites PASS; independent targeted source PASS and sampled art CONDITIONAL. New-material functional5/5PASS; legacy2/3, timed bridge traversal FAIL by0.1015m without blocking. All3strict performance samples FAIL (p95 about35.8ms, max71.3/159.3/339.1ms). Seven inherited raw CRLF evidence differences remain FAIL; historical files untouched. Layout/gameplay/old demos preserved. No Pages deployment, new Fable call or AAA/continuous-motion acceptance. Public code/evidence only; unchanged verified private browser snapshot reused, dirty UE vault preserved and private transfer skipped. Next: frame pacing, timed legacy traversal diagnosis and continuous-motion review before release.

## Sync note - 2026-11-20T13:12:30.6009993+08:00

River after-rain look checkpoint: stronger warm sun, retained puddles/selective reflection and green understory; gameplay/layout and old demos preserved. Independent source and sampled-art PASS;27CPU suites,8functional phases,14native1080p captures PASS. Strict3sample performance FAIL; continuous-motion UNVERIFIED, AAA release BLOCKED. See experiments/sunbreak-river-v4/qa/afterrain-release.json and dated afterrain-look-review-2026-11-20.json. Three checked previous-look RGB views exactly match history; original historical review restored and unchanged after naming-collision audit. No Pages deployment. Public code/evidence only; unchanged verified browser resource snapshot reused, pre-existing dirty UE private vault preserved. Next: isolate frame pacing without combat/layout changes, then continuous-motion review.

## Sync note - 2026-11-20T17:27:18.7830589+08:00

River stone-cover task complete: six local reference scan walls, exact rendered-instance shot/LOS and distributable procedural fallback. Source/art, 7 CPU suites, 5 functional phases and 12 native LOS probes PASS. Strict performance FAIL: p95 35.9ms, max88.7ms, 10 frames over50ms; full AAA release BLOCKED. Canonical QA: experiments/sunbreak-river-v4/qa/fieldstone-review-2026-11-20.json. Existing private browser snapshot cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407 unchanged; dirty UE vault preserved. No Pages deployment. Next: isolate frame pacing and verify scan redistribution permission.

## Sync note - 2026-11-20T19:16:04.0372837+08:00

Standing user model preference recorded in AGENTS.md: use Gateway claude-fable-5-2 first for production; Codex fallback only after explicit current exhausted-credit evidence, not timeout/auth/connection errors. Reference-house work is paused before implementation and no new Fable call occurred. Next: verify the Fable route and current response/usage, then resume bounded plan/review. Documentation-only checkpoint; runtime and private dependencies unchanged, dirty UE vault preserved, private transfer skipped. No new game QA or deployment.

## Sync note - 2026-11-21T17:38:09.4470903+08:00

Generated repository-only biweekly report for 2026-11-08 through 2026-11-21 from 17 origin branches, 122 commits and 57 worklog events. Email delivery remains blocked by prior Gmail safety restriction; private vault had unfinished local changes and was preserved.

## Sync note - 2026-11-23T11:22:23.4078678+08:00

Playable river demo: Fable 5.2 authored aim assist and two traversable timber houses. Scope checked: 21 house checks and real fallback WebGL. Prior strict performance and legacy HTML/map identity not certified. Preparing Pages release. No private asset changes.

## Sync note - 2026-11-23T11:29:46.2952158+08:00

PR 11 merged; public Pages source 9c2f6ef verified. Public Chrome manual-input smoke passed; email sent. Four changed runtime files matched live hashes. All-resource check timed out and two console 404s were not attributed; no exhaustive network/AAA claim.

## Sync note - 2026-11-23T14:52:21.1441014+08:00

Riverfall: procedural timber, trampled mud and 1s material-specific impacts. Six regression suites and native RTX canvas shots passed; review is scoped conditional. Unchanged private web asset manifest verified; dirty unrelated UE vault preserved. See docs/tasks/river-timber-mud-20261123.md.

## Sync note - 2026-11-23T14:55:49.5936791+08:00

Riverfall PR 12 merged and live. Anonymous Pages manifest matches 8ee6b9ae30db444200563cd56eff24bf2191e2b5; HTML and all five changed runtime files were hash-verified. No earlier demo was replaced.

## Sync note - 2026-11-23T16:39:29.9886306+08:00

Riverfall: shaded wood tear, dark masonry chip and wider water crown. Scoped CONDITIONAL PASS; paired daylight renders and 2-call/400-triangle GPU limit verified. Public release next; unchanged web snapshot verified separately.

## Sync note - 2026-11-23T16:42:12.8213269+08:00

Riverfall impact art: PR 13 merged; anonymous Pages manifest, HTML and FX bytes verified for source 55b3844. Conditional art pass, next player in-motion review. Earlier demos unchanged.

## Sync note - 2026-11-23T17:04:22.0183410+08:00

Riverfall: floodplain meadow banks, weathered edge shelves, lit crowns, palms and forested ridges. Ten suites, new paired mode geometry and six matched cameras passed scoped QA. Private web snapshot separately verified. Pages next.

## Sync note - 2026-11-23T17:07:05.5488936+08:00

Floodplain art is public via PR 14. Anonymous Pages manifest, HTML, and four changed runtime modules verified for source 4d2c8b6. Earlier demos unchanged; user visual review in motion next.

## Sync note - 2026-11-23T20:15:02.6853108+08:00

Riverfall optional 4v4 casual elimination implemented. Two isolated WebRTC browsers agree on rooms, movement and result. Local quick match, eight-slot capacity, rejection, AI takeover and authority rules pass. Private web snapshot verified separately. Pages smoke next.

## Sync note - 2026-11-23T20:19:43.4115473+08:00

Riverfall online beta live and verified on Pages PR 15. Anonymous bundle matches; real invite UI and two WebRTC contexts agree on roster, movement, round result and refilling. Next: friends on independent networks.

## Sync note - 2026-11-24T11:20:42.7765883+08:00

Riverfall 4v4 opening: diagonal screened starts and distinct crowd motion. Tested 864 geometry and 512 engine sightlines, 12 simulated round openings, solo, real local WebRTC and eight-seat capacity. Public release verification next.

## Sync note - 2026-11-24T11:23:59.8966731+08:00

Riverfall diagonal opening is live on Pages PR 16: public bytes match, two browser peers sync movement/score and AI refill on leave. Next: subjective player playtest on independent devices.

## Sync note - 2026-11-24T12:32:35.1239510+08:00

iOS boot checkpoint only, Pages unchanged. Explicit dynamic paths fix Windows WebKit reproduction; iPhone 17 Pro iOS 26.2 Simulator candidate displayed 4v4 notice but did not signal scene ready. Next: diagnose first frame/process termination before shipping.

## Sync note - 2026-11-24T13:37:57.4539782+08:00

River mobile PR 17 live. Apple iPhone 17 Pro iOS 26.2 simulator passed solo, offline 4v4, and public-signaled invite host with movement, look, held fire, reload and visible rendered frames. Production bytes and public solo/practice replay verified; physical iPhone Chrome remains user acceptance.

## Sync note - 2026-11-24T14:25:14.1533803+08:00

Riverfall mobile now uses the desktop art family. Matched camera review conditional; waiting for Apple simulator and public acceptance before replacing the live entry.

## Sync note - 2026-11-24T14:37:01.4613015+08:00

Riverfall shared-art iPhone build is live on Pages PR 18. Actual iOS Simulator solo, AI practice and invitation host passed; all 27 public look assets matched and both normal public entries replayed. Owner hardware/art acceptance remains.

## Sync note - 2026-11-25T15:56:32.9637411+08:00

Riverfall loading feedback lifecycle regression passed. Preserve the existing public game URL; Pages release verification follows. Unrelated private UE vault remains untouched.

## Sync note - 2026-11-25T15:59:54.8226022+08:00

Riverfall loading menu live on unchanged Pages URL, PR 19; HTML, controller, scene module, and release manifest are byte-verified. Startup lifecycle QA passed.

## Sync note - 2026-11-25T16:21:58.1040576+08:00

Riverfall field wear and matching stone perimeter: desktop and phone-profile render checks, boundary collision, desktop walk/jump, and squad regressions passed. See task packet for evidence and release status.

## Sync note - 2026-11-25T16:25:25.8380438+08:00

Pages PR 20 live at the existing River URL. The release manifest and all seven changed/new runtime modules matched; next is owner visual acceptance.

## Sync note - 2026-11-25T17:28:47.7646175+08:00

Four mirrored riverbank screens pass solo opening LOS, crossing and squad regressions on the Riverfall map; representative desktop and mobile-profile frame evidence is in the task packet. Public release verification follows.

## Sync note - 2026-11-25T17:32:04.2369810+08:00

GitHub Pages PR 21 is live. The default Riverfall URL serves the verified paired bank screen build. Next: player feel check from the near-bank route.

## Sync note - 2026-11-25T19:30:44.6761654+08:00

Riverfall wall meadow: PC/phone-profile artwork and source-mask checks pass; unchanged gameplay regressions pass. Evidence includes a same-camera before/after. GitHub Pages verification follows.

## Sync note - 2026-11-25T19:33:28.4021787+08:00

GitHub Pages PR 22 is live; the public manifest and all six changed or new game modules match. Next: player review of grass and retained roads, and a physical handset performance check.

## Sync note - 2026-11-25T20:16:47.8288116+08:00

Riverfall meadow colour and exterior sward complete; fixed-camera WebGL both profiles and geometry checks passed, visual iteration conditional pass. Publish this source via river-only Pages PR.

## Sync note - 2026-11-25T20:19:55.5293883+08:00

Riverfall slope meadow release PR 23 merged. Normal public URLs for the release manifest and all five changed modules byte-verified. Next: visual owner/handset feedback.

## Sync note - 2026-11-25T22:01:13.5182959+08:00

Riverfall five textured palms, ten vine-bearing covers and roof patina checked at four poses on both browser profiles. Visual conditional pass with shade-readability caveat; release pending Pages byte check.

## Sync note - 2026-11-25T22:04:43.7696090+08:00

Riverfall material ageing is live on Pages PR 24. Public manifest and 7 runtime modules byte verified. Next: owner art review, especially vine stems in deep shade.

## Sync note - 2026-11-26T12:44:31.6652593+08:00

Riverfall phone viewport, recoverable room invitation and water. Local two-peer original-link freeze/thaw and reload, narrow copy control, screen fit, water frames and rules verified; public release and Apple probe pending.

## Sync note - 2026-11-26T12:49:33.1097476+08:00

PR 25 released and byte-verified. Public invite after host freeze/thaw: two connected peers, six AI; phone touch and rotation passed. Apple candidate solo, practice and host passed. Physical SeaTalk app switch not tested.

## Sync note - 2026-11-26T16:04:52.4922937+08:00

Record personal SeaTalk delivery for every verified playable update. This release was sent directly with both solo and 4v4 links.
