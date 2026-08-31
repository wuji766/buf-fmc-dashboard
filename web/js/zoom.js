/* BUF FMC 大屏 —— 用户缩放/平移交互（纯浏览器端，无 Node 测试）
 * 滚轮缩放（以鼠标点为中心，每档 ×1.15 / ÷1.15，钳 0.5×~12× 页基准）
 * 左键拖拽平移（>4px 才算拖）· 双击复位 · 切页/报警集变化时清 userOverride
 * userOverride 期间报警镜头的自动取景（focus/reset）由 main.js 跳过。
 */
(function () {
  var STEP = 1.15, MIN_ZOOM = 0.5, MAX_ZOOM = 12, DRAG_THRESH = 4;

  var svg = null, pageGetter = null;
  var userOverride = false;

  function getVB() {
    var v = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    return v.length === 4 && v.every(isFinite) ? v : [0, 0, 100, 100];
  }
  function setVB(v) {
    svg.setAttribute('viewBox', v.map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
  }
  function basis() {
    var p = pageGetter && pageGetter();
    var v = p && p.vb;
    if (v && v.length === 4 && v[2] > 0 && v[3] > 0) return { x: v[0], y: v[1], w: v[2], h: v[3] };
    return { x: 0, y: 0, w: p ? p.W : 100, h: p ? p.H : 100 };
  }
  /* 屏幕坐标 → SVG 用户坐标（preserveAspectRatio="xMidYMid meet" 等比留边） */
  function toSvgPoint(mx, my) {
    var r = svg.getBoundingClientRect(), v = getVB();
    var s = Math.min(r.width / v[2], r.height / v[3]);
    var ox = (r.width - v[2] * s) / 2, oy = (r.height - v[3] * s) / 2;
    return [v[0] + (mx - r.left - ox) / s, v[1] + (my - r.top - oy) / s];
  }
  /* 以 (px,py) 为不动点缩放 view 宽 factor 倍（钳 MIN~MAX） */
  function zoomAt(px, py, factor) {
    var v = getVB(), b = basis();
    var nw = Math.max(b.w / MAX_ZOOM, Math.min(b.w / MIN_ZOOM, v[2] * factor));
    if (nw === v[2]) return;
    var k = nw / v[2];
    setVB([px - (px - v[0]) * k, py - (py - v[1]) * k, nw, v[3] * k]);
  }
  function panBy(dxScreen, dyScreen) {
    var r = svg.getBoundingClientRect(), v = getVB();
    var s = Math.min(r.width / v[2], r.height / v[3]);
    setVB([v[0] - dxScreen / s, v[1] - dyScreen / s, v[2], v[3]]);
  }

  function markUser() {
    if (!userOverride) {
      userOverride = true;
      if (window.BUF.alarm && window.BUF.alarm.cancelAnim) window.BUF.alarm.cancelAnim();
    }
  }

  function init() {
    svg = window.BUF.render.svgEl();
    pageGetter = function () { return window.BUF.render.page(window.BUF.render.cur()); };

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = toSvgPoint(e.clientX, e.clientY);
      zoomAt(p[0], p[1], e.deltaY < 0 ? 1 / STEP : STEP);
      markUser();
    }, { passive: false });

    var dragging = false, moved = false, lx = 0, ly = 0;
    svg.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true; moved = false; lx = e.clientX; ly = e.clientY;
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      if (!moved && Math.hypot(dx, dy) <= DRAG_THRESH) return;
      moved = true;
      panBy(dx, dy);
      lx = e.clientX; ly = e.clientY;
      markUser();
    });
    window.addEventListener('mouseup', function () { dragging = false; });

    svg.addEventListener('dblclick', function (e) {
      e.preventDefault();
      var b = basis();
      userOverride = false; // 双击复位同时解除用户覆盖，恢复自动聚焦
      if (window.BUF.alarm && window.BUF.alarm.cancelAnim) window.BUF.alarm.cancelAnim();
      setVB([b.x, b.y, b.w, b.h]);
    });
  }

  /* 切页时调用：清 userOverride（viewBox 本身由 render.show 设回页基准） */
  function onPageChange() { userOverride = false; }

  window.BUF = window.BUF || {};
  window.BUF.zoom = {
    init: init,
    onPageChange: onPageChange,
    clearUserOverride: function () { userOverride = false; },
    userOverride: function () { return userOverride; }
  };
})();
