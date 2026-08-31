const { test } = require('node:test');
const assert = require('node:assert');
const { createMockProvider } = require('../web/js/mock-provider.js');
const pages = [{ id: 'P1', sites: [{ siteId: 'S1', rectId: 'f1' }, { siteId: 'S2', rectId: 'f2' }] }];

test('快照包含全部站点状态', () => {
  const p = createMockProvider({ pages }); const snap = p.snapshot();
  assert.equal(snap.stations.length, 2);
  assert.ok(['normal', 'preFull', 'full'].includes(snap.stations[0].status));
});
test('报警会出现且最终解除', () => {
  const p = createMockProvider({ pages, forceAlarmRate: 1, alarmDurationMs: 10 }); // 测试必报警
  p.step(); const a1 = p.snapshot().alarms;
  assert.ok(a1.length >= 1 && a1[0].pageId === 'P1' && a1[0].active);
  p.tickTime(20); assert.equal(p.snapshot().alarms.filter(a => a.active).length, 0);
});
test('lot 迁移改变站点归属', () => {
  let seed = 42; // 注入固定随机源，保证确定性
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const p = createMockProvider({ pages, lots: 4, rand });
  assert.ok(p.snapshot().lots.every(l => typeof l.sinceTs === 'number')); // sinceTs 字段存在
  const before = p.snapshot().lots.map(l => l.id + ':' + l.stationId);
  p.tickTime(8000); p.step(); // 越过 nextMove 上限（8s），全部 lot 应迁移
  const after = p.snapshot().lots.map(l => l.id + ':' + l.stationId);
  assert.equal(after.length, 4);
  assert.notDeepEqual(after, before); // 至少一个 lot 归属变化
});
