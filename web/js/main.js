/* BUF FMC 大屏 —— 装配入口：渲染 + 轮播状态机 + 时钟 */
(function () {
  var DWELL = 300000; // 自动换页间隔 5 分钟

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

  function show(i) {
    if (i === BUF.render.cur()) return;
    BUF.render.show(i);
    syncPager();
  }

  /* 装配 */
  BUF.render.init();
  BUF.render.show(0);

  var carousel = BUF.carousel.createCarousel({
    pageCount: BUF.render.pageCount(),
    dwell: DWELL,
    now: function () { return Date.now(); }
  });

  carousel.onTurn(function (i) { show(i); });
  buildPager(function (i) { carousel.manual(i); show(i); });

  tickClock();
  setInterval(function () {
    var p = carousel.tick();
    if (p !== null && p !== BUF.render.cur()) BUF.render.show(p);
    syncPager();
    tickClock();
  }, 1000);
})();
