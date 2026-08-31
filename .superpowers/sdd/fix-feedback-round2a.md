# 修复反馈第二轮（fix-feedback-round2a）

日期：2026-08-31 · 提交：fix: carousel dwell reset bug, add zoom/pan and labeled page nav

## 修复 1：自动轮播卡死（倒计时徘徊 4:59-5:00）
- 根因确认：main.js 每 2s snapshot 调 `carousel.activeAlarms([])`，旧逻辑在空报警分支无条件 `pageStartTs = now`，dwell 被每 2s 重置，永不切页。
- 修复（web/js/carousel.js）：仅在真实模式迁移（上次为报警态 → 本次空，即 mode !== 'NORMAL' → NORMAL）时重置 dwell；连续空→空不重置。
- 新增测试（test/carousel.test.js）：
  - 连续三次 activeAlarms([]) 后 dwell 到期正常切页；
  - 报警→清空重置一次后，后续空 snapshot 不再重置（按首次清空时刻起算）。

## 修复 2：画面缩放/平移（新文件 web/js/zoom.js）
- 滚轮缩放：以鼠标点为不动点，每档 ×1.15 / ÷1.15，viewBox 宽钳制在 [basis.w/12, basis.w/0.5]（0.5×~12× 页基准，basis 优先 page.vb）。
- 左键拖拽平移：位移 >4px 才算拖（防误触）；屏幕→SVG 坐标换算按 preserveAspectRatio="xMidYMid meet" 等比留边处理。
- 双击恢复整页视图并解除用户覆盖。
- userOverride 标志：手动缩放/拖拽时置位并取消进行中的相机动画（alarm.js 新增 cancelAnim：animId++）；main.js 在 override 期间跳过报警自动聚焦/巡航取景/复位；切页（onTurn）与报警集变化（pageId:siteId:ts 签名变化）时清除。
- 页头提示："滚轮缩放 · 拖拽平移 · 双击复位"（#zoomHint，13px 暗色小字）。
- index.html 增加 `<script src="js/zoom.js">`（main.js 之前）。

## 修复 3：索引导航与状态文案
- 右下角页码指示器由圆点升级为带页名按钮组：L20-Array / L20-CF/Cell / L40-Array / L40-CF/Cell，当前页高亮，点击走 carousel.manual(i)（CSS #pager .pgBtn，bottom 78px 避开页脚）。
- 状态条模式文案加说明后缀：
  - "自动轮播 · 下一页 4:37"
  - "手动浏览（60 秒后恢复自动）"（实时倒数秒）
  - "报警锁定（本页有报警）"
  - "报警轮播 2/3（按报警时间排序）"

## 测试与自验
- node --test：17 pass / 0 fail（原 15 + 新增 2）。
- 浏览器自验（chrome-devtools，file:// + ?dwell=180000&alarmRate=0）：
  - 滚轮 6 档缩放 viewBox 宽 1396.2→603.63（≈1.15^6 ✓）；双击精确复位回原 viewBox。
  - 拖拽平移生效；zoom 期间 BUF.zoom.userOverride()=true。
  - 页按钮点击直达 L40-Array（page 2），override 被清除，状态条进入"手动浏览（55 秒后恢复自动）"并逐秒倒数。
  - 手动到期后自动切页（2→3），随后 NORMAL 倒计时 2:43→2:10→1:41→1:13 持续递减不被 2s snapshot 重置，走完 3 分钟到期后 3→0 环绕切页（修复 1 端到端验证）。
  - 截图：web/qa-fix2a.png（6× 放大 BUF-01C01 区域，11pt 标签放大后可读）。
