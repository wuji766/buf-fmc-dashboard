
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

