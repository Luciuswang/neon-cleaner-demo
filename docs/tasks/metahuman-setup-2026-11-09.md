# MetaHuman setup — 2026-11-09

Task: `metahuman-setup-2026-11-09`; state: BLOCKED pending Epic Core Data install
and restart of the user's currently open editor. User requested a simple character
creation and facial-expression workflow. Existing Kelly and chase content retained.

Configured the project descriptor for MetaHuman Creator (`MetaHumanCharacter`),
Animator (`MetaHuman`), MetaHuman Live Link and editor scripting. Existing DX12,
SM6 and Control Rig settings were already present. `ue/Start-MetaHuman.bat`
checks the same essential optional-content file categories as the UE5.8 editor,
then uses the commandlet to create or preserve a starter asset before starting
the editor. It refuses to run against a currently open copy of this project.
The current editor predates the descriptor change and has not loaded these plugins.

`ue/scripts/metahuman/create_starter.py` was exercised twice in a separate clean
UE5.8 null-RHI project with the same plugin set: creation and save passed, and a
fresh second process loaded/preserved the existing asset without replacement.
The first draft failed because loading a nonexistent asset logged an engine error;
the corrected script checks existence before load and both final runs exited 0.
The isolated engine logs warn that optional Creator content is missing. This
is plugin/asset-creation verification, not a usable Creator, face-capture or
audio-animation end-to-end test. Existing user editor was not closed or modified.

Core data required by Epic is absent from the installed engine's Optional path,
including TextureSynthesis `.ar` and BodyTextures `.uasset` checks. The last
historical install checklist claiming it was selected is not proof it exists.
User must save and close active UE work, install Core Data in Launcher > UE5.8
Options, then run the new launcher. Computer Use access to both editor and Epic
Launcher was not approved; no attempt was made to force-close the editor.

Private snapshot inventory and public Git ignore now include both the workspace
and default `/Game/MetaHumans` assembly directory. A focused test verifies both
are included in inventory; separately `git check-ignore` verifies public ignore.
Only files in those directories are covered, not arbitrary output paths or media.
See `docs/metahuman-quickstart.md` for steps and official links.

No visual acceptance or actual rendered performance has been tested. Changing
the project descriptor changes the cinematic dependency fingerprint; prior
offscreen QA is historical and needs fresh evidence before any new acceptance.
Next: complete Core Data installation and restart, run launcher, create/assemble
the character, then test webcam or a saved audio asset end to end.

## Starter created after Core Data installation

On 2026-11-09 the user installed Core Data; the launcher readiness check passed.
The actual project commandlet created `/Game/MetaHumanWorkspace/Characters/Heroine_MetaHuman`
and exited successfully, then started the Unreal editor. This is a default editable
starting asset, not yet an assembled character or a Kelly identity match. Webcam,
audio performance, in-editor Creator usability and facial animation remain untested.
Next: open the asset in Creator, edit and save; assemble before using in a level;
then validate an expression via the camera or an audio clip.
