# Experimental MetaHuman jacket fitting

Run `Run-MetaHumanJacketFit.ps1` in a separate 3ds Max batch process. All four
parameters are mandatory; there are no workstation paths or timestamp defaults:

```powershell
.\tools\assets\Run-MetaHumanJacketFit.ps1 `
  -MaxBatchExe $absoluteMaxBatchExecutable `
  -BodyFbx $absoluteExportedBodyFbx `
  -JacketFbx $absoluteOriginalJacketFbx `
  -OutputDir $absoluteNewScratchDirectory
```

Supply absolute paths. The output parent must exist and the output directory must
not exist. Use an ignored private scratch location. The runner launches a fresh
batch instance and writes uniquely named sibling logs. The script atomically
claims its output with `.experiment.lock` and refuses an occupied directory.
Neither input is saved or overwritten. Never run this script in the user's
interactive Max session: it resets its own batch scene.

The runner passes `-mxsString bodyFbx:<path>`, `-mxsString jacketFbx:<path>` and
`-mxsString outputDir:<path>` as separate argument pairs. Direct batch callers
must supply the same keys; missing, relative or nonexistent inputs are refused.
Use forward slashes for direct `-mxsString` paths; backslash escape sequences are
interpreted by Max. The runner normalizes these paths automatically. Dictionary
keys are read as MAXScript names. Exceptions are rethrown with `throw()`.

This experiment expects body node `Heroine_MetaHuman_FittingCopy_Body`, jacket
node `polySurface4`, and the MetaHuman upperarm/lowerarm/hand bones. Its garment
dimensions and sleeve centerline are specific to the inspected leather jacket;
path portability does not make it a general clothing fitter. Units are centimeters.

Actual Max batch testing on 2026-11-09 fixed catch syntax, argument key type and
Windows path escaping. Controlled import probes retain 342-bone Skin with both
default inches and explicit centimeters, and with `Mode=#create`.

The confirmed transfer failure was ambiguous node lookup: the body FBX contains a
Dummy and an Editable_mesh with the identical body name. `getNodeByName` selected
the Dummy, so earlier zero-modifier diagnostics did not describe the body mesh.
The script now requires exactly one matching **geometry** node and checks its
Skin before and after jacket import. It also resolves the jacket via geometry.

The corrected portable run preserved 2,521 garment vertices and explicitly
deformed 1,151 sleeve vertices into the measured shoulder/elbow/wrist pose. Skin
Wrap received all 32,334 body control points and generated Skin with 342 bones,
zero unweighted vertices, zero non-normalized sums and at most five influences
per vertex. It exported the experimental `.max` and skinned `.fbx`; runner exit
was zero. Historical failed outputs remain preserved, each test in a fresh folder.

The first skinned export included the outer body Dummy and was rejected by UE's
skeleton merge. The corrected export detaches the actual `root` and garment while
preserving world transforms, removes the Skin Wrap fitting modifier, exports only
the garment and 342 reference skeleton nodes, and explicitly uses Z-up. The source
body and original files remain unchanged; this occurs only in the scratch scene.

Fresh Max reimport of this corrected FBX retains all 342 skeleton node names with
`root` parentless; Skin keeps the 64 bones actually used by garment weights. The
2,521 vertices have no zero/non-normalized weights and at most five influences.
Four separate 12-degree left/right upperarm and lowerarm perturbations move
230–660 vertices by up to 4.88–9.61 cm, with finite positions and restoration error
below 0.000046 cm. Snapshot world bounds are cross-checked against node bounds.
These are bounded numeric checks; they do not assess visual distortion or clipping.

These are experimental numeric results. Garment allowance, clipping, materials,
runtime compatibility and full riding-motion appearance still need independent
review. A fitted and weighted candidate is not a cinematic or production pass.
