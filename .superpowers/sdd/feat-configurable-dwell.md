# feat: 轮播时长可设置（feat-configurable-dwell）

日期：2026-09-10 · 分支：main（直接提交）

## 需求

用户可在界面上设置自动轮播每页停留时长；质检模式（?qa=1）不提供该设置，其余模式可设置且立即生效、刷新后记住。

## 实现

### 1. carousel.js（纯逻辑，双端）
- 新增 `setDwell(ms)`：运行中动态改 dwell，**立即生效**——从当前页开始时刻起按新 dwell 计算（已过时长超新值则下次 tick 立即切页），本身不触发切页；非法值（0/负/非数）忽略。
- 新增 `dwell()` 查询。缺省 300000 与 `opts.dwell` 注入保留。
- `test/carousel.test.js` 补 3 用例：①中途改短按新时长切页；②不触发立即切页；③非法值不生效。

### 2. 监控页设置入口（index.html + main.js + dashboard.css）
- 页头 `#srcState` 与 `#menuLink` 之间加 `#dwellSlot`，由 main.js 动态填充半透明胶囊按钮（显示如"轮播 5 分钟"），点击展开 8 选项弹层 `[1,2,3,4,5,6,8,10]` 分钟（两列网格，当前值高亮，点外部收起）。
- 选择后：`carousel.setDwell` + 状态条倒计时立即按新值刷新（`renderCarouselState()`）+ 写 `localStorage('buf.dwell')`。界面选项直接给定值**不做钳制**。
- dwell 解析链（main.js）：`?dwell=`（钳到 [minDwell,maxDwell]，显式指定时写入 localStorage）> `localStorage(buf.dwell)` > `config.dwell`。0/负/非数一律不采用（防护：非法存量值保持 config.dwell=300000 兜底）。
- `?qa=1` 时 main.js 顶部早退，胶囊不渲染（CDP 实证 E1）。
- **附带修复**：`#hud` z-index 2→3。原值下弹层（hud 层叠上下文内 z:6）上半部被同 z-index:2 且 DOM 靠后的 `#statusBar` 盖住，选项点击命中状态条（CDP 首轮 A5 失败定位）。

### 3. menu.html
- 三张非 QA 卡片各加"停留时长"下拉（同 8 选项，默认 5 分钟）；三卡共享同一偏好 key `buf.dwell`（改任一卡同步全部卡片与 URL），选择即持久化。
- 点击卡片把所选时长以 `?dwell=` 带入监控页；快速轮播卡原硬编码 `dwell=180000` 移除，改由选择器决定（描述文案同步更新）。
- 选择行拦截 click 冒泡，不触发卡片跳转。

### 4. config.js
- `minDwell`/`maxDwell` 从 180000/360000 放宽为 **60000/600000**（1-10 分钟），使 URL 钳制范围覆盖界面/菜单选项全集（否则菜单选 1 分钟经 URL 会被钳成 3 分钟，与"界面给定值不钳制"矛盾）。钳制语义仍仅作用于 URL 参数。

## 验证

- `node --test`：**30/30 通过**（基线 27 + 新增 3）。
- CDP 浏览器自验（`scripts/qa-dwell-cdp.js`，headless Chrome + file://）：**21/21 通过**——
  A 胶囊渲染/默认 5 分钟/展开 8 选项/选 1 分钟立即生效（倒计时 298s→56s）/1 分钟节奏真实切页（页 0→1）/localStorage 写入；
  B 刷新记住（轮播 1 分钟，倒计时 58s）；
  C URL 优先（?dwell=300000 覆盖存量并写入）、?dwell=0 防护落回存量；
  D 菜单三卡选择器共享、改 2 分钟同步全部卡片 URL+持久化、点卡片以 ?dwell=120000 带入；
  E ?qa=1 无 .dwell-ctl 且槽位为空。
- 截图：`web/qa-dwell-open.png`（弹层展开）、`qa-dwell-applied.png`（选 1 分钟后倒计时）、`qa-dwell-menu.png`（菜单选择器）、`qa-dwell-qa.png`（QA 模式无控件）。

## 变更文件

`web/js/carousel.js` · `web/js/main.js` · `web/config.js` · `web/index.html` · `web/menu.html` · `web/css/dashboard.css` · `test/carousel.test.js` · `scripts/qa-dwell-cdp.js`（新）· `web/qa-dwell-*.png`（新×4）
