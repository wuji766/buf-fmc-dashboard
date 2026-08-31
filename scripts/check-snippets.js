const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'snippets');
for (const f of ['L20-20-texts-0.js', 'L40-20-texts-0.js', 'L20x2-40-arrow.js']) {
  console.log('== ' + f + ' ==\n' + fs.readFileSync(path.join(dir, f), 'utf8').split('\n').slice(0, 3).join('\n'));
}
for (const f of fs.readdirSync(dir)) {
  if (!/^L(20|20x2|40)-20-texts/.test(f) && !/00-frame/.test(f)) continue;
  const key = f.split('-')[0];
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach(l => {
    if (/CAK-01CL|BUF-01C01|CVF301|bannertxt/.test(l)) console.log(key + ' :: ' + l.trim().slice(0, 160));
  });
}
