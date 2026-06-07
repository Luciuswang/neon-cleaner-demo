# Marble world assets

Place exported World Labs / Marble assets here.

Expected first experiment files:

```text
a0-war-signal-500k.spz
a0-war-signal-low.spz
a0-war-signal-collider.glb
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
