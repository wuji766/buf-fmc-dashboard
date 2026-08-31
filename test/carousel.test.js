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
