# Task: sunbreak-user-house-2026-11-17

- State: QA
- Owner: main Producer, single writer
- Created: 2026-11-17
- Branch: codex/character-continuity-pipeline
- Baseline: 4d3bd53dfdd60848ce2239129d39fd5068336c5e
- Gate: bounded browser-demo manual asset roundtrip, not UE cinematic acceptance
- Worker budget: two read-only reviewers; no other writers
- Authorization: user asks to see their manually edited house in the game;
  standing normal source/LFS/Pages checkpoint publishing applies.
- Remote lease acquired for v3, this task and worklog.

## Objective

Display the user's actual saved Blender house edits in v3, proving manual art
control without changing v1/v2 or combat.

## Intake evidence

Supplied GLB and all11 supplied texture images are byte-identical to the previous
release. GLB SHA256:
0654a24a53d29399de64234545ee6fea0c0f7d6b274faaa1cab74b162253b5e9.
Adjacent `F:/AIshootgame/timber-house/timber-house-editable.blend` was saved later
and has real edits. Background Blender inspection found1398 objects, unchanged
transforms/parents, with:

- Foundation_part_0001/0002: corner-face bevel geometry, same overall bounds.
- Foundation_part_0075: an additional low block beside/in front of bottom stair.
- DoorHandlePlate: FoundationPlaster replaces aged-brass material.
- FoundationPlaster: one image-node association changed Image_0 -> Image_1.
- Packed Image_4: actual yellow Hello / red scribble paint, retained. Packed
  Image_1 changed encoding but decoded pixels are identical. External supplied
  textures remain unchanged; using them alone would lose the user's paint.

The user's originals remain read-only. No false "edited GLB imported" claim.
Startup fetched all branches and LFS, but existing unfinished private-vault
changes stop private restore. Preserve them. This public browser slice has no
private/UE dependency and does not compensate by rebuilding private production.

## Scope / write ownership

Main only:

- experiments/sunbreak-storm-v3/authoring/user-house-2026-11-17/
- reviewed runtime house GLB/contract and a tightly bounded local stair-floor
  update only if needed to match the user's additional low block
- new import/audit/QA tools and evidence with user-house prefixes
- browser harness options, house-view QA hooks as needed
- v3 README, task, immutable worklog, finish-appended handoff
- existing build/Pages workflow, without new Sites provisioning

Read-only: user F: originals; previous authoring kit/evidence; v1/v2; combat,
NPC, weapon/arm, audio/weather and UE/private assets. Reviewers have no writes.

## Plan / rollback

1. Preserve exact saved user project as a new source artifact, inspect/export a
   candidate in background Blender without resaving or altering the source.
2. Compare every named part against baseline. Retain strict20um/oriented
   surface validation. Update only the three explicitly audited structural
   records, not the tolerance or generic importer. Review bounds, winding,
   surface coverage, walk height and exact collision footprint first.
3. Integrate GLB and matching reviewed contract atomically. Keep previous kit
   and runtime fallback available. No autonomous aesthetic redesign.
4. New source-bound runtime/negative mutation tests and1920x1080 actual canvas
   before/after views; exercise doors, stairs, interior, combat and public load.
   Separate30s real-time performance sample with raw attempts retained.
5. Independent engineering and bounded art QA; only after acceptance checkpoint
   source, publish through normal protected-main PR, verify anonymous hashes.

Rollback is a normal scoped revert of this slice, never destructive checkout.
Original authoring kit and historical QA remain byte-exact.

## Acceptance

- [x] Exact user source is preserved, original F: files unchanged.
- [x] Rendered asset contains the user's four changed object assignments/meshes.
- [x] No unexplained part/transform/material/UV changes.
- [x] New structural records are individually audited; importer still rejects
      arbitrary deleted/reversed/moved structural geometry.
- [x] Door, walk surface, interior lights and tactical gameplay regressions pass.
- [x] Current representative canvas views show the actual edits; this is not a
      full continuous visual/animation review.
- [x] v1/v2, combat/player module and weapon remain exact.
- [ ] Current30s1080p real-time sample, independent scoped QA and actual live
      release verification are recorded without recycling old PASS evidence.

## Review / results

Gatekeeper Planck: PASS TO IMPLEMENT read-only source export; subsequently
PASS TO INTEGRATE exact candidate a9be9861675c1231e7a2fb4848bb61b8b78bb3d4a9d5fdd98182d668ae167c43,
conditioned on strict candidate contract validation before swap and final QA.
Explicitly approved three below-floor foundation edits and low-step support;
no generic importer tolerance relaxed. User paint/shared material repetition
is the intentional control proof, not an art-direction failure.

## Local evidence

- Source `.blend` SHA256:
  bf6ac17ae69835ad8f54e20c5c90b6c0610e43924a95b2e9095a29e7c1b6a2a8.
  Exact copy: v3 authoring/user-house-2026-11-17/timber-house-user-source.blend.
- Actual exported and loaded GLB SHA256:
  a9be9861675c1231e7a2fb4848bb61b8b78bb3d4a9d5fdd98182d668ae167c43.
- Source audit: same folder/source-audit.json.1398 objects,1372 full-UV meshes,
  1368 unchanged complete mesh records;4 expected object changes. UV arrays read
  only after flushing the saved EDIT_MESH state in memory.
- Packed Image_4 contains real handwritten Hello/red paint (167896 changed
  channels); actual GLB embeds those exact image bytes and uses them on all three
  Timber variants. Image_1 has identical decoded pixels despite encoding change.
- Three Foundation contract records explicitly updated. All other1369 structural/
  cosmetic records retain old values. Generic importer is byte-exact to baseline,
  including20um tolerance and oriented triangle checks. Original contract still
  rejects edited geometry until the reviewed revision is provided.
- New low block top0.07477977m matches actual mesh down-ray and narrowly bounded
  walk support. Existing room/door/rails/collision rules unchanged. Foundation1/2
  preserve original broad envelope with two small below-floor side corner cuts;
  do not mislabel them as a fully watertight bevel.
- Preservation19, unit33, actual-browser roundtrip36, house47 and tactical24 PASS.
  Source-bound evidence: qa/user-house-contract.json, user-house-unit.json,
  user-house-checks.json and user-house-evidence/.
- Before/after six1920x1080 actual game-canvas views each:
  qa/user-house-before-evidence/ and qa/user-house-after-evidence/.
  User paint appears on interior/exterior timber, ceiling, floor and furniture;
  repeated shared texture is intentional, not a unique-decal workflow.
- Performance attempt1 retained:30.0102s, p95/p99≈18.4/18.6ms, one568.5ms hitch
  at19.8564s. Cause unknown. Same-source attempt2:30.0095s, p95/p99≈18.3/18.6ms,
  max18.7ms, zero>50ms and zero audio errors on RTX5070 nativeD3D11.
  Repeat3 also PASS:30.0122s, p95/p99≈18.4/18.5ms, max42.8ms, zero>50ms/audio
  errors. Final two consecutive samples pass; no universally hitch-free claim.
- Independent Planck final engineering PASS for this manual-import slice.
  Tiny float seam/full continuous walkthrough coverage limitations retained.
- Independent Zeno art PASS: all six paired before/after views inspected, user
  Hello/red paint, new step and plate visible; no confirmed unexpected import/UV/
  texture/shader loss. Minor plinth-corner dark facet remains an authored-versus-
  export ambiguity, not a confirmed import failure. No continuous visual claim.
- Current local source/art checkpoint accepted; actual public release verification
  remains pending.
