// gh-pages-setup.js — 建仓/检查 + 开 Pages（用本机 git 凭据的 token，走代理）
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const cred = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = cred.split('\n').find(l => l.startsWith('password=')).slice(9).trim();
const PROXY = 'http://127.0.0.1:7897';
const REPO = 'wuji766/buf-fmc-dashboard';

function api(method, apiPath, body) {
  const bodyFile = path.join(ROOT, 'gh-api-body.json');
  const outFile = path.join(ROOT, 'gh-api-out.json');
  fs.writeFileSync(bodyFile, body ? JSON.stringify(body) : '');
  const code = execSync(
    `curl -s -x ${PROXY} -o "${outFile}" -w "%{http_code}" -X ${method} ` +
    `-H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" ` +
    `--data @"${bodyFile}" https://api.github.com${apiPath}`,
    { encoding: 'utf8' }).trim();
  const j = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  return { code, j };
}

const step = process.argv[2];
if (step === 'repo') {
  let r = api('GET', `/repos/${REPO}`, null);
  console.log('repo exists?', r.code);
  if (r.code === '404') {
    r = api('POST', '/user/repos', { name: 'buf-fmc-dashboard', description: 'BUF FMC 监控大屏（pencil 布局还原 + 轮播 + 报警聚焦）', private: false });
    console.log('create repo:', r.code, r.j.full_name || r.j.message);
  } else {
    console.log('full_name:', r.j.full_name, '| default_branch:', r.j.default_branch);
  }
} else if (step === 'pages') {
  let r = api('GET', `/repos/${REPO}/pages`, null);
  if (r.code === '200') {
    console.log('pages already enabled:', r.j.html_url, '| source:', r.j.source && r.j.source.branch);
  } else {
    r = api('POST', `/repos/${REPO}/pages`, { source: { branch: 'gh-pages', path: '/' } });
    console.log('enable pages:', r.code, r.j.html_url || JSON.stringify(r.j));
  }
} else if (step === 'check') {
  const code = execSync(`curl -s -o nul -w "%{http_code}" --max-time 15 https://wuji766.github.io/buf-fmc-dashboard/menu.html`, { encoding: 'utf8' }).trim();
  console.log('pages url status:', code);
}
fs.rmSync(path.join(ROOT, 'gh-api-body.json'), { force: true });
fs.rmSync(path.join(ROOT, 'gh-api-out.json'), { force: true });
