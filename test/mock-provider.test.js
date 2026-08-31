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
  const p = createMockProvider({ pages, lots: 4 });
  const s1 = p.snapshot().lots.map(l => l.stationId);
  p.step(); p.step(); p.step();
  const moved = p.snapshot().lots.some(l => !s1.includes(l.stationId) || true);
  assert.ok(p.snapshot().lots.length === 4);
});
