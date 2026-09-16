# Cinematic upgrade review — 2026-09-16

**CINEMATIC: REWORK. AI VIDEO: BLOCKED.** This is an implemented improvement
and evidence checkpoint, not completion of the user's movie-quality request.
Independent reviewer: `quality_gatekeeper`; integrator: `root`; rider production:
`rider_producer`; resource preparation: `asset_scout`.

## Implemented in the playable UE map

- Elevated highway deck, girders, pier caps, bearings, piers, barriers, joints and
  drainage. City/harbor now sits 18m below road reference height; the roadway is
  actually elevated, with approximately 14.7m under-structure clearance.
- Poly Haven CC0 4K asphalt and concrete color/roughness/normal maps, physically
  scaled tiling and world-aligned concrete. Corrected two rendering defects:
  positional Python Rotator arguments had inverted signs/lights, and instanced
  building/rail materials lacked instanced-static-mesh usage support, producing
  fallback default materials at runtime.
- Authored CarConcept body and four separately pivoted wheels replace enemy
  cubes. Measured dimensions: 480 x 220 x 126.56cm; convoy uniformly scales 1.05.
  Collision, wheel radius/rotation and ground offset now match the imported car.
  Imported graphite clearcoat, glass, PBR texture transforms and normal strengths.
- Kelly wrist/palm targets use measured actual bike grips; hand orientation and
  finger curl replace the old disconnected synthetic-bar fit. Reference-pose IK
  rebuild avoids accumulated rotations; torso counterlean and damped yaw/lean
  accompany smooth lateral movement. Ground alignment uses actual tire bounds.
  Extra seat proxy is hidden for the imported bike; gun barrel aligns forward.
- Larger car bodies and damped motion exposed an automatic-driver regression.
  Added speed-aware avoidance, predictive braking and swept contact-plane sliding.
  Damage, collisions, hit requirements and outcome thresholds remain active.
- Producer/QA instructions now enforce seven separate domains. The schema-2
  integrity gate rejects missing/stale artifacts, wrong build/dependency hashes,
  invalid PNG/video data, video timing gaps and unsupported performance claims.

## Verification and evidence

UE 5.8.1, Windows DX12/SM6, RTX 5070, Core Ultra 7 265K, approximately 32GB RAM.
Evidence stays in ignored `ue/NeonCleanerUE/Saved/Quality/`; private Kelly and
candidate bike are excluded from the public repository.

| Check | Result / artifact |
| --- | --- |
| Editor Development build | PASS; `.local/cinematic-build.txt` |
| Gate 3 map, rig, legacy movement, HUD/capture sanity | ENGINEERING PASS; `.local/cinematic-gate3-run.txt`; 1920x1080 front/side/rear |
| Clean gameplay | PASS: health100, 58.033s, 69shots/68hits, 3zones, convoy disabled |
| Damaged gameplay | PASS: health88, 57.866s, 65shots/65hits, 3zones, convoy disabled |
| Lost gameplay | PASS: timeout95.006s, health100, no hits |
| Python syntax / evidence gate tests | PASS; 10 tests including forged images, stale dependencies, invalid performance and timing gaps |
| Current visual views | `cinematic-gameplay.png`, `cinematic-bridge.png`, `cinematic-establishing.png`, `cinematic-gate3*.png`, `cinematic-hands.png`, `cinematic-handsright.png` |
| Continuous rider sequence | `cinematic-motion-reviewed/`; 360 frames at30fps, 12s, logged frame timing; includes left/right/return/braking |
| Real-time runtime performance | 35.33s retained, p50 16.67ms, p95 16.89ms, max 350.14ms; 1080p, explicit100% screen percentage, dynamic resolution disabled,60fps cap; preserved `cinematic-performance/ue-original.csv` |
| Final machine-readable gate | `cinematic-upgrade-2026-09-16.json`; expected exit2/BLOCKED, not an engineering failure |

Fixed-step screenshots/video prove temporal ordering only. They do not measure
real-time FPS. Wrist proxy error0 does not establish actual palm-surface contact.
The performance p95 meets the numeric target but the 350ms hitch remains a
temporal defect; this is one workstation/route sample, not a broad platform claim.
Gameplay regression uses the real encounter; isolated rider capture bypasses
encounter collisions and cannot certify those by itself. Media playback/fallback
was not changed and was not rerun as part of this visual slice.

## Independent rejection reasons

1. **Environment REWORK:** elevated structure exists, but repeated rectangular
   building masses, blank blue facades, uniform glowing windows, broad orange
   streetlight patches and crushed lower-city shadows still read as a prototype.
   Bridge-side framing needs a clear structural view without foreground occlusion.
2. **Hero assets REWORK:** active low Kelly and low motorcycle remain unsuitable
   for cinematic closeups. Faceting, coarse bakes, shiny cloth and limited face/hair
   detail cannot be solved by adding bloom or more polygons alone.
3. **Rider REWORK:** contact and smoothness improved, but both hand closeups show
   an extreme wrist bend and thin finger chains crossing/clustering under the
   grip. The far hand's natural wrap is obscured/ambiguous. This is a visible
   anatomical failure, not merely missing evidence. Stills/solver endpoints
   do not prove full palm/finger wrap and both feet/seat contact during animation.
   The active motorcycle is one static mesh; visible wheels and fork do not
   articulate. Reviewer decoded/validated the12s video and sampled frames
   0/45/90/180/270/359; this is not full continuous visual review. Braking is
   present, but independent temporal/contact acceptance is outstanding.
   Producer diagnosis: arm reach is valid (47.18cm vs approximately51.3cm chain),
   but horizontal palm orientation differs from forearm by about31 degrees;
   world-direction finger curls ignore grip axis/radius and local joint limits.
   Inspect the three finger chains' skin weights before another pose revision.
4. **Vehicles CONDITIONAL:** authored car and real scale remove cube proxies,
   but dedicated lit/neutral detail views and rolling/steering proof are still
   needed. Sports-concept appearance does not yet establish armored-convoy identity.
   Source UV1 AO is explicitly omitted in the OBJ route; LODs are deferred.
5. **AI handoff BLOCKED:** no approved HUD-free reference pack, full lens/camera
   metadata or accepted first/last frames. Do not generate final continuity footage
   from these rejected references or label it as accepted UE quality.

## Resource status and restoration

- `docs/assets/cinematic-car-source.json`: CC BY4.0 attribution, original URLs,
  hashes, geometry/pivots and material conversion. Car Concept by Eric Chadwick /
  Darmstadt Graphics Group GmbH (2024); logos removed and graphite adaptation.
- `docs/assets/cinematic-surfaces.json`: Poly Haven CC0 URLs/hashes/import paths.
- `docs/assets/hero-resource-audit-2026-09-16.md`: high Kelly source is present,
  but 47 referenced production images and XGen dependencies are absent. Replacing
  the active mesh alone would lose textured identity. Reconstruct materials/groom
  or restore the dependencies before identity-tested activation.
- Private high-bike candidate imported separately: 799,914 triangles, 4K PBR,
  230cm length. It is a connected, unrigged mesh. Needs inspected wheel/fork
  separation, geometry/tangent cleanup, LODs, rider refit and source-rights audit;
  neutral material/exposure review is also unresolved. It has **not** replaced
  the active motorcycle.
- Local city FBX has333 geometries but only one material/no texture references;
  source restoration needs correct per-building material mapping. Do not claim
  this downloaded geometry is a finished textured city.
- Commandlet lacks StaticMeshEditorSubsystem: car/bike import retains LOD0 and
  logs deferred reduction. Use a full-editor production pass for verified LODs.

## Reproduction and next production work

Run source preparation with Python containing numpy/Pillow:

```powershell
python tools/assets/fetch_cinematic_surfaces.py
python tools/assets/prepare_cinematic_car.py
.\ue\Invoke-NeonUE.ps1 -PythonScript .\ue\scripts\import_cinematic_car.py -LogName cinematic-car-import
.\ue\Run-Gate3QualityCheck.ps1 -FullVisualQA -RiderPoseVerdict CONDITIONAL
```

For the private bike candidate, run `tools/assets/prepare_cinematic_bike.py`, then
`ue/scripts/import_cinematic_bike.py` and `create_cinematic_bike_review.py` through
the same serialized UE launcher. The chase map and active bike remain separate.
Imported CDO-referenced material graphs are immutable/versioned; bump graph version
when changing a rooted shader rather than deleting its expressions.

Continue production in this order: mechanically rig a detailed motorcycle and
refit Kelly contact/animation; restore or author high-Kelly materials/groom; replace
foreground modular box architecture with properly textured detailed structures;
relight with neutral material review first; complete vehicle armor/LOD views;
capture and independently review all current-build cinematic domains. Downloads
and routine restoration remain authorized; do not reopen download confirmation.

Refresh evidence only after the final build/map/material pass. Bind new evidence
to canonical DLL/map hashes and the full dependency fingerprint. A script cannot
provide the missing art judgement; the next reviewer must visibly inspect it.
