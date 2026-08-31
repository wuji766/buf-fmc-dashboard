/* qa-harness.js — dev-only pencil 保真程序化核验（?qa=1 加载）
 * 对当前页执行四类检查，输出 JSON 到 console 与 window.__QA_REPORT：
 *  1. 文字位置：渲染墨迹盒（getBBox×CTM→根用户坐标）按 align/valign 锚边/中心
 *     与理论 AABB 比对，偏差 >2pt 记录
 *  2. 文字重叠：页内所有文字实际 AABB 两两求交，侵入深度两轴均 >0.5pt 记录
 *  3. 盒容纳：渲染墨迹盒超出理论 AABB 的量（用于 textLength 钳制决策）
 *  4. 边框：path.getTotalLength() 与 borderGeo 线段长度和比对（差 >1% 记录）
 *  5. fill 矩形：DOM rect 数量/坐标与数据比对（应零差异）
 */
(function () {
  'use strict';

  function theoAABB(t) {
    if (t.rot === 90) return { x: t.x, y: t.y - t.w, w: t.h, h: t.w };
    if (t.rot === 270) return { x: t.x - t.h, y: t.y, w: t.h, h: t.w };
    return { x: t.x, y: t.y, w: t.w, h: t.h };
  }

  /* 元素墨迹盒 → 根 svg 用户坐标 AABB
   * 用 canvas measureText（真实字体度量）+ 元素 CTM 定位换算。
   * 实测 Chrome 对 <text> 的 getBBox/getBoundingClientRect 在 webfont 就绪后
   * 存在过期/虚高（单字符可虚高 40%+），不可作为验收依据；
   * canvas 度量与渲染同源（同一字体），是可复现的真值。 */
  function userAABB(svg, el) {
    var m = el.getScreenCTM(), root = svg.getScreenCTM();
    if (!m || !root) return null;
    var toRoot = root.inverse().multiply(m);
    var cs = getComputedStyle(el);
    var ctx = userAABB._ctx || (userAABB._ctx = document.createElement('canvas').getContext('2d'));
    ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var mt = ctx.measureText(el.textContent || ' ');
    var W = mt.width, sz = parseFloat(cs.fontSize);
    var asc = mt.fontBoundingBoxAscent != null ? mt.fontBoundingBoxAscent : sz * 0.9;
    var desc = mt.fontBoundingBoxDescent != null ? mt.fontBoundingBoxDescent : sz * 0.3;
    // 锚点：text-anchor 决定 x 方向伸展；dominant-baseline central → 垂直中心=0，否则基线=0
    var x0 = cs.textAnchor === 'end' ? -W : cs.textAnchor === 'middle' ? -W / 2 : 0;
    var y0, y1;
    if (cs.dominantBaseline === 'central') { y0 = -(asc + desc) / 2; y1 = (asc + desc) / 2; }
    else { y0 = -asc; y1 = desc; }
    var pt = svg.createSVGPoint(), xs = [], ys = [];
    [[x0, y0], [x0 + W, y0], [x0, y1], [x0 + W, y1]].forEach(function (c) {
      pt.x = c[0]; pt.y = c[1];
      var q = pt.matrixTransform(toRoot);
      xs.push(q.x); ys.push(q.y);
    });
    return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
             X: Math.max.apply(null, xs), Y: Math.max.apply(null, ys),
             w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
             h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
  }

  function segLen(s) { return Math.hypot(s[2] - s[0], s[3] - s[1]); }

  function run(pageIdx) {
    var svg = document.getElementById('board');
    var p = BUF.render.page(pageIdx);
    if (!p) return { error: 'no page ' + pageIdx };
    var g = svg.querySelector('g.page[data-page="' + pageIdx + '"]');
    var report = { page: pageIdx, name: p.name,
      posDev: [], overlaps: [], nativeOverlap: 0, overflow: [], border: null, fills: null };

    /* ---- 1&2&3. 文字 ---- */
    var items = [];
    var posTol = 2, ovTol = 0.5;
    (p.texts || []).forEach(function (t) {
      var el = g.querySelector('[id="x_' + t.id + '"]'); // 限定本页组，防跨页 id 撞车
      if (!el) { report.posDev.push({ id: t.id, err: 'MISSING ELEMENT' }); return; }
      var u = userAABB(svg, el);
      if (!u) return;
      var a = theoAABB(t);
      var rot = t.rot || 0;
      items.push({ t: t, u: u, a: a, el: el });

      if (rot) { // 旋转文字 center/middle：中心比对
        var dx = (u.x + u.X) / 2 - (a.x + a.w / 2), dy = (u.y + u.Y) / 2 - (a.y + a.h / 2);
        if (Math.max(Math.abs(dx), Math.abs(dy)) > posTol)
          report.posDev.push({ id: t.id, s: t.content, rot: rot,
            dx: +dx.toFixed(2), dy: +dy.toFixed(2) });
      } else {
        var align = t.align || 'left', valign = t.valign || 'bottom';
        var hx = align === 'center' ? (u.x + u.X) / 2 - (a.x + a.w / 2)
          : align === 'right' ? u.X - (a.x + a.w) : u.x - a.x;
        var vy = (valign === 'middle' || valign === 'center') ? (u.y + u.Y) / 2 - (a.y + a.h / 2)
          : valign === 'top' ? u.y - a.y : u.Y - (a.y + a.h);
        if (Math.max(Math.abs(hx), Math.abs(vy)) > posTol)
          report.posDev.push({ id: t.id, s: t.content, align: align, valign: valign,
            hx: +hx.toFixed(2), vy: +vy.toFixed(2) });
      }
      /* 盒容纳：墨迹盒超出理论 AABB 的量（各向） */
      var ox = Math.max(0, a.x - u.x, u.X - (a.x + a.w));
      var oy = Math.max(0, a.y - u.y, u.Y - (a.y + a.h));
      if (Math.max(ox, oy) > ovTol)
        report.overflow.push({ id: t.id, s: t.content, rot: rot,
          ox: +ox.toFixed(2), oy: +oy.toFixed(2), boxW: a.w, boxH: a.h });
    });

    /* 重叠：y 排序 + 滑窗 */
    items.sort(function (a, b) { return a.u.y - b.u.y; });
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        if (items[j].u.y > items[i].u.Y - ovTol) break;
        var A = items[i].u, B = items[j].u;
        var dx = Math.min(A.X, B.X) - Math.max(A.x, B.x);
        var dy = Math.min(A.Y, B.Y) - Math.max(A.y, B.y);
        if (dx > ovTol && dy > ovTol) {
          /* 理论盒本身已重叠 → pencil 原生重叠（豁免），只统计渲染引入的 */
          var ta = items[i].a, tb = items[j].a;
          var tdx = Math.min(ta.x + ta.w, tb.x + tb.w) - Math.max(ta.x, tb.x);
          var tdy = Math.min(ta.y + ta.h, tb.y + tb.h) - Math.max(ta.y, tb.y);
          if (tdx > ovTol && tdy > ovTol) report.nativeOverlap++;
          else report.overlaps.push({ a: items[i].t.id, b: items[j].t.id,
            sa: items[i].t.content, sb: items[j].t.content,
            dx: +dx.toFixed(2), dy: +dy.toFixed(2),
            at: [+((A.x + B.x) / 2).toFixed(1), +((A.y + B.y) / 2).toFixed(1)] });
        }
      }
    }

    /* ---- 4. 边框 ---- */
    var path = g.querySelector('path');
    var segs = [];
    String(p.borderGeo || '').replace(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g,
      function (_, x0, y0, x1, y1) { segs.push([+x0, +y0, +x1, +y1]); return _; });
    var dataLen = segs.reduce(function (s, g2) { return s + segLen(g2); }, 0);
    if (path && segs.length) {
      var rLen = path.getTotalLength();
      report.border = { segCount: segs.length, dataLen: +dataLen.toFixed(2),
        renderedLen: +rLen.toFixed(2),
        diffPct: +(Math.abs(rLen - dataLen) / dataLen * 100).toFixed(3) };
    } else report.border = { segCount: segs.length, rendered: !!path, dataLen: +dataLen.toFixed(2) };

    /* ---- 5. fill 矩形 ---- */
    var rects = g.querySelectorAll(':scope > rect');
    var fmap = {};
    (p.fills || []).forEach(function (f) { fmap[f.id] = f; });
    report.fills = { dataCount: (p.fills || []).length, domCount: rects.length, diffs: [] };
    rects.forEach(function (r) { // rects 已是 g 作用域内的本页元素
      var f = fmap[r.id.replace(/^r_/, '')];
      if (!f) { report.fills.diffs.push({ id: r.id, err: 'EXTRA' }); return; }
      ['x', 'y', 'width', 'height'].forEach(function (k) {
        if (Math.abs(+r.getAttribute(k) - f[{ x: 'x', y: 'y', width: 'w', height: 'h' }[k]]) > 0.01)
          report.fills.diffs.push({ id: r.id, attr: k });
      });
    });

    report.counts = { texts: (p.texts || []).length,
      posDev: report.posDev.length, overlaps: report.overlaps.length,
      nativeOverlap: report.nativeOverlap, overflow: report.overflow.length };
    return report;
  }

  function boot() {
    var qs = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      var kv2 = kv.split('='); if (kv2[0]) qs[decodeURIComponent(kv2[0])] = decodeURIComponent(kv2[1] || '');
    });
    BUF.render.init();
    var idx = isFinite(+qs.page) ? Math.max(0, Math.min(BUF.render.pageCount() - 1, +qs.page)) : 0;
    BUF.render.show(idx);
    var go = function () {
      var rep = run(idx);
      window.__QA_REPORT = rep;
      console.log('[QA] page ' + idx + ' ' + rep.name, JSON.stringify(rep));
      document.title = '[QA' + idx + ' dev:' + rep.counts.posDev + ' ov:' + rep.counts.overlaps +
        ' nat:' + rep.counts.nativeOverlap + ' ox:' + rep.counts.overflow + '] ' + document.title;
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    else setTimeout(go, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
