const all = JSON.parse(require('fs').readFileSync('./data/shapes.json', 'utf8').replace(/^\uFEFF/, ''));
for (const e of all) {
  console.log('== sheet', e.sheet, '==');
  for (const s of e.shapes) {
    console.log(JSON.stringify(s).slice(0, 300));
  }
}
