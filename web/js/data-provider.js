/* BUF FMC 大屏 —— 数据提供方接口约定（纯注释，无逻辑）
 *
 * window.BUF.provider 契约（真实数据源按此实现后可替换 mock）：
 *   - start(emit, intervalMs)：每 intervalMs 毫秒调用一次 emit(snapshot)，全量快照
 *   - stop()：停止推送
 *   - （可选）subscribe(cb)：订阅增量/全量更新，返回取消订阅函数
 *
 * 快照数据形状（与 mock-provider.js 的 snapshot() 一致）：
 *   {
 *     stations: [ { siteId, pageId, status, capacity: { used, total, pct } } ],
 *     lots:     [ { id, stationId, pageId } ],
 *     alarms:   [ { id, siteId, pageId, code, text, ts, active } ]
 *   }
 *   - pageId 为页 id 字符串，与 window.BUF_PAGES[i].id 对齐
 *   - status: 'normal' | 'preFull' | 'full' | 'alarm'
 *   - ts 为毫秒时间戳；active=false 表示已解除（保留在列表中供历史展示）
 */
