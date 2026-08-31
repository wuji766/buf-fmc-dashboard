// test/gen-pages.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { splitPages, buildSiteMap } = require('../scripts/gen-pages.js');

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
