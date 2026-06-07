# Marble A0/I1 World Prompt

Use this for the first real Marble world export for `Neon Cleaner`.

The goal is not to create a full movie shot. The goal is to create a navigable world that can support a seamless transition from cinematic video into playable chase control.

## Copy Prompt

```text
Create a photorealistic, navigable 3D world for an interactive cinematic game sequence.

Scene: post-war future San Francisco at night after heavy rain. The environment should feel like a major city that survived a large battle only hours ago: damaged high-rises, broken elevated rail sections, scorched overpasses, smoke columns, ruined drones, emergency lights in the distance, wet reflective asphalt, cold mist, ash in the air, and scattered debris.

The main playable space must be a clear road-level combat chase route, designed for a player to take control after a movie cutscene. Start the world from a road-level chase perspective looking forward down a wide three-lane urban street. Keep the center lane and at least one side lane drivable and readable. Put wrecked vehicles, broken signs, collapsed barriers, sparks, and debris mostly along the sides, not blocking the entire route. Add several natural gameplay beats: a near-miss obstacle zone, a broken elevated rail overhead, a smoke-and-fire occlusion area for a movie-to-play transition, a wider intersection for branching choices, and a distant armored convoy route.

Make the space feel like San Francisco without relying on readable text: steep urban street grade, cable-car-like rail grooves in the wet road, dense downtown towers, a damaged suspension bridge silhouette in the distance, Bay Area fog, emergency glow reflecting on rain-soaked pavement, and layered city depth. The road should have strong forward direction, readable horizon line, cinematic depth, and enough open space for driving gameplay.

Visual style: premium cinematic sci-fi war drama, realistic materials, grounded near-future design, large-scale urban destruction, cold blue-gray rain atmosphere with restrained magenta emergency glows, high contrast wet reflections, smoke layers, damaged infrastructure, expensive production design, no cartoon styling.

Important: this is an environment world, not a character scene. Do not create a heroine, pedestrians, close-up faces, dialogue, UI, captions, logos, or readable text. Do not create a fashion shoot, a clean cyberpunk street, a peaceful commute, a tiny alley, a fully blocked road, toy-like cars, fantasy architecture, anime style, or over-cluttered geometry. The world must be usable for a playable car chase and should export well as SPZ plus collider mesh.
```

## If Marble Has a Negative Prompt Box

```text
characters, people, close-up face, heroine, readable text, subtitles, logos, watermarks, clean cyberpunk street, peaceful commute, tiny alley, blocked road, maze-like layout, unusable route, collapsed road across entire street, toy cars, cartoon, anime, fantasy, glossy fashion shoot, over-cluttered props, floating geometry, melted vehicles, distorted bridge, low-scale environment, flat lighting
```

## Why This Prompt Is Shaped This Way

- `environment world, not a character scene`: Marble is better for navigable spaces than character identity.
- `clear road-level combat chase route`: the game needs a drivable area, not just a beautiful panorama.
- `center lane and one side lane drivable`: prevents the generator from blocking the whole road with debris.
- `smoke-and-fire occlusion area`: gives us a natural cut point from movie into gameplay.
- `wide intersection for branching choices`: supports different outcomes after player input.
- `San Francisco without readable text`: keeps the city identity while avoiding broken generated signs.

## Export Targets

After generating, export these if available:

```text
SPZ / Gaussian splat
Collider mesh GLB
High-quality mesh GLB, optional
```

Rename and place them here:

```text
web/worlds/a0-war-signal-500k.spz
web/worlds/a0-war-signal-collider.glb
```

Then reload:

```text
http://127.0.0.1:5177/world-prototype.html
```

Success indicator:

```text
Top right should say: Marble SPZ
```

## Quality Checklist Before Exporting

- The central route is visibly drivable.
- The scene reads as post-war San Francisco, not a generic neon alley.
- There is a road-level forward direction suitable for a chase.
- The road is wet and reflective but not visually muddy.
- Debris and wreckage create tension without blocking everything.
- There is a smoke/fire occlusion zone suitable for transition.
- There are no large readable signs or UI-like text.
- There are no generated people or distorted character bodies.
- Mobile rendering should have a chance: avoid extremely dense clutter.

