// 检查 sheet-L20.xml 结构：样式、合并、边框、文字方向、行列宽度
const fs = require('fs');
const xml = fs.readFileSync('C:\\Users\\wuji\\ZCodeProject\\buf-fmc-dashboard\\data\\sheet-L20.xml', 'utf8');

// 1) 样式概览
const styles = xml.match(/<Style[^>]*\/?>(?:(?!<\/Style>).)*<\/Style>|<Style[^>]*\/>/gs) || [];
console.log('style count:', styles.length);
const interesting = styles.filter(s => /Interior[^>]*ss:Color|Rotate|VerticalText|ss:Bold/.test(s));
console.log('styles with fill/rotate/bold:', interesting.length);
// 打印前 8 个有填充或旋转的样式
for (const s of interesting.slice(0, 8)) console.log('---\n' + s.replace(/\s+/g, ' ').slice(0, 400));

// 2) Rotate / VerticalText 出现统计
const rotates = {};
for (const m of xml.matchAll(/ss:Rotate="([^"]+)"/g)) rotates[m[1]] = (rotates[m[1]] || 0) + 1;
console.log('Rotate values:', JSON.stringify(rotates));
console.log('VerticalText occurrences:', (xml.match(/VerticalText/g) || []).length);
console.log('MergeAcross occurrences:', (xml.match(/MergeAcross/g) || []).length);
console.log('MergeDown occurrences:', (xml.match(/MergeDown/g) || []).length);

// 3) Table 段结构（前 1200 字符）
const tIdx = xml.indexOf('<Table');
console.log('\nTable head:\n', xml.slice(tIdx, tIdx + 1200));

// 4) 填充色统计
const fills = {};
for (const m of xml.matchAll(/<Interior[^>]*ss:Color="([^"]+)"[^>]*ss:Pattern="([^"]+)"/g)) {
    const k = m[1] + '/' + m[2]; fills[k] = (fills[k] || 0) + 1;
}
console.log('\nstyle-level fill colors:', JSON.stringify(fills, null, 0));

// 5) 含 MergeDown 的大合并样例（找 BUF-01 那种）
const bIdx = xml.indexOf('BUF-01');
if (bIdx > 0) console.log('\naround BUF-01:\n', xml.slice(bIdx - 500, bIdx + 200).replace(/\s+/g, ' '));

// 6) 行样式样例（带高度的）
const rowSample = xml.match(/<Row[^>]*ss:Height[^>]*>/g) || [];
console.log('\nrows with height:', rowSample.length, rowSample.slice(0, 3));

// 7) 列宽度是否包含
console.log('\ncolumn elements:', (xml.match(/<Column /g) || []).length);
