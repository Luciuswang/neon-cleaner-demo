import {connectRoom} from './squads-net.js';

// Riverfall online squads view (4v4, one life per round, friendly prototype).
// Assumptions about the host page, each read defensively:
//  - S holds the game state string in whichever property equals 'menu' at mount (fallback: S.state).
//  - Look angles live in S.yaw / S.pitch if present, otherwise on cam.rotation (order YXZ).
//  - keys is a map by KeyboardEvent.code or .key; trigger is a function or {down|held|on|active|fire}.
//  - connectRoom actions are named 'create' | 'join' | 'quick'.
//  - Solo-only DOM is hidden through body.squads-on with [data-solo-only] / .solo-only.

const ACTION_CREATE = 'create', ACTION_JOIN = 'join', ACTION_QUICK = 'quick';
const EYE = 1.7, SEND_MS = 50, SLOTS = 8;
const ROOM_RE = /^rf4-v1-(?:[0-9a-f]{20}|q[0-7])$/;
const TEAM_NAME = ['蓝队', '橙队'];
const TEAM_COL = [0x4da3ff, 0xffb02e];
const PHASE_NAME = {warmup: '准备', live: '交战', result: '结算', finished: '终局'};

const CSS = `
body.squads-on [data-solo-only],body.squads-on .solo-only,body.squads-on #bPause,body.squads-on #bPres,body.squads-on #bPresOff,body.squads-on #bAssist,body.squads-on #kills,body.squads-on #help{display:none!important}
.sq-root{position:fixed;inset:0;z-index:50;pointer-events:none;font:13px/1.35 "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;color:#e8eefc}
.sq-root [hidden]{display:none!important}
.sq-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,10,24,.72);pointer-events:auto}
.sq-overlay.sq-bare{background:none;pointer-events:none}
.sq-card{pointer-events:auto;width:min(92vw,460px);background:linear-gradient(180deg,#12244a,#0b1730);border:1px solid #2b4480;border-top:3px solid #ffb62e;border-radius:10px;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.55)}
.sq-card h2{margin:0 0 10px;font-size:18px;letter-spacing:.08em;color:#ffb62e}
.sq-card p,.sq-card li{margin:0 0 7px;color:#cfd9f2}
.sq-card ul{margin:0 0 10px;padding-left:18px}
.sq-err{color:#ffb4a0!important;background:rgba(255,90,60,.12);border-left:3px solid #ff7a5c;padding:6px 8px;border-radius:4px}
.sq-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.sq-btn{pointer-events:auto;cursor:pointer;font:inherit;font-weight:600;color:#0b1730;background:#ffb62e;border:0;border-radius:6px;padding:8px 14px}
.sq-btn:hover{background:#ffc95e}
.sq-btn.sq-alt{color:#e8eefc;background:#1d3566;border:1px solid #35539a}
.sq-btn.sq-alt:hover{background:#274684}
.sq-btn.sq-mini{padding:3px 9px;font-size:12px}
.sq-board{position:absolute;top:6px;left:50%;transform:translateX(-50%);display:flex;align-items:stretch;background:rgba(11,23,48,.86);border:1px solid #2b4480;border-bottom:2px solid #ffb62e;border-radius:8px;overflow:hidden;white-space:nowrap}
.sq-team{display:flex;align-items:center;gap:4px;padding:4px 8px}
.sq-team b{font-size:12px;letter-spacing:.1em;margin:0 4px}
.sq-t0 b{color:#7dbdff}.sq-t1 b{color:#ffc35a}
.sq-chip{font-size:11px;padding:2px 6px;border-radius:4px;background:#182c58;border:1px solid transparent}
.sq-t0 .sq-chip{border-bottom-color:#4da3ff}.sq-t1 .sq-chip{border-bottom-color:#ffb02e}
.sq-chip.sq-ai{font-style:italic;color:#b9c6e6}
.sq-chip.sq-me{border-color:#ffb62e;color:#fff;font-weight:700}
.sq-chip.sq-dead{opacity:.42;text-decoration:line-through}
.sq-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px 14px;background:#0b1730;border-left:1px solid #2b4480;border-right:1px solid #2b4480}
.sq-score{font-size:18px;font-weight:800;color:#ffb62e;letter-spacing:.06em}
.sq-sub{font-size:11px;color:#b9c6e6}
.sq-side{display:flex;align-items:center;padding:0 8px}
.sq-invite{position:absolute;top:52px;left:50%;transform:translateX(-50%);pointer-events:auto;display:flex;gap:6px;align-items:center;background:rgba(11,23,48,.94);border:1px solid #2b4480;border-radius:8px;padding:8px 10px;max-width:92vw}
.sq-invite input{font:12px monospace;width:min(60vw,360px);color:#e8eefc;background:#0b1730;border:1px solid #35539a;border-radius:4px;padding:4px 6px;user-select:text}
.sq-banner{position:absolute;top:58px;left:50%;transform:translateX(-50%);background:rgba(11,23,48,.86);border-left:3px solid #ffb62e;border-radius:4px;padding:5px 14px;font-weight:600;letter-spacing:.05em}
.sq-prompt{position:absolute;bottom:84px;left:50%;transform:translateX(-50%);background:rgba(11,23,48,.9);border:1px solid #ffb62e;color:#ffd98a;border-radius:999px;padding:6px 16px}
`;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const readable = e => String((e && e.message) || e || '未知错误').slice(0, 200);
const fmtTime = s => { s = Math.max(0, Math.ceil(+s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function mountSquads(o) {
  const {S, pos, cam, gun, enemies, keys, trigger, lockReq, clearKeys, updHUD, initAudio, onShot} = o;
  const T = o.THREE;
  const stateKey = Object.keys(S).find(k => S[k] === 'menu') || 'state';
  const hasYaw = 'yaw' in S;
  S[stateKey] = 'menu';

  let session = null, snap = null, mySlot = -1, watchSlot = -1, gen = 0;
  let engaged = false, holdFire = false, reloadLatch = false, lastSend = 0, neutralTimer = 0;
  let last = null, finalShown = false, noticeOk = false, camSnap = true;
  const R = new Array(SLOTS).fill(null);
  const markers = new Array(SLOTS).fill(null);
  let markerTex = null;

  // ---------- look helpers ----------
  const getYaw = () => hasYaw ? S.yaw : cam.rotation.y;
  const getPitch = () => hasYaw ? S.pitch : cam.rotation.x;
  const setLook = (y, p) => {
    p = Math.max(-1.5, Math.min(1.5, p));
    if (hasYaw) { S.yaw = y; S.pitch = p; }
    cam.rotation.order = 'YXZ';
    cam.rotation.y = y; cam.rotation.x = p; cam.rotation.z = 0;
  };
  const K = (...n) => n.some(k => keys[k]) ? 1 : 0;
  const trig = () => {
    if (typeof trigger === 'function') return !!trigger();
    if (!trigger) return false;
    return !!(trigger.down || trigger.held || trigger.on || trigger.active || trigger.fire);
  };

  // ---------- DOM ----------
  const style = el('style'); style.textContent = CSS; document.head.appendChild(style);
  document.body.classList.add('squads-on');
  const root = el('div', 'sq-root'); root.dataset.connected = '0';
  const overlay = el('div', 'sq-overlay'); const card = el('div', 'sq-card'); overlay.appendChild(card);
  card.setAttribute('role', 'dialog');

  const board = el('div', 'sq-board'); board.hidden = true;
  const chips = [[], []];
  const teamBox = t => {
    const b = el('div', 'sq-team sq-t' + t);
    const name = el('b', '', TEAM_NAME[t]);
    if (t === 0) b.appendChild(name);
    for (let i = 0; i < 4; i++) { const c = el('span', 'sq-chip', '—'); chips[t].push(c); b.appendChild(c); }
    if (t === 1) b.appendChild(name);
    return b;
  };
  const mid = el('div', 'sq-mid');
  const scoreEl = el('div', 'sq-score', '0 : 0'); const subEl = el('div', 'sq-sub', '');
  mid.append(scoreEl, subEl);
  const side = el('div', 'sq-side');
  const invBtn = el('button', 'sq-btn sq-mini', '邀请'); invBtn.type = 'button';
  side.appendChild(invBtn);
  board.append(teamBox(0), mid, teamBox(1), side);

  const invPanel = el('div', 'sq-invite'); invPanel.hidden = true;
  const invInput = el('input'); invInput.readOnly = true; invInput.setAttribute('aria-label', '邀请链接');
  const invCopy = el('button', 'sq-btn sq-mini', '复制'); invCopy.type = 'button';
  const invMsg = el('span', 'sq-sub', ''); invMsg.setAttribute('role', 'status');
  invPanel.append(invInput, invCopy, invMsg);

  const banner = el('div', 'sq-banner'); banner.hidden = true; banner.setAttribute('role', 'status'); banner.setAttribute('aria-live', 'polite');
  const prompt = el('div', 'sq-prompt', '点击画面开始操作 · Esc 释放鼠标'); prompt.hidden = true; prompt.setAttribute('role', 'status');
  root.append(board, invPanel, banner, prompt, overlay);
  document.body.appendChild(root);

  const btn = (text, fn, alt) => { const b = el('button', 'sq-btn' + (alt ? ' sq-alt' : ''), text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const render = (title, bare, ...nodes) => {
    card.replaceChildren(el('h2', '', title), ...nodes);
    overlay.classList.toggle('sq-bare', !!bare);
    overlay.hidden = false;
  };
  const btnRow = (...b) => { const r = el('div', 'sq-btns'); r.append(...b); return r; };

  const hashRoom = () => {
    const m = /(?:^|[#&])room=([^&]*)/.exec(location.hash || '');
    if (!m) return {given: false, room: ''};
    let v = ''; try { v = decodeURIComponent(m[1]); } catch (e) { v = ''; }
    return {given: true, room: ROOM_RE.test(v) ? v : ''};
  };
  const soloUrl = () => { const u = new URL(location.href); u.searchParams.delete('mode'); u.hash = ''; return u.href; };
  const backSolo = () => { leave(); location.href = soloUrl(); };

  function showNotice() {
    const ul = el('ul');
    [
      '联机为可选功能，单人模式完全不受影响。',
      '联机使用 WebRTC 点对点连接：房主和其他玩家可能看到你的 IP 地址；信令经由公共 PeerJS 服务。',
      '比赛由房主的浏览器裁定；房主退出或断线，比赛即结束。',
      '部分网络（严格 NAT／防火墙）可能无法连接，届时会给出提示并可重试。',
      '本游戏不要求账号。空位由明确标注 [AI] 的电脑玩家补齐。友谊赛原型，不计排名。'
    ].forEach(t => ul.appendChild(el('li', '', t)));
    render('联机小队 · 4 对 4', false, ul,
      el('p', '', '点击“我已了解”之前不会发起任何网络连接。'),
      btnRow(btn('我已了解，继续', () => { noticeOk = true; try { initAudio && initAudio(); } catch (e) {} showChoices(); }),
        btn('返回单人', backSolo, true)));
  }

  function showChoices(err) {
    if (!noticeOk) return showNotice();
    const h = hashRoom(); const nodes = [];
    if (err) { const p = el('p', 'sq-err', err); p.setAttribute('role', 'alert'); nodes.push(p); }
    if (h.given && h.room) {
      nodes.push(el('p', '', '你收到了一个邀请房间：' + h.room));
      nodes.push(btnRow(btn(err ? '重试加入' : '加入房间', () => connect(ACTION_JOIN, h.room)), btn('返回单人', backSolo, true)));
    } else {
      if (h.given) { const p = el('p', 'sq-err', '邀请链接中的房间号无效，已忽略。'); p.setAttribute('role', 'alert'); nodes.push(p); }
      nodes.push(el('p', '', '创建房间邀请好友，或快速匹配其他玩家。不足八人时由 [AI] 补位。'));
      nodes.push(btnRow(btn('创建邀请房间', () => connect(ACTION_CREATE)), btn('快速匹配', () => connect(ACTION_QUICK)), btn('返回单人', backSolo, true)));
    }
    render('联机大厅', false, ...nodes);
  }

  let statusEl = null;
  function showConnecting() {
    statusEl = el('p', '', '正在连接…'); statusEl.setAttribute('role', 'status'); statusEl.setAttribute('aria-live', 'polite');
    render('正在连接', false, statusEl, btnRow(btn('取消', () => { closeSession(); showChoices(); }, true)));
  }
  const setStatus = t => { if (statusEl) statusEl.textContent = String(t == null ? '' : t).slice(0, 200); };

  function showFinal() {
    finalShown = true; disengage();
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
    const sc = snap.score || [0, 0]; const me = snap.players.find(p => p.slot === mySlot);
    const mt = me ? me.team : 0;
    const res = sc[0] === sc[1] ? '平局' : (sc[mt] > sc[1 - mt] ? '胜利' : '失败');
    const p = el('p', '', TEAM_NAME[0] + ' ' + sc[0] + ' : ' + sc[1] + ' ' + TEAM_NAME[1]); p.setAttribute('role', 'status');
    render('比赛结束 · ' + res, true, p,
      btnRow(btn('再来一局', () => { const l = last; closeSession(); l ? connect(l.action, l.room) : showChoices(); }),
        btn('返回大厅', () => { closeSession(); showChoices(); }, true), btn('返回单人', backSolo, true)));
  }

  // ---------- connection ----------
  function connect(action, room) {
    closeSession();
    const g = ++gen; last = {action, room};
    showConnecting();
    Promise.resolve().then(() => connectRoom({
      action, room,
      onState: (s, slot) => { if (g === gen) onState(s, slot); },
      onStatus: t => { if (g === gen) setStatus(t); },
      onEnd: t => { if (g === gen) ended(t); }
    })).then(s => {
      if (g !== gen) { try { s.close(); } catch (e) {} return; }
      session = s; S[stateKey] = 'play';
      if (action === ACTION_JOIN && !last.room) last.room = s.room;
      overlay.hidden = true; board.hidden = false; root.dataset.connected = '1'; root.dataset.room = String(s.room || '');
      updatePrompt();
    }, e => { if (g === gen) { closeSession(); showChoices('连接失败：' + readable(e) + '。可重试，或检查网络（NAT／防火墙）。'); } });
  }

  function ended(text) {
    const wasFinal = finalShown;
    closeSession(wasFinal);
    if (!wasFinal) showChoices('连接已结束：' + readable(text || '房主已离开或网络中断') + '。');
  }

  function closeSession(keepFinal) {
    gen++;
    clearTimeout(neutralTimer);
    if (session) { try { session.close(); } catch (e) {} }
    session = null; mySlot = -1; watchSlot = -1; engaged = false; camSnap = true;
    if (!keepFinal) { snap = null; finalShown = false; }
    R.fill(null);
    for (let i = 0; i < SLOTS; i++) { const e = enemies[i]; if (e && e.g) e.g.visible = false; }
    if (gun) gun.visible = true;
    board.hidden = true; invPanel.hidden = true; banner.hidden = true; prompt.hidden = true;
    root.dataset.connected = '0';
    S[stateKey] = 'menu';
    try { clearKeys && clearKeys(); } catch (e) {}
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
  }

  // ---------- markers ----------
  function marker(i, team) {
    const e = enemies[i];
    if (!T || !e || !e.g) return;
    let m = markers[i];
    if (!m) {
      if (!markerTex) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 5;
        x.beginPath(); x.moveTo(8, 12); x.lineTo(56, 12); x.lineTo(32, 56); x.closePath(); x.stroke(); x.fill();
        markerTex = new T.CanvasTexture(c);
      }
      // depthTest stays on so walls occlude the marker.
      const mat = new T.SpriteMaterial({map: markerTex, transparent: true, depthTest: true, depthWrite: false});
      m = markers[i] = new T.Sprite(mat);
      m.scale.set(0.42, 0.42, 1); m.position.set(0, 2.3, 0);
      e.g.add(m);
    }
    m.material.color.setHex(TEAM_COL[team === 1 ? 1 : 0]);
  }

  // ---------- snapshots ----------
  function onState(s, slot) {
    if (!s || !Array.isArray(s.players)) return;
    const reset = !snap || snap.round !== s.round || (snap.phase !== 'warmup' && s.phase === 'warmup');
    mySlot = slot;
    for (const p of s.players) {
      const i = p.slot;
      if (!Number.isInteger(i) || i < 0 || i >= SLOTS) continue;
      let r = R[i];
      const fresh = !r || reset || (r.hp <= 0 && p.hp > 0);
      if (!r) r = R[i] = {x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 0, shots: p.shots | 0};
      else if (p.shots > r.shots) {
        const e = enemies[i];
        if (e && e.tactical && typeof e.tactical.recoil === 'number') e.tactical.recoil = 1;
        try { onShot && onShot({local: i === mySlot, actor: e, player: p}); } catch (err) {}
      }
      r.shots = p.shots | 0;
      r.tx = +p.x || 0; r.ty = +p.y || 0; r.tz = +p.z || 0; r.tyaw = +p.yaw || 0; r.tpitch = +p.pitch || 0;
      const dx = r.tx - r.x, dz = r.tz - r.z;
      if (fresh || dx * dx + dz * dz > 36) {
        r.x = r.tx; r.y = r.ty; r.z = r.tz; r.yaw = r.tyaw; r.pitch = r.tpitch;
        if (i === mySlot) camSnap = true;
      }
      if (fresh && i === mySlot && p.hp > 0) setLook(r.tyaw, r.tpitch);
      r.hp = +p.hp || 0; r.team = p.team === 1 ? 1 : 0; r.bot = !!p.bot;
      marker(i, r.team);
    }
    snap = s;
    const me = s.players.find(p => p.slot === mySlot);
    if (me) {
      if ('hp' in S) S.hp = me.hp;
      if ('ammo' in S) S.ammo = me.mag;
      if ('mag' in S) S.mag = me.mag;
      try { if (typeof me !== 'undefined' && me) { S.reload = me.reload || 0; S.res = Infinity; } updHUD && updHUD(); for (const n of document.querySelectorAll('#hud *')) if (!n.firstElementChild && n.textContent.includes('Infinity')) n.textContent = n.textContent.replace('Infinity', '∞'); } catch (e) {}
    }
    updateBoard(s, me);
    if (s.phase === 'finished') { if (!finalShown) showFinal(); }
    else if (finalShown) { finalShown = false; overlay.hidden = true; }
    updatePrompt();
  }

  function updateBoard(s, me) {
    const sc = s.score || [0, 0];
    root.dataset.phase = String(s.phase); root.dataset.slot = String(mySlot); root.dataset.round = String(s.round);
    scoreEl.textContent = (sc[0] | 0) + ' : ' + (sc[1] | 0);
    subEl.textContent = '第 ' + (s.round | 0) + ' 回合 · ' + fmtTime(s.seconds) + ' · ' + (PHASE_NAME[s.phase] || '');
    for (let t = 0; t < 2; t++) {
      const list = s.players.filter(p => (p.team === 1 ? 1 : 0) === t).sort((a, b) => a.slot - b.slot);
      for (let i = 0; i < 4; i++) {
        const c = chips[t][i], p = list[i];
        if (!p) { c.textContent = '—'; c.className = 'sq-chip sq-dead'; c.removeAttribute('aria-label'); continue; }
        const alive = p.hp > 0, isMe = p.slot === mySlot, n = p.slot + 1;
        // Labels come only from the host-assigned bot flag, never from peer-supplied text.
        c.textContent = (alive ? '● ' : '✕ ') + (p.bot ? '[AI] ' + n : isMe ? '你 ' + n : '玩家 ' + n);
        c.className = 'sq-chip' + (p.bot ? ' sq-ai' : '') + (isMe ? ' sq-me' : '') + (alive ? '' : ' sq-dead');
        c.setAttribute('aria-label', TEAM_NAME[t] + ' ' + n + ' 号位 ' + (p.bot ? '[AI] 电脑' : '真人') + (isMe ? '（你）' : '') + (alive ? ' 存活' : ' 阵亡') + ' 击杀 ' + (p.kills | 0));
      }
    }
    let text = '';
    const sec = Math.max(0, Math.ceil(+s.seconds || 0));
    if (s.phase === 'warmup') text = '准备 · ' + sec + ' 秒后开始';
    else if (s.phase === 'result') {
      const mt = me ? (me.team === 1 ? 1 : 0) : 0;
      text = (s.winner < 0 ? '本回合平局' : s.winner === mt ? '本回合胜利' : '本回合失败') + ' · ' + sec + ' 秒后继续';
    } else if (s.phase === 'live' && me && me.hp <= 0) {
      text = watchSlot >= 0 ? '你已阵亡 · 正在观战 ' + (R[watchSlot] && R[watchSlot].bot ? '[AI] ' : '玩家 ') + (watchSlot + 1) : '你已阵亡 · 等待回合结束';
    }
    banner.textContent = text; banner.hidden = !text;
  }

  function updatePrompt() {
    prompt.hidden = !(session && snap && !engaged && !finalShown);
    prompt.textContent = snap && snap.phase !== 'finished' ? '点击画面开始操作 · Esc 释放鼠标' : '';
  }

  // ---------- input ----------
  const neutral = () => ({dx: 0, dz: 0, yaw: wrapA(getYaw()), pitch: getPitch(), fire: false, reload: false, sprint: false});
  function sendNow(inp) { lastSend = performance.now(); try { session.send(inp); } catch (e) {} }
  function sendNeutral() {
    if (!session) return;
    const w = SEND_MS - (performance.now() - lastSend);
    clearTimeout(neutralTimer);
    if (w <= 0) sendNow(neutral());
    else neutralTimer = setTimeout(() => { if (session && !engaged) sendNow(neutral()); }, w);
  }
  function buildInput(alive) {
    if (!engaged || !alive || !snap || snap.phase === 'finished') return neutral();
    const yaw = getYaw();
    const f = K('KeyW', 'w', 'W') - K('KeyS', 's', 'S'), r = K('KeyD', 'd', 'D') - K('KeyA', 'a', 'A');
    let dx = -Math.sin(yaw) * f + Math.cos(yaw) * r, dz = -Math.cos(yaw) * f - Math.sin(yaw) * r;
    const l = Math.hypot(dx, dz); if (l > 1e-6) { dx /= l; dz /= l; } else { dx = 0; dz = 0; }
    const t = trig(); if (!t) holdFire = false;
    const reload = reloadLatch; reloadLatch = false;
    return {dx, dz, yaw: wrapA(yaw), pitch: getPitch(), fire: t && !holdFire, reload, sprint: !!K('ShiftLeft', 'ShiftRight', 'Shift', 'shift')};
  }
  function disengage() {
    const was = engaged; engaged = false; reloadLatch = false;
    try { clearKeys && clearKeys(); } catch (e) {}
    ;
    if (was || session) sendNeutral();
    updatePrompt();
  }

  // ---------- listeners ----------
  const canvas = (cam && cam.userData && cam.userData.canvas) || document.querySelector('canvas');
  const onCanvasDown = (ev) => {
    if (ev && ev.button !== 0) return;
    if (engaged) return;
    if (!session || !snap || finalShown) return;
    engaged = true; holdFire = true; // the recapture click must not fire
    try { initAudio && initAudio(); } catch (e) {}
    try { lockReq && lockReq(); } catch (e) {} // synchronous, inside the user gesture
    updatePrompt();
  };
  const onLock = () => { if (!document.pointerLockElement && engaged) disengage(); };
  const onBlur = () => disengage();
  const onVis = () => { if (document.hidden) disengage(); };
  const onKey = e => {
    if (e.code === 'Escape') disengage();
    else if (e.code === 'KeyR' && engaged && !e.repeat) reloadLatch = true;
  };
  if (canvas) canvas.addEventListener('mousedown', onCanvasDown);
  document.addEventListener('pointerlockchange', onLock);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('keydown', onKey);

  const inviteUrl = () => {
    const u = new URL(location.href);
    u.searchParams.set('mode', 'squads');
    u.hash = 'room=' + encodeURIComponent(String(session.room));
    return u.href;
  };
  invBtn.addEventListener('click', () => {
    if (!session) return;
    invPanel.hidden = !invPanel.hidden;
    if (!invPanel.hidden) { invInput.value = inviteUrl(); invMsg.textContent = ''; }
  });
  invCopy.addEventListener('click', () => {
    const fallback = () => { invInput.focus(); invInput.select(); invMsg.textContent = '请手动复制（Ctrl+C）'; };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(invInput.value).then(() => { invMsg.textContent = '已复制'; }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  });

  // ---------- per-frame ----------
  function frame(dt) {
    if (!session || !snap) return;
    dt = Math.min(0.1, Math.max(0, +dt || 0));
    const k = 1 - Math.exp(-dt * 14);
    const me = R[mySlot], alive = !!me && me.hp > 0;

    if (engaged && alive) {
      const ay = K('ArrowLeft') - K('ArrowRight'), ap = K('ArrowUp') - K('ArrowDown');
      if (ay || ap) setLook(getYaw() + ay * 2 * dt, getPitch() + ap * 1.4 * dt);
    }

    // spectate target: a living teammate while dead
    let w = -1;
    if (!alive && me) {
      const ok = i => i >= 0 && i !== mySlot && R[i] && R[i].hp > 0 && R[i].team === me.team;
      if (ok(watchSlot)) w = watchSlot;
      else for (let i = 0; i < SLOTS; i++) if (ok(i)) { w = i; break; }
    }
    if (w !== watchSlot) { watchSlot = w; camSnap = true; }

    for (let i = 0; i < SLOTS; i++) {
      const r = R[i], e = enemies[i];
      if (!r) { if (e && e.g) e.g.visible = false; continue; }
      r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k;
      r.yaw += wrapA(r.tyaw - r.yaw) * k; r.pitch += (r.tpitch - r.pitch) * k;
      if (!e || !e.g) continue;
      const live = r.hp > 0;
      e.alive = live; e.hp = r.hp;
      e.g.visible = live && i !== mySlot && i !== watchSlot;
      e.g.position.set(r.x, r.y, r.z);
      e.g.rotation.y = r.yaw + Math.PI; // asset forward is +Z
      if (e.tactical) {
        if (typeof e.tactical.recoil === 'number') e.tactical.recoil = Math.max(0, e.tactical.recoil - dt * 6);
        if (typeof e.tactical.stance === 'number') e.tactical.stance = 0;
      }
      if (e.wg2 && e.wg2.rotation) e.wg2.rotation.x = -r.pitch;
      if (markers[i]) markers[i].visible = live;
    }

    // camera
    const src = alive ? me : (watchSlot >= 0 ? R[watchSlot] : null);
    if (src) {
      const ty = src.y + EYE;
      if (camSnap) { pos.x = src.x; pos.y = ty; pos.z = src.z; camSnap = false; }
      else { pos.x += (src.x - pos.x) * 0.6; pos.y += (ty - pos.y) * 0.6; pos.z += (src.z - pos.z) * 0.6; }
      if (!alive) setLook(src.yaw, src.pitch); else setLook(getYaw(), getPitch());
    } else setLook(getYaw(), getPitch());
    cam.position.set(pos.x, pos.y, pos.z);
    if (gun) gun.visible = alive;

    if (performance.now() - lastSend >= SEND_MS) sendNow(buildInput(alive));
  }

  function leave() {
    closeSession();
    if (canvas) canvas.removeEventListener('mousedown', onCanvasDown);
    document.removeEventListener('pointerlockchange', onLock);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('keydown', onKey);
    for (let i = 0; i < SLOTS; i++) {
      const m = markers[i];
      if (m) { if (m.parent) m.parent.remove(m); m.material.dispose(); markers[i] = null; }
    }
    if (markerTex) { markerTex.dispose(); markerTex = null; }
    root.remove(); style.remove();
    document.body.classList.remove('squads-on');
  }

  showNotice();
  return {frame, leave};
}
