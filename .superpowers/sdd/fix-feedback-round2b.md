# Round 2b —— 严格 pencil 还原：文字布局 + 每页边框

## 修复 A：边框缺失
- 根因：`elements-*.json` 本不含 `borderGeo`（border 几何只进了 pencil 的 30-borders 片段），web 页数据里 `borderGeo` 一直是空串 → 整站无边框。
- 方案：`scripts/convert.js` 改为可 require（主流程包进 `require.main===module`，导出 `parseSheet/build`，**不重跑副作用**——elements json 含 rot-patch 后处理坐标，重跑会毁掉）；`scripts/gen-pages.js` 新增 `borderGeoOf(frame)` 从 sheet XML 复用 `build()` 算出整帧 borderGeo，再由 `splitBorderGeo(geo, midY)` 切分：
  - 水平段按 y（<=midY 上页，否则下页，与 fills 的 pred 一致）；
  - 垂直段整体在一侧直接归属；跨越 midY 在 midY 处裁成两段分属两页。
- 测试：`test/gen-pages.test.js` 新增 2 个用例（构造跨 midY 垂直段裁分；真实数据每页 borderGeo 非空且线段不越 midY）。

## 修复 B：buildText 锚点/基线算法重写（web/js/page-render.js）
统一在渲染 AABB 内布局（rot0 (x,y,w,h)；rot90 (x,y-w,h,w)；rot270 (x-h,y,h,w)）：
- align：left→AABB.x+start；center→中心+middle；right→右端+end
- valign：top→基线 AABB.y+0.8×size（auto）；middle→中心（central）；bottom→AABB.y+AABB.h-0.22×size（留 descender，不侵入下格）
- 旋转文字：translate(AABB 中心) rotate(∓90)，anchor=middle + central（与 pencil 一致，中心公式与旧实现等价，但显式走 AABB）
- 字体族/字号/bold 不变。

## 自查回路（chrome-devtools，file:// 打开 index.html?alarmRate=0）
- 迭代 1：1920x1080 逐页截图 + 视觉模型审查。页 2/4 报"图例色块缺描边、汇总区缺纵线"→ 对照 pencil-L40.png 原型确认原型同样无边框/无网格，**非缺陷**；页 3 报"竖排容量标签重叠/偏移"。
- 迭代 2：DOM 核对 BUF-31 标签 transform=translate(284.55,582.75) rotate(90) 与 AABB 中心公式完全吻合；升到 1920x1200 重截图复查，视觉模型确认标签居中、无重叠、无下溢 —— 迭代 1 的重叠为低分辨率伪报。页 1 重点区域（BUF-01C01 一排 / ALFT 组 / CAK·RJK 竖条 / 数字 1-4 行 / 边框完整性）逐项复核全部正常。
- 最终截图：`web/qa-fix2b-page{1..4}.png`。

## 结论
- node --test：19/19 通过。
- 对照 pencil：4 页文字布局、旋转文字、边框与原型无明显差异。
- 已知残留：图例色块无边框、汇总区无网格（与原型一致，刻意保留）；0.75px 描边在低缩放比下因抗锯齿略显模糊（与 pencil 渲染一致）。

## 提交
`git commit -m "fix: strict pencil-fidelity text layout and per-page borders"`（哈希见 git log）
