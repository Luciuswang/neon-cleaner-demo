(function () {
  var err = document.getElementById('err'), status = document.getElementById('bootStatus'), start = document.getElementById('bStart');
  var ready = false, failed = false;
  window.riverBootStage = '主程序入口';
  start.disabled = true;
  function clean(m) {
    return String(m).replace(/[?#][^\s'")]*/g, '').slice(0, 160);
  }
  function fail(e) {
    if (ready || failed) return;
    failed = true;
    var x = e && (e.reason || e.error), m = x instanceof Error ? x.message : (e && typeof e.message === 'string' ? e.message : '');
    var t = '加载失败：' + window.riverBootStage + (m ? ' · ' + clean(m) : '');
    err.style.display = 'block'; err.textContent = t;
    if (status) status.textContent = '未能完成加载。';
  }
  function onErr(e) { if (e.target === window || (e.target && e.target.tagName === 'SCRIPT')) fail(e); }
  window.addEventListener('error', onErr, true);
  window.addEventListener('unhandledrejection', fail);
  function check() {
    if (failed || !document.body.dataset.qa) return;
    ready = true; mo.disconnect(); start.disabled = false;
    if (status) status.remove();
    window.removeEventListener('error', onErr, true); window.removeEventListener('unhandledrejection', fail);
  }
  var mo = new MutationObserver(check);
  mo.observe(document.body, { attributes: true, attributeFilter: ['data-qa'] });
  if (location.protocol === 'file:') fail({message:'请通过 HTTP 预览网页访问，不要双击 HTML。'});
  check();
})();
