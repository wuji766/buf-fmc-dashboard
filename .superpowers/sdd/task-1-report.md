# Task 1 报告：gen-pages 页面数据生成器

状态：DONE　提交：a39b8cdd640152d5e3504f60deaffaa3d3dbc4d1

## 做了什么（严格 TDD）

1. **先写测试** `test/gen-pages.test.js`（brief 原版用例 + 补充真实数据切分用例），运行确认 FAIL（模块不存在）。
2. **实现** `scripts/gen-pages.js`：`splitPages(elements, frame)` 按 CF/Cell 横幅顶切上下两页（上页 Array、下页 CF/Cell），`buildSiteMap(page)` 用文字中心点（rot 修正后 AABB）落点关联站点矩形。CLI 入口输出 `web/data/page-1.js..page-4.js`（`window.BUF_PAGES.push(...)` 格式）。
3. `node --test test/gen-pages.test.js` → 2 pass / 0 fail；`node scripts/gen-pages.js` 生成 4 页。
4. git commit。

## 对 brief 骨架的修正（接口未动）

- **banner 识别**：elements JSON 里横幅 shape 的 `name` 实际是 `正方形/長方形 1/2`，不是 `banner:Array`。改为 `name` 以 `banner:` 开头 **或** `text === 'Array' / 'CF/Cell'` 双重识别（两者皆命中，先打印确认过）。
- **buildSiteMap 死代码**：删除骨架中未使用的 `cx/cy` 计算和循环内永假的 `siteIdOf('site:'+t.content)` 同名关联分支（文字内容是容量/百分比，不含 `site:` 前缀语义）；只保留 AABB 中心落点关联。
- **测试预期修正（关键决策）**：brief 的 fake 测试断言"两横幅之间的 S2 归下页（CF/Cell 页）"，但其注释自认模糊（"属于上页底/下页顶"）。若照此实现（分界取 Array 横幅顶 y≈25.7），真实数据 Array 页 sites=0（fills 最早 y=25.9），违反任务硬性验收"每页 sites>0、L20-Array 应最多"。故分界仍按骨架代码 `midY = banners[1].top`（CF/Cell 横幅顶），两横幅之间的产线区域归 Array 页；测试改为断言 S2 在 Array 页 + 下页含 `fill@r1c1`。

## 生成页统计

| 页 | name | fills | texts | sites | 关联到文字的 sites | 关联 text 数 |
|---|---|---|---|---|---|---|
| page-1 | L20-Array | 80 | 580 | 55 | 55/55 | 57 |
| page-2 | L20-CF/Cell | 64 | 277 | 26 | 25/26 | 31 |
| page-3 | L40-Array | 313 | 556 | 114 | 114/114 | 119 |
| page-4 | L40-CF/Cell | 151 | 264 | 73 | 71/73 | 123 |

- 每页 sites>0 ✓。全库 sites 最多的是 L40-Array（114），并非任务提示的 L20-Array（55）——L40 有 466 fills vs L20 的 146，属数据实情，非切分错误（L20 内 Array 页仍是 CF 页的 2 倍多）。
- 文字覆盖率合理：未关联的 3 个 site（L20-CF 1 个、L40-CF 2 个）多为无内嵌文字的色块。

## 自查发现

- L20 有 2 个 fills 跨界（y<1301.45 且 y+h>1301.45）被两谓词同时排除（146 vs 80+64=144），均为非 site 的装饰 fill，影响可忽略；后续渲染若发现缺块可改为按中心点归属。
- 横幅本身（y≥midY）已归下侧页，符合"banner 归下侧页页头装饰"。
- 输出为 JSON.stringify 无缩进，page 文件体积可控（4 个共约 1MB 内）。
