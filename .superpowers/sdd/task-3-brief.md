
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

