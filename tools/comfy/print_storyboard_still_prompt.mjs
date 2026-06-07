import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const usage = `Usage:
  node tools/comfy/print_storyboard_still_prompt.mjs <still_id>

Examples:
  node tools/comfy/print_storyboard_still_prompt.mjs SB-A0-01
  node tools/comfy/print_storyboard_still_prompt.mjs SB-I1-01`;

if (args.length < 1 || args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(args.length < 1 ? 1 : 0);
}

const stillId = args[0];
const stillsPath = resolve("docs/video/topview-storyboard-stills.json");
const storyboard = JSON.parse(readFileSync(stillsPath, "utf8"));
const still = storyboard.stills.find((item) => item.still_id === stillId);

if (!still) {
  const available = storyboard.stills.map((item) => item.still_id).join(", ");
  throw new Error(`Unknown still_id "${stillId}". Available: ${available}`);
}

console.log(`STILL: ${still.still_id}`);
console.log(`NODE: ${still.story_node}`);
console.log(`PURPOSE: ${still.purpose}`);
console.log("");
console.log("STILL IMAGE PROMPT");
console.log("------------------");
console.log(still.prompt);
console.log("");
console.log("NEGATIVE PROMPT");
console.log("---------------");
console.log(storyboard.global_negative_prompt);
console.log("");
console.log("APPROVAL CHECK");
console.log("--------------");
console.log(still.approval_check);
console.log("");
console.log("AFTER APPROVAL");
console.log("--------------");
console.log(still.after_approval);
