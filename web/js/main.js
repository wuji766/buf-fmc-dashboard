/* 临时骨架联调入口（Task 3 重写：时钟/报警/数据绑定） */
(function () {
  function tick() {
    var c = document.getElementById('clock');
    if (c) c.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
  }
  function buildPager() {
    var nav = document.getElementById('pager');
    if (!nav) return;
    for (var i = 0; i < BUF.render.pageCount(); i++) {
      (function (idx) {
        var d = document.createElement('span');
        d.className = 'dot' + (idx === 0 ? ' on' : '');
        d.onclick = function () { BUF.render.show(idx); syncPager(); };
        nav.appendChild(d);
      })(i);
    }
  }
  function syncPager() {
    var dots = document.querySelectorAll('#pager .dot');
    dots.forEach(function (d, j) { d.className = 'dot' + (j === BUF.render.cur() ? ' on' : ''); });
  }
  BUF.render.init();
  BUF.render.show(0);
  buildPager();
  tick();
  setInterval(tick, 1000);
  // 5s 轮播（临时）
  setInterval(function () {
    BUF.render.show((BUF.render.cur() + 1) % BUF.render.pageCount());
    syncPager();
  }, 5000);
})();
