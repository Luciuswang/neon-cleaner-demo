(function () {
  var d = document, err = d.getElementById('err'), status = d.getElementById('bootStatus'), start = d.getElementById('bStart');
  var ready = false, failed = false, N = 6, step = 1, name = '主程序', raw = '主程序入口', t0 = Date.now(), last = t0, retry = null;
  if (status && !d.getElementById('bootLabel')) status.textContent = '';
  function el(tag, id) { var e = d.getElementById(id); if (!e && status) { e = d.createElement(tag); e.id = id; status.appendChild(e); } return e; }
  var label = el('span', 'bootLabel'), bar = el('progress', 'bootBar'), time = el('span', 'bootTime');
  if (label) label.setAttribute('role', 'status');
  if (bar) { bar.max = N; bar.setAttribute('aria-labelledby', 'bootLabel'); }
  start.disabled = true;
  function say(t) { if (label && label.textContent !== t) label.textContent = t; }
  function showRetry(on) {
    if (!status) return;
    if (!retry) {
      if (!on) return;
      retry = d.createElement('button'); retry.type = 'button'; retry.className = 'btn'; retry.textContent = '重新加载';
      retry.style.cssText = 'pointer-events:auto;margin:4px 0 0';
      retry.onclick = function () { location.reload(); };
      status.appendChild(retry);
    }
    retry.style.display = on ? 'block' : 'none';
  }
  function mark(n, t) {
    if (ready || failed) return;
    n = Math.max(step, Math.min(N, n | 0));
    if (n === step && t === name) return;
    step = n; name = t; last = Date.now(); showRetry(false);
    if (bar) bar.value = step;
    say('正在加载 · ' + step + '/' + N + ' ' + name);
  }
  function stage(s) {
    raw = String(s);
    var t = raw.split(' / ')[0], f = /天空|地形|村落|废墟|缓冲房屋|生态/.exec(raw), c = /武器|角色|战斗反馈/.exec(raw);
    if (/首帧|运行中/.test(t)) mark(6, '首帧渲染');
    else if (/触控/.test(t)) mark(5, '触控操作');
    else if (c) mark(5, '战斗 · ' + c[0]);
    else if (f) mark(4, '场景 · ' + f[0]);
    else if (/河谷/.test(t)) mark(3, /模块/.test(t) ? '下载河谷场景' : '构建河谷场景');
    else if (/渲染/.test(t)) mark(2, '渲染引擎');
    else if (step >= 3) mark(4, t.slice(0, 24));
  }
  try { Object.defineProperty(window, 'riverBootStage', { configurable: true, get: function () { return raw; }, set: stage }); }
  catch (e) { window.riverBootStage = raw; }
  window.riverBootStep = function (n, t) { mark(n, String(t)); };
  if (bar) bar.value = step;
  say('正在加载 · 1/' + N + ' ' + name);
  var iv = setInterval(function () {
    var now = Date.now(), slow = now - last > 20000;
    if (time) time.textContent = '已用 ' + Math.round((now - t0) / 1000) + ' 秒' + (slow ? ' · 当前阶段较慢，可继续等待或重新加载' : '');
    if (slow) showRetry(true);
  }, 1000);
  function clean(m) {
    return String(m).replace(/[?#][^\s'")]*/g, '').slice(0, 160);
  }
  function fail(e) {
    if (ready || failed) return;
    failed = true; clearInterval(iv);
    var x = e && (e.reason || e.error), m = x instanceof Error ? x.message : (e && typeof e.message === 'string' ? e.message : '');
    var t = '加载失败：' + raw + (m ? ' · ' + clean(m) : '');
    err.style.display = 'block'; err.textContent = t;
    var rb = d.createElement('input'); rb.type = 'button'; rb.value = '重新加载'; rb.className = 'btn';
    rb.style.cssText = 'display:block;margin:16px 0 0;pointer-events:auto;cursor:pointer';
    rb.onclick = function () { location.reload(); };
    err.appendChild(rb); try { rb.focus(); } catch (_) {}
    say('加载失败（' + step + '/' + N + ' ' + name + '）' + (m ? ' · ' + clean(m) : ''));
    if (status) status.style.color = '#ff9d8a';
    if (time) time.textContent = '请检查网络后重新加载，地址与参数会保留。';
    showRetry(true);
  }
  function onErr(e) { if (e.target === window || (e.target && e.target.tagName === 'SCRIPT')) fail(e); }
  window.addEventListener('error', onErr, true);
  window.addEventListener('unhandledrejection', fail);
  function check() {
    if (failed || !d.body.dataset.qa) return;
    ready = true; mo.disconnect(); clearInterval(iv); start.disabled = false;
    if (status) {
      if (!start.parentNode || !start.parentNode.contains(status)) status.remove();
      else {
        if (bar) bar.value = N;
        say('已就绪 · 可以开始作战');
        status.style.color = '#8fe0a0';
        if (time) time.textContent = '';
        showRetry(false);
      }
    }
    window.removeEventListener('error', onErr, true); window.removeEventListener('unhandledrejection', fail);
  }
  var mo = new MutationObserver(check);
  mo.observe(d.body, { attributes: true, attributeFilter: ['data-qa'] });
  if (location.protocol === 'file:') fail({message:'请通过 HTTP 预览网页访问，不要双击 HTML。'});
  check();
})();
