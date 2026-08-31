/* BUF FMC 大屏 —— SVG 页面渲染器
 * 约定：文字渲染后中心 = 旋转后 AABB 中心。
 *   rot90  AABB = (x, y-w, h, w)   → 中心 (x+h/2, y)          rotate(-90)
 *   rot270 AABB = (x-h, y, h, w)   → 中心 (x-h/2, y+w/2)      rotate(90)
 *   rot0   水平按 align/valign 做锚点。
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let svg = null, pages = [], groups = [], cur = -1;

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function fontOf(t) {
    return t.font === 'Roboto Condensed'
      ? "'Roboto Condensed','Noto Sans SC',sans-serif"
      : "'Noto Sans SC',sans-serif";
  }

  function buildText(t) {
    const rot = t.rot || 0;
    let anchor, baseline, tx, ty, deg = 0;
    if (rot === 90 || rot === 270) {
      anchor = 'middle';
      baseline = 'central';
      if (rot === 90) {
        tx = t.x + t.h / 2;
        ty = t.y; // AABB=(x, y-w, h, w) 中心
        deg = -90;
      } else {
        tx = t.x - t.h / 2;
        ty = t.y + t.w / 2; // AABB=(x-h, y, h, w) 中心
        deg = 90;
      }
    } else {
      anchor = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start';
      if (t.valign === 'middle' || t.valign === 'center') baseline = 'central';
      else if (t.valign === 'top') baseline = 'hanging';
      else baseline = 'auto'; // bottom：基线贴盒底
      tx = t.x + (t.align === 'center' ? t.w / 2 : t.align === 'right' ? t.w : 0);
      ty = t.y + (t.valign === 'middle' || t.valign === 'center' ? t.h / 2 : t.valign === 'top' ? 0 : t.h);
    }
    const e = el('text', {
      x: 0, y: 0,
      fill: t.color,
      'font-size': t.size,
      'font-family': fontOf(t),
      'text-anchor': anchor,
      'dominant-baseline': baseline
    });
    if (t.bold) e.setAttribute('font-weight', 'bold');
    e.textContent = t.content;
    e.setAttribute('transform', 'translate(' + (+tx).toFixed(2) + ',' + (+ty).toFixed(2) + ') rotate(' + deg + ')');
    return e;
  }

  function buildPage(p, i) {
    const g = el('g', { 'class': 'page', 'data-page': i });
    for (const f of (p.fills || [])) {
      g.appendChild(el('rect', {
        id: 'r_' + f.id,
        x: f.x, y: f.y, width: f.w, height: f.h, fill: f.color
      }));
    }
    if (p.borderGeo) {
      g.appendChild(el('path', { d: p.borderGeo, stroke: '#000', 'stroke-width': 0.75, fill: 'none' }));
    }
    for (const t of (p.texts || [])) {
      const e = buildText(t);
      e.setAttribute('id', 'x_' + t.id);
      g.appendChild(e);
    }
    return g;
  }

  function init() {
    svg = document.getElementById('board');
    pages = window.BUF_PAGES || [];
    groups = pages.map((p, i) => {
      const g = buildPage(p, i);
      g.setAttribute('display', 'none');
      svg.appendChild(g);
      return g;
    });
  }

  function show(i) {
    if (i < 0 || i >= pages.length) return null;
    groups.forEach(function (g, j) {
      if (j === i) {
        g.removeAttribute('display');
        g.setAttribute('opacity', '0');
        // 触发 CSS opacity 过渡（双重 rAF 确保初始 opacity=0 先完成布局）
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { g.setAttribute('opacity', '1'); });
        });
      } else {
        g.setAttribute('display', 'none');
      }
    });
    svg.setAttribute('viewBox', '0 0 ' + pages[i].W + ' ' + pages[i].H);
    cur = i;
    const nm = document.getElementById('pageName');
    if (nm) nm.textContent = pages[i].name;
    return pages[i];
  }

  /* ---- 实时状态刷新（Task 4） ---- */
  var STATUS_COLOR = { normal: '#00FF00', preFull: '#92D050', full: '#FF66FF' };
  // 容量大字（保持原排列顺序，仅重写数字段）："NAME  used(total)  pct%"
  var CAP_RE_FWD = /^(\S+)(\s+)(\d+)(\()(\d+)(\)\s+)(\d+)(%)$/;
  var CAP_RE_REV = /^(\d+)(%\s*\()(\d+)(\))(\d+)(\s+)(\S+)$/;

  function rewriteCapacity(textEl, cap) {
    var c = textEl.textContent || '';
    var m = c.match(CAP_RE_FWD);
    if (m) {
      textEl.textContent = m[1] + m[2] + cap.used + m[4] + cap.total + m[6] + cap.pct + m[8];
      return;
    }
    m = c.match(CAP_RE_REV);
    if (m) {
      textEl.textContent = cap.pct + m[2] + cap.total + m[4] + cap.used + m[6] + m[7];
    }
  }

  function applyStates(pageIdx, stations) {
    var p = pages[pageIdx];
    if (!p || !stations) return;
    var bySite = {};
    stations.forEach(function (st) { bySite[st.siteId] = st; });
    (p.sites || []).forEach(function (s) {
      var st = bySite[s.siteId];
      if (!st) return;
      var rect = document.getElementById('r_' + s.rectId);
      if (!rect) return;
      var orig = rect.getAttribute('data-orig-fill') || rect.getAttribute('fill');
      if (orig) rect.setAttribute('data-orig-fill', orig);
      if (st.status === 'alarm') {
        rect.setAttribute('fill', orig); // 保留原 fill
        rect.classList.add('alarm-pulse'); // 脉冲样式 Task 5 完善
      } else {
        rect.classList.remove('alarm-pulse');
        if (STATUS_COLOR[st.status]) rect.setAttribute('fill', STATUS_COLOR[st.status]);
      }
      if (!st.capacity) return;
      (s.textIds || []).forEach(function (tid) {
        var t = document.getElementById('x_' + tid);
        if (t) rewriteCapacity(t, st.capacity);
      });
    });
  }

  function drawBadge(layer, x, y, label) {
    var bw = Math.max(10, label.length * 5.5 + 3);
    layer.appendChild(el('rect', { x: x, y: y, width: bw, height: 10, fill: '#000' }));
    var t = el('text', {
      x: x + bw / 2, y: y + 5, fill: '#FFF', 'font-size': 8,
      'font-family': "'Roboto Condensed','Noto Sans SC',sans-serif",
      'text-anchor': 'middle', 'dominant-baseline': 'central'
    });
    t.textContent = label;
    layer.appendChild(t);
  }

  function applyLots(pageIdx, lots) {
    var p = pages[pageIdx];
    if (!p || !lots) return;
    var g = groups[pageIdx];
    if (!g) return;
    var layer = g.querySelector('.lots-layer');
    if (!layer) {
      layer = el('g', { 'class': 'lots-layer' });
      g.appendChild(layer); // 追加在最后 → 覆盖站点之上
    }
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    var bySite = {};
    lots.forEach(function (l) {
      (bySite[l.stationId] = bySite[l.stationId] || []).push(l);
    });
    (p.sites || []).forEach(function (s) {
      var ls = bySite[s.siteId];
      if (!ls || !ls.length || !s.rect) return;
      var shown = ls.slice(0, 3);
      var extra = ls.length - 3;
      var r = s.rect;
      var by = r.y - 11; // 徽标行位于站点条上方
      var bx = r.x + r.w;
      // 从右往左画，最多 3 个 + "+n"
      for (var k = shown.length - 1; k >= 0; k--) {
        var label = shown[k].id != null ? String(shown[k].id) : '?';
        var bw = Math.max(10, label.length * 5.5 + 3);
        bx -= bw + 1;
        drawBadge(layer, bx, by, label);
      }
      if (extra > 0) {
        var el2 = '+' + extra;
        var bw2 = Math.max(10, el2.length * 5.5 + 3);
        bx -= bw2 + 1;
        drawBadge(layer, bx, by, el2);
      }
    });
  }

  window.BUF = window.BUF || {};
  window.BUF.render = {
    init: init,
    show: show,
    page: function (i) { return pages[i]; },
    pageCount: function () { return pages.length; },
    svgEl: function () { return svg; },
    cur: function () { return cur; },
    applyStates: applyStates,
    applyLots: applyLots
  };
  if (typeof module !== 'undefined') module.exports = { buildText: buildText };
})();
