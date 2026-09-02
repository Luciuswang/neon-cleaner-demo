# Project Handoff

Last updated: 2026-08-31

## Away contact

- If Baomin is away and user approval is truly required, contact:
  `baomin.wang@garena.com`.

## Repo and live demo

- GitHub repo: https://github.com/Luciuswang/neon-cleaner-demo
- Live mobile test URL: https://luciuswang.github.io/neon-cleaner-demo/
- Main branch: `main`
- GitHub Pages source: `main` branch, `/ (root)`

## Current status

This repo contains the first playable prototype for `ÈúìËôπÊ∏ÖÈÅìÂ§´ / Neon Cleaner`.

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
ËØ∑ÈòÖËØªËøô‰∏™‰ªìÂ∫ìÁöÑ README.md Âíå docs/handoff.md„ÄÇÊàë‰ª¨Ê≠£Âú®ÂÅö‰∏Ä‰∏™Âêç‰∏∫‚ÄúÈúìËôπÊ∏ÖÈÅìÂ§´ / Neon Cleaner‚ÄùÁöÑ‰∫íÂä®ÁîµÂΩ±Ê∏∏Êàè demo„ÄÇËØ∑ÂÖàÁêÜËß£ÂΩìÂâçÁªìÊûÑ„ÄÅÁé©Ê≥ïÂàÜÊîØ„ÄÅGitHub Pages ÈÉ®ÁΩ≤Áä∂ÊÄÅÔºåÁÑ∂ÂêéÁªßÁª≠ÂºÄÂèë‰∏ã‰∏ÄÁâà„ÄÇ
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

Added repo-sourced biweekly reporting rule and created new automation 'Neon Cleaner ÂèåÂë®È°πÁõÆÊä•Âëä' that syncs GitHub before reporting. User should cancel the old other-PC report to avoid duplicate/inaccurate reports.

## Cross-PC Sync Note - 2026-08-25 20:28 +08:00

Updated automation 'Neon Cleaner ÂèåÂë®È°πÁõÆÊä•Âëä' to start on the weekend biweekly cadence and email baomin.wang@garena.com plus zhaot@garena.com. Report source remains GitHub/repo facts, not local Codex chat memory.

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

2026-08-31: ª÷∏¥±æª˙ UE 5.8 C++/MSVC/Windows SDK/.NET π§æﬂ¡¥≤¢—È÷§ÕÍ’˚±‡º≠∆˜ππΩ®Õ®π˝°£–ﬁ∏¥¡Ω∏ˆ UE Python ◊‘∂ØªØΩ≈±æ‘⁄¥¯ø’∏Òπ§◊˜«¯¬∑æ∂œ¬µƒµ˜”√∑Ω Ω£¨Gate 3 “—Ω¯»Î’Ê µ Python ◊ ≤˙–£—È£ªµ±«∞Œ®“ªπ§≥Ã◊Ë»˚ «±æª˙»±…Ÿ ParagonPhase£®Phase_GDC ”Î Phase_AnimBlueprint£©£¨“Ú¥ÀŒ¥…˙≥…–¬µƒ∂‡ ”Ω«ΩÿÕº°£œ¬“ª≤Ω¥” Epic/Fab ª÷∏¥◊ ≤˙∫Û‘À––ÕÍ’˚ Gate 3°£

## Cross-PC Sync Note - 2026-09-02 19:10 +08:00

Gate 3 rider animation continuation on the office PC: local ParagonPhase is restored and the asset route is active. Refined `AN_Linxia_MotorcycleRide_Idle`, adjusted the motorcycle pawn rider attach transform, delayed rider contact logging until after animation update, and hardened UE automation for DDC / first-run shader delays. Full Gate 3 passed build, map validation, LinxiaRig validation, smoke, and default / side / rear proof captures using `Run-Gate3QualityCheck.ps1 -FullVisualQA -RiderPoseVerdict CONDITIONAL`. Latest proof frames are under ignored `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_190548*.png`. QA verdict: engineering PASS, playable rider CONDITIONAL PASS, AI-video continuity still BLOCKED until Control Rig / IK or a stronger seated source animation locks hands to bars and feet to pegs.

## Cross-PC Sync Note - 2026-09-02 22:32 +08:00

Gate 3 motorcycle/rider correction pass: fixed the imported motorcycle's baked OBJ axis mismatch by setting the player bike visual to `Roll=90`, kept the player pawn forward yaw at `0`, and exposed small dark seat/handlebar contact anchors so the Phase rider reads as mounted rather than standing beside the bike. Rebuilt `LVL_Linxia_MotorcycleChase` with a darker wet road, city mass silhouettes, underpass pieces, neon guide strips, fog, and reduced lighting to move away from the previous whitebox/overexposed read. Full Gate 3 passed with `powershell -ExecutionPolicy Bypass -File .\ue\Run-Gate3QualityCheck.ps1 -SkipBuild -FullVisualQA -RiderPoseVerdict CONDITIONAL`. Latest proof frames are under ignored `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_222854*.png`. QA verdict: engineering PASS, playable motorcycle/rider read CONDITIONAL PASS, strict AI-video continuity still not signed off because hands/feet are visually acceptable for gameplay but not yet true IK-locked.

## Cross-PC Sync Note - 2026-09-02 22:39 +08:00

Final Gate 3 proof after footpeg anchor: C++ build passed, map regenerated, and `Run-Gate3QualityCheck.ps1 -SkipBuild -FullVisualQA -RiderPoseVerdict CONDITIONAL` passed. Latest ignored proof frames are `ue/NeonCleanerUE/Saved/Quality/linxia_motorcycle_gate3_quality_2026-09-02_223644*.png`. This is the current cross-PC baseline: motorcycle orientation fixed, Lin Xia mounted on the bike, controls/smoke test pass, scene has dark neon prototype art. Remaining quality work is environment asset replacement and true IK/source-animation hand-foot locking before strict AI-video continuity sign-off.

## Cross-PC Sync Note - 2026-09-02 22:39 +08:00

Gate 3 motorcycle axis and mounted rider baseline fixed; final proof 2026-09-02_223644 passed FullVisualQA conditional.
