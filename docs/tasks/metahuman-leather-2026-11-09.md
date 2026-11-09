# MetaHuman leather jacket search — 2026-11-09

Task: `metahuman-leather-2026-11-09`. State: BLOCKED on access to a compatible
garment and editor interaction; no outfit has been applied. The user's saved
`/Game/MetaHumanWorkspace/Characters/Heroine_MetaHuman` was 8,974,383 bytes
at inspection. Preserve this custom face/body and back up the saved asset before
any wardrobe changes. The editor is open, so unsaved in-memory work is unknown.

User authorized finding/downloading resources, not purchases. Local UE5.8 Core
Data contains `WI_DefaultGarment` but no leather jacket wardrobe item. Fab has:

- [Female Leather Jacket - Free Model](https://www.fab.com/listings/d541ccae-385a-4f98-b678-ea57a60c5f85),
  listed at zero price under CC-BY, FBX with 4K PBR textures. This is not a
  ready-to-use MetaHuman wardrobe package; body fitting, skinning, attribution,
  and seated-rider deformation checks would be required.
- [MetaOutfits Urban Wear Biker Female Outfit](https://www.fab.com/listings/d9c1bfa5-26cc-42c6-b9f7-99fc709072ea),
  publisher describes parametric MetaHuman format, jacket, shirt, jeans and boots.
  At inspection it was SGD25.63 personal / SGD51.28 professional; these are
  not purchased or licensed to this project, and price/eligibility can change.
- [F Jacket Leather - Metahuman](https://www.fab.com/listings/ec20343f-033c-4ca1-b831-17a7cf39d484),
  described as MetaHuman wardrobe; SGD12.81 at inspection for either listed tier.
  Neither its appearance on this particular character nor license access is verified.

Do not treat generic FBX as parametric or a listing as an acquired asset. Fab
requires obtaining the package through the user's account, and the existing
computer-use authorization check refused Unreal Editor access. No editor controls
were operated and no user assets were overwritten. Next: obtain a legitimately
licensed compatible `.mhpkg` (or obtain and fit the CC-BY FBX), import it while
preserving the saved character, attach the wardrobe item, and verify side/front,
seated riding, clipping, material response and identity before asserting success.
