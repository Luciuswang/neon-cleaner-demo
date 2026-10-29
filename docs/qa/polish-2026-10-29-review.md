# Independent polish review — 2026-10-29

Reviewer: quality_gatekeeper. Producers: root integrator and bounded environment/
rider specialists. Review profile: `offscreen-cinematic-v1`, schema 2.

## Plan review

PASS TO IMPLEMENT, not cinematic acceptance. Scope is facade/light readability,
rider mechanical/contact refinement, and true offscreen render-target evidence.
Root serializes compilation, map creation and UE runs. QA does not invoke UE,
capture the desktop or edit production code. User may lock the screen.

The plan is acceptable because it addresses visible defects and produces
same-build evidence. Added facade trim, contact endpoint telemetry and invisible
wheel proxies cannot independently establish visual success. Inspect the final
export before crediting any improvement.

## Evidence gate implementation

The verifier retains historical September reports and adds an explicit new
offscreen profile. New visual evidence requires matching capture IDs/dimensions
in hashed engine logs; new motion requires continuous indices, exact completion
count and an independent full-sequence review. Real-time performance now derives
p99, maximum frame time and the count over 50ms, in addition to p50/p95.
Required limits: p95/p99 <=33.3ms, maximum <=50ms over >=30s gameplay.

Validation: `python -B -m unittest discover -s tools/qa -p test_cinematic_evidence.py -v`
passed 21 tests, including an otherwise good p99 with one 350.138ms hitch, wrong
capture ID/method/dimensions, incomplete frame provenance, desktop capture,
missing tail metrics, fixed-step performance provenance and profile downgrade.
These are synthetic integrity tests, not a project art or performance PASS.

## Current independent artifact decision

CINEMATIC: REWORK after actual final-v2 evidence review. AI VIDEO: BLOCKED.
The first offscreen pack below is superseded by the final-v2 review. Camera
tracking and real-time settings checks were corrected and recaptured. The final
artifacts still demonstrate visible defects; this is not a missing-tool-only
decision. Engineering success does not clear these independent visual blockers:

- Severe wrist/finger anatomy and unclear natural grip contact.
- Static visible motorcycle wheels/fork or unverified component articulation.
- Placeholder/repetitive city and unreadable lower elevated structure.
- Low-detail/glossy hero and motorcycle materials without neutral diagnostics.
- Unreviewed full temporal continuity and previously observed severe hitches.

Required next evidence: actual offscreen wide/gameplay/side and both palm views,
continuous neutral-left-right-return-brake motion, neutral/lit materials, and
same-build real-time performance. No final AI generation acceptance is issued.

## Final-v2 independent review

Current dependency fingerprint:
`3b6960b7e711540ed804f6b1d5e01d5ea407290461241bca2bbadb41cd8ab808`.
All final paths below are relative to `ue/NeonCleanerUE/Saved/Quality/`.
No desktop or window screenshots were acquired. The reviewer read actual
SceneCapture2D exports, existing source and recorded runtime files.

Both `polish-2026-10-29-hands-v2/render.mp4` and
`polish-2026-10-29-side-v2/render.mp4` decoded in full without errors at
12s/30fps/1920x1080. All 720 PNGs passed CRC, decompression and dimension checks.
Both logs matched their capture IDs, continuous frame indices, 30fps simulation
intervals and 360-frame completion. `polish-2026-10-29-bridge-v2/render.mp4`
decoded completely at 4s/30fps/1920x1080; all 120 PNGs also decoded correctly.
The short bridge diagnostic does not satisfy the 10s rider-motion requirement.

Visual inspection scope: side and hands frames **0, 45, 135, 359** (video times
0, 1.5, 4.5, 11.967s), bridge frames **0, 60, 90, 119**. Full decoding is not
full continuous subjective observation. Keep `full_continuous_review: false`;
temporal contact, flicker and rolling continuity have no independent PASS.

| Domain | Final-v2 observed evidence and decision |
| --- | --- |
| Rider | **REWORK.** Hands 0/45/135/359 now keep the target hand in frame, verifying the camera correction in these samples. The near fingers still hang open below the bar. A long thin skin-colored triangular strip extends from the sleeve/wrist region toward the grip/hand; this visibly abnormal deformation requires bone/skin mapping diagnosis. The exact cause is not established by a rendered image. Far-palm contact remains partly occluded. |
| Assets/materials | **REWORK.** Hands 0/135 reveal coarse tank/handlebar facets and stretched metallic texture. Side 0/135 show solid glossy hair and strong gold/plastic-looking pants highlights despite reported dielectric parameter correction. Neutral-material diagnostics are absent; texture-baked highlights remain a possible cause, not a verified one. |
| Environment | **REWORK.** Side samples show readable road cracks, lane markings, drainage, reflectors and framed nearby windows. Black slab towers, flat lit-window rectangles and repetitive materials remain. Bridge 0 is dominated by a close wall; 60/90/119 are obstructed by dark buildings/structure. No inspected bridge frame sufficiently explains deck, piers and lower level together. Frame60 offers more structural context than90 but is still rejected. |
| Vehicles/mechanics | **REWORK / incomplete evidence.** Visible bike wheels/fork remain unarticulated; sparse apparent spoke changes from viewpoint/lean do not prove rolling. Primitive weapon barrel remains conspicuous ahead of the bike. Current enemy-car detail, neutral light and tire-contact evidence are absent. |
| Temporal/performance | **REWORK.** Continuous subjective visual approval absent; one measured 240.692399ms hitch exceeds the 50ms maximum. |
| Engineering | **Not independently accepted here.** Root owns final compile/map/asset/encounter validation; this review does not claim full input/collision proof. |
| AI handoff | **BLOCKED.** Current UE defects and incomplete diagnostic coverage prevent an accepted reference pack. |

Final real-time audit: `polish-2026-10-29-realtime-v2/realtime.csv`, **2087
samples over 34.9913725s** after declared 5s warm-up. Independently recomputed
p50 **16.6669ms**, p95 **16.8204086ms**, p99 **16.9544277ms**, maximum
**240.692399ms**, **1 frame >50ms** at runtime timestamp **15.663395401s**.
The p95/p99 limits pass; maximum/hitch gate fails. The runtime log reports
1920x1080, real-time, fixedTimestep=0, engineFixedFrameRate=0, benchmarking=0,
overrideFPS=0. Source inspection confirms these effective timing modes are
checked at initialization and each profile tick; fixed-step motion is separate.

| Final artifact | SHA256 |
| --- | --- |
| hands-v2/render.mp4 | `2b94a18cc10562a665c3d1461d71c95a74d25919df25373d6d93c269d4fe9bba` |
| hands-v2/runtime.log | `530fe15ebf4c5bf7cd4ca0442e10efc30fada1358fdc4aed39d81d9e83acd64e` |
| hands-v2/frame-00000.png | `63b927f41961be2eb568a85c06e1ffcaf2cc2ea376f6cfd23aae74b16464a8c2` |
| side-v2/render.mp4 | `8ecf6500c70d983eeea6de6797f799cb846f8b46f57ea7148c645dbe272bc4f5` |
| side-v2/runtime.log | `0aa9433ac45d56d8ca8afc07e658be08bcfa6ae813f96f7ce568c4310b1403ee` |
| side-v2/frame-00000.png | `645856834c1b165594be8d8eb925f1a9316ed76e5d213358903b6bbed5953198` |
| bridge-v2/render.mp4 | `e7689c5417635717561e778454eb5c1cd4cf7b9350119a5be1f2c8f4cf286189` |
| bridge-v2/runtime.log | `5921f038a756c9f777128913714a8855ec069d807e03258b00cbd7f5e6a17f6e` |
| realtime-v2/realtime.csv | `8eab57ff71af54dd6b8e25761a16c5ef3248b19331726081e584a00678faab4d` |
| realtime-v2/runtime.log | `c8c117f124bf7ef1851b323de688c012fff62cf597d8efcd43deadaa2bc3a961` |

Table prefixes abbreviate `polish-2026-10-29-`. Representative rejection images
are side frame0 and hands frame0; they are not approval exemplars. Next production
priority is repair of actual hand skin/chain mapping and bike articulation, with
neutral-material inspection and an unobstructed elevated-road camera before
another cinematic review. Investigate the measured hitch without trimming it.

## First offscreen pack: superseded diagnostic evidence

This subsection records an actual independent review, not the final rebuilt
revision. Dependency fingerprint at review was
`5174604e328edf6623eaa815698bad2e120c5700cf1713eec90bb4336554ed01`.
All paths below are relative to `ue/NeonCleanerUE/Saved/Quality/`.

Both `polish-2026-10-29-side/render.mp4` and
`polish-2026-10-29-hands/render.mp4` decoded completely: 12s, 30fps,
1920x1080. All 360 PNGs in each directory passed CRC/decompression/dimension
checks; continuous zero-based UE frame records, timing, completion and capture
IDs matched. These are fixed-step render-target exports, not performance runs.

Visual scope: side frames 0, 45, 90, 135, 180, 270, 315, 359; hands frames
0, 45, 135, 359; establishing frame 0. These sparse observations do **not**
constitute a full continuous subjective motion review.

| Evidence / frame | Independent finding | Decision |
| --- | --- | --- |
| Side 0/45/90/135/180 | Road surface, lane markings, drains, barrier reflectors and closer facade window frames/courses are readable. Large black slab buildings with sparse flat bands still dominate; lit windows remain flat rectangles. | Environment REWORK |
| Side 0/180/315/359 | Kelly jacket folds read, but pants retain strong glossy gold/plastic-looking highlights and hair reads as a solid shiny shell. Parameter corrections alone do not resolve the visible result; neutral-light diagnostics are absent. | Assets REWORK |
| Hands 0/45/135 | Image mostly contains road/barrier and clipped bike tail; both palms are out of frame at speed. | Capture coverage REWORK |
| Hands 359 | Close view clearly shows long fingers hanging below the handlebar instead of wrapping it; far hand also open. Bike fairing is visibly faceted. Numeric wrist deviation does not establish skin contact. | Rider REWORK |
| Side samples | Apparent spoke orientation differences can arise from view/lean. No independently articulated wheel/fork geometry was added, as confirmed by producer/source review. Primitive horizontal weapon barrel remains visible. | Mechanical/asset REWORK |
| Establishing 0 | Two large foreground uprights obstruct the composition. Lower deck and supporting piers are not visible enough to certify elevated-highway readability. | Environment coverage REWORK |

Side video SHA256: `899d4525d4d429e5b39fcb7f36cc737a970b727880b2abca6beff9c906d90ce7`.
Side runtime log SHA256: `52943f987868c061ecf1e4b51beba693d99d3130019b228a68ffe3d12c13a285`.
Hands video SHA256: `efded5f2234223458b8f0c0dbc0a73b0f6829a864535e37928a9b0ee4dcc95ee`.
Hands runtime log SHA256: `378886f78e28981b49f9fdd4247259f9c0ecdc8e88755550f4c10a800f0413ca`.
Hands frame359 SHA256: `5eafc9eadd4ce64aa1565f5106ac24ac2d5db5a59933aa3fac28262fb292e8e9`.
Establishing frame0 SHA256: `0ab8b0272ea36b47a3e74f136f5133f50ff9b2f00bce5523cf2888f63bb44a41`.

The separate first real-time CSV had 2084 samples across 34.984233499s:
p50 16.667001ms, p95 16.80118245ms, p99 16.92243617ms, max 262.586098ms.
Two frames exceeded 50ms: 262.586098ms at runtime t=15.225682300s and
64.627297ms at t=20.010479499s. This fails the strict maximum/hitch gate even
though p95/p99 pass. Effective GEngine fixed-frame-rate/benchmark/override-FPS
checks were incomplete in this first implementation and are being corrected.

CSV: `polish-2026-10-29-realtime/realtime.csv`, SHA256
`dac672677a2881c9eb2c8bc6f13abf7c978fa49bd127dac0a5acded82a6fd008`.
Runtime log SHA256:
`1d07d2c464153760a544cf87bbc261e073440d0f320975a1ae345f15dce499e5`.
