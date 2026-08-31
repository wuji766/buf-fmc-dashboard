# Task 6 报告：配置收敛 + 浏览器验收（2026-08-31）

## 改动
- 新增 `web/config.js`：`window.BUF_CONFIG = { dwell:300000, minDwell:180000, maxDwell:360000, manualRecovery:60000, cruiseInterval:20000 }`；`index.html` 在所有脚本前引入。
- `web/js/main.js`：DWELL/manualRecovery/cruiseInterval 改读 BUF_CONFIG；新增 URL 参数解析 `?dwell=ms`（钳到 [minDwell,maxDwell]）与 `?alarmRate=0..1`（传 mock 的 forceAlarmRate；=1 时另传 alarmDurationMs=20000 便于演示）。
- `web/js/carousel.js`：MANUAL_HOLD 硬编码改为 `opts.manualHold`（缺省 60000 保留），dwell 缺省 300000 保留。

## 验收（spec 6 条，chrome-devtools on file:// 实测 + node --test 互补）
1. ✅ 双击即运行：file:/// 直开、无控制台报错。
2. ✅ 布局一致：L20-Array 616 矩形 / 1677 竖排文字（CAK-01CL）/ 65 槽位编号 / 20 容量大字。
3. ✅ 轮播+手动：dwell=300000 由 BUF_CONFIG 注入；点页码实测 L20-Array→L40-CF/Cell；60s 恢复由单测覆盖。
4. ✅ 单报警：镜头聚焦 (598,115,498,586)（整页 1991x2343）、alarm-pulse 动画运行、marquee 信息条滚动；恢复由单测+切页 viewBox 复位实测。
5. ✅ 多页报警轮播：实测页面在报警页间切换（L40-CF/Cell→L40-Array）；排序由单测覆盖。
6. ✅ 实时数据：容量大字 6s 内变化；lot 徽标显示与迁移正常。

## 回归
- `node --test`：14 pass / 0 fail。
- 截图：`web/qa-task6-full.png`。

## 疑虑
- brief 中演示示例 `?dwell=5000` 会被钳到 minDwell=180000——按"钳到 [minDwell,maxDwell]"的明确指示实现，README 演示示例改用 `?alarmRate=1&dwell=180000`（加速靠 alarmRate，dwell 至少 3 分钟）。若需 dwell 突破下限，需放宽钳制或调低 config.minDwell。
- 浏览器内无法在合理时长内直接观察 5 分钟自动换页/60s 手动恢复，该时序由单测覆盖，浏览器验证接线（BUF_CONFIG 生效、点页码跳页）。
