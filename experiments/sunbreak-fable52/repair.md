You produced the attached index.html. It runs, but actual browser image review
revealed major defects. Return ONLY valid JSON {"edits":[{"old":"exact existing
source substring","new":"replacement source"}]} with uniquely matching old
strings. No markdown. Keep the reply under 18000 characters. These edits will
be applied mechanically; do not return the entire file. Use compact code.

Fix these issues in priority order:
1. Gun is a huge pitch-black silhouette. The second render rnd.render(gcam,cam)
   renders it with no lights and wrong camera. Use a separate weapon scene with
   hemisphere/directional lights and camera at origin, proper weapon scale and
   position. Gun should occupy lower-right 25% of the image, with clear material
   separation and visible details. Keep tracer start transformed into world
   space correctly. Weapon style must switch too.
2. Scene looks like plain box houses and flat polygon palm blobs. Improve the
   procedural art visibly: seeded canvas stucco/wood/sand textures with subtle
   noise, window frames/recess illusion, door trim, roof tile courses, awnings
   with colored stripes and supports. Replace blob palm crowns with longer
   tapered curved fronds and smoother tapered trunks. Preserve clear colorful
   tropical competitive semi-realism. Prioritize cohesive finished surfaces.
3. Start at z=12, inside the promenade, so the railing does not obstruct entry.
   Keep restart at the same new spawn. Better framing at human eye level.
4. Enemy firing must test wall occlusion and use a visible shot/tracer. It must
   not damage players through houses. Enemies need correct body/weapon facing.
5. Reload currently instantly fills ammo: implement 1.2-second timed reload,
   prevent firing while reloading, visible weapon movement and HUD status.
6. Pointer lock loss/blur must pause and clear held inputs. Catch requestPointerLock
   rejection and permit drag-look fallback. Pause releases lock; resumes re-request
   lock via button. Avoid immediate re-pause loops when pointer lock unsupported.
7. Add a presentation toggle independent of combat pause: freeze simulation and
   hide center menus while keeping style buttons visible, working before start.
   Show a clear button to leave presentation. Stable camera/gun when frozen.
8. Fully reset velocities, cooldowns, reload, aim, keys and enemy timers on restart.
9. Fix invalid CSS font shorthand (e.g. font:800 34px/1 inherit) to valid
   font-size/font-weight/line-height rules for the title and ammo.

Do not add packages or images. Preserve original game and both style presets.
Keep patches independent and exact, no overlapping old text. Avoid scope creep.
