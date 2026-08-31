
**Files:** Modify: `README.md`、`web/config.js`（常量：dwell=300000、minDwell=180000、maxDwell=360000、manualRecovery=60000、cruiseInterval=20000）

- [ ] **Step 1:** 把 Task 3-5 硬编码常量收敛进 `config.js`（`window.BUF_CONFIG={...}`，index.html 在最前引入）。
- [ ] **Step 2:** 按 spec 验收标准 1-6 逐条过一遍并记录结果到 README「第二步」章节（运行方式：双击 web/index.html；数据：mock；如何调快轮播便于演示——URL 参数 `?dwell=5000&alarmRate=1`，main.js 解析）。
- [ ] **Step 3:** `git add -A && git commit -m "docs: acceptance results and config for web dashboard"`。

## Self-Review 结论

- Spec 覆盖：分页(Task1)、渲染(2)、轮播三态+手动恢复(3)、mock/状态/lot/容量(4)、特写+脉冲+marquee+报警轮播(5)、配置与验收(6)——全覆盖；错误处理（页数据加载失败占位）并入 Task 2 Step 5 人工检查项，DataProvider 断流标注为后续真实源需求。
- 类型一致：`createCarousel({pageCount,dwell,now}).tick/manual/activeAlarms/onTurn/currentPage`、`computeCamera(page,rects,opts)`、`createMockProvider({pages}).snapshot/step/start/stop` 各任务间引用一致。
- 无 TBD/占位描述；浏览器人工验收步骤均给出具体检查点。
