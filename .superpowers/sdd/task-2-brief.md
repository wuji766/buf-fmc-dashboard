
**Files:**
- Create: `web/index.html`, `web/css/dashboard.css`, `web/js/page-render.js`
- Consumes: `web/data/page-{1..4}.js`（Task 1 产物）

**Interfaces:**
- `BUF.render.init()` → 加载 `window.BUF_PAGES`，为每页构建 `<g class="page" data-page="i">`（含 fills/texts/borders），只显示当前页。
- `BUF.render.show(i)` → 切到第 i 页（0-based），返回页对象。
- `BUF.render.svgEl()` → 主 `<svg>` 元素。
- `BUF.render.pageCount()`。

- [ ] **Step 1:** `web/index.html`：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>BUF FMC 监控大屏</title>
<link rel="stylesheet" href="css/dashboard.css">
<link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
<header id="hud">
  <span id="pageName">—</span>
  <span id="clock"></span>
  <span id="srcState" class="ok">模拟数据</span>
</header>
<main id="stage"><svg id="board" preserveAspectRatio="xMidYMid meet"></svg></main>
<footer id="alarmBar" class="hidden"></footer>
<nav id="pager"></nav>
<script src="data/page-1.js"></script><script src="data/page-2.js"></script>
<script src="data/page-3.js"></script><script src="data/page-4.js"></script>
<script src="js/page-render.js"></script>
<script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2:** `web/js/page-render.js`（完整实现）：

```js
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let svg, pages = [], groups = [], cur = -1;
  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function buildText(t) {
    // 与 pencil 实测一致：rot90 渲染盒=(x,y-w,h,w) rot270=(x-h,y,h,w)
    const e = el('text', {
      x: 0, y: 0, fill: t.color, 'font-size': t.size,
      'font-family': t.font === 'Roboto Condensed' ? "'Roboto Condensed','Noto Sans SC',sans-serif" : "'Noto Sans SC',sans-serif",
      'text-anchor': t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start',
      'dominant-baseline': t.valign === 'middle' ? 'central' : t.valign === 'top' ? 'hanging' : 'auto',
    });
    e.textContent = t.content;
    let tx = t.x, ty = t.y, deg = 0;
    if (t.rot === 90) { tx = t.x + t.h / 2; ty = t.y - t.w / 2 + t.w / 2; deg = -90; }
    else if (t.rot === 270) { tx = t.x - t.h + t.w / 2; ty = t.y + t.w / 2; deg = 90; }
    else { tx = t.x + (t.align === 'center' ? t.w / 2 : t.align === 'right' ? t.w : 0); ty = t.y + t.h; }
    if (t.bold) e.setAttribute('font-weight', 'bold');
    e.setAttribute('transform', 'translate(' + tx.toFixed(2) + ',' + ty.toFixed(2) + ') rotate(' + deg + ')');
    return e;
  }
  function init() {
    svg = document.getElementById('board');
    pages = window.BUF_PAGES || [];
    pages.forEach((p, i) => {
      svg.setAttribute('viewBox', '0 0 ' + p.W + ' ' + p.H);
      const g = el('g', { class: 'page', 'data-page': i, display: 'none' });
      for (const f of p.fills) g.appendChild(el('rect', { id: 'r_' + f.id, x: f.x, y: f.y, width: f.w, height: f.h, fill: f.color }));
      if (p.borderGeo) g.appendChild(el('path', { d: p.borderGeo, stroke: '#000', 'stroke-width': 0.75, fill: 'none' }));
      for (const t of p.texts) { const e = buildText(t); e.setAttribute('id', 'x_' + t.id); g.appendChild(e); }
      svg.appendChild(g); groups.push(g);
    });
  }
  function show(i) {
    if (i < 0 || i >= pages.length) return null;
    groups.forEach((g, j) => g.setAttribute('display', j === i ? '' : 'none'));
    svg.setAttribute('viewBox', '0 0 ' + pages[i].W + ' ' + pages[i].H);
    cur = i;
    document.getElementById('pageName').textContent = pages[i].name;
    return pages[i];
  }
  window.BUF = window.BUF || {};
  window.BUF.render = { init, show, page: i => pages[i], pageCount: () => pages.length, svgEl: () => svg, cur: () => cur };
})();
```

- [ ] **Step 3:** `web/css/dashboard.css`：body 黑底 100vw/100vh 无滚动；`#stage` flex:1；svg 铺满；页头/报警条样式；`.page` 淡入 `transition: opacity .6s`；`#alarmBar` 高 40px 横向滚动 marquee；`#pager` 右下角圆形页码按钮（`.on` 高亮）。
- [ ] **Step 4:** 临时 `web/js/main.js`：`BUF.render.init(); BUF.render.show(0); setInterval(()=>BUF.render.show((BUF.render.cur()+1)%4), 5000);`（仅骨架联调，Task 3 重写）。
- [ ] **Step 5:** 用 Playwright/浏览器打开 `file:///C:/Users/wuji/ZCodeProject/buf-fmc-dashboard/web/index.html`，对照 pencil 检查：4 页均渲染、竖排文字方向与位置正确、槽位编号/容量大字正常。截图留档 `web/qa-task2.png`。
- [ ] **Step 6:** `git add -A && git commit -m "feat: SVG page rendering and switching skeleton"`。

---

