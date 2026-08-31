# Task 4 报告：mock 数据引擎 + 站点/lot/容量实时刷新

提交：`93f8e96` feat: mock provider with station/lot/capacity live updates

## 交付物
- 新增 `web/js/mock-provider.js`（双端）：`BUF.mock.createMockProvider` / `module.exports={createMockProvider}`。
  - 可测试接口：`snapshot()` / `step()` / `tickTime(ms)`；运行接口：`start(emit, intervalMs)` / `stop()`。
  - 站点状态（normal/preFull/full 邻位翻转 + 容量漂移）、lot 每 2-8s 随机迁移、
    低概率报警（缺省 0.0033/tick/页 ≈ 每页每分钟 10%，持续 1-5min；可用 `forceAlarmRate` / `alarmDurationMs` 覆盖）。
  - `pageId` 为页 id 字符串（与 `BUF_PAGES[i].id` 对齐，测试断言 `a.pageId==='P1'` 据此实现）。
  - 站点有 active 报警时 snapshot 中 status 报为 `'alarm'`。
- 新增 `web/js/data-provider.js`：纯接口约定注释（window.BUF.provider 契约：start/stop/subscribe、快照形状 stations/lots/alarms）。
- `web/js/page-render.js` 新增：
  - `applyStates(pageIdx, stations)`：status→fill（normal #00FF00 / preFull #92D050 / full #FF66FF；alarm 保留 `data-orig-fill` 原 fill 并加 `alarm-pulse` class——CSS 脉冲样式留待 Task 5）；
    容量大字按正序 `/^(\S+)(\s+)(\d+)(\()(\d+)(\)\s+)(\d+)(%)$/` 与倒序变体重写 used/total/pct，保留原分隔空白。
  - `applyLots(pageIdx, lots)`：每页 `<g class="lots-layer">` 覆盖层（清空重建），站点 rect 右上方黑底白字小徽标（font-size 8），最多 3 个 + `+n`。
- `web/js/main.js` 重构：
  - provider.start(interval 2000)：快照按 pageId 分组 → 各页 applyStates/applyLots；
    active alarms 经 idToIdx 映射为数字页索引后喂 `carousel.activeAlarms`。
  - 顺手统一切页单一路径：tick/manual/activeAlarms 的切页全部经 carousel `onTurn` → show（原先 setInterval 里 tick 与 onTurn 双路径已消除）。
- `web/index.html`：追加 `data-provider.js`、`mock-provider.js` 脚本标签（普通 script，file:// 可用）。

## 测试
- `node --test test/mock-provider.test.js`：3/3 pass（先红后绿）。
- 回归：`test/carousel.test.js`、`test/gen-pages.test.js` 同跑，共 11 pass / 0 fail。
- 浏览器（chrome-devtools MCP，file://，临时 forceAlarmRate=0.5、alarmDurationMs=20s，验证后已恢复默认）：
  - 报警：`.alarm-pulse` rect 6 个，fill 保留原值（data-orig-fill 生效）；
  - lot：`lots-layer` 8 个徽标（rect+text 各 8）；
  - 容量：`BUF-01 162(188) 86% → 159(188) 85%`，数字实时刷新；
  - 控制台无报错；截图 `web/qa-task4.png`。

## 备注/疑虑
- brief 的报警测试断言 `pageId === 'P1'`（页 id 字符串），而补充决定描述 pageId 为数字页索引；实现以 brief 测试为准（字符串 id），main.js 装配处做 id→索引映射喂 carousel，两端自洽。
- brief 第三条测试 `moved` 变量断言为恒真（`|| true`），按原文照用，实际由 lot 数量恒为 4 断言兜底。
