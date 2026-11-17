# Task Packet: sunbreak-tactical-public-2026-11-17

- State: VALIDATED_FOR_DEMO / PUBLISHING
- Owner/integrator: main Producer
- Branch: codex/character-continuity-pipeline
- Created: 2026-11-17
- Worker budget: two disjoint implementation workers plus one read-only reviewer
- Human approval: already authorized changes and public GitHub playable hosting

## Objective

Upgrade v3's six NPCs with cover-oriented placement/behavior and blended skeletal
movement/aim/fire feedback; give the cabin a black tiled roof and visible puddle
rain impacts; publish a genuinely public playable GitHub link for friends/demo.

## Scope and boundaries

The user now explicitly authorizes changed NPC spawns/AI. The earlier exact
enemy-loop preservation contract is superseded ONLY for this v3 slice. Preserve
player input, weapons/damage/ammo/reload rules, architecture and player collision,
working cabin door, earlier wood UV fix and all v1/v2 bytes. No multiplayer claim.
Use existing licensed public assets and authored effects. No private/UE assets,
paid services, photoreal/UE5 parity or final cinematic acceptance claims.
Start fetched all origin branches; source clean. Unrelated dirty private vault
still blocks private restore; preserved. Public browser slice has no dependency.

## Plan and acceptance criteria

1. Six spread-out defended roles; cover selection based on real collision/LOS,
   navigation around obstacles, bounded think/raycast work, time-staggered peeks
   and bursts, return to cover/reposition. No shooting through walls. Player
   hitboxes must reflect NPC stance; dead/paused/menu units cannot act.
2. Movement-speed-driven leg/knee/ankle/hips motion, torso aim, recoil, muzzle
   flash and smooth crouch/peek blending. No stiff leg-only pendulums.
3. Cabin roof visibly black tiled with courses, ridge/edge detail and wet rough
   highlights, keeping building shape/collision and door behavior.
4. Raindrop impacts only where wet field/ground permits, airborne droplets and
   varied-radius expanding/fading ripple rings; dry weather disables impacts.
   Freeze coherently when paused/presentation requires; no cover/house flooding.
5. Deterministic unit and actual-browser regression, current-source canvas and
   temporal samples, independent bounded QA. Preserve historical reports.
6. Build only sanitized static game files and preserved comparisons; no private
   sources, credentials or diagnostics. Public URL must return actual game,
   dependencies and playable behavior, not repo view or localhost.
7. Verify Git upload and public hosting separately. Report any service blocker
   honestly rather than claiming source upload equals website publication.

## Write ownership

- Main only: index.html, tactical-ai.js and integration hooks in world.js,
  serve.mjs, qa-hooks.js, tools/, README.md and new qa/tactical-* files/evidence.
- Actor worker only: actors.js and new qa/tactical-actor-* files.
- Environment worker only: storm.js, timber-house.js and new
  qa/tactical-environment-* files. No geometry/collision changes except cosmetic
  roof geometry; preserve corrected timber UVs.
- Main only: .github/workflows/sunbreak-pages.yml if required, this packet,
  new docs/worklog event; handoff append only via finish script.
- Main only: public main-branch sunbreak/ static output; preserve existing
  root/web Neon Cleaner Pages entry. Existing Pages already serves main:/.
- Reviewers: read_only=true, no Git, publishing, browser UI or shared-file writes.
- v1/v2, private assets, UE and historical QA: read-only.

## Publishing decision

User specifically requests GitHub public hosting. Inspect existing Pages setup
and credential capabilities; prefer a dedicated static publishing branch or
minimal Actions workflow without altering unrelated website content. Prior Sites
provider creation failed terminally with no site ID; do not create duplicate Sites
or change speculative slugs. No .openai/hosting.json exists for this game.

## Review/result

- Gatekeeper: Planck PASS TO IMPLEMENT; verify stance hitboxes, actual LOS,
  pause/death and temporal behavior, public allowlist/license and real URL.
- Implementation: six defended roles, real obstacle A*, cover/peek/burst/retreat,
  raised indoor guard, stance hitboxes, weapon-aligned actual-shot approval,
  procedural 88-joint skeleton with planted-foot/grip IK and shot recoil.
  Black tiled cabin roof (723 tiles/27 ridge caps); 360 wet-field rain impact
  locations with varied rings, softened translucent crowns and droplets.
- Player contract: 9/9 exact restoration/negative-mutation checks PASS against
  `2f116226e4bd`; v1/v2 tracked sources untouched. Player weapon/audio/house logic
  sources unchanged. AI, actor and environment numerical checks: 10/19/16 PASS.
- Actual browser: 24/24 tactical checks PASS (includes real production shot
  callback, muzzle direction/effects, closed/open cabin guard); house 47/47 PASS.
  Final loaded-source-bound roof, three NPC and three rain canvas samples plus
  regressions collected: `qa/tactical-release-report.json`, engineering PASS.
- Performance: first untrimmed 30s actual 1080p combat/audio run on RTX5070:
  p95 18.2ms, p99 18.5ms, maximum160.6ms with one >50ms hitch. STRICT FAIL retained,
  not attributed to roof raycasts without measurement. Final-source 30s rerun
  PASS: p95/p99 16.8ms, max50ms, zero>50ms, 1797 frames, five sounds ready and
  zero audio errors; raw runs both retained. No threshold was weakened. Earlier
  hitch cause remains unresolved; overall bounded demo verdict CONDITIONAL PASS,
  not a blanket smoothness/hardware certification.
- Visual review: representative native-asset and scene samples, not full
  continuous review. Art precheck caught white geometric crown splashes;
  reworked to smaller translucent softened sheets and subtler broken rings.
  Independent Zeno roof/rain art PASS (medium confidence, three frames/state).
  Planck read-only engineering CONDITIONAL PASS; known source blockers closed.
- Publishing: existing legacy GitHub Pages serves main:/. Sanitized static build
  will be added only under `sunbreak/`, preserving pinned root/web entries.
  Each staged Git blob and complete subtree whitelist are verified before push;
  anonymous live asset hashes and browser gameplay remain separate acceptance.
- Private snapshot continuity: pre-existing dirty private vault preserved;
  this browser-only checkpoint skips private transfer and makes no full UE
  cross-PC asset-portability claim.
- Next: upload validated source checkpoint, publish static subtree, verify
  anonymous playable URL/all assets and retain public receipt.
