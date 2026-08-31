# 修复反馈 第 3 轮（fix-feedback round 3）——程序化 pencil 保真核验

日期：2026-08-31。触发：用户反馈页 4（L40-CF/Cell）仍有文字重叠、缺边框、形状位置混乱、形状宽度不够容纳文字。本轮起放弃目测对照，全部程序化核验。

## 一、核验工具（新增）

- `web/js/qa-harness.js`（dev-only）：`?qa=1&page=0..3` 直达（main.js 在 qa 模式下只渲染+核验，不启轮播/mock——mock 的 rewriteCapacity 会改写文字内容污染测量）。
  1. 文字位置：渲染墨迹盒（getBBox × getScreenCTM 复合换算到根用户坐标）按 align/valign 锚边/中心与理论 AABB 比对，>2pt 记录。
  2. 文字重叠：页内全部文字实际 AABB 两两求交（y 排序滑窗），两轴侵入均 >0.5pt 记录；**理论盒本身已重叠的对计入 nativeOverlap（pencil 原生）单独统计，不算缺陷**。
  3. 盒容纳：墨迹盒超出理论 AABB 的量（供 textLength 钳制决策）。
  4. 边框：path.getTotalLength() 与 borderGeo 线段长度和比对，差 >1% 记录。
  5. fill 矩形：DOM rect 数量/坐标与数据比对。
  - 输出 JSON 至 console 与 `window.__QA_REPORT`，document.title 加 `[QAn dev:x ov:x nat:x ox:x]` 标记。
- 截图存档：`web/qa-fix3-p{0,1,2,3}-*.png`（页 4 三个重点区、其余页各 1–2 区）。

## 二、根因与修复

1. **【主因】跨页元素 ID 撞车**：gen-pages 对 L20/L40 上下页都用后缀 A/B，L20-B 与 L40-B 的 `fB_*`/`tB_*` 完全重名；四页 DOM 同存一个 svg，`document.getElementById` 永远命中先插入的 L20-B 元素。后果：
   - `applyStates` 把状态颜色刷到别页矩形、容量数字改写到别页文字 → 用户看到的"形状位置混乱/文字重叠"；
   - 第 1 轮所有"目测对照"页 4 实际看的是被污染的 DOM。
   - 修复：`scripts/gen-pages.js` 后缀按帧唯一（L20→A/B，L40→C/D），重新生成 page-*.js；harness 内元素查找也限定在本页 `<g>` 作用域（双保险）。
2. **bottom 基线 descender 系数**：0.22→0.29（Roboto Condensed 实测 em 下延 ≈0.29×size）。修前所有 bottom 文字墨迹盒越出盒底 0.69–0.78pt（数字行侵入下格 4pt 的推手之一）。修后四页 oy 全部归零。
3. harness 自身两处 bug（过程中修掉）：CTM 复合方向写反（应为 `root⁻¹·m`）；boot 在 `BUF.render.init()` 之前取 pageCount 导致 page 参数永远钳成 0。

## 三、验收结果（四页 QA 摘要，容差：位置 2pt / 重叠 0.5pt / 边框 1%）

| 页 | 名称 | 文字数 | 位置偏差 | 渲染引入重叠 | pencil 原生重叠(豁免) | 盒溢出 | 边框差% | fill 差异 |
|---|---|---|---|---|---|---|---|---|
| 0 | L20-Array | 580 | **0** | **0** | 7 | 307(均 ≤2.34, 见豁免) | 0.000 | 0 |
| 1 | L20-CF/Cell | 277 | **0** | **0** | 37 | 0 | 0.000 | 0 |
| 2 | L40-Array | 556 | **0** | **0** | 4 | 5(1.88, 见豁免) | 0.000 | 0 |
| 3 | L40-CF/Cell | 266 | **0** | **0** | 60 | 0 | 0.000 | 0 |

- node --test：19/19 通过（borderGeo 用例无回归）。
- 正常模式（非 qa）抽查：页 4 KHM-31CL 状态色刷在正确矩形（x=433.6 与数据一致）、容量文字关联正确。

## 四、残留豁免清单（pencil 原生，非缺陷）

1. **原生盒重叠（nativeOverlap 计 108 对）**：pencil 数据里理论盒本身就交叠（如 L20-A 的 WSD-01CL/WSD-02CL 纵向标签盒高 49.4 但行距仅 25.9；数字行盒底 415.3 侵入下排标签盒顶 411.3）。渲染忠实还原 pencil 盒语义，不擅自避让。已用 docs/ref/pencil-L20.png 目视核对同区域存在同样的紧凑交叠。
2. **页 0 的 301 处 ox≤1（右对齐数字越盒右 0.83pt）**：anchor=end 把 em 盒推进宽度右缘对齐盒右，em 计量宽 > 字面墨迹；视觉墨迹不越界。
3. **页 0/2 的 rot270 容量大字厚度越盒 1.88–2.34pt**（如 BUF-31… 26pt 字体 em 厚 30.9 vs 盒厚 27.1）：pencil 本身就把 26pt 字放进 27.1pt 厚的盒（Excel 式视觉溢出语义），glyph 帽高 ~18.7 实际不越盒；textLength 无法修厚度方向，且修了反而背离 pencil。

## 五、改动文件

- `web/js/qa-harness.js`（新增）
- `web/js/main.js`（?qa=1 分支）
- `web/js/page-render.js`（bottom 基线 0.22→0.29）
- `scripts/gen-pages.js`（帧唯一 id 后缀）+ 重新生成的 `web/data/page-1..4.js`
- 截图 `web/qa-fix3-p*.png`
