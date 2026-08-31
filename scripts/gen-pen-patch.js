// gen-pen-patch.js — 生成 pen-patch-{frame}.json：与 git HEAD 版 elements 比对 size/盒变化文字
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
for (const k of ['L20', 'L20x2', 'L40']) {
  const oldJ = cp.execSync('git show HEAD:data/elements-' + k + '.json', { encoding: 'utf8', maxBuffer: 1e8, cwd: ROOT });
  const old = JSON.parse(oldJ).texts;
  const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'elements-' + k + '.json'), 'utf8')).texts;
  if (old.length !== cur.length) throw new Error(k + ' length mismatch ' + old.length + ' vs ' + cur.length);
  const patch = [];
  cur.forEach((t, i) => {
    const o = old[i];
    if (o.content !== t.content) throw new Error(k + ' order mismatch at ' + i);
    if (o.size !== t.size || o.x !== t.x || o.y !== t.y || o.w !== t.w || o.h !== t.h)
      patch.push({ content: t.content, x: t.x, y: t.y, w: t.w, h: t.h, fontSize: t.size, rot: t.rot });
  });
  fs.writeFileSync(path.join(ROOT, 'scripts', 'pen-patch-' + k + '.json'), JSON.stringify(patch, null, 1));
  console.log(k, 'changed:', patch.length, '/', cur.length);
}
