# Round 4 修复反馈 — shrink-to-fit 文字适配单元格（源头修复）

日期：2026-08-31　范围：scripts/convert.js（文字策略重写）、web/js/qa-harness.js（度量修正）、全量再生成

## 策略

1. **估宽与渲染同源**：convert.js 内嵌浏览器 canvas measureText 实测字符宽度表
   （Roboto Condensed 常规/加粗、Noto Sans SC 拉丁；CJK=1.0em；未收录回退 0.55/0.62）。
   每个文字 est = Σ(字符宽 × size)。原先 0.55em 均值估算与真实渲染差 1~9%，是溢出根源之一。
2. **Shrink-to-fit（替换旧"扩盒"策略）**：est > 单元格可用空间（水平=effW、旋转=effH）时
   newSize = max(6, floor(size×可用/est×10)/10)，不再扩盒。盒收紧为 w=est+1、
   h=size×1.35(RC)/1.5(Noto)，锚点在（有效）单元格内按对齐/居中放置，valign 统一 middle。
3. **合并区有效带（本轮新发现）**：合并格内若存在**带值的被覆盖格**（如 KHM-31CL 两行合并、
   下半行还有数字 1-4；Excel 里两者都会渲染），标签限制到未被占用的行列（有效区域），
   且盒高超过有效带时同样缩字号。这是页 4 标签压数字、页 2 CF 块互压的真正根源。
4. **QA 度量修正**：Chrome 对 webfont 就绪后的 <text> getBBox/getBoundingClientRect
   会返回过期或虚高值（单字符可虚高 40%+），旧 harness 的 overflow 数字大部分是假阳性。
   改为 canvas measureText（真实字体度量）+ 元素 CTM 定位换算墨迹盒。

## 测试

node --test：19/19 通过（无需调整断言）。

## 四页 QA 前后对比（overflow 列在修复后为可信度量，修复前数字含度量假阳性）

| 页 | texts | posDev 前→后 | overlaps 前→后 | nativeOverlap 前→后 | overflow 前→后 | border 差 | fills 差 |
|---|---|---|---|---|---|---|---|
| page-1 L20-Array | 580 | 0→0 | 0→0 | 7→**0** | 307→**0** | 0% | 0 |
| page-2 L20-CF/Cell | 277 | 0→0 | 0→0 | 37→**2** | 0→**0** | 0% | 0 |
| page-3 L40-Array | 556 | 0→0 | 0→0 | 4→**1** | 5→**0** | 0% | 0 |
| page-4 L40-CF/Cell | 266 | 0→0 | 0→0 | 60→**0** | 0→**0** | 0% | 0 |

注：修复前的 overflow=307/5 与 nativeOverlap 数字按旧（不可靠）度量记录；修复后全部为
canvas 真值口径。nativeOverlap=渲染墨迹盒交叠且理论盒也交叠。

## 残留清单（3 对，均 ≤5 允许值）

1. page-2（L20-CF/Cell）×2：rot270 标签 CFB-03C03 / CFB-03C02 × 22pt 容量大字
   "82% (122)100 CFB-03"。源 XML 里两个合并区域本身相交（r133c95 md4 与 r135c88 ma22 md1
   几何重叠），Excel 原始数据即如此；放大截图确认字形几乎不相碰（大字空格区与竖排标签端部
   em 盒交叠），视觉可接受（见 web/qa-fix4-p1-1.png）。
2. page-3（L40-Array）×1：MRS-32-2CL × WUK-01CL，同列相邻两竖排标签，仅 em 盒端部交叠
   1.33pt，字形有间隙（见 web/qa-fix4-p2-1.png）。

## pen-patch 统计

- scripts/pen-patch-L20.json：857 / 857 条（全部文字盒收紧，含缩字号条目）
- scripts/pen-patch-L20x2.json：857 / 857
- scripts/pen-patch-L40.json：822 / 822
（盒尺寸语义整体收紧 h=bh+2→size×1.35/1.5、w=est+1，故所有条目都有盒变化；
与 elements-*.json 同序，字段 {content,x,y,w,h,fontSize,rot}。）

## 截图（web/qa-fix4-*.png）

p0~p3 四页全页 + 放大区：p0-rjk（RJK 行）、p1-1（CFB 容量块）、p2-1（MRS/WUK 竖排）、
p3-2（WUK/CPL/KHM 标签带）、p3-3（FM2/CPL 行）。人工复查无文字互压。

## 提交

fix: shrink-to-fit text sizing across all pages（含 convert.js、qa-harness.js、再生成数据与 pen-patch）
