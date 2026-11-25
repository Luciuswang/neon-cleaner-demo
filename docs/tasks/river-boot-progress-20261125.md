# Riverfall loading feedback

Scope: existing Riverfall start menu only. Preserve the public URL, game input, match simulation, art, shared assets and first-frame readiness gate.

The static HTML presents stage 1 and a disabled Start button before the renderer loads. Six numbered stages describe current work, not bytes or estimated time. Desktop world builders report material, light, vegetation and actor milestones; the phone's existing diagnostics supply its scene milestones. After 20 seconds without a stage change, the timer offers an optional reload while leaving the load running. Failures have their own reload control; only normal runtime readiness enables Start.

The scoped River asset snapshot was restored independently; unrelated unfinished private UE vault work was preserved. Gateway requested and reported `claude-fable-5-2` for the patch and review; sanitized receipts in `experiments/sunbreak-river-v4/qa/boot-progress-20261125` are gateway-reported, not independent upstream billing.

Pre-release QA: `node experiments/sunbreak-river-v4/qa/boot-progress-20261125/check.mjs` passed for desktop and mobile stage text, true readiness, slow-but-recoverable and failed states. This is a lifecycle regression, not a hardware performance or rendering acceptance. Next: publish the unchanged-address Pages overlay and verify live bytes.

Release: **PASS**, Pages PR 19 merged. The unmodified public URL served the expected HTML, boot controller, desktop scene module and release manifest (hashes in `live.json`). Existing private assets and previous demos were not republished as changed content. No hardware-specific speedup is claimed.
