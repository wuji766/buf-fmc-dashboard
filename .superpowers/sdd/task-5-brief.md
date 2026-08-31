
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

