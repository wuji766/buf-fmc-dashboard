# 用户反馈修复 第 1 轮

提交：`fix: crop page viewBox to content, add live status summary and legend`

## 修复 1（最重要）：页面内容紧凑裁剪，铺满屏幕

- `scripts/gen-pages.js`：新增 `contentVB(page, pad=10)` —— 由该页 fills + texts 的旋转 AABB（rot90=(x,y-w,h,w)、rot270=(x-h,y,h,w)、rot0=(x,y,w,h)）并集加 padding 10 并钳到画布内，写入 `page.vb`；已重新生成 `web/data/page-1..4.js`。
  - 例：L20-Array 整页 1991×2343 → vb [239, 15.9, 1396.2, 1148.2]（面积仅为整页 34%→有效放大 ~2 倍）。
- `web/js/page-render.js` `show(i)`：viewBox 改用 `page.vb`（缺省回退 `[0,0,W,H]`）。
- `web/js/alarm.js`：新增 `pageBasis(page)`（优先 `page.vb`，回退整页）；`reset()` 回 vb；`computeCamera` 的缩放上限/包络判断/`boxAround` 钳制全部以 vb 为基准（函数签名不变）。
- `web/js/main.js`：无需改动（切页路径经 `BUF.render.show` 已对齐）。
- 测试：`test/alarm.test.js` 夹具加 `vb` 并新增"缺省 page.vb 回退整页基准"用例；`test/gen-pages.test.js` 增加 vb 存在/紧凑/不越界断言。

## 修复 2：正常轮播时的实时说明

- `web/index.html`：页头下新增 `#statusBar`（`#lotSummary` + `#carouselState`）。
- `web/js/main.js`：每次 snapshot 更新摘要 —— 在厂 Lot 总数、正常/满杯预告/满杯警告/报警站点数、活跃报警数；每秒心跳更新轮播状态行 —— "自动轮播 · 下一页 mm:ss"（dwell − 当前页已展示时长，±1s）、手动模式显示"手动浏览"、单报警页"报警锁定"、多报警页"报警轮播 x/y"。
- `web/js/carousel.js`：暴露 `mode()/pageStartTs()/manualUntil()/alarmPageCount()/alarmIdx()` 查询接口（纯新增，不影响状态机逻辑与既有测试）。

## 修复 3：图例

- `web/index.html`：页脚新增常驻 `#legend`（位于报警条上方，无报警时贴底）：#00FF00 正常 / #92D050 满杯预告 / #FF66FF 满杯警告 / 红描边闪烁样例 报警 / 黑底白字小徽标样例 "12" Lot 在站。
- `web/css/dashboard.css`：图例样式 + `legend-blink` 红描边闪烁动画（与站点 `alarm-pulse` 同节奏）+ lot 徽标样式。

## 测试

`node --test`：**15 pass / 0 fail**（原 14 + 新增 1：缺省 vb 回退）。

## 浏览器验证（chrome-devtools，file:// 加载）

- 截图：`web/qa-fix1.png`（1600×900）。
- 内容铺满：紧凑 vb 使内容纵向占屏 ~85-90%、横向 ~65-70%（页面内容本身为竖长比例，xMidYMid meet 下左右留黑属正常；文字线性放大 ~2 倍，站点编号/容量数字清晰可读）。
- 状态条实测：`在厂 Lot 8 · 正常 87 / 预告 95 / 满杯 88 / 报警 0 · 活跃报警 0`，`自动轮播 · 下一页 5:00`；出现报警时切为"报警锁定"且报警条滚动正常。
- 图例五个条目齐全，红描边闪烁与徽标样例渲染正确。
