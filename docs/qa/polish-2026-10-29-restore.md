# Final v3 checkpoint restoration verification

Verified at 2026-10-29T12:09:53Z using an isolated existing clone fetched from
GitHub. This is a clean alternate checkout on the same workstation, not a claim
that a second physical computer or an actually locked session was tested.

- Public checkpoint: `c2ad0757ac6e772b57254b2ec9568aca6607c011`.
- Private vault commit: `5ed280596ecff444e73781086cf618e4a74a61b7`.
- Private snapshot: `0342edcc3cacbc9b9fb81e43efb363ce277346f541145f17919270df925cbf58`.
- Start workflow fetched all remote heads and fast-forwarded the clean clone;
  Git LFS and private restore succeeded. All 773 pinned files verified, with
  20 restoration actions. Installed marker advanced only after completion.
- Current dependency fingerprint exactly matches the final report:
  `416a82e964645c8d0291ea71a6b26208ac4cde69c29f25fec6c5e79897a249aa`.
- Every nested report artifact hash matched: 29 references, 25 unique paths.
- Known-clean previous Kelly mesh was preserved under its previous snapshot's
  backup path. Old mesh SHA256:
  `c7bdf4869588fee244c910f2d35c12754e459c4fee11587ca5ffb858600ab732`.
  Restored PBR-assigned mesh SHA256:
  `e2dbef8bfce2de5ce72ed76cea135e700babaa37ccf2d5d5d52a04b30ca27746`.
- Restored checkout is clean. No binary or evidence reconstruction was required.

This establishes checkpoint integrity and the managed upgrade path. Cinematic
REWORK / AI video BLOCKED remains unchanged; see the independent v3 review.
