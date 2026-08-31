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
