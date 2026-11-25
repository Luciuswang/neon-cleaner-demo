// qa/slope-sward.mjs — read-only QA for outer slope sward roots (run: node qa/slope-sward.mjs)
import assert from 'node:assert/strict';
import { outerSwardRoots } from '../slope-sward.js';
import { MAP, landscapeHeight, riverWidth } from '../map-layout.js';

const roots=outerSwardRoots(),hx=(MAP.maxX-MAP.minX)/2,hz=(MAP.maxZ-MAP.minZ)/2;
const cx=MAP.minX+hx,cz=MAP.minZ+hz;
const inRiver=(x,z)=>Math.abs(x)<riverWidth(z)+1.1;
assert(roots.length<=14500,'exterior geometry cap');
const outDist = (x, z) => Math.max(Math.abs(x - cx) - hx, Math.abs(z - cz) - hz);
const sideOf = (x, z) => Math.abs(x - cx) - hx > Math.abs(z - cz) - hz ? (x > cx ? 'E' : 'W') : (z > cz ? 'S' : 'N');

assert(roots.length > 3000, `expected >3000 roots, got ${roots.length}`);

const CELL = 1.1, hash = new Map(), key = (i, j) => i + ',' + j;
const sides = { N: [0, 0, 0], S: [0, 0, 0], E: [0, 0, 0], W: [0, 0, 0] }; // total, 1–4m, 12–30m
let maxD = 0, maxErr = 0;

for (const [n, r] of roots.entries()) {
  const d = outDist(r.x, r.z);
  assert(Math.hypot(Math.max(0,Math.abs(r.x-cx)-hx),Math.max(0,Math.abs(r.z-cz)-hz))>=.82, `root ${n} inside map (${r.x.toFixed(2)},${r.z.toFixed(2)})`);
  assert(!inRiver(r.x, r.z), `root ${n} in river channel`);
  assert(r.h > 0 && r.r > 0, `root ${n} bad h/r`);
  const embed = landscapeHeight(r.x, r.z) - r.y; // positive = sunk into ground
  assert(embed >= -0.005 && embed <= 0.035, `root ${n} height off terrain by ${embed.toFixed(3)}m`);
  maxErr = Math.max(maxErr, Math.abs(embed)); maxD = Math.max(maxD, d);
  const s = sides[sideOf(r.x, r.z)];
  s[0]++; if (d >= 1 && d <= 4) s[1]++; if (d >= 12 && d <= 30) s[2]++;
  const k = key(Math.floor(r.x / CELL), Math.floor(r.z / CELL));
  hash.has(k) ? hash.get(k).push(r) : hash.set(k, [r]);
}
for (const [name, [t, near, far]] of Object.entries(sides)) {
  assert(t > 0, `no roots on side ${name}`);
  assert(near > 0, `side ${name}: no roots in 1–4m band`);
  assert(far > 0, `side ${name}: no roots in 12–30m band`);
}

// Coverage: 1m grid over the 0.9–12m outer band, excluding river.
let cells = 0, covered = 0, sumNearest = 0;
for (let x = cx - hx - 12; x <= cx + hx + 12; x++) for (let z = cz - hz - 12; z <= cz + hz + 12; z++) {
  const d = outDist(x, z);
  if (d < 0.9 || d > 12 || inRiver(x, z)) continue;
  cells++;
  let best = Infinity;
  const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++)
    for (const r of hash.get(key(i, j)) ?? []) best = Math.min(best, Math.hypot(r.x - x, r.z - z));
  if (best <= 1.1) { covered++; sumNearest += best; }
}
const coverage = covered / cells;
console.log({
  roots: roots.length, sides, maxOutwardExtentM: +maxD.toFixed(2), maxHeightErrM: +maxErr.toFixed(4),
  bandCells: cells, coveredCells: covered, coverage: +coverage.toFixed(3),
  meanNearestCoveredM: +(sumNearest / Math.max(covered, 1)).toFixed(3),
});
assert(cells > 0 && coverage >= 0.7, `outer band coverage ${coverage.toFixed(3)} < 0.7`);
console.log('slope-sward QA: PASS');
