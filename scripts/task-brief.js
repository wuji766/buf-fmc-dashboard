// task-brief.js — 从 plan 提取 Task N 全文到 .superpowers/sdd/task-N-brief.md
const fs = require('fs'), path = require('path');
const [planFile, n] = process.argv.slice(2);
const txt = fs.readFileSync(planFile, 'utf8');
const re = /^### Task (\d+):/gm;
const marks = [...txt.matchAll(re)].map(m => ({ n: +m[1], i: m.index }));
const t = marks.find(m => m.n === +n);
if (!t) { console.error('task not found'); process.exit(1); }
const next = marks.find(m => m.i > t.i);
const body = txt.slice(t.i, next ? next.i : txt.length).replace(/^### Task \d+:.*\n/, '');
const outDir = path.join(__dirname, '..', '.superpowers', 'sdd');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `task-${n}-brief.md`);
fs.writeFileSync(out, body);
console.log(out);
