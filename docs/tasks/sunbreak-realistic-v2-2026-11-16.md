# Task Packet: SUNBREAK realistic v2

- Task: sunbreak-realistic-v2-2026-11-16
- State: REWORK for reference quality; playable PBR milestone CONDITIONAL PASS.
- Baseline: 35a42e9; original experiments/sunbreak-fable52 remains unchanged.
- Scope: isolated browser FPS visual upgrade; gameplay fixed.
- User requested autonomous implementation and independent agent quality review.
- Lease: experiments/sunbreak-realistic-v2, this packet, docs/handoff.md.

## Plan and ownership

Root integrates environment, render pipeline, weather, server, tests and evidence.
Asset worker owns assets/ and assets-manifest.json. Weapon worker owns weapon.js
and weapon-provenance.json. Read-only Gatekeeper reviewed original gameplay and
approved separate visual meshes with unchanged collider/raycast proxies.
No worker may mutate another write set or commit independently.

## Benchmark

User post: https://x.com/wquguru/status/2120382704030261437
Actual game: https://wquguru.github.io/fable52-fps-repro/demos/04-fps/
Observed rendered reference: textured damp substation, layered structure,
ground reflections, visible material variation, volumetric light accents.
Its claims of AAA-level quality are not independent certification.
New work targets those concrete qualities in the existing outdoor courtyard.

## Hard invariants

Preserve original collision proxies and shot occlusion, six spawn positions,
movement, weapon damage/spread/cooldown, ammo/reload, AI, game outcomes and
controls. Weather uses independent seeded random values and render state.
No new blocking architecture in traversable lanes; visual upgrades remain
aligned to existing collision. No use of UE private or Marketplace assets.

## QA gates

- Compare baseline gameplay source sections and collider/raycast metadata.
- Run original 19 synthetic checks plus weather/render-state preservation.
- Inspect actual current-build daylight and rain frames, ground/weapon closeups.
- Independent art review: proportions, cartoon drift, visual impact, materials,
  detail priorities. Reject box/block placeholder foregrounds, black crush and
  fog concealing missing detail. Reference parity requires visual evidence.
- Check console errors, assets/license manifest, frame-time measurements.
- Distinguish engineering PASS, art verdict and unverified motion/performance.

## Checkpoint policy

Use normal commit/push after inspected scope; isolated code-only checkpoint,
SkipPrivateAssets. No UE changes or full UE portability claim. Preserve raw
model streams privately/excluded. Update actual result/blockers before handoff.

## Implemented checkpoint — 2026-11-16

Separate runnable version: `experiments/sunbreak-realistic-v2/`.
Preview: `http://127.0.0.1:5187/`.
The original SHA256 remains
`4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85`.

- Local CC0 Poly Haven PBR surfaces and HDR environment; asset hashes verified.
- Shadow maps, ACES, SSAO, SMAA, masked planar puddle reflections, weather
  states, foliage/rain motion and world-aligned weapon lighting.
- Recessed windows, roof geometry, facade detail and background buildings.
- More detailed but still procedural weapon/hands and enemy visuals.
- Removed the black pavement grid and fixed wall UV restart/bevel seams after
  independent art rejection. No original collision, shot proxy or AI changes.

## Current-build QA

Evidence is retained under `qa/evidence/`; every capture/report is bound to
the frozen build hashes. `qa/release-report.json` records 65 engineering
checks PASS. These include:

- Original synthetic gameplay fixtures: 19/19 PASS.
- Independent runtime geometry/raycast/state/weather invariants: 217/217 PASS;
  no global random-number consumption by the visual layer.
- Static gameplay comparison, semantic proxy contract and mutation self-tests:
  PASS. Original 18 collision/raycast proxies preserved.
- Eight actual WebGL captures: nonblank, assets loaded, source hashes match.
  390x844 layout stays within viewport; no mobile controls/performance claim.
- 1920x1080 rain real-combat benchmark: 30.0164 seconds, P95 about 16.8 ms,
  P99 about 16.8 ms, maximum about 17.2 ms, zero frames over 50 ms,
  two natural outcome restarts. NVIDIA RTX 5070 through ANGLE/D3D11.
  All measured frame samples retained; this is automated combat, not a human
  full playthrough or a continuous subjective animation review.
- Browser warning/error log was empty in the final test and benchmark checks.

Independent gameplay reviewer: Lorentz. Independent final visual reviewer:
Newton on Gateway GPT-5.5. See `qa/gameplay-review.md` and `qa/art-review.md`.
Playable PBR style demo: CONDITIONAL PASS. Reference-quality realism: REWORK.
No UE cinematic, private-asset or AI-video gate is changed by these results.

## Remaining limits and next concrete action

The weapon/hands, simplified soldiers, repeated architecture and basic rain/
puddle response remain below the reference. Do not call this photorealistic,
AAA or reference-parity complete. Next: replace the near-camera procedural
viewmodel and enemy render assets with licensed production-quality PBR meshes,
preserving the current muzzle/hit/collision contracts; then rerun the same
current-build engineering and independent visual gates.

Inherited baseline limitation: upper crates at (-6,2), (8,8), (0,-12) do not
block shots or movement. This was deliberately preserved, not silently fixed
during a visuals-only task. Thin decorative projections are render-only.

Gateway route was successfully exercised; the personal-account route still
returned quota errors. No global account/model settings or credentials were
modified or added to this checkpoint. No external weapon mesh was integrated.

## Cross-PC scope

Start-of-session fetched all origin branches and preserved the active branch.
Private restoration stopped on unfinished local vault changes, which remain
untouched. The browser experiment uses no UE/Fab/private assets. This is an
explicit isolated browser-code/public-CC0 checkpoint with `-SkipPrivateAssets`,
not a claim of full project asset portability. Final publication must include
this task packet, handoff, current-build QA and an immutable worklog event.
