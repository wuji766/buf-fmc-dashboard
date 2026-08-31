/* BUF FMC 大屏 —— Mock 数据引擎（浏览器/Node 双端）
 * 生成站点状态 / lot 归属 / 报警 的全量快照并周期推送。
 * 可测试接口：snapshot() / step() / tickTime(ms)
 * 运行接口：start(emit, intervalMs) / stop()
 */
(function () {
  var STATUSES = ['normal', 'preFull', 'full'];
  var PER_TICK_ALARM_RATE = 0.0033; // 2s 一 tick → 每页每分钟约 10%

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function createMockProvider(opts) {
    opts = opts || {};
    var pages = opts.pages || [];
    var lotsCount = opts.lots != null ? opts.lots : 8;
    var alarmRate = opts.forceAlarmRate != null ? opts.forceAlarmRate
      : (opts.alarmRate != null ? opts.alarmRate : PER_TICK_ALARM_RATE);
    var alarmDurMs = opts.alarmDurationMs; // 缺省 1-5 分钟
    var nowFn = opts.now || function () { return Date.now(); };

    // 随机源（可注入）：rnd/ri 定义在此闭包内，opts.rand 对所有随机调用生效
    var rand = opts.rand || Math.random;
    function rnd(a, b) { return a + rand() * (b - a); }
    function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
    var tOffset = 0; // 虚拟时间偏移（tickTime 推进）
    function now() { return nowFn() + tOffset; }

    /* ---- 站点状态 ---- */
    var stations = [];
    var siteIndex = {};   // siteId -> station
    var allSites = [];    // {siteId, pageId}
    pages.forEach(function (p) {
      (p.sites || []).forEach(function (s) {
        var total = ri(100, 250);
        var used = ri(0, Math.floor(total * 0.95));
        var st = {
          siteId: s.siteId,
          pageId: p.id,
          status: STATUSES[ri(0, 2)],
          capacity: { used: used, total: total, pct: Math.round(used / total * 100) }
        };
        stations.push(st);
        siteIndex[s.siteId] = st;
        allSites.push({ siteId: s.siteId, pageId: p.id });
      });
    });

    /* ---- lots ---- */
    var lots = [];
    var lotSeq = 0;
    for (var i = 0; i < lotsCount && allSites.length; i++) {
      var s0 = allSites[ri(0, allSites.length - 1)];
      lots.push({ id: 'L' + (++lotSeq), stationId: s0.siteId, pageId: s0.pageId, sinceTs: now(), nextMove: now() + ri(2000, 8000) });
    }

    /* ---- 报警 ---- */
    var alarms = [];
    var alarmSeq = 0;

    function moveDueLots() {
      var t = now();
      lots.forEach(function (l) {
        if (t >= l.nextMove && allSites.length) {
          var s = allSites[ri(0, allSites.length - 1)];
          l.stationId = s.siteId;
          l.pageId = s.pageId;
          l.sinceTs = t; // 到站时间戳
          l.nextMove = t + ri(2000, 8000);
        }
      });
    }

    function expireAlarms() {
      var t = now();
      alarms.forEach(function (a) { if (a.active && t >= a.until) a.active = false; });
    }

    function rollAlarms() {
      if (alarmRate <= 0) return;
      var t = now();
      pages.forEach(function (p) {
        if (rand() >= alarmRate) return;
        var sites = p.sites || [];
        if (!sites.length) return;
        var s = sites[ri(0, sites.length - 1)];
        var dup = alarms.some(function (a) { return a.active && a.siteId === s.siteId; });
        if (dup) return;
        var d = alarmDurMs != null ? alarmDurMs : ri(60000, 300000);
        alarms.push({
          id: 'A' + (++alarmSeq), siteId: s.siteId, pageId: p.id,
          code: 'EQ', text: 'Mock alarm @ ' + s.siteId,
          ts: t, until: t + d, active: true
        });
      });
    }

    function driftStations() {
      stations.forEach(function (st) {
        if (rand() < 0.05) {
          var idx = STATUSES.indexOf(st.status);
          var next = clamp(idx + (rand() < 0.5 ? -1 : 1), 0, 2);
          st.status = STATUSES[next];
        }
        if (rand() < 0.1) {
          st.capacity.used = clamp(st.capacity.used + ri(-3, 5), 0, st.capacity.total);
          st.capacity.pct = Math.round(st.capacity.used / st.capacity.total * 100);
        }
      });
    }

    /* ---- 对外接口 ---- */
    function step() {
      moveDueLots();
      expireAlarms();
      driftStations();
      rollAlarms();
    }

    function tickTime(ms) {
      tOffset += ms;
      moveDueLots();
      expireAlarms();
    }

    function snapshot() {
      var activeBySite = {};
      alarms.forEach(function (a) { if (a.active) activeBySite[a.siteId] = true; });
      return {
        stations: stations.map(function (st) {
          return {
            siteId: st.siteId, pageId: st.pageId,
            status: activeBySite[st.siteId] ? 'alarm' : st.status,
            capacity: { used: st.capacity.used, total: st.capacity.total, pct: st.capacity.pct }
          };
        }),
        lots: lots.map(function (l) { return { id: l.id, stationId: l.stationId, pageId: l.pageId, sinceTs: l.sinceTs }; }),
        alarms: alarms.map(function (a) {
          return { id: a.id, siteId: a.siteId, pageId: a.pageId, code: a.code, text: a.text, ts: a.ts, active: a.active };
        })
      };
    }

    var timer = null;
    function start(emit, intervalMs) {
      stop();
      timer = setInterval(function () {
        step();
        if (typeof emit === 'function') emit(snapshot());
      }, intervalMs || 2000);
    }
    function stop() {
      if (timer != null) { clearInterval(timer); timer = null; }
    }

    return {
      snapshot: snapshot,
      step: step,
      tickTime: tickTime,
      start: start,
      stop: stop
    };
  }

  if (typeof window !== 'undefined') {
    window.BUF = window.BUF || {};
    window.BUF.mock = { createMockProvider: createMockProvider };
  }
  if (typeof module !== 'undefined') module.exports = { createMockProvider: createMockProvider };
})();
