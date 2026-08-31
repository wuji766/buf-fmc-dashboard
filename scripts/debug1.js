const fs = require('fs');
const xml = fs.readFileSync('data/sheet-L20.xml', 'utf8');
const tblM = xml.match(/<Table([^>]*)>/);
console.log('Table attrs:', tblM && tblM[1]);
if (tblM) {
  const TA = {};
  for (const m of tblM[1].matchAll(/ss:(\w+)="([^"]*)"/g)) TA[m[1]] = m[2];
  console.log('TA:', TA);
}
// 检查 Row 正则匹配数
console.log('row matches:', (xml.match(/<Row\s*([^>]*)>/g) || []).length);
// 检查 Column
console.log('column matches:', (xml.match(/<Column\s+([^>]*)\/>/g) || []).length);
// ss:Width 样例
for (const m of xml.matchAll(/<Column\s+([^>]*)\/>/g).slice ? [] : []) { }
const cols = [...xml.matchAll(/<Column\s+([^>]*)\/>/g)].map(m => m[1]);
console.log('first cols:', cols.slice(0, 5));
// 有没有 ss:AutoFitWidth 但无 Width 的列
console.log('cols without Width:', cols.filter(c => !c.includes('ss:Width')).length);
// Unit 检查
const unit = xml.match(/ss:Unit="([^"]+)"/);
console.log('unit attr:', unit && unit[1]);
