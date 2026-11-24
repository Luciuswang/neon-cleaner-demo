/* Riverfall mobile probe. Evaluated repeatedly by the WKWebView host (probe.sh).
 * Single in-flight async runner; each evaluation only returns the latest status JSON.
 * Does not modify the game and never sets QA flags. All results are measured. */
(function () {
  'use strict';
  var P = window.__rfProbe;
  if (P) { return JSON.stringify(P.status); }
  P = window.__rfProbe = {
    status: {
      probe: 'riverfall-mobile', started: performance.now(), now: 0,
      stage: 'init', done: false, pass: false, failures: [], checks: {},
      mode: /[?&]mode=squads/.test(location.search) ? 'squads-host' : 'solo',
      note: /[?&]mode=squads/.test(location.search)
        ? 'Actual mobile host room, automated DOM pointer actions; no second physical player.' : ''
    }
  };
  var S = P.status;
  function stage(name) {
    S.stage = name; S.stageAt = Math.round(performance.now() - S.started);
    try { window.webkit.messageHandlers.rfProbe.postMessage({ stage: name, t: S.stageAt }); } catch (e) {}
  }
  P.stage = stage;
  function sleep(ms) {
    // rAF/timeout chained on performance.now; no setInterval, so nothing can pile up.
    return new Promise(function (res) {
      var t0 = performance.now();
      (function tick() {
        if (performance.now() - t0 >= ms) { res(); } else { setTimeout(tick, Math.min(50, ms)); }
      })();
    });
  }
  function fail(msg) { S.failures.push(msg); }
  function pick(o, names) {
    for (var i = 0; i < names.length; i++) {
      var v = o, parts = names[i].split('.');
      for (var j = 0; j < parts.length && v != null; j++) { v = v[parts[j]]; }
      if (typeof v === 'number' && isFinite(v)) { return v; }
    }
    return null;
  }
  function stats() {
    var r = window.riverMobileStats;
    try { if (typeof r === 'function') { r = r(); } } catch (e) { r = null; }
    if (!r || typeof r !== 'object') { return null; }
    return {
      frames: pick(r, ['completedFrames', 'frames', 'frame', 'frameCount']),
      x: pick(r, ['x', 'pos.x', 'position.x', 'player.x']),
      z: pick(r, ['z', 'pos.z', 'position.z', 'player.z']),
      yaw: pick(r, ['yaw', 'player.yaw', 'look.yaw']),
      mag: pick(r, ['mag', 'ammo', 'player.mag', 'weapon.mag']),
      draws: pick(r, ['drawCalls', 'draws', 'calls', 'render.calls']),
      tris: pick(r, ['triangles', 'tris', 'render.triangles']),
      webgl: (typeof r.webgl === 'undefined') ? null : r.webgl,
      keys: Object.keys(r).slice(0, 40)
    };
  }
  async function waitFor(fn, ms) {
    var t0 = performance.now();
    while (performance.now() - t0 < ms) {
      var v = fn(); if (v) { return v; }
      await sleep(100);
    }
    return null;
  }
  function visible(el) {
    if (!el) { return false; }
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  var touchId = 100;
  function fire(el, type, id, x, y) {
    // Dispatch both PointerEvent and TouchEvent so either handler style receives real DOM events.
    var ptype = { start: 'pointerdown', move: 'pointermove', end: 'pointerup' }[type];
    try {
      el.dispatchEvent(new PointerEvent(ptype, {
        bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType: 'touch',
        isPrimary: true, clientX: x, clientY: y, buttons: type === 'end' ? 0 : 1, pressure: type === 'end' ? 0 : 0.5
      }));
    } catch (e) { S.pointerEventError = String(e); }
    try {
      var t = new Touch({ identifier: id, target: el, clientX: x, clientY: y, pageX: x, pageY: y, radiusX: 8, radiusY: 8, force: 0.5 });
      var live = type === 'end' ? [] : [t];
      el.dispatchEvent(new TouchEvent('touch' + type, {
        bubbles: true, cancelable: true, composed: true, touches: live, targetTouches: live, changedTouches: [t]
      }));
    } catch (e) { S.touchEventError = String(e); }
  }
  async function drag(el, dx, dy, holdMs) {
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, id = ++touchId;
    fire(el, 'start', id, cx, cy);
    for (var i = 1; i <= 6; i++) { await sleep(30); fire(el, 'move', id, cx + dx * i / 6, cy + dy * i / 6); }
    await sleep(holdMs);
    fire(el, 'end', id, cx + dx, cy + dy);
    await sleep(150);
  }
  async function press(el, holdMs) { await drag(el, 0, 0, holdMs); }
  async function tap(el) {
    await press(el, 60);
    try { el.click(); } catch (e) {}
  }
  function samplePixels() {
    // Reads the game's own displayed canvas (largest visible one) through its existing WebGL2 context.
    var best = null, area = 0, list = document.querySelectorAll('canvas');
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (visible(list[i]) && r.width * r.height > area) { area = r.width * r.height; best = list[i]; }
    }
    if (!best) { return { error: 'no visible canvas' }; }
    var gl = null;
    try { gl = best.getContext('webgl2'); } catch (e) {}
    if (!gl) { return { error: 'displayed canvas has no WebGL2 context' }; }
    if (gl.isContextLost()) { return { error: 'webgl context lost' }; }
    var attrs = gl.getContextAttributes() || {};
    var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, n = 8, px = new Uint8Array(4);
    var min = 255, max = 0, seen = {}, uniq = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (var gy = 0; gy < n; gy++) {
      for (var gx = 0; gx < n; gx++) {
        gl.readPixels(Math.floor((gx + 0.5) * w / n), Math.floor((gy + 0.5) * h / n), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        var lum = Math.round((px[0] + px[1] + px[2]) / 3), k = (px[0] >> 3) + ',' + (px[1] >> 3) + ',' + (px[2] >> 3);
        if (lum < min) { min = lum; } if (lum > max) { max = lum; }
        if (!seen[k]) { seen[k] = 1; uniq++; }
      }
    }
    return { w: w, h: h, cssW: Math.round(best.getBoundingClientRect().width), samples: n * n,
      min: min, max: max, range: max - min, uniqueColors: uniq,
      preserveDrawingBuffer: !!attrs.preserveDrawingBuffer, glError: gl.getError() };
  }
  async function run() {
    var C = S.checks;
    stage('wait-frames');
    var s = await waitFor(function () { var v = stats(); return v && v.frames > 2 ? v : null; }, 60000);
    S.statsSeen = stats();
    if (!s) {
      var raw = stats();
      fail(raw ? (raw.webgl === false ? 'game reports WebGL unavailable' : 'riverMobileStats never exceeded 2 completed frames')
               : 'riverMobileStats missing');
      return;
    }
    C.firstFrames = s.frames;

    stage('start-overlay');
    var b = document.querySelector('#bStart');
    if (visible(b)) { await tap(b); C.startTapped = true; await sleep(800); C.startOverlayGone = !visible(b); }
    else { C.startTapped = false; }

if (S.mode !== 'solo') {
  stage('squads-host-public');
  const BOARD = '.sq-board'; // ASSUMPTION: replace with the real squads board selector
  const btn = t => [...document.querySelectorAll('button')].find(b => visible(b) && b.textContent.includes(t));
  const need = async (fn, ms, msg) => {
    const v = await waitFor(fn, ms).catch(() => null);
    if (!v) { fail(msg); throw new Error(msg); }
    return v;
  };
  for (const [text, flag] of [['我已了解', 'squadsConsent'], ['创建邀请房间', 'squadsCreateClicked']]) {
    (await need(() => btn(text), 8000, 'squads: visible button not found: ' + text)).click();
    C[flag] = true;
  }
  stage('squads-room-wait');
  const t0 = Date.now(), left = () => Math.max(1, 23000 - (Date.now() - t0));
  const live = () => document.querySelector('[data-connected="1"]');
  await need(live, left(), 'squads: public signaling not connected within 23s (network failure, no offline fallback)');
  C.squadsSignalingConnected = true;
  const board = await need(() => { const b = document.querySelector(BOARD); return b && visible(b) && b; },
    left(), 'squads: board not visible within 23s of room creation');
  C.squadsBoardVisible = true;
  stage('squads-warmup');
  await need(()=>live()?.dataset.phase==="live",14000,"round warmup did not finish"); // 4 real seconds of squads-sim warmup plus margin
  if (!live()) { fail('squads: signaling dropped during warmup'); throw new Error('squads: signaling dropped'); }
  C.squadsWarmupDone = true;
  const seats = ((window.demoQA && window.demoQA.snapshot().enemies) || []).length; // count only, never log contents
  if (seats !== 8) { fail('squads: expected 8 actor seats, got ' + seats); throw new Error('squads: seat count'); }
  C.squadsEightSeats = true;
  if (!/\bAI\b/.test(board.innerText)) { fail('squads: no AI tag in visible board text'); throw new Error('squads: no AI tag'); }
  C.squadsAiTagVisible = true;
  S.label = '4v4 mobile host + bots (not human cross-device)'; // report only if the common probes below pass
  stage('squads-ready');
}
// falls through to the common movement / yaw / fire / reload / pixel / frame checks
    var els = {};
    ['rf-move', 'rf-look', 'rf-fire', 'rf-reload'].forEach(function (id) {
      els[id] = document.getElementById(id);
      if (!visible(els[id])) { fail('control #' + id + ' missing or not visible'); }
    });
    if (S.failures.length) { return; }

    stage('move');
    var a = stats(), R = els['rf-move'].getBoundingClientRect(), reach = Math.max(30, R.height * 0.4);
    await drag(els['rf-move'], 0, -reach, 1500);
    var m = stats(), dist = Math.hypot(m.x - a.x, m.z - a.z);
    C.moveForward = dist;
    if (!(dist > 0.15)) {
      await drag(els['rf-move'], 0, reach, 1500);
      var m2 = stats(); C.moveBackward = Math.hypot(m2.x - m.x, m2.z - m.z);
      dist = Math.max(dist, C.moveBackward);
    }
    if (a.x === null || a.z === null) { fail('stats expose no x/z position'); }
    else if (!(dist > 0.15)) { fail('move stick: x/z change ' + dist + ' <= 0.15'); }

    stage('look');
    var y0 = stats().yaw, L = els['rf-look'].getBoundingClientRect();
    await drag(els['rf-look'], Math.max(40, L.width * 0.3), 0, 300);
    var y1 = stats().yaw;
    C.yawDelta = (y0 === null || y1 === null) ? null : Math.abs(y1 - y0);
    if (!(C.yawDelta > 0.01)) { fail('look drag: no yaw change'); }

    stage('fire');
    var a0 = stats().mag;
    await press(els['rf-fire'], 1200);
    var a1 = stats().mag;
    C.ammoBefore = a0; C.ammoAfterFire = a1;
    if (!(a0 !== null && a1 !== null && a1 < a0)) { fail('fire hold: ammo did not decrease'); }

    stage('reload');
    await tap(els['rf-reload']);
    var rl = await waitFor(function () { var v = stats(); return v && v.mag > a1 ? v : null; }, 6000);
    C.ammoAfterReload = rl ? rl.mag : stats().mag;
    if (!rl) { fail('reload: mag did not increase'); }

    stage('sustain');
    var f0 = stats().frames, t0 = performance.now(); await sleep(3000);
    var e = stats();
    C.sustainedFrames = e.frames - f0;
    C.sustainedFps = Math.round(C.sustainedFrames * 10000 / (performance.now() - t0)) / 10;
    C.draws = e.draws; C.tris = e.tris;
    if (!(C.sustainedFrames > 30)) { fail('sustained frames too low: ' + C.sustainedFrames); }
    if (!(e.draws > 5)) { fail('draw calls missing or trivial: ' + e.draws); }
    if (!(e.tris > 500)) { fail('triangles missing or trivial: ' + e.tris); }

    stage('pixels');
    C.pixels = samplePixels();
    if (C.pixels.error) { fail('pixels: ' + C.pixels.error); }
    else if (!C.pixels.preserveDrawingBuffer) { fail('pixels: preserveDrawingBuffer off, readback not trustworthy (is ?mobileqa=1 in the URL?)'); }
    else if (C.pixels.range < 24 || C.pixels.uniqueColors < 4) { fail('pixels: canvas content nearly uniform'); }
  }
  stage('boot');
  run().catch(function (e) { fail('probe exception: ' + String(e && e.message || e)); })
    .then(function () {
      S.final = stats(); S.now = Math.round(performance.now() - S.started);
      S.pass = S.failures.length === 0; S.done = true; stage(S.pass ? 'done-pass' : 'done-fail');
    });
  return JSON.stringify(S);
})();
