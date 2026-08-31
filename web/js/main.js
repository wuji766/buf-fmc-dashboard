/* BUF FMC 大屏 —— 装配入口：渲染 + 轮播状态机 + 时钟 + 实时数据 */
(function () {
  var DWELL = 300000;      // 自动换页间隔 5 分钟
  var DATA_INTERVAL = 2000; // 数据刷新间隔 2s

  /* 时钟：YYYY-MM-DD HH:mm:ss */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function clockText(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function tickClock() {
    var c = document.getElementById('clock');
    if (c) c.textContent = clockText(new Date());
  }

  /* 页码导航 */
  function buildPager(onDot) {
    var nav = document.getElementById('pager');
    if (!nav) return;
    for (var i = 0; i < BUF.render.pageCount(); i++) {
      (function (idx) {
        var d = document.createElement('span');
        d.className = 'dot' + (idx === 0 ? ' on' : '');
        d.onclick = function () { onDot(idx); };
        nav.appendChild(d);
      })(i);
    }
  }
  function syncPager() {
    var dots = document.querySelectorAll('#pager .dot');
    dots.forEach(function (d, j) { d.className = 'dot' + (j === BUF.render.cur() ? ' on' : ''); });
  }

  /* 装配：渲染 */
  BUF.render.init();
  BUF.render.show(0);

  /* 装配：轮播（切页单一路径：所有切页都经 carousel → onTurn → show） */
  var carousel = BUF.carousel.createCarousel({
    pageCount: BUF.render.pageCount(),
    dwell: DWELL,
    now: function () { return Date.now(); }
  });
  carousel.onTurn(function (i) {
    if (i === BUF.render.cur()) return;
    stopCruise();
    focused = false;
    lastEnvVB = null;
    BUF.render.show(i);   // 重置整页 viewBox
    BUF.alarm.reset(i);   // 保险：viewBox 回整页，等下一 snapshot 重新聚焦
    syncPager();
  });
  buildPager(function (i) { carousel.manual(i); });
  syncPager();

  /* 装配：数据引擎（mock provider） */
  var idToIdx = {};
  for (var pi = 0; pi < BUF.render.pageCount(); pi++) idToIdx[BUF.render.page(pi).id] = pi;

  /* 报警相机状态：cruise 定时器 / 聚焦标记（避免每 2s snapshot 重复动画） */
  var cruiseTimer = null, cruiseIdx = 0, cruiseSig = '', focused = false;
  var lastAlarmRects = []; // 最近一次 snapshot 的当前页报警矩形（cruise 定时器用）
  var lastEnvVB = null;    // envelope 模式上次聚焦的 viewBox（变化检测，报警点增减/移动时重新取景）
  function stopCruise() {
    if (cruiseTimer != null) { clearInterval(cruiseTimer); cruiseTimer = null; }
    cruiseIdx = 0; cruiseSig = '';
  }

  var provider = BUF.mock.createMockProvider({ pages: window.BUF_PAGES });
  provider.start(function (snap) {
    var byPageStations = {}, byPageLots = {};
    (snap.stations || []).forEach(function (st) {
      var i = idToIdx[st.pageId];
      if (i == null) return;
      (byPageStations[i] = byPageStations[i] || []).push(st);
    });
    (snap.lots || []).forEach(function (l) {
      var i = idToIdx[l.pageId];
      if (i == null) return;
      (byPageLots[i] = byPageLots[i] || []).push(l);
    });
    for (var i = 0; i < BUF.render.pageCount(); i++) {
      BUF.render.applyStates(i, byPageStations[i] || []);
      BUF.render.applyLots(i, byPageLots[i] || []);
    }
    var active = (snap.alarms || []).filter(function (a) { return a.active; })
      .filter(function (a) { return idToIdx[a.pageId] != null; });

    /* 报警信息条：全局 active 列表（时间倒序 marquee） */
    BUF.alarm.bar(active.map(function (a) {
      return {
        ts: a.ts, pageName: BUF.render.page(idToIdx[a.pageId]).name,
        siteId: a.siteId, code: a.code, text: a.text
      };
    }));

    /* 相机：当前显示页的报警站点 → 聚焦 / 巡航 / 复位 */
    var cur = BUF.render.cur();
    var curPage = BUF.render.page(cur);
    var rectBySite = {};
    (curPage && curPage.sites || []).forEach(function (s) { rectBySite[s.siteId] = s; });
    var alarmRects = (byPageStations[cur] || []).filter(function (st) {
      return st.status === 'alarm' && rectBySite[st.siteId] && rectBySite[st.siteId].rect;
    }).map(function (st) { return rectBySite[st.siteId].rect; });

    lastAlarmRects = alarmRects;
    if (alarmRects.length) {
      var cam = BUF.alarm.computeCamera(curPage, alarmRects, {});
      if (cam.mode === 'envelope') {
        stopCruise();
        // 报警点新增/移动 → 目标 viewBox 变化 → 重新取景（sameViewBox 容差 1 单位）
        if (!focused || !BUF.alarm.sameViewBox(lastEnvVB, cam.viewBox)) {
          BUF.alarm.focus(cur, cam.viewBox);
          focused = true;
        }
        lastEnvVB = cam.viewBox.slice();
      } else {
        var sig = alarmRects.map(function (r) { return r.x + ',' + r.y; }).join(';');
        if (sig !== cruiseSig) { stopCruise(); cruiseSig = sig; }
        if (!focused) { BUF.alarm.focus(cur, cam.cruiseTargets[cruiseIdx % cam.cruiseTargets.length]); focused = true; }
        if (cruiseTimer == null) {
          cruiseTimer = setInterval(function () {
            var i = BUF.render.cur();
            var pg = BUF.render.page(i);
            if (!pg || !lastAlarmRects.length) return;
            var cs = BUF.alarm.computeCamera(pg, lastAlarmRects, {});
            var tg = cs.mode === 'cruise' ? cs.cruiseTargets : [cs.viewBox];
            if (!tg.length) return;
            cruiseIdx = (cruiseIdx + 1) % tg.length;
            BUF.alarm.focus(i, tg[cruiseIdx]);
          }, 20000);
        }
      }
    } else {
      stopCruise();
      if (focused) { BUF.alarm.reset(cur); focused = false; }
      lastEnvVB = null;
    }

    carousel.activeAlarms(active.map(function (a) {
      return { pageId: idToIdx[a.pageId], ts: a.ts };
    }));
  }, DATA_INTERVAL);

  /* 心跳：时钟 + 轮播 tick（切页由 onTurn 统一处理） */
  tickClock();
  setInterval(function () {
    carousel.tick();
    syncPager();
    tickClock();
  }, 1000);
})();
