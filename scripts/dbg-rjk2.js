const path = require('path'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, 'convert.js'), 'utf8');
const cut = src.indexOf('// ---- 主流程 ----');
const mod = { exports: {} };
new Function('require', '__dirname', 'module', src.slice(0, cut) + '\nmodule.exports={parseSheet,build};')(require, __dirname, mod);
const { parseSheet } = mod.exports;
const sheet = parseSheet(path.join(__dirname, '..', 'data', 'sheet-L20.xml'));
const { xs, ys, styles, cells } = sheet;
// 打印 r50..r58, c36..c52 的单元格样式与合并
for (const cell of cells) {
  if (cell.r < 50 || cell.r > 58 || cell.c < 36 || cell.c > 52) continue;
  const st = styles[cell.style] || {};
  const c1 = cell.c + cell.ma, r1 = cell.r + cell.md;
  console.log(`r${cell.r}c${cell.c} ma=${cell.ma} md=${cell.md} v=${JSON.stringify(cell.v)} fill=${st.fill} rot=${st.rotate} box=${(xs[cell.c]).toFixed(1)},${(ys[cell.r]).toFixed(1)},${(xs[c1+1]-xs[cell.c]).toFixed(1)}x${(ys[r1+1]-ys[cell.r]).toFixed(1)}`);
}
