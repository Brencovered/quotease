/* Shared plan geometry for the house tracer and its tests.
   Loaded as a classic script in the planner, and required from vitest. */
(function (root) {
  function pip(p, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])) c = !c;
    }
    return c;
  }
  function bbox(P) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    P.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    return { x0, y0, x1, y1 };
  }

  /* Ground floor first. On a sheet, the lower drawing is the ground floor and a side-by-side pair starts on the left.
     Pages stacked in document order keep page 1 (the top of the stack) as the ground floor. */
  function orderDrawings(drawings, pageOrder) {
    const items = drawings.slice();
    const cy = r => r.box.y + r.box.h / 2, cx = r => r.box.x + r.box.w / 2;
    if (pageOrder) {
      items.sort((a, b) => cy(a) - cy(b) || cx(a) - cx(b));
      return { items, hint: "page" };
    }
    const ys = items.map(cy), xs = items.map(cx);
    const ySpan = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    const xSpan = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    if (ySpan > xSpan * 1.15) {
      items.sort((a, b) => cy(b) - cy(a) || cx(a) - cx(b));
      return { items, hint: "lower" };
    }
    items.sort((a, b) => cx(a) - cx(b) || cy(a) - cy(b));
    return { items, hint: "left" };
  }

  /* Fraction of the lower floor that still needs a roof: the part the floor above does not cover.
     dx, dy move the upper outline into the lower floor's coordinates (the same shift the 3D model uses). */
  function roofUncovered(lower, upper, dx, dy) {
    if (!lower || lower.length < 3) return 1;
    if (!upper || upper.length < 3) return 1;
    const moved = upper.map(p => [p[0] + (dx || 0), p[1] + (dy || 0)]);
    const b = bbox(lower);
    const n = 28;
    let inside = 0, covered = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = [b.x0 + (b.x1 - b.x0) * (i + 0.5) / n, b.y0 + (b.y1 - b.y0) * (j + 0.5) / n];
      if (!pip(p, lower)) continue;
      inside++;
      if (pip(p, moved)) covered++;
    }
    if (!inside) return 1;
    return Math.max(0, Math.min(1, 1 - covered / inside));
  }

  function scalePt(p, fx, fy) { return [p[0] * fx, p[1] * fy]; }
  /* Scale a floor's markup when the same plan is replaced by a sharper image. */
  function scaleDrawing(d, fx, fy) {
    if (!d || !(fx > 0) || !(fy > 0)) return d;
    if (d.outline) d.outline = d.outline.map(p => scalePt(p, fx, fy));
    (d.walls || []).forEach(w => { w.a = scalePt(w.a, fx, fy); w.b = scalePt(w.b, fx, fy); });
    (d.openings || []).forEach(o => { if (o.pt) o.pt = scalePt(o.pt, fx, fy); });
    (d.rooms || []).forEach(r => { if (r.pt) r.pt = scalePt(r.pt, fx, fy); });
    (d.items || []).forEach(it => { if (it.pt) it.pt = scalePt(it.pt, fx, fy); });
    (d.runs || []).forEach(r => { if (r.pts) r.pts = r.pts.map(p => [p[0] * fx, p[1] * fy].concat(p.slice(2))); });
    (d.areas || []).forEach(a => { if (a.a) a.a = scalePt(a.a, fx, fy); if (a.b) a.b = scalePt(a.b, fx, fy); });
    if (d.site) d.site = d.site.map(p => scalePt(p, fx, fy));
    if (d.shift) d.shift = [d.shift[0] * fx, d.shift[1] * fy];
    return d;
  }

  /* One per dwelling, not one per floor. */
  const HOUSE_ONCE = { "h:elec:board": 1, "h:plumb:hws": 1, "h:elec:cook": 1 };
  /* Door and window gaps in pixels. A pen stroke is not a 230 mm wall, so a thin plan uses the drawing size.
     A stroke only counts as filled poche when it is a real fraction of the sheet. Upscaling a 1 px pen can make it 8 px wide. */
  function gapLimits(long, text) {
    const mmPxPlan = Math.max(4, Math.min(24, 14000 / long));
    const wallLike = text >= 8 && text >= long * 0.008;
    const mmPxWall = wallLike ? Math.min(40, Math.max(4, 230 / text)) : null;
    const mmPx = mmPxWall != null ? Math.min(mmPxWall, mmPxPlan * 1.75) : mmPxPlan;
    return { mmPx: mmPx, door: Math.max(1250 / mmPx, long * 0.22), win: Math.max(4000 / mmPx, long * 0.36), mid: Math.max(2200 / mmPx, long * 0.28) };
  }
  /* Millimetres per pixel of the original plan. longPx and textPx are in that image, not an upscaled working copy. */
  function scaleMmPerPx(longPx, textPx) {
    const plan = Math.max(4, Math.min(24, 14000 / Math.max(longPx, 1)));
    const wallLike = textPx >= 4 && textPx >= longPx * 0.008;
    if (!wallLike) return plan;
    return Math.min(plan * 1.75, Math.min(40, Math.max(4, 230 / textPx)));
  }
  function mergeQty(key, prev, next) {
    if (HOUSE_ONCE[key]) return Math.max(prev, next);
    return Math.round((prev + next) * 100) / 100;
  }

  const api = { orderDrawings, roofUncovered, scaleDrawing, mergeQty, gapLimits, scaleMmPerPx, HOUSE_ONCE, pip, bbox };
  root.TraceGeom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
