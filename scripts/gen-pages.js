// gen-pages.js — elements-{frame}.json -> web/data/page-{n}.js
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const OUT = path.join(__dirname, '..', 'web', 'data');
fs.mkdirSync(OUT, { recursive: true });

function siteIdOf(name) { return typeof name === 'string' && name.startsWith('site:') ? name.slice(5).trim() : null; }

// banner 识别：shape.name 以 "banner:" 开头（约定格式），或 shape.text 为 "Array"/"CF/Cell"
// （实测 elements json 中横幅的 name 是 "正方形/長方形 1/2"，靠 text 识别）
function findBanners(el, frameName) {
  const banners = el.shapes.filter(s =>
    /^banner:/i.test(s.name || '') || (s.text || '') === 'Array' || (s.text || '') === 'CF/Cell'
  ).sort((a, b) => a.top - b.top);
  if (banners.length < 2) throw new Error(frameName + ' expects 2 banners, got ' + banners.length);
  return banners;
}

function buildSiteMap(page) {
  const map = new Map(); // siteId -> {siteId, rectId, rect, textIds:[]}
  for (const f of page.fills) {
    const sid = siteIdOf(f.name);
    if (!sid) continue;
    map.set(sid, { siteId: sid, rectId: f.id, rect: { x: f.x, y: f.y, w: f.w, h: f.h }, textIds: [] });
  }
  // 文字中心点（按 rot 推导渲染 AABB，与 convert.js 实测公式一致）落在站点矩形内则关联
  for (const t of page.texts) {
    const aabb = t.rot === 90 ? { x: t.x, y: t.y - t.w, w: t.h, h: t.w }
      : t.rot === 270 ? { x: t.x - t.h, y: t.y, w: t.h, h: t.w }
      : { x: t.x, y: t.y, w: t.w, h: t.h };
    const tcx = aabb.x + aabb.w / 2, tcy = aabb.y + aabb.h / 2;
    for (const [, s] of map) {
      const r = s.rect;
      if (tcx >= r.x && tcx <= r.x + r.w && tcy >= r.y && tcy <= r.y + r.h) { s.textIds.push(t.id); break; }
    }
  }
  return [...map.values()];
}

/* 页面内容紧凑包围盒：fills + texts 旋转 AABB 并集 + padding，钳到画布内 */
function contentVB(page, pad) {
  pad = pad || 10;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y, w, h) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  };
  for (const f of page.fills) add(f.x, f.y, f.w, f.h);
  for (const t of page.texts) {
    if (t.rot === 90) add(t.x, t.y - t.w, t.h, t.w);
    else if (t.rot === 270) add(t.x - t.h, t.y, t.h, t.w);
    else add(t.x, t.y, t.w, t.h);
  }
  if (x0 === Infinity) return [0, 0, page.W, page.H];
  // padding 后钳到画布范围内
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(page.W, x1 + pad); y1 = Math.min(page.H, y1 + pad);
  return [
    Math.round(x0 * 100) / 100, Math.round(y0 * 100) / 100,
    Math.round((x1 - x0) * 100) / 100, Math.round((y1 - y0) * 100) / 100
  ];
}

function splitPages(el, frameName) {
  const banners = findBanners(el, frameName);
  const midY = banners[1].top; // 第二条横幅顶 = 上下分界
  const mk = (suffix, pageName, pred) => {
    const fills = el.fills.filter(pred).map((f, i) => ({ ...f, id: 'f' + suffix + '_' + i }));
    const page = {
      id: frameName + '-' + suffix, name: frameName + '-' + pageName,
      frame: frameName, W: el.W, H: el.H,
      fills,
      texts: el.texts.filter(pred).map((t, i) => ({ ...t, id: 't' + suffix + '_' + i })),
      borderGeo: el.borderGeo || '',
    };
    page.vb = contentVB(page);
    page.sites = buildSiteMap(page);
    return page;
  };
  const top = mk('A', 'Array', o => (o.y + (o.h || 0)) <= midY);
  const bottom = mk('B', 'CF/Cell', o => o.y + (o.h || 0) > midY);
  return [top, bottom];
}

if (require.main === module) {
  let n = 1;
  for (const [frame, file] of [['L20', 'elements-L20.json'], ['L40', 'elements-L40.json']]) {
    const el = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
    for (const p of splitPages(el, frame)) {
      const js = 'window.BUF_PAGES=window.BUF_PAGES||[];BUF_PAGES.push(' + JSON.stringify(p) + ');';
      fs.writeFileSync(path.join(OUT, 'page-' + n + '.js'), js);
      console.log('page-' + n, p.name, 'fills=' + p.fills.length, 'texts=' + p.texts.length, 'sites=' + p.sites.length);
      n++;
    }
  }
}
module.exports = { splitPages, buildSiteMap, contentVB };
