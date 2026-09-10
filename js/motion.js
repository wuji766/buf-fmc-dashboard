/* BUF FMC 大屏 —— motion.js：spring 动画器（Apple《Designing Fluid Interfaces》语义）
 * 参数化：damping（阻尼比，1.0=临界无超调，<1 欠阻尼回摆）+ response（响应速度，秒，越小越快）。
 * 积分：半隐式欧拉（drift-kick：x += v·dt；v += a(x')·dt）——改向首帧严格连续（test ②）。
 * 值支持标量或数组（逐分量独立 spring，2D 分解 §3）。
 * 双端导出：window.BUF.motion + module.exports（node --test 可测）。
 */
(function () {
  var TWO_PI = Math.PI * 2;
  var POS_EPS = 0.01, VEL_EPS = 0.01; // settle 吸附阈值
  /* 积分单步上限：drift-kick 半隐式欧拉在大 dt 下显式阻尼项会失稳（|λ|>1 发散），
   * 超过 17.5ms 的帧拆成小步积分。测试 60fps 虚拟帧（16.67ms）保持单步（test ② 首帧 = v·dt 精确） */
  var MAX_STEP = 0.0175;

  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  /* §14 reduced-motion：用户偏好减弱动态时，spring 首帧直接吸附到目标（静态等效） */
  var REDUCED = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 驱动器 ----
   * driver 契约：{ add(tickFn), remove(tickFn) }；tickFn(dtSeconds) 每帧回调。 */

  /* 手动虚拟时钟（测试用）：flush(dtMs) 同步推进所有活跃 spring */
  function manualDriver() {
    var ticks = [];
    return {
      add: function (fn) { if (ticks.indexOf(fn) < 0) ticks.push(fn); },
      remove: function (fn) {
        var i = ticks.indexOf(fn);
        if (i >= 0) ticks.splice(i, 1);
      },
      flush: function (dtMs) {
        var dt = dtMs / 1000;
        var batch = ticks.slice(); // tick 内可能 remove（settle/cancel），先快照
        for (var i = 0; i < batch.length; i++) {
          if (ticks.indexOf(batch[i]) >= 0) batch[i](dt);
        }
      },
      _count: function () { return ticks.length; }
    };
  }

  /* rAF 驱动（生产环境）：浏览器显示同步时钟；dt 钳上限防切后台回来大跳 */
  var _rafDriver = null;
  function rafDriver() {
    if (_rafDriver) return _rafDriver;
    var ticks = [], running = false, last = null;
    function frame(ts) {
      if (!ticks.length) { running = false; last = null; return; }
      if (last == null) last = ts;
      var dt = Math.min(0.064, Math.max(0, (ts - last) / 1000)); // 钳 ≤64ms
      last = ts;
      var batch = ticks.slice();
      for (var i = 0; i < batch.length; i++) {
        if (ticks.indexOf(batch[i]) >= 0) batch[i](dt);
      }
      if (ticks.length) requestAnimationFrame(frame);
      else { running = false; last = null; }
    }
    _rafDriver = {
      add: function (fn) {
        if (ticks.indexOf(fn) < 0) ticks.push(fn);
        if (!running && typeof requestAnimationFrame === 'function') {
          running = true; last = null;
          requestAnimationFrame(frame);
        }
      },
      remove: function (fn) {
        var i = ticks.indexOf(fn);
        if (i >= 0) ticks.splice(i, 1);
      },
      _count: function () { return ticks.length; }
    };
    return _rafDriver;
  }

  /* ---- spring ----
   * opts: { from, to, velocity=0, damping=1.0, response=0.4, driver, onUpdate, onSettle }
   * 返回: { retarget(to), cancel(), velocity() }
   * settle 时吸附到目标并恰好回调一次 onSettle；cancel 后不再回调。 */
  function spring(opts) {
    opts = opts || {};
    var damping = opts.damping != null ? opts.damping : 1.0;
    var response = opts.response != null && opts.response > 0 ? opts.response : 0.4;
    var driver = opts.driver || rafDriver();
    var onUpdate = typeof opts.onUpdate === 'function' ? opts.onUpdate : function () {};
    var onSettle = typeof opts.onSettle === 'function' ? opts.onSettle : null;

    var arr = isArr(opts.from);
    var n = arr ? opts.from.length : 1;
    var x = arr ? opts.from.slice() : opts.from;
    var to = arr ? (isArr(opts.to) ? opts.to.slice() : opts.from.map(function () { return opts.to; })) : opts.to;
    var v = arr
      ? (isArr(opts.velocity) ? opts.velocity.slice() : opts.from.map(function () { return 0; }))
      : (opts.velocity || 0);

    /* 角频率与阻尼系数（单位质量 m=1）：omega = 2π/response；k = ω²；c = 2ζω */
    var omega = TWO_PI / response;
    var k = omega * omega;
    var c = 2 * damping * omega;

    var running = false, dead = false;

    function out() { return arr ? x.slice() : x; }

    function tick(dt) {
      if (dead) return;
      if (REDUCED) { // 减弱动态：不做积分，直接吸附（走下方 settle 统一收尾）
        if (arr) { for (var r = 0; r < n; r++) { x[r] = to[r]; v[r] = 0; } }
        else { x = to; v = 0; }
      } else {
        var steps = Math.max(1, Math.ceil(dt / MAX_STEP));
        var h = dt / steps;
        for (var st = 0; st < steps; st++) {
          if (arr) {
            for (var i = 0; i < n; i++) {
              x[i] += v[i] * h;                        // drift：先用当前速度推进位置（改向首帧连续）
              var a = -k * (x[i] - to[i]) - c * v[i];  // kick：再按新位置求加速度更新速度
              v[i] += a * h;
            }
          } else {
            x += v * h;
            var a1 = -k * (x - to) - c * v;
            v += a1 * h;
          }
        }
      }
      /* settle 判定：所有分量位置与速度都低于阈值 → 吸附到目标，恰好回调一次 */
      var settled = true;
      if (arr) {
        for (var j = 0; j < n; j++) {
          if (Math.abs(x[j] - to[j]) > POS_EPS || Math.abs(v[j]) > VEL_EPS) { settled = false; break; }
        }
      } else {
        settled = Math.abs(x - to) <= POS_EPS && Math.abs(v) <= VEL_EPS;
      }
      if (settled) {
        if (arr) { for (var j2 = 0; j2 < n; j2++) { x[j2] = to[j2]; v[j2] = 0; } }
        else { x = to; v = 0; }
        stop();
        onUpdate(out());
        if (onSettle) onSettle();
        return;
      }
      onUpdate(out());
    }

    function start() {
      if (dead || running) return;
      running = true;
      driver.add(tick);
    }
    function stop() {
      if (!running) return;
      running = false;
      driver.remove(tick);
    }

    start(); // 创建即启动（即使已在目标：首帧即 settle 吸附）

    return {
      /* 中途改向：从当前值与当前速度继续积分，无跳变、无速度截断（§3/§5） */
      retarget: function (newTo) {
        if (dead) return;
        if (arr) {
          to = isArr(newTo) ? newTo.slice() : x.map(function () { return newTo; });
        } else {
          to = newTo;
        }
        start(); // 若已 settle 停止，改向需重新激活
      },
      cancel: function () {
        if (dead) return;
        dead = true;
        stop();
      },
      velocity: function () { return arr ? v.slice() : v; },
      _value: function () { return out(); }
    };
  }

  /* §6 惯性投影：指数衰减公式 (v/1000)·d/(1−d)，d≈0.998 为正常滚动手感 */
  function project(initialVelocity, decelerationRate) {
    var d = decelerationRate != null ? decelerationRate : 0.998;
    return (initialVelocity / 1000) * d / (1 - d);
  }

  /* §9 rubber-band：渐进阻力 (x·dim·c)/(dim + c·|x|) */
  function rubberband(overshoot, dimension, constant) {
    var cc = constant != null ? constant : 0.55;
    return (overshoot * dimension * cc) / (dimension + cc * Math.abs(overshoot));
  }

  var api = {
    spring: spring,
    manualDriver: manualDriver,
    rafDriver: rafDriver,
    project: project,
    rubberband: rubberband
  };
  if (typeof window !== 'undefined') {
    window.BUF = window.BUF || {};
    window.BUF.motion = api;
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
