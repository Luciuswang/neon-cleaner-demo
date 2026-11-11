# UE 5.9 MegaJam Preview evaluation — 2026-11-11

## Sources and finding

Epic announced the experimental 5.9 MegaJam Preview on 2026-11-09:
https://forums.unrealengine.com/t/unreal-engine-5-9-megajam-preview/2852840
Release notes: https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-9-release-notes?lang=en-US
Epic says its QA pass was unusually short and advises testing on a project copy.
The production project remains UE 5.8.1; 5.9 is not installed on this machine.
Attempted Windows automation of Epic Games Launcher was rejected with
`Computer Use was not approved to use Epic Games Launcher`. No 5.9 installation
or 5.9 test occurred.

## Relevance and limits

- Expanded Unreal MCP and Unreal Assistant support Codex and expose more editor,
  profiling, render, Fab and gameplay tools. Promising for inspecting the actual
  assembled Blueprint and resources; validate availability and actions first.
- New Proximity IK, Pelvis Volume and Limb Twist may assist retargeting; test
  grip, seat and jacket deformation explicitly. No claim of automatic contact.
- Experimental UAF AnimGen and NVIDIA Kimodo integration may help generate motion
  candidates for riding, steering and braking. Provider/model requirements,
  runtime integration, licensing, and actual quality are not yet verified.
- Unreal Canvas can use connected generation providers for concept/image/mesh/
  video work, generally with user API keys. Do not assume cinematic quality,
  ownership terms, cost, or runtime usability without individual verification.
- The web target uses a mobile renderer and is not an answer to cinematic QA.

## Local experiment

On 2026-11-11 a separate blank 5.8.1 project in
`.local/ue58-mcp-probe-20261111/` enabled ModelContextProtocol and AllToolsets.
A dedicated hidden editor process listened on 127.0.0.1:18741. JSON-RPC
initialize, initialized, tools/list and the read-only list_toolsets call succeeded;
editor and animation toolsets were returned. The isolated process was stopped.
No Codex in-editor integration, project content manipulation, 5.9 feature,
asset fit or gameplay was tested. This probe does not change the project QA gate.
Official 5.8 setup: https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?application_version=5.8

## Next

When 5.9 is available, install alongside 5.8, use a fresh project copy, and verify
version and plugins. First inspect MetaHuman components and try retargeting a
short seated pose; compare hand contact and animation against the current 5.8
baseline via offscreen render and runtime logs. Record costs, licenses, failures
and asset provenance. Keep 5.8 production and existing private snapshots intact.
Cinematic acceptance remains REWORK; AI VIDEO remains BLOCKED.
