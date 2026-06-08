import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const usage = `Usage:
  node tools/comfy/print_storyboard_prompt.mjs <shot_id> [--storyboard docs/video/topview-local-comfyui-storyboard.json]

Examples:
  node tools/comfy/print_storyboard_prompt.mjs A0-S01
  node tools/comfy/print_storyboard_prompt.mjs A0-S02
  node tools/comfy/print_storyboard_prompt.mjs A2-S01 --storyboard docs/video/topview-nine-shot-comfyui-storyboard.json`;

if (args.length < 1 || args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(args.length < 1 ? 1 : 0);
}

function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const shotId = args[0];
const storyboardPath = resolve(argValue("--storyboard", "docs/video/topview-local-comfyui-storyboard.json"));
const storyboard = JSON.parse(readFileSync(storyboardPath, "utf8"));
const shot = storyboard.shots.find((item) => item.shot_id === shotId);

if (!shot) {
  const available = storyboard.shots.map((item) => item.shot_id).join(", ");
  throw new Error(`Unknown shot_id "${shotId}". Available: ${available}`);
}

const negative = shot.negative_prompt || storyboard.universal_negative_prompt;

console.log(`SHOT: ${shot.shot_id}`);
console.log(`ROLE: ${shot.clip_role}`);
console.log(`DURATION: ${shot.target_duration_seconds}s`);
console.log(`INPUT MODE: ${shot.input_mode}`);
console.log("");
console.log("POSITIVE PROMPT");
console.log("---------------");
console.log(shot.positive_prompt || "(No movie prompt; this is a runtime gameplay beat.)");
console.log("");
console.log("NEGATIVE PROMPT");
console.log("---------------");
console.log(negative);
console.log("");
console.log("HANDOFF");
console.log("-------");
console.log(shot.handoff_strategy);
