/* BUF FMC 大屏 —— SVG 页面渲染器
 * 文字布局（严格 pencil 语义，fixed-width-height 不换行模式）：
 * 统一在文字的**渲染 AABB** 内按 textAlign/textAlignVertical 精确布局：
 *   rot90  AABB = (x, y-w, h, w)   自下而上读    rotate(-90)
 *   rot270 AABB = (x-h, y, h, w)   自上而下读    rotate(90)
 *   rot0   AABB = (x, y, w, h)
 * 锚点/基线：
 *   align left→AABB.x(anchor=start) center→中心(middle) right→右端(end)
 *   valign top→基线=AABB.y+0.8×size(dominant-baseline=auto)
 *          middle→中心(central)  bottom→AABB.y+AABB.h-0.22×size(auto，留 descender)
 * 旋转文字均为 center/middle：transform=translate(AABB中心) rotate(∓90)。
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
    const size = t.size || 11;
    // 渲染 AABB（pencil 实测语义）
    const aabb = rot === 90 ? { x: t.x, y: t.y - t.w, w: t.h, h: t.w }
      : rot === 270 ? { x: t.x - t.h, y: t.y, w: t.h, h: t.w }
      : { x: t.x, y: t.y, w: t.w, h: t.h };
    const cx = aabb.x + aabb.w / 2, cy = aabb.y + aabb.h / 2;

    let anchor, baseline, tx, ty, deg = 0;
    if (rot === 90 || rot === 270) {
      // pencil 旋转文字均 center/middle，绕 AABB 中心旋转 ∓90
      anchor = 'middle';
      baseline = 'central';
      tx = cx; ty = cy;
      deg = rot === 90 ? -90 : 90;
    } else {
      const align = t.align || 'left', valign = t.valign || 'bottom';
      anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      tx = align === 'center' ? cx : align === 'right' ? aabb.x + aabb.w : aabb.x;
      if (valign === 'middle' || valign === 'center') {
        baseline = 'central'; ty = cy;
      } else if (valign === 'top') {
        // 基线 = 盒顶 + 0.8×size（ ascent 近似，dominant-baseline=auto ）
        baseline = 'auto'; ty = aabb.y + 0.8 * size;
      } else { // bottom：留 descender 余量（Roboto Condensed 实测 descent≈0.29em），不侵入下格
        baseline = 'auto'; ty = aabb.y + aabb.h - 0.29 * size;
      }
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
    var vb = pages[i].vb || [0, 0, pages[i].W, pages[i].H]; // 紧凑包围盒，缺省回退整页
    svg.setAttribute('viewBox', vb[0] + ' ' + vb[1] + ' ' + vb[2] + ' ' + vb[3]);
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
      var by = Math.max(1, r.y - 11); // 徽标行位于站点条上方（页顶越界钳制）
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
