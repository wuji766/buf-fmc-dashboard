/* BUF FMC 大屏 —— 轮播状态机（纯逻辑，浏览器/Node 双端）
 * 状态：
 *   NORMAL       全页循环（dwell 到期 → 下一页，环绕）
 *   ALARM_SINGLE 锁定唯一报警页
 *   ALARM_MULTI  报警页按最早报警 ts 升序轮播（dwell 到期 → 下一个报警页，环绕）
 * 手动模式：manual(i) 后 60s 内 tick 不切页，超时自动恢复。
 * alarms[i].pageId 即页索引（由调用方保证）。
 */
(function () {
  function createCarousel(opts) {
    var pageCount = opts.pageCount;
    var dwell = opts.dwell != null ? opts.dwell : 300000; // 缺省 5 分钟
    var manualHold = opts.manualHold != null ? opts.manualHold : 60000; // 缺省 60s
    var now = opts.now || function () { return Date.now(); };

    var mode = 'NORMAL';
    var page = 0;               // 当前页索引
    var pageStartTs = now();    // 当前页开始展示时间
    var manualUntil = 0;        // 手动模式截止时间
    var wasManual = false;      // 手动模式刚结束（首个 tick 立即切页）
    var alarmPages = [];        // 排序后的报警页索引（ts 升序）
    var listeners = [];

    function emit(i) {
      for (var k = 0; k < listeners.length; k++) listeners[k](i);
    }

    function goTo(i) {
      if (i === page) return;
      page = i;
      pageStartTs = now();
      emit(i);
    }

    function advance() {
      if (mode === 'NORMAL') {
        goTo((page + 1) % pageCount);
      } else if (mode === 'ALARM_MULTI') {
        var idx = alarmPages.indexOf(page);
        goTo(alarmPages[(idx + 1) % alarmPages.length]);
      }
      // ALARM_SINGLE：锁定，不切换（goTo 已在 activeAlarms 时完成）
    }

    function tick() {
      var t = now();
      if (t < manualUntil) return page;         // 手动模式：保持
      if (wasManual) {                          // 手动刚超时：恢复自动并立即切页
        wasManual = false;
        pageStartTs = t;
        advance();
        return page;
      }
      if (t - pageStartTs < dwell) return page; // 未到 dwell：保持
      advance();
      return page;
    }

    function manual(i) {
      if (i < 0 || i >= pageCount) return page;
      manualUntil = now() + manualHold;
      wasManual = true;
      goTo(i);
      return page;
    }

    /* 运行中动态改 dwell（立即生效）：从当前页开始时刻起按新 dwell 计算，
     * 即若当前页已过时长超过新 dwell，下次 tick 立即切页；本身不触发切页。
     * 非法值（0/负/非数）忽略，保持原 dwell。 */
    function setDwell(ms) {
      if (isFinite(ms) && ms > 0) dwell = ms;
      return dwell;
    }

    function activeAlarms(alarms) {
      alarms = alarms || [];
      var t = now();
      var sorted = alarms.slice().sort(function (a, b) { return a.ts - b.ts; });
      alarmPages = sorted.map(function (a) { return a.pageId; });
      if (alarmPages.length === 0) {
        // 仅在真实模式迁移（报警态→NORMAL）时重置 dwell；
        // 连续空→空（每 2s snapshot 的常态）不得重置，否则永不切页
        if (mode !== 'NORMAL') {
          mode = 'NORMAL';
          pageStartTs = t; // 从当前页重新计 dwell
        }
      } else if (alarmPages.length === 1) {
        mode = 'ALARM_SINGLE';
        goTo(alarmPages[0]);
      } else {
        mode = 'ALARM_MULTI';
        goTo(alarmPages[0]);
      }
      return page;
    }

    function currentPage() { return page; }

    return {
      tick: tick,
      manual: manual,
      activeAlarms: activeAlarms,
      currentPage: currentPage,
      setDwell: setDwell,
      /* 状态查询（供页头状态条显示） */
      mode: function () { return mode; },
      dwell: function () { return dwell; },
      pageStartTs: function () { return pageStartTs; },
      manualUntil: function () { return manualUntil; },
      alarmPageCount: function () { return alarmPages.length; },
      alarmIdx: function () { return alarmPages.indexOf(page); },
      onTurn: function (cb) { if (typeof cb === 'function') listeners.push(cb); }
    };
  }

  if (typeof window !== 'undefined') {
    window.BUF = window.BUF || {};
    window.BUF.carousel = { createCarousel: createCarousel };
  }
  if (typeof module !== 'undefined') module.exports = { createCarousel: createCarousel };
})();
