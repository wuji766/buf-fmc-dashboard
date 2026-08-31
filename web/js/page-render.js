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
        // 触发 CSS opacity 过渡
        requestAnimationFrame(function () { g.setAttribute('opacity', '1'); });
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

  window.BUF = window.BUF || {};
  window.BUF.render = {
    init: init,
    show: show,
    page: function (i) { return pages[i]; },
    pageCount: function () { return pages.length; },
    svgEl: function () { return svg; },
    cur: function () { return cur; }
  };
  if (typeof module !== 'undefined') module.exports = { buildText: buildText };
})();
