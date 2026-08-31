# 第五轮反馈修复：模式菜单入口页 + 报警信息条滚动与内容同步（2026-08-31）

## 需求 1：索引/菜单页
- 新建 `web/menu.html`：标题"BUF FMC 监控大屏"，深色卡片式网格列出 4 种模式，点击同窗打开：
  1. 正常监控模式 → `index.html`（默认 5 分钟轮播 + mock）
  2. 报警演示模式 → `index.html?alarmRate=1`
  3. 快速轮播模式 → `index.html?dwell=180000&alarmRate=1`（3 分钟轮播）
  4. 质检模式（QA）→ `index.html?qa=1`，卡片带"开发用"黄色标签
  - 每张卡片显示模式名、说明、对应 URL；样式沿用 dashboard.css 深色体系（本地 `<style>`，含 hover 抬升效果）。
- `web/index.html` 页头 `#hud` 右侧新增 `#menuLink`（"菜单"，`href="menu.html"` 同窗跳转），样式在 dashboard.css。
- README「第二步·运行方式」改为"打开 `web/menu.html` 选择模式"（保留直开 index.html 说明）。

## 需求 2：报警信息条滚动与内容一一对应
- 问题：原实现为 CSS keyframes `alarm-marquee`（两份 `.alarm-run` + `translateX(-100%)` 无限动画），报警列表变化时旧动画进度套新内容 → 接缝错位/半截字跳变/内容不足一份时行为怪。
- 修法（`web/js/alarm.js` + `web/css/dashboard.css`）：
  - 改为 **rAF 驱动**：单一滚动轨道 `.alarm-run` 内放两份 `.alarm-copy`（第二份 `aria-hidden`），不再用 CSS animation/keyframes（已删除）。
  - 循环长度 = **第一份 `.alarm-copy` 的实测 `offsetWidth`**（若首帧未布局完成则下一帧重测）。
  - 相位以固定速度 80px/s（`NS_SPEED` 常量）递减，`phase >= loopW` 时对单份宽度取模 → 无缝循环。
  - 报警列表每次变化：`bar()` 重建 DOM → 重新测量宽度 → 相位归零从头滚动（简单可靠）；无报警时 `cancelAnimationFrame` 停止并隐藏。

## 验收观察记录（实测：CDP 驱动 headless Chrome，见 scripts/qa-fix5-cdp.js）
- 环境：`index.html?alarmRate=1`（本地静态服务 8931），观察总时长约 50s，每 2-3s 采样。
- 信息条出现后全程：两份 `.alarm-copy` innerHTML 严格一致（sameContent=true 全程）。
- 滚动相位（translateX）采样 21 次：单调向左推进（0 → -140px 段内），且 |phase| 始终 ≤ 当前实测单份宽度（phaseBoundedByCopyW=true，copyW 随条目数从 2090px 增至 20061px）。
- 报警列表变化观察：条目 8 → 80 → 68 → 76（自动解除 + 新增交替触发重建 10+ 次），每次重建后相位从 0 附近重新开始（实测捕获 `translateX(0px)` 重置帧），无空段、无双份不同步、无半截字残留。
- 单条超宽：copyW=2090px（单条）时段滚动正常。
- 无报警：初始 `cls="hidden"`、transform=null（rAF 未启动）。
- 截图：`web/qa-fix5-menu.png`（菜单页 4 卡片）、`web/qa-fix5-bar.png` / `qa-fix5-bar2.png`（滚动中 / 列表变化后）。
- 菜单入口检查：menu.html 渲染 4 张 `.menu-card`；index.html 页头存在 `#menuLink → menu.html`。

## 测试
- `node --test`：19/19 pass（改动未触碰纯函数导出，computeCamera/sameViewBox 未变）。

## 备注
- 本轮浏览器实测走 CDP（子代理内 Browser Use/chrome-devtools MCP 不可用）；`--virtual-time-budget` 截图方案被持续 rAF 卡死，故改用真实时间采样。
