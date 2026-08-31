# BUF FMC 浏览器监控大屏设计（第二步：布局还原 + 轮播 + 报警聚焦）

日期：2026-08-31
前置：第一步已完成——Excel 三楼层布局已复刻到 pencil（`BUF-FMC三楼层布局原型.pen`），并有全量结构化数据 `data/elements-L20.json` / `elements-L20x2.json` / `elements-L40.json`（fills/texts/W/H/shapes，坐标 1 Excel pt = 1 单位）。

## 目标

把三楼层布局还原到浏览器，做成实时监控滚动大屏：
- 按产线分页独占整屏，自动轮播（常态每页 3-6 min，默认 5 min）。
- 实时展示站点状态与 lot 追踪（本阶段 mock 数据，接口抽象，后续接 MQTT/OPC UA）。
- 报警时聚焦：镜头缩放特写报警区域 + 报警信息滚动播报；单页报警锁定该页，多页报警按时间顺序在报警页间轮播。

## 非目标（本阶段不做）

- 真实 MQTT/OPC UA 接入（只预留 DataProvider 接口）。
- L20(2)（它是 L20 的复制视图，无独立监控意义）。
- 用户权限、多语言、移动端。

## 技术选型

- **纯静态 HTML + 原生 JS + SVG**，免构建，双击 `web/index.html` 即可运行。
- 布局用 SVG 矢量渲染（来源 elements json），缩放不糊、站点可交互变色。
- 字体：Roboto Condensed（ASCII 标签）+ Noto Sans SC（中文），与 pencil 版一致，通过 Google Fonts CDN + 本地 fallback。

## 页面划分

4 页，由横幅（banner:Array / banner:CF-Cell）的 y 坐标切分：

| 页 | 帧 | 区域 | 说明 |
|---|---|---|---|
| 1 | L20 | banner:Array 之上 | L20-Array 产线 |
| 2 | L20 | banner:CF/Cell 之下 | L20-CF/Cell 产线 |
| 3 | L40 | banner:Array 之上 | L40-Array 产线 |
| 4 | L40 | banner:CF/Cell 之下 | L40-CF/Cell 产线 |

切分在数据准备脚本中完成（不是浏览器运行时切），每页生成独立 `web/data/page-{n}.json`：该区域的 fills/texts/borders + 页元信息（名称、宽高、站点清单）。

## 架构

```
web/
  index.html            # 唯一入口，页头 + 舞台 + 报警信息条 + 页码指示器
  css/dashboard.css
  js/
    main.js             # 启动、页调度（轮播状态机）
    page-render.js      # page-n.json -> SVG DOM（缓存复用）
    carousel.js         # 轮播状态机：正常轮播 / 报警锁定 / 报警页轮播
    alarm.js            # 报警聚合、镜头特写（viewBox 动画）、信息条滚动
    mock-provider.js    # DataProvider 的 mock 实现
    data-provider.js    # 接口定义：subscribe(stations, lots, alarms)
  data/
    page-1.json ... page-4.json
```

### DataProvider 接口（后续 MQTT/OPC UA 实现同一接口即插即用）

```js
provider.subscribe(callback)   // callback({stations, lots, alarms}) 增量推送
provider.pageScope(pageId)     // 返回该页关心的站点 id 列表（内部用）
```

- stations: `[{id, name, status: normal|preFull|full|alarm, capacity:{used,total}}]`
- lots: `[{id, stationId, sinceTs}]`
- alarms: `[{id, stationId, pageId, code, text, ts, active}]`

### 站点定位

- elements json 中填充矩形已有 `site:站点名` 命名（如 `site:BUF-01C01`、`site:BUF-01   100(216)  46%`）。
- 数据准备脚本建立 `站点id -> {rectId, 文字节点ids}` 映射表；容量大字站点解析出数字段做实时更新。

## 轮播状态机（carousel.js）

状态：
- `NORMAL`：4 页循环，每页 dwellTime（默认 5min，配置 3-6min），淡入淡出 600ms。
- `ALARM_SINGLE`：只有一页报警 → 锁定该页，不切换。
- `ALARM_MULTI`：≥2 页报警 → 仅在报警页之间轮播，顺序=各页最早报警时间升序，每页同样 dwellTime。
- 手动干预：页码指示器可点击跳页；跳页后 60s 无操作恢复自动。
- 迁移：每次收到数据回调/页切换定时器到期时重算目标页集合。

## 报警聚焦（alarm.js）

- **镜头特写**：SVG viewBox 从整页动画（500ms ease-in-out）到报警区域包络（含上下文 padding，放大 3-4 倍）。
  - 同页多报警点：先取所有报警点包络；若放大后仍小于 2.5 倍（报警点太分散），改为每 20s 在各报警点间巡航特写。
  - 报警全部解除或页切换：viewBox 平滑回到整页。
- **站点视觉**：报警站点保留原填充色 + 红色描边脉冲（CSS animation，2s 循环）。
- **报警信息条**：屏幕底部，横向滚动（无缝 marquee），条目 = `时间 | 页/产线 | 站点 | 代码 | 内容`，按时间倒序；单条超宽滚动，多条依次滚动。

## 站点状态与 lot 展示（mock）

- 状态色（与 Excel 约定一致）：`#00FF00` 正常 / `#92D050` 满杯预告 / `#FF66FF` 满杯警告 / 报警=红描边闪烁。
- 容量大字（BUF-xx `used(total) pct%`）随 mock 数据实时刷新文字与填充色。
- lot 标签：站点矩形角落显示 lot 号小徽标（最多显示 3 个，超出显示 `+n`）；mock 引擎按每页站点清单随机迁移 lot（每 2-8s 一步）。
- mock 报警生成器：低概率（约每页每分钟 10%）触发报警，持续 1-5 min 自动解除，保证可验收全流程。

## 错误处理

- page-n.json 加载失败：显示错误占位页，轮播不中断。
- DataProvider 断流（mock 不存在此情况，为真实源预留）：页头"数据源"状态转红，最后数据保留显示并标注时间戳。

## 验收标准

1. 双击 `web/index.html` 打开即运行，无需服务器/构建。
2. 4 页布局与 pencil/Excel 一致（抽验竖排文字方向、槽位编号、容量大字位置）。
3. 轮播：默认 5min 换页；点击页码可跳页，60s 后恢复。
4. mock 报警触发后：单报警页锁定；镜头特写报警站点；底部信息条滚动该报警；解除后恢复轮播与整页视图。
5. 多页同时报警：只在报警页间按最早报警时间顺序轮播。
6. lot 徽标出现/迁移；容量大字数值变化；状态色随 mock 变化。

## 后续阶段（不在本设计内）

- MQTT/OPC UA DataProvider 实现与点位映射配置。
- 报警确认（ack）交互、历史报警查询。
- L20(2) 是否需要作为第 5 页（待定）。
