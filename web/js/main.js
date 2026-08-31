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
    BUF.render.show(i);
    syncPager();
  });
  buildPager(function (i) { carousel.manual(i); });
  syncPager();

  /* 装配：数据引擎（mock provider） */
  var idToIdx = {};
  for (var pi = 0; pi < BUF.render.pageCount(); pi++) idToIdx[BUF.render.page(pi).id] = pi;

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
      .map(function (a) { return { pageId: idToIdx[a.pageId], ts: a.ts }; })
      .filter(function (a) { return a.pageId != null; });
    carousel.activeAlarms(active);
  }, DATA_INTERVAL);

  /* 心跳：时钟 + 轮播 tick（切页由 onTurn 统一处理） */
  tickClock();
  setInterval(function () {
    carousel.tick();
    syncPager();
    tickClock();
  }, 1000);
})();
