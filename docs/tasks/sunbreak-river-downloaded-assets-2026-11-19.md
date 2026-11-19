# Task Packet: sunbreak-river-downloaded-assets-2026-11-19

- State: LOCAL WIP INTEGRATED; limited art CONDITIONAL PASS; public/AAA release BLOCKED
- Owner: root integrator; branch codex/character-continuity-pipeline
- Baseline: 96cc959e2f6fdd68e4efd0c65acc0c05a2a99c63
- Worker budget: two asset inspectors/producers, independent engineering and art reviewers.
- Authorization: user-supplied asset inspection, local conversion and map dressing; normal source checkpoint. No purchase or public redistribution of unverified assets.

## Objective

Use suitable assets from the user's Downloads to enrich Riverfall with natural
vegetation, scanned ruin detail and believable settlement surroundings. Preserve
prior demos, combat routes, doors, terrain supports, weapon and NPC animation.
AAA remains a target, not an accepted result.

## Dependencies and risks

All-origin fetch completed; HEAD matches origin. Startup private restore is
blocked by pre-existing dirty vault; preserve it. Newly untracked
ue/NeonCleanerUE/Content/Modular_Rural_Cabin is user-owned Marketplace-looking
content: inspect read-only and exclude from public commits. No UE dependency is
needed for browser production. Prior storm hitches and continuous-motion gate
remain BLOCKED/UNVERIFIED. Downloads licenses must be verified before release.

## Scope / write set

- Root: experiments/sunbreak-river-v4 runtime integration, local-only asset
  serving allowlist, manifests, QA, task/handoff/worklog and .gitignore.
- Conversion producer (after gate approval): tools/import-downloaded-assets.py
  and ignored .local/river-downloaded-assets only. Original downloads read-only.
- Placement producer (after gate approval): downloaded-dressing.js and
  qa/downloaded-dressing-checks.mjs only; no shared runtime/status edits.
- Independent reviewers read-only. Serialized GPU captures by root.
- Explicit task lease acquired before production.

## Plan

1. Inventory formats, source IDs, embedded license text, triangles, dimensions,
   materials and LODs; inspect actual offscreen asset/map renders.
2. Convert selected economical LODs with PBR maps, alpha cutouts and correct units
   to local GLB derivatives. Prefer scanned grass, rubble, stone and selected
   willow; reject stylistic/structural mismatch or unbounded cost. No raw asset
   goes into public Git. Unknown-license materials remain local preview only.
3. Deterministic irregular clusters and matched gameplay footprints. Preserve
   roads, crossings, sightlines, doors, spawn clearance and solid/support contract.
   New large silhouettes remain outside playable bounds unless exact collision
   and shot correspondence are proven. Do not simply stack all packs.
4. Optional local manifest endpoint serves only explicitly inventoried local
   derivatives; public package excludes them and retains baseline fallback.
   Bind evidence to actual local manifest/asset bytes; do not claim source-only
   checkout contains the imported assets. Record repeatable restoration.
5. Current CPU and native-headless WebGL controls/cabins/traversal tests, close
   and wide images, source identity, missing-asset fallback and public package
   checks. At least one sunny and two storm 30s strict benchmarks after 10s
   declared warmup; retain failures, no retry-until-pass.
6. Independent engineering and art verdict, accurate QA/handoff, scoped source
   commit/upload; no Pages promotion or AAA acceptance without real evidence.

## Acceptance

- Asset choices and exclusions justified by actual inspection, not filenames.
- New details sit on plausible ground, share scale/light/fog and do not form rows.
- No giant/tiny models, missing maps, alpha squares, metallic stone or blocked doors.
- Combat/layout and prior demos preserved; no new invisible or penetrable cover.
- Performance/resource budgets measured and reported; strict failures retained.
- Licenses, local-only dependencies and restoration are explicit; no restricted
  asset source uploaded to public Git or packaged for Pages.
- Independent QA verdict required; unknown/missing evidence cannot pass.

## Review decision

Descartes PASS TO IMPLEMENT. Caps: <=8 families, <=25MB imported bytes,
<=500k added visible triangles across all instances, <=60 added beauty draws.
Measure shadow/reflection cost and texture memory separately. No new large
playable silhouettes; wall skins require visible cover correspondence, not just
containment. Public fallback remains functional. Existing release stays BLOCKED.

## Result

The optional local layer uses 12 GLBs from 7 families (12,862,004 bytes):
six grass variants, three mossy stone-wall fragments, two cement-rubble LODs
and one optimized woodland house. Original user downloads remain read-only.
The 69MB house was reduced to a 3.68MB, 22,041-triangle, 10-material derivative.
No user mesh or old demo was overwritten.

Final deterministic layout, revision `downloaded-scans-local-v2`:

- Two peripheral houses at (-12,-40.5) and (12,33), overall height 6.126m.
  The source opening is approximately 2m after scaling. These are static
  scenery outside combat bounds, NOT new enterable/door-interactive houses.
  Existing interactive houses remain unchanged. Tree clearance and footprint
  grounding were measured separately from the visible static review.
- Six wall fragments form two irregular peripheral ruined boundaries; two
  larger rubble patches remain outside playable space.
- Twenty-two micro-debris patches follow actual plaster-ruin margins.
  Source geometry is uniformly scaled, max height 2.6cm, buried 6mm and tinted
  toward local earth. 16,874 transformed vertex samples have maximum visible
  gap 1.9512cm against terrain/ruin support; the existing 3cm tolerance is unchanged.
- 429 mixed grass clumps; the 11 darkest dry-stem variants are woodland-only.
  Green low grass follows idle ground/foundations and avoids roads, doors,
  crossings and spawn clearance. No new colliders or shot-cover geometry.

Measured added cost: 349,364 triangles and 39 base-pass draws, down from
449,271/42 before the second art revision. Shadow submission adds up to 75,082
triangles/28 draws; reflection can submit the imported layer again. Texture
storage estimate with mipmaps is about 145.4MB (not measured GPU VRAM).
Original fixed acceptance caps were not raised.

## Assets deliberately not used

- Willow USD supplied constant-color materials without PBR texture maps.
  No invented substitute texture was presented as the user's supplied scan.
- `base_mesh.glb` is a 105.98MB rigged character/armour/weapons asset, not scenery;
  no animation and likely broken rest binding. Existing NPCs were preserved.
- `Modular_Rural_Cabin` contains native UE Marketplace content, not directly
  browser-ready. Its exact folder is ignored in public Git and left untouched.
- All imported licenses remain UNVERIFIED. Possession is not proof of a public
  redistribution grant; the optional pack is loopback-only, outside public output.
- Normal-map convention is recorded as source unchanged, not fully certified.

## Current QA

Protocol: `offscreen-cinematic-v1`, native-headless actual WebGL canvas; no
desktop capture, focus or clicks. This is browser rendering, not UE5 rendering.

- All 16 CPU suites PASS, including 20 downloaded-dressing checks.
- Current v2 browser checks: imports 3, controls 32, cabins 17, traversal 54,
  weather 4 and disabled-pack fallback 2: all PASS. Runtime and actually consumed
  local bytes are bound by hashes; missing/changed optional packs fail closed
  to the baseline instead of preventing play.
- Final visual pack: `qa/evidence/imported-assets-2026-11-19T07-07-39-075Z`.
  Independent art reviewer opened all nine map views at original size:
  CONDITIONAL PASS for this local asset integration. Minor sparse-leaf/isolated
  clump transitions and rounded micro-rubble outlines remain. AAA target REVISE;
  continuous motion UNVERIFIED. Earlier rejected captures remain preserved.
- Engineering source review conditionally accepts WIP; collector independently
  distinguishes active imports from diagnostic disabled runs, requires exact
  capture/check coverage, source/evidence identity and workload/timeline checks.
- Final 1920x1080, 10s warmup + 30s combat/reload benchmarks all FAIL:
  sunny p95/p99/max = 35.6/36.4/89ms (10 frames >50ms);
  storm A = 35.7/36.8/71.4ms (8 >50ms);
  storm B = 35.8/36.8/71.3ms (11 >50ms).
  No threshold relaxation or retry-until-pass. Earlier source and diagnostic
  results are retained, not substituted. The prior dressing-off diagnostic
  p95 18.3ms supports investigating layer cost but does not identify the cause.
- Actual fresh public packaging checked 89 files, 12 imported GLBs excluded by
  names and content hashes, all 103 shared dependency hashes unchanged. No Pages
  deployment. Full package and companion hashes are pinned in canonical QA.

## Private backup and recovery

The 12 GLBs plus exact manifest were uploaded to the existing PRIVATE repository
on `work/sunbreak-river-downloaded-assets-2026-11-19/c962db33`, acknowledged commit
`cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407`. A new empty LFS cache fetched all remote
payloads and matched each SHA256. Pointer: `qa/downloaded-private-backup.json`.
This backs up selected browser derivatives only, NOT source archives, conversion
receipts or the entire UE project. Existing dirty canonical vault/lock untouched.

To restore on an authorized PC:

```powershell
python experiments/sunbreak-river-v4/tools/backup-downloaded-assets.py restore
node experiments/sunbreak-river-v4/serve.mjs
```

The tool pins the approved Git/LFS destination, rejects redirected roots and
modified local files, and uses exclusive creation. It will not overwrite edited
imports. The original failed long-path clone and later partial-object clone
remain local for recovery; no user data was deleted. A full-object sparse
checkout resolved both issues. Public source alone intentionally lacks these GLBs.

## Handoff / next action

Playable local preview: http://127.0.0.1:5190/river/ ; add `?dressing=off` for
the unchanged baseline comparison. This is a local WIP checkpoint, not final AAA.

Next: profile draw/fragment/reflection cost of the optional layer; implement
spatial culling/LOD where measured useful. Improve low-grass transitions and
break micro-rubble outlines before increasing density. Confirm asset licenses
before any public release. Require new current-build performance and continuous
motion evidence; global terrain/building/mountain quality remains below target.

Rollback is a scoped source revert or `dressing=off`, with original downloads
and all prior demos retained. Mandatory source/evidence checkpoint upload follows
the staged scope audit; final remote acknowledgement is recorded by the sync tool.
