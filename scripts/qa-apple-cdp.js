/* apple-design QA driver: CDP (raw WebSocket, Node>=22) 实测手势与材质
 * file:// 直开（纯静态、普通 script 顺序加载，无 ESM/fetch）。
 * 分两段：
 *  A. index.html?alarmRate=0 —— 无报警干扰，验手势：拖拽 1:1 / 惯性 / 滚轮 spring / 双击复位 / 材质 / 排印
 *  B. index.html?alarmRate=1 —— 新加载立即轮询，验报警条 materialize 动画 / 材质 / marquee / alarm-pulse
 * 截图：web/qa-apple-hud.png / qa-apple-alarm.png / qa-apple-menu.png
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const OUT = p => path.join(__dirname, '..', 'web', p);
const BASE = 'file:///C:/Users/wuji/ZCodeProject/buf-fmc-dashboard/web';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { pass: [], fail: [] };
function check(name, ok, detail) {
  (ok ? R.pass : R.fail).push(name + (detail ? ' — ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-first-run', `--remote-debugging-port=${PORT}`,
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9',
    '--window-size=1920,1080', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let list;
    for (let i = 0; i < 50; i++) {
      try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; }
      catch (e) { await sleep(200); }
    }
    if (!list) throw new Error('devtools port not up');

    const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    const send = (method, params = {}) => new Promise(res => {
      const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evaljs = async (expr, awaitPromise = false) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
      return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const mouse = (type, x, y, extra = {}) =>
      send('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'left' }, extra));
    const getVB = () => evaljs(`(document.getElementById('board').getAttribute('viewBox')||'').split(/\\s+/).map(Number)`);
    const settleVB = async () => {
      let prev = await getVB();
      for (let i = 0; i < 25; i++) {
        await sleep(250);
        const v = await getVB();
        if (v.every((n, k) => Math.abs(n - prev[k]) < 0.01)) return v;
        prev = v;
      }
      return prev;
    };

    /* ================= A. 无报警页：手势 ================= */
    await send('Page.enable');
    await send('Page.navigate', { url: BASE + '/index.html?alarmRate=0' });
    await sleep(3000);

    /* 材质计算样式 */
    const mat = await evaljs(`(() => {
      const g = id => { const cs = getComputedStyle(document.getElementById(id));
        return { bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter }; };
      return { hud: g('hud'), status: g('statusBar'), legend: g('legend') };
    })()`);
    check('材质: #hud 半透明基材', mat.hud.bg === 'rgba(18, 24, 34, 0.62)', mat.hud.bg);
    check('材质: #hud backdrop blur(28px)', /blur\(28px\)/.test(mat.hud.bf), mat.hud.bf);
    check('材质: #statusBar blur(20px)', /blur\(20px\)/.test(mat.status.bf), mat.status.bf);
    check('材质: #legend blur(20px)', /blur\(20px\)/.test(mat.legend.bf), mat.legend.bf);

    /* 排印 */
    const typo = await evaljs(`(() => {
      const pn = getComputedStyle(document.getElementById('pageName'));
      const sb = getComputedStyle(document.getElementById('statusBar'));
      return { ls: pn.letterSpacing, fvn: sb.fontVariantNumeric };
    })()`);
    check('排印: #pageName 负 tracking', parseFloat(typo.ls) < 0, typo.ls);
    check('排印: #statusBar tabular-nums', typo.fvn.includes('tabular-nums'), typo.fvn);

    const basis = await evaljs(`(() => {
      const p = BUF.render.page(BUF.render.cur());
      return p.vb || [0, 0, p.W, p.H];
    })()`);

    /* 滚轮单档缩放（弹簧逼近目标 ×1.1，非瞬时） */
    const vbZ0 = await getVB();
    await mouse('mouseWheel', 960, 540, { deltaX: 0, deltaY: -120 });
    await sleep(80);
    const vbZMid = await getVB();
    check('滚轮: 首帧未瞬时到位（spring 渐进）', Math.abs(vbZMid[2] - vbZ0[2] / 1.1) > vbZ0[2] * 0.005,
      `w ${vbZ0[2].toFixed(1)} → 80ms ${vbZMid[2].toFixed(1)} 目标 ${(vbZ0[2] / 1.1).toFixed(1)}`);
    const vbZ = await settleVB();
    check('滚轮: settle 到 ×1.1 目标', Math.abs(vbZ[2] - vbZ0[2] / 1.1) < vbZ0[2] * 0.01,
      `w=${vbZ[2].toFixed(2)} 目标=${(vbZ0[2] / 1.1).toFixed(2)}`);
    /* 连续两档：目标在目标上累乘 ×1.1²（retarget 不截断，从当前值续接） */
    await mouse('mouseWheel', 960, 540, { deltaX: 0, deltaY: -120 });
    await sleep(60);
    await mouse('mouseWheel', 960, 540, { deltaX: 0, deltaY: -120 });
    const vbZ2 = await settleVB();
    check('滚轮: 连续两档 settle 到 ×1.331（retarget 累乘）', Math.abs(vbZ2[2] - vbZ0[2] / 1.331) < vbZ0[2] * 0.01,
      `w=${vbZ2[2].toFixed(2)} 目标=${(vbZ0[2] / 1.331).toFixed(2)}`);

    /* 拖拽 1:1（已放大、视图在边界内：无 rubber-band 压缩，应严格 1:1） */
    const vb0 = await getVB();
    const scale = await evaljs(`(() => {
      const svg = document.getElementById('board');
      const r = svg.getBoundingClientRect();
      const v = svg.getAttribute('viewBox').split(/\\s+/).map(Number);
      return Math.min(r.width / v[2], r.height / v[3]);
    })()`);
    await mouse('mousePressed', 960, 540, { clickCount: 1, buttons: 1 });
    await mouse('mouseMoved', 1000, 540, { buttons: 1 });
    await mouse('mouseMoved', 1060, 540, { buttons: 1 });
    await mouse('mouseMoved', 1120, 540, { buttons: 1 });
    await sleep(60);
    const vbDrag = await getVB();
    const dxExpected = -(1120 - 960) / scale;
    const dxActual = vbDrag[0] - vb0[0];
    check('拖拽 1:1: 拖动中 viewBox 跟随', Math.abs(dxActual - dxExpected) < Math.abs(dxExpected) * 0.2 + 1,
      `期望 Δx=${dxExpected.toFixed(2)} 实际 Δx=${dxActual.toFixed(2)}`);
    const uo = await evaljs(`window.BUF.zoom.userOverride()`);
    check('拖拽置 userOverride', uo === true);
    await mouse('mouseReleased', 1120, 540, { clickCount: 1, buttons: 0 }); // 收尾真实拖拽
    await sleep(1200); // 低速回弹 spring 落定

    /* 惯性（页内合成 PointerEvent + 受控假时钟——本 headless 环境 performance.now()
     * 按 ~300ms 量化冻结，任何真实 pacing 都不可靠；stub performance.now 注入确定性
     * 时间戳，驱真实处理器：速度窗口 → 惯性分支 → 投影 → spring 接管） */
    const rel = await evaljs(`(() => {
      const svg = document.getElementById('board');
      const orig = performance.now.bind(performance);
      let fakeT = 1000000;
      performance.now = () => fakeT;
      const pe = (type, x) => svg.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: 540, button: 0, bubbles: true }));
      pe('pointerdown', 900);
      fakeT += 16; pe('pointermove', 920);
      fakeT += 16; pe('pointermove', 960);
      fakeT += 16; pe('pointermove', 1020);
      fakeT += 16; pe('pointermove', 1080);
      fakeT += 10; pe('pointerup', 1080);
      const r = window.BUF.zoom._state().lastRelease;
      performance.now = orig;
      return r;
    })()`);
    check('惯性: 释放速度超阈值（走惯性投影分支）', rel && rel.speed > 50,
      `speed=${rel ? rel.speed.toFixed(0) : 'null'} u/s vx=${rel ? rel.vx.toFixed(0) : '-'}`);
    const vbF0 = await getVB();
    await sleep(120); // 早采样：惯性前冲段（Node 侧时钟可靠）
    const vbF1 = await getVB();
    check('惯性: 松手后继续同向滑动', vbF1[0] < vbF0[0] - 0.5, `释放 ${vbF0[0].toFixed(1)} → 120ms 后 ${vbF1[0].toFixed(1)}`);
    const vbSettle = await settleVB();
    const loxF = Math.min(basis[0], basis[0] + basis[2] - vbSettle[2]);
    const hixF = Math.max(basis[0], basis[0] + basis[2] - vbSettle[2]);
    check('惯性: settle 在边界内（无越界滞留）', vbSettle[0] >= loxF - 0.5 && vbSettle[0] <= hixF + 0.5,
      `x=${vbSettle[0].toFixed(1)} ∈ [${loxF.toFixed(1)}, ${hixF.toFixed(1)}]`);

    /* 报警相机（合成目标，无报警页不受自动取景干扰；Node pacing 采样）：focus spring 渐进 + settle 精确 */
    const camTarget = await evaljs(`(() => {
      const p = BUF.render.page(BUF.render.cur());
      const b = p.vb || [0, 0, p.W, p.H];
      const t = [b[0], b[1], b[2] * 0.6, b[3] * 0.6];
      BUF.alarm.focus(BUF.render.cur(), t);
      return t;
    })()`);
    const camW0 = (await getVB())[2];
    await sleep(150);
    const camWMid = (await getVB())[2];
    const camSettle = await settleVB();
    check('报警相机: focus spring 渐进（中途值介于起点与目标）', camWMid > camTarget[2] + 1 && camWMid < camW0 - 1,
      `w0=${camW0.toFixed(1)} mid=${camWMid.toFixed(1)} target=${camTarget[2].toFixed(1)}`);
    check('报警相机: settle 精确吸附目标', Math.abs(camSettle[2] - camTarget[2]) < 0.5,
      `last=${camSettle[2].toFixed(2)} target=${camTarget[2].toFixed(2)}`);

    /* 双击复位（spring 回页基准） */
    await mouse('mousePressed', 960, 540, { clickCount: 1, buttons: 1 });
    await mouse('mouseReleased', 960, 540, { clickCount: 1, buttons: 0 });
    await sleep(50);
    await mouse('mousePressed', 960, 540, { clickCount: 2, buttons: 1 });
    await mouse('mouseReleased', 960, 540, { clickCount: 2, buttons: 0 });
    const vbR = await settleVB();
    check('双击: 复位到页基准', Math.abs(vbR[0] - basis[0]) < 1 && Math.abs(vbR[1] - basis[1]) < 1 && Math.abs(vbR[2] - basis[2]) < 1,
      `vb=[${vbR.map(n => n.toFixed(1)).join(',')}] basis=[${basis.map(n => (+n).toFixed(1)).join(',')}]`);
    check('双击: 解除 userOverride', (await evaljs(`window.BUF.zoom.userOverride()`)) === false);

    /* 页面切换位移：当前页 g.page 初始 translateY(6px) → 0 */
    const pgTr = await evaljs(`(() => {
      const g = document.querySelector('#board .page:not([display])') || document.querySelector('#board .page');
      return { opacity: g.getAttribute('opacity'), tr: g.style.transform || '' };
    })()`);
    check('切页: 进入页 opacity/transform 过渡到位', pgTr.opacity === '1' && /translateY\(0/.test(pgTr.tr), JSON.stringify(pgTr));

    /* 报警条在无报警页保持隐藏（高度 0） */
    const barHidden = await evaljs(`(() => {
      const el = document.getElementById('alarmBar');
      return { hidden: el.classList.contains('hidden'), h: el.offsetHeight };
    })()`);
    check('报警条: 无报警时 hidden 且高度 0（materialize 消失态）', barHidden.hidden && barHidden.h === 0, JSON.stringify(barHidden));

    /* 截图 1：材质 HUD */
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-apple-hud.png'), Buffer.from(shot1.result.data, 'base64'));

    /* ================= B. 报警页：materialize + 相机 spring ================= */
    await send('Page.navigate', { url: BASE + '/index.html?alarmRate=1' });
    let barSeen = false, barAnim = false, copies2 = false, sameContent = false, pulse = false, barMat = null;
    let lastHidden = true;
    const trace = []; // materialize 采样轨迹（调试输出）
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      const b = await evaljs(`(() => {
        const el = document.getElementById('alarmBar');
        if (!el) return null;
        const cs = getComputedStyle(el);
        const copies = el.querySelectorAll('.alarm-copy');
        return {
          hidden: el.classList.contains('hidden'),
          h: el.offsetHeight, opacity: parseFloat(cs.opacity),
          bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter,
          copies: copies.length,
          same: copies.length === 2 && copies[0].innerHTML === copies[1].innerHTML,
          pulse: !!document.querySelector('.alarm-pulse')
        };
      })()`);
      if (b && !b.hidden) {
        barSeen = true;
        if (trace.length < 12) trace.push(b.h);
        if (b.h > 0 && b.h < 40) barAnim = true; // 捕获高度动画中间帧
        if (!barMat && b.h >= 38) barMat = b;
        if (b.copies === 2) copies2 = true;
        if (b.same) sameContent = true;
        if (b.pulse) pulse = true;
        if (barAnim && barMat && copies2 && sameContent && pulse) break;
      }
      if (b) lastHidden = b.hidden;
      await sleep(50);
    }
    console.log('[materialize trace]', trace.join(' → '));
    check('报警条: 出现', barSeen);
    /* materialize 高度+透明度动画：合成翻转 + Web Animations API 核验（Node pacing；
     * 屏蔽 snapshot 的 className 回写干扰；getAnimations 直接证明 height/opacity 过渡启动） */
    const animsOf = `document.getElementById('alarmBar').getAnimations()
      .filter(a => a.transitionProperty)
      .map(a => a.transitionProperty + ':' + a.playState)`;
    await evaljs(`(() => { window.__origBar = BUF.alarm.bar; BUF.alarm.bar = function () {};
      document.getElementById('alarmBar').classList.add('hidden'); })()`);
    await sleep(80);
    const colAnims = await evaljs(animsOf);
    const colH = await evaljs(`document.getElementById('alarmBar').offsetHeight`);
    await sleep(700); // 等收起完成
    await evaljs(`document.getElementById('alarmBar').classList.remove('hidden')`);
    await sleep(80);
    const expAnims = await evaljs(animsOf);
    const expH = await evaljs(`document.getElementById('alarmBar').offsetHeight`);
    await evaljs(`BUF.alarm.bar = window.__origBar`);
    /* 高度轨迹补采（throttle 下仅作日志佐证；判定以 getAnimations 为准——
     * 过渡已注册运行即证明 materialize 动画生效，高度中间帧依赖布局帧节奏不可靠） */
    const colTrace = await evaljs(`(() => {
      const el = document.getElementById('alarmBar');
      el.classList.add('hidden');
      const hs = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 380) { const h = el.offsetHeight; if (hs[hs.length-1] !== h) hs.push(h); }
      el.classList.remove('hidden');
      return hs.join('→');
    })()`);
    const animOK = list => list.some(s => /^height:(running|pending)/.test(s)) &&
                           list.some(s => /^opacity:(running|pending)/.test(s));
    console.log('[collapse busy-sample]', colTrace);
    check('报警条: materialize 收起动画（height+opacity 过渡运行中）', animOK(colAnims),
      JSON.stringify(colAnims) + ' trace=' + colTrace);
    check('报警条: materialize 展开动画（height+opacity 过渡运行中）', animOK(expAnims),
      JSON.stringify(expAnims) + ' h@80ms=' + expH);
    if (barMat) {
      check('报警条: 材质 rgba(18,24,34,0.62)+blur', barMat.bg === 'rgba(18, 24, 34, 0.62)' && /blur\(20px\)/.test(barMat.bf),
        `${barMat.bg} / ${barMat.bf}`);
    }
    check('报警条: 两份 copy 内容一致（marquee 无缝）', copies2 && sameContent);
    check('报警: alarm-pulse 保留', pulse);

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-apple-alarm.png'), Buffer.from(shot2.result.data, 'base64'));

    /* 用户输入打断报警相机（§3）：页内合成事件 + 同步读取 userOverride（避免 snapshot 竞态） */
    const interrupt = await evaljs(`(() => {
      const svg = document.getElementById('board');
      const pe = (type, x) => svg.dispatchEvent(new PointerEvent(type, { pointerId: 9, clientX: x, clientY: 540, button: 0, bubbles: true }));
      pe('pointerdown', 960);
      pe('pointermove', 1100);
      pe('pointermove', 1240);
      const uo = BUF.zoom.userOverride(); // 移动越阈值后同步读取：应已接管
      const vb = svg.getAttribute('viewBox');
      pe('pointerup', 1240);
      return { uo, vb };
    })()`);
    check('打断: 拖拽期间报警相机被接管（userOverride）', interrupt.uo === true, JSON.stringify(interrupt));

    /* ================= C. 菜单页 ================= */
    await send('Page.navigate', { url: BASE + '/menu.html' });
    await sleep(1200);
    const menu = await evaljs(`(() => {
      const c = document.querySelector('.menu-card');
      const cs = getComputedStyle(c);
      const t = getComputedStyle(document.querySelector('.menu-title'));
      return {
        cards: document.querySelectorAll('.menu-card').length,
        anim: cs.animationName, delay1: cs.animationDelay,
        delay4: getComputedStyle(document.querySelectorAll('.menu-card')[3]).animationDelay,
        titleLS: t.letterSpacing
      };
    })()`);
    check('菜单: 卡片 stagger 入场动画', menu.anim === 'menu-card-in' && menu.delay4 !== menu.delay1,
      `anim=${menu.anim} delay1=${menu.delay1} delay4=${menu.delay4}`);
    check('菜单: 标题负 tracking', parseFloat(menu.titleLS) < 0, menu.titleLS);
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-apple-menu.png'), Buffer.from(shot3.result.data, 'base64'));

    ws.close();
  } finally {
    chrome.kill();
  }
  console.log('SUMMARY pass=' + R.pass.length + ' fail=' + R.fail.length);
  if (R.fail.length) { console.log('FAILURES:\n - ' + R.fail.join('\n - ')); process.exitCode = 1; }
}
main().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; });
