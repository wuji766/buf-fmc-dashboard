const fs = require('fs');
const els = JSON.parse(fs.readFileSync('data/elements-L20.json', 'utf8'));
console.log('W,H =', els.W.toFixed(1), els.H.toFixed(1));
console.log('shapes:', JSON.stringify(els.shapes, null, 1).slice(0, 1500));
// BUF-01 相关
const site = els.fills.filter(f => f.name.includes('BUF-01'));
console.log('\nBUF-01 fills:', JSON.stringify(site, null, 1));
const t = els.texts.filter(x => x.content.includes('BUF-01'));
console.log('\nBUF-01 texts:', JSON.stringify(t.slice(0, 6), null, 1));
// 旋转文字统计
const rot = { 0: 0, 90: 0, 270: 0 };
for (const x of els.texts) rot[x.rot] = (rot[x.rot] || 0) + 1;
console.log('\nrotation dist:', rot);
// 图例
console.log('\nlegend:', JSON.stringify(els.texts.filter(x => /举例/.test(x.content))));
// 填色矩形颜色统计
const cc = {};
for (const f of els.fills) cc[f.color] = (cc[f.color] || 0) + 1;
console.log('\nfill colors:', cc);
// 颜色面积统计
const area = {};
for (const f of els.fills) area[f.color] = (area[f.color] || 0) + Math.round(f.w * f.h);
console.log('fill areas:', area);
