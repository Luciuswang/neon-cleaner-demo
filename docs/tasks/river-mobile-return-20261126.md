# Riverfall — phone play, invite return and river visibility

Task `river-mobile-return-20261126`. Scope: Riverfall only. No layout, combat simulation, asset imports or earlier demos were changed.

- Fullscreen is a touch-only, gesture-triggered control. It requests browser fullscreen where available; otherwise it explains how to install the iPhone home-screen web app. The playing surface follows the available viewport and the touch HUD is compact. Browser chrome cannot be forcibly removed.
- The private host no longer destroys a retained session on a persisted page hide. The host suspends match time and resets clocks on foreground; signaling reconnects are bounded. Copy and native sharing use the same fragment URL. A host whose document is reloaded may explicitly recover its previous private room name for about ten minutes in that same tab. Atomic room registration must succeed; the recreated match starts from scratch. A link recipient is never offered the host recovery control. No server-side persistence, background execution guarantee, or ranked-room authentication is implied.
- The phone material now distinguishes the flowing central channel from transparent shallows by coverage and animated highlights. Pebbles remain visible at the margin. No water-height, fording, collision or desktop-material changes.

Local QA in `experiments/sunbreak-river-v4/qa/mobile-return-20261126`: real Chromium fullscreen and WebKit fallback, rotation and causal touch fire; two real WebRTC peers, using the original clipboard URL after a persisted-pagehide plus a Chromium freeze/thaw, and another join after a real page reload and explicit host recovery. The two river views are rendered from the game, at two simulation times each. Opening and rules regressions passed. Local browser emulation does not reproduce iPhone Chrome or SeaTalk.

Gateway receipts distinguish the model used for production from failed/non-editing calls; they attest only to Gateway-reported identity and usage. The unrelated dirty private UE vault was left untouched. The isolated river private snapshot was restored and is not part of the web package.
