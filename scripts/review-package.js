// review-package.js — git 区间 diff 打包到一个文件
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const [base, head] = process.argv.slice(2);
const run = c => execSync(c, { encoding: 'utf8' });
const out = path.join(__dirname, '..', '.superpowers', 'sdd', `review-${base}-${head || 'HEAD'}.diff`);
const body = run(`git log --oneline ${base}..${head || ''}`) + '\n' + run(`git diff --stat ${base} ${head || ''}`) + '\n' + run(`git diff -U10 ${base} ${head || ''}`);
fs.writeFileSync(out, body);
console.log(out);
