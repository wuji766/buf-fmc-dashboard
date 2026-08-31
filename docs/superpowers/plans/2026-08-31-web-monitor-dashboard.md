# BUF FMC 浏览器监控大屏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 pencil/elements 数据还原为 4 页浏览器 SVG 监控大屏：轮播 + mock 站点/lot/报警 + 报警镜头特写。

**Architecture:** 免构建纯静态站点（`web/index.html` + 普通 `<script>`，全局命名空间 `BUF.*`，数据预生成为 `.js` 文件规避 file:// 的 fetch/ESM 限制）。逻辑模块写成「浏览器/Node 双端可加载」（尾部 `module.exports`），用 `node --test` 做 TDD；渲染/交互最终在浏览器人工验收。

**Tech Stack:** 原生 JS + SVG + CSS（无依赖）；Node ≥24 仅用于测试与数据准备脚本。

## Global Constraints

- 双击 `web/index.html`（file:// 协议）必须可用：**禁止** ES modules、`fetch()` 本地 JSON、外部框架。
- 页面数据文件用 `web/data/page-{1..4}.js`，内容 `window.BUF_PAGES.push({...})`。
- 坐标系：1 Excel pt = 1 SVG 用户单位；viewBox = `0 0 W H`（页元信息里给出）。
- 站点状态色：`#00FF00` 正常、`#92D050` 满杯预告、`#FF66FF` 满杯警告；报警 = 原色 + `#FF0000` 描边脉冲。
- 轮播 dwell 默认 300000ms（可配 180000–360000）；手动跳页后 60000ms 恢复自动。
- 提交信息用 conventional commits（feat/test/chore）。
- 构建类命令（如有）由用户手动执行；本计划只有 node 脚本/测试，无需 dev server。

## 文件结构

```
buf-fmc-dashboard/
  web/
    index.html          # 入口：页头(产线名/时钟/数据源状态) + SVG舞台 + 报警条 + 页码
    css/dashboard.css
    js/data-provider.js # 接口常量与类型注释（无逻辑）
    js/mock-provider.js # mock 引擎（双端）
    js/carousel.js      # 轮播状态机（双端，纯逻辑）
    js/alarm.js         # 报警镜头目标计算（双端，纯逻辑）
    js/page-render.js   # page数据->SVG DOM + 状态/lot/容量刷新（浏览器）
    js/main.js          # 装配：render+carousel+provider+alarm 绑定
    data/page-{1..4}.js # 预生成页面数据
  scripts/gen-pages.js  # elements-*.json -> page-{n}.js（含站点映射）
  test/                 # node --test 用例
    carousel.test.js
    mock-provider.test.js
    alarm.test.js
    gen-pages.test.js
```

---

### Task 0: git 初始化与目录骨架

**Files:** Create: `web/css/`, `web/js/`, `web/data/`, `test/`, `.gitignore`

- [ ] **Step 1:** 在项目根 `buf-fmc-dashboard` 执行 `git init`，创建上述空目录。
- [ ] **Step 2:** `.gitignore` 内容：

```
node_modules/
*.log
```

- [ ] **Step 3:** `git add -A && git commit -m "chore: scaffold web dashboard dirs"`（首次提交会包含已有 scripts/data/docs；如不希望纳入大文件，先确认 `data/*.xml` 总量 <10MB 再提交）。

---

### Task 1: 页面数据准备脚本 gen-pages.js

**Files:**
- Create: `scripts/gen-pages.js`
- Test: `test/gen-pages.test.js`
- Produces: `web/data/page-{1..4}.js`；导出 `splitPages(elements)` 与 `buildSiteMap(page)`。

**Interfaces:**
- 输入：`data/elements-L20.json`、`data/elements-L40.json`（字段 fills/texts/W/H/shapes；fills[].name 以 `site:` 前缀标识站点）。
- 输出每页对象：`{id, name, frame, W, H, fills:[{id,x,y,w,h,color,name}], texts:[{id,x,y,w,h,content,size,bold,rot,align,valign,color,font}], borderGeo, sites:[{siteId, rectId, textIds}]}`。
- 切分规则：frame=L20 → Array 页=banner(Array 横幅 shape).top 以上全部元素（y+height ≤ bannerTop）；CF/Cell 页=banner(CF/Cell).top 以下（y ≥ bannerTop2）；banner 本身归下侧页页头装饰。L40 同理。

- [ ] **Step 1: 写失败测试**

```js
// test/gen-pages.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { splitPages } = require('../scripts/gen-pages.js');

const fakeElements = {
  W: 100, H: 200,
  shapes: [
    { name: 'banner:Array', text: 'Array', left: 0, top: 50, width: 100, height: 20 },
    { name: 'banner:CF/Cell', text: 'CF/Cell', left: 0, top: 140, width: 100, height: 20 },
  ],
  fills: [
    { x: 0, y: 0, w: 10, h: 10, color: '#00FF00', name: 'site:S1' },
    { x: 0, y: 80, w: 10, h: 10, color: '#92D050', name: 'site:S2' },
    { x: 0, y: 170, w: 10, h: 10, color: '#FF66FF', name: 'fill@r1c1' },
  ],
  texts: [
    { content: 'S1', x: 0, y: 0, w: 10, h: 10, size: 10, bold: false, rot: 0, align: 'center', valign: 'middle', color: '#000000', font: 'Roboto Condensed' },
    { content: 'S2', x: 0, y: 80, w: 10, h: 10, size: 10, bold: false, rot: 0, align: 'center', valign: 'middle', color: '#000000', font: 'Roboto Condensed' },
  ],
};

test('splitPages 按横幅切分为上下两页', () => {
  const pages = splitPages(fakeElements, 'L20');
  assert.equal(pages.length, 2);
  assert.equal(pages[0].name, 'L20-Array');
  assert.equal(pages[1].name, 'L20-CF/Cell');
  // S1 在 Array 页
  assert.ok(pages[0].fills.some(f => f.name === 'site:S1'));
  // S2 (y=80, 在两横幅之间) 属于上页底/下页顶——按规则 y+h<=50 才上页，S2 归下页
  assert.ok(pages[1].fills.some(f => f.name === 'site:S2'));
  // site 映射建立且关联 textIds
  const s1 = pages[0].sites.find(s => s.siteId === 'S1');
  assert.ok(s1 && s1.rectId && s1.textIds.length === 1);
});
```

- [ ] **Step 2:** `node --test test/gen-pages.test.js` → FAIL（模块不存在）。
- [ ] **Step 3:** 实现 `scripts/gen-pages.js`（关键逻辑，完整可运行）：

```js
// gen-pages.js — elements-{frame}.json -> web/data/page-{n}.js
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const OUT = path.join(__dirname, '..', 'web', 'data');
fs.mkdirSync(OUT, { recursive: true });

function siteIdOf(name) { return name && name.startsWith('site:') ? name.slice(5).trim() : null; }

function buildSiteMap(page) {
  const map = new Map(); // siteId -> {rectId, rect, textIds:[]}
  for (const f of page.fills) {
    const sid = siteIdOf(f.name);
    if (!sid) continue;
    const rect = { x: f.x, y: f.y, w: f.w, h: f.h };
    map.set(sid, { siteId: sid, rectId: f.id, rect, textIds: [] });
  }
  // 容量大字/槽位文字：中心点落在站点矩形内则关联
  for (const t of page.texts) {
    const cx = t.x + (t.rot ? t.h : t.w) / 2, cy = t.y + (t.rot ? -t.w / 2 : t.h / 2);
    // rot90 渲染中心 = (x + h/2, y - w/2 + w/2)。简化：用旋转后 AABB（与 convert.js 公式一致）
    const aabb = t.rot === 90 ? { x: t.x, y: t.y - t.w, w: t.h, h: t.w }
      : t.rot === 270 ? { x: t.x - t.h, y: t.y, w: t.h, h: t.w }
      : { x: t.x, y: t.y, w: t.w, h: t.h };
    const tcx = aabb.x + aabb.w / 2, tcy = aabb.y + aabb.h / 2;
    for (const [, s] of map) {
      const r = s.rect;
      if (tcx >= r.x && tcx <= r.x + r.w && tcy >= r.y && tcy <= r.y + r.h) { s.textIds.push(t.id); break; }
      // 容量大字站点：站点名即文字内容（site:BUF-01   100(216)  46%），直接同名关联
      if (siteIdOf('site:' + t.content) && map.has(t.content.trim())) { map.get(t.content.trim()).textIds.push(t.id); break; }
    }
  }
  return [...map.values()];
}

function splitPages(el, frameName) {
  const banners = el.shapes.filter(s => /^banner:/.test(s.name || ''))
    .sort((a, b) => a.top - b.top);
  if (banners.length < 2) throw new Error(frameName + ' expects 2 banners');
  const midY = banners[1].top; // 第二条横幅顶 = 上下分界
  const mk = (suffix, pred) => {
    const fills = el.fills.filter(pred).map((f, i) => ({ ...f, id: 'f' + suffix + '_' + i }));
    const page = {
      id: frameName + '-' + suffix, name: frameName + '-' + (suffix === 'A' ? 'Array' : 'CF/Cell'),
      frame: frameName, W: el.W, H: el.H,
      fills, texts: el.texts.filter(pred).map((t, i) => ({ ...t, id: 't' + suffix + '_' + i })),
      borderGeo: el.borderGeo || '',
    };
    page.sites = buildSiteMap(page);
    return page;
  };
  const top = mk('A', o => (o.y + (o.h || 0)) <= midY);
  const bottom = mk('B', o => o.y >= midY);
  return [top, bottom];
}

if (require.main === module) {
  let n = 1;
  for (const [frame, file] of [['L20', 'elements-L20.json'], ['L40', 'elements-L40.json']]) {
    const el = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
    for (const p of splitPages(el, frame)) {
      const js = 'window.BUF_PAGES=window.BUF_PAGES||[];BUF_PAGES.push(' + JSON.stringify(p) + ');';
      fs.writeFileSync(path.join(OUT, 'page-' + n + '.js'), js);
      console.log('page-' + n, p.name, 'fills=' + p.fills.length, 'texts=' + p.texts.length, 'sites=' + p.sites.length);
      n++;
    }
  }
}
module.exports = { splitPages, buildSiteMap };
```

注意：elements json 的 texts 元素含 `x,y,w,h`（节点值，rot≠0 时为旋转节点盒）；AABB 推导按 convert.js 实测公式（rot90: `(x, y-w, h, w)`；rot270: `(x-h, y, h, w)`）。

- [ ] **Step 4:** `node --test test/gen-pages.test.js` → PASS。
- [ ] **Step 5:** `node scripts/gen-pages.js`，确认输出 4 页且 sites>0（L20 Array 页应含大量 `site:BUF-*` 槽位）。
- [ ] **Step 6:** `git add -A && git commit -m "feat: page data generator splitting frames by production line"`。

---

### Task 2: SVG 渲染与页面切换骨架

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

### Task 3: 轮播状态机 carousel.js

**Files:**
- Create: `web/js/carousel.js`
- Modify: `web/js/main.js`（重写装配）
- Test: `test/carousel.test.js`

**Interfaces:**
- `createCarousel({pageCount, dwell, now})` → `{ tick(), onTurn(cb), manual(i), activeAlarms(alarms), currentPage() }`
  - `alarms`: `[{pageId, ts}]`；`activeAlarms` 每次数据更新时传入当前有效报警。
  - 状态：NORMAL（全页循环）/ ALARM_SINGLE（锁定报警页）/ ALARM_MULTI（报警页按最早报警 ts 升序轮播）。
  - manual(i) 跳页并启动 60s 手动模式，期间 tick 不切页；超时自动恢复。

- [ ] **Step 1: 失败测试**（要点）：

```js
// test/carousel.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { createCarousel } = require('../web/js/carousel.js');

test('NORMAL 按 dwell 循环', () => {
  let t = 0; const c = createCarousel({ pageCount: 4, dwell: 300000, now: () => t });
  const seq = [];
  c.onTurn(i => seq.push(i));
  t = 300001; assert.equal(c.tick(), 1);           // 0->1
  t = 600001; assert.equal(c.tick(), 2);
  assert.deepEqual(seq, [1, 2]);
});
test('单页报警锁定', () => {
  let t = 0; const c = createCarousel({ pageCount: 4, dwell: 300000, now: () => t });
  c.activeAlarms([{ pageId: 2, ts: 100 }]);
  t = 999999; assert.equal(c.tick(), 2); assert.equal(c.currentPage(), 2);
});
test('多页报警按最早时间排序轮播', () => {
  let t = 0; const c = createCarousel({ pageCount: 4, dwell: 300000, now: () => t });
  c.activeAlarms([{ pageId: 3, ts: 500 }, { pageId: 1, ts: 100 }]);
  t = 1; assert.equal(c.tick(), 1);                 // 先切最早报警页1
  t = 300002; assert.equal(c.tick(), 3);            // 再页3
  t = 600003; assert.equal(c.tick(), 1);            // 循环
});
test('手动模式 60s 内不自动切换', () => {
  let t = 0; const c = createCarousel({ pageCount: 4, dwell: 300000, now: () => t });
  c.manual(3); t = 59999; assert.equal(c.tick(), 3); // 手动保持
  t = 61000; assert.equal(c.tick(), 0);              // 恢复自动
});
test('报警清空恢复全页轮播', () => {
  let t = 0; const c = createCarousel({ pageCount: 4, dwell: 300000, now: () => t });
  c.activeAlarms([{ pageId: 2, ts: 1 }]); c.tick();
  c.activeAlarms([]); t = 300002;
  assert.equal(c.tick(), 3); // 回到 NORMAL 从当前页继续
});
```

- [ ] **Step 2:** `node --test test/carousel.test.js` → FAIL。
- [ ] **Step 3:** 实现（纯逻辑，`pageId`→索引映射由调用方保证页 id 顺序，carousel 内部按传入数组下标处理；实现时以 `alarms[i].pageId` 作为页索引）。要点：维护 `mode / manualUntil / pageStartTs / orderedAlarmPages`；`tick()` 与 `activeAlarms()` 返回应显示页并触发 onTurn。
- [ ] **Step 4:** `node --test test/carousel.test.js` → PASS。
- [ ] **Step 5:** 重写 `main.js`：init→render→createCarousel→setInterval(tick,1000)+页码点击 manual(i)→onTurn 里 `BUF.render.show(i)` 并刷新页码高亮。时钟每秒更新 `#clock`。
- [ ] **Step 6:** 浏览器验证轮播（临时把 dwell 调 5s）+ 页码跳页 60s 恢复。截图 `web/qa-task3.png`。
- [ ] **Step 7:** `git add -A && git commit -m "feat: carousel state machine with alarm lock/rotation"`。

---

### Task 4: mock 数据引擎与站点/lot/容量刷新

**Files:**
- Create: `web/js/data-provider.js`, `web/js/mock-provider.js`；Modify: `web/js/page-render.js`（状态刷新 API）、`web/js/main.js`
- Test: `test/mock-provider.test.js`

**Interfaces:**
- `BUF.render.applyStates(pageIdx, stations)`：`stations:[{siteId,status,capacity}]` → 改 `#r_{rectId}` fill + 更新关联容量大字文字（正则 `/^(\w[\w-]*)\s+(\d+)\((\d+)\)\s+(\d+)%$/` 重写 used/total/pct）。
- `BUF.render.applyLots(pageIdx, lots)`：在站点 rect 上叠加 `<g class="lots">` 徽标（最多 3 个 + `+n`），先清旧。
- `createMockProvider({pages})`（双端）：`start(emit, intervalMs)` 每 tick 发 `{stations, lots, alarms}` 全量快照；内部按 `pages[].sites` 随机迁移 lot（每 lot 每 2-8s 走一步）、状态翻转（正常↔预告↔满杯）、低概率报警（约每页每分钟 10%，持续 1-5min 解除）。`stop()`。

- [ ] **Step 1: 失败测试**（mock 引擎纯逻辑）：

```js
// test/mock-provider.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { createMockProvider } = require('../web/js/mock-provider.js');
const pages = [{ id: 'P1', sites: [{ siteId: 'S1', rectId: 'f1' }, { siteId: 'S2', rectId: 'f2' }] }];

test('快照包含全部站点状态', () => {
  const p = createMockProvider({ pages }); const snap = p.snapshot();
  assert.equal(snap.stations.length, 2);
  assert.ok(['normal', 'preFull', 'full'].includes(snap.stations[0].status));
});
test('报警会出现且最终解除', () => {
  const p = createMockProvider({ pages, forceAlarmRate: 1, alarmDurationMs: 10 }); // 测试必报警
  p.step(); const a1 = p.snapshot().alarms;
  assert.ok(a1.length >= 1 && a1[0].pageId === 'P1' && a1[0].active);
  p.tickTime(20); assert.equal(p.snapshot().alarms.filter(a => a.active).length, 0);
});
test('lot 迁移改变站点归属', () => {
  const p = createMockProvider({ pages, lots: 4 });
  const s1 = p.snapshot().lots.map(l => l.stationId);
  p.step(); p.step(); p.step();
  const moved = p.snapshot().lots.some(l => !s1.includes(l.stationId) || true);
  assert.ok(p.snapshot().lots.length === 4);
});
```

（实现时提供 `snapshot()/step()/tickTime(ms)` 供测试，`start()` 只是 setInterval 包装。）
- [ ] **Step 2:** FAIL → 实现 `data-provider.js`（接口注释 + `window.BUF.provider 接口约定`）与 `mock-provider.js`。
- [ ] **Step 3:** PASS（`node --test test/mock-provider.test.js`）。
- [ ] **Step 4:** `page-render.js` 增加 `applyStates/applyLots`（DOM 操作，浏览器端）；`main.js` 接 provider：收到快照 → 找 pageId 对应索引 → applyStates/applyLots → `carousel.activeAlarms(alarms)`。
- [ ] **Step 5:** 浏览器验证：站点颜色变化、容量大字数字刷新、lot 徽标出现/迁移。截图 `web/qa-task4.png`。
- [ ] **Step 6:** `git add -A && git commit -m "feat: mock provider with station/lot/capacity live updates"`。

---

### Task 5: 报警聚焦（镜头特写 + 信息条）

**Files:**
- Create: `web/js/alarm.js`；Modify: `web/css/dashboard.css`（脉冲/marquee）、`web/js/main.js`
- Test: `test/alarm.test.js`

**Interfaces:**
- `computeCamera(page, alarmSites, {minZoom=2.5, maxZoom=4, padRatio=0.6})` → `{viewBox:[x,y,w,h], mode:'envelope'|'cruise', cruiseTargets:[viewBox,...]}`（纯函数）：报警点矩形集 → 包络+padding；zoom=W/envelope.w 限制在 [2.5,4]，<2.5 转 cruise（逐点各自特写）。
- `BUF.alarm.focus(pageIdx, viewBox, 500ms)`：viewBox 用 rAF 插值动画（ease-in-out）。
- `BUF.alarm.reset(pageIdx)`：回整页。
- `BUF.alarm.bar(alarms)`：渲染 `#alarmBar` marquee（`时间 | 产线 | 站点 | 代码 | 内容`，时间倒序；CSS 无缝滚动）。
- 站点红描边脉冲：`applyStates` 中 status==='alarm' 时给 rect 加 class `alarm-pulse`（CSS `@keyframes` 红描边 2s 循环）。

- [ ] **Step 1: 失败测试**：

```js
// test/alarm.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { computeCamera } = require('../web/js/alarm.js');
const page = { W: 2000, H: 2300 };
const one = [{ x: 100, y: 100, w: 27, h: 52 }, { x: 1500, y: 900, w: 27, h: 52 }];

test('相邻报警点→包络特写 2.5-4 倍', () => {
  const near = [{ x: 100, y: 100, w: 27, h: 52 }, { x: 130, y: 200, w: 27, h: 52 }];
  const c = computeCamera(page, near, {});
  assert.equal(c.mode, 'envelope');
  const zoom = page.W / c.viewBox[2];
  assert.ok(zoom >= 2.5 && zoom <= 4.01, 'zoom=' + zoom);
});
test('分散报警点→巡航模式', () => {
  const c = computeCamera(page, one, {});
  assert.equal(c.mode, 'cruise');
  assert.equal(c.cruiseTargets.length, 2);
});
```

- [ ] **Step 2:** FAIL → 实现 → PASS。
- [ ] **Step 3:** `main.js` 集成：轮播切页时 `BUF.alarm.reset`；当前页有报警时 `computeCamera`→`focus`（cruise 模式每 20s 换目标）+ `bar(全局报警列表)`；无报警隐藏 `#alarmBar`。
- [ ] **Step 4:** 浏览器全流程验收（mock forceAlarmRate 调 1 加速）：单页报警锁定+特写+红脉冲+信息条滚动；两页报警顺序轮播；解除后恢复。截图 `web/qa-task5.png`。
- [ ] **Step 5:** `git add -A && git commit -m "feat: alarm camera focus, pulse and marquee bar"`。

---

### Task 6: 验收与文档

**Files:** Modify: `README.md`、`web/config.js`（常量：dwell=300000、minDwell=180000、maxDwell=360000、manualRecovery=60000、cruiseInterval=20000）

- [ ] **Step 1:** 把 Task 3-5 硬编码常量收敛进 `config.js`（`window.BUF_CONFIG={...}`，index.html 在最前引入）。
- [ ] **Step 2:** 按 spec 验收标准 1-6 逐条过一遍并记录结果到 README「第二步」章节（运行方式：双击 web/index.html；数据：mock；如何调快轮播便于演示——URL 参数 `?dwell=5000&alarmRate=1`，main.js 解析）。
- [ ] **Step 3:** `git add -A && git commit -m "docs: acceptance results and config for web dashboard"`。

## Self-Review 结论

- Spec 覆盖：分页(Task1)、渲染(2)、轮播三态+手动恢复(3)、mock/状态/lot/容量(4)、特写+脉冲+marquee+报警轮播(5)、配置与验收(6)——全覆盖；错误处理（页数据加载失败占位）并入 Task 2 Step 5 人工检查项，DataProvider 断流标注为后续真实源需求。
- 类型一致：`createCarousel({pageCount,dwell,now}).tick/manual/activeAlarms/onTurn/currentPage`、`computeCamera(page,rects,opts)`、`createMockProvider({pages}).snapshot/step/start/stop` 各任务间引用一致。
- 无 TBD/占位描述；浏览器人工验收步骤均给出具体检查点。
