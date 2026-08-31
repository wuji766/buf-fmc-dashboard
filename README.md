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
