import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const usage = `Usage:
  node tools/comfy/build_storyboard_t2v_workflow.mjs <shot_id> [--root D:\\AI\\SULPHUR2_ComfyUI] [--base workflow.json] [--out output.json]

Examples:
  node tools/comfy/build_storyboard_t2v_workflow.mjs A0-S02 --root D:\\AI\\SULPHUR2_ComfyUI
  node tools/comfy/build_storyboard_t2v_workflow.mjs A0-S02 --base D:\\AI\\SULPHUR2_ComfyUI\\ComfyUI\\user\\default\\workflows\\Sulphur2\\video_ltx2_3_t2v.json --out tools/comfy/generated/A0-S02.json`;

const args = process.argv.slice(2);
if (args.length < 1 || args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(args.length < 1 ? 1 : 0);
}

function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const shotId = args[0];
const root = argValue("--root", "D:\\AI\\SULPHUR2_ComfyUI");
const storyboardPath = argValue("--storyboard", "docs/video/topview-local-comfyui-storyboard.json");
const baseWorkflowPath = argValue(
  "--base",
  `${root}\\ComfyUI\\user\\default\\workflows\\Sulphur2\\video_ltx2_3_t2v.json`
);

const storyboard = JSON.parse(readFileSync(resolve(storyboardPath), "utf8"));
const shot = storyboard.shots.find((item) => item.shot_id === shotId);

if (!shot) {
  const available = storyboard.shots.map((item) => item.shot_id).join(", ");
  throw new Error(`Unknown shot_id "${shotId}". Available: ${available}`);
}

if (!shot.positive_prompt) {
  throw new Error(`Shot "${shotId}" does not have a movie prompt. It may be a runtime gameplay beat.`);
}

const outputPath = argValue(
  "--out",
  `${root}\\ComfyUI\\user\\default\\workflows\\Storyboard\\${shot.shot_id}_${safeName(shot.clip_role)}.json`
);

const workflow = JSON.parse(readFileSync(resolve(baseWorkflowPath), "utf8"));
const oldPositivePrefix = "Dynamic cinematic close-up of high-tech modular machinery";
const oldCarChasePrefix = "A realistic cinematic 10-second landscape video";
const oldNegativeShort = "pc game, console game, video game, cartoon, childish, ugly";
const negative = shot.negative_prompt || storyboard.universal_negative_prompt;

let positiveUpdates = 0;
let negativeUpdates = 0;

function updateNodeList(nodes = []) {
  for (const node of nodes) {
    if (!Array.isArray(node.widgets_values)) continue;
    node.widgets_values = node.widgets_values.map((value) => {
      if (typeof value !== "string") return value;
      if (value.startsWith(oldPositivePrefix) || value.startsWith(oldCarChasePrefix)) {
        positiveUpdates += 1;
        return shot.positive_prompt;
      }
      if (value === oldNegativeShort || value.startsWith("cartoon, anime, toy car")) {
        negativeUpdates += 1;
        return negative;
      }
      return value;
    });
  }
}

updateNodeList(workflow.nodes);
for (const subgraph of workflow.definitions?.subgraphs ?? []) {
  updateNodeList(subgraph.nodes);
}

if (positiveUpdates < 1) {
  throw new Error("Could not find a positive prompt field in the base workflow.");
}

if (negativeUpdates < 1) {
  throw new Error("Could not find a negative prompt field in the base workflow.");
}

workflow.id = randomUUID();
workflow.extra = {
  ...(workflow.extra ?? {}),
  neon_cleaner_storyboard: {
    shot_id: shot.shot_id,
    branch_node: shot.branch_node,
    clip_role: shot.clip_role,
    target_duration_seconds: shot.target_duration_seconds,
    source_storyboard: storyboardPath
  }
};

const resolvedOutputPath = resolve(outputPath);
mkdirSync(dirname(resolvedOutputPath), { recursive: true });
writeFileSync(resolvedOutputPath, `${JSON.stringify(workflow, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  shot_id: shot.shot_id,
  output: resolvedOutputPath,
  positiveUpdates,
  negativeUpdates
}, null, 2));
