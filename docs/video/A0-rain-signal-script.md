# A0 War Signal

## Scene Goal

Reframe the opening as a large-scale post-war cinematic introduction instead of a restrained thriller interior. The audience should first understand the scale of the world, then feel that `Lin Xia` represents a fragile but real hope for carbon-based life.

This scene should feel:

- tragic, vast, and premium
- damaged but not hopeless
- war-torn future city, not generic neon commute
- emotionally heavy before it becomes kinetic

The opening should not start with a parked-car mood. It should start with a grand image, then narrow toward the heroine, then ignite into pursuit combat.

## Character Lock

Use the heroine reference image as the identity anchor:

```text
web/assets/女主.png
```

Hard continuity rules:

- East Asian female, early 20s, pale skin, slim athletic build
- black ponytail, loose front strands, sharp but tired eyes
- long black tactical leather coat with magenta inner lining and subtle magenta glowing strips near the hem
- black fitted combat suit, utility belt, black boots, black gloves
- grounded tactical styling, not fantasy armor
- preserve face shape, eye spacing, brow shape, hairline, and coat silhouette
- the heroine must feel human, burdened, and resilient

## Opening Direction

Story read for the first scene:

- the city has already been scarred by a larger conflict
- some hostile synthetic force or post-human war system has left visible damage across the skyline
- Lin Xia appears as the representative of carbon-based life, not merely a stylish bounty hunter
- the score should feel sorrowful at first, then introduce a faint thread of hope when she enters frame

## Recommended Clip Structure

Target duration: `22s to 30s`

Suggested shot plan:

1. `Shot 1, 5s to 6s`
   Epic wide establishing shot from a high overlook. A future San Francisco skyline is visibly war-damaged: broken elevated rails, collapsed facades, drifting smoke columns, scorched bridge structures, ruined drones, distant emergency lights, wet streets reflecting faint neon through mist. The city feels like it survived a battle last night.

2. `Shot 2, 4s`
   Lin Xia stands on a rooftop edge or shattered overpass, looking down over the wounded city. Her long coat moves in cold wind. She is small against the ruined scale, but composed. This is the first hope beat.

3. `Shot 3, 3s to 4s`
   Controlled medium close-up. Her face is calm, exhausted, and focused. Eyes aligned, no doll stare, no beauty-shot posing. A distant explosion flickers across her cheek, and a cooler rim light separates her from the background.

4. `Shot 4, 3s to 4s`
   Reveal the target convoy moving through the lower city or industrial corridor. Escort vehicles are not peaceful SUVs anymore; they are armored future transport cars under attack pressure, pushing through damaged streets. Tracer fire or drone flashes can be seen in the far distance.

5. `Shot 5, 3s`
   Lin Xia enters or drops into her combat vehicle. Cockpit power wakes up. Weapon systems and pursuit guidance activate. The camera move should begin aligning with the playable chase viewpoint.

6. `Shot 6, 4s to 6s`
   The chase starts violently. Two combat vehicles cut through rain and debris. Sparks, evasive steering, muzzle flashes, and nearby explosions create strong kinetic energy. End on a transition-friendly action beat that can hand off to gameplay.

## Movie To Play Transition Strategy

Preferred handoff points:

1. `Explosion occlusion`
   A nearby blast briefly fills frame with fire, smoke, or debris, hiding the cut into gameplay.

2. `Hard evasive move`
   Lin Xia jerks the vehicle to avoid incoming fire, and control transfers as the player stabilizes the car.

3. `Cockpit alignment`
   The camera settles into a chase/cockpit framing for 8 to 12 frames before the player takes control.

4. `Near-miss dodge window`
   An incoming projectile, collapsing sign, or spinning wreck creates a natural playable reaction test.

This is stronger than handing off from a static calm shot, but it requires tighter camera continuity. Keep the final movie frames and first gameplay frames matched in:

- heading
- speed impression
- horizon line
- camera height
- lens feel

## Master Prompt

```text
Epic post-war future San Francisco at night after rain. Start with a grand cinematic overlook from high above the city. The skyline shows signs of recent large-scale conflict: broken elevated tracks, damaged towers, drifting smoke, scorched infrastructure, ruined drones, emergency glows in the distance, wet streets reflecting cold light through mist. Use the attached heroine reference image for identity, face, hair, outfit, and silhouette continuity. Lin Xia is an East Asian female cleanup hunter in her early 20s with a slim athletic build, black ponytail, loose front strands, pale skin, sharp tired eyes, a long black tactical leather coat with magenta inner lining and subtle magenta glowing strips near the hem, fitted black combat clothing, gloves, utility belt, boots. She stands on a rooftop edge or shattered overpass, looking over a wounded future city as the representative of carbon-based life. Her expression carries grief, pressure, endurance, and a faint thread of hope. Below, a hostile armored convoy cuts through the damaged streets. The scene escalates into a rain-soaked dual-car combat pursuit with muzzle flashes, sparks, evasive driving, debris, and controlled explosions. Photorealistic, premium cinematic sci-fi war drama, grounded future warfare, large scale, dramatic silhouette, premium lensing, strong depth, atmospheric rain, smoke layers, controlled contrast, expensive composition, no text, no subtitles, no watermark.
```

## Motion Prompt

```text
Begin with a slow majestic glide over a devastated future city, then narrow toward Lin Xia on a high overlook. Let the camera feel heavy, expensive, and emotionally loaded, not frantic. When the convoy is revealed, increase urgency through purposeful motion, not shaky chaos. Transition into pursuit with strong forward momentum, near-miss energy, sparks, blasts, and rain-swept speed. End on a frame that can hand off to gameplay during an evasive move or explosion cover.
```

## Negative Prompt

```text
cross-eyed, wall-eyed, lazy eye, misaligned pupils, asymmetrical eyes, mannequin face, vacant expression, soft beauty ad pose, static portrait mood, commuter traffic mood, empty tunnel, harmless street scene, weak composition, flat framing, television drama lighting, generic cyberpunk clutter, toy-like cars, low-scale environment, no visible war damage, no smoke columns, no sense of threat, overclean city, glossy fashion shoot, anime, cartoon, cel shading, fantasy armor, cute expression, smiling, extra fingers, broken hands, duplicate vehicles, melted car geometry, blurry face, different hairstyle, different coat design, exposed midriff, text, subtitles, watermark
```

## Performance Notes

- Lin Xia should not look calm in a passive way. She should look contained.
- Hope should be subtle and earned, not cheerful.
- She is tired, but her will is stronger than the city around her.
- Avoid fashion-model posing or idol framing.

## Shot Priority

Generate in this order:

1. `Shot 1`
   Validate scale, world damage, and emotional tone.
2. `Shot 2`
   Validate Lin Xia's silhouette against the city.
3. `Shot 3`
   Validate face quality and eye alignment before doing any action shots.
4. `Shot 6`
   Validate whether the chase energy and explosion transition can support gameplay handoff.

## Best Practice

Do not ask the model to solve the entire opening in one pass at first.

First prove these four things independently:

- the world is epic enough
- Lin Xia reads as human hope, not generic cool-girl styling
- the face is stable and not eye-broken
- the chase has enough violence and motion to justify a battle-time gameplay cut
