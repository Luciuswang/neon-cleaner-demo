# Character Continuity - Day 2 UE Plan

## Objective

Turn the Day 1 PC prototype into a character-continuity testbed:

```text
AI cinematic bridge -> UE Lin Xia rider proxy -> matched gameplay camera
```

The Day 2 goal is not final character art. The goal is to prove that a UE
character source can drive AI video references and then cut back into gameplay
without identity shock.

## Current UE Starting Point

- Project: `ue/NeonCleanerUE/NeonCleanerUE.uproject`
- Startup map: `/Game/VehicleTemplate/Maps/VehicleExampleMap`
- Bridge movie: `Content/Movies/NeonCleaner_A0_Bridge.mp4`
- Bridge system:
  - `UNeonCinematicBridgeSubsystem`
  - `UNeonCinematicBridgeWidget`

## Day 2 Tasks

1. Create `BP_LinXia_RiderProxy`.
   - Use a simple skeletal or static placeholder if MetaHuman is not ready.
   - Lock silhouette: black rider body, short dark hair mass, restrained magenta
     coat / bike accents.
   - Avoid stock mannequin colors.

2. Create `BP_NeonMotorcycleProxy`.
   - If a true motorcycle rig is not ready, replace the visible stock car body
     with a motorcycle-shaped proxy while keeping vehicle controls.
   - Keep wheels grounded and scale believable.

3. Add a cinematic handoff camera.
   - Rear three-quarter angle.
   - Low rider-height position.
   - Same forward motion direction as A0-S04.
   - Rain/night color target.

4. Capture UE identity references.
   - Save to `source/reference/linxia/ue-captures/`.
   - Capture turntable, rider pose, and handoff camera match.

5. Replace the bridge movie only after the UE handoff frame exists.
   - The AI clip should end on a frame that the UE camera can reproduce.
   - Use rain splash, glare, overpass shadow, or vehicle occlusion to hide the
     exact cut.

## MetaHuman Track

When UE 5.8 / current MetaHuman tools are available:

1. Build Lin Xia as the source-of-truth character.
2. Use Mesh to MetaHuman or MetaHuman Creator for the identity pass.
3. Use Control Rig / Sequencer for standard rider poses.
4. Use MetaHuman Animator or Live Link Face only for close-up movie beats.

Until that is ready, keep gameplay shots behind/side/rear-biased.

## Test Scene Success Criteria

- Startup video still plays and hands input back correctly.
- First gameplay frame shows a rider / motorcycle silhouette, not a stock car
  identity.
- Handoff camera direction matches the bridge movie ending.
- Player can immediately drive after `Take Control`.
- The image reads as Neon Cleaner: rain, wet road, cold blue-gray lighting,
  restrained magenta signal, post-war chase tone.
