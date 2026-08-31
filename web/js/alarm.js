/* BUF FMC 大屏 —— 报警镜头（相机聚焦 / 巡航 / 复位 / 信息条）
 * computeCamera 为纯函数（Node 可测）：
 *   报警点矩形集 → 包络 + padding；zoom = W/viewBox.w 钳在 [minZoom, maxZoom]；
 *   zoom < minZoom（包络过大，说明报警点分散）→ cruise 模式（逐点各自特写）。
 * focus/reset/bar 为浏览器端 DOM/SVG 操作。
 */
(function () {
  var NS_SPEED = 80; // marquee 速度：像素/秒（动画时长 = 内容宽 / 速度）

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 生成一个中心在 (cx,cy)、宽 vw 的等比（页面宽高比）viewBox，钳到页面内 */
  function boxAround(page, cx, cy, vw) {
    var vh = vw * page.H / page.W;
    var x = clamp(cx - vw / 2, 0, Math.max(0, page.W - vw));
    var y = clamp(cy - vh / 2, 0, Math.max(0, page.H - vh));
    return [round(x), round(y), round(vw), round(vh)];
  }
  function round(v) { return Math.round(v * 100) / 100; }

  function computeCamera(page, alarmSites, opts) {
    opts = opts || {};
    var minZoom = opts.minZoom != null ? opts.minZoom : 2.5;
    var maxZoom = opts.maxZoom != null ? opts.maxZoom : 4;
    var padRatio = opts.padRatio != null ? opts.padRatio : 0.6;

    var sites = (alarmSites || []).filter(function (s) { return s && s.w != null; });
    if (!sites.length || !page || !page.W) {
      return { viewBox: [0, 0, page ? page.W : 0, page ? page.H : 0], mode: 'envelope', cruiseTargets: [] };
    }

    /* 包络 */
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    sites.forEach(function (s) {
      x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y);
      x1 = Math.max(x1, s.x + s.w); y1 = Math.max(y1, s.y + s.h);
    });
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var pad = padRatio * Math.max(x1 - x0, y1 - y0);

    /* 等比 view 宽：保证装下 (包络宽+2pad, 包络高+2pad) */
    var needW = (x1 - x0) + 2 * pad;
    var needH = (y1 - y0) + 2 * pad;
    var vw = Math.max(needW, needH * page.W / page.H);

    var zoom = page.W / vw;
    if (zoom >= minZoom) {
      /* 包络特写：zoom 钳上限 */
      var vw2 = page.W / Math.min(zoom, maxZoom);
      return { viewBox: boxAround(page, cx, cy, vw2), mode: 'envelope', cruiseTargets: [] };
    }

    /* 包络过大 → 巡航：逐点特写（每点 maxZoom 倍） */
    var vw3 = page.W / maxZoom;
    var targets = sites.map(function (s) {
      return boxAround(page, s.x + s.w / 2, s.y + s.h / 2, vw3);
    });
    return { viewBox: targets[0], mode: 'cruise', cruiseTargets: targets };
  }

  /* 两个 viewBox 是否视为同一取景（各分量差 ≤ tol，默认 1 单位）
   * 纯函数：供 main.js 在 envelope 分支做变化检测（报警点新增/移动时重新取景） */
  function sameViewBox(a, b, tol) {
    if (tol == null) tol = 1;
    if (!a || !b || a.length !== 4 || b.length !== 4) return false;
    for (var k = 0; k < 4; k++) if (Math.abs(a[k] - b[k]) > tol) return false;
    return true;
  }

  /* ---- 浏览器端：SVG 相机动画 ---- */
  var animId = 0;

  function getViewBox(svg) {
    var v = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    return v.length === 4 && v.every(isFinite) ? v : [0, 0, 100, 100];
  }

  function animateViewBox(target, durationMs) {
    var svg = window.BUF.render && window.BUF.render.svgEl();
    if (!svg) return;
    var from = getViewBox(svg);
    var to = target.slice();
    var start = null;
    var id = ++animId;
    var dur = durationMs != null ? durationMs : 500;
    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function frame(ts) {
      if (id !== animId) return; // 已被新动画取代
      if (start == null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var e = ease(t);
      var v = from.map(function (f, k) { return f + (to[k] - f) * e; });
      svg.setAttribute('viewBox', v.map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function focus(pageIdx, viewBoxArr, durationMs) {
    if (!viewBoxArr || viewBoxArr.length !== 4) return;
    animateViewBox(viewBoxArr, durationMs);
  }

  function reset(pageIdx) {
    var page = window.BUF.render && window.BUF.render.page(pageIdx);
    if (!page) return;
    animateViewBox([0, 0, page.W, page.H], 500);
  }

  /* ---- 报警信息条（marquee：内容复制两份实现无缝循环） ---- */
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmmss(ts) {
    var d = new Date(ts);
    return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function bar(alarms) {
    var el = document.getElementById('alarmBar');
    if (!el) return;
    alarms = (alarms || []).filter(function (a) { return a.active !== false; });
    if (!alarms.length) { el.className = 'hidden'; el.textContent = ''; return; }
    var sorted = alarms.slice().sort(function (a, b) { return b.ts - a.ts; });
    var items = sorted.map(function (a) {
      var parts = [hhmmss(a.ts), a.pageName || a.pageId || '', a.siteId || '', a.code || '', a.text || ''];
      var s = parts.map(escapeHtml).join(' | ').replace(/\s+\|/g, ' |').replace(/\|\s+/g, '| ');
      return '<span class="alarm-item">' + s + '</span>';
    });
    var content = items.join('<span class="alarm-sep">　◆　</span>');
    el.className = '';
    el.innerHTML = '<div class="alarm-track"><span class="alarm-run">' + content +
      '<span class="alarm-sep">　◆　</span></span><span class="alarm-run" aria-hidden="true">' + content +
      '<span class="alarm-sep">　◆　</span></span></div>';
    /* 时长按内容宽自适应（内容宽/速度），两份内容各占一半 → 用第一份宽计算 */
    requestAnimationFrame(function () {
      var run = el.querySelector('.alarm-run');
      if (!run) return;
      var dur = Math.max(10, Math.round(run.scrollWidth / NS_SPEED));
      el.querySelectorAll('.alarm-run').forEach(function (r) {
        r.style.animationDuration = dur + 's';
      });
    });
  }

  if (typeof window !== 'undefined') {
    window.BUF = window.BUF || {};
    window.BUF.alarm = { computeCamera: computeCamera, sameViewBox: sameViewBox, focus: focus, reset: reset, bar: bar };
  }
  if (typeof module !== 'undefined') module.exports = { computeCamera: computeCamera, sameViewBox: sameViewBox };
})();
