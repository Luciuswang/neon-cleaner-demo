import { createMatch } from './squads-sim.js';

const ROOM_RE = /^rf4-h2-[0-9a-f]{32}$/;
const KEY = 'rf4-cloud:';
const TIMEOUT = 7000, GRACE = 90000, LIVE_MS = 300, LOBBY_MS = 700, TICK_MS = 33;

const hex = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); };
const safe = (fn, ...a) => { try { return typeof fn === 'function' ? fn(...a) : undefined; } catch (e) { return undefined; } };
const load = (room) => { try { const v = JSON.parse(sessionStorage.getItem(KEY + room) || 'null'); return v && /^[0-9a-f]{64}$/.test(v.token) && (v.role === 'host' || v.role === 'guest') ? v : null; } catch (e) { return null; } };
const save = (room, token, role) => { try { sessionStorage.setItem(KEY + room, JSON.stringify({ token, role })); } catch (e) {} };
const drop = (room) => { try { sessionStorage.removeItem(KEY + room); } catch (e) {} };

function endpoint(url) {
  if (!url) throw new Error('未配置联机服务');
  const u = new URL(String(url), location.href);
  const qa = u.href === 'http://127.0.0.1:5197/api/room' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && new URLSearchParams(location.search).get('cloudqa') === '1';
  if (u.username || u.password || (u.protocol !== 'https:' && !qa)) throw new Error('联机服务地址无效');
  u.search = ''; u.hash = '';
  return u.href;
}

function fail(code, status) { const e = new Error(text(code, status)); e.code = code; e.status = status; return e; }
function text(code, status) {
  const c = String(code == null ? '' : code).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  if (c === 'offline' || c === 'timeout') return '网络已离线或服务器无响应';
  if (c === 'started') return '对局已开始';
  if (c === 'need_players') return '人数不足，无法开始';
  if (c === 'invalid') return '请求无效';
  if (c === 'stale') return '同步数据已过期';
  if (/absent|missing|not_?found|unknown_room/.test(c) || status === 404) return '房间不存在';
  if (/full/.test(c)) return '房间已满';
  if (/closed|gone|ended/.test(c) || status === 410) return '房间已关闭';
  if (/auth|token|forbid/.test(c) || status === 401 || status === 403) return '身份验证失败，无法进入该房间';
  return '服务器错误' + (c || status ? '（' + (c || status) + '）' : '');
}
const transient = (e) => { const c = String(e.code || '').toLowerCase(); return c === 'offline' || c === 'timeout' || c === 'retry' || c === 'slow' || !/full|started|closed|gone|ended|absent|missing|not_?found|unknown_room|invalid|auth|token|forbid|need_players|stale/.test(c) && (e.status === 429 || e.status >= 500); };
const slowErr = (e) => e.status === 429 || String(e.code || '').toLowerCase() === 'slow';
const staleErr = (e) => String(e.code || '').toLowerCase() === 'stale';
const plain = (v, d = 0) => { if (!v || typeof v !== 'object') return null; const o = {}; let n = 0; for (const k of Object.keys(v)) { if (++n > 16) break; const x = v[k]; if (typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x))) o[k] = x; else if (!d && x && typeof x === 'object') { const p = plain(x, 1); if (p) o[k] = p; } } return o; };

async function post(api, body, keepalive) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT);
  let res, data = null;
  try {
    res = await fetch(api, { method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', keepalive: !!keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
    try { data = await res.json(); } catch (e) { data = null; }
  } catch (e) {
    throw fail(ac.signal.aborted ? 'timeout' : 'offline', 0);
  } finally { clearTimeout(t); }
  if (!res.ok || !data || typeof data !== 'object' || data.code) throw fail(data && data.code, res.status);
  return data;
}

// Retries transient failures for the first calls (create/join/first sync).
async function firm(api, body, sure) {
  const t0 = Date.now();
  for (let n = 0; ; n++) {
    try { return await post(api, typeof body === 'function' ? body() : body); } catch (e) {
      const again = sure ? slowErr(e) || String(e.code || '').toLowerCase() === 'retry' : transient(e) || (typeof body === 'function' && staleErr(e));
      if (!again || Date.now() - t0 > 20000) throw e;
      await new Promise((r) => setTimeout(r, slowErr(e) ? 2500 : Math.min(3000, 400 * 2 ** n)));
    }
  }
}

export async function connectCloud({ action, room, onState, onStatus, onEnd, url }) {
  const api = endpoint(url);
  safe(onStatus, '正在连接…');
  let token, role, member;
  room = String(room || '');

  // ---------- handshake ----------
  if (action === 'create') {
    token = hex(32);
    const r = await firm(api, { op: 'create', token }, true);
    if (!ROOM_RE.test(String(r.room || '')) || r.member !== 0) throw new Error('服务器返回的房间无效');
    room = r.room; role = 'host'; member = 0;
    save(room, token, role);
  } else {
    if (!ROOM_RE.test(room)) throw new Error('房间号无效');
    const kept = action === 'restore' ? load(room) : null;
    if (action === 'restore' && !kept) throw new Error('没有可恢复的房间身份');
    if (kept && kept.role === 'host') { token = kept.token; role = 'host'; member = 0; }
    else {
      token = kept ? kept.token : hex(32); // a refreshed guest resumes its own slot
      const r = await firm(api, { op: 'join', token, room });
      if (r.room !== room || !Number.isInteger(r.member) || r.member < 1) throw new Error('服务器返回的成员无效');
      role = 'guest'; member = r.member;
      save(room, token, role);
    }
  }
  const host = role === 'host';

  // ---------- state ----------
  let closed = false, live = false, seq = Date.now() * 16, slot = -1, pollT = 0, tickT = 0, busy = false;
  let failSince = 0, fails = 0, begun = false, want = null, myInput = null, starting = false;
  let sim = null, hostSlot = -1, lastTick = 0, firstSnap = null;
  const members = new Map(); // net member id -> {epoch, slot, want, input, seq, dirty}

  // ---------- host: roster -> sim ----------
  function flushInputs() {
    if (!live) return; // the sim ignores lobby input, so keep it remembered until live
    for (const m of members.values()) if (m.dirty && m.input) { m.dirty = false; sim.input(m.slot, m.input); }
  }
  function applyRoster(roster) {
    if (!Array.isArray(roster)) return;
    const seen = new Map();
    for (const r of roster) if (r && Number.isInteger(r.id) && r.id !== 0) seen.set(r.id, r);
    for (const [id, m] of members) { // gone or re-joined: free the former slot first
      const r = seen.get(id);
      if (!r || r.epoch !== m.epoch) { sim.leave(m.slot); members.delete(id); }
    }
    for (const [id, r] of seen) {
      let m = members.get(id);
      if (!m) {
        const s = sim.join();
        if (s < 0) continue; // no free slot yet, retried on the next roster
        m = { epoch: r.epoch, slot: s, want: null, input: null, seq: null, dirty: false };
        members.set(id, m);
      }
      if (r.team === 0 || r.team === 1) m.want = r.team;
      if (r.input && r.seq !== m.seq) { m.seq = r.seq; m.input = r.input; m.dirty = true; }
    }
    if (!live) { // guest requests only; the host's own slot is never touched here
      for (const m of members.values()) {
        if (m.want == null) continue;
        const p = sim.snapshot().players.find((q) => q.slot === m.slot);
        if (p && p.team === m.want) continue;
        const s = sim.chooseTeam(m.slot, m.want);
        if (s >= 0 && s !== m.slot) { m.slot = s; m.dirty = !!m.input; }
      }
    }
    flushInputs();
  }

  // ---------- sync ----------
  function body() {
    const b = { op: 'sync', room, token, seq: ++seq };
    if (host) {
      const players = { 0: hostSlot };
      for (const [id, m] of members) players[id] = m.slot;
      b.snapshot = sim.snapshot(); b.players = players;
    } else {
      if (want === 0 || want === 1) b.team = want;
      if (myInput) b.input = myInput;
    }
    return b;
  }
  function handle(res) {
    if (host) {
      applyRoster(res.roster); // roster first, so start never sees a one-human sim
      if (res.started && !live && sim.start()) {
        live = true;
        for (const m of members.values()) m.dirty = !!m.input;
        flushInputs();
      }
      return;
    }
    if (Number.isInteger(res.slot) && res.slot >= 0) slot = res.slot;
    live = !!res.started;
    if (res.snapshot && typeof res.snapshot === 'object') safe(onState, res.snapshot, slot);
  }

  // ---------- first authenticated sync ----------
  if (host) {
    sim = createMatch({ waiting: true });
    hostSlot = sim.join();
    if (hostSlot < 0) throw new Error('无法创建本地对局');
  }
  const first = await firm(api, () => (host ? { op: 'sync', room, token, seq: ++seq } : body()));
  if (host) {
    if (first.member !== 0) throw new Error('身份验证失败，无法恢复房主身份');
    // A started room cannot be rebuilt from a fresh sim; fail without leaving, so the room is not deleted.
    if (first.started) throw new Error('对局已开始，刷新后无法恢复房主对局');
    applyRoster(first.roster);
  } else {
    if (Number.isInteger(first.slot) && first.slot >= 0) slot = first.slot;
    live = !!first.started;
    if (first.snapshot && typeof first.snapshot === 'object') firstSnap = first.snapshot;
  }
  safe(onStatus, '');

  // ---------- lifecycle ----------
  function cleanup() {
    clearTimeout(pollT); clearInterval(tickT); pollT = 0; tickT = 0;
    document.removeEventListener('visibilitychange', onVis);
  }
  function finish(msg) {
    if (closed) return;
    closed = true; cleanup();
    safe(onEnd, msg);
  }
  function onVis() {
    if (closed || document.hidden) return;
    failSince = 0; fails = 0; lastTick = performance.now(); // background time is not an outage
    kick();
  }
  function kick() { if (begun && pollT && !busy) { clearTimeout(pollT); loop(); } }

  async function loop() {
    pollT = 0;
    if (closed || busy) return;
    if (document.hidden) { pollT = setTimeout(loop, 500); return; } // no network while hidden
    busy = true;
    let delay = LOBBY_MS;
    try {
      const res = await post(api, body());
      if (closed) return;
      if (failSince) safe(onStatus, '');
      failSince = 0; fails = 0;
      handle(res);
      delay = live ? LIVE_MS : LOBBY_MS;
    } catch (e) {
      if (closed) return;
      if (e.status === undefined) { finish('联机同步出错'); return; }
      if (!transient(e) && !staleErr(e)) {
        if (/不存在|已关闭/.test(e.message)) drop(room);
        finish(e.message); return;
      }
      if (!failSince) failSince = Date.now();
      if (Date.now() - failSince > GRACE) { finish('网络已离线，连接超时'); return; }
      delay = slowErr(e) ? 3000 : Math.min(4000, 500 * 2 ** fails++);
      safe(onStatus, '网络不稳定，正在重连…');
    } finally {
      busy = false;
      if (!closed) pollT = setTimeout(loop, delay);
    }
  }

  function tick() {
    if (closed) return;
    const now = performance.now(), gap = now - lastTick;
    lastTick = now;
    if (document.hidden || gap > 1000) return; // clock reset after background or stall
    try { sim.step(Math.min(0.1, Math.max(0, gap / 1000))); } catch (e) { finish('本地对局出错'); return; }
    safe(onState, sim.snapshot(), hostSlot);
  }

  // Nothing reaches onState until the caller has received the handle.
  document.addEventListener('visibilitychange', onVis);
  pollT = setTimeout(() => {
    pollT = 0;
    if (closed) return;
    begun = true;
    if (host) { lastTick = performance.now(); tickT = setInterval(tick, TICK_MS); safe(onState, sim.snapshot(), hostSlot); }
    else if (firstSnap) safe(onState, firstSnap, slot);
    pollT = setTimeout(loop, live ? LIVE_MS : LOBBY_MS);
  }, 0);

  // ---------- handle ----------
  return {
    room,
    role,
    get id() { return host ? hostSlot : slot; },
    chooseTeam(team) {
      if (closed || (team !== 0 && team !== 1)) return -1;
      if (!host) { want = team; kick(); return slot; }
      if (live) return -1;
      const s = sim.chooseTeam(hostSlot, team);
      if (s >= 0) hostSlot = s;
      return s;
    },
    ...(host ? { async start() {
      if (closed || live || starting) return false;
      starting = true;
      try {
        await post(api, { op: 'start', room, token }); // server decides; the sim starts on the next sync
        kick();
        return true;
      } catch (e) {
        if (!closed) safe(onStatus, transient(e) ? '网络繁忙，请稍后重试' : '暂时无法开始：' + e.message);
        return false;
      } finally { starting = false; }
    } } : {}),
    send(input) {
      if (closed || !input) return;
      if (host) { try { sim.input(hostSlot, input); } catch (e) {} return; }
      const p = plain(input); if (p) myInput = p;
    },
    close() {
      if (closed) return;
      closed = true; cleanup();
      post(api, { op: 'leave', room, token }, true).catch(() => {});
      drop(room);
    },
  };
}
