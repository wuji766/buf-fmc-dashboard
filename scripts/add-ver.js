// add-ver.js — 给 index/menu 的本地资源引用加 ?v= 版本号（防 CDN/浏览器缓存）
const fs = require('fs'), path = require('path');
const VER = '20260901a';
for (const f of ['web/index.html', 'web/menu.html']) {
  const p = path.join(__dirname, '..', f);
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace(/((?:src|href)=")((?:config\.js|js\/|css\/|data\/)[^"?]+)(")/g, (m, a, b, c) =>
    b.endsWith('.js') || b.endsWith('.css') ? a + b + '?v=' + VER + c : m);
  fs.writeFileSync(p, s);
  console.log(f, (s.match(/\?v=/g) || []).length, 'versioned refs');
}
