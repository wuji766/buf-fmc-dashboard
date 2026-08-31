const { test } = require('node:test');
const assert = require('node:assert');
const { computeCamera, sameViewBox } = require('../web/js/alarm.js');
const page = { W: 2000, H: 2300, vb: [40, 30, 1200, 1000] }; // 紧凑包围盒基准
const pageNoVB = { W: 2000, H: 2300 }; // 缺省回退整页
const one = [{ x: 100, y: 100, w: 27, h: 52 }, { x: 1500, y: 900, w: 27, h: 52 }];

test('相邻报警点→包络特写 2.5-4 倍', () => {
  const near = [{ x: 100, y: 100, w: 27, h: 52 }, { x: 130, y: 200, w: 27, h: 52 }];
  const c = computeCamera(page, near, {});
  assert.equal(c.mode, 'envelope');
  const zoom = page.vb[2] / c.viewBox[2]; // 基准 = 紧凑包围盒宽
  assert.ok(zoom >= 2.5 && zoom <= 4.01, 'zoom=' + zoom);
});
test('缺省 page.vb 回退整页基准', () => {
  const near = [{ x: 900, y: 1000, w: 27, h: 52 }, { x: 930, y: 1100, w: 27, h: 52 }];
  const c = computeCamera(pageNoVB, near, {});
  assert.equal(c.mode, 'envelope');
  const zoom = pageNoVB.W / c.viewBox[2];
  assert.ok(zoom >= 2.5 && zoom <= 4.01, 'zoom=' + zoom);
  assert.ok(c.viewBox[0] >= 0 && c.viewBox[1] >= 0); // 钳制在整页内
});
test('分散报警点→巡航模式', () => {
  const c = computeCamera(page, one, {});
  assert.equal(c.mode, 'cruise');
  assert.equal(c.cruiseTargets.length, 2);
});

test('sameViewBox：envelope 变化检测（报警点增减/移动触发重新取景）', () => {
  // 页中部相邻两点（不触发边界钳制，取景随包络中心变化）
  const near = [{ x: 900, y: 1000, w: 27, h: 52 }, { x: 930, y: 1100, w: 27, h: 52 }];
  const a = computeCamera(page, near, {}).viewBox;
  assert.equal(computeCamera(page, near, {}).mode, 'envelope');
  // 同一集合再算一次 → 同一取景，不应重新 focus
  assert.ok(sameViewBox(a, computeCamera(page, near.slice(), {}).viewBox));
  // 新增报警点 → 包络中心移动 → 不同取景
  const grown = near.concat([{ x: 1400, y: 1600, w: 27, h: 52 }]);
  assert.ok(!sameViewBox(a, computeCamera(page, grown, {}).viewBox));
  // 容差 ≤1 单位视为相同
  const b = a.slice(); b[0] += 0.5; b[3] -= 0.5;
  assert.ok(sameViewBox(a, b));
  assert.ok(!sameViewBox(a, null));
  assert.ok(!sameViewBox(null, a));
});
