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

## 2026-11-13: actual 5.9 isolated evaluation

Installed UE 5.9.0 CL 60351404 was used explicitly with a fresh scratch copy of
`metahuman-rider-nov10`. Its project copy enables Unreal MCP and AllToolsets;
the production 5.8 project was not converted. A fresh 5.9 commandlet loaded all
283 assembled MetaHuman assets, including Blueprint, DNA, face animation assets,
grooms and bindings; exit 0 and zero failed asset loads. This tests loading only,
not actual component wiring, shader/render output, animation, or gameplay. All
283 copied assembly files still matched the 5.8 isolated sources by SHA256.

A separate 5.9 null-RHI editor exposed a loopback-only MCP server on port 18742.
MCP handshake reported 5.9.0-60351404; discovery returned `call_tool`,
`describe_tools`, `describe_toolsets` and `list_toolsets`. A real read-only
BlueprintToolsets ListGraphs call against the user character returned five graphs,
including EnableMasterPose, LiveLinkSetup and EventGraph. The scratch editor was
stopped. Small reports are in `.local/private-sources/ue59-preview-validation-2026-11-13/`.
No external model was given user character data.

Independent investigation found Kimodo and AnimGenOffline bundled, but no default
Hugging Face model cache. Kimodo's model also requires a gated Meta Llama text
encoder and authorized Hugging Face access; credentials were not inspected. The
5070 12GB GPU's compatibility with the plugin's pinned CUDA/PyTorch has not been
tested. No animation was generated. Check the exact current requirements and
license before attempting a bounded installation or inference. References:
https://research.nvidia.com/labs/sil/projects/kimodo/docs/getting_started/installation.html
https://research.nvidia.com/labs/sil/projects/kimodo/docs/key_concepts/limitations.html

Cross-PC restore preflight detected a locally changed jacket source material,
not a missing asset. All 1145 pinned files were checked: one differed and none
were absent. Both the older immutable snapshot and the local variant must be
preserved; do not overwrite the local variant or infer its authorship. The tracked
DefaultEditor.ini has pre-existing generated profile changes and was preserved.

QA: isolated load and read-only MCP inspection PASS; migration, animated
character, outfit, grip, actual project/game, cinematic rendering and performance
NOT TESTED / REWORK. AI video remains BLOCKED. Next inspect actual instantiated
MetaHuman component bindings in the scratch copy; test animation prerequisites
and a constrained riding pose, then use offscreen continuous motion/fit checks.
