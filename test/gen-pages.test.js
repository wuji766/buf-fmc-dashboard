// test/gen-pages.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { splitPages, buildSiteMap, splitBorderGeo, parseGeo } = require('../scripts/gen-pages.js');

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
  // S2 (y=80, 在两横幅之间) —— 分界线是 CF/Cell 横幅顶(140)，S2 属于 Array 页
  // （若归下页，真实数据中 Array 页 sites 将为 0：fills 从 y=25.9 起，Array 横幅顶仅 25.7）
  assert.ok(pages[0].fills.some(f => f.name === 'site:S2'));
  const s2 = pages[0].sites.find(s => s.siteId === 'S2');
  assert.ok(s2 && s2.rectId && s2.textIds.length === 1);
  // 下页含 CF/Cell 横幅以下区域
  assert.ok(pages[1].fills.some(f => f.name === 'fill@r1c1'));
  // site 映射建立且关联 textIds
  const s1 = pages[0].sites.find(s => s.siteId === 'S1');
  assert.ok(s1 && s1.rectId && s1.textIds.length === 1);
  // 每页带紧凑包围盒 vb，且明显小于整页
  for (const p of pages) {
    assert.ok(Array.isArray(p.vb) && p.vb.length === 4 && p.vb[2] > 0 && p.vb[3] > 0, p.name + ' vb missing');
    assert.ok(p.vb[2] <= p.W && p.vb[3] <= p.H, p.name + ' vb exceeds canvas');
    assert.ok(p.vb[2] * p.vb[3] < p.W * p.H, p.name + ' vb not compact');
  }
});

test('真实数据切分：4 页且每页 sites>0', () => {
  const fs = require('fs'), path = require('path');
  const pages = [];
  for (const file of ['elements-L20.json', 'elements-L40.json']) {
    const el = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'));
    pages.push(...splitPages(el, file.includes('L20') ? 'L20' : 'L40'));
  }
  assert.equal(pages.length, 4);
  for (const p of pages) assert.ok(p.sites.length > 0, p.name + ' sites=0');
  assert.equal(pages[0].name, 'L20-Array');
  assert.equal(pages[1].name, 'L20-CF/Cell');
  assert.equal(pages[2].name, 'L40-Array');
  assert.equal(pages[3].name, 'L40-CF/Cell');
  // L20-Array 应为 sites 最多的页
  assert.ok(pages[0].sites.length >= pages[1].sites.length);
});

test('splitBorderGeo：跨 midY 垂直段被裁分为两段分属两页', () => {
  const geo = 'M10 5L10 5'; // 非法短串（长度0的水平段）也应可解析
  const midY = 100;
  const g = 'M50 20L50 180'      // 垂直段跨越 midY → 裁分
    + 'M50 30L90 30'             // 水平段 y<midY → 上页
    + 'M20 150L80 150'           // 水平段 y>midY → 下页
    + 'M70 120L70 160';          // 垂直段整体在下区 → 下页
  const [top, bot] = splitBorderGeo(g, midY);
  const tSegs = parseGeo(top), bSegs = parseGeo(bot);
  // 上页：垂直段被裁到 [20,100] + 水平段（顺序无关比较）
  assert.deepEqual(tSegs.map(s => s.join(',')).sort(), ['50,20,50,100', '50,30,90,30'].sort());
  // 下页：垂直段 [100,180] + 下区水平段 + 整段在下的垂直段
  assert.deepEqual(bSegs.map(s => s.join(',')).sort(), ['50,100,50,180', '20,150,80,150', '70,120,70,160'].sort());
  // 恰在 midY 上的水平段归上页（与 fills pred 一致）
  const [t2, b2] = splitBorderGeo('M0 100L10 100', midY);
  assert.equal(parseGeo(t2).length, 1);
  assert.equal(parseGeo(b2).length, 0);
  // 整段在 midY 以上的垂直段归上页
  const [t3] = splitBorderGeo('M3 40L3 99', midY);
  assert.equal(parseGeo(t3).length, 1);
});

test('真实数据切分：每页 borderGeo 非空且线段不跨页越界', () => {
  const fs = require('fs'), path = require('path');
  for (const file of ['elements-L20.json', 'elements-L40.json']) {
    const el = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'));
    const frame = file.includes('L20') ? 'L20' : 'L40';
    const pages = splitPages(el, frame);
    for (const p of pages) {
      assert.ok(p.borderGeo && p.borderGeo.length > 10, p.name + ' borderGeo empty');
      // midY = 两横幅分界；上页线段不得伸入 midY 以下、下页不得伸到 midY 之上
      const midY = el.shapes.filter(s => (s.text || '') === 'Array' || (s.text || '') === 'CF/Cell').sort((a, b) => a.top - b.top)[1].top;
      for (const [x0, y0, x1, y1] of parseGeo(p.borderGeo)) {
        const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
        if (p.name.endsWith('Array')) assert.ok(yb <= midY + 0.01, p.name + ' segment crosses midY');
        else assert.ok(ya >= midY - 0.01, p.name + ' segment crosses midY');
      }
    }
  }
});
