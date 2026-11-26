#!/usr/bin/env node
// qa/squads-network.mjs — independent network QA for Riverfall squads (real WebRTC, real signaling).
// Local:  node qa/squads-network.mjs            (game server :5190/river/, PeerServer :5193/squads, started externally)
// Cloud:  node qa/squads-network.mjs --cloud    (real PeerJS Cloud defaults; BASE_URL may point at published Pages)
// Opt-in: --capacity (local only; 9 browser contexts over real WebRTC)
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');

const CLOUD = process.argv.includes('--cloud');
const CAPACITY = process.argv.includes('--capacity');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const rawBase = process.env.BASE_URL || 'http://127.0.0.1:5190/river/';
const BASE = new URL(rawBase.endsWith('/') ? rawBase : new URL('./', rawBase).href);
const PAGE_PATH = 'peer-notice.html';
const PAGE_URL = new URL(PAGE_PATH, BASE).href + (CLOUD ? '' : '?signal=local');
const MOD_URL = new URL('squads-net.js', BASE).href;

// Assumptions about the shipped module that the brief did not pin down (override by env).
const [ACT_CREATE, ACT_JOIN, ACT_QUICK] = (process.env.SQUADS_ACTIONS || 'create,join,quick').split(',');
const LIVE = process.env.SQUADS_LIVE_PHASE || 'live';
const AXES = (process.env.SQUADS_INPUT_AXES || 'dx,dz').split(',');

const T = {
  connect: CLOUD ? 45000 : 30000,
  roster: CLOUD ? 45000 : 30000,
  live: 60000,
  move: 16000,
  result: 95000,
  leave: 25000,
  quick: 45000,
};



const issues = [];
const secrets = new Set();
const ev = { tool: 'squads-network', mode: CLOUD ? 'cloud' : 'local', base: BASE.href, startedAt: new Date().toISOString(), assumptions: { actions: [ACT_CREATE, ACT_JOIN, ACT_QUICK], livePhase: LIVE, inputAxes: AXES } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function redact(v) {
  let s = String(v);
  for (const x of [...secrets].sort((a, b) => b.length - a.length)) s = s.replace(new RegExp(escapeRe(x), 'g'), '<redacted>');
  return s
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, '<ip>')
    .slice(0, 300);
}
function issue(msg) { issues.push(redact(msg)); }
function secret(s) { if (s && String(s).length >= 3) secrets.add(String(s)); }

async function waitFor(fn, timeout, step = 150) {
  const end = Date.now() + timeout;
  for (;;) {
    let v = null;
    try { v = await fn(); } catch { v = null; }
    if (v) return v;
    if (Date.now() >= end) return null;
    await sleep(step);
  }
}
function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' timed out after ' + ms + 'ms')), ms); }),
  ]).finally(() => clearTimeout(t));
}

// ---------- in-page harness (runs inside each independent browser context) ----------
async function pageInit({ modUrl, live }) {
  const q = (window.__qa = { n: 0, last: null, slot: null, key: '', hist: [], status: [], ends: [], base: {}, move: {}, handle: null, timer: null, sent: 0, sendErr: null, dir: 0, live });
  q.mod = await import(modUrl);
  if (typeof q.mod.connectRoom !== 'function') throw new Error('squads-net.js does not export connectRoom');
}
async function pageConnect({ action, room }) {
  const q = window.__qa;
  const opts = {
    action,
    onState(s, slot) {
      q.n++; q.last = s; q.slot = slot;
      if (!s || typeof s !== 'object') return;
      const key = [s.round, s.phase, JSON.stringify(s.score), JSON.stringify(s.winner === undefined ? null : s.winner)].join('|');
      if (key !== q.key) {
        q.key = key;
        if (q.hist.length < 300) q.hist.push({ round: s.round, phase: s.phase, score: s.score, winner: s.winner === undefined ? null : s.winner, seq: s.seq });
      }
      if (s.phase === q.live && Array.isArray(s.players)) {
        for (const p of s.players) {
          const k = s.round + ':' + p.slot;
          const b = q.base[k] || (q.base[k] = { x: p.x, z: p.z });
          const d = Math.hypot(p.x - b.x, p.z - b.z);
          if (d > (q.move[k] || 0)) q.move[k] = Math.round(d * 1000) / 1000;
        }
      }
    },
    onStatus(t) { if (q.status.length < 100) q.status.push(String(t).slice(0, 200)); },
    onEnd(t) { if (q.ends.length < 20) q.ends.push(String(t).slice(0, 200)); },
  };
  if (room) opts.room = room;
  q.handle = await q.mod.connectRoom(opts);
  if (!q.handle || typeof q.handle.send !== 'function' || typeof q.handle.close !== 'function') throw new Error('connectRoom returned no usable handle');
}
function pageSummary() {
  const q = window.__qa, s = q.last, h = q.handle;
  const ps = s && Array.isArray(s.players) ? s.players : [];
  const teams = {};
  for (const p of ps) teams[p.team] = (teams[p.team] || 0) + 1;
  return {
    n: q.n, slot: q.slot,
    id: h && h.id != null ? String(h.id) : '', room: h && h.room != null ? String(h.room) : '',
    seq: s ? s.seq : null, phase: s ? s.phase : null, round: s ? s.round : null, seconds: s ? s.seconds : null,
    canStart: !!h && typeof h.start === 'function',
    score: s ? s.score : null, winner: s && s.winner !== undefined ? s.winner : null,
    count: ps.length, humans: ps.filter((p) => !p.bot).length, bots: ps.filter((p) => !!p.bot).length,
    humanSlots: ps.filter((p) => !p.bot).map((p) => p.slot).sort((a, b) => a - b),
    slots: ps.map((p) => p.slot).sort((a, b) => a - b), teams: Object.values(teams).sort((a, b) => a - b),
    selfHuman: ps.some((p) => p.slot === q.slot && !p.bot),
    hist: q.hist, status: q.status.slice(-12), ends: q.ends, move: q.move, sent: q.sent, sendErr: q.sendErr,
  };
}
function pageStartInput({ axes }) {
  const q = window.__qa;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]; // lateral first, never firing: "safe"
  clearInterval(q.timer);
  q.timer = setInterval(() => {
    const s = q.last;
    if (!s || !q.handle) return;
    const me = Array.isArray(s.players) ? s.players.find((p) => p.slot === q.slot) : null;
    const d = DIRS[q.dir % DIRS.length];
    const input = { [axes[0]]: d[0], [axes[1]]: d[1], yaw: me ? me.yaw : 0, pitch: me ? me.pitch : 0, fire: false, reload: false };
    try { q.handle.send(input); q.sent++; } catch (e) { q.sendErr = String(e && e.message ? e.message : e).slice(0, 200); }
  }, 1000 / 18);
}
function pageClose() {
  const q = window.__qa;
  if (!q) return;
  clearInterval(q.timer);
  if (q.handle) q.handle.close();
}

// ---------- node-side helpers ----------
let browser = null;
const players = new Set();

async function open(name) {
  const context = await browser.newContext(); // fully independent player: own storage, own WebRTC stack
  const p = { name, context, page: null, errors: [], closed: false, mark: 0 };
  players.add(p);

  p.page = await context.newPage();
  p.page.on('pageerror', (e) => { if (p.errors.length < 10) p.errors.push('pageerror: ' + e.message); });
  p.page.on('console', (m) => { if (m.type() === 'error' && p.errors.length < 10) p.errors.push('console: ' + m.text()); });
  await p.page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });
  await p.page.evaluate(pageInit, { modUrl: MOD_URL, live: LIVE });
  return p;
}

async function sum(p) {
  const s = await p.page.evaluate(pageSummary);
  secret(s.id); secret(s.room);
  return s;
}
function pub(s, p) { // evidence without room/peer ids
  if (!s) return null;
  const { id, room, ...rest } = s;
  return { ...rest, status: s.status.map(redact), ends: s.ends.map(redact), errors: p ? p.errors.map(redact) : [] };
}
async function connect(p, action, room) {
  try {
    await withTimeout(p.page.evaluate(pageConnect, { action, room: room || null }), T.connect, p.name + ' connectRoom(' + action + ')');
    return true;
  } catch (e) {
    let st = [];
    try { st = (await sum(p)).status.slice(-3); } catch {}
    issue(p.name + ': ' + action + ' failed: ' + e.message + ' | last status: ' + JSON.stringify(st));
    return false;
  }
}
async function roomOf(p) {
  const s = await waitFor(async () => { const x = await sum(p); return x.room ? x : null; }, 20000);
  return s ? s.room : '';
}
async function close(p) {
  if (!p || p.closed) return;
  p.closed = true;
  try { await withTimeout(p.page.evaluate(pageClose), 5000, 'close'); } catch {}
  try { await p.context.close(); } catch {}
  players.delete(p);
}
async function waitRoster(p, humans, timeout) {
  return waitFor(async () => { const s = await sum(p); return s.humans === humans && s.bots === 8 - humans ? s : null; }, timeout);
}
// Waiting-room contract: humans only, no AI fill, phase 'lobby', seconds === 0.
async function waitLobby(p, humans, timeout) {
  return waitFor(async () => { const s = await sum(p); return s.humans === humans && s.bots === 0 && s.phase === 'lobby' && s.seconds === 0 ? s : null; }, timeout);
}
// The waiting room must stay put: phase 'lobby', seconds 0, no bots, not live, no countdown ticking.
async function lobbyHolds(p, humans, ms) {
  const a = await sum(p);
  await sleep(ms);
  const b = await sum(p);
  const bad = [];
  if (b.humans !== humans) bad.push('humans=' + b.humans);
  if (b.bots !== 0) bad.push('bots=' + b.bots);
  if (b.phase !== 'lobby') bad.push('phase=' + b.phase);
  if (b.seconds !== 0) bad.push('seconds=' + b.seconds);
  if (b.phase === LIVE) bad.push('phase is live');
  if (b.phase !== a.phase || b.round !== a.round) bad.push('phase/round advanced ' + a.round + ':' + a.phase + ' -> ' + b.round + ':' + b.phase);
  if (typeof a.seconds === 'number' && typeof b.seconds === 'number' && b.seconds < a.seconds) bad.push('countdown ticking ' + a.seconds + ' -> ' + b.seconds);
  if (bad.length) issue(p.name + ': waiting room did not hold: ' + bad.join('; '));
  return bad.length ? null : b;
}
// Raw handle.start() result from the page; 'no-start' when the handle has no callable start (guests).
async function startResult(p) {
  return withTimeout(p.page.evaluate(async () => { const h = window.__qa.handle; if (!h || typeof h.start !== 'function') return 'no-start'; const r = await h.start(); return r === undefined ? null : r; }), T.connect, p.name + ' handle.start()');
}
// Host-only explicit start, run locally in the host page.
async function startMatch(p) {
  try {
    const r = await startResult(p);
    if (r === 'no-start') { issue(p.name + ': handle has no callable start()'); return false; }
    if (r === false) { issue(p.name + ': handle.start() returned false'); return false; }
    return true;
  } catch (e) {
    issue(p.name + ': handle.start() failed: ' + e.message);
    return false;
  }
}
function fullShape(s) { // non-reporting twin of shapeCheck
  return s.count === 8 && s.slots.join() === '0,1,2,3,4,5,6,7' && s.teams.join() === '4,4' && s.selfHuman;
}
async function describe(p) {
  try { const s = await sum(p); return 'n=' + s.n + ' phase=' + s.phase + ' humans=' + s.humans + ' bots=' + s.bots + ' status=' + JSON.stringify(s.status.slice(-2)) + ' ends=' + JSON.stringify(s.ends); } catch (e) { return 'unreadable: ' + e.message; }
}
function shapeCheck(name, s) {
  const bad = [];
  if (s.count !== 8) bad.push('players=' + s.count);
  if (s.slots.join() !== '0,1,2,3,4,5,6,7') bad.push('slots=' + s.slots.join());
  if (s.teams.join() !== '4,4') bad.push('teams=' + s.teams.join());
  if (!s.selfHuman) bad.push('local slot ' + s.slot + ' is not a human player');
  if (bad.length) issue(name + ': bad 8-slot shape: ' + bad.join('; '));
  return bad.length === 0;
}
function moveOf(s, slot) {
  let m = 0;
  for (const [k, v] of Object.entries(s.move)) if (Number(k.split(':')[1]) === slot && v > m) m = v;
  return m;
}
function resultOf(hist, from = 0) { // first non-live entry that directly follows a live entry
  for (let i = Math.max(1, from); i < hist.length; i++) if (hist[i - 1].phase === LIVE && hist[i].phase !== LIVE) return hist[i];
  return null;
}
const core = (h) => JSON.stringify({ round: h.round, phase: h.phase, score: h.score, winner: h.winner });

// ---------- scenarios ----------
async function privateMatch() {
  const out = (ev.privateRoom = {});
  const host = await open('host');
  if (!(await connect(host, ACT_CREATE))) return null;
  const room = await roomOf(host);
  if (!room) { issue('host: no room code exposed on handle after create (' + (await describe(host)) + ')'); return null; }
  out.created = true;

  // waiting room: host alone, phase lobby, seconds 0, no AI fill, no countdown
  const lobby = (out.lobby = {});
  const alone = await waitLobby(host, 1, T.roster);
  if (!alone) issue('host alone is not in an unstarted, bot-free waiting room (' + (await describe(host)) + ')');
  lobby.hostAlone = !!alone && !!(await lobbyHolds(host, 1, 2500));

  // lone host: handle.start() must explicitly return false and leave the waiting room untouched
  let lone;
  try { lone = await startResult(host); } catch (e) { lone = 'threw: ' + e.message; }
  if (lone !== false) issue('host: lone handle.start() should return false, got ' + String(lone));
  lobby.loneStartRefused = lone === false && !!(await lobbyHolds(host, 1, 1000));

  const guest = await open('guest');
  if (!(await connect(guest, ACT_JOIN, room))) return { host, guest: null, room };

  // second human joins: 2 humans + 0 AI on both peers, and joining must not start the match
  const [lh, lg] = await Promise.all([waitLobby(host, 2, T.roster), waitLobby(guest, 2, T.roster)]);
  if (!lh || !lg) issue('waiting room did not converge to 2 humans + 0 AI, unstarted: host ' + (await describe(host)) + ' / guest ' + (await describe(guest)));
  lobby.both = !!lh && !!lg && (await Promise.all([lobbyHolds(host, 2, 2500), lobbyHolds(guest, 2, 2500)])).every(Boolean);

  // start() exists only on the host handle; the guest has no callable start
  const hostCan = (await sum(host)).canStart, guestCan = (await sum(guest)).canStart;
  lobby.hostCanStart = hostCan === true;
  lobby.guestCannotStart = guestCan === false;
  if (!lobby.hostCanStart) issue('host: handle.start is not callable');
  if (!lobby.guestCannotStart) issue('guest: handle exposes a callable start()');

  // only the host starts, explicitly and locally; the guest never calls start
  lobby.hostStarted = await startMatch(host);

  const [hs, gs] = await Promise.all([waitRoster(host, 2, T.roster), waitRoster(guest, 2, T.roster)]);
  if (!hs) issue('host: never saw 2 humans + 6 AI (' + (await describe(host)) + ')');
  if (!gs) issue('guest: never saw 2 humans + 6 AI (' + (await describe(guest)) + ')');
  if (!hs || !gs) return { host, guest, room };
  host.mark = hs.hist.length;
  shapeCheck('host', hs); shapeCheck('guest', gs);
  out.distinctIds = !!hs.id && !!gs.id && hs.id !== gs.id;
  out.distinctSlots = hs.slot !== gs.slot;
  out.sameRoom = gs.room === room;
  out.sameHumanSlots = hs.humanSlots.join() === gs.humanSlots.join();
  if (!out.distinctIds) issue('host and guest ids are missing or identical');
  if (!out.distinctSlots) issue('host and guest share local slot ' + hs.slot);
  if (!out.sameRoom) issue('guest handle reports a different room than the host');
  if (!out.sameHumanSlots) issue('host and guest disagree on which slots are human');
  out.roster = { host: { humans: hs.humans, bots: hs.bots, slot: hs.slot }, guest: { humans: gs.humans, bots: gs.bots, slot: gs.slot } };

  // live
  const liveNow = async () => { const [a, b] = await Promise.all([sum(host), sum(guest)]); return a.phase === LIVE && b.phase === LIVE && a.round === b.round ? [a, b] : null; };
  const live = await waitFor(liveNow, T.live);
  if (!live) { issue('never live on both peers: host ' + (await describe(host)) + ' / guest ' + (await describe(guest))); return { host, guest, room }; }
  const liveAt = Date.now();
  out.live = { round: live[0].round };

  // movement at 18 Hz, both humans, observed on both peers
  await Promise.all([host.page.evaluate(pageStartInput, { axes: AXES }), guest.page.evaluate(pageStartInput, { axes: AXES })]);
  const slots = [hs.slot, gs.slot];
  const MIN = 0.3;
  let mv = null;
  const moveEnd = Date.now() + T.move;
  let nextFlip = Date.now() + 3000;
  while (Date.now() < moveEnd) {
    const [a, b] = await Promise.all([sum(host), sum(guest)]);
    mv = { hostSlotOnHost: moveOf(a, slots[0]), hostSlotOnGuest: moveOf(b, slots[0]), guestSlotOnHost: moveOf(a, slots[1]), guestSlotOnGuest: moveOf(b, slots[1]), sent: { host: a.sent, guest: b.sent }, sendErr: { host: a.sendErr, guest: b.sendErr } };
    if (mv.hostSlotOnHost > MIN && mv.hostSlotOnGuest > MIN && mv.guestSlotOnHost > MIN && mv.guestSlotOnGuest > MIN) { mv.ok = true; break; }
    if (Date.now() > nextFlip) { // blocked by geometry? try the next direction (still real inputs)
      nextFlip = Date.now() + 3000;
      await Promise.all([host, guest].map((p) => p.page.evaluate(() => { window.__qa.dir++; })));
    }
    await sleep(200);
  }
  out.movement = mv;
  if (!mv || !mv.ok) issue('movement not observed on both peers for both humans (min ' + MIN + '): ' + JSON.stringify(mv));
  return { host, guest, room, liveAt, slots };
}

async function isolationAndQuick(ctx) {
  const iso = (ev.isolation = {});
  const other = await open('other-host');
  if (await connect(other, ACT_CREATE)) {
    const r2 = await roomOf(other);
    const os = await waitLobby(other, 1, T.roster);
    const hs = await sum(ctx.host);
    iso.distinctRooms = !!r2 && r2 !== ctx.room;
    iso.otherRoster = os ? { humans: os.humans, bots: os.bots, phase: os.phase, seconds: os.seconds } : null;
    iso.firstRoomStill2Humans = hs.humans === 2 && hs.bots === 6;
    if (!iso.distinctRooms) issue('second private room has no room code or collides with the first');
    if (!os) issue('second private room is not a waiting room with 1 human + 0 AI, phase lobby, seconds 0 (' + (await describe(other)) + ')');
    else if (os.phase !== 'lobby') issue('second private room is not in lobby phase: phase=' + os.phase);
    if (!iso.firstRoomStill2Humans) issue('first room roster changed when a second room was created: humans=' + hs.humans);
  }

  const qm = (ev.quickMatch = {});
  const q1 = await open('quick-1'), q2 = await open('quick-2');
  const okq = await Promise.all([connect(q1, ACT_QUICK), connect(q2, ACT_QUICK)]); // simultaneous: exercises the bucket race
  if (okq[0] && okq[1]) {
    const [a, b] = await Promise.all([waitRoster(q1, 2, T.quick), waitRoster(q2, 2, T.quick)]);
    if (!a || !b) issue('quick match did not converge to 2 humans + 6 AI: q1 ' + (await describe(q1)) + ' / q2 ' + (await describe(q2)));
    else {
      shapeCheck('quick-1', a); shapeCheck('quick-2', b);
      qm.converged = true;
      qm.sameRoom = !!a.room && a.room === b.room;
      qm.distinctSlots = a.slot !== b.slot;
      qm.distinctIds = !!a.id && !!b.id && a.id !== b.id;
      qm.notPrivateRoom = a.room !== ctx.room;
      if (!qm.sameRoom) issue('quick match peers report different rooms');
      if (!qm.distinctSlots) issue('quick match peers share a slot');
      if (!qm.distinctIds) issue('quick match peers share or lack ids');
      if (!qm.notPrivateRoom) issue('quick match landed in the private room');
    }
    const hs = await sum(ctx.host);
    qm.privateRoomUntouched = hs.humans === 2 && hs.bots === 6;
    if (!qm.privateRoomUntouched) issue('private room roster changed during quick match: humans=' + hs.humans);
    if (!other.closed && iso.otherRoster) {
      const os = await sum(other);
      qm.otherPrivateUntouched = os.humans === 1 && os.bots === 0 && os.phase === 'lobby' && os.seconds === 0;
      if (!qm.otherPrivateUntouched) issue('second private room waiting state changed during quick match: humans=' + os.humans + ' bots=' + os.bots + ' phase=' + os.phase + ' seconds=' + os.seconds);
    }
    qm.peers = [pub(await sum(q1), q1), pub(await sum(q2), q2)].map((s) => ({ humans: s.humans, bots: s.bots, slot: s.slot, phase: s.phase, status: s.status.slice(-4), ends: s.ends, errors: s.errors }));
  }
  await Promise.all([close(q1), close(q2), close(other)]);
}

async function resultAndLeave(ctx) {
  const { host, guest } = ctx;
  const out = ev.privateRoom;
  const remaining = Math.max(5000, T.result - (Date.now() - ctx.liveAt));
  const both = await waitFor(async () => {
    const [a, b] = await Promise.all([sum(host), sum(guest)]);
    const ra = resultOf(a.hist, host.mark), rb = resultOf(b.hist, 0);
    return ra && rb ? { ra, rb } : null;
  }, remaining, 250);
  if (!both) {
    const [a, b] = await Promise.all([sum(host), sum(guest)]);
    issue('no shared round result within 95s of live: host ' + (resultOf(a.hist, host.mark) ? 'has result' : 'none, phase=' + a.phase + ' seconds=' + a.seconds) + ' / guest ' + (resultOf(b.hist, 0) ? 'has result' : 'none, phase=' + b.phase + ' seconds=' + b.seconds));
  } else {
    out.result = { host: both.ra, guest: both.rb, consensus: core(both.ra) === core(both.rb), secondsFromLive: Math.round((Date.now() - ctx.liveAt) / 100) / 10 };
    if (!out.result.consensus) issue('result mismatch: host ' + core(both.ra) + ' vs guest ' + core(both.rb));
  }
  const [fa, fb] = await Promise.all([sum(host), sum(guest)]);
  out.final = { host: pub(fa, host), guest: pub(fb, guest) };
  if (fa.ends.length) issue('host session ended unexpectedly: ' + JSON.stringify(fa.ends));
  if (fb.ends.length) issue('guest session ended unexpectedly: ' + JSON.stringify(fb.ends));

  // guest leaves; host must refill with AI
  await close(guest);
  const back = await waitRoster(host, 1, T.leave);
  out.afterGuestLeft = back ? { humans: back.humans, bots: back.bots, phase: back.phase } : null;
  if (!back) issue('host did not return to 1 human + 7 AI after guest closed (' + (await describe(host)) + ')');
  else shapeCheck('host-after-leave', back);
  await close(host);
  out.hostClosed = true;
}

async function capacity() {
  const cap = (ev.capacity = {});
  const host = await open('cap-host');
  if (!(await connect(host, ACT_CREATE))) return;
  const room = await roomOf(host);
  if (!room) { issue('capacity: no room code'); return; }
  const guests = [];
  for (let i = 1; i <= 7; i++) {
    const g = await open('cap-guest-' + i);
    guests.push(g);
    if (!(await connect(g, ACT_JOIN, room))) return;
    if (!(await waitLobby(host, i + 1, T.roster))) { issue('capacity: host did not reach ' + (i + 1) + ' humans + 0 AI before start (' + (await describe(host)) + ')'); return; }
  }
  const full = await sum(host);
  cap.full = { humans: full.humans, bots: full.bots, start: full.start };
  const ninth = await open('cap-ninth');
  let joined = false;
  let ninthErr = '';
  try { await withTimeout(ninth.page.evaluate(pageConnect, { action: ACT_JOIN, room }), 15000, 'ninth join'); joined = true; } catch (e) { joined = false; ninthErr = String((e && e.message) || e); }
  await sleep(4000);
  const ns = await sum(ninth), hs = await sum(host);
  // Expected rejection is evidence, not an issue; any other join error is reported, not swallowed.

  const CAP_RE = /(?:^|Error: )房间已满(?:\r?\n|$)/;
  const ninthCapacity = CAP_RE.test(ninthErr) || CAP_RE.test(JSON.stringify(ns.ends));
  cap.ninthError = redact(ninthErr);
  cap.ninthRejected = !joined && !ns.selfHuman && ns.n === 0 && ninthCapacity;
  if (ninthErr && !ninthCapacity) issue('capacity: ninth join failed with a non-capacity error (not counted as expected rejection): ' + ninthErr);
  cap.hostStill8 = hs.humans === 8 && hs.count === 8;
  cap.ninth = { connectResolved: joined, ends: ns.ends.map(redact), status: ns.status.slice(-3).map(redact), snapshots: ns.n };
  if (!cap.ninthRejected) issue('capacity: ninth player was not clearly rejected');
  if (!cap.hostStill8) issue('capacity: host roster broke after ninth join attempt: humans=' + hs.humans + ' count=' + hs.count);
  // 8-slot/4v4 shape: accept it from the waiting room if already assigned; start only if needed
  let shaped = await sum(host);
  cap.startedForShape = !fullShape(shaped);
  if (cap.startedForShape && (await startMatch(host))) {
    shaped = (await waitFor(async () => { const s = await sum(host); return fullShape(s) ? s : null; }, T.roster)) || (await sum(host));
  }
  shapeCheck('cap-host', shaped);
  await Promise.all([ninth, ...guests, host].map(close));
}

// ---------- main ----------
async function main() {
  browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=WebRtcHideLocalIpsWithMdns'],
  });
  const ctx = await privateMatch();
  if (ctx && ctx.liveAt) {
    if (!CLOUD) await isolationAndQuick(ctx);
    else { ev.isolation = { skipped: 'local only' }; ev.quickMatch = { skipped: 'local only (public buckets may contain real players)' }; }
    await resultAndLeave(ctx);
  } else if (ctx) {
    ev.privateRoom.final = { host: ctx.host ? pub(await sum(ctx.host).catch(() => null), ctx.host) : null, guest: ctx.guest ? pub(await sum(ctx.guest).catch(() => null), ctx.guest) : null };
  }
  if (CAPACITY && !CLOUD) await capacity();
  else ev.capacity = { skipped: 'covered by the 8-slot authority unit test; run with --capacity (local) for 9 real contexts' };
}

const watchdog = setTimeout(() => { issue('global watchdog: run exceeded 6 minutes'); finish(); }, 360000);
let finished = false;
async function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  for (const p of [...players]) await close(p);
  if (browser) { try { await withTimeout(browser.close(), 10000, 'browser.close'); } catch {} }
  ev.finishedAt = new Date().toISOString();
  ev.issues = issues;
  ev.ok = issues.length === 0;
  console.log(redact.call ? JSON.stringify(JSON.parse(JSON.stringify(ev), (k, v) => (typeof v === 'string' && k !== 'base' ? scrub(v) : v))) : '');
  process.exit(ev.ok ? 0 : 1);
}
function scrub(s) { // last-line defence: no room/peer ids or IPs in any printed string
  let o = s;
  for (const x of [...secrets].sort((a, b) => b.length - a.length)) o = o.split(x).join('<redacted>');
  return o.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>');
}

try {
  await main();
} catch (e) {
  issue('fatal: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)));
} finally {
  await finish();
}
