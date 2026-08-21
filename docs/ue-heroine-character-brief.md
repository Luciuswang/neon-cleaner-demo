# UE Heroine Character Brief

Last updated: 2026-08-20

## Direction

Build the heroine in UE first, then treat that character as Lin Xia. The older
AI-video Lin Xia descriptions are reference material, not law.

The goal is a character who can survive both close cinematic framing and fast
rear-camera gameplay framing.

## Recommended Asset Route

1. Start with MetaHuman Creator for the face and body.
2. Use UE / Fab free assets for clothing, hair alternatives, rider gear, and
   environment-compatible props.
3. Keep the first game-facing version simple:
   - playable rider silhouette,
   - stable face,
   - stable hair mass,
   - black tactical outfit,
   - restrained magenta signal accents.
4. Use Sequencer / Control Rig to capture reference poses.
5. Feed those UE captures into AI image/video tools.

## Visual Target

The new heroine should feel:

- grounded and human,
- athletic but not superhero-shaped,
- tired, precise, and dangerous,
- believable as a motorcycle pursuit specialist,
- cinematic enough for AI film close-ups,
- readable as a silhouette from behind in gameplay.

## Things To Avoid

- Fashion model styling that breaks combat believability.
- Overly anime proportions.
- Heavy neon decoration everywhere.
- Hair or clothing that changes shape too much in AI video.
- A face design that only works from one camera angle.

## First UE Character Pass

Use this as the first build target:

```text
Heroine v0.1
```

Required:

- short or tied dark hair that reads clearly in rain/night shots,
- black tactical rider jacket or long coat shape,
- practical pants, gloves, and boots,
- subtle magenta accent that also appears on the motorcycle,
- neutral face expression and determined side-eye pose,
- rear three-quarter rider pose for handoff matching.

Optional:

- cyan micro-light details,
- transparent visor or tactical glasses,
- rain-wet material variant,
- damaged / post-battle outfit variant.

## Acceptance Test

The character is acceptable when:

1. A UE rear three-quarter screenshot already looks like the same heroine in an
   AI-generated chase shot.
2. The face can be used in an AI close-up without changing age or ethnicity.
3. The outfit has no fragile details that AI will constantly rewrite.
4. The gameplay camera shows a strong rider silhouette before it shows facial
   detail.

## Prompt Seed After UE Capture

Use only after UE captures exist:

```text
Use the attached Unreal Engine render as the exact character identity source.
Keep the same face, age, hair mass, outfit structure, rider silhouette, and
magenta accent placement. Generate a cinematic rainy night shot, but do not
redesign the character.
```
