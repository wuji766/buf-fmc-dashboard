/* BUF FMC 大屏 —— 用户缩放/平移交互（Apple Design 手势版，纯浏览器端）
 * §1 即时响应：pointerdown 即捕获并打断相机；拖拽全程 1:1 反馈，不等手势结束。
 * §2 直接操作：Pointer Events + setPointerCapture + grab offset 1:1 跟踪。
 * §3 可打断：任何输入（滚轮/按下/双击）立即打断相机动画，从当前展示值继续。
 * §5 速度交接：释放速度作为 spring 初速度（viewBox 四分量独立 spring）。
 * §6 惯性投影：大速度释放 → project(v) 预测落点 → clamp 后 spring 接管。
 * §9 软边界：拖拽越界走 rubber-band 渐进阻力，松手弹回。
 * 滚轮连续缩放：目标 ×1.1^sign 在目标值上累乘（retarget 续接不截断），指针锚点，
 *   damping 1.0 / response 0.25；双击 spring 复位（damping 1.0 / response 0.4）。
 * 兼容：保留 userOverride()/clearUserOverride()/onPageChange() 供 main.js 查询。
 */
(function () {
  var MIN_ZOOM = 0.5, MAX_ZOOM = 12, DRAG_THRESH = 4;
  var WHEEL_FACTOR = 1.1;          // 每格滚轮目标倍率（±1 档）
  var FLICK_MIN_SPEED = 50;        // 惯性投影速度阈值（SVG 单位/秒）
  var VEL_WINDOW_MS = 100;         // 释放速度采样窗口

  var svg = null, pageGetter = null;
  var userOverride = false;
  var camSpring = null;            // 进行中的相机 spring（缩放/惯性/复位）
  var goal = null;                 // 滚轮连续缩放的目标 viewBox（在目标上累乘）
  var drag = null;                 // 当前拖拽会话
  var lastRelease = null;          // 最近一次松手速度（QA 探针）

  function M() { return window.BUF && window.BUF.motion; }

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
  /* 屏幕坐标 → 指定 viewBox 下的 SVG 用户坐标（preserveAspectRatio="xMidYMid meet" 等比留边） */
  function toSvgPointIn(vb, mx, my) {
    var r = svg.getBoundingClientRect();
    var s = Math.min(r.width / vb[2], r.height / vb[3]);
    var ox = (r.width - vb[2] * s) / 2, oy = (r.height - vb[3] * s) / 2;
    return [vb[0] + (mx - r.left - ox) / s, vb[1] + (my - r.top - oy) / s];
  }
  function screenScale(vb) {
    var r = svg.getBoundingClientRect();
    return Math.min(r.width / vb[2], r.height / vb[3]);
  }

  function clampW(w) {
    var b = basis();
    return Math.max(b.w / MAX_ZOOM, Math.min(b.w / MIN_ZOOM, w));
  }
  function originBounds(w, h) {
    var b = basis();
    return {
      lox: Math.min(b.x, b.x + b.w - w), hix: Math.max(b.x, b.x + b.w - w),
      loy: Math.min(b.y, b.y + b.h - h), hiy: Math.max(b.y, b.y + b.h - h)
    };
  }
  /* 硬边界：弹簧落点/复位钳制 */
  function clampOrigin(v) {
    var o = originBounds(v[2], v[3]);
    return [Math.max(o.lox, Math.min(o.hix, v[0])),
            Math.max(o.loy, Math.min(o.hiy, v[1])), v[2], v[3]];
  }
  /* §9 软边界：越界部分 rubber-band 渐进阻力（拖拽中 1:1 跟随但逐渐滞后） */
  function rubberOrigin(v) {
    var o = originBounds(v[2], v[3]);
    var x = v[0], y = v[1];
    if (x < o.lox) x = o.lox + M().rubberband(x - o.lox, v[2]);
    else if (x > o.hix) x = o.hix + M().rubberband(x - o.hix, v[2]);
    if (y < o.loy) y = o.loy + M().rubberband(y - o.loy, v[3]);
    else if (y > o.hiy) y = o.hiy + M().rubberband(y - o.hiy, v[3]);
    return [x, y, v[2], v[3]];
  }

  /* 打断相机（§3）：报警聚焦 spring 一律取消（用户输入优先）；
   * 用户自身的 camSpring 是否取消由手势决定——滚轮要 retarget 续接（连续缩放），
   * 按下/双击/切页要取消（抓取/复位从当前展示值重新开始）。 */
  function cancelAlarmCamera() {
    if (window.BUF.alarm && window.BUF.alarm.cancelAnim) window.BUF.alarm.cancelAnim();
  }
  function interruptCamera() {
    cancelAlarmCamera();
    if (camSpring) { camSpring.cancel(); camSpring = null; }
    goal = null;
  }
  function markUser() {
    if (!userOverride) userOverride = true;
    cancelAlarmCamera();
  }

  function startSpring(target, opts) {
    opts = opts || {};
    if (camSpring) { camSpring.cancel(); camSpring = null; }
    camSpring = M().spring({
      from: getVB(),
      to: target,
      velocity: opts.velocity,
      damping: opts.damping != null ? opts.damping : 1.0,
      response: opts.response != null ? opts.response : 0.4,
      onUpdate: setVB,
      onSettle: function () { camSpring = null; goal = null; }
    });
  }

  function init() {
    svg = window.BUF.render.svgEl();
    pageGetter = function () { return window.BUF.render.page(window.BUF.render.cur()); };
    svg.style.touchAction = 'none'; // Pointer Events 触屏拖拽前提

    /* ---- 滚轮连续缩放（指针锚点，目标累乘，可中断 retarget） ---- */
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      markUser(); // 打断报警相机；自身缩放 spring 保留用于 retarget（连续缩放不截断）
      var base = goal || getVB(); // 连续滚轮在目标值上累乘，presentation 以 response 0.25 追赶
      var nw = clampW(base[2] * (e.deltaY < 0 ? 1 / WHEEL_FACTOR : WHEEL_FACTOR));
      if (nw === base[2]) return;
      var k = nw / base[2];
      var p = toSvgPointIn(base, e.clientX, e.clientY); // 指针锚点（目标空间）
      var target = clampOrigin([
        p[0] - (p[0] - base[0]) * k,
        p[1] - (p[1] - base[1]) * k,
        nw, base[3] * k
      ]);
      goal = target;
      if (camSpring) {
        camSpring.retarget(target); // 中断中改向：从当前值与当前速度继续（§3）
      } else {
        startSpring(target, { damping: 1.0, response: 0.25 });
      }
    }, { passive: false });

    /* ---- 拖拽平移：Pointer Events + capture + 1:1 + 速度历史 + 惯性 ---- */
    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 无捕获实现的环境 */ }
      interruptCamera(); // §3：按下即打断（从当前值继续），不等移动阈值
      drag = {
        id: e.pointerId, moved: false,
        sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
        hist: [[e.clientX, e.clientY, performance.now()]]
      };
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var t = performance.now(); // 统一本地时钟（合成事件 e.timeStamp 时钟域不一致）
      drag.hist.push([e.clientX, e.clientY, t]);
      if (drag.hist.length > 6) drag.hist.shift();
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) <= DRAG_THRESH) return;
        drag.moved = true;
        markUser();
      }
      /* §2 1:1 跟踪：屏幕位移 ÷ 缩放比 = viewBox 反向位移；§9 软边界 */
      var v = getVB();
      var s = screenScale(v);
      setVB(rubberOrigin([
        v[0] - (e.clientX - drag.lx) / s,
        v[1] - (e.clientY - drag.ly) / s,
        v[2], v[3]
      ]));
      drag.lx = e.clientX; drag.ly = e.clientY;
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      if (!d.moved) return;
      var v = getVB();
      /* 释放速度：最近 ≤100ms 的移动历史（屏幕 px/s → SVG 单位/s，viewBox 反向） */
      var t = performance.now();
      var h = d.hist, i = h.length - 1;
      while (i > 0 && t - h[i - 1][2] <= VEL_WINDOW_MS) i--;
      var dt = (t - h[i][2]) / 1000;
      var vx = 0, vy = 0;
      if (dt > 0.001) {
        var s = screenScale(v);
        vx = -(e.clientX - h[i][0]) / s / dt;
        vy = -(e.clientY - h[i][1]) / s / dt;
      }
      lastRelease = { vx: vx, vy: vy, speed: Math.hypot(vx, vy) };
      if (lastRelease.speed > FLICK_MIN_SPEED) {
        /* §6 惯性投影落点 → clamp；§5 spring 携带释放速度接管 */
        var target = clampOrigin([
          v[0] + M().project(vx),
          v[1] + M().project(vy),
          v[2], v[3]
        ]);
        startSpring(target, { velocity: [vx, vy, 0, 0], damping: 1.0, response: 0.4 });
      } else {
        /* 低速 / 橡胶带越界滞留：spring 弹回边界内 */
        var back = clampOrigin(v);
        if (back[0] !== v[0] || back[1] !== v[1]) {
          startSpring(back, { damping: 1.0, response: 0.4 });
        }
      }
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    /* ---- 双击 spring 复位（damping 1.0 / response 0.4，同时解除用户覆盖） ---- */
    svg.addEventListener('dblclick', function (e) {
      e.preventDefault();
      drag = null;
      var b = basis();
      userOverride = false; // 恢复报警自动聚焦
      if (window.BUF.alarm && window.BUF.alarm.cancelAnim) window.BUF.alarm.cancelAnim();
      startSpring([b.x, b.y, b.w, b.h], { damping: 1.0, response: 0.4 });
    });
  }

  /* 切页时调用：清 userOverride 与进行中相机（viewBox 由 render.show 设回页基准） */
  function onPageChange() {
    userOverride = false;
    drag = null;
    if (camSpring) { camSpring.cancel(); camSpring = null; }
    goal = null;
  }

  window.BUF = window.BUF || {};
  window.BUF.zoom = {
    init: init,
    onPageChange: onPageChange,
    clearUserOverride: function () { userOverride = false; },
    userOverride: function () { return userOverride; },
    _state: function () { return { spring: !!camSpring, goal: goal, dragging: !!drag, lastRelease: lastRelease }; } // QA 探针
  };
})();
