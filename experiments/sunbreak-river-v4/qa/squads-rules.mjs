import assert from 'node:assert/strict';
import { createMatch } from '../squads-sim.js';

// Rules QA for the squads sim. Public API only: join/leave/input/step/snapshot.
// No state pokes, no runtime acceleration; long waits are just many legal steps.
const DT = 1 / 60;
const IN = (o = {}) => ({ dx: 0, dz: 0, yaw: 0, pitch: 0, fire: false, reload: false, sprint: false, ...o });
const P = (m, s) => m.snapshot().players[s];
const out = {};

function full() {
  const m = createMatch(), slots = [];
  for (let i = 0; i < 8; i++) slots.push(m.join());
  return { m, slots };
}
// Step in 0.05 s slices until a phase is reached; logs the phase trail.
function until(m, phase, trail, max = 900) {
  for (let t = 0; t <= max; t += 0.05) {
    const ph = m.snapshot().phase;
    if (trail && trail[trail.length - 1] !== ph) trail.push(ph);
    if (ph === phase) return true;
    m.step(0.05);
  }
  return false;
}
const aim = (a, b) => ({
  yaw: Math.atan2(a.x - b.x, a.z - b.z),
  pitch: Math.atan2(b.y + 1.15 - (a.y + 1.6), Math.hypot(b.x - a.x, b.z - a.z)),
});
// Eye-to-upper-torso fire for up to `sec`; true once target hp drops. Releases the trigger.
function fireAt(m, a, b, sec) {
  const h0 = P(m, b).hp;
  let hit = false, last = {};
  for (let t = 0; t < sec && !hit; t += DT) {
    const s = m.snapshot();
    if (s.phase !== 'live') break;
    last = aim(s.players[a], s.players[b]);
    m.input(a, IN({ ...last, fire: true }));
    m.step(DT);
    hit = P(m, b).hp < h0;
  }
  m.input(a, IN(last));
  return hit;
}
// Learn how dx/dz map to world motion at yaw 0, in a throwaway match.
function probeBasis() {
  const { m } = full();
  assert.ok(until(m, 'live'));
  const d = (inp) => {
    const a = P(m, 0);
    for (let i = 0; i < 6; i++) { m.input(0, IN(inp)); m.step(DT); }
    const b = P(m, 0);
    return [b.x - a.x, b.z - a.z];
  };
  const p = d({ dx: 1 }), n = d({ dx: -1 }), q = d({ dz: 1 }), r = d({ dz: -1 });
  const U = [p[0] - n[0], p[1] - n[1]], V = [q[0] - r[0], q[1] - r[1]];
  const det = U[0] * V[1] - U[1] * V[0];
  assert.ok(Math.abs(det) > 1e-6, 'movement basis probe blocked at spawn');
  return (wx, wz) => {
    const a = (wx * V[1] - wz * V[0]) / det, b = (U[0] * wz - U[1] * wx) / det;
    const k = Math.max(Math.abs(a), Math.abs(b)) || 1;
    return { dx: a / k, dz: b / k };
  };
}
let steer = null;
// Closed-loop walk with legal inputs only (yaw 0); true if the point is reached.
function walk(m, s, tx, tz, sec) {
  steer ??= probeBasis();
  for (let t = 0; t < sec; t += DT) {
    const snap = m.snapshot(), p = snap.players[s];
    if (snap.phase !== 'live') return false;
    if (Math.hypot(tx - p.x, tz - p.z) < 0.2) { m.input(s, IN()); return true; }
    m.input(s, IN(steer(tx - p.x, tz - p.z)));
    m.step(DT);
  }
  m.input(s, IN());
  return false;
}
// Land one hit a->b. Spawns are opposite diagonal corners with no line of fire, so:
// 1) prove firing from spawn damages nobody, 2) walk both seats with legal inputs along
// known-free axis-aligned lanes to the shared open strip on z=24, 3) fire there.
function hit(m, a, b) {
  const s0 = m.snapshot(), hp0 = s0.players.map((p) => p.hp);
  assert.ok(s0.players[a].x * s0.players[b].x < 0, 'A and B should spawn in opposite corners');
  assert.equal(fireAt(m, a, b, 0.5), false, 'spawn must not offer a direct line of fire');
  const s1 = m.snapshot();
  assert.ok(s1.players[a].shots > s0.players[a].shots, 'A did fire from spawn');
  assert.deepEqual(s1.players.map((p) => p.hp), hp0, 'spawn fire must damage nobody');
  m.input(a, IN({ reload: true })); m.step(DT); m.input(a, IN());
  // West corner: up to z=24, then along x to 6. East corner: z=-30 lane to x=11, then along z to 24.
  const go = (s) => {
    const p = P(m, s);
    const pts = p.x < 0 ? [[p.x, 24], [6, 24]] : [[p.x, -30], [11, -30], [11, 24]];
    for (const [x, z] of pts) assert.ok(walk(m, s, x, z, 60), `slot ${s} did not reach (${x},${z})`);
  };
  go(b);
  go(a);
  assert.deepEqual(m.snapshot().players.map((p) => p.hp), hp0, 'walking must damage nobody');
  let how = fireAt(m, a, b, 0.6) ? 'open' : null;
  for (let k = 0; !how && k < 30 && m.snapshot().phase === 'live'; k++) {
    const pa = P(m, a), pb = P(m, b), gap = pb.x - pa.x;
    if (Math.abs(gap) < 3) break;
    walk(m, a, pa.x + Math.sign(gap) * 3, 24, 2);
    if (fireAt(m, a, b, 0.4)) how = 'closed';
  }
  if (!how) return null;
  // Exactly one hit: trigger is released, nothing else lands while the last input expires.
  const h1 = P(m, b).hp;
  assert.ok(h1 < hp0[b], 'B took the hit');
  for (let i = 0; i < 24 && m.snapshot().phase === 'live'; i++) m.step(DT);
  const s2 = m.snapshot();
  assert.equal(s2.players[b].hp, h1, 'only one hit should land');
  for (const p of s2.players) if (p.slot !== b) assert.equal(p.hp, hp0[p.slot], 'no incidental damage');
  return how;
}

try {
  // ---- seats: eight humans, 4+4, ninth denied ----
  const { m, slots } = full();
  assert.deepEqual([...slots].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  let s = m.snapshot();
  assert.ok(s.players.every((p) => !p.bot));
  assert.deepEqual([0, 1].map((t) => s.players.filter((p) => p.team === t).length), [4, 4]);
  assert.equal(slots[0] % 2, 0); assert.equal(slots[1] % 2, 1);
  assert.equal(m.join(), -1);
  assert.ok(m.snapshot().players.every((p) => !p.bot));
  const A = slots[0], B = slots[1], FULL = s.players[A].hp;
  out.seats = { slots, ninth: -1, a: [s.players[A].x, s.players[A].z], b: [s.players[B].x, s.players[B].z] };

  // ---- snapshots are isolated copies ----
  const keep = structuredClone(s);
  s.players[0].hp = 0; s.players.pop(); s.score[0] = 99; s.phase = 'finished';
  assert.deepEqual(m.snapshot(), keep);

  // ---- invalid input and bad steps change nothing ----
  for (const bad of [null, undefined, 7, 'x', [], {}, IN({ dx: NaN }), IN({ dz: Infinity }),
    IN({ yaw: '1' }), { dx: 1, dz: 0, yaw: 0 }, IN({ pitch: null })]) m.input(A, bad);
  for (const bs of [-1, 8, 1.5, NaN, '0', null, undefined]) { m.input(bs, IN({ yaw: 1 })); m.leave(bs); }
  for (const bd of [0, -1, NaN, Infinity, '1', null, undefined]) m.step(bd);
  assert.deepEqual(m.snapshot(), keep);
  m.input(A, IN({ yaw: 99, pitch: 9, fire: true }));
  s = m.snapshot();
  assert.ok(Math.abs(s.players[A].yaw) <= Math.PI + 1e-3 && Math.abs(s.players[A].pitch) <= Math.PI / 2 + 1e-3);
  for (let i = 0; i < 12; i++) { m.input(A, IN({ fire: true })); m.step(DT); }
  s = m.snapshot();
  assert.equal(s.phase, 'warmup');
  assert.equal(s.players[A].shots, 0, 'no firing in warmup');
  m.input(A, IN());

  // ---- step(100) is clamped to 0.25 s ----
  const c1 = createMatch(), c2 = createMatch(), c0 = c1.snapshot();
  c1.step(0.25); c2.step(100);
  assert.deepEqual(c2.snapshot(), c1.snapshot());
  assert.ok(c1.snapshot().seq > 0 && c0.seconds - c2.snapshot().seconds <= 0.26);
  out.ticksPerQuarterSecond = c2.snapshot().seq;

  // ---- movement clamp: dx=1e9 behaves exactly like dx=1 ----
  const big = full().m, unit = full().m;
  assert.ok(until(big, 'live') && until(unit, 'live'));
  const u0 = P(unit, 0);
  for (const [k, v] of [['dx', 1], ['dx', -1], ['dz', 1], ['dz', -1]]) {
    for (let i = 0; i < 10; i++) {
      big.input(0, IN({ [k]: v * 1e9 })); unit.input(0, IN({ [k]: v }));
      big.step(DT); unit.step(DT);
      assert.deepEqual(big.snapshot(), unit.snapshot());
    }
  }
  const u1 = unit.snapshot();
  assert.equal(u1.phase, 'live');
  out.clampChecked = true;
  void u0;

  // ---- input expiry: one stale input stops moving; resent input travels further ----
  let proven = false;
  for (const [k, v] of [['dx', 1], ['dx', -1], ['dz', 1], ['dz', -1]]) {
    const once = full().m, held = full().m;
    assert.ok(until(once, 'live') && until(held, 'live'));
    const o0 = P(once, 0), h0 = P(held, 0);
    once.input(0, IN({ [k]: v }));
    for (let i = 0; i < 100; i++) { held.input(0, IN({ [k]: v })); once.step(0.05); held.step(0.05); }
    const o1 = P(once, 0), h1 = P(held, 0);
    for (let i = 0; i < 20; i++) once.step(0.05);
    const o2 = P(once, 0);
    assert.deepEqual([o2.x, o2.z], [o1.x, o1.z], 'stale input must stop driving the seat');
    if (Math.hypot(h1.x - h0.x, h1.z - h0.z) > Math.hypot(o1.x - o0.x, o1.z - o0.z) + 0.5) proven = true;
  }
  assert.ok(proven, 'held input should outrun a single expired input');
  out.inputExpiry = true;

  // ---- round 1: A shoots B with legal inputs ----
  const trail = [];
  assert.ok(until(m, 'live', trail));
  const how = hit(m, A, B);
  assert.ok(how, 'no legal line of fire found from A to B');
  const hpTrace = [FULL, P(m, B).hp];
  assert.ok(hpTrace[1] < FULL && hpTrace[1] >= 0);
  out.firstHit = how;

  // friendly fire: A fires at a teammate, team hp untouched
  const mate = slots[2], before = m.snapshot();
  assert.equal(before.players[mate].team, before.players[A].team);
  assert.equal(fireAt(m, A, mate, 0.5), false);
  let now = m.snapshot();
  assert.ok(now.players[A].shots > before.players[A].shots, 'A did fire at the teammate');
  for (const p of now.players) if (p.team === before.players[A].team) assert.equal(p.hp, before.players[p.slot].hp);
  out.friendlyFireBlocked = true;

  // leave then rejoin the only free seat: same slot, same hp and position
  const rejoin = (label) => {
    const b0 = P(m, B);
    m.leave(B);
    assert.equal(P(m, B).bot, true);
    m.leave(B); // second leave is a no-op
    assert.equal(m.join(), B, label);
    const b1 = P(m, B);
    assert.equal(b1.bot, false);
    assert.deepEqual([b1.hp, b1.x, b1.z], [b0.hp, b0.x, b0.z], label);
    assert.equal(m.join(), -1);
  };
  rejoin('wounded seat keeps its hp');

  // ---- kill B: hp only goes down, then death ----
  for (let i = 0; i < 90 && P(m, B).hp > 0; i++) {
    if (fireAt(m, A, B, 1)) hpTrace.push(P(m, B).hp);
    else if (m.snapshot().phase !== 'live') break;
  }
  for (let i = 1; i < hpTrace.length; i++) assert.ok(hpTrace[i] < hpTrace[i - 1]);
  now = m.snapshot();
  assert.equal(now.players[B].hp, 0, 'B should be eliminated');
  assert.equal(now.players[A].kills, 1);
  assert.equal(now.phase, 'live');
  out.hpTrace = hpTrace;

  // ---- dead seat cannot shoot, move or turn ----
  const d0 = now.players[B], a0 = now.players[A];
  for (let i = 0; i < 30; i++) {
    const sn = m.snapshot();
    m.input(B, IN({ ...aim(sn.players[B], sn.players[A]), dx: 1, dz: 1, fire: true, reload: true, sprint: true }));
    m.step(DT);
  }
  now = m.snapshot();
  const d1 = now.players[B];
  assert.deepEqual([d1.hp, d1.shots, d1.x, d1.z, d1.yaw, d1.mag], [0, d0.shots, d0.x, d0.z, d0.yaw, d0.mag]);
  assert.equal(now.players[A].hp, a0.hp);
  m.input(B, IN());
  rejoin('dead seat stays dead, no respawn');
  for (let i = 0; i < 30; i++) m.step(DT);
  assert.equal(P(m, B).hp, 0);
  out.deadSeatInert = true;

  // ---- timeout outcome: more survivors wins, no invented kills ----
  const teamA = a0.team;
  assert.ok(until(m, 'result', trail));
  now = m.snapshot();
  assert.equal(now.winner, teamA);
  assert.equal(now.score[teamA], 1); assert.equal(now.score[1 - teamA], 0);
  assert.equal(now.players.reduce((n, p) => n + p.kills, 0), 1);

  // ---- rounds 2..5: one hit, then health tiebreak on timeout ----
  for (let want = 2; want <= 5; want++) {
    assert.ok(until(m, 'warmup', trail));
    now = m.snapshot();
    assert.equal(now.round, want);
    assert.equal(now.winner, -1);
    assert.ok(now.players.every((p) => p.hp === FULL && !p.bot), 'new round restores everyone');
    assert.ok(until(m, 'live', trail));
    assert.ok(hit(m, A, B), `round ${want}: no hit`);
    assert.ok(until(m, 'result', trail));
    now = m.snapshot();
    assert.equal(now.winner, teamA);
    assert.equal(now.score[teamA], want); assert.equal(now.score[1 - teamA], 0);
  }

  // ---- first to five finishes the match and stays finished ----
  assert.ok(until(m, 'finished', trail));
  const fin = m.snapshot();
  assert.equal(fin.winner, teamA);
  assert.equal(fin.score[teamA], 5); assert.equal(fin.round, 5);
  for (let i = 0; i < 8; i++) m.step(0.25);
  now = m.snapshot();
  assert.deepEqual([now.phase, now.score, now.winner, now.round], ['finished', fin.score, fin.winner, 5]);
  assert.match(trail.join(','), /^warmup,live,result(,warmup,live,result){4},finished$/);
  out.phases = trail.length; out.score = fin.score; out.rounds = fin.round;

  // ---- idle round: timeout draw, nobody scores ----
  const idle = full().m, it = [];
  assert.ok(until(idle, 'result', it));
  now = idle.snapshot();
  assert.deepEqual([now.winner, now.score], [-1, [0, 0]]);
  assert.ok(now.players.every((p) => p.hp === FULL && p.kills === 0));
  assert.ok(until(idle, 'warmup', it));
  assert.equal(idle.snapshot().round, 2);
  assert.deepEqual(it, ['warmup', 'live', 'result', 'warmup']);
  out.idleDraw = true;

  console.log(JSON.stringify({ ok: true, ...out }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e && e.message || e), partial: out }));
  process.exitCode = 1;
}
