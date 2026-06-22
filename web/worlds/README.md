# Marble world assets

Place exported World Labs / Marble assets here.

Current Marble experiment:

```text
World ID: a147fe54-d680-42d7-9c8b-ee7014ad14a7
Title: Post-Apocalyptic Elevated Highway Chase
```

Expected local files:

```text
a0-war-signal-500k.spz      # 500k Marble splat, default desktop/balanced asset
a0-war-signal-low.spz       # 150k Marble splat, use with ?quality=low&perf=low
a0-war-signal-full.spz      # full-res Marble splat, use with ?splat=full for visual checks
a0-war-signal-marble.json   # source metadata and original Marble prompt
a0-war-signal-collider.glb  # older experiment collider; current Marble world has no collider mesh
```

`world-prototype.html` automatically loads `a0-war-signal-500k.spz` when present.
If it is missing, the page falls back to a local low-poly post-war San Francisco proxy scene.

To force the old public SparkJS sample splat for renderer debugging:

```text
world-prototype.html?sample=1
```

To force the low-res Marble export after downloading it:

```text
world-prototype.html?quality=low
```

To force the full-res Marble export for desktop visual checks:

```text
world-prototype.html?splat=full
```
