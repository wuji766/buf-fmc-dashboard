// convert.js — SpreadsheetML -> pencil 元素清单 + 分批 execute 片段
// 用法: node scripts/convert.js
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const OUT = path.join(__dirname, 'snippets');
fs.mkdirSync(OUT, { recursive: true });

const FONT = 'Noto Sans SC';
const isAscii = s => { for (const ch of s) if (ch.charCodeAt(0) > 0x2e80) return false; return true; };
// 纯 ASCII 标签用窄字体（贴近 Excel 宋体半角观感），否则 Noto Sans SC 下会溢出/换行
const fontOf = content => isAscii(content) ? 'Roboto Condensed' : FONT;

/* ---- 字符宽度表（浏览器 canvas measureText 实测，单位 em，2026-08-31）----
 * shrink-to-fit 的估宽必须与真实渲染一致：RC=Roboto Condensed 常规/加粗，NOTO=Noto Sans SC 拉丁。
 * 未收录字符回退：RC 0.55 / NOTO 0.62；CJK 全部 1.0em。 */
const RC_W = { '0':0.494,'1':0.494,'2':0.494,'3':0.494,'4':0.494,'5':0.494,'6':0.494,'7':0.494,'8':0.494,'9':0.494,' ':0.229,'!':0.246,'"':0.32,'#':0.548,'$':0.494,'%':0.633,'&':0.544,"'":0.175,'(':0.314,')':0.319,'*':0.431,'+':0.497,',':0.197,'-':0.248,'.':0.264,'/':0.371,':':0.233,';':0.203,'<':0.446,'=':0.479,'>':0.46,'?':0.422,'@':0.769,'A':0.577,'B':0.546,'C':0.567,'D':0.571,'E':0.497,'F':0.481,'G':0.591,'H':0.62,'I':0.25,'J':0.483,'K':0.545,'L':0.476,'M':0.755,'N':0.62,'O':0.601,'P':0.554,'Q':0.601,'R':0.531,'S':0.519,'T':0.521,'U':0.562,'V':0.561,'W':0.762,'X':0.551,'Y':0.525,'Z':0.523,'[':0.25,'\\':0.37,']':0.25,'^':0.371,'_':0.405,'`':0.309,'a':0.479,'b':0.493,'c':0.462,'d':0.496,'e':0.469,'f':0.316,'g':0.493,'h':0.483,'i':0.229,'j':0.224,'k':0.451,'l':0.229,'m':0.753,'n':0.484,'o':0.502,'p':0.493,'q':0.5,'r':0.305,'s':0.456,'t':0.296,'u':0.483,'v':0.428,'w':0.65,'x':0.439,'y':0.417,'z':0.439,'{':0.307,'|':0.244,'}':0.307,'~':0.589 };
const RC_B = { '0':0.505,'1':0.505,'2':0.505,'3':0.505,'4':0.505,'5':0.505,'6':0.505,'7':0.505,'8':0.505,'9':0.505,' ':0.23,'!':0.261,'"':0.321,'#':0.528,'$':0.505,'%':0.638,'&':0.579,"'":0.162,'(':0.323,')':0.324,'*':0.454,'+':0.476,',':0.245,'-':0.361,'.':0.291,'/':0.332,':':0.273,';':0.253,'<':0.447,'=':0.503,'>':0.454,'?':0.447,'@':0.766,'A':0.597,'B':0.561,'C':0.57,'D':0.565,'E':0.491,'F':0.476,'G':0.585,'H':0.614,'I':0.27,'J':0.49,'K':0.553,'L':0.479,'M':0.758,'N':0.612,'O':0.604,'P':0.568,'Q':0.604,'R':0.553,'S':0.54,'T':0.542,'U':0.571,'V':0.578,'W':0.75,'X':0.56,'Y':0.542,'Z':0.53,'[':0.264,'\\':0.381,']':0.264,'^':0.391,'_':0.4,'`':0.331,'a':0.471,'b':0.495,'c':0.46,'d':0.496,'e':0.479,'f':0.328,'g':0.503,'h':0.492,'i':0.252,'j':0.245,'k':0.478,'l':0.252,'m':0.742,'n':0.492,'o':0.498,'p':0.495,'q':0.497,'r':0.331,'s':0.454,'t':0.307,'u':0.492,'v':0.449,'w':0.633,'x':0.452,'y':0.445,'z':0.452,'{':0.298,'|':0.253,'}':0.298,'~':0.558 };
const NOTO_W = { '0':0.555,'1':0.555,'2':0.555,'3':0.555,'4':0.555,'5':0.555,'6':0.555,'7':0.555,'8':0.555,'9':0.555,' ':0.224,'!':0.323,'"':0.475,'#':0.555,'$':0.555,'%':0.921,'&':0.68,"'":0.279,'(':0.338,')':0.338,'*':0.467,'+':0.555,',':0.278,'-':0.347,'.':0.278,'/':0.392,':':0.278,';':0.278,'<':0.555,'=':0.555,'>':0.555,'?':0.474,'@':0.946,'A':0.608,'B':0.657,'C':0.638,'D':0.688,'E':0.589,'F':0.552,'G':0.689,'H':0.728,'I':0.293,'J':0.535,'K':0.646,'L':0.543,'M':0.812,'N':0.723,'O':0.742,'P':0.633,'Q':0.742,'R':0.635,'S':0.596,'T':0.599,'U':0.721,'V':0.575,'W':0.878,'X':0.573,'Y':0.531,'Z':0.603,'[':0.338,'\\':0.392,']':0.338,'^':0.555,'_':0.559,'a':0.563,'b':0.618,'c':0.51,'d':0.62,'e':0.554,'f':0.325,'g':0.564,'h':0.607,'i':0.275,'j':0.275,'k':0.552,'l':0.284,'m':0.926,'n':0.61,'o':0.606,'p':0.62,'q':0.62,'r':0.388,'s':0.468,'t':0.377,'u':0.607,'v':0.521,'w':0.802,'x':0.498,'y':0.521,'z':0.475,'{':0.338,'|':0.27,'}':0.338,'~':0.555 };
function charW(ch, bold, font) {
  if (ch.charCodeAt(0) > 0x2e80) return 1.0;
  if (font === 'Roboto Condensed') return (bold ? RC_B : RC_W)[ch] || 0.55;
  return NOTO_W[ch] || 0.62;
}
const decodeEnt = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function attrStr(tag) { // tag = attrs string
  const o = {};
  for (const m of tag.matchAll(/ss:(\w+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
}

function parseStyles(xml) {
  const styles = { Default: { size: 11, bold: false, color: '#000000', fill: null, borders: {}, h: null, v: null, rotate: 0 } };
  for (const m of xml.matchAll(/<Style\s+ss:ID="([^"]+)"([^>]*)>([\s\S]*?)<\/Style>/g)) {
    const [, id, , body] = m;
    const st = { size: 11, bold: false, color: '#000000', fill: null, borders: {}, h: null, v: null, rotate: 0 };
    const f = body.match(/<Font[^>]*\/>/);
    if (f) { const a = attrStr(f[0].slice(5, -2)); st.size = a.Size ? +a.Size : 11; st.bold = a.Bold === '1'; st.color = a.Color || '#000000'; }
    const i = body.match(/<Interior\s+[^>]*ss:Pattern="([^"]+)"[^>]*\/>|<Interior\s+[^>]*\/>/);
    if (i) { const a = attrStr(i[0].slice(9, -2)); if (a.Pattern === 'Solid' && a.Color) st.fill = a.Color.toUpperCase(); }
    const al = body.match(/<Alignment[^>]*\/>/);
    if (al) { const a = attrStr(al[0].slice(10, -2)); st.h = a.Horizontal || null; st.v = a.Vertical || null; st.rotate = a.Rotate ? +a.Rotate : 0; }
    for (const b of body.matchAll(/<Border\s+([^>]*)\/>/g)) { const a = attrStr(b[1]); if (a.LineStyle) st.borders[a.Position] = +(a.Weight || 1); }
    styles[id] = st;
  }
  return styles;
}

function parseSheet(file) {
  const xml = fs.readFileSync(file, 'utf8');
  const styles = parseStyles(xml);
  const tbl = xml.match(/<Table([^>]*)>/)[1];
  const TA = attrStr('ss:' + tbl); // hack: attrStr expects ss: prefixed attrs
  const defColW = +(TA.DefaultColumnWidth || 13.55), defRowH = +(TA.DefaultRowHeight || 12.95);
  const maxCol = +TA.ExpandedColumnCount, maxRow = +TA.ExpandedRowCount;

  // 列宽
  const colW = new Array(maxCol + 2).fill(defColW);
  let ci = 1;
  for (const m of xml.matchAll(/<Column\s+([^>]*)\/>/g)) {
    const a = attrStr(m[1]);
    const idx = a.Index ? +a.Index : ci;
    const w = a.Width ? +a.Width : defColW;
    const span = a.Span ? +a.Span + 1 : 1;
    for (let k = 0; k < span && idx + k <= maxCol; k++) colW[idx + k] = w;
    ci = idx + span;
  }
  // 行高 + 单元格
  const rowH = new Array(maxRow + 2).fill(defRowH);
  const cells = []; let r = 1;
  const rowRe = /<Row\s*([^>]*)>([\s\S]*?)<\/Row>|<Row\s*([^>]*)\/>/g;
  for (const m of xml.matchAll(rowRe)) {
    const attrs = m[1] !== undefined ? m[1] : m[3];
    const A = attrStr(attrs);
    if (A.Index) r = +A.Index;
    if (A.Height) rowH[r] = +A.Height;
    if (m[2]) {
      let c = 1;
      for (const cm of m[2].matchAll(/<Cell\s*([^>]*?)(?:\/>|>([\s\S]*?)<\/Cell>)/g)) {
        const C = attrStr(cm[1]);
        if (C.Index) c = +C.Index;
        const cell = { r, c, style: C.StyleID || 'Default', ma: C.MergeAcross ? +C.MergeAcross : 0, md: C.MergeDown ? +C.MergeDown : 0, v: null, vt: null };
        if (cm[2]) { const d = cm[2].match(/<Data\s+ss:Type="(\w+)"[^>]*>([\s\S]*?)<\/Data>/); if (d) { cell.vt = d[1]; cell.v = decodeEnt(d[2].trim()); } }
        cells.push(cell);
        c += 1 + cell.ma;
      }
    }
    r++;
  }
  // 几何边界（xs[c]=第c列左边缘，xs[1]=0）
  const xs = [0, 0], ys = [0, 0];
  for (let c = 1; c <= maxCol; c++) xs[c + 1] = xs[c] + colW[c];
  for (let rr = 1; rr <= maxRow; rr++) ys[rr + 1] = ys[rr] + rowH[rr];
  console.error(`[dbg] ${file}: maxCol=${maxCol}(${typeof maxCol}) maxRow=${maxRow} cells=${cells.length} W=${xs[maxCol + 1]} H=${ys[maxRow + 1]} xs[142]=${xs[142]} colW[141]=${colW[141]} rowH[181]=${rowH[181]}`);
  return { styles, maxCol, maxRow, xs, ys, cells, W: xs[maxCol + 1], H: ys[maxRow + 1], defColW, defRowH };
}

function build(sheet, shapesFor) {
  const { styles, xs, ys, cells } = sheet;
  const covered = new Set();
  const anchors = new Map(); // "r,c" -> anchor cell
  for (const cell of cells) {
    if (cell.ma || cell.md) anchors.set(cell.r + ',' + cell.c, cell);
    for (let dr = 0; dr <= cell.md; dr++) for (let dc = 0; dc <= cell.ma; dc++) {
      if (dr || dc) covered.add((cell.r + dr) + ',' + (cell.c + dc));
    }
  }

  // ---- 填充矩形：行游程 + 垂直合并 ----
  // rowRuns[r] = [{c0,c1,color,anchor}]
  const rowRuns = new Map();
  for (const cell of cells) {
    if (covered.has(cell.r + ',' + cell.c)) continue;
    const st = styles[cell.style]; if (!st || !st.fill) continue;
    const c1 = cell.c + cell.ma, r1 = cell.r + cell.md;
    const rr = rowRuns.get(cell.r) || [];
    const last = rr[rr.length - 1];
    if (last && last.c1 + 1 === cell.c && last.color === st.fill && last.anchor == null && cell.ma === 0) {
      last.c1 = c1;
    } else rr.push({ c0: cell.c, c1, color: st.fill, anchor: cell.ma || cell.md ? cell : null, r1 });
    rowRuns.set(cell.r, rr);
  }
  // 垂直合并：同 key(c0,c1,color,anchor?) 连续行延续；锚点矩形自带 MergeDown 跨度
  const rects = [];
  const openRuns = new Map();
  const sortedRows = [...rowRuns.keys()].sort((a, b) => a - b);
  for (const r of sortedRows) {
    for (const run of rowRuns.get(r)) {
      const key = run.c0 + ',' + run.c1 + ',' + run.color + ',' + (run.anchor ? 'a' : 'n');
      const o = openRuns.get(key);
      const md = run.anchor ? run.anchor.md : 0;
      if (o && o.r1 + 1 === r) { o.r1 = r + md; }
      else {
        openRuns.set(key, { c0: run.c0, c1: run.c1, r0: r, r1: r + md, color: run.color, anchor: run.anchor });
      }
    }
    for (const [key, o] of [...openRuns]) {
      if (o.r1 < r) { rects.push(o); openRuns.delete(key); }
    }
  }
  for (const [, o] of openRuns) rects.push(o);
  const fillRects = rects.map(o => ({
    x: +xs[o.c0].toFixed(2), y: +ys[o.r0].toFixed(2),
    w: +(xs[o.c1 + 1] - xs[o.c0]).toFixed(2), h: +(ys[o.r1 + 1] - ys[o.r0]).toFixed(2),
    color: o.color,
    name: o.anchor && o.anchor.v ? (o.anchor.v.length > 24 ? 'site:' + o.anchor.v.slice(0, 24) : 'site:' + o.anchor.v) : 'fill@r' + o.r0 + 'c' + o.c0
  }));

  // ---- 文字 ----
  const texts = [];
  for (const cell of cells) {
    if (cell.v == null || cell.v === '') continue;
    const st = styles[cell.style] || styles.Default;
    const c1 = cell.c + cell.ma, r1 = cell.r + cell.md;
    const bx = xs[cell.c], by = ys[cell.r], bw = xs[c1 + 1] - xs[cell.c], bh = ys[r1 + 1] - ys[cell.r];
    const align = st.h ? st.h.toLowerCase() : (cell.vt === 'Number' ? 'right' : 'left');
    const valign = (st.v ? st.v.toLowerCase() : 'bottom');
    let content = cell.v;
    if (cell.vt === 'Number') { const n = +content; content = String(n); }
    // 估宽：按实测字符宽度表（与浏览器 canvas measureText 同源），CJK=1em
    const font = fontOf(content);
    const estOf = (sz) => {
      let e = 0; for (const ch of content) e += charW(ch, st.bold, font) * sz;
      return e;
    };
    // pencil 实测（rot-test 实验，ctx.bounds 验证）：
    //   rotation:90  渲染矩形 = (x, y-w, h, w)，自下而上读
    //   rotation:270 渲染矩形 = (x-h, y, h, w)，自上而下读
    // Excel Rotate=90 为自下而上 → pencil 90；Rotate=-90 自上而下 → pencil 270
    // 有效区域：合并区内若存在**带值的被覆盖格**（如 KHM-31CL 两行合并、下半行还有数字 1-4），
    // 两者都会渲染——标签必须限制在未被占用行列里，否则与覆盖格文字重叠。
    let ex0 = bx, ey0 = by, ex1 = bx + bw, ey1 = by + bh, reduced = false;
    if (cell.ma || cell.md) {
      const occR = new Set(), occC = new Set();
      for (const cc of cells) {
        if (cc === cell || cc.v == null || cc.v === '') continue;
        if (cc.r >= cell.r && cc.r <= r1 && cc.c >= cell.c && cc.c <= c1) {
          for (let dr = 0; dr <= cc.md; dr++) occR.add(cc.r + dr);
          for (let dc = 0; dc <= cc.ma; dc++) occC.add(cc.c + dc);
        }
      }
      if (occR.size || occC.size) {
        const freeR = []; for (let r = cell.r; r <= r1; r++) if (!occR.has(r)) freeR.push(r);
        const freeC = []; for (let c = cell.c; c <= c1; c++) if (!occC.has(c)) freeC.push(c);
        if (freeR.length && freeR.length < r1 - cell.r + 1) { ey0 = ys[freeR[0]]; ey1 = ys[freeR[freeR.length - 1] + 1]; reduced = true; }
        if (freeC.length && freeC.length < c1 - cell.c + 1) { ex0 = xs[freeC[0]]; ex1 = xs[freeC[freeC.length - 1] + 1]; reduced = true; }
      }
    }
    const effW = ex1 - ex0, effH = ey1 - ey0;
    // Shrink-to-fit：文字必须被其所属单元格（有效区域）容纳——水平看 effW，旋转看 effH；
    // 估宽超出则缩字号（下限 6pt，到下限仍溢出则接受），不再扩盒（扩盒=溢出源头）。
    const hFactor = font === 'Roboto Condensed' ? 1.35 : 1.5;
    let x = bx, y = by, w = bw, h = bh, rot = 0, fsize = st.size;
    if (st.rotate === 90 || st.rotate === -90) {
      const avail = effH;
      let est = estOf(fsize);
      if (est > avail) {
        fsize = Math.max(6, Math.floor(st.size * avail / est * 10) / 10);
        est = estOf(fsize);
      }
      // 厚度方向同样 shrink-to-fit（合并区被压缩时，厚度不得超过有效列宽）
      if (reduced && fsize * hFactor > effW) fsize = Math.max(6, Math.floor(effW / hFactor * 10) / 10);
      // 盒：阅读向长度 w=est+1，厚度 h=字号×1.35(RC)/1.5(Noto)，均在有效区域内居中
      w = +(est + 1).toFixed(2);
      h = +(fsize * hFactor).toFixed(2);
      if (st.rotate === 90) { rot = 90; x = +(ex0 + (effW - h) / 2).toFixed(2); y = +(ey0 + (effH + w) / 2).toFixed(2); }
      else { rot = 270; x = +(ex0 + (effW + h) / 2).toFixed(2); y = +(ey0 + (effH - w) / 2).toFixed(2); }
    } else {
      const avail = effW;
      let est = estOf(fsize);
      if (est > avail) {
        fsize = Math.max(6, Math.floor(st.size * avail / est * 10) / 10);
        est = estOf(fsize);
      }
      // 垂直 shrink-to-fit：合并区被压缩时，盒高不得超过有效行高（防与覆盖格文字 em 盒相压）
      if (reduced && fsize * hFactor > effH) fsize = Math.max(6, Math.floor(effH / hFactor * 10) / 10);
      // 盒收紧：w=est+1、h=字号×1.35(RC)/1.5(Noto)；水平按对齐、垂直在有效区域内居中
      w = +(est + 1).toFixed(2);
      h = +(fsize * hFactor).toFixed(2);
      if (align === 'center') x = +(ex0 + (effW - w) / 2).toFixed(2);
      else if (align === 'right') x = +(ex0 + effW - w).toFixed(2);
      else x = ex0;
      y = +(ey0 + (effH - h) / 2).toFixed(2);
    }
    texts.push({
      content, x: +x.toFixed(2), y: +y.toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2),
      size: fsize, bold: st.bold, rot, align, font: fontOf(content), valign: 'middle', color: st.color,
      name: ('txt:' + content).slice(0, 30)
    });
  }

  // ---- 边框线段（含合并区外轮廓）----
  const hsegs = [], vsegs = []; // h:{y,x0,x1} v:{x,y0,y1}
  for (const cell of cells) {
    if (covered.has(cell.r + ',' + cell.c) && !anchors.has(cell.r + ',' + cell.c)) continue;
    const st = styles[cell.style]; if (!st) continue;
    const b = st.borders; if (!b.Left && !b.Right && !b.Top && !b.Bottom) continue;
    const c1 = cell.c + cell.ma, r1 = cell.r + cell.md;
    const x0 = xs[cell.c], x1 = xs[c1 + 1], y0 = ys[cell.r], y1 = ys[r1 + 1];
    if (b.Top) hsegs.push([y0, x0, x1]);
    if (b.Bottom) hsegs.push([y1, x0, x1]);
    if (b.Left) vsegs.push([x0, y0, y1]);
    if (b.Right) vsegs.push([x1, y0, y1]);
  }
  const mergeSegs = segs => {
    // segs: [coord, a0, a1] 合并共线连续
    const byCoord = new Map();
    for (const s of segs) { const k = s[0].toFixed(2); if (!byCoord.has(k)) byCoord.set(k, []); byCoord.get(k).push(s); }
    const out = [];
    for (const [, list] of byCoord) {
      list.sort((p, q) => p[1] - q[1]);
      let cur = null;
      for (const s of list) {
        if (cur && Math.abs(s[1] - cur[2]) < 0.01) cur[2] = Math.max(cur[2], s[2]);
        else { if (cur) out.push(cur); cur = [s[0], s[1], s[2]]; }
      }
      if (cur) out.push(cur);
    }
    return out;
  };
  const H = mergeSegs(hsegs), V = mergeSegs(vsegs);
  let geo = '';
  for (const s of H) geo += `M${s[1].toFixed(1)} ${s[0].toFixed(1)}L${s[2].toFixed(1)} ${s[0].toFixed(1)}`;
  for (const s of V) geo += `M${s[0].toFixed(1)} ${s[1].toFixed(1)}L${s[0].toFixed(1)} ${s[2].toFixed(1)}`;

  return { fillRects, texts, borderGeo: geo, W: sheet.W, H: sheet.H };
}

// ---- 形状（横幅/箭头）----
function shapesOf(shapesJson, sheetName, W) {
  const all = JSON.parse(fs.readFileSync(shapesJson, 'utf8').replace(/^\uFEFF/, ''));
  const entry = all.find(e => e.sheet === sheetName);
  if (!entry) return [];
  const bgr = v => v == null ? null : '#' + ((v & 255).toString(16).padStart(2, '0') + ((v >> 8) & 255).toString(16).padStart(2, '0') + ((v >> 16) & 255).toString(16).padStart(2, '0')).toUpperCase();
  return entry.shapes.map(s => ({
    name: s.name, left: s.left, top: s.top, width: s.width, height: s.height, rotation: s.rotation,
    text: s.text, fill: bgr(s.fillRGB), line: bgr(s.lineRGB), lineWeight: s.lineWeight,
    isConnector: /connector/i.test(s.name), endArrow: s.endArrow
  }));
}

// ---- 片段生成 ----
function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
const j = v => JSON.stringify(v);

function estW(text, size, bold) {
  let e = 0; for (const ch of String(text)) e += (ch.charCodeAt(0) > 0x2e80 ? 1.0 : (isAscii(text) ? 0.45 : 0.62)) * size;
  return bold ? e * 1.05 : e;
}

function emit(sheetKey, sheetName, built, shapes, frameX, fid) {
  const files = [];
  // 0) frame + banners
  let s0 = `var P=${j(Array.from(new Set(built.fillRects.map(r => r.color))))}\n`;
  s0 += `${sheetKey}F=Insert(document,{type:"frame",name:${j(sheetName)},x:${frameX},y:0,width:${built.W.toFixed(1)},height:${built.H.toFixed(1)},fill:"#FFFFFF",clip:true,layout:"none",placeholder:true})\n`;
  for (const sh of shapes.filter(x => !x.isConnector)) {
    s0 += `Insert(${sheetKey}F,{type:"rectangle",name:${j('banner:' + (sh.text || sh.name))},x:${sh.left},y:${sh.top},width:${sh.width},height:${sh.height},fill:${j(sh.fill || '#4F81BD')},stroke:${j(sh.line || '#385D8A')},strokeWidth:${sh.lineWeight || 2}})\n`;
    // 横幅文字同样防换行：估宽不足则居中扩宽
    const est = estW(sh.text, 28, true);
    let tx = sh.left, tw = sh.width;
    if (est > sh.width) { tw = +(est + 2).toFixed(1); tx = +(sh.left - (tw - sh.width) / 2).toFixed(1); }
    s0 += `Insert(${sheetKey}F,{type:"text",name:${j('bannertxt:' + sh.text)},content:${j(sh.text || '')},x:${tx},y:${sh.top},width:${tw},height:${sh.height},fontSize:28,fontWeight:"bold",textAlign:"center",textAlignVertical:"middle",textGrowth:"fixed-width-height",fill:"#000000",fontFamily:${j(fontOf(sh.text || ''))}})\n`;
  }
  files.push(['00-frame', s0]);

  // 1) fills
  const fillChunks = chunk(built.fillRects, 350);
  fillChunks.forEach((cs, i) => {
    let s = `const F=${sheetKey}F\nconst D=[\n`;
    s += cs.map(r => `[${r.x},${r.y},${r.w},${r.h},${j(r.color).replace(/"/g, "'")},${j(r.name).replace(/"/g, "'")}]`).join(',\n');
    s += `\n]\nfor(const d of D)Insert(F,{type:"rectangle",name:d[5],x:d[0],y:d[1],width:d[2],height:d[3],fill:d[4]})`;
    files.push([`10-fills-${i}`, s]);
  });

  // 2) texts
  const textChunks = chunk(built.texts, 130);
  textChunks.forEach((cs, i) => {
    let s = `const F=${sheetKey}F\nconst T=[\n`;
    s += cs.map(t => `[${j(t.content)},${t.x},${t.y},${t.w},${t.h},${t.size},${t.bold ? 1 : 0},${t.rot},${j(t.align)},${j(t.valign)},${j(t.color)},${j(fontOf(t.content))}]`).join(',\n');
    s += `\n]\nlet k=0\nfor(const t of T){Insert(F,{type:"text",name:"t"+(${i}*130)+"_"+k,content:t[0],x:t[1],y:t[2],width:t[3],height:t[4],fontSize:t[5],fontWeight:t[6]?"bold":"normal",rotation:t[7],textAlign:t[8],textAlignVertical:t[9],textGrowth:"fixed-width-height",fill:t[10],fontFamily:t[11]});k++}`;
    files.push([`20-texts-${i}`, s]);
  });

  // 3) borders (single path)
  if (built.borderGeo) {
    files.push(['30-borders', `Insert(${sheetKey}F,{type:"path",name:"grid-borders",x:0,y:0,width:${built.W.toFixed(1)},height:${built.H.toFixed(1)},viewBox:[0,0,${built.W.toFixed(1)},${built.H.toFixed(1)}],geometry:${j(built.borderGeo)},stroke:"#000000",strokeWidth:0.75})`]);
  }

  // 4) connector（肘形箭头）：按 180° 旋转后的最终绝对坐标直接绘制，箭头三角并入同一 path
  for (const sh of shapes.filter(x => x.isConnector)) {
    const l = sh.left, t = sh.top, w = sh.width, h = sh.height;
    const P = 20; // 边距，保证三角不出界
    const col = sh.line || '#4F81BD';
    // 原折线 (0,0)->(w/2,0)->(w/2,h)->(w,h) 旋转180°后：(w,h)->(w/2,h)->(w/2,0)->(0,0)，箭头端点(0,0)朝左
    const geo = `M${(w + P).toFixed(1)} ${(h + P).toFixed(1)}L${(w / 2 + P).toFixed(1)} ${(h + P).toFixed(1)}L${(w / 2 + P).toFixed(1)} ${P}L${P} ${P}M${P} ${P}L${P + 10} ${P - 6}L${P + 10} ${P + 6}Z`;
    const s = `Insert(${sheetKey}F,{type:"path",name:"elbow-arrow",x:${(l - P).toFixed(1)},y:${(t - P).toFixed(1)},width:${(w + 2 * P).toFixed(1)},height:${(h + 2 * P).toFixed(1)},viewBox:[0,0,${(w + 2 * P).toFixed(1)},${(h + 2 * P).toFixed(1)}],geometry:${j(geo)},stroke:${j(col)},strokeWidth:${sh.lineWeight || 2},fill:${j(col)}})`;
    files.push(['40-arrow', s]);
  }
  return files;
}

// ---- 主流程 ----
if (require.main !== module) {
  // 被 require 时（如 gen-pages.js 复用边框几何），不执行副作用主流程
  module.exports = { parseStyles, parseSheet, build, estW, shapesOf };
} else {
const cfg = [
  { key: 'L20', name: 'L20', xml: 'sheet-L20.xml', frameX: 0 },
  { key: 'L20x2', name: 'L20 (2)', xml: 'sheet-L20__2_.xml', frameX: null },
  { key: 'L40', name: 'L40', xml: 'sheet-L40.xml', frameX: null },
];
const results = {};
for (const c of cfg) {
  const sheet = parseSheet(path.join(DATA, c.xml));
  const built = build(sheet);
  results[c.key] = { name: c.name, W: +sheet.W.toFixed(1), H: +sheet.H.toFixed(1), fills: built.fillRects.length, texts: built.texts.length };
  c.built = built; c.sheet = sheet;
}
// frame X 布局：横向排开，间隔 200
let x = 0;
for (const c of cfg) { c.frameX = x; x += c.sheet.W + 200; }
const shapesJson = path.join(DATA, 'shapes.json');
for (const c of cfg) {
  const shapes = shapesOf(shapesJson, c.name, c.sheet.W);
  const files = emit(c.key, c.name, c.built, shapes, Math.round(c.frameX));
  for (const [suffix, content] of files) {
    const fn = `${c.key}-${suffix}.js`;
    fs.writeFileSync(path.join(OUT, fn), content);
  }
  c.files = files.map(([s]) => `${c.key}-${s}.js`);
  fs.writeFileSync(path.join(DATA, `elements-${c.key}.json`), JSON.stringify({ fills: c.built.fillRects, texts: c.built.texts, W: c.sheet.W, H: c.sheet.H, shapes }, null, 1));
}
fs.writeFileSync(path.join(OUT, '_order.json'), JSON.stringify(cfg.map(c => ({ key: c.key, name: c.name, frameX: Math.round(c.frameX), W: +c.sheet.W.toFixed(1), H: +c.sheet.H.toFixed(1), files: c.files })), null, 1));
console.log(JSON.stringify({ results, order: cfg.map(c => ({ key: c.key, frameX: Math.round(c.frameX) })) }, null, 1));
}
