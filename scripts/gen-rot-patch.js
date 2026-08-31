// 生成竖排文字补丁（与 convert.js 同一套公式），输出 scripts/rot-patch-{key}.json
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', 'data');
for (const key of ['L20', 'L20x2', 'L40']) {
  const el = JSON.parse(fs.readFileSync(path.join(DATA, `elements-${key}.json`), 'utf8'));
  const patch = [];
  for (const t of el.texts) {
    if (t.rot !== 90 && t.rot !== 270) continue;
    patch.push({ content: t.content, fontSize: t.size, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot });
  }
  fs.writeFileSync(path.join(__dirname, `rot-patch-${key}.json`), JSON.stringify(patch));
  console.log(key, patch.length);
}
