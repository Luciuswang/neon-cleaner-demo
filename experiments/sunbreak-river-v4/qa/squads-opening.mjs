// qa/squads-opening.mjs — Riverfall online 4v4 opening QA (headless sim only; not WAN or visual proof).
// Usage: node qa/squads-opening.mjs [--observe]   (with --observe, set SQUADS_SIM_MODULE=<file URL of historical squads-sim.js>)
// Map contract (map-layout.js): walls are axis-aligned boxes CENTRED on w.x/w.y/w.z in all three axes, with full
// extents w.w/w.h/w.d (base w.y-w.h/2, top w.y+w.h/2); wallTopAt(w,x,z,0) takes the wall FIRST and returns an absolute y;
// seat clearance = one circle test blocked(x,z,CLEAR,y+1.7,'enemy') plus a map-boundary test; MAP bounds are required (no wall-extent fallback).
import { createMatch } from '../squads-sim.js';
import { walls, wallTopAt, blocked, terrainHeight, MAP } from '../map-layout.js';

const DT = 0.05, EYE = 1.6, CROSS = { x: 0, z: -4 }, OFF = [-0.35, 0, 0.35], HEIGHTS = [0.3, 0.9, EYE];
const ROUNDS = 3, MIXES = [1, 2, 4, 0], FAIR = 0.1, CLEAR = 0.45, NEAR = 0.8;
const LIMITS = [ // [metric, bound, 1 = at least / -1 = at most]
  ['nearP10', 0.9, 1], ['nearMin', 0.5, 1], ['closeFrac', 0.02, -1], ['worstOverlapS', 0.5, -1], ['spreadMax', 9, -1],
  ['lateralMin', 0.6, 1], ['travel4Min', 1.5, 1], ['travel8Min', 3, 1], ['humanMove', 0.05, -1], ['msPerStep', 4, -1]];
const fails = [], need = (ok, name, val) => { if (!ok) fails.push({ name, val }); }, noop = () => {};
const r = v => Math.round(v * 1e3) / 1e3, dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const cen = a => ({ x: avg(a.map(p => p.x)), z: avg(a.map(p => p.z)) });
const std = a => { const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };
const gy = (x, z) => terrainHeight(x, z) || 0;

function rayHit(a, b) { // segment a->b ([x,y,z]) against modeled wall boxes only, top clipped by wallTopAt
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  for (const w of walls) {
    let t0 = 0, t1 = 1;
    for (const [o, dd, c, half] of [[a[0], d[0], w.x, w.w / 2], [a[2], d[2], w.z, w.d / 2]]) {
      if (Math.abs(dd) < 1e-9) { if (Math.abs(o - c) > half) t0 = 2; continue; }
      let u = (c - half - o) / dd, v = (c + half - o) / dd;
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    }
    if (t0 > t1) continue;
    const base = w.y - w.h / 2, boxTop = w.y + w.h / 2;
    for (let i = 0; i <= 8; i++) {
      const t = t0 + (t1 - t0) * i / 8, x = a[0] + d[0] * t, y = a[1] + d[1] * t, z = a[2] + d[2] * t;
      const p = wallTopAt(w, x, z, 0), top = Number.isFinite(p) ? Math.min(boxTop, p) : boxTop;
      if (y >= base && y <= top) return true;
    }
  }
  return false;
}

function spawn(players, need) { // static checks on all 8 starting bodies
  const ts = [...new Set(players.map(p => p.team))], [A = [], B = []] = ts.map(t => players.filter(p => p.team === t));
  need(players.length === 8 && ts.length === 2 && A.length === 4 && B.length === 4, 'eightSeats', players.length);
  if (!A.length || !B.length) return { seats: players.length };
  const ext = Math.min(MAP.maxX - MAP.minX, MAP.maxZ - MAP.minZ) / 2;
  const ca = cen(A), cb = cen(B); need(Number.isFinite(ext), 'mapBounds', ext ?? null);
  need(ca.x * cb.x < 0 && ca.z * cb.z < 0 && [ca.x, ca.z, cb.x, cb.z].every(v => Math.abs(v) > 0.4 * ext), 'diagonal', { ca, cb, ext });
  const da = dist(ca, CROSS), db = dist(cb, CROSS); // straight-line, not path distance
  need(Math.abs(da - db) <= FAIR * Math.max(da, db), 'fairCrossing', { da: r(da), db: r(db) });
  const tight = players.filter(p => blocked(p.x, p.z, CLEAR, p.y + 1.7, 'enemy') ||
    p.x - CLEAR < MAP.minX || p.x + CLEAR > MAP.maxX || p.z - CLEAR < MAP.minZ || p.z + CLEAR > MAP.maxZ).map(p => p.slot);
  need(!tight.length, 'seatClearance', tight);
  let seatMin = Infinity, rays = 0; const open = [];
  for (const a of players) for (const b of players) {
    if (a !== b && a.team === b.team) seatMin = Math.min(seatMin, dist(a, b));
    if (a.team === b.team) continue;
    const L = dist(a, b) || 1, nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
    for (const e of OFF) for (const o of OFF) for (const h of HEIGHTS) {
      const fx = a.x + nx * e, fz = a.z + nz * e, tx = b.x + nx * o, tz = b.z + nz * o; rays++;
      if (!rayHit([fx, gy(fx, fz) + EYE, fz], [tx, gy(tx, tz) + h, tz])) open.push(`${a.slot}>${b.slot}@${e}/${o}/${h}`);
    }
  }
  need(seatMin >= NEAR, 'seatSpacing', r(seatMin));
  need(open.length === 0, 'occlusion', { open: open.length, rays, first: open.slice(0, 6) });
  return { ca, cb, da: r(da), db: r(db), ext, tight, seatMin: r(seatMin), rays, openRays: open.length };
}

function sample(R, ps, tick, start, runs) { // ps = living seats only
  for (const p of ps) {
    R.hash = Math.imul(R.hash ^ Math.round(p.x * 1e3) ^ Math.imul(Math.round(p.z * 1e3), 31) ^ (p.slot << 20), 16777619) >>> 0;
    if (!p.bot && start.has(p.slot)) R.humanMove = Math.max(R.humanMove, dist(p, start.get(p.slot)));
  }
  for (const team of new Set(ps.map(p => p.team))) {
    const b = ps.filter(p => p.bot && p.team === team && start.has(p.slot));
    if (b.length < 2) continue;
    const c = cen(b);
    R.spread.push(avg(b.map(p => dist(p, c))));
    b.forEach((p, i) => {
      R.near.push(Math.min(...b.filter(q => q !== p).map(q => dist(p, q))));
      for (let j = i + 1; j < b.length; j++) {
        const k = p.slot + ':' + b[j].slot, o = dist(p, b[j]) < NEAR;
        R.pairs++; if (o) R.close++;
        runs.set(k, o ? (runs.get(k) || 0) + 1 : 0);
        R.worst = Math.max(R.worst, runs.get(k) * 0.1);
      }
    });
    if (tick !== 80 && tick !== 160) continue;
    (tick === 80 ? R.t4 : R.t8).push(...b.map(p => dist(p, start.get(p.slot))));
    if (tick === 80) { // spread perpendicular to the team's travel heading, so a stretched single file scores ~0
      const s0 = cen(b.map(p => start.get(p.slot))), hx = c.x - s0.x, hz = c.z - s0.z, L = Math.hypot(hx, hz) || 1;
      R.lat.push(std(b.map(p => ((p.x - c.x) * hz - (p.z - c.z) * hx) / L)));
    }
  }
}

function run(create, humans) { // humans never send input; first 8s of each live phase sampled at 10Hz
  const m = create(), s0 = m.snapshot();
  const R = { humans, rounds: 0, near: [], pairs: 0, close: 0, worst: 0, spread: [], lat: [], t4: [], t8: [], humanMove: 0,
    hash: 2166136261, ms: 0, steps: 0, phases: new Set([s0.phase]),
    keys: Object.keys(s0).sort() + '|' + Object.keys(s0.players?.[0] || {}).sort() };
  for (let i = 0; i < humans; i++) m.join();
  let prev = '', tick = 0, start, runs, s = s0;
  for (let n = 0; n < 60000; n++) {
    const t = performance.now(); m.step(DT); R.ms += performance.now() - t; R.steps++;
    s = m.snapshot(); R.phases.add(s.phase);
    if (s.phase === 'finished') break;
    if (s.phase !== 'live') { prev = s.phase; continue; }
    if (prev !== 'live') { R.rounds++; tick = 0; runs = new Map(); start = new Map(s.players.map(p => [p.slot, { x: p.x, z: p.z }])); }
    prev = 'live';
    if (tick <= 160 && tick % 2 === 0) sample(R, s.players.filter(p => p.hp > 0), tick, start, runs);
    if (tick++ > 160 && R.rounds >= ROUNDS) break;
  }
  R.humansSeen = s.players.filter(p => !p.bot).length;
  return R;
}

function summarize(R) {
  const n = [...R.near].sort((a, b) => a - b), min = a => (a.length ? r(Math.min(...a)) : null);
  return { humans: R.humans, humansSeen: R.humansSeen, rounds: R.rounds, samples: n.length, phases: [...R.phases].join(),
    nearP10: n.length ? r(n[Math.floor(0.1 * (n.length - 1))]) : null, nearMin: min(n), closeFrac: r(R.close / (R.pairs || 1)),
    worstOverlapS: r(R.worst), spreadMean: r(avg(R.spread)), spreadMax: R.spread.length ? r(Math.max(...R.spread)) : null,
    lateralMin: min(R.lat), travel4Min: min(R.t4), travel8Min: min(R.t8), humanMove: r(R.humanMove),
    msPerStep: r(R.ms / (R.steps || 1)), hash: R.hash, keys: R.keys };
}

function check(S, need, tag) {
  need(S.humansSeen === S.humans, tag + ':humanCount', S.humansSeen);
  need(S.rounds >= ROUNDS, tag + ':rounds', S.rounds);
  need(S.phases.split(',').every(p => ['warmup', 'live', 'result', 'finished'].includes(p)), tag + ':phases', S.phases);
  need(['slot', 'team', 'x', 'y', 'z', 'hp', 'bot'].every(k => S.keys.split('|')[1].split(',').includes(k)), tag + ':playerKeys', S.keys);
  for (const [k, bound, dir] of LIMITS) need(S[k] !== null && (dir > 0 ? S[k] >= bound : S[k] <= bound), `${tag}:${k}`, S[k]);
}

function suite(create, need) { // spawn checks + every human/AI mix + identical rerun for determinism
  const out = { spawn: spawn(create().snapshot().players, need), scenarios: [] };
  for (const h of MIXES) { const S = summarize(run(create, h)); check(S, need, 'h' + h); out.scenarios.push(S); }
  const again = summarize(run(create, MIXES[0]));
  need(again.hash === out.scenarios[0].hash, 'determinism', [out.scenarios[0].hash, again.hash]);
  return out;
}

const notes = ['createMatch exposes no external seed parameter: variety comes from ' + ROUNDS + ' real rounds x ' + MIXES.length +
  ' human/AI mixes, not copies of one seed', 'headless sim numbers only: no WAN or visual proof', 'fairCrossing is straight-line distance'];
const fresh = suite(createMatch, need);
let baseline = null;
if (process.argv.includes('--observe')) {
  const url = process.env.SQUADS_SIM_MODULE;
  if (!url) notes.push('--observe given without SQUADS_SIM_MODULE: no baseline run');
  else try {
    baseline = suite((await import(url)).createMatch, noop); // observed only, never asserted
    need(baseline.scenarios[0].keys === fresh.scenarios[0].keys, 'snapshotKeysPreserved', [baseline.scenarios[0].keys, fresh.scenarios[0].keys]);
  } catch (e) { baseline = { error: String(e) }; }
}
console.log(JSON.stringify({ ok: fails.length === 0, fails, notes, limits: LIMITS, new: fresh, baseline }));
process.exitCode = fails.length ? 1 : 0;
