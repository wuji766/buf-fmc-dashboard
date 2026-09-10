const fs = require('fs');
for (const f of ['web/index.html', 'web/menu.html']) {
  const s = fs.readFileSync(f, 'utf8');
  const refs = s.match(/(src|href)="[^"]+\.(js|css)"/g) || [];
  const un = refs.filter(x => !x.includes('?v='));
  console.log(f, 'total', refs.length, 'unversioned:', JSON.stringify(un));
}
