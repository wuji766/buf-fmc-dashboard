const fs = require('fs');
const p = 'scripts/convert.js';
let s = fs.readFileSync(p, 'utf8');
// bannertxt：直接用 fontOf
s = s.replace(
  'fontFamily:j(t?t.font:undefined)})\\n`;',
  'fontFamily:${j(fontOf(sh.text || \'\'))}})\\n`;'
);
// 文字片段：元组加 font 列（t[11]），Insert 用 t[11]
s = s.replace(
  's += cs.map(t => `[${j(t.content)},${t.x},${t.y},${t.w},${t.h},${t.size},${t.bold ? 1 : 0},${t.rot},${j(t.align)},${j(t.valign)},${j(t.color)}]`).join(\',\\n\');',
  's += cs.map(t => `[${j(t.content)},${t.x},${t.y},${t.w},${t.h},${t.size},${t.bold ? 1 : 0},${t.rot},${j(t.align)},${j(t.valign)},${j(t.color)},${j(fontOf(t.content))}]`).join(\',\\n\');'
);
s = s.replace('fontFamily:j(t?t.font:undefined)});k++}', 'fontFamily:t[11]});k++}');
// est 系数按字体：Roboto Condensed≈0.45em，Noto Sans SC≈0.62em
s = s.replace(
  "let est = 0; for (const ch of content) est += (ch.charCodeAt(0) > 0x2e80 ? 1.0 : 0.62) * st.size;",
  "const emW = isAscii(content) ? 0.45 : 0.62;\n    let est = 0; for (const ch of content) est += (ch.charCodeAt(0) > 0x2e80 ? 1.0 : emW) * st.size;"
);
s = s.replace(
  "function estW(text, size, bold) {\n  let e = 0; for (const ch of String(text)) e += (ch.charCodeAt(0) > 0x2e80 ? 1.0 : 0.62) * size;",
  "function estW(text, size, bold) {\n  let e = 0; for (const ch of String(text)) e += (ch.charCodeAt(0) > 0x2e80 ? 1.0 : (isAscii(text) ? 0.45 : 0.62)) * size;"
);
fs.writeFileSync(p, s);
console.log('done', (s.match(/fontOf/g) || []).length, 'fontOf refs');
