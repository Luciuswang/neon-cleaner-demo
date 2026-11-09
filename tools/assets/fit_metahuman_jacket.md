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

The executed geometry experiment preserved 2,521 finite vertices and deformed
1,151 sleeve vertices, but Skin Wrap evaluation returned zero control points and
created no Skin. The saved unskinned and failed-wrap scenes are diagnostic assets.
No skinned candidate, clipping review, animation verification or visual acceptance
exists.

Actual portable Max batch testing on 2026-11-09 fixed the catch syntax, argument
key type and Windows path escaping. The forward-slash fixture reached fitting,
preserved both experimental scenes, then failed closed with Max exit -130 and
runner exit 1. Its driver list remained at one item before/after reset, but the
body had no Skin. A separate fresh fixture explicitly set/read back `Skin=true`
and `Mode=#create`: the body already had zero modifiers **before** jacket import.
It stopped at the new required-body-Skin assertion without importing the jacket.
This differs from an earlier inspection of the identical body FBX that found Skin;
the importer/context discrepancy remains unresolved. Neither failure is acceptance.
The script checks body Skin both before and after the jacket import. Existing
candidate files were preserved; each test used a fresh output directory.
