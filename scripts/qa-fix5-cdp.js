/* fix5 QA driver: CDP (raw WebSocket, Node>=22) 实测报警信息条 rAF 滚动
 * 打开 index.html?alarmRate=1，观察 35s+，采样：
 *  - 信息条出现、两份 .alarm-copy 内容一致
 *  - transform 相位单调递增且始终 < 单份实测宽度（取模无缝）
 *  - 报警列表变化时（自动解除/新增）相位归零重建，无跳变残留
 *  - 抓两张截图（滚动中、内容变化后）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const OUT = p => path.join(__dirname, '..', 'web', p);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-first-run', `--remote-debugging-port=${PORT}`,
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9',
    '--window-size=1920,1080', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    // 等 DevTools 端口
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

    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html?alarmRate=1' });
    await sleep(4000);

    const probe = () => evaljs(`(() => {
      const el = document.getElementById('alarmBar');
      const run = el && el.querySelector('.alarm-run');
      const copies = el ? el.querySelectorAll('.alarm-copy') : [];
      const items = el ? el.querySelectorAll('.alarm-item') : [];
      return {
        cls: el ? el.className : null,
        copies: copies.length,
        copyW: copies[0] ? copies[0].offsetWidth : 0,
        sameContent: copies.length === 2 && copies[0].innerHTML === copies[1].innerHTML,
        nItems: items.length,
        text: items.length ? items[0].textContent.slice(0, 40) : '',
        transform: run ? (run.style.transform || '') : null
      };
    })()`);

    const phaseOf = t => t ? parseFloat((/translateX\((-?[\d.]+)px\)/.exec(t) || [0, 0])[1]) : null;

    // 阶段 1：等待报警出现，观察滚动相位（采样 ~15s）
    let p0 = await probe();
    const t0 = Date.now();
    console.log('[t=0]', JSON.stringify(p0));
    const samples1 = [];
    while (Date.now() - t0 < 15000) {
      await sleep(2000);
      const p = await probe();
      samples1.push(phaseOf(p.transform));
      console.log('[sample]', p.cls, p.transform, 'items=' + p.nItems, 'copyW=' + p.copyW, 'same=' + p.sameContent);
    }
    // 阶段 2：截图（滚动中）
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-fix5-bar.png'), Buffer.from(shot1.result.data, 'base64'));
    console.log('screenshot 1 written');

    // 阶段 3：等报警列表变化（20s 自动解除 + 高概率新增），观察重建
    let changed = false; const samples2 = [];
    const t1 = Date.now(); let lastItems = p0.nItems, lastText = p0.text;
    while (Date.now() - t1 < 30000) {
      await sleep(3000);
      const p = await probe();
      samples2.push(phaseOf(p.transform));
      if (p.nItems !== lastItems || p.text !== lastText) { changed = true; console.log('[rebuild detected] items', lastItems, '->', p.nItems); lastItems = p.nItems; lastText = p.text; }
      console.log('[sample2]', p.transform, 'items=' + p.nItems);
    }
    // 重建后相位应从 0 附近重新开始且仍 < copyW
    const pLast = await probe();
    const all = samples1.concat(samples2).filter(v => v != null);
    const maxPhase = Math.max.apply(null, all.map(Math.abs));
    const copyW = pLast.copyW || (await probe()).copyW;

    console.log('RESULT', JSON.stringify({
      barShown: p0.cls === '' || pLast.cls === '',
      copiesAlways2: [p0, pLast].every(p => p.copies === 2),
      sameContent: pLast.sameContent,
      scrolled: maxPhase > 50,
      phaseBoundedByCopyW: all.every(v => Math.abs(v) <= copyW + 1),
      copyW, maxPhase,
      listChangedDuringWatch: changed,
      finalItems: pLast.nItems
    }, null, 1));

    // 截图 2（变化后）
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-fix5-bar2.png'), Buffer.from(shot2.result.data, 'base64'));

    // menu.html 抓图 + index 菜单链接检查
    await send('Page.navigate', { url: 'http://127.0.0.1:8931/menu.html' });
    await sleep(1500);
    const cards = await evaljs(`document.querySelectorAll('.menu-card').length`);
    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(OUT('qa-fix5-menu.png'), Buffer.from(shot3.result.data, 'base64'));
    await send('Page.navigate', { url: 'http://127.0.0.1:8931/index.html' });
    await sleep(2500);
    const link = await evaljs(`(() => { const a = document.getElementById('menuLink'); return a ? a.getAttribute('href') : null; })()`);
    console.log('MENU', JSON.stringify({ cards, menuLink: link }));
    ws.close();
  } finally {
    chrome.kill();
  }
}
main().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
