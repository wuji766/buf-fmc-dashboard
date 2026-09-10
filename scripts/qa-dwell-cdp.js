/* dwell 可配置 QA driver: CDP (raw WebSocket, Node>=22) 实测
 *  A. index.html（清空 localStorage 后）—— 胶囊渲染/默认 5 分钟/弹层展开/选择 1 分钟：
 *     立即生效（倒计时按新值）+ 1 分钟节奏真实切页 + localStorage 写入
 *  B. reload —— 记住选择
 *  C. ?dwell=300000 —— URL 优先并写入 localStorage；?dwell=0 非法防护（不采用、落回存量值）
 *  D. menu.html —— 三张非 QA 卡片选择器共享偏好，改 2 分钟同步卡片 URL，点卡片带入
 *  E. ?qa=1 —— 设置控件不渲染
 * 截图：web/qa-dwell-open.png / qa-dwell-applied.png / qa-dwell-menu.png / qa-dwell-qa.png
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9336;
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
    const click = async (x, y) => {
      await mouse('mousePressed', x, y, { clickCount: 1, buttons: 1 });
      await mouse('mouseReleased', x, y, { clickCount: 1, buttons: 0 });
    };
    const clickSel = async sel => {
      const p = await center(sel);
      if (!p) throw new Error('no element: ' + sel);
      await click(p.x, p.y);
    };
    const center = async sel => evaljs(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    const btnText = () => evaljs(`document.querySelector('.dwell-btn') ? document.querySelector('.dwell-btn').textContent : null`);
    const stored = () => evaljs(`localStorage.getItem('buf.dwell')`);
    const countdown = async () => { // 解析“下一页 m:ss”剩余秒数
      const t = await evaljs(`document.getElementById('carouselState').textContent`);
      const m = /下一页\s+(\d+):(\d\d)/.exec(t || '');
      return m ? +m[1] * 60 + +m[2] : null;
    };
    const onIdx = () => evaljs(`(() => {
      const bs = document.querySelectorAll('#pager .pgBtn');
      for (let i = 0; i < bs.length; i++) if (bs[i].classList.contains('on')) return i;
      return -1;
    })()`);
    const nav = async url => { await send('Page.navigate', { url }); await sleep(2500); };

    await send('Page.enable');

    /* ================= A. 胶囊：默认值 / 展开 / 选 1 分钟 / 立即生效 ================= */
    await nav(BASE + '/index.html?alarmRate=0');
    await evaljs(`localStorage.clear()`);           // 确定性起点：清掉残留
    await nav(BASE + '/index.html?alarmRate=0');

    check('A1 胶囊渲染且默认 5 分钟（无存储时用 config.dwell）',
      await btnText() === '轮播 5 分钟', await btnText());
    check('A2 无存储时未写 localStorage', (await stored()) == null, String(await stored()));
    const cd0 = await countdown();
    check('A3 状态条倒计时按 5 分钟基准（240-300s）', cd0 != null && cd0 > 239 && cd0 <= 300, '剩余 ' + cd0 + 's');

    await clickSel('.dwell-btn');
    await sleep(300);
    const menuOpen = await evaljs(`(() => {
      const p = document.querySelector('.dwell-menu');
      return { hidden: p.classList.contains('hidden'), opts: p.querySelectorAll('.dwell-opt').length,
               on: (p.querySelector('.dwell-opt.on') || {}).textContent };
    })()`);
    check('A4 点击胶囊展开 8 个选项且高亮当前值', !menuOpen.hidden && menuOpen.opts === 8 && menuOpen.on === '5 分钟',
      JSON.stringify(menuOpen));
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-dwell-open.png'), Buffer.from(shot1.result.data, 'base64'));

    await clickSel('.dwell-opt');   // 第一个选项 = 1 分钟
    await sleep(400);
    check('A5 选 1 分钟：胶囊文案更新', await btnText() === '轮播 1 分钟', await btnText());
    check('A6 选择后写入 localStorage=60000', (await stored()) === '60000', String(await stored()));
    const cd1 = await countdown();
    check('A7 倒计时立即按新值显示（≤60s 且未到 0）', cd1 != null && cd1 > 0 && cd1 <= 60, '剩余 ' + cd1 + 's');
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-dwell-applied.png'), Buffer.from(shot2.result.data, 'base64'));

    /* 真实切页节奏：页 0 自加载起 60s 到期 → 1 分钟内必然翻页 */
    const startIdx = await onIdx();
    let switched = false, t0 = Date.now();
    while (Date.now() - t0 < 75000) {
      if ((await onIdx()) !== startIdx) { switched = true; break; }
      await sleep(2000);
    }
    check('A8 setDwell 立即生效：1 分钟节奏真实切页（页 ' + startIdx + '→' + (await onIdx()) + '）',
      switched && (await onIdx()) !== startIdx);
    const cd2 = await countdown();
    check('A9 切页后倒计时按 1 分钟重新计（接近 60s）', cd2 != null && cd2 >= 55 && cd2 <= 60, '剩余 ' + cd2 + 's');

    /* ================= B. 刷新记住 ================= */
    await nav(BASE + '/index.html?alarmRate=0');
    check('B1 刷新后记住选择（轮播 1 分钟）', await btnText() === '轮播 1 分钟', await btnText());
    const cdB = await countdown();
    check('B2 刷新后倒计时按 1 分钟基准（≤60s）', cdB != null && cdB > 0 && cdB <= 60, '剩余 ' + cdB + 's');

    /* ================= C. URL 优先 / 非法防护 ================= */
    await nav(BASE + '/index.html?dwell=300000');
    check('C1 URL ?dwell 优先于 localStorage（显示 5 分钟）', await btnText() === '轮播 5 分钟', await btnText());
    check('C2 URL 显式指定时写入 localStorage=300000', (await stored()) === '300000', String(await stored()));
    await nav(BASE + '/index.html?dwell=0');
    check('C3 ?dwell=0 非法防护：不采用，落回存量 300000', await btnText() === '轮播 5 分钟', await btnText() + ' / store=' + await stored());

    /* ================= D. 菜单页：选择器共享 + 带入 ?dwell ================= */
    await nav(BASE + '/menu.html');
    const menuInit = await evaljs(`(() => ({
      sel: document.querySelectorAll('.mc-dwell').length,
      v: document.querySelectorAll('.mc-dwell')[0].value,
      href1: document.querySelectorAll('.menu-card[data-base]')[0].getAttribute('href'),
      stored: localStorage.getItem('buf.dwell')
    }))()`);
    check('D1 菜单三张非 QA 卡片各有选择器且初值=共享存储（5 分钟）',
      menuInit.sel === 3 && menuInit.v === '5' && menuInit.stored === '300000', JSON.stringify(menuInit));
    check('D2 卡片 URL 已带 ?dwell=300000', /dwell=300000$/.test(menuInit.href1), menuInit.href1);

    /* 模拟用户把第一张卡片改为 2 分钟（合成 change 事件驱动真实处理器） */
    await evaljs(`(() => {
      const s = document.querySelectorAll('.mc-dwell')[0];
      s.value = '2';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(300);
    const menuChg = await evaljs(`(() => ({
      vs: Array.from(document.querySelectorAll('.mc-dwell')).map(s => s.value),
      hrefs: Array.from(document.querySelectorAll('.menu-card[data-base]')).map(a => a.getAttribute('href')),
      stored: localStorage.getItem('buf.dwell')
    }))()`);
    check('D3 改 2 分钟：全部选择器同步', menuChg.vs.join(',') === '2,2,2', menuChg.vs.join(','));
    check('D4 全部卡片 URL 带 dwell=120000', menuChg.hrefs.every(h => /dwell=120000/.test(h)), menuChg.hrefs.join(' | '));
    check('D5 选择持久化 localStorage=120000', menuChg.stored === '120000', menuChg.stored);
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-dwell-menu.png'), Buffer.from(shot3.result.data, 'base64'));

    await clickSel('.menu-card[data-base] .mc-name');  // 点第一张卡片（避开选择行）
    await sleep(2500);
    const d6search = await evaljs(`location.search`);
    check('D6 点击卡片以 ?dwell=120000 带入监控页（胶囊显示 2 分钟）',
      /dwell=120000/.test(d6search) && await btnText() === '轮播 2 分钟',
      d6search + ' / ' + await btnText());

    /* ================= E. ?qa=1 不渲染 ================= */
    await nav(BASE + '/index.html?qa=1');
    const qa = await evaljs(`(() => ({
      ctl: !!document.querySelector('.dwell-ctl'),
      slotChildren: document.getElementById('dwellSlot') ? document.getElementById('dwellSlot').children.length : -1
    }))()`);
    check('E1 ?qa=1 设置控件不渲染（无 .dwell-ctl，槽位为空）', !qa.ctl && qa.slotChildren === 0, JSON.stringify(qa));
    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-dwell-qa.png'), Buffer.from(shot4.result.data, 'base64'));

    ws.close();
  } finally {
    chrome.kill();
  }
  console.log('SUMMARY pass=' + R.pass.length + ' fail=' + R.fail.length);
  if (R.fail.length) { console.log('FAILURES:\n - ' + R.fail.join('\n - ')); process.exitCode = 1; }
}
main().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; });
