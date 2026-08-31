# Apple Design UI 打磨报告（buf-fmc-dashboard）

提交：`ac986a4a59432b94dcc3c75c926d9d429edaef4b` — feat: apple-design UI polish (springs, gestures, materials, typography, a11y)
日期：2026-08-31 · 技能：`.zcode/skills/apple-design/SKILL.md`（章节号下同）

## 测试基线与结果

- 接手基线：`node --test` = 19 pass / 1 fail（仅因 `web/js/motion.js` 未实现，TDD 红阶段）。
- motion.js 实现后：`node --test test/motion.test.js` = 8 pass（①–⑧ 全绿，任务书称 7 组，实际文件含 8 个用例）。
- 最终全量：`node --test` = **27 pass / 0 fail**（19 + 8）。

## 清单逐项（对应技能章节）

| # | 项 | 状态 | 章节 / 说明 |
|---|----|------|-------------|
| 1 | `web/js/motion.js` spring 动画器 | 完成 | §3/§4/§5/§6/§9。drift-kick 半隐式欧拉（改向首帧 = 当前值+v·dt，满足 test ② 连续性）；>17.5ms 帧自动子步（修大 dt 显式阻尼失稳，见下文坑 1）；标量/数组逐分量独立 spring；settle 吸附 + onSettle 恰好一次；cancel 后不再回调；`project()`(§6 公式) / `rubberband()`(§9 公式)；manualDriver 虚拟时钟 + rafDriver 生产时钟（dt 钳 64ms）；`window.BUF.motion` + `module.exports` 双端。reduced-motion 时 spring 首帧吸附（§14） |
| 2 | `web/js/zoom.js` 重做 | 完成 | §1/§2/§3/§5/§6/§9。Pointer Events + setPointerCapture + 1:1 跟踪（grab offset 经屏幕→SVG 换算天然保持）；最近 ≤100ms 移动历史测速；大速度（>50 u/s）释放 → `project()` 落点 clamp → spring 携释放速度接管（四分量独立，速度 [vx,vy,0,0]）；拖拽越界 rubber-band 软边界、低速松手弹回；滚轮 ×1.1^sign 目标累乘、指针锚点、damping 1.0/response 0.25、retarget 续接不截断；双击 damping 1.0/response 0.4 复位并解除覆盖；任何输入打断报警相机从当前值继续；保留 `userOverride()/clearUserOverride()/onPageChange()` 兼容 main.js |
| 3 | alarm/page-render/main 动效统一 | 完成 | alarm.js focus/reset 的 ease-in-out 固定时长插值 → motion spring（damping 1.0/response 0.4，`cancelAnim()` 取消 spring 句柄），可被缩放/拖拽打断；page-render.js 切页在 opacity 过渡上加 6px y 位移（进入自下而上 +6px→0，与 opacity 同曲线，§7）；main.js 零改动（接口兼容） |
| 4 | 材质与深度 dashboard.css | 完成 | §12。页头/状态条/图例条/页码组/报警条统一 `rgba(18,24,34,0.62)` + `backdrop-filter: blur(20px) saturate(160%)` + 顶部 1px `rgba(255,255,255,0.08)` 亮边；权重编码层级：页头 blur(28px) + 深阴影，页码控件 blur(12px) + 更浅底色；报警条与图例同在 flex 流内不叠层，红色语义移到描边/文字层；报警条出现/消失 = 高度 0↔40px + 透明度 materialize 动画（弃 display:none）；alarm-pulse 保留 |
| 5 | 即时反馈 | 完成 | §1/§10。`#menuLink` / `.pgBtn` / `.menu-card` :active 即时 `scale(0.97)` 100ms ease-out；hover `will-change: transform`；菜单卡片 hover 上浮 2px + 阴影加深；加载 stagger 上浮淡入（60ms 递增延迟） |
| 6 | 排印 | 完成 | §15。`#pageName` / `.menu-title`：`letter-spacing:-0.02em` + 紧 leading（1.1/1.05）；状态条/时钟 `tabular-nums`；body 系统字体栈兜底（Noto Sans SC 在前） |
| 7 | 可访问性 | 完成 | §14。`prefers-reduced-motion`：切页/报警条 → ≤200ms opacity，alarm-pulse → 静态红框，菜单 stagger/位移/按压缩放全关，motion.js spring 首帧吸附；`prefers-reduced-transparency`：材质变实底 `#121a26` 去 blur；`prefers-contrast:more`：控件 2px `#9fdcff` 对比边框 |
| 8 | 回归与验收 | 完成 | node --test 27/27；CDP headless Chrome 自验 29/29（见下） |

## 浏览器自验（scripts/qa-apple-cdp.js，CDP 直驱 headless Chrome，file://）

29/29 PASS：材质计算样式（hud/statusBar/legend/alarmBar 的 rgba+blur）、负 tracking、tabular-nums、滚轮 spring 渐进+精确 settle（×1.1 / 连续两档 ×1.331 retarget 累乘）、拖拽 1:1（期望 -165.67 实测 -165.68）、userOverride、惯性（速度 2519 u/s 超阈值→投影分支→松手同向续滑→settle 边界内）、报警相机 focus spring 渐进+精确吸附、双击复位页基准、切页 translateY(6px)→0、报警条隐藏态高度 0、materialize 收/展（getAnimations 证明 height+opacity 350ms 过渡运行，采到 21px/26px/29px 中间帧）、marquee 双份一致、alarm-pulse、拖拽打断报警相机、菜单 stagger（0ms/180ms 延迟）、菜单标题负 tracking。
截图：`web/qa-apple-hud.png` / `qa-apple-alarm.png` / `qa-apple-menu.png`。

## 踩坑记录（供后续维护）

1. **半隐式欧拉积分方向选错会挂两处**：kick-drift（先速度）在 test ② 改向首帧连续性上超标；drift-kick（先位置）在 dt≥64ms 时显式阻尼项失稳（|λ₂|>1 发散，实测 viewBox 爆到 1e17）。解：drift-kick + 单步上限 17.5ms 子步（60fps 测试帧保持单步，test ② 仍精确）。
2. **滚轮 handler 不能调"取消所有动画"**：连续缩放的第二档会把第一档的 spring 当"相机动画"杀掉并清空 goal，退化为从滞后展示值重起（目标累计错误）。解：拆 `cancelAlarmCamera()`（滚轮用）与 `interruptCamera()`（按下/双击/切页用）。
3. **合成事件时钟**：CDP `Input.dispatchMouseEvent` 的 `e.timeStamp` 与 `Date.now()` 时钟域混用导致 dt<0（速度恒 0）→ 统一 `performance.now()`；本 headless 环境 performance.now() 按 ~300ms 量化冻结 + setTimeout 节流，惯性时序测试改为页内 stub `performance.now()` 注入确定性假时钟（驱真实处理器代码），其余探针一律 Node 侧 pacing + getAnimations 判定。

## 未自验项（如实列出）

- **触屏（touch/pointerType=touch）拖拽**：仅验证了鼠标指针路径；触屏走了 `touchAction:none` + Pointer Events 同一代码路径，但无真机/仿真验证。
- **reduced-motion / reduced-transparency / prefers-contrast 三个媒体查询**：CSS 规则已写入，未用 CDP `Emulation.setEmulatedMedia` 逐项渲染核验（motion.js 的 reduced-motion 首帧吸附逻辑亦只经代码审查）。
- **切页"原路返回"的退出半程**：架构上旧页在切页时立即 display:none（单 SVG viewBox 同时切换，旧页双显会跳变），故 6px 位移只在进入半程可见；退出方向对称性无可见载体，§7 以"进入自下而上、同曲线镜像"落实。
- **报警条端到端（非合成）materialize 中间帧**：报警恰在首帧样式计算前到达时首次出现无过渡（真实使用后续出现/消失均有过渡）；动画本身已用确定性合成探针核验。
- **真机 60fps 手感**（弹簧参数的主观"跟手"度）需人工体验确认。
