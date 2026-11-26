const ORIGINS = new Set(['https://luciuswang.github.io', 'http://127.0.0.1:5190', 'http://localhost:5190']);
const MAX_BODY = 16384, CAP = 64, RATE = 12, HARD = 72e5, IDLE = 18e4, GUEST_IDLE = 9e4, HOST_GRACE = 15e4, MIN_GAP = 80;
const TOKEN = /^[0-9a-f]{64}$/, ROOM = /^rf4-h2-[0-9a-f]{32}$/, PHASE = /^[a-z][a-z_]{0,15}$/, TAU = Math.PI * 2;
const KEYS = {
  create: ['op', 'token'], join: ['op', 'room', 'token'], start: ['op', 'room', 'token'], leave: ['op', 'room', 'token'],
  sync: ['op', 'room', 'token', 'seq', 'team', 'input', 'players', 'snapshot', 'started', 'resume']
};

const E = (status, code) => ({ status, code });
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const changes = r => (r && r.meta ? r.meta.changes : r && r.changes) || 0;
const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
async function sha(t) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}
function num(v, lo, hi) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw E(400, 'bad_number');
  return Math.min(hi, Math.max(lo, v));
}
function int(v, lo, hi) {
  if (!Number.isInteger(v) || v < lo || v > hi) throw E(400, 'bad_integer');
  return v;
}
function wrap(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e6) throw E(400, 'bad_number');
  return Math.max(-Math.PI, Math.min(Math.PI, v - TAU * Math.floor((v + Math.PI) / TAU)));
}
function bool(v) {
  if (typeof v !== 'boolean') throw E(400, 'bad_boolean');
  return v;
}
function cleanInput(v) {
  if (!isObj(v)) throw E(400, 'bad_input');
  return {
    dx: num(v.dx, -1, 1), dz: num(v.dz, -1, 1), yaw: wrap(v.yaw), pitch: num(v.pitch, -1.6, 1.6),
    ...(v.fire === undefined ? {} : { fire: bool(v.fire) }),
    ...(v.reload === undefined ? {} : { reload: bool(v.reload) }),
    ...(v.sprint === undefined ? {} : { sprint: bool(v.sprint) })
  };
}
function cleanSnapshot(v) {
  if (!isObj(v) || !Array.isArray(v.players) || v.players.length > 8) throw E(400, 'bad_snapshot');
  if (!Array.isArray(v.score) || v.score.length !== 2 || typeof v.phase !== 'string' || !PHASE.test(v.phase)) throw E(400, 'bad_snapshot');
  const seen = new Set();
  const players = v.players.map(p => {
    if (!isObj(p)) throw E(400, 'bad_snapshot');
    const slot = int(p.slot, 0, 7);
    if (seen.has(slot)) throw E(400, 'bad_snapshot');
    seen.add(slot);
    return {
      slot, team: int(p.team, -1, 1), bot: bool(p.bot),
      x: num(p.x, -1e4, 1e4), y: num(p.y, -1e4, 1e4), z: num(p.z, -1e4, 1e4),
      yaw: wrap(p.yaw), pitch: num(p.pitch, -1.6, 1.6),
      hp: num(p.hp, 0, 1000), mag: int(p.mag, 0, 999), reload: num(p.reload, 0, 60),
      kills: int(p.kills, 0, 1e6), shots: int(p.shots, 0, 1e9)
    };
  });
  return {
    seq: int(v.seq, 0, Number.MAX_SAFE_INTEGER), round: int(v.round, 0, 1e6), phase: v.phase,
    seconds: num(v.seconds, 0, 1e7),
    score: [int(v.score[0], 0, 1e6), int(v.score[1], 0, 1e6)],
    winner: v.winner === null || v.winner === undefined ? null : int(v.winner, -1, 1), players
  };
}
function cleanPlayers(v, s) {
  if (!isObj(v)) throw E(400, 'bad_players');
  const keys = Object.keys(v), out = {}, used = new Set();
  if (keys.length > 8) throw E(400, 'bad_players');
  for (const k of keys) {
    if (!/^[0-7]$/.test(k)) throw E(400, 'bad_players');
    if (!s.m[k]) continue;
    const slot = int(v[k], 0, 7);
    if (used.has(slot)) throw E(400, 'bad_players');
    used.add(slot);
    out[k] = slot;
  }
  return out;
}
async function readBody(req) {
  if (+req.headers.get('content-length') > MAX_BODY) return null;
  if (!req.body) return '';
  const rd = req.body.getReader(), buf = new Uint8Array(MAX_BODY);
  let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    if (n + value.length > MAX_BODY) { try { await rd.cancel(); } catch {} return null; }
    buf.set(value, n);
    n += value.length;
  }
  return new TextDecoder().decode(buf.subarray(0, n));
}
function respond(status, body, origin) {
  const h = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Cache-Control': 'no-store' };
  if (body !== null) h['Content-Type'] = 'application/json';
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: h });
}
const findMember = (s, h) => { for (const k in s.m) if (s.m[k].h === h) return +k; return -1; };
const expiry = s => Math.min(s.created + HARD, Math.max(...Object.values(s.m).map(m => m.seen)) + IDLE);

async function tx(db, id, fn) {
  for (let i = 0; i < 5; i++) {
    const row = await db.prepare('SELECT rev,state,expires FROM lobbyrooms WHERE id=?').bind(id).first();
    if (!row) throw E(404, 'no_room');
    const now = Date.now();
    let s;
    try { s = JSON.parse(row.state); } catch { throw E(500, 'server'); }
    if (row.expires <= now || now - s.m[0].seen > HOST_GRACE) {
      await db.prepare('DELETE FROM lobbyrooms WHERE id=? AND rev=?').bind(id, row.rev).run();
      throw E(410, 'expired');
    }
    for (const k in s.m) if (k !== '0' && now - s.m[k].seen > GUEST_IDLE) { delete s.m[k]; delete s.players[k]; }
    const r = await fn(s, now);
    if (r.del) { await db.prepare('DELETE FROM lobbyrooms WHERE id=?').bind(id).run(); return r.out; }
    if (!r.write) return r.out;
    const u = await db.prepare('UPDATE lobbyrooms SET rev=rev+1,state=?,expires=? WHERE id=? AND rev=?')
      .bind(JSON.stringify(s), expiry(s), id, row.rev).run();
    if (changes(u)) return r.out;
  }
  throw E(409, 'retry');
}

const newMember = (h, now) => ({ h, seen: now, seq: 0, team: null, input: null, epoch: hex(8) });

async function create(db, h) {
  const now = Date.now();
  await db.prepare('DELETE FROM lobbyrooms WHERE id IN (SELECT id FROM lobbyrooms WHERE expires<=? LIMIT 32)').bind(now).run();
  const rate = await db.prepare("INSERT INTO lobbyrooms(id,rev,state,expires) VALUES(?,1,'{}',?) ON CONFLICT(id) DO UPDATE SET rev=rev+1 WHERE rev<" + RATE)
    .bind('rate:' + Math.floor(now / 6e4), now + 12e4).run();
  if (!changes(rate)) throw E(429, 'rate');
  const id = 'rf4-h2-' + hex(16);
  const s = { created: now, started: false, m: { 0: newMember(h, now) }, players: {}, snapshot: null };
  const ins = await db.prepare("INSERT INTO lobbyrooms(id,rev,state,expires) SELECT ?,1,?,? WHERE (SELECT COUNT(*) FROM lobbyrooms WHERE id LIKE 'rf4-%' AND expires>?)<" + CAP)
    .bind(id, JSON.stringify(s), expiry(s), now).run();
  if (!changes(ins)) throw E(429, 'busy');
  return { room: id, member: 0 };
}

const join = (db, room, h) => tx(db, room, (s, now) => {
  const me = findMember(s, h);
  if (me >= 0) return { out: { room, member: me } };
  if (s.started) throw E(409, 'started');
  let id = 1;
  while (id < 8 && s.m[id]) id++;
  if (id > 7) throw E(429, 'full');
  s.m[id] = newMember(h, now);
  delete s.players[id];
  return { write: true, out: { room, member: id } };
});

function view(s, me) {
  const roster = Object.keys(s.m).map(k => {
    const m = s.m[k];
    return me === 0 ? { id: +k, team: m.team, input: m.input, seq: m.seq, epoch: m.epoch } : { id: +k };
  });
  const slot = s.players[me];
  return { member: me, slot: slot === undefined ? null : slot, snapshot: s.snapshot, roster, started: s.started };
}

const sync = (db, b, h) => tx(db, b.room, (s, now) => {
  const me = findMember(s, h);
  if (me < 0) throw E(403, 'forbidden');
  const m = s.m[me];
  if (m.seq > 0 && now - m.seen < MIN_GAP) throw E(429, 'slow');
  const seq = int(b.seq, 1, Number.MAX_SAFE_INTEGER);
  const resume = b.resume !== undefined && bool(b.resume);
  if (seq <= m.seq && !(resume && Math.abs(seq - now) <= 3e4)) throw E(409, 'stale');
  const hostOnly = b.players !== undefined || b.snapshot !== undefined || b.started !== undefined;
  if (hostOnly && me !== 0) throw E(403, 'not_host');
  if (b.team !== undefined) m.team = int(b.team, 0, 1);
  if (b.input !== undefined) m.input = cleanInput(b.input);
  if (b.players !== undefined) s.players = cleanPlayers(b.players, s);
  if (b.snapshot !== undefined) {
    const snap = cleanSnapshot(b.snapshot);
    if (!s.started && b.started !== true && snap.phase !== 'lobby') throw E(409, 'not_started');
    s.snapshot = snap;
  }
  if (b.started !== undefined && bool(b.started) && !s.started) {
    if (Object.keys(s.m).length < 2) throw E(409, 'need_players');
    s.started = true;
  }
  m.seq = seq;
  m.seen = now;
  return { write: true, out: view(s, me) };
});

const start = (db, room, h) => tx(db, room, s => {
  const me = findMember(s, h);
  if (me < 0) throw E(403, 'forbidden');
  if (me !== 0) throw E(403, 'not_host');
  if (s.started) return { out: { started: true } };
  if (Object.keys(s.m).length < 2) throw E(409, 'need_players');
  s.started = true;
  return { write: true, out: { started: true } };
});

const leave = (db, room, h) => tx(db, room, s => {
  const me = findMember(s, h);
  if (me < 0) throw E(403, 'forbidden');
  if (me === 0) return { del: true, out: { left: true } };
  delete s.m[me];
  delete s.players[me];
  return { write: true, out: { left: true } };
});

async function handle(request, db) {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) throw E(415, 'bad_type');
  const text = await readBody(request);
  if (text === null) throw E(413, 'too_large');
  let b;
  try { b = JSON.parse(text); } catch { throw E(400, 'bad_json'); }
  if (!isObj(b) || typeof b.op !== 'string' || !Object.prototype.hasOwnProperty.call(KEYS, b.op)) throw E(400, 'bad_op');
  for (const k of Object.keys(b)) if (!KEYS[b.op].includes(k)) throw E(400, 'bad_field');
  if (typeof b.token !== 'string' || !TOKEN.test(b.token)) throw E(400, 'bad_token');
  const h = await sha(b.token);
  if (b.op === 'create') return create(db, h);
  if (typeof b.room !== 'string' || !ROOM.test(b.room)) throw E(400, 'bad_room');
  if (b.op === 'join') return join(db, b.room, h);
  if (b.op === 'sync') return sync(db, b, h);
  if (b.op === 'start') return start(db, b.room, h);
  return leave(db, b.room, h);
}

export async function roomApi(request, db) {
  const origin = request.headers.get('origin');
  if (!origin || !ORIGINS.has(origin)) {
    return new Response('{"error":"origin","code":"origin"}', { status: 403, headers: { 'Content-Type': 'application/json', 'Vary': 'Origin' } });
  }
  if (new URL(request.url).pathname !== '/api/room') return respond(404, { error: 'not_found', code: 'not_found' }, origin);
  if (request.method === 'OPTIONS') {
    const r = respond(204, null, origin);
    r.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    r.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    r.headers.set('Access-Control-Max-Age', '600');
    return r;
  }
  if (request.method !== 'POST') return respond(405, { error: 'method', code: 'method' }, origin);
  try {
    return respond(200, await handle(request, db), origin);
  } catch (e) {
    if (e && Number.isInteger(e.status) && typeof e.code === 'string') return respond(e.status, { error: e.code, code: e.code }, origin);
    return respond(500, { error: 'server', code: 'server' }, origin);
  }
}
