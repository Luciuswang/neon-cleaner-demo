# SUNBREAK realistic v2: frozen-build art review

Date: 2026-11-16

Audio-only follow-up note: the verdict and source table below describe the
pre-audio checkpoint `6aa4387`. The subsequent recorded-audio slice leaves
`world.js` and `weapon.js` unchanged and refreshes the eight technical captures
and their metadata for the new audio/UI source hashes. That refresh is not a
new independent art review and does not upgrade the reference-quality verdict.
The historically reviewed images remain recoverable from `6aa4387`.

## Verdict

- Strict realism screen: **REVISE**, high confidence.
- Playable PBR style-demo milestone: **CONDITIONAL PASS**.
- User's reference-quality realism target: **REWORK; not achieved**.

Independent read-only reviewer: Newton, using Gateway GPT-5.5. The main
integrator also inspected the rendered hero, rain, wall, ground and weapon
images. The reviewer inspected all eight final views. No feature count,
test result or performance result is used as evidence of visual parity.

## Evidence identity

The actual browser WebGL PNGs and associated metadata are retained under
`qa/evidence/`: `final-hero`, `final-courtyard`, `final-wall`, `final-ground`,
`final-weapon`, `final-rain`, `final-overcast`, and `final-mobile`.
These are rendered game frames, not generated concept images.
Metadata binds each capture to these frozen render/gameplay sources:

| Source | SHA256 |
| --- | --- |
| index.html | 52fef5c3484e3f37bdb064d8ce26b90bd333b7e6a051421f0bed4b9ced0ac206 |
| world.js | 7f073620646f939a3552203bcea8b4129451bac18e0fe547be687d2363747621 |
| weapon.js | afe1d7bb36b1cac1bc6a4772c34b36a8f98dc504350ef3df5cefbc6300f5b5bd |
| qa-hooks.js | 2cbae8e12969e9dc16cd28523ffd5af2bcd7a32a9eff0941c2036a4a77703573 |
| qa/runtime-checks.js | e817e9a5117e344595105016fa213f0c9664794da624568b806ec904c84a52a0 |

Reference inspected:
`https://wquguru.github.io/fable52-fps-repro/demos/04-fps/`.
The reference has stronger industrial spatial layering, motivated lighting,
material aging and near-camera asset integration. This courtyard does not
match that quality. It is not an AAA, path-traced or UE cinematic acceptance.

## Main findings and revision priority

1. **Major — first-person weapon.** The receiver, rail, grip, hands and sleeve
   remain visibly simple manufactured/primitive forms. Their screen size makes
   this the strongest realism ceiling. Replace the viewmodel with a properly
   licensed, production-quality PBR mesh and matched articulated hands; retain
   the current muzzle endpoint and original recoil/fire/reload semantics.
2. **Major — enemy characters.** Helmets, limbs and clothing read as simplified
   mannequins, especially next to detailed walls. Replace the render-only
   geometry with a coherent realistic character and cloth/armor material
   separation while preserving original hit volumes, anchors and AI behavior.
3. **Minor/Major — weather, ground and environmental sameness.** The hard black
   pavement grid blocker is resolved; reflections are darker and better
   integrated. Rain is still a simple streak layer, some puddles remain
   graphic, and building/prop repetition is obvious. Add localized wear,
   roughness/wetness transitions and differentiated architecture after the
   dominant weapon/character assets are corrected.

The final wall closeup no longer shows the previous wall UV restart/bevel
seams. Signs have content, windows have recesses and scene detail extends
beyond the playable courtyard. No severe blank-frame or placeholder-render
bug was visible in the reviewed captures.

## Required screening axes

- **Sameness:** repeated roof/window modules and crate staging remain evident.
  Differentiate a few strong facade silhouettes rather than adding uniform noise.
- **Proportion and structure:** weapon/hands are the largest near-camera
  mismatch; enemy anatomy is simplified. Static frames do not validate joint
  deformation or continuous contact.
- **Cartoon drift:** restrained palette and PBR maps improve the direction,
  but silhouettes and geometry still read stylized/low-poly, not realistic.
- **Visual impact:** readable courtyard with clear targets and wet-surface
  accents; reference-level atmosphere and focal staging remain absent.
- **Detail priority:** architecture currently exceeds weapon/character quality.
  Fix those hero assets before spending more effort on minor facade trim.

Art-director attention: **yes** for accepting the realism benchmark and source
asset direction. This is an unresolved target gap, not a reason to label the
current playable milestone as reference-quality completion.

## Scope and evidence limits

The review is of representative current-build static views, not every frame
of continuous gameplay. Separate runtime/performance evidence is in the
release report. The 390x844 view verifies layout and a nonblank render, not
touch controls or mobile-device performance.

One external CC0 rifle candidate was investigated at
`https://verzatiledev.itch.io/assault-rifle`. The author page and preview were
inspected, but no usable model archive was obtained or integrated. No external
weapon license, fidelity or imported asset is implied by this investigation.
The current viewmodel remains the original procedural candidate described in
`weapon-provenance.json`.
