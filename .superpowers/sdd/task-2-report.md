# Task 2 报告：SVG 渲染与页面切换骨架

## 交付物
- `web/index.html`：按 brief 全文落地（Google Fonts 引入、hud 页头 pageName/clock/srcState、#stage+#board svg、alarmBar、pager、按序加载 data/page-{1..4}.js + page-render.js + main.js，file:// 双击可用，无 ES modules / fetch）。
- `web/js/page-render.js`：`BUF.render.{init,show,page,pageCount,svgEl,cur}`。
  - init：读 `window.BUF_PAGES`，每页构建 `<g class="page" data-page>`（fills→rect、borderGeo→path stroke 0.75、texts→text），默认 display:none。
  - show(i)：切组、viewBox 设为该页 W/H、回写 #pageName，触发 opacity 过渡（rAF 把 opacity 0→1，CSS `.page { transition: opacity .6s }` 实现淡入）。
  - **buildText 旋转锚点（按控制者指示修正 brief 冗余推导）**：渲染后文字中心 = 旋转 AABB 中心，text-anchor/dominant-baseline 统一 middle/central：
    - rot90：AABB=(x, y-w, h, w)，中心 (x+h/2, y)，transform=`translate(cx,cy) rotate(-90)`。
    - rot270：AABB=(x-h, y, h, w)，中心 (x-h/2, y+w/2)，rotate(90)。
    - rot0：anchor 按 align（middle/end/start），baseline 按 valign（middle→central，top→hanging，bottom→auto 且 ty=y+h 基线贴盒底）。
  - 尾部带 `if (typeof module!=='undefined') module.exports={buildText}`。
- `web/css/dashboard.css`：黑底 100vw/100vh 无滚动、#hud 渐变页头、#board 铺满 #stage、.page 淡入 0.6s、#alarmBar 40px 横条（.hidden 隐藏，Task 3 启用 marquee）、#pager 右下圆形页码 .on 高亮。
- `web/js/main.js`（临时骨架）：init+show(0)、时钟每秒、右下页码点（可点击切换）、**5s 轮播**（Task 3 重写）。

## 自验（chrome-devtools MCP，file:// 直开）
- 页面加载正常，无控制台错误。
- `BUF.render.pageCount()=4`，rect 608 个、text 1677 个全部渲染；5s 轮播自动切页生效。
- 截图 `web/qa-task2.png`：黑底、页头（页面名/时钟/“模拟数据”）、彩色机台矩形阵列、水平/竖排（rot90）文字均正常，右下页码圆点高亮随轮播移动。截图时恰逢轮播切到第 2 页（L20-CF/Cell），视觉与 pencil 布局语义一致（页面原始 1991×2343 缩放到视口，小字密集属预期）。
- 备注：Playwright MCP 拒绝 file:// 协议，改用 chrome-devtools MCP 完成自验。

## 疑虑 / 后续
- 竖排文字与铅笔原型的像素级对齐未逐字比对（按 AABB 中心公式 + 截图整体检查）；若 Task 3 发现个别 rot270 文字偏移，需按同公式微调。
- 本任务无 node 测试（DOM 渲染），TDD 不适用，验收为浏览器截图人工复核。

## 提交
- `6149f2c` feat: SVG page rendering and switching skeleton
