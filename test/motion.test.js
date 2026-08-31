/* motion.js（spring 动画器）纯逻辑测试 —— node --test
 * 手写临界阻尼参数化 spring（damping/response，Apple《Designing Fluid Interfaces》语义），
 * 半隐式欧拉积分，manualDriver 虚拟时钟保证确定性。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const motion = require('../web/js/motion.js');

const DT = 1000 / 60; // 60fps 虚拟帧

/* 跑 n 帧并收集 onUpdate 采样 */
function run(spring, driver, frames) {
  for (let i = 0; i < frames; i++) driver.flush(DT);
}

test('① 临界阻尼单调收敛不超调（damping 1.0）', () => {
  const d = motion.manualDriver();
  const samples = [];
  let settled = 0;
  const h = motion.spring({
    from: 0, to: 100, damping: 1.0, response: 0.4, driver: d,
    onUpdate: v => samples.push(v),
    onSettle: () => settled++
  });
  run(h, d, 120);
  assert.ok(samples.length > 10, '应有连续采样');
  // 不超调：任何采样都不得超过目标（允许 1e-6 数值噪声）
  assert.ok(samples.every(v => v <= 100 + 1e-6), '不得越过目标');
  // 单调逼近：到目标的距离非递增
  for (let i = 1; i < samples.length; i++) {
    assert.ok(Math.abs(100 - samples[i]) <= Math.abs(100 - samples[i - 1]) + 1e-9,
      `距离应非递增：sample[${i - 1}]=${samples[i - 1]} sample[${i}]=${samples[i]}`);
  }
  // 收敛：末值精确等于目标（settle 吸附），onSettle 恰好一次
  assert.strictEqual(samples[samples.length - 1], 100);
  assert.strictEqual(settled, 1);
});

test('② retarget 中途改向：从当前值继续，无跳变', () => {
  const d = motion.manualDriver();
  const samples = [];
  const h = motion.spring({
    from: 0, to: 100, damping: 1.0, response: 0.4, driver: d,
    onUpdate: v => samples.push(v)
  });
  run(h, d, 15); // 0.25s：进行中（response 0.4 尚未 settle）
  const lastBefore = samples[samples.length - 1];
  const velBefore = h.velocity();
  assert.ok(lastBefore > 1 && lastBefore < 100, '改向前应处于途中');

  h.retarget(200); // 改向
  d.flush(DT);     // 改向后首帧
  const firstAfter = samples[samples.length - 1];
  // 无跳变：首帧值 = 改向前最后值 + 当前速度×dt（连续积分），绝非跳到新目标
  const maxStep = Math.abs(velBefore) * (DT / 1000) * 1.5 + 1e-6;
  assert.ok(Math.abs(firstAfter - lastBefore) <= maxStep,
    `改向首帧应连续：${lastBefore} → ${firstAfter}（允许步长 ${maxStep}）`);
  assert.ok(firstAfter < 200, '首帧不得直接跳到新目标');
  run(h, d, 200);
  assert.strictEqual(samples[samples.length - 1], 200, '改向后最终收敛到新目标');
});

test('③ velocity handoff：初速度决定首段位移方向', () => {
  const d = motion.manualDriver();
  const samples = [];
  const h = motion.spring({
    from: 0, to: 0, velocity: 500, damping: 1.0, response: 0.4, driver: d, // 目标=起点，纯初速度
    onUpdate: v => samples.push(v)
  });
  d.flush(DT); // 首帧
  // 初速度 +500/s → 首帧沿正方向位移（半隐式欧拉 ≈ v·dt 量级，受阻尼略缩）
  assert.ok(samples[0] > 3, `首帧应沿初速度方向运动，实测 ${samples[0]}`);
  assert.ok(samples[0] < 500 * (DT / 1000) * 1.5, '首帧位移不应超过速度×dt');
  run(h, d, 200);
  assert.strictEqual(samples[samples.length - 1], 0, '动能耗尽后回到目标');
});

test('④ damping<1 出现超调（越过目标后回摆）', () => {
  const d = motion.manualDriver();
  const samples = [];
  motion.spring({
    from: 0, to: 100, damping: 0.7, response: 0.4, driver: d,
    onUpdate: v => samples.push(v)
  });
  run(h = null, d, 120);
  const peak = Math.max.apply(null, samples);
  assert.ok(peak > 100 + 0.5, `欠阻尼应越过目标，峰值 ${peak}`);
  assert.strictEqual(samples[samples.length - 1], 100, '最终仍收敛到目标');
});
var h;

test('⑤ §6 惯性投影 project：指数衰减公式', () => {
  // (v/1000)·d/(1−d)：v=1000px/s, d=0.998 → 499px
  assert.ok(Math.abs(motion.project(1000, 0.998) - 499) < 1e-9);
  assert.ok(Math.abs(motion.project(0, 0.998)) < 1e-9, '零速度零投影');
  assert.ok(motion.project(2000, 0.998) > motion.project(1000, 0.998), '投影随速度单调');
});

test('⑥ §9 rubber-band：渐进阻力（位移小于越界量且单调）', () => {
  const r1 = motion.rubberband(100, 1000, 0.55);
  const r2 = motion.rubberband(200, 1000, 0.55);
  assert.ok(r1 > 0 && r1 < 100, `阻力位移应小于越界量：${r1}`);
  assert.ok(r2 > r1 && r2 < 200, '越界越大位移越大，但始终被压缩');
  // dimension 越大阻力越小（同样的越界在大容器里跟随更多）
  assert.ok(motion.rubberband(100, 4000, 0.55) > r1);
});

test('⑦ 数组值逐分量独立积分（2D 分解，§3）', () => {
  const d = motion.manualDriver();
  const samples = [];
  motion.spring({
    from: [0, 0], to: [100, 200], damping: 1.0, response: 0.4, driver: d,
    onUpdate: v => samples.push(v)
  });
  run(null, d, 120);
  const last = samples[samples.length - 1];
  assert.deepStrictEqual(last, [100, 200]);
  // 独立收敛：两分量各自单调逼近（距离非递增）
  for (let i = 1; i < samples.length; i++) {
    for (let k = 0; k < 2; k++) {
      const t = k === 0 ? 100 : 200;
      assert.ok(Math.abs(t - samples[i][k]) <= Math.abs(t - samples[i - 1][k]) + 1e-9,
        `分量 ${k} 应单调逼近`);
    }
  }
});

test('⑧ cancel 停止动画且不再回调', () => {
  const d = motion.manualDriver();
  const samples = [];
  let settled = 0;
  const hh = motion.spring({
    from: 0, to: 100, damping: 1.0, response: 0.4, driver: d,
    onUpdate: v => samples.push(v), onSettle: () => settled++
  });
  run(hh, d, 5);
  const n = samples.length;
  hh.cancel();
  run(hh, d, 50);
  assert.strictEqual(samples.length, n, 'cancel 后不得再有 onUpdate');
  assert.strictEqual(settled, 0, 'cancel 不触发 onSettle');
});
