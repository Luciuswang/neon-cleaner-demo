# Task Packet: SUNBREAK recorded firearm audio

- Task ID: sunbreak-audio-2026-11-16
- State: DONE
- Owner: main Codex integrator; one implementation writer.
- Baseline: 6aa4387, realistic v2; original Fable snapshot remains untouched.
- Worker budget: one independent Gatekeeper/QA reviewer.
- Scope: recorded weapon audio, non-gameplay sound feedback, and separate
  comparison-page routing. Do not change the earliest demo bytes or its audio.
- Publication: normal existing-repository checkpoint authorized.

## Objective

Replace the square-wave gunshot with licensed recorded gunfire, add distance/
direction and restrained mechanical/impact feedback, without changing combat.

## Plan

1. Verify primary-source license and obtain a small selection from an actual
   firearm-recording library; preserve source URLs, hashes and transformations.
2. Build a local Web Audio sample player with preloading, user-gesture unlock,
   bounded voices, gentle limiting, per-voice variation and distance panning.
3. Replace only audio setup/calls; preserve damage, RNG, cooldown, trajectories,
   ammo, reload duration, AI, collision, cameras and every gameplay outcome.
4. Extend exact source-audit exceptions narrowly, with mutation self-tests.
   Add independent audio/asset validation and actual-browser playback evidence.
5. Re-run gameplay and performance checks and retain current-build evidence.
   Independent QA reviews the implementation and measured evidence.
6. Serve the byte-identical earliest demo at `/original/`; keep the realistic
   version at `/`. Link them without editing the baseline file.

## Write set

Main owns `experiments/sunbreak-realistic-v2/`, this packet and `docs/handoff.md`.
Reviewers are read-only. Original `experiments/sunbreak-fable52/`, all UE assets,
account/model settings and private vault are out of scope.

## Acceptance criteria

- Actual recorded firearm source with explicit redistribution permission;
  reject ambiguous licenses and don't call synthetic sounds real recordings.
- Local audio files load/decode; firing, enemy firing, reload and hits trigger
  the intended clips. Enemy gunfire is direction/distance-aware.
- No global Math.random use or game-state writes in the audio layer.
- No changed gameplay constants, collision or damage/reload behavior.
- User-gesture audio unlock, mute/volume, bounded polyphony and focus/pause
  handling; no oscillating placeholder gunshot fallback on load failure.
- Decoded files and offline stress mix are finite/non-silent, without hard
  clipping; queued sounds don't unexpectedly burst after resume.
- Original gameplay fixtures and state/proxy tests still pass.
- Separate technical playback checks from subjective listening. Do not claim
  human listening approval, measured hearing safety, or reference visual parity.

## Risks and dependencies

Primary candidate: OpenGameArt "The Free Firearm Sound Library", CC0, created
and recorded by Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney.
`bart` is the archive submitter, not the recording-team credit.
Inspect the author description and archive content before labeling its origin.
WAV extraction/DSP must be reproducible. Archive/license evidence stays ignored
when it is not redistributable source content; selected CC0 media is tracked.

Sync start fetched all origin heads and LFS; private restore again stopped on
pre-existing local vault modifications, which remain untouched. This browser
audio task has no dependency on that vault. Publish as isolated browser/public-
asset checkpoint with no UE/private-portability claim.

## Review decision

- Gatekeeper: PASS for bounded implementation (Planck); final acceptance pending.
- Final QA: PASS, independent read-only reviewer Planck; frozen audio/gameplay
  slice only. Reviewed code and measured evidence; did not rerun browser suite.
- Subjective listening: NOT PERFORMED.

## Implemented and measured

- Realistic page `/` has five local CC0 samples, independent seeded variation,
  enemy distance/heading filtering, voice cap, limiting, volume/mute and
  pause/presentation/focus cleanup. No oscillator fallback.
- Separate `/original/` serves exact earliest demo bytes without injection.
  Browser SHA256 matches the pinned original; baseline file remains untouched.
- Exact static source/proxy comparator and mutation tests PASS.
- Actual browser audio: 38/38; missing-module fallback: 5/5; baseline smoke:
  19/19; runtime invariants: 217/217; current release engineering: 85/85.
- Gesture-unlocked 1080p rain combat 30.0163 s: P95/P99 ~16.8 ms,
  max17.3 ms, 160 player/51 enemy shots and zero audio errors.
- Independent REWORK found keyup propagation, mandatory audio-module loading
  and insufficient suspended-restart testing. All were fixed and current
  source-bound browser evidence refreshed; independent final PASS closes all
  three findings.
- A viewport mismatch in an intermediate performance attempt was caught by
  the original >=1080 gate. Actual selected-tab dimensions were corrected;
  final evidence enforces exact desktop1920x1080 / mobile390x844 capture sizes.
- Final packaging explicitly emits LF manifest bytes and treats downloaded
  license pages/WAVs as binary for lossless checkout. All browser evidence was
  rerun after the manifest-byte correction; no manual source-hash rebinding.
- Actual Git-index byte audit: 37/37 source/media/evidence blobs match the final
  reports; `git diff --cached --check` is clean; no original-demo staged changes.
- Current evidence/source binding and limitations: realistic-v2
  `qa/audio-review.md`, `qa/release-report.json`, `qa/evidence/`.
- Next concrete action: user audition of the realistic page, compare to the
  unchanged original. Subjective audio and reference art parity remain unapproved.
- Checkpoint is isolated browser/public-assets with `-SkipPrivateAssets` because
  the pre-existing private-vault restore blocker remains outside this slice.
