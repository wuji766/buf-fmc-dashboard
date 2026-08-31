# Task 3 报告：轮播状态机 + main.js 装配

## 交付物
- `web/js/carousel.js`（新增）：`createCarousel({pageCount, dwell, now})` → `{tick, onTurn, manual, activeAlarms, currentPage}`。浏览器/Node 双端（IIFE 挂 `window.BUF.carousel`，尾部 CommonJS 导出）。
- `web/js/main.js`（重写）：render.init → createCarousel(dwell=300000) → 1s setInterval tick（tick 返回页 ≠ 当前页时 show）→ 页码点击 `carousel.manual(i)` 并立即 show → onTurn 回调 show + 页码高亮 → 时钟每秒更新 `#clock`（YYYY-MM-DD HH:mm:ss）。
- `test/carousel.test.js`：brief 中 5 个用例，全部通过。
- `web/index.html`：加入 `js/carousel.js` script 标签。
- 顺手修复 `web/js/page-render.js`：`show()` 淡入由单次 rAF 改为双重 rAF。

## 状态机语义
- NORMAL：dwell 到期 → 下一页环绕。
- ALARM_SINGLE：`activeAlarms` 单条报警 → 立即锁定该页（pageId 即页索引）。
- ALARM_MULTI：报警页按 ts 升序轮播；`activeAlarms` 时立即跳到最早报警页，dwell 到期切换到下一个报警页（环绕）。
- 手动模式：`manual(i)` 后 60s（60000ms）内 tick 保持当前页；超时后首个 tick 立即恢复自动切换（实现 brief 测试用例"61000 → 切到 0"的语义）。
- 报警清空 → 恢复 NORMAL，从当前页继续计 dwell。

## 测试
- `node --test "test/*.test.js"`：pass 7 / fail 0（含既有 gen-pages 用例）。
- 浏览器验证（chrome-devtools，file://，临时 dwell=5000）：
  - 自动换页：约 5s 后 cur 0→1，页码高亮同步。
  - 手动跳页：点击第 4 个页码 → 立即显示 L40-CF/Cell；7s 后仍停在该页（手动模式压制自动切换）；60s 恢复语义由单元测试覆盖。
  - 时钟正常更新（YYYY-MM-DD HH:mm:ss 格式）。
  - 截图：`web/qa-task3.png`；验证后已恢复 dwell=300000。

## 备注 / 偏差
- `activeAlarms` 的 `pageId` 按数字页索引处理（按补充决定，无需 id→索引映射）；main.js 后续接入真实报警数据时由调用方保证该约定。
- 过程中 PowerShell 改写导致 index.html / main.js 中文编码一度损坏，已用 UTF-8 重写恢复（提交内容已确认无乱码）。

## 提交
- `feat: carousel state machine with alarm lock/rotation`

## 审查修复（Important）：dwell 缺省值
- 问题：`carousel.js` 中 `var dwell = opts.dwell;` 无默认值，不传 dwell 时 `t - pageStartTs < dwell` 恒为 false，每个 tick 都切页，违反绑定约束。
- 修复：改为 `var dwell = opts.dwell != null ? opts.dwell : 300000;`（缺省 5 分钟）。
- 补充用例 `不传 dwell 时缺省 300000`：t=299999 时 tick 返回 0（不切页）；t=300001 时 tick 返回 1（切页）。
- 测试输出（`node --test test/carousel.test.js`）：

```
✔ NORMAL 按 dwell 循环 (2.903ms)
✔ 单页报警锁定 (0.3847ms)
✔ 多页报警按最早时间排序轮播 (0.2528ms)
✔ 手动模式 60s 内不自动切换 (0.2602ms)
✔ 报警清空恢复全页轮播 (0.2139ms)
✔ 不传 dwell 时缺省 300000 (0.3268ms)
ℹ tests 6  ℹ pass 6  ℹ fail 0
```

- 提交：`fix: default dwell 300000 in carousel`
