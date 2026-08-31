/* BUF FMC 大屏 —— 报警镜头（相机聚焦 / 巡航 / 复位 / 信息条）
 * computeCamera 为纯函数（Node 可测）：
 *   报警点矩形集 → 包络 + padding；zoom = W/viewBox.w 钳在 [minZoom, maxZoom]；
 *   zoom < minZoom（包络过大，说明报警点分散）→ cruise 模式（逐点各自特写）。
 * focus/reset/bar 为浏览器端 DOM/SVG 操作。
 */
(function () {
  var NS_SPEED = 80; // marquee 速度：像素/秒（动画时长 = 内容宽 / 速度）

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 生成一个中心在 (cx,cy)、宽 vw 的等比（紧凑包围盒宽高比）viewBox，钳到包围盒内 */
  function boxAround(page, cx, cy, vw) {
    var b = pageBasis(page);
    var vh = vw * b.h / b.w;
    var x = clamp(cx - vw / 2, b.x, Math.max(b.x, b.x + b.w - vw));
    var y = clamp(cy - vh / 2, b.y, Math.max(b.y, b.y + b.h - vh));
    return [round(x), round(y), round(vw), round(vh)];
  }
  function round(v) { return Math.round(v * 100) / 100; }
  /* 页面基准：优先紧凑包围盒 page.vb，缺省回退整页 [0,0,W,H] */
  function pageBasis(page) {
    var v = page && page.vb;
    if (v && v.length === 4 && v[2] > 0 && v[3] > 0) return { x: v[0], y: v[1], w: v[2], h: v[3] };
    return { x: 0, y: 0, w: page ? page.W : 0, h: page ? page.H : 0 };
  }

  function computeCamera(page, alarmSites, opts) {
    opts = opts || {};
    var minZoom = opts.minZoom != null ? opts.minZoom : 2.5;
    var maxZoom = opts.maxZoom != null ? opts.maxZoom : 4;
    var padRatio = opts.padRatio != null ? opts.padRatio : 0.6;

    var sites = (alarmSites || []).filter(function (s) { return s && s.w != null; });
    if (!sites.length || !page || !page.W) {
      var fb = pageBasis(page);
      return { viewBox: [fb.x, fb.y, fb.w, fb.h], mode: 'envelope', cruiseTargets: [] };
    }
    var basis = pageBasis(page);

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
    var vw = Math.max(needW, needH * basis.w / basis.h);

    var zoom = basis.w / vw;
    if (zoom >= minZoom) {
      /* 包络特写：zoom 钳上限 */
      var vw2 = basis.w / Math.min(zoom, maxZoom);
      return { viewBox: boxAround(page, cx, cy, vw2), mode: 'envelope', cruiseTargets: [] };
    }

    /* 包络过大 → 巡航：逐点特写（每点 maxZoom 倍） */
    var vw3 = basis.w / maxZoom;
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

  /* ---- 浏览器端：SVG 相机动画（motion.js spring，§4 damping 1.0 / response 0.4） ----
   * spring 从当前展示值积分、可被用户缩放/拖拽输入随时打断（§3），
   * 取代原 ease-in-out 固定时长插值（不可中途接管）。 */
  var animSpring = null;

  /* 取消进行中的相机动画（用户手动缩放/拖拽时调用，防止动画回写覆盖） */
  function cancelAnim() {
    if (animSpring) { animSpring.cancel(); animSpring = null; }
  }

  function getViewBox(svg) {
    var v = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    return v.length === 4 && v.every(isFinite) ? v : [0, 0, 100, 100];
  }

  function animateViewBox(target, durationMs) {
    var svg = window.BUF.render && window.BUF.render.svgEl();
    if (!svg || !window.BUF.motion) return;
    cancelAnim(); // 新取景取代旧动画（从当前值继续，无跳变）
    animSpring = window.BUF.motion.spring({
      from: getViewBox(svg),
      to: target.slice(),
      damping: 1.0,
      response: 0.4,
      onUpdate: function (v) {
        svg.setAttribute('viewBox', v.map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
      },
      onSettle: function () { animSpring = null; }
    });
  }

  function focus(pageIdx, viewBoxArr, durationMs) {
    if (!viewBoxArr || viewBoxArr.length !== 4) return;
    animateViewBox(viewBoxArr, durationMs);
  }

  function reset(pageIdx) {
    var page = window.BUF.render && window.BUF.render.page(pageIdx);
    if (!page) return;
    var b = pageBasis(page); // 紧凑包围盒，缺省回退整页
    animateViewBox([b.x, b.y, b.w, b.h], 500);
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

  /* rAF 驱动的 marquee：内容复制两份放在同一轨道 .alarm-run 内，循环长度用第一份
   * .alarm-copy 的实测 offsetWidth；报警列表每次变化都重建内容→重新测量→从头滚动，
   * 保证文字与滚动位置严格对应（不出现 CSS 动画旧进度套新内容的跳变/接缝错位）。 */
  var barRafId = 0;

  function stopBarScroll() {
    if (barRafId) { cancelAnimationFrame(barRafId); barRafId = 0; }
  }

  function startBarScroll(el) {
    stopBarScroll();
    var copy = el.querySelector('.alarm-copy');
    var track = el.querySelector('.alarm-run');
    if (!copy || !track) return;
    var loopW = copy.offsetWidth; // 单份内容实测宽度 = 循环长度
    if (!loopW) { // 尚未布局完成，下一帧再测
      barRafId = requestAnimationFrame(function () { barRafId = 0; startBarScroll(el); });
      return;
    }
    var phase = 0; // 从头开始（相位归零，内容左端与容器左端对齐）
    var last = null;
    function frame(ts) {
      if (last == null) last = ts;
      phase += NS_SPEED * (ts - last) / 1000; // 向左匀速
      last = ts;
      if (phase >= loopW) phase -= loopW; // 单份宽度取模 → 无缝循环
      track.style.transform = 'translateX(' + (-Math.round(phase)) + 'px)';
      barRafId = requestAnimationFrame(frame);
    }
    barRafId = requestAnimationFrame(frame);
  }

  function bar(alarms) {
    var el = document.getElementById('alarmBar');
    if (!el) return;
    alarms = (alarms || []).filter(function (a) { return a.active !== false; });
    if (!alarms.length) { stopBarScroll(); el.className = 'hidden'; el.innerHTML = ''; return; }
    var sorted = alarms.slice().sort(function (a, b) { return b.ts - a.ts; });
    var items = sorted.map(function (a) {
      var parts = [hhmmss(a.ts), a.pageName || a.pageId || '', a.siteId || '', a.code || '', a.text || ''];
      var s = parts.map(escapeHtml).join(' | ').replace(/\s+\|/g, ' |').replace(/\|\s+/g, '| ');
      return '<span class="alarm-item">' + s + '</span>';
    });
    var content = items.join('<span class="alarm-sep">　◆　</span>') + '<span class="alarm-sep">　◆　</span>';
    el.className = '';
    /* 单一轨道 .alarm-run 内两份内容（第二份 aria-hidden），rAF 按实测单份宽度循环 */
    el.innerHTML = '<div class="alarm-run"><span class="alarm-copy">' + content + '</span>' +
      '<span class="alarm-copy" aria-hidden="true">' + content + '</span></div>';
    startBarScroll(el);
  }

  if (typeof window !== 'undefined') {
    window.BUF = window.BUF || {};
    window.BUF.alarm = { computeCamera: computeCamera, sameViewBox: sameViewBox, focus: focus, reset: reset, bar: bar, cancelAnim: cancelAnim };
  }
  if (typeof module !== 'undefined') module.exports = { computeCamera: computeCamera, sameViewBox: sameViewBox };
})();
