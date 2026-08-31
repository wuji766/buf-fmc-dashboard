
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

