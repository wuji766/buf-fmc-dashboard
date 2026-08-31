# Task 5 报告 —— 报警相机聚焦 / 红描边脉冲 / 滚动信息条

## 状态：完成 ✅  提交：63c42b0（初版）；审查修复见文末

## 交付物
- 新增 `web/js/alarm.js`（双端：`window.BUF.alarm = {computeCamera, sameViewBox, focus, reset, bar}`，`module.exports = {computeCamera, sameViewBox}`）
- 修改 `web/css/dashboard.css`（`.alarm-pulse` 红描边 2s 循环脉冲；`#alarmBar` marquee：内容复制两份 + `translateX(-100%)` 无缝循环，时长按内容宽自适应 ~80px/s）
- 修改 `web/js/main.js`（snapshot 回调集成相机状态机）与 `web/index.html`（引入 alarm.js）
- 新增 `test/alarm.test.js`（brief 给定 2 用例 + sameViewBox 1 用例）

## computeCamera（纯函数）
- 包络：报警矩形并集 + `padRatio × max(ew,eh)` padding，按页面宽高比等比取 `vw = max(needW, needH × W/H)`。
- `zoom = W/vw`：≥ minZoom(2.5) → envelope 特写（zoom 钳上限 maxZoom=4）；< 2.5 → cruise 模式（每点独立 maxZoom 特写，viewBox 钳页内）。
- 结果 viewBox 均居中包络/站点并钳制到页面边界。

## main.js 集成
- snapshot 回调：`BUF.alarm.bar(全局 active 报警，含页名)`；当前页有报警站点（status==='alarm' + site.rect）→ computeCamera → envelope 直接 focus，cruise 启 20s interval 轮换 cruiseTargets；无报警 → reset + focused 标记防每 2s 重复动画。
- onTurn 切页：stopCruise + reset，等下一 snapshot 重新聚焦（与 render.show 的整页 viewBox 重置协调）。

## 测试
- `node --test`（4 个测试文件全量）：14 tests / 14 pass / 0 fail。

## 浏览器验收（chrome-devtools，file://，临时 URL 参数 forceAlarmRate=0.5 & alarmDurationMs=60000，验后已移除）
- 报警触发后 viewBox 从 `0 0 1991 2343` 聚焦至 `1128 322 497.76 585.83`（zoom=4），`#alarmBar` 显示时间倒序列表并滚动，`.alarm-pulse` 红描边脉冲生效，控制台无报错。
- `bar([])` → alarmBar 加 hidden；`reset(0)` → viewBox 动画回 `0 0 1991.05 2343.3`。
- 截图：`web/qa-task5.png`。

## 审查修复（envelope 变化检测）
- 问题：envelope 分支缺少变化检测，同一页新增/移动报警点不会重新取景（cruise 有 cruiseSig，envelope 没有）。
- `alarm.js` 新增纯函数 `sameViewBox(a, b, tol=1)`：viewBox 四元组逐分量容差比对，双端导出。
- `main.js` envelope 分支：目标 viewBox 与 `lastEnvVB` 比对，报警点增减/移动导致取景变化时重新 focus；复位/切页时清空 `lastEnvVB`。
- `test/alarm.test.js` 新增用例：同集合同取景、扩集合（页中部，不触发边界钳制）不同取景、容差 ≤1 视为相同、null 安全。全量 14/14 通过。
- 修复提交：`fix: re-frame envelope camera when alarm set changes`。

## 疑虑
- 页数据里个别 siteId 本身含容量文本（如 "BUF-06 60(86) 69%"），报警条显示略显冗长，属上游数据命名问题，未处理。
