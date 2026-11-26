const connectRoom = async (...a) => (await import('./squads-net.js')).connectRoom(...a);
import {connectCloud} from './squads-cloud.js';
import {createMatch} from './squads-sim.js';

// Riverfall online squads view (4v4, one life per round, friendly prototype).
// Assumptions about the host page, each read defensively:
//  - S holds the game state string in whichever property equals 'menu' at mount (fallback: S.state).
//  - Look angles live in S.yaw / S.pitch if present, otherwise on cam.rotation (order YXZ).
//  - keys is a map by KeyboardEvent.code or .key; trigger is a function or {down|held|on|active|fire}.
//  - connectRoom actions are named 'create' | 'join' | 'quick'.
//  - Solo-only DOM is hidden through body.squads-on with [data-solo-only] / .solo-only.

const ACTION_CREATE = 'create', ACTION_JOIN = 'join', ACTION_QUICK = 'quick';
const EYE = 1.7, SEND_MS = 50, SLOTS = 8;
const ROOM_RE = /^(?:rf4-v1-(?:[0-9a-f]{20}|q[0-7])|rf4-h2-[0-9a-f]{32})$/;
const H2_RE = /^rf4-h2-[0-9a-f]{32}$/;
// Production URL is not assigned yet: fill only after the public anonymous API is verified. Must be https.
const CLOUD_ROOM_URL = '';
// Never derived from an invite: only the constant above, or explicit loopback QA (?cloudqa=1 on 127.0.0.1/localhost).
const cloudUrl = () => {
  try {
    const hn = location.hostname;
    if ((hn === '127.0.0.1' || hn === 'localhost') && new URLSearchParams(location.search).get('cloudqa') === '1') return 'http://127.0.0.1:5197/api/room';
  } catch (e) {}
  return CLOUD_ROOM_URL.startsWith('https://') ? CLOUD_ROOM_URL : '';
};
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
.sq-pteam{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3px 4px;min-width:0;box-sizing:border-box}
.sq-pteam .sq-seat{min-width:0;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#182c58;border-radius:4px;padding:3px 5px}
@media (pointer:coarse){.sq-btn:not(.sq-mini){min-height:44px}}
@media (max-height:480px){.sq-card{box-sizing:border-box;max-width:calc(100vw - 12px);max-height:calc(100vh - 12px);max-height:calc(100dvh - 12px);overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:10px 12px}}
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

function localPractice(onState) {
  const match = createMatch();
  const slot = match.join();
  const STEP = 50, MAX_ELAPSED = 250;
  let closed = false, last = performance.now(), acc = 0;
  const emit = () => { if (!closed) onState(match.snapshot(), slot); };
  const tick = () => {
    const now = performance.now();
    acc += Math.min(now - last, MAX_ELAPSED); // cap catch-up after backgrounding
    last = now;
    let stepped = false;
    for (; acc >= STEP; acc -= STEP, stepped = true) match.step(STEP / 1000);
    if (stepped) emit();
  };
  const timer = setInterval(tick, STEP);
  setTimeout(emit, 0); // async so the caller can assign the session first
  return { room: '', localPractice: true,
    send(p) { if (!closed) match.input(slot, p); },
    close() { if (closed) return; closed = true; clearInterval(timer); match.leave(slot); } };
}

export function mountSquads(o) {
  const {S, pos, cam, gun, enemies, keys, trigger, lockReq, clearKeys, updHUD, initAudio, onShot} = o;
  const T = o.THREE;
  const stateKey = Object.keys(S).find(k => S[k] === 'menu') || 'state';
  const hasYaw = 'yaw' in S;
  S[stateKey] = 'menu';

  let session = null, snap = null, mySlot = -1, watchSlot = -1, gen = 0;
  let engaged = false, holdFire = false, reloadLatch = false, lastSend = 0, neutralTimer = 0;
  let last = null, finalShown = false, noticeOk = false, camSnap = true;
  let lobbyOn = false, partyKey = '';
  const R = new Array(SLOTS).fill(null);
  const markers = new Array(SLOTS).fill(null);
  let markerTex = null;
  const outlines = new Array(SLOTS).fill(null);
  const outlinePx = {value: null};
  let outlineMat = null;
  const rims = new Array(SLOTS).fill(null);
  const RIM_GLSL = [
    'float rimF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));',
    'float rimW = clamp(fwidth(rimF) * 2.5, 0.0, 0.45);', // few pixels across => wider band
    'float rimA = smoothstep(0.55 - rimW, 0.8 - rimW, rimF) * uRim;',
    'outgoingLight = mix(outgoingLight, vec3(1.9, 0.07, 0.04), rimA);',
    ''
  ].join('\n');

  // ---------- enemy rim: per-actor clones of the body materials, built on first hostile sighting ----------
  function buildRim(i, e) {
    const body = T && e.g.getObjectByName('licensed-tactical-display');
    if (!body) return null; // GLB not attached yet; retried next frame
    const u = {value: 0}, swaps = [], own = new Map();
    const mk = o => {
      if (!o || !o.isMeshStandardMaterial) return o;
      let c = own.get(o);
      if (!c) {
        c = o.clone(); // textures stay shared; only the clone is owned
        c.onBeforeCompile = s => {
          s.uniforms.uRim = u;
          const tag = s.fragmentShader.includes('#include <opaque_fragment>') ? '#include <opaque_fragment>' : '#include <output_fragment>';
          s.fragmentShader = 'uniform float uRim;\n' + s.fragmentShader.replace(tag, RIM_GLSL + tag);
        };
        c.customProgramCacheKey = () => 'enemy-rim';
        own.set(o, c);
      }
      return c;
    };
    body.traverse(m => {
      if (!m.isMesh || m.name === 'enemy-outline') return;
      for (let p = m; p && p !== body; p = p.parent) if (p === e.wg2) return; // not the weapon
      const orig = m.material;
      swaps.push({m, orig});
      m.material = Array.isArray(orig) ? orig.map(mk) : mk(orig);
    });
    return rims[i] = {u, swaps, own};
  }

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
  const netMsg = el('span', 'sq-sub', ''); netMsg.setAttribute('role', 'status'); netMsg.setAttribute('aria-live', 'polite');
  side.appendChild(netMsg);
  board.append(teamBox(0), mid, teamBox(1), side);

  const invPanel = el('div', 'sq-invite'); invPanel.hidden = true;
  const invInput = el('input'); invInput.readOnly = true; invInput.setAttribute('aria-label', '邀请链接');
  const invCopy = el('button', 'sq-btn sq-mini', '复制'); invCopy.type = 'button';
  const invMsg = el('span', 'sq-sub', ''); invMsg.setAttribute('role', 'status');
  const invShare = el('button', 'sq-btn sq-mini', '分享'); invShare.type = 'button';
  invShare.hidden = !(typeof navigator.share === 'function');
  const invNote = el('span', 'sq-sub', '');
  invPanel.append(invInput, invCopy, invShare, invMsg, invNote);

  const banner = el('div', 'sq-banner'); banner.hidden = true; banner.setAttribute('role', 'status'); banner.setAttribute('aria-live', 'polite');
  const prompt = el('div', 'sq-prompt', (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches ? '触摸摇杆开始操作' : '点击画面开始操作 · Esc 释放鼠标')); prompt.hidden = true; prompt.setAttribute('role', 'status');
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
  const MEM_KEY = 'sq-host-room', MEM_TTL = 10 * 60 * 1000;
  let hostRoom = '', keepTimer = 0;
  const forgetRoom = () => { try { sessionStorage.removeItem(MEM_KEY); } catch (e) {} };
  const rememberRoom = room => { try { sessionStorage.setItem(MEM_KEY, JSON.stringify({room: String(room), exp: Date.now() + MEM_TTL})); } catch (e) {} };
  const recallRoom = () => {
    try {
      const raw = sessionStorage.getItem(MEM_KEY); if (!raw) return '';
      const m = JSON.parse(raw), left = m && typeof m.exp === 'number' ? m.exp - Date.now() : 0;
      if (m && typeof m.room === 'string' && ROOM_RE.test(m.room) && left > 0 && left <= MEM_TTL) return m.room;
    } catch (e) {}
    forgetRoom(); return '';
  };
  const backSolo = () => { forgetRoom(); leave(); location.href = soloUrl(); };

  function renderParty(s, slot) {
    const players = (s.players || []).slice(0, 8);
    const me = players.find(p => p.slot === slot);
    const isHost = !!hostRoom;
    const url = inviteUrl();
    const full = players.length >= 8;

    const status = el('div', 'sq-note', full ? '房间已满 8 人，新好友暂时无法加入' : `已有 ${players.length}/8 人 · 把链接发给好友`);
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'font-size:12px;margin:2px 0';

    const link = el('input', 'sq-input');
    link.type = 'text';
    link.readOnly = true;
    link.value = url;
    link.hidden = true;
    link.setAttribute('aria-label', '邀请链接');
    link.style.cssText = 'width:100%;box-sizing:border-box;font-size:12px;user-select:text;-webkit-user-select:text';
    link.onfocus = () => link.select();

    const reveal = msg => {
      link.hidden = false;
      status.textContent = msg;
      try { link.focus(); link.select(); } catch (e) {}
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = '已复制邀请链接，发给好友即可加入';
      } catch (e) {
        reveal('无法自动复制，请长按下方链接手动复制');
      }
    };
    const share = async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: '好友房', text: '来和我一起对战！', url });
          status.textContent = '已发出邀请';
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
      reveal('请复制下方链接发给好友');
    };

    const copyBtn = btn('复制邀请链接', copy);
    const shareBtn = btn('邀请好友', share, true);
    const inviteRow = btnRow(copyBtn, shareBtn);

    const grid = el('div', 'sq-teams');
    grid.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;margin:4px 0;min-width:0';
    [['蓝队', '#4aa8ff'], ['橙队', '#ff9a3c']].forEach(([name, color], t) => {
      const members = players.filter(p => p.team === t);
      const teamFull = members.length >= 4;
      const mine = !!me && me.team === t;
      const box = el('div', 'sq-pteam');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', `${name} ${members.length}/4`);
      box.style.cssText = `border:1px solid ${color};border-radius:6px;padding:4px 6px;font-size:12px;line-height:1.35`;
      const head = el('div', 'sq-team-title', `${name} ${members.length}/4`);
      head.style.cssText = `color:${color};font-weight:700;grid-column:1/-1`;
      box.appendChild(head);
      for (let i = 0; i < 4; i++) {
        const m = members[i];
        const who = m ? (m.slot === slot ? '你' : `玩家${m.slot + 1}`) : '空位';
        const seat = el('div', 'sq-seat', `${i + 1}号位 · ${who}`);
        if (!m) seat.style.opacity = '0.55';
        box.appendChild(seat);
      }
      const label = mine ? `已在${name}` : teamFull ? `${name}已满` : `选 ${name}`;
      const pick = btn(label, () => session.chooseTeam(t), true);
      pick.disabled = mine || teamFull;
      pick.setAttribute('aria-label', mine ? `你已在${name}` : teamFull ? `${name}四个位置已满，无法加入` : `加入${name}`);
      pick.style.cssText = 'grid-column:1/-1;margin-top:3px;width:100%;box-sizing:border-box;min-height:44px;padding:4px 0;font-size:13px;touch-action:manipulation';
      box.appendChild(pick);
      grid.appendChild(box);
    });

    let action;
    if (isHost) {
      action = btn('开始对战', () => session.start());
      action.disabled = players.length < 2;
      action.setAttribute('aria-label', players.length < 2 ? '开始对战（至少需要两名玩家）' : '开始对战');
    } else {
      action = btn('等待房主开战', () => {}, true);
      action.disabled = true;
    }
    const leave = btn('离开房间', () => {
      forgetRoom();
      closeSession();
      showChoices();
    }, true);

    const hint = el('div', 'sq-note',
      full ? '所有位置已满，等待房主开战' :
      players.length < 2 ? '有空位：至少需要 2 名真人玩家才能开战；只有房主开始对战后，空位才由 [AI] 补齐' :
      '有空位：只有房主开始对战后，空位才由 [AI] 补齐（至少 2 名真人）· 每队最多 4 人，满员请选另一队');
    hint.style.cssText = 'font-size:11px;opacity:.75';

    render('好友房 · 等待开战', false, inviteRow, status, link, grid, hint, btnRow(action, leave));
  }

  function showNotice(next) {
    const ul = el('ul');
    [
      '联机为可选功能，单人模式完全不受影响。',
      '快速匹配与旧版（rf4-v1）邀请房间使用 WebRTC 点对点连接：房主和其他玩家可能看到你的 IP 地址；信令经由公共 PeerJS 服务。',
      '比赛由房主的浏览器裁定；房主退出或断线，比赛即结束。',
      '部分网络（严格 NAT／防火墙）可能无法连接，届时会给出提示并可重试。',
      '本游戏不要求账号。空位由明确标注 [AI] 的电脑玩家补齐。友谊赛原型，不计排名。'
    ].forEach(t => ul.appendChild(el('li', '', t)));
    render('联机小队 · 4 对 4', false, ul,
      el('p', '', '点击“我已了解”之前不会发起任何点对点（P2P）连接。'),
      btnRow(btn('我已了解，继续', () => { noticeOk = true; try { initAudio && initAudio(); } catch (e) {} if (typeof next === 'function') next(); else showChoices(); }),
        btn('返回大厅', () => showChoices(), true),
        btn('返回单人', backSolo, true)));
  }

  function showChoices(err) {
    const h = hashRoom(); const nodes = [];
    if (err) { const p = el('p', 'sq-err', err); p.setAttribute('role', 'alert'); nodes.push(p); }
    if (h.given && h.room) {
      nodes.push(el('p', '', '你收到了一个邀请房间：' + h.room));
      nodes.push(btnRow(btn(err ? '重试加入' : '加入房间', () => connect(ACTION_JOIN, h.room)), btn('返回单人', backSolo, true)));
    } else {
      if (h.given) { const p = el('p', 'sq-err', '邀请链接中的房间号无效，已忽略。'); p.setAttribute('role', 'alert'); nodes.push(p); }
      const mem = h.given ? '' : recallRoom();
      if (mem) {
        nodes.push(el('p', '', '此标签页不久前创建过邀请房间：' + mem + '。可恢复原房间号，让原邀请链接继续可用。'));
        nodes.push(btnRow(btn('恢复原房间', () => confirmRestore(mem)), btn('忘记原房间', () => { forgetRoom(); showChoices(); }, true)));
      }
      nodes.push(el('p', '', cloudUrl() ? '私人邀请（服务器房间）：创建后先进入房间大厅，把邀请链接发给好友。经由游戏服务器中转，玩家之间不直接连接。' : '私人邀请（点对点 P2P）：创建房间后先进入房间大厅，把邀请链接发给好友。连接前会先显示 IP 可见性说明。'));
      nodes.push(btnRow(btn(cloudUrl() ? '创建服务器房间' : '创建邀请房间', () => connect(ACTION_CREATE))));
      nodes.push(el('p', '', '可选 · 立即开打：无需邀请，直接进入对局。不足八人时由 [AI] 补位。快速匹配为点对点（P2P），连接前会先显示 IP 可见性说明并征得同意。'));
      nodes.push(btnRow(btn('快速匹配（P2P）', () => connect(ACTION_QUICK), true), btn('4v4 AI 练习（不联网）', () => connect('practice'), true), btn('返回单人', backSolo, true)));
    }
    render('联机大厅', false, ...nodes);
  }

  function confirmRestore(room) {
    if (!noticeOk && !H2_RE.test(String(room || ''))) return showNotice(() => confirmRestore(room));
    if (hashRoom().given || recallRoom() !== room) return showChoices();
    const p = el('p', '', '将以房主身份恢复房间 ' + room + '。这会开始全新的一局：之前的比分和进度不会保留，原来的玩家需要通过邀请链接重新加入。');
    render('恢复原房间？', false, p,
      btnRow(btn('确认，开始新的一局', () => connect('restore', room)), btn('取消', () => showChoices(), true)));
  }

  let statusEl = null;
  function showConnecting() {
    statusEl = el('p', '', '正在连接…'); statusEl.setAttribute('role', 'status'); statusEl.setAttribute('aria-live', 'polite');
    render('正在连接', false, statusEl, btnRow(btn('取消', () => { closeSession(); showChoices(); }, true)));
  }
  const setStatus = t => { if (session) netMsg.textContent = String(t == null ? '' : t).slice(0, 200); if (statusEl) statusEl.textContent = String(t == null ? '' : t).slice(0, 200); };

  function showFinal() {
    finalShown = true; disengage(); forgetRoom(); hostRoom = '';
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
    if (action === 'restore' && (hashRoom().given || !ROOM_RE.test(String(room || '')))) return showChoices('无法恢复原房间。');
    const curl = cloudUrl();
    const cloud = action === ACTION_CREATE ? !!curl : ((action === ACTION_JOIN || action === 'restore') && H2_RE.test(String(room || '')));
    if (cloud && !curl) return showChoices('服务器房间暂未开放，暂时无法进入此房间。请稍后重试。'); // h2 never falls back to WebRTC
    if (!cloud && action !== 'practice' && !noticeOk) return showNotice(() => connect(action, room)); // explicit consent before any P2P
    const g = ++gen; last = {action, room};
    showConnecting();
    const receive = (s, slot) => { if (g === gen) onState(s, slot); };
    Promise.resolve().then(() => action === 'practice' ? localPractice(receive) : (cloud ? connectCloud : connectRoom)({
      ...(cloud ? {url: curl} : {}),
      action, room,
      onState: (s, slot) => { if (g === gen) onState(s, slot); },
      onStatus: t => { if (g === gen) setStatus(t); },
      onEnd: t => { if (g === gen) ended(t); }
    })).then(s => {
      if (g !== gen) { try { s.close(); } catch (e) {} return; }
      if (cloud !== H2_RE.test(String(s.room || ''))) { try { s.close(); } catch (e) {} closeSession(); return showChoices('连接失败：房间类型不匹配。请稍后重试。'); }
      session = s;
      const hold = snap ? snap.phase === 'lobby' : (!s.localPractice && action !== ACTION_QUICK);
      S[stateKey] = hold ? 'menu' : 'play';
      invBtn.hidden = !!s.localPractice; root.dataset.practice = s.localPractice ? '1':'0';
      if (action === ACTION_JOIN && !last.room) last.room = s.room;
      netMsg.textContent = '';
      if ((action === ACTION_CREATE || action === 'restore') && s.role === 'host' && !s.localPractice && ROOM_RE.test(String(s.room || ''))) {
        hostRoom = String(s.room); rememberRoom(hostRoom);
        if (action === 'restore') last = {action: 'restore', room: hostRoom};
        keepTimer = setInterval(() => { if (session === s && hostRoom && !finalShown) rememberRoom(hostRoom); }, 60000);
      } else if (action === 'restore') { forgetRoom(); last = {action: ACTION_JOIN, room: s.room}; }
      root.dataset.connected = '1'; root.dataset.room = String(s.room || '');
      if (hold) { lobbyOn = true; partyKey = ''; if (snap) onState(snap, mySlot); return; }
      overlay.hidden = true; board.hidden = false;
      updatePrompt();
    }, e => { if (g === gen) { closeSession(); showChoices('连接失败：' + readable(e) + (cloud ? '。请稍后重试。' : '。可重试，或检查网络（NAT／防火墙）。')); } });
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
    lobbyOn = false; partyKey = ''; root.dataset.phase = ''; root.dataset.slot = ''; root.dataset.round = '';
    if (!keepFinal) { snap = null; finalShown = false; }
    clearInterval(keepTimer); keepTimer = 0; hostRoom = ''; netMsg.textContent = '';
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

  // ---------- enemy outline: inverted hull sharing geometry, skeleton and one material ----------
  function buildOutline(i, e) {
    const body = T && e.g.getObjectByName('licensed-tactical-display');
    if (!body) return null; // GLB not attached yet; retried next frame
    if (!outlineMat) {
      outlinePx.value = new T.Vector2();
      outlineMat = new T.MeshBasicMaterial({color: 0xff1418, side: T.BackSide, toneMapped: false, fog: false});
      // meshbasic only defines objectNormal under USE_ENVMAP||USE_SKINNING, so the
      // static path reads the raw attribute. FLIP_SIDED only negates transformedNormal,
      // which is not used here, so the push is always outward.
      outlineMat.onBeforeCompile = s => {
        s.uniforms.uOutlinePx = outlinePx;
        s.vertexShader = 'uniform vec2 uOutlinePx;\n' + s.vertexShader.replace('#include <project_vertex>', [
          '#include <project_vertex>',
          '#ifdef USE_SKINNING',
          'vec3 oN = objectNormal;',
          '#else',
          'vec3 oN = normal;',
          '#endif',
          'vec2 oD = (normalMatrix * oN).xy;',
          'gl_Position.xy += oD / max(length(oD), 1e-4) * uOutlinePx * min(gl_Position.w, 40.0);'
        ].join('\n'));
      };
    }
    const src = [];
    body.traverse(m => { if (m.isMesh && m.visible) src.push(m); });
    const list = outlines[i] = [];
    for (const m of src) {
      const sh = m.isSkinnedMesh ? new T.SkinnedMesh(m.geometry, outlineMat) : new T.Mesh(m.geometry, outlineMat);
      if (m.isSkinnedMesh) { sh.bindMode = m.bindMode; sh.bind(m.skeleton, m.bindMatrix); }
      sh.name = 'enemy-outline'; sh.frustumCulled = false; sh.visible = false;
      m.add(sh); list.push(sh); // identity child: inherits the source transform
    }
    return list;
  }

  // ---------- snapshots ----------
  function onState(s, slot) {
    if (!s || !Array.isArray(s.players)) return;
    if (s.phase === 'lobby') {
      const wasEngaged = engaged;
      snap = s; mySlot = slot; lobbyOn = true; S[stateKey] = 'menu';
      engaged = false; holdFire = false;
      if (wasEngaged) {
        try { clearKeys && clearKeys(); } catch (e) {}
        try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
      }
      board.hidden = true; prompt.hidden = true;
      for (let i = 0; i < SLOTS; i++) { const e = enemies[i]; if (e && e.g) e.g.visible = false; }
      if (gun) gun.visible = false;
      R.fill(null);
      root.dataset.phase = 'lobby'; root.dataset.slot = String(slot); root.dataset.round = String(s.round);
      if (session) {
        const key = [session.role, slot, s.players.map(p => [p.slot, p.name, p.team, p.ai, p.bot, p.ready].join(':')).join(',')].join('|');
        if (key !== partyKey) { partyKey = key; overlay.hidden = false; renderParty(s, slot); }
      }
      return;
    }
    if (lobbyOn) {
      lobbyOn = false; partyKey = ''; snap = null; R.fill(null);
      root.dataset.phase = String(s.phase || ''); root.dataset.slot = String(slot); root.dataset.round = String(s.round);
      if (gun) gun.visible = true;
      camSnap = true;
      if (session) {
        S[stateKey] = 'play'; overlay.hidden = true; board.hidden = false;
        const g0 = gen;
        Promise.resolve().then(() => { if (g0 === gen && session && snap && snap.phase !== 'lobby') updatePrompt(); });
      }
    }
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
    prompt.textContent = snap && snap.phase !== 'finished' ? (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches ? '触摸摇杆开始操作' : '点击画面开始操作 · Esc 释放鼠标') : '';
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
    if (!session || !snap || finalShown || snap.phase === 'lobby') return;
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
    if (!invPanel.hidden) {
      invInput.value = inviteUrl(); invMsg.textContent = '';
      invNote.textContent = hostRoom
        ? '分享后请直接切回本标签页，不要刷新。刷新或关闭本页会结束本局；约 10 分钟内可在大厅“恢复原房间”继续使用此链接，但会重开新的一局，比分不保留。'
        : '分享后请直接切回本标签页，不要刷新。刷新或关闭本页会断开连接，房间可能重置，需通过邀请链接重新加入。';
    }
  });
  invShare.addEventListener('click', () => {
    if (!session) return;
    const url = invInput.value || inviteUrl();
    try {
      Promise.resolve(navigator.share({title: '联机小队 4 对 4', text: '加入我的房间', url})).then(
        () => { invMsg.textContent = '已分享，请切回本标签页继续'; },
        e => { invMsg.textContent = e && e.name === 'AbortError' ? '已取消分享' : '分享失败，请改用复制'; });
    } catch (e) { invMsg.textContent = '分享失败，请改用复制'; }
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
    if (!session || !snap || snap.phase === 'lobby') return;
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
      const on = live && !!me && r.team !== me.team && (snap.phase === 'warmup' || snap.phase === 'live');
      const ol = outlines[i] || buildOutline(i, e);
      if (ol) {
        if (on) outlinePx.value.set(5 / window.innerWidth, 5 / window.innerHeight); // 2.5 CSS px
        for (let j = 0; j < ol.length; j++) ol[j].visible = on;
      }
      const rim = rims[i] || (on ? buildRim(i, e) : null); // friendlies are never cloned
      if (rim) rim.u.value = on ? 1 : 0;
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
    for (let i = 0; i < SLOTS; i++) {
      const ol = outlines[i];
      if (ol) { for (const sh of ol) sh.removeFromParent(); outlines[i] = null; } // geometry/skeleton belong to the source
    }
    if (outlineMat) { outlineMat.dispose(); outlineMat = null; }
    for (let i = 0; i < SLOTS; i++) {
      const rim = rims[i];
      if (!rim) continue;
      for (const s of rim.swaps) s.m.material = s.orig; // restore shared GLB materials
      rim.own.forEach(c => c.dispose()); // owned clones only
      rims[i] = null;
    }
    root.remove(); style.remove();
    document.body.classList.remove('squads-on');
  }

  { const h0 = hashRoom(); if (h0.given && H2_RE.test(h0.room)) connect(ACTION_JOIN, h0.room); else showChoices(); } // h2 invite: server only, no peer contact, so no consent step; one attempt, no retry loop
  function mayTouch() { return !!(session && snap && !finalShown && snap.phase !== 'finished' && snap.phase !== 'lobby'); }
  function touchEngage() {
    if (!mayTouch()) return null;
    if (!engaged) { engaged = true; holdFire = false; try { initAudio && initAudio(); } catch (e) {} updatePrompt(); }
    return {session, snap};
  }
  function touchReload() { if (engaged && mayTouch()) reloadLatch = true; }
  return {frame, leave, mayTouch, touchEngage, touchReload};
}
