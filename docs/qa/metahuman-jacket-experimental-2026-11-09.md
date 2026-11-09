# Independent review — experimental MetaHuman leather jacket

Verdict: **PASS as experimental skinned import candidate; HOLD for production,
cinematic and AI video.** No visual acceptance, runtime rider replacement or
full MetaHuman assembly was reviewed or claimed.

The independent reviewer checked all seven file hashes and sizes in the root-only
Max validation manifest and verified that the original saved character, source
jacket and body fitting reference retained their recorded hashes. A fresh Max
FBX reimport preserved all 342 reference skeleton names with a parentless root;
Skin uses 64 bones for 2,521 vertices, with no zero/non-normalized weights and at
most five influences. Four isolated 12-degree upper/lower-arm rotations moved
230–660 vertices; all positions were finite and restoration error was below
0.000046 cm. These are bounded numeric tests, not anatomical or seated-pose proof.

An isolated UE5.8.1 import of the corrected root-only FBX exited successfully.
Fresh-process reload verified the saved skeletal mesh references the expected
MetaHuman body skeleton and leather material. Actual reference-pose matrices,
final assembled-body compatibility, rendered deformation and appearance were
not checked. UE reported missing FBX smoothing groups and an Interchange path
length warning. Inspect normals/tangents and specular shading before acceptance.

The Max reimport validator catches exceptions without rethrowing. This run has
an explicit numeric success marker and no report error, so the recorded numbers
are usable. Future automation must check that marker and report, not only the
process exit. The top-level private `jacket-fit-status.json` describes the
earlier failed Skin Wrap attempt; use the root-only validation manifest for the
new candidate. Existing failures remain in the worklog for traceability.

Next gate: assemble the actual user character after Epic authorization, render
front/side/rear and shoulder/armpit/elbow/hem views, then inspect continuous
seated riding and hand contacts. The scripted riding scenario starts braking at
14 seconds, so a 12-second capture cannot verify braking; use at least 18 seconds
or explicitly change and log the test scenario. Separately validate input and
frame time. Do not replace the existing rider until these checks are satisfied.
