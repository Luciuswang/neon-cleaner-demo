// squads-net.js — opt-in online mode for Riverfall (friendly prototype matches, not ranked).
// Star topology over PeerJS/WebRTC: one browser is the authoritative host, up to 7 clients.
// Loaded only after the Online click; the caller shows the IP-visibility notice before calling.
// No accounts, names, credentials or logging. All peer data is treated as untrusted.
// Known limit: a host tab kept in the background is timer-throttled; clients then time out cleanly.
import './peer-runtime.js';
import { createMatch } from './squads-sim.js';

const VERSION = 2, PREFIX = 'rf4-v1-', BUCKETS = 8, MAX_SLOTS = 8;
const ROOM_RE = /^rf4-v1-(?:[0-9a-f]{20}|q[0-7])$/;
const TICK_MS = 50, STEP = TICK_MS / 1000, SEND_MS = 40, PING_MS = 1000;
const OPEN_MS = 12000, JOIN_MS = 15000, HELLO_MS = 10000;
const HOST_SILENCE_MS = 6000, CLIENT_SILENCE_MS = 10000, STALL_MS = 5000;
const HOST_AWAY_MS = 90000, RECONNECT_TRIES = 5, RECONNECT_MS = 2000;
const PRIVATE_RE = /^rf4-v1-[0-9a-f]{20}$/;
const MAX_PENDING = 4, MAX_CONNS = MAX_SLOTS - 1 + MAX_PENDING;
const MAX_CTRL = 512, MAX_SNAP = 16384, RATE = 60, MAX_BUFFER = 65536;
const RETRIES = 1, RETRY_MS = 800, BYE_FLUSH_MS = 200;
const PHASES = ['lobby', 'warmup', 'live', 'result', 'finished'];
const FATAL = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'unavailable-id',
  'invalid-id', 'invalid-key', 'ssl-unavailable', 'browser-incompatible']);

const MSG = {
  runtime: '联机组件加载失败，请刷新页面后重试',
  'bad-action': '无效的联机操作',
  'bad-room': '邀请码格式无效',
  signal: '无法连接信令服务器，请检查网络后重试',
  taken: '房间号已被占用，请重试',
  'no-room': '房间不存在或主机已离开',
  busy: '主机繁忙或拒绝了连接，请稍后重试',
  full: '房间已满',
  version: '游戏版本不一致，请刷新页面后重试',
  timeout: '无法与主机建立直连（可能受防火墙或 NAT 限制）',
  'all-full': '快速匹配房间均已满，请稍后再试',
  sim: '无法创建对局',
  kicked: '连接已被主机关闭',
  'host-left': '主机已离开，对局结束',
  'host-signal': '主机与信令服务器断开，房间已关闭',
  'host-silent': '主机无响应，连接已超时',
  'signal-lost': '与信令服务器的连接已断开且重连失败，房间已关闭，请检查网络后重新创建房间',
  'reclaim-lost': '重连时房间号已被占用，房间已关闭，请重新创建房间并重新邀请好友',
  'bad-restore': '没有可恢复的房间，请重新创建房间',
  'restore-taken': '原房间号已被占用，无法恢复，请重新创建房间并重新邀请好友',
};

function netError(code) {
  const e = new Error(MSG[code] || MSG.signal);
  e.code = code;
  return e;
}

// ---------- small helpers ----------

// Owns timers and listeners so every exit path releases them.
function makeScope() {
  const offs = new Set();
  let dead = false;
  const add = (off) => { if (dead) off(); else offs.add(off); return off; };
  return {
    on(target, ev, fn) { target.on(ev, fn); return add(() => target.off(ev, fn)); },
    listen(target, ev, fn) { target.addEventListener(ev, fn); return add(() => target.removeEventListener(ev, fn)); },
    timeout(fn, ms) {
      const off = () => { clearTimeout(t); offs.delete(off); };
      const t = setTimeout(() => { offs.delete(off); fn(); }, ms);
      return add(off);
    },
    interval(fn, ms) { const t = setInterval(fn, ms); return add(() => clearInterval(t)); },
    dispose() {
      if (dead) return;
      dead = true;
      for (const off of [...offs]) { try { off(); } catch { /* ignore */ } }
      offs.clear();
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeCall = (fn, ...a) => { if (typeof fn === 'function') { try { fn(...a); } catch { /* caller bug must not break netcode */ } } };
const destroy = (peer) => { try { peer.destroy(); } catch { /* ignore */ } };
const hangUp = (conn) => { try { conn.close(); } catch { /* ignore */ } };
const buffered = (conn) => (conn.dataChannel && conn.dataChannel.bufferedAmount) || 0;

function randomHex() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// Local PeerServer only for QA on loopback; production always uses PeerJS Cloud defaults.
function peerOptions() {
  const h = location.hostname;
  const local = (h === 'localhost' || h === '127.0.0.1')
    && new URLSearchParams(location.search).get('signal') === 'local';
  return local
    ? { host: '127.0.0.1', port: 5193, path: '/squads', secure: false, config: { iceServers: [] }, debug: 0 }
    : { debug: 0 };
}

// Bounded send: drops the message instead of queueing when the channel is congested.
function sendRaw(conn, obj) {
  try {
    if (!conn.open || buffered(conn) > MAX_BUFFER) return false;
    conn.send(JSON.stringify(obj));
    return true;
  } catch { return false; }
}

function parse(data, max) {
  if (typeof data !== 'string' || data.length > max) return null;
  try {
    const m = JSON.parse(data);
    return m && typeof m === 'object' && !Array.isArray(m) ? m : null;
  } catch { return null; }
}

// ---------- validation of untrusted data ----------

const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
const int = (v, lo, hi) => Math.round(num(v, lo, hi));
const angle = (v) => (Number.isFinite(v) && Math.abs(v) < 1e6 ? Math.atan2(Math.sin(v), Math.cos(v)) : 0);

function cleanInput(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    dx: num(p.dx, -1, 1), dz: num(p.dz, -1, 1),
    yaw: angle(p.yaw), pitch: num(p.pitch, -1.55, 1.55),
    fire: p.fire === true, reload: p.reload === true, sprint: p.sprint === true,
  };
}

function cleanPlayer(p) {
  if (!p || typeof p !== 'object' || !Number.isInteger(p.slot) || p.slot < 0 || p.slot >= MAX_SLOTS) return null;
  return {
    slot: p.slot, team: p.team === 1 ? 1 : 0, bot: p.bot === true, // "[AI]" label comes only from this host flag
    x: num(p.x, -1e4, 1e4), y: num(p.y, -1e4, 1e4), z: num(p.z, -1e4, 1e4),
    yaw: angle(p.yaw), pitch: num(p.pitch, -1.55, 1.55),
    hp: num(p.hp, 0, 1000), mag: int(p.mag, 0, 999),
    reload: typeof p.reload === 'boolean' ? p.reload : num(p.reload, 0, 60),
    kills: int(p.kills, 0, 9999), shots: int(p.shots, 0, 1e6),
  };
}

function cleanSnapshot(s) {
  if (!s || typeof s !== 'object' || !PHASES.includes(s.phase)) return null;
  if (!Array.isArray(s.players) || s.players.length > MAX_SLOTS) return null;
  if (!Array.isArray(s.score) || s.score.length !== 2) return null;
  const players = [], seen = new Set();
  for (const raw of s.players) {
    if (raw == null) continue; // sparse seats: empty slots may arrive as null
    const p = cleanPlayer(raw);
    if (!p || seen.has(p.slot)) return null;
    seen.add(p.slot);
    players.push(p);
  }
  return {
    seq: int(s.seq, 0, Number.MAX_SAFE_INTEGER), round: int(s.round, 0, 999), phase: s.phase,
    seconds: num(s.seconds, 0, 1e5), score: [int(s.score[0], 0, 999), int(s.score[1], 0, 999)],
    winner: s.winner === 0 || s.winner === 1 ? s.winner : -1, players,
  };
}

// ---------- signaling ----------

// Opens a peer; with an id this is an atomic claim (rejects 'taken' if someone holds it).
function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new globalThis.Peer(id, peerOptions()) : new globalThis.Peer(peerOptions());
    const s = makeScope();
    const fail = (code) => { s.dispose(); destroy(peer); reject(netError(code)); };
    s.on(peer, 'open', () => { s.dispose(); resolve(peer); });
    s.on(peer, 'error', (e) => fail(e && e.type === 'unavailable-id' ? 'taken' : 'signal'));
    s.timeout(() => fail('signal'), OPEN_MS);
  });
}

// Connects to a room and completes hello/welcome. Never claims or destroys the room id.
function handshake(peer, room) {
  return new Promise((resolve, reject) => {
    const s = makeScope();
    const conn = peer.connect(room, { reliable: true, serialization: 'raw' });
    const done = (code, slot) => {
      s.dispose();
      if (code) { hangUp(conn); reject(netError(code)); } else resolve({ conn, slot });
    };
    s.on(conn, 'open', () => sendRaw(conn, { t: 'hello', v: VERSION }));
    s.on(conn, 'data', (d) => {
      const m = parse(d, MAX_CTRL);
      if (!m) return;
      if (m.t === 'welcome') {
        if (m.v !== VERSION) done('version');
        else if (Number.isInteger(m.slot) && m.slot >= 0 && m.slot < MAX_SLOTS) done(null, m.slot);
        else done('busy');
      } else if (m.t === 'full') done('full');
      else if (m.t === 'error') done(m.code === 'version' ? 'version' : 'busy');
    });
    s.on(conn, 'close', () => done('busy'));
    s.on(conn, 'error', () => done('timeout'));
    s.on(peer, 'error', (e) => done(e && e.type === 'peer-unavailable' ? 'no-room' : 'signal'));
    s.on(peer, 'disconnected', () => done('signal'));
    s.timeout(() => done('timeout'), JOIN_MS);
  });
}

// ---------- host ----------

function runHost(peer, room, cb) {
  const match = createMatch({ waiting: PRIVATE_RE.test(room) }); // invite rooms wait in the lobby; quick rooms do not
  let slot = match.join();
  if (slot < 0) { destroy(peer); throw netError('sim'); }
  const s = makeScope(), clients = new Map();
  let pending = 0, ended = false, last = performance.now(), acc = 0;

  // Seat bookkeeping: me is the client record asking, or null for the host itself.
  const held = (sl, me) => {
    if (me && sl === slot) return true;
    for (const o of clients.values()) if (o !== me && o.slot === sl) return true;
    return false;
  };
  const seatOk = (sl, me) => Number.isInteger(sl) && sl >= 0 && sl < MAX_SLOTS && !held(sl, me);

  const drop = (conn, msg) => {
    const c = clients.get(conn);
    if (!c) return;
    clients.delete(conn);
    c.scope.dispose();
    if (c.slot < 0) pending--; else match.leave(c.slot);
    if (msg && sendRaw(conn, msg)) s.timeout(() => hangUp(conn), BYE_FLUSH_MS); else hangUp(conn);
  };

  const onData = (conn, c, data) => {
    const now = performance.now();
    if (now - c.win > 1000) { c.win = now; c.n = 0; }
    if (++c.n > RATE) return drop(conn, { t: 'error', code: 'rate' });
    const m = parse(data, MAX_CTRL);
    if (!m) return drop(conn, { t: 'error', code: 'bad' });
    c.heard = now;
    if (c.slot < 0) {
      if (m.t !== 'hello') return drop(conn, { t: 'error', code: 'bad' });
      if (m.v !== VERSION) return drop(conn, { t: 'error', code: 'version' });
      const sl = match.join();
      if (!Number.isInteger(sl) || sl < 0) return drop(conn, { t: 'full' });
      if (!seatOk(sl, c)) return drop(conn, { t: 'full' }); // never share or evict an occupied seat
      c.slot = sl; pending--; c.deadline();
      sendRaw(conn, { t: 'welcome', v: VERSION, slot: sl });
      safeCall(cb.onStatus, '有玩家加入');
    } else if (m.t === 'input') {
      const i = cleanInput(m.i);
      if (i) match.input(c.slot, i);
    } else if (m.t === 'team') {
      // A guest may only move itself: the seat comes from the connection, never from the message.
      if (m.team !== 0 && m.team !== 1) return drop(conn, { t: 'error', code: 'bad' });
      const ns = match.chooseTeam(c.slot, m.team);
      if (seatOk(ns, c) && ns !== c.slot) { c.slot = ns; c.moved = true; }
    } else if (m.t !== 'ping') drop(conn, { t: 'error', code: 'bad' }); // includes 'start': only the host starts
  };

  const end = (code) => {
    if (ended) return;
    ended = true;
    const bye = { t: 'bye', code: code ? 'host-signal' : 'host-left' };
    for (const [conn, c] of clients) { c.scope.dispose(); sendRaw(conn, bye); }
    clients.clear();
    s.dispose();
    setTimeout(() => destroy(peer), BYE_FLUSH_MS); // one-shot: let "bye" flush, then free everything
    if (code) safeCall(cb.onEnd, MSG[code]);
  };

  s.on(peer, 'connection', (conn) => {
    if (pending >= MAX_PENDING || clients.size >= MAX_CONNS) return hangUp(conn);
    const now = performance.now();
    const c = { slot: -1, scope: makeScope(), heard: now, win: now, n: 0, stall: 0, deadline: null };
    clients.set(conn, c);
    pending++;
    c.deadline = c.scope.timeout(() => drop(conn), HELLO_MS);
    c.scope.on(conn, 'data', (d) => onData(conn, c, d));
    c.scope.on(conn, 'close', () => drop(conn));
    c.scope.on(conn, 'error', () => drop(conn));
  });
  // Bounded signaling reconnect: same peer id, same match; data connections stay up meanwhile.
  let tries = 0, retryOff = null;
  const online = () => peer.open && !peer.disconnected;
  const reconnect = () => {
    if (ended || retryOff || peer.destroyed || paused) return;
    if (tries >= RECONNECT_TRIES) return end('signal-lost');
    tries++;
    safeCall(cb.onStatus, '与信令服务器断开，正在重连…');
    retryOff = s.timeout(() => {
      retryOff = null;
      if (ended || peer.destroyed) return;
      if (online()) { tries = 0; return; }
      try { if (peer.disconnected) peer.reconnect(); else peer.disconnect(); } catch { return end('signal-lost'); }
      if (!retryOff) retryOff = s.timeout(() => { retryOff = null; if (!ended && !online()) reconnect(); }, OPEN_MS);
    }, RECONNECT_MS * tries);
  };
  s.on(peer, 'open', () => {
    if (retryOff) { retryOff(); retryOff = null; }
    if (tries) safeCall(cb.onStatus, '已重新连接信令服务器');
    tries = 0;
  });
  s.on(peer, 'disconnected', reconnect);
  s.on(peer, 'close', () => end('signal-lost'));
  s.on(peer, 'error', (e) => {
    const t = e && e.type;
    if (t === 'unavailable-id') end('reclaim-lost'); // id taken while away: refuse, never fight for it
    else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') reconnect();
    else if (FATAL.has(t)) end('signal-lost');
  });

  // Suspend the simulation while hidden or in bfcache; resume with fresh clocks.
  let paused = false, frozen = false;
  const sync = () => {
    const p = frozen || (typeof document !== 'undefined' && document.visibilityState === 'hidden');
    if (p === paused) return;
    paused = p;
    if (p) return;
    const now = performance.now();
    last = now; acc = 0;
    for (const c of clients.values()) { c.heard = now; c.stall = 0; c.win = now; c.n = 0; }
    tries = 0;
    if (!ended && !online()) reconnect();
  };
  s.listen(globalThis, 'pagehide', (e) => { if (e && e.persisted) { frozen = true; sync(); } else end(); });
  s.listen(globalThis, 'pageshow', () => { frozen = false; sync(); });
  if (typeof document !== 'undefined') s.listen(document, 'visibilitychange', sync);
  sync();

  // Fixed-step authoritative tick, independent of rendering.
  s.interval(() => {
    if (paused) return;
    const now = performance.now();
    acc = Math.min(1, acc + (now - last) / 1000);
    last = now;
    while (acc >= STEP) { match.step(STEP); acc -= STEP; }
    const snap = match.snapshot();
    safeCall(cb.onState, snap, slot);
    const raw = JSON.stringify({ t: 'state', s: snap });
    for (const [conn, c] of clients) {
      if (c.slot < 0) continue;
      if (now - c.heard > CLIENT_SILENCE_MS) { drop(conn, { t: 'error', code: 'idle' }); continue; }
      if (conn.open && buffered(conn) <= MAX_BUFFER) {
        c.stall = 0;
        // A seat change must reach the guest before any snapshot that reflects it.
        if (c.moved) {
          if (!sendRaw(conn, { t: 'seat', slot: c.slot })) { drop(conn); continue; }
          c.moved = false;
        }
        try { conn.send(raw); } catch { drop(conn); }
      } else if (!c.stall) c.stall = now; // congested: skip snapshots rather than queue them
      else if (now - c.stall > STALL_MS) drop(conn);
    }
  }, TICK_MS);

  return {
    room, get id() { return slot; },
    role: 'host',
    chooseTeam(team) {
      if (ended || (team !== 0 && team !== 1)) return -1;
      const ns = match.chooseTeam(slot, team);
      if (!seatOk(ns, null)) return -1;
      slot = ns;
      return slot;
    },
    start() {
      if (ended) return false;
      let humans = 1;
      for (const c of clients.values()) if (c.slot >= 0) humans++;
      return humans >= 2 && match.start() !== false;
    },
    send(p) { const i = ended ? null : cleanInput(p); if (i) match.input(slot, i); },
    close() { end(); },
  };
}

// ---------- client ----------

function runClient(peer, conn, slot, room, cb) {
  const s = makeScope();
  let ended = false, heard = performance.now(), sent = heard, next = null, want = null;

  const end = (code) => {
    if (ended) return;
    ended = true;
    s.dispose();
    hangUp(conn);
    destroy(peer);
    if (code) safeCall(cb.onEnd, MSG[code]);
  };

  s.on(conn, 'data', (d) => {
    const m = parse(d, MAX_SNAP);
    if (!m) return;
    heard = performance.now();
    if (m.t === 'state') {
      const snap = cleanSnapshot(m.s);
      if (snap) safeCall(cb.onState, snap, slot);
    } else if (m.t === 'seat') {
      // Ordered channel: this lands before the first snapshot that uses the new seat.
      if (Number.isInteger(m.slot) && m.slot >= 0 && m.slot < MAX_SLOTS) slot = m.slot;
    } else if (m.t === 'bye') end(m.code === 'host-signal' ? 'host-signal' : 'host-left');
    else if (m.t === 'error') end('kicked');
  });
  s.on(conn, 'close', () => end('host-left'));
  s.on(conn, 'error', () => end('host-left'));
  const away = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const fresh = () => { next = null; if (!away()) heard = sent = performance.now(); };
  s.listen(globalThis, 'pagehide', (e) => { if (e && e.persisted) next = null; else end(); });
  s.listen(globalThis, 'pageshow', fresh);
  if (typeof document !== 'undefined') s.listen(document, 'visibilitychange', fresh);

  // Throttled input (latest wins) plus heartbeat; watchdog ends the session if the host goes quiet.
  s.interval(() => {
    const now = performance.now();
    if (now - heard > HOST_AWAY_MS) return end('host-silent'); // tolerate a briefly hidden/suspended host
    if (want !== null && sendRaw(conn, { t: 'team', team: want })) { want = null; sent = now; }
    if (next) { if (sendRaw(conn, { t: 'input', i: next })) { next = null; sent = now; } }
    else if (now - sent > PING_MS && sendRaw(conn, { t: 'ping' })) sent = now;
  }, SEND_MS);

  return {
    room, get id() { return slot; },
    role: 'guest',
    chooseTeam(team) { if (!ended && (team === 0 || team === 1)) want = team; },
    send(p) { if (!ended && !away()) next = cleanInput(p) || next; },
    close() { end(); },
  };
}

// ---------- quick match ----------

// Try buckets q0..q7 in order: claim the id to host, or join if it is taken.
// Only an explicit "full" (or a vanished/busy host after one retry) advances; network failures abort.
async function quick(cb) {
  let client = null;
  try {
    for (let b = 0; b < BUCKETS; b++) {
      const room = `${PREFIX}q${b}`;
      safeCall(cb.onStatus, `正在匹配（${b + 1}/${BUCKETS}）…`);
      let peer = null;
      try { peer = await openPeer(room); } catch (e) { if (e.code !== 'taken') throw e; }
      if (peer) {
        safeCall(cb.onStatus, '已创建公开房间，等待其他玩家');
        return runHost(peer, room, cb);
      }
      if (!client) client = await openPeer();
      for (let attempt = 0; ; attempt++) {
        try {
          const { conn, slot } = await handshake(client, room);
          const handle = runClient(client, conn, slot, room, cb);
          client = null;
          safeCall(cb.onStatus, '已加入对局');
          return handle;
        } catch (e) {
          if (e.code === 'full') break;
          if (e.code !== 'no-room' && e.code !== 'busy') throw e;
          if (attempt >= RETRIES) break;
          await sleep(RETRY_MS);
        }
      }
    }
    throw netError('all-full');
  } finally {
    if (client) destroy(client);
  }
}

// ---------- public API ----------

export async function connectRoom({ action, room, onState, onStatus, onEnd } = {}) {
  if (typeof globalThis.Peer !== 'function') throw netError('runtime');
  const cb = { onState, onStatus, onEnd };
  if (action === 'create') {
    const id = PREFIX + randomHex();
    safeCall(onStatus, '正在创建房间…');
    const peer = await openPeer(id);
    safeCall(onStatus, '房间已创建，等待好友加入');
    return runHost(peer, id, cb);
  }
  if (action === 'join') {
    if (typeof room !== 'string' || !ROOM_RE.test(room)) throw netError('bad-room');
    safeCall(onStatus, '正在加入房间…');
    const peer = await openPeer();
    try {
      const { conn, slot } = await handshake(peer, room);
      safeCall(onStatus, '已加入对局');
      return runClient(peer, conn, slot, room, cb);
    } catch (e) {
      destroy(peer);
      throw e;
    }
  }
  if (action === 'restore') {
    // Caller must pass the private id kept in per-tab host state, never one taken from a URL.
    if (typeof room !== 'string' || !PRIVATE_RE.test(room)) throw netError('bad-restore');
    safeCall(onStatus, '正在恢复房间…');
    let peer;
    try { peer = await openPeer(room); } // the signaling server claims the id atomically
    catch (e) { throw e && e.code === 'taken' ? netError('restore-taken') : e; }
    safeCall(onStatus, '房间已恢复，等待好友重新加入');
    return runHost(peer, room, cb);
  }
  if (action === 'quick') return quick(cb);
  throw netError('bad-action');
}
