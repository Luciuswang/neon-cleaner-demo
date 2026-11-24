// squads-sim.js — Riverfall online squads: pure host-authoritative simulation.
// No DOM, no dependencies, no wall-clock: time advances only through step(dt).
//
// GAME BINDINGS:
//   seats 0..7, team = slot % 2 (0 west, 1 east)
//   view dir: x = -sin(yaw)*cos(pitch), y = sin(pitch), z = -cos(yaw)*cos(pitch)
//   input(slot, {dx,dz,yaw,pitch,fire,reload,sprint}); dx/dz are world-relative, |v| <= 1
//   snapshot(): {seq,round,phase,seconds,score:[a,b],winner,players:[{slot,team,bot,
//                x,y,z,yaw,pitch,hp,mag,reload,kills,shots}]}
//     y = ground at feet; reload = seconds remaining; seconds = phase time remaining
//     winner: round winner during 'result', match winner when 'finished', else -1
//             (-1 during 'result' means a drawn round)
//   Not specified in the brief, chosen here: warmup after round 1 is 3s; players
//   are frozen during warmup; 30-round magazine, 105 ms cadence; 25 damage per hit.

import { terrainHeight, blocked, navigationBounds, wallTopAt, MAP } from './map-layout.js';

const SEATS = 8, WIN_SCORE = 5;
const TICK = 1 / 60, MAX_DT = 0.25;
const FIRST_WARMUP = 6, WARMUP = 3, ROUND_TIME = 75, RESULT_TIME = 4;
const INPUT_TTL = 0.35;
const RADIUS = 0.4, HEIGHT = 1.8, EYE = 1.6;
const WALK = 4.6, SPRINT = 7.2, BOT_SPEED = 4.2;
const HP = 100, DAMAGE = 25, MAG = 30;
const FIRE_INTERVAL = 0.105, RELOAD_TIME = 2.25;
const RANGE = 90, RAY_STEP = 0.15, HIT_RADIUS = 0.45;
const PITCH_LIMIT = 1.5;
const BOT_TURN = 3.2, BOT_REACT = 0.7, BOT_SPREAD = 0.03, BOT_AIM_OK = 0.08, BOT_RANGE = 20;
// Bot-only burst fire: 0.5s burst, then ~0.9-1.2s pause on a per-bot clock (human weapons untouched).
// Every bot gets the same reaction time and burst length; only the pause varies slightly.
const BOT_BURST = 0.5, BOT_PAUSE = 0.9, BOT_PAUSE_JITTER = 0.3;
function botPeriod(slot) { return BOT_BURST + BOT_PAUSE + (((slot + 1) * 0.618034) % 1) * BOT_PAUSE_JITTER; }

// ---------- map adapters ----------
const num = (v, d) => (Number.isFinite(v) ? v : d);
const BOUNDS = { minX: MAP.minX, maxX: MAP.maxX, minZ: MAP.minZ, maxZ: MAP.maxZ };
const BODY_Y = 1.7; // collision probe height above feet
const BUCKET = 4;   // metres per spatial bucket

function ground(x, z) { const h = terrainHeight(x, z); return Number.isFinite(h) ? h : 0; }
function inBounds(x, z, r) {
  return x - r >= BOUNDS.minX && x + r <= BOUNDS.maxX && z - r >= BOUNDS.minZ && z + r <= BOUNDS.maxZ;
}
function solid(x, z, r = RADIUS) {
  return !inBounds(x, z, r) || !!blocked(x, z, r, ground(x, z) + BODY_Y, 'enemy');
}

// Obstacle boxes bucketed on a 4 m grid for height-aware point tests.
const BW = Math.max(1, Math.ceil((BOUNDS.maxX - BOUNDS.minX) / BUCKET));
const BH = Math.max(1, Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / BUCKET));
const buckets = new Array(BW * BH).fill(null);
for (const o of (Array.isArray(navigationBounds) ? navigationBounds : [])) {
  if (!o || !o.min || !o.max) continue;
  if (o.max.x < BOUNDS.minX || o.min.x > BOUNDS.maxX || o.max.z < BOUNDS.minZ || o.min.z > BOUNDS.maxZ) continue;
  const i0 = Math.max(0, Math.floor((o.min.x - BOUNDS.minX) / BUCKET));
  const i1 = Math.min(BW - 1, Math.floor((o.max.x - BOUNDS.minX) / BUCKET));
  const j0 = Math.max(0, Math.floor((o.min.z - BOUNDS.minZ) / BUCKET));
  const j1 = Math.min(BH - 1, Math.floor((o.max.z - BOUNDS.minZ) / BUCKET));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const c = j * BW + i;
    (buckets[c] || (buckets[c] = [])).push(o);
  }
}
// True if the point is inside an obstacle, respecting its real top height.
function obstacleAt(x, y, z) {
  const i = Math.floor((x - BOUNDS.minX) / BUCKET), j = Math.floor((z - BOUNDS.minZ) / BUCKET);
  if (i < 0 || j < 0 || i >= BW || j >= BH) return false;
  const list = buckets[j * BW + i];
  if (!list) return false;
  for (let n = 0; n < list.length; n++) {
    const o = list[n];
    if (x < o.min.x || x > o.max.x || z < o.min.z || z > o.max.z) continue;
    if (y < o.min.y || y > o.max.y) continue;
    if (!o.profileWall) return true;
    // Irregular top: consult the profile only once inside the box.
    if (y < wallTopAt(o.profileWall, x, z, 0)) return true;
  }
  return false;
}

// ---------- math ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function wrap(a) { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; }
const r3 = (v) => Math.round(v * 1000) / 1000;
function rng32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- line of sight (terrain + height-aware obstacles) ----------
function occluded(x, y, z) {
  if (!inBounds(x, z, 0)) return true;
  if (obstacleAt(x, y, z)) return true;
  return y < ground(x, z);
}
function clearLine(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  const n = Math.max(1, Math.ceil(d / 0.3));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (occluded(ax + dx * t, ay + dy * t, az + dz * t)) return false;
  }
  return true;
}

// ---------- navigation grid for bots ----------
let grid = null;
function getGrid() {
  if (grid) return grid;
  const w = BOUNDS.maxX - BOUNDS.minX, h = BOUNDS.maxZ - BOUNDS.minZ;
  const cell = Math.max(1.5, Math.sqrt((w * h) / 6000));
  const W = Math.max(1, Math.ceil(w / cell)), H = Math.max(1, Math.ceil(h / cell));
  const pass = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    pass[j * W + i] = solid(BOUNDS.minX + (i + 0.5) * cell, BOUNDS.minZ + (j + 0.5) * cell, RADIUS) ? 0 : 1;
  }
  grid = { cell, W, H, pass };
  return grid;
}
function cellOf(x, z) {
  const g = getGrid();
  const i = clamp(Math.floor((x - BOUNDS.minX) / g.cell), 0, g.W - 1);
  const j = clamp(Math.floor((z - BOUNDS.minZ) / g.cell), 0, g.H - 1);
  return j * g.W + i;
}
function cellCenter(c) {
  const g = getGrid();
  return [BOUNDS.minX + ((c % g.W) + 0.5) * g.cell, BOUNDS.minZ + (Math.floor(c / g.W) + 0.5) * g.cell];
}
// Breadth-first distance field from a target cell (4-connected).
function distanceField(target) {
  const g = getGrid(), N = g.W * g.H;
  const dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let head = 0, tail = 0;
  dist[target] = 0; q[tail++] = target; // target seeded even if impassable
  while (head < tail) {
    const c = q[head++], i = c % g.W, j = (c - i) / g.W, d = dist[c] + 1;
    if (i > 0) visit(c - 1);
    if (i < g.W - 1) visit(c + 1);
    if (j > 0) visit(c - g.W);
    if (j < g.H - 1) visit(c + g.W);
    function visit(n) { if (dist[n] < 0 && g.pass[n]) { dist[n] = d; q[tail++] = n; } }
  }
  return dist;
}

// ---------- spawns ----------
const WEST_SPAWNS = [[-27,20],[-23.8,18.6],[-25.9,23.3],[-22.4,21.7]];
const EAST_SPAWNS = [[24,-29],[27,-27],[26,-32],[22,-26]];
const WEST_ROUTE = [[[-12,22],[-14,24],[-10,24],[-12,20]],[[-10,14],[-12,12],[-8,14],[-12,8]]];
function spawnPoint(slot) { // returns [x, z]
  return (slot % 2 ? EAST_SPAWNS : WEST_SPAWNS)[(slot >> 1) % 4];
}
function routePoint(slot, leg) { // east = 180 deg rotation about [0,-4]
  const w = WEST_ROUTE[leg][(slot >> 1) % 4];
  return slot % 2 ? [-w[0], -8 - w[1]] : w;
}

// ---------- input sanitising ----------
function neutralInput() { return { dx: 0, dz: 0, fire: false, reload: false, sprint: false }; }
// Returns a clean input or null. Only the documented fields are ever read.
function sanitize(p) {
  if (p === null || typeof p !== 'object') return null;
  const { dx, dz, yaw, pitch } = p;
  if (typeof dx !== 'number' || typeof dz !== 'number' || typeof yaw !== 'number' || typeof pitch !== 'number') return null;
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
  let mx = clamp(dx, -1, 1), mz = clamp(dz, -1, 1);
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  return {
    dx: mx, dz: mz,
    yaw: wrap(yaw), pitch: clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT),
    fire: p.fire === true, reload: p.reload === true, sprint: p.sprint === true,
  };
}

// ---------- match ----------
export function createMatch() {
  const rand = rng32(0x52495646);
  const players = [];
  let seq = 0, round = 1, phase = 'warmup', seconds = FIRST_WARMUP;
  let winner = -1, acc = 0;
  const score = [0, 0];

  for (let slot = 0; slot < SEATS; slot++) {
    players.push({
      slot, team: slot % 2, bot: true,
      x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
      hp: HP, mag: MAG, reload: 0, cooldown: 0, kills: 0, shots: 0,
      in: neutralInput(), age: 0,
      ai: { field: null, target: -1, repath: 0, seen: 0, strafe: 1, strafeT: 0, stuck: 0, dodge: 0, dodgeA: 0 },
    });
  }
  resetRound();

  function resetRound() {
    for (const p of players) {
      const [x, z] = spawnPoint(p.slot);
      p.x = x; p.z = z; p.y = ground(x, z);
      p.pitch = 0;
      p.hp = HP; p.mag = MAG; p.reload = 0; p.cooldown = 0;
      p.in = neutralInput(); p.age = 0;
      const a = p.ai;
      {
        const seat = (p.slot >> 1) % 4, w = routePoint(p.slot, 0);
        a.rn = (a.rn || 0) + 1; // per-agent round counter, deterministic variation
        const v = (a.rn * 7 + seat * 3) % 5, u = (a.rn * 3 + seat) % 3;
        a.leg = 0; a.hx = 0; a.hz = 0;
        a.ox = (v - 2) * 0.25; a.oz = (u - 1) * 0.3; // subtle second-destination offset (west frame, mirrored in goal)
        a.wait = 0.1 * seat + 0.08 * ((a.rn + seat) % 3); // short start stagger
        a.pace = 1 - 0.03 * seat - 0.02 * ((a.rn * 2 + seat) % 3); // own pace <= 1
        p.yaw = Math.atan2(-(w[0] - p.x), -(w[1] - p.z)); // assumes forward = (-sin yaw, -cos yaw)
      }
      a.field = null; a.target = -1; a.repath = 0; a.seen = 0; a.strafeT = 0; a.stuck = 0; a.dodge = 0;
    }
  }

  function validSlot(s) { return Number.isInteger(s) && s >= 0 && s < SEATS; }

  function join() {
    const humans = [0, 0];
    for (const p of players) if (!p.bot) humans[p.team]++;
    const prefer = humans[0] <= humans[1] ? 0 : 1;
    for (const team of [prefer, 1 - prefer]) {
      for (const p of players) {
        if (p.bot && p.team === team) { // human inherits the bot's life and state
          p.bot = false; p.in = neutralInput(); p.age = 0;
          return p.slot;
        }
      }
    }
    return -1;
  }

  function leave(slot) {
    if (!validSlot(slot)) return;
    const p = players[slot];
    if (p.bot) return;
    p.bot = true; // bot continues from the same state
    if (phase === 'live') { p.ai.leg = 2; p.ai.wait = 0; }
    p.in = neutralInput(); p.age = 0;
    p.ai.field = null; p.ai.repath = 0; p.ai.seen = 0;
  }

  function input(slot, raw) {
    if (!validSlot(slot)) return;
    const p = players[slot];
    if (p.bot) return;
    const c = sanitize(raw);
    if (!c) return;
    p.in = { dx: c.dx, dz: c.dz, fire: c.fire, reload: c.reload, sprint: c.sprint };
    p.age = 0;
    if (p.hp > 0) { p.yaw = c.yaw; p.pitch = c.pitch; }
  }

  // ----- movement: one routine for humans and bots -----
  function move(p, dx, dz, speed, dt) {
    const sx = dx * speed * dt, sz = dz * speed * dt;
    const ox = p.x, oz = p.z;
    if (sx !== 0 && !solid(p.x + sx, p.z, RADIUS)) p.x += sx;
    if (sz !== 0 && !solid(p.x, p.z + sz, RADIUS)) p.z += sz;
    p.y = ground(p.x, p.z);
    return Math.hypot(p.x - ox, p.z - oz);
  }

  // ----- weapons: one host-side ray routine for humans and bots -----
  function shoot(p, yaw, pitch) {
    p.mag--; p.shots++; p.cooldown = FIRE_INTERVAL;
    const cp = Math.cos(pitch);
    const vx = -Math.sin(yaw) * cp, vy = Math.sin(pitch), vz = -Math.cos(yaw) * cp;
    const ox = p.x, oy = p.y + EYE, oz = p.z;
    for (let t = RAY_STEP; t <= RANGE; t += RAY_STEP) {
      const x = ox + vx * t, y = oy + vy * t, z = oz + vz * t;
      if (occluded(x, y, z)) return;
      for (const e of players) {
        if (e.team === p.team || e.hp <= 0) continue; // no friendly fire
        if (y < e.y || y > e.y + HEIGHT) continue;
        const ex = x - e.x, ez = z - e.z;
        if (ex * ex + ez * ez > HIT_RADIUS * HIT_RADIUS) continue;
        e.hp = Math.max(0, e.hp - DAMAGE);
        if (e.hp === 0) p.kills++;
        return;
      }
    }
  }

  function weapon(p, wantFire, wantReload, yaw, pitch, dt) {
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.reload > 0) {
      p.reload = Math.max(0, p.reload - dt);
      if (p.reload === 0) p.mag = MAG;
      return;
    }
    if ((wantReload && p.mag < MAG) || p.mag === 0) { p.reload = RELOAD_TIME; return; }
    if (wantFire && p.cooldown === 0) shoot(p, yaw, pitch);
  }

  // ----- bots -----
  function nearestEnemy(p) {
    let best = null, bd = Infinity;
    for (const e of players) {
      if (e.team === p.team || e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function routeDir(p, e, dt) {
    const a = p.ai, g = getGrid();
    a.repath -= dt;
    const tc = cellOf(e.x, e.z);
    if (!a.field || a.repath <= 0 || a.target !== tc) {
      a.field = distanceField(tc); a.target = tc; a.repath = 0.75;
    }
    const c = cellOf(p.x, p.z), i = c % g.W, j = (c - i) / g.W;
    let best = -1, bd = a.field[c] >= 0 ? a.field[c] : Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.W || nj >= g.H) continue;
      const n = nj * g.W + ni;
      if (!g.pass[n] || a.field[n] < 0) continue;
      // no diagonal corner cutting
      if (di && dj && (!g.pass[j * g.W + ni] || !g.pass[nj * g.W + i])) continue;
      const cost = a.field[n] + (di && dj ? 0.4 : 0);
      if (cost < bd) { bd = cost; best = n; }
    }
    let tx = e.x, tz = e.z;
    if (best >= 0) [tx, tz] = cellCenter(best);
    const dx = tx - p.x, dz = tz - p.z, len = Math.hypot(dx, dz);
    return len > 1e-6 ? [dx / len, dz / len] : [0, 0];
  }

  function botStep(p, dt) {
    const a = p.ai;
    const e = nearestEnemy(p);
    if (!e) { weapon(p, false, p.mag < MAG, p.yaw, p.pitch, dt); return; }
    const ex = e.x - p.x, ez = e.z - p.z, dist = Math.hypot(ex, ez);
    const los = dist < BOT_RANGE &&
      clearLine(p.x, p.y + EYE, p.z, e.x, e.y + HEIGHT * 0.6, e.z);
    a.seen = los ? a.seen + dt : 0;

    // movement
    let mx = 0, mz = 0;
    if (a.dodge > 0) { // unstick sidestep
      a.dodge -= dt; mx = Math.cos(a.dodgeA); mz = Math.sin(a.dodgeA);
    } else if (los && dist < 16) { // engage: strafe instead of rushing
      a.strafeT -= dt;
      if (a.strafeT <= 0) { a.strafe = rand() < 0.5 ? -1 : 1; a.strafeT = 0.8 + rand() * 0.9; }
      if (dist > 1e-6) { mx = (-ez / dist) * a.strafe; mz = (ex / dist) * a.strafe; }
    } else {
      if (!(a.leg >= 0) || ROUND_TIME - seconds >= 12) a.leg = 2; // unset leg or timeout => hunt
      const wp = l => { const r = routePoint(p.slot, l), s = p.slot % 2 ? -1 : 1; return l === 1 ? [r[0] + s * (a.ox || 0), r[1] + s * (a.oz || 0)] : r; };
      let w = a.leg < 2 ? wp(a.leg) : null;
      if (w && Math.hypot(w[0] - p.x, w[1] - p.z) < 1.5) w = ++a.leg < 2 ? wp(a.leg) : null;
      const tg = w ? { x: w[0], z: w[1] } : e;
      let gd = routeDir(p, tg, dt);
      if (!gd || Math.hypot(gd[0], gd[1]) < 0.05) { // same nav cell: go direct instead of zero velocity
        const tx = tg ? tg.x - p.x : 0, tz = tg ? tg.z - p.z : 0, tl = Math.hypot(tx, tz);
        gd = tl > 0.3 ? [tx / tl, tz / tl] : [0, 0];
      }
      const gk = clamp(dt * 10, 0, 1); // sustain personal heading, no jitter
      a.hx = (a.hx || 0) + (gd[0] - (a.hx || 0)) * gk;
      a.hz = (a.hz || 0) + (gd[1] - (a.hz || 0)) * gk;
      mx = a.hx; mz = a.hz;
      if (Math.hypot(mx, mz) < 0.05) { mx = gd[0]; mz = gd[1]; }
    }
    let sx = mx, sz = mz, sp = clamp(a.pace || 1, 0, 1);
    const near = [];
    if (a.wait > 0) { a.wait -= dt; sx = sz = mx = mz = 0; }
    else for (const q of players) {
      if (q === p || q.hp <= 0 || q.team !== p.team) continue;
      let dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz);
      if (d >= 1.8) continue;
      let nx, nz;
      if (d < 0.05) { const t = p.slot * 2.4; nx = Math.cos(t); nz = Math.sin(t); } // coincident: split by slot
      else { nx = dx / d; nz = dz / d; }
      const k = clamp((1.8 - d) / 1.8, 0, 1), f = k * (0.6 + 1.2 * k); // stronger when close
      sx += nx * f; sz += nz * f;
      if (d < 0.82) near.push([nx, nz, d]);
      if (p.slot > q.slot && mx * nx + mz * nz < 0) sp = Math.min(sp, 0.45 + 0.3 * d / 1.8); // higher slot yields, never stops
    }
    for (const c of near) { // never step further into overlap; slide on bounded tangent instead of stalling
      const into = sx * c[0] + sz * c[1];
      if (into < 0) { sx -= into * c[0]; sz -= into * c[1]; }
      const cr = mz * c[0] - mx * c[1];
      const side = Math.abs(cr) > 0.05 ? Math.sign(cr) : ((p.slot >> 1) & 1 ? 1 : -1);
      const tg = 0.25 + 0.5 * (1 - c[2] / 0.82);
      sx += -c[1] * side * tg; sz += c[0] * side * tg;
    }
    let sl = Math.hypot(sx, sz);
    if (sl < 0.05 && !near.length) { sx = mx; sz = mz; sl = Math.hypot(sx, sz); }
    if (sl > 1) { sx /= sl; sz /= sl; } // move() does not normalize
    const moved = move(p, sx, sz, BOT_SPEED * clamp(sp, 0, 1), dt);
    if ((mx || mz) && moved < BOT_SPEED * dt * 0.2) {
      a.stuck += dt;
      if (a.stuck > 0.5) { a.stuck = 0; a.dodge = 0.5; a.dodgeA = rand() * Math.PI * 2; a.strafe = -a.strafe; }
    } else a.stuck = 0;

    // aim: rate-limited turning, never snaps
    let wantYaw, wantPitch = 0;
    if (los) {
      wantYaw = Math.atan2(-ex, -ez);
      wantPitch = Math.atan2((e.y + HEIGHT * 0.6) - (p.y + EYE), Math.max(dist, 0.01));
    } else if (mx || mz) wantYaw = Math.atan2(-mx, -mz);
    else wantYaw = p.yaw;
    const maxTurn = BOT_TURN * dt;
    const dy = wrap(wantYaw - p.yaw), dp = wantPitch - p.pitch;
    p.yaw = wrap(p.yaw + clamp(dy, -maxTurn, maxTurn));
    p.pitch = clamp(p.pitch + clamp(dp, -maxTurn, maxTurn), -PITCH_LIMIT, PITCH_LIMIT);

    // fire: needs line of sight, reaction delay, settled aim; shots carry spread
    const aimed = Math.abs(wrap(wantYaw - p.yaw)) < BOT_AIM_OK && Math.abs(wantPitch - p.pitch) < BOT_AIM_OK;
    const burstT = a.seen - BOT_REACT;
    const fire = los && burstT >= 0 && (burstT % botPeriod(p.slot)) < BOT_BURST && aimed;
    const jy = (rand() - 0.5) * 2 * BOT_SPREAD, jp = (rand() - 0.5) * 2 * BOT_SPREAD;
    weapon(p, fire, !los && p.mag < MAG / 2, wrap(p.yaw + jy), clamp(p.pitch + jp, -PITCH_LIMIT, PITCH_LIMIT), dt);
  }

  function humanStep(p, dt) {
    p.age += dt;
    if (p.age > INPUT_TTL) p.in = neutralInput(); // stale input expires; view is kept
    const c = p.in;
    move(p, c.dx, c.dz, c.sprint ? SPRINT : WALK, dt);
    weapon(p, c.fire, c.reload, p.yaw, p.pitch, dt);
  }

  // ----- round flow -----
  function tally() {
    const alive = [0, 0], health = [0, 0];
    for (const p of players) if (p.hp > 0) { alive[p.team]++; health[p.team] += p.hp; }
    return { alive, health };
  }

  function endRound(w) {
    winner = w;
    if (w >= 0) score[w]++;
    phase = 'result'; seconds = RESULT_TIME;
  }

  function tick(dt) {
    seq++;
    if (phase === 'finished') return;
    if (phase === 'warmup') {
      for (const p of players) if (!p.bot) p.age += dt;
      seconds -= dt;
      if (seconds <= 0) { phase = 'live'; seconds = ROUND_TIME; }
      return;
    }
    if (phase === 'result') {
      seconds -= dt;
      if (seconds <= 0) {
        if (score[0] >= WIN_SCORE || score[1] >= WIN_SCORE) {
          phase = 'finished'; seconds = 0;
          winner = score[0] >= WIN_SCORE ? 0 : 1;
        } else {
          round++; winner = -1; phase = 'warmup'; seconds = WARMUP;
          resetRound();
        }
      }
      return;
    }
    // live
    for (const p of players) {
      if (p.hp <= 0) continue; // one life per round; eliminated players spectate
      if (p.bot) botStep(p, dt); else humanStep(p, dt);
    }
    seconds -= dt;
    const { alive, health } = tally();
    if (alive[0] === 0 || alive[1] === 0) {
      endRound(alive[0] > 0 ? 0 : alive[1] > 0 ? 1 : -1);
    } else if (seconds <= 0) {
      // timed outcome: survivors, then total health, then draw; no kills are invented
      seconds = 0;
      if (alive[0] !== alive[1]) endRound(alive[0] > alive[1] ? 0 : 1);
      else if (health[0] !== health[1]) endRound(health[0] > health[1] ? 0 : 1);
      else endRound(-1);
    }
  }

  function step(dt) {
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return;
    acc += Math.min(dt, MAX_DT);
    while (acc >= TICK - 1e-9) { acc -= TICK; tick(TICK); } // fixed host step
    if (acc < 0) acc = 0;
  }

  function snapshot() {
    return {
      seq, round, phase,
      seconds: r3(Math.max(0, seconds)),
      score: [score[0], score[1]],
      winner,
      players: players.map((p) => ({
        slot: p.slot, team: p.team, bot: p.bot,
        x: r3(p.x), y: r3(p.y), z: r3(p.z),
        yaw: r3(p.yaw), pitch: r3(p.pitch),
        hp: p.hp, mag: p.mag, reload: r3(p.reload),
        kills: p.kills, shots: p.shots,
      })),
    };
  }

  return { join, leave, input, step, snapshot };
}
