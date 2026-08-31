const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'convert.js'), 'utf8');
const cut = src.indexOf('// ---- 主流程 ----');
const mod = { exports: {} };
new Function('require', '__dirname', 'module', src.slice(0, cut) + '\nmodule.exports={parseSheet,build};')(require, __dirname, mod);
const { parseSheet } = mod.exports;
const sheet = parseSheet(path.join(__dirname, '..', 'data', 'sheet-L20.xml'));
const { xs, ys, styles, cells } = sheet;
const targets = ['RJK-01CL', 'RJK-03CL', 'RJK-02CL', 'RJK-04CL', 'BUF-01C01', 'BUF-02C05', 'BUF-03C01'];
for (const cell of cells) {
  if (!targets.includes(cell.v)) continue;
  const st = styles[cell.style];
  const c1 = cell.c + cell.ma, r1 = cell.r + cell.md;
  console.log(JSON.stringify({
    v: cell.v, r: cell.r, c: cell.c, ma: cell.ma, md: cell.md,
    box: { x: +xs[cell.c].toFixed(2), y: +ys[cell.r].toFixed(2), w: +(xs[c1 + 1] - xs[cell.c]).toFixed(2), h: +(ys[r1 + 1] - ys[cell.r]).toFixed(2) },
    rotate: st.rotate, size: st.size, fill: st.fill,
  }));
}
// 对应区域内的填充矩形（elements json）
const el = require('../data/elements-L20.json');
for (const t of targets) {
  const near = el.texts.find(x => x.content === t);
  console.log('text', t, '=>', JSON.stringify(near));
}
for (const f of el.fills) {
  if (f.y < 200 && f.h > 30 && f.h < 80) console.log('fill top area:', JSON.stringify(f));
}
