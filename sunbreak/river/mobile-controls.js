// Riverfall touch controls. Mounted only on touch devices; desktop never imports/mounts this,
// so no listeners exist there. Drives the existing control state directly (keys / look /
// trigger / fire / reload / engage) and never synthesizes key or mouse events.
// NOT verified here: this module has not been run on the iOS simulator. Rendered-frame and
// causal-input gates must be exercised on the real device/simulator; nothing here sets QA flags.

const DEADZONE = 0.24;      // fraction of pad radius before any movement registers
const SECTOR = 0.383;       // sin(22.5deg): 8-way quantization of the stick direction
const LOOK_GAIN = 1.6;      // CSS px of finger travel -> look() units (mouse-movement-like); tune on device
const Z_INDEX = 5;          // above the canvas; must stay below lobby/scoreboard layers; adjust if those are lower

const CSS = `
#rf-touch{position:fixed;inset:0;z-index:${Z_INDEX};pointer-events:none;touch-action:none;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#rf-touch[hidden]{display:none!important}
#rf-touch>*{position:absolute;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;
  -webkit-touch-callout:none;box-sizing:border-box;margin:0}
#rf-look{top:0;right:0;bottom:0;width:55%}
#rf-move{left:calc(env(safe-area-inset-left,0px) + 22px);bottom:calc(env(safe-area-inset-bottom,0px) + 22px);
  width:clamp(128px,36vmin,176px);aspect-ratio:1;border-radius:50%;
  background:rgba(12,28,34,.28);border:2px solid rgba(190,235,240,.42)}
#rf-move>i{position:absolute;left:50%;top:50%;width:42%;height:42%;margin:-21% 0 0 -21%;border-radius:50%;
  background:rgba(200,240,245,.5);border:2px solid rgba(255,255,255,.6);pointer-events:none;will-change:transform}
#rf-fire,#rf-reload{border-radius:50%;padding:0;font:700 15px/1 system-ui,-apple-system,"PingFang SC",sans-serif;
  color:#fff;appearance:none;-webkit-appearance:none;outline:none}
#rf-fire{right:calc(env(safe-area-inset-right,0px) + 26px);bottom:calc(env(safe-area-inset-bottom,0px) + 30px);
  width:clamp(76px,21vmin,100px);aspect-ratio:1;background:rgba(215,70,50,.5);border:2px solid rgba(255,205,190,.75)}
#rf-reload{right:calc(env(safe-area-inset-right,0px) + clamp(112px,30vmin,140px));
  bottom:calc(env(safe-area-inset-bottom,0px) + 18px);
  width:clamp(58px,15vmin,72px);aspect-ratio:1;background:rgba(40,110,150,.5);border:2px solid rgba(190,230,250,.7)}
#rf-fire.rf-on,#rf-reload.rf-on{filter:brightness(1.5)}
`;

export function mountTouch({ keys, look, trigger, fire, reload, engage, isActive }) {
  if (!document.getElementById('rf-touch-style')) {
    const style = document.createElement('style');
    style.id = 'rf-touch-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.id = 'rf-touch';
  root.hidden = true;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '触屏操控');
  root.innerHTML =
    '<div id="rf-look" role="application" aria-label="视角控制区：右侧滑动转动视角"></div>' +
    '<div id="rf-move" role="application" aria-label="移动摇杆"><i aria-hidden="true"></i></div>' +
    '<button id="rf-reload" type="button" aria-label="换弹">换弹</button>' +
    '<button id="rf-fire" type="button" aria-label="开火">开火</button>';
  document.body.appendChild(root);

  const els = {
    look: root.querySelector('#rf-look'),
    move: root.querySelector('#rf-move'),
    reload: root.querySelector('#rf-reload'),
    fire: root.querySelector('#rf-fire'),
  };
  const thumb = els.move.firstElementChild;

  // ---- owned state -------------------------------------------------------
  const pointers = new Map();                 // pointerId -> {kind, x, y, cx, cy, r}
  const slot = { move: null, look: null, fire: null, reload: null }; // one pointer per control
  const owned = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
  let firing = false;
  let active = false;

  const pid = (e) => (e.pointerId == null ? 0 : e.pointerId);

  function setKey(code, value) {
    if (owned[code] === value) return;
    owned[code] = value;
    keys[code] = value;
  }
  function clearKeys() {
    for (const code in owned) setKey(code, false);
    thumb.style.transform = '';
  }
  function setFiring(value) {
    if (firing === value) return;
    firing = value;
    trigger.setMouse(value);
    els.fire.classList.toggle('rf-on', value);
  }

  function stick(p, x, y) {
    let ux = (x - p.cx) / p.r, uy = (y - p.cy) / p.r;
    const mag = Math.hypot(ux, uy);
    if (mag > 1) { ux /= mag; uy /= mag; }
    thumb.style.transform = `translate(${(ux * p.r * 0.6).toFixed(1)}px,${(uy * p.r * 0.6).toFixed(1)}px)`;
    if (mag < DEADZONE) {
      for (const code in owned) setKey(code, false);
      return;
    }
    const nx = (x - p.cx) / (mag * p.r), ny = (y - p.cy) / (mag * p.r);
    setKey('KeyW', ny < -SECTOR);
    setKey('KeyS', ny > SECTOR);
    setKey('KeyA', nx < -SECTOR);
    setKey('KeyD', nx > SECTOR);
  }

  // ---- gesture lifecycle -------------------------------------------------
  function start(kind, e) {
    if (!active) return;
    if (e.cancelable) e.preventDefault();
    const id = pid(e);
    if (pointers.has(id)) end(id);            // stale id reuse (synthetic events)
    if (slot[kind] !== null) return;          // control already held by another finger
    if (engage() === false) return;
    const el = els[kind];
    // Capture when possible; window-level listeners below cover synthetic/uncapturable pointers.
    try { el.setPointerCapture(id); } catch { /* synthetic event or inactive pointer */ }
    const p = { kind, x: e.clientX, y: e.clientY, cx: 0, cy: 0, r: 1 };
    pointers.set(id, p);
    slot[kind] = id;
    if (kind === 'move') {
      const rect = el.getBoundingClientRect();
      p.cx = rect.left + rect.width / 2;
      p.cy = rect.top + rect.height / 2;
      p.r = Math.max(1, rect.width / 2);
      stick(p, e.clientX, e.clientY);
    } else if (kind === 'fire') {
      setFiring(true);
      fire();                                 // solo: immediate shot
    } else if (kind === 'reload') {
      el.classList.add('rf-on');
      reload();
    }
  }

  function move(e) {
    const p = pointers.get(pid(e));
    if (!p) return;
    if (p.kind === 'move') {
      stick(p, e.clientX, e.clientY);
    } else if (p.kind === 'look' || p.kind === 'fire') { // dragging on fire also aims
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (dx || dy) look(dx * LOOK_GAIN, dy * LOOK_GAIN);
    }
  }

  function end(id) {
    const p = pointers.get(id);
    if (!p) return;
    pointers.delete(id);
    if (slot[p.kind] === id) slot[p.kind] = null;
    if (p.kind === 'move') clearKeys();
    else if (p.kind === 'fire') setFiring(false);
    else if (p.kind === 'reload') els.reload.classList.remove('rf-on');
    try { els[p.kind].releasePointerCapture(id); } catch { /* not captured */ }
  }

  function reset() {
    for (const id of [...pointers.keys()]) end(id);
    slot.move = slot.look = slot.fire = slot.reload = null;
    clearKeys();
    setFiring(false);
    els.reload.classList.remove('rf-on');
  }

  // ---- listeners (exist only once mounted) -------------------------------
  for (const kind of Object.keys(els)) {
    const el = els[kind];
    el.addEventListener('pointerdown', (e) => start(kind, e));
    el.addEventListener('lostpointercapture', (e) => end(pid(e)));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', (e) => e.preventDefault());
  }
  // Suppress iOS scroll/zoom/compat-mouse on the overlay; pointer events still fire.
  root.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  root.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

  // Captured events bubble here too; uncaptured (synthetic) pointers are tracked here by id.
  const onEnd = (e) => end(pid(e));
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });

  // ---- per-frame ---------------------------------------------------------
  function update() {
    const now = !!isActive();
    if (now === active) return;
    active = now;
    root.hidden = !now;
    if (!now) reset();
  }

  return { update, reset };
}
