# BUF FMC 三楼层布局原型（pencil）

## 交付物
- `BUF-FMC三楼层布局原型.pen` — 三个楼层布局帧（矢量、1pt=1画布单位、按 Excel 原比例复刻）
  - `L20`：1991×2343 pt，含 Array/CF-Cell 两条产线、图例、146 填充块、857 文字、网格边框
  - `L20 (2)`：L20 整帧复制（原肘形箭头标注因渲染成对角三角形污染已按用户要求删除，2026-08-28）
  - `L40`：1555×2214 pt，466 填充块、822 文字
- 关键元素命名规范（供后续大屏按站点定位变色）：
  - 容量块：`site:BUF-01   100(216)  46%`（即 fill 矩形 name = "site:" + 单元格内容）
  - 槽位/输送条：`site:BUF-01C01` / `site:58%  (102)60  CFB-01`
  - 通用色块：`fill@r{行}c{列}`
  - 边框：`grid-borders`（每帧一个 path 节点）；横幅：`banner:Array` / `banner:CF/Cell`
- 状态色（与 Excel 一致）：`#00FF00` 正常、`#92D050` 满杯预告、`#FF66FF` 满杯警告、`#2EF233` 亮绿、横幅 `#4F81BD`

## 数据资产（供后续大屏开发复用）
- `data/sheet-L20.xml`、`sheet-L20__2_.xml`、`sheet-L40.xml` — SpreadsheetML 2003 全量数据（值/样式/合并/边框/竖排方向），从 WPS COM 只读提取
- `data/geom-*.json` — 行列尺寸（pt）
- `data/shapes.json` — 浮动形状（横幅、肘形箭头）
- `data/elements-*.json` — 转换后的元素清单（fills/texts/W/H/shapes）
- `data/ref-*.png` — ⚠️ 被 DLP 跟随加密，不可读，可删

## 2026-08-28 文字细节修复（竖排方向 / 溢出）

- pencil 旋转语义（`Get` 的 `ctx.bounds` 实测，rot-test 实验）：
  - `rotation:90` 渲染矩形 = `(x, y-w, h, w)`，文字自下而上读 → 对应 Excel `Rotate=90`
  - `rotation:270` 渲染矩形 = `(x-h, y, h, w)`，文字自上而下读 → 对应 Excel `Rotate=-90`
- `scripts/convert.js` 修正：旋转换算与锚点公式；水平文字按估宽（ASCII 0.62em / CJK 1em / 加粗 +5%）不足则按对齐方向扩宽防换行 + 垂直 2pt 余量；横幅文字同样处理。
- `.pen` 三帧（mBior / P3d7GZ / ApTOU）已原地修正：133+133+130 竖排、724+724+692 水平文字、1 横幅；CAK-01CL 渲染盒精确等于单元格 (249, 38.85, 27.1, 51.8)，整帧截图复核竖排文字均落入色条。
- 坑：pencil `Update` 改 `rotation` 时会保持原渲染位置重新归一化锚点——改旋转与改位置必须分两步（先翻旋转方向，再用 `ctx.bounds` 实测值平移到位）。
- 调试脚本：`scripts/dbg-cell.js`（核对单元格几何/样式）、`scripts/check-snippets.js`、`scripts/dbg-rot.js`。

## 2026-08-28 第二轮：字体宽度问题（RJK 竖条 / BUF 槽位编号看不清）

- 根因：Excel 用宋体（ASCII 半角 0.5em/字符），"BUF-01C01" 9 字符在 54.2pt 格内刚好放下；pencil 的 Noto Sans SC 拉丁字形约 0.6em+，同字号放不下 → 换行/溢出；RJK 竖条在 Excel 本就是 3 行高（38.85pt，比 CAK 的 4 行矮），宋体恰好塞下，Noto 下溢出。
- 修复：纯 ASCII 标签统一改用窄字体 **Roboto Condensed**（约 0.45em/字符，接近宋体半角观感），字号与几何不变；含中文的仍用 Noto Sans SC。三帧共改 2530 个文字节点（854+854+822），截图复核 RJK-01CL/RJK-03CL、BUF-01C01/BUF-02C05 均已回到形状内。
- convert.js 同步：`fontOf()` 按内容选字体，估宽系数分字体（0.45/0.62），`elements-*.json` 的 texts 增加 `font` 字段。

## 2026-08-28 第三轮：竖排文字批量错位修正（绝对值补丁）

- 发现：第二轮"翻方向→实测平移"两步法中 pencil 的旋转归一化行为不一致，导致部分竖排文字（尤其 6 条 BUF 大容量文字/帧）整体偏移一个条宽×条高，RJK 等居中错位。
- 修正方式：convert.js 竖排文字定版为「盒长 = max(单元格长, 0.55em 估长+1)（防换行；盒不裁剪文字），与单元格居中对齐；不缩字号（溢出行为与 Excel 宋体一致）」；由 `scripts/gen-rot-patch.js` + `gen-rot-apply.js` 生成绝对值补丁（按内容队列匹配，不动 rotation 属性避免再次归一化），三帧 133+133+130 全部应用。
- 验证：BUF-02 渲染盒实测 (479,363,27,441) 与绿条完全重合；RJK-01CL 渲染中心与格子中心对齐；整帧截图确认大竖条文字、RJK 小框、BUF 槽位编号均正常。
- 教训：对已旋转节点，`Update` 里同时改 rotation 和 x/y 的语义不稳定；正确做法是一次性写入最终绝对值且不触碰 rotation。

## 脚本（可重复执行）
- `scripts/extract2.ps1` — 附加运行中的 WPS/Excel 只读提取 XML+几何+形状（需工作簿在表格程序中打开；绝不保存原文件）
- `scripts/png.ps1` — 参照 PNG 导出（输出被 DLP 加密，实际无用）
- `scripts/convert.js` — SpreadsheetML → 元素清单 + pencil execute 分批片段（输出到 `scripts/snippets/`）
- 注意：ps1 需 UTF-8 BOM 编码（PowerShell 5.1 中文路径）

## 复刻管道说明
1. 提取：WPS COM `Range.Value(11)`（XMLSpreadsheet）一次拿到全部样式/合并/旋转
2. 换算：列宽/行高累计 → pt 坐标；Excel `ss:Rotate=90` → pencil `rotation:270`（+90 逆时针），`-90` → `rotation:90`
3. 绘制：填色游程合并为矩形；边框合并共线段为单 path；L20(2) 用 `Copy` 整帧复制
4. 字体：Noto Sans SC（宋体的可用替代）

## 后续阶段（未实施）
滚动大屏轮播、报警楼层切换与高亮、MQTT/OPC UA 数据接入 — 届时直接用 `data/elements-*.json` 按 name 定位站点元素更新颜色/内容。

## 第二步：浏览器监控大屏（2026-08-31）

**在线访问**：https://wuji766.github.io/buf-fmc-dashboard/menu.html （GitHub Pages，gh-pages 分支 = web/ 内容）
**本地访问**：双击 web/menu.html
**更新线上站点**：改完 web/ 后 git worktree add .ghpages gh-pages（已存在则直接进入），同步文件到 .ghpages 根目录后 git add -A && git commit && git -c http.proxy=http://127.0.0.1:7897 push（GitHub 需走本机代理）。


### 运行方式
- 测试：项目根目录运行 `node --test`（全部单测）。
- 打开 `web/menu.html` 选择运行模式（正常监控 / 报警演示 / 快速轮播 / QA 质检，卡片点击进入；免构建、免服务器，数据为 mock 引擎）。也可直接双击 `web/index.html` 进入正常监控模式。建议用 Chrome/Edge。
- 演示参数（可选 URL 参数加速演示）：
  - `index.html?alarmRate=1&dwell=180000` —— 报警高频触发（每 tick 必出）且持续仅 20s，dwell 取最小 3 分钟，便于快速观察报警锁定/轮播/恢复全流程。
  - `index.html?alarmRate=0` —— 关闭报警，静观 lot 迁移与容量刷新。
  - `dwell` 参数会钳制到 `config.js` 的 `[minDwell, maxDwell]`（默认 180s–360s）；报警节奏/巡航间隔等常量收敛在 `web/config.js`（`window.BUF_CONFIG`）。

### 验收结果（对照 spec 验收标准，chrome-devtools on file:// 实测）
1. ✅ 双击打开即运行 —— file:/// 直开无控制台报错，HUD 时钟/页码/SVG 正常渲染，页头显示"模拟数据"。
2. ✅ 4 页布局与 pencil/Excel 一致 —— L20-Array 页实测 616 矩形、1677 竖排文字（抽验 CAK-01CL）、65 个槽位编号（xxCnn）、20 处容量大字 `used(total) pct%`（如 BUF-02 88(101) 87%）。
3. ✅ 轮播/手动 —— 默认 dwell=300000（BUF_CONFIG 注入，单测"NORMAL 按 dwell 循环"）；点击第 4 个页码圆点实测从 L20-Array 跳到 L40-CF/Cell；手动 60s 保持后恢复由单测"手动模式 60s 内不自动切换"覆盖（报警模式下 activeAlarms 优先接管切页，属设计行为）。
4. ✅ 单报警锁定+特写+信息条+恢复 —— alarmRate=1 实测：viewBox 由整页 (0,0,1991,2343) 聚焦到报警包络 (598,115,498,586)，报警站点 `alarm-pulse` 动画（animation: alarm-stroke）运行，底部 marquee 滚动 `时间|页|站点|EQ|Mock alarm`；解除后恢复由单测"报警清空恢复全页轮播"+切页时 viewBox 复位实测覆盖。
5. ✅ 多页报警按最早时间轮播 —— alarmRate=1 下多页同时报警，实测页面在报警页间切换（L40-CF/Cell → L40-Array）；排序轮播由单测"多页报警按最早时间排序轮播"覆盖。
6. ✅ 实时数据 —— 6s 间隔两次采样容量大字发生变化（changed=true）；lot 徽标实时显示（L8/L1/L6/L2/L3…，含同站多 lot "L7 L1"）；lot 迁移由单测"lot 迁移改变站点归属"覆盖。

### 说明
- 轮播/报警状态机、mock 引擎均有 node --test 单测（14 pass），浏览器实测与单测互补覆盖验收 6 条。
- 真实数据源（MQTT/OPC UA DataProvider）为后续阶段，页头"数据源"状态位已预留。
