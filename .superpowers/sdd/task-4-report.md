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

## 修复（审查反馈）

- mock-provider：lots 快照补 `sinceTs`（初始生成与迁移到站时记录），data-provider.js 契约注释同步。
- test#3 改为真实迁移断言：注入固定种子随机源（opts.rand，LCG seed=42）+ tickTime(8000) 越过 nextMove 上限，断言 4 个 lot 归属 notDeepEqual 且 sinceTs 均为数字。
- 顺手修：applyLots 徽标 y 钳制 Math.max(1, r.y-11) 防页顶越界。
- 验证：node --test 全量 11 pass / 0 fail。

## 修复 2（复核 Critical：随机源注入作用域错误）

- 问题：rnd/ri 原定义在 IIFE 外层、闭包捕获外层 rand；createMockProvider 内 var rand=opts.rand 只遮蔽函数内作用域，ri()（站点挑选/nextMove）实际仍走 Math.random，测试注入失效 → 约 6% 概率假失败（review 复跑第 1 次即失败）。
- 修复（方案 1）：把 rand/rnd/ri 下沉到 createMockProvider 闭包内，删除外层副本；opts.rand 现在对所有随机调用（站点挑选、nextMove、状态翻转、报警 roll）全部生效；更正注释。
- 验证：node --test 全量 11 pass / 0 fail；连跑 40 次 node --test test/mock-provider.test.js：40 PASS / 0 FAIL。
