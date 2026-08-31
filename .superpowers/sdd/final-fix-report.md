# 最终代码审查修复报告（2026-08-31）

提交：d3fa5be0ccb527f1f4d28806d368d3e62974cfc6
`fix: final review batch (cruise state reset, alarm bar escaping, cross-boundary fills)`

## 1. cruise 分支状态复位（web/js/main.js:144）

改动：

```js
if (sig !== cruiseSig) { stopCruise(); cruiseSig = sig; lastEnvVB = null; }
```

进入 cruise 分支时同时清空 `lastEnvVB`，防止 envelope → cruise → envelope 流转时 `sameViewBox(lastEnvVB, cam.viewBox)` 误判"取景未变"导致包络复原卡死（不清旧值时旧 envelope viewBox 会拦截重新取景）。

## 2. 报警信息条 HTML 转义（web/js/alarm.js）

新增辅助函数（bar() 之前）：

```js
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

`bar()` 中拼接 parts 后逐项转义：

```js
var s = parts.map(escapeHtml).join(' | ')...
```

时间戳为数字不受影响；siteId/code/text/页名均经转义后再进入 innerHTML，消除注入/破坏 marquee 结构的风险。

## 3. splitPages 跨界矩形归属（scripts/gen-pages.js:56）

下页谓词由 `o.y >= midY` 改为 `o.y + (o.h || 0) > midY`：

```js
const bottom = mk('B', 'CF/Cell', o => o.y + (o.h || 0) > midY);
```

矩形跨越分界线（起点在上页、底边越过横幅顶）时归下页，不再因 y < midY 被上页谓词 `(y+h) <= midY` 与下页谓词 `y >= midY` 同时排除而丢失。

- ① `node --test test/gen-pages.test.js`：2 tests, 2 pass, 0 fail —— 测试断言无需修改（原断言未覆盖跨界场景，旧用例语义不受影响）。
- ② `node scripts/gen-pages.js` 重新生成 web/data/page-*.js，对比 HEAD 版本条目数（按 `"x":` 计，含 fills/texts）：
  - page-1 (L20-Array)：715 → 715（不变）
  - page-2 (L20-CF/Cell)：367 → 369（+2，即 L20 丢失的 2 块跨界 fills 归回）
  - page-3 (L40-Array)：983 → 983（不变）
  - page-4 (L40-CF/Cell)：488 → 494（+6）
  - page-2 新增首块 fill 即跨界矩形 `fill@r101c104`（y=1295.35, h=64.75，底边越过 midY），符合预期。

## 4. README 测试跑法（README.md「第二步」运行方式节）

新增一行：`- 测试：项目根目录运行 \`node --test\`（全部单测）。`

## 测试输出（全量）

```
$ node --test
ℹ tests 14
ℹ pass 14
ℹ fail 0
```
