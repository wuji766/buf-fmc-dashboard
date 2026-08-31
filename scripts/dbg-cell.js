const path = require('path');
const fs = require('fs');
// 复用 convert.js 的解析函数：直接 require 会执行主流程，改为读源码 eval 提取
const src = fs.readFileSync(path.join(__dirname, 'convert.js'), 'utf8');
const cut = src.indexOf('// ---- 主流程 ----');
const mod = { exports: {} };
new Function('require', '__dirname', 'module', src.slice(0, cut) + '\nmodule.exports={parseSheet,build};')
  (require, __dirname, mod);
const { parseSheet, build } = mod.exports;
const sheet = parseSheet(path.join(__dirname, '..', 'data', 'sheet-L20.xml'));
for (const cell of sheet.cells) {
  if (cell.v === 'CAK-01CL') {
    const st = sheet.styles[cell.style];
    const xs = sheet.xs, ys = sheet.ys;
    const c1 = cell.c + cell.ma, r1 = cell.r + cell.md;
    console.log('cell', JSON.stringify({ r: cell.r, c: cell.c, ma: cell.ma, md: cell.md }));
    console.log('style', JSON.stringify(st));
    console.log('box', { bx: xs[cell.c], by: ys[cell.r], bw: xs[c1 + 1] - xs[cell.c], bh: ys[r1 + 1] - ys[cell.r] });
  }
}
const built = build(sheet);
console.log('built:', JSON.stringify(built.texts.find(t => t.content === 'CAK-01CL')));
