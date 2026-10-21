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
    /* Cap the jump. A door is about a metre, not a quarter of the sheet, or hatching and dimension lines weld into a grid. */
    const cap = frac => long * frac;
    return {
      mmPx: mmPx,
      door: Math.min(cap(0.14), Math.max(1400 / mmPx, long * 0.04)),
      win: Math.min(cap(0.2), Math.max(2600 / mmPx, long * 0.055)),
      mid: Math.min(cap(0.16), Math.max(1800 / mmPx, long * 0.045))
    };
  }
  /* Parallel lines packed at an even pitch are tiles, hatching or a grid, not walls.
     A real wall that runs well past the pattern is kept. */
  function dropEvenGrid(segs, longSide) {
    /* Hatch and tile grids are a few hundred millimetres apart. Room walls are further apart than that. */
    const mmPx = Math.max(4, Math.min(24, 14000 / Math.max(longSide, 1)));
    const maxSpace = Math.max(8, Math.min(longSide * 0.045, 450 / mmPx));
    const drop = new Set();
    ["h", "v"].forEach(axis => {
      const L = segs.filter(s => s && s.axis === axis).slice().sort((a, b) => a.c - b.c || a.a - b.a);
      let run = [];
      const flush = () => {
        if (run.length >= 4) {
          const gaps = [];
          for (let i = 1; i < run.length; i++) gaps.push(run[i].c - run[i - 1].c);
          const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          if (mean > 1 && mean <= maxSpace) {
            const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) * (g - mean), 0) / gaps.length);
            if (sd / mean < 0.4) run.forEach(s => drop.add(s));
          }
        }
        run = [];
      };
      L.forEach(s => {
        if (!run.length) { run = [s]; return; }
        if (s.c - run[run.length - 1].c <= maxSpace * 1.35) run.push(s);
        else { flush(); run = [s]; }
      });
      flush();
    });
    return segs.filter(s => {
      if (!drop.has(s)) return true;
      const lens = [];
      drop.forEach(o => { if (o.axis === s.axis && Math.abs(o.c - s.c) < maxSpace * 4) lens.push(o.b - o.a); });
      lens.sort((a, b) => a - b);
      const med = lens[Math.floor(lens.length / 2)] || 0;
      return (s.b - s.a) > med * 1.85 && (s.b - s.a) > longSide * 0.12;
    });
  }
  function segmentExtent(segs) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    segs.forEach(s => {
      const pts = s.axis === "h" ? [[s.a, s.c], [s.b, s.c]] : [[s.c, s.a], [s.c, s.b]];
      pts.forEach(p => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    });
    return { x0, y0, x1, y1 };
  }
  /* Last-resort check on the walls that survived. A leftover lattice is dropped so the quote is not built on it. */
  function scrubWalls(walls, outline) {
    if (!walls || !walls.length) return { walls: walls || [], lowConfidence: false };
    const segs = walls.map(w => {
      const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], horiz = Math.abs(dx) >= Math.abs(dy);
      return {
        w, axis: horiz ? "h" : "v",
        c: horiz ? (w.a[1] + w.b[1]) / 2 : (w.a[0] + w.b[0]) / 2,
        a: horiz ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1]),
        b: horiz ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1])
      };
    });
    const box = bbox(outline && outline.length >= 3 ? outline : [[0, 0], [1, 0], [1, 1]]);
    const long = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1);
    const kept = dropEvenGrid(segs, long);
    const dropped = segs.length - kept.length;
    const low = dropped >= 4 && kept.length <= 1;
    return { walls: kept.map(s => s.w), lowConfidence: low };
  }
  /* Furniture, a door swing and a dimension line sit inside the drawing but do not meet the walls.
     A real internal wall meets the outside walls, or another wall that does. A spur with a free end (the door leaf) does not. */
  function dropFloating(walls, outline, tol) {
    if (!walls || !walls.length) return walls || [];
    const reach = tol > 0 ? tol : 18;
    const near = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy || 1;
      let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)) <= reach;
    };
    const onOutline = p => {
      if (!outline || outline.length < 2) return false;
      for (let i = 0; i < outline.length; i++) if (near(p, outline[i], outline[(i + 1) % outline.length])) return true;
      return false;
    };
    const n = walls.length;
    const parent = [];
    for (let i = 0; i < n; i++) parent.push(i);
    const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const unite = (i, j) => { parent[find(i)] = find(j); };
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = walls[i], b = walls[j];
      if (near(a.a, b.a, b.b) || near(a.b, b.a, b.b) || near(b.a, a.a, a.b) || near(b.b, a.a, a.b)) unite(i, j);
    }
    const rooted = {};
    for (let i = 0; i < n; i++) if (onOutline(walls[i].a) || onOutline(walls[i].b)) rooted[find(i)] = true;
    return walls.filter((w, i) => {
      if (!rooted[find(i)]) return false;
      let aHit = onOutline(w.a), bHit = onOutline(w.b);
      for (let j = 0; j < n && !(aHit && bHit); j++) {
        if (j === i) continue;
        if (!aHit && near(w.a, walls[j].a, walls[j].b)) aHit = true;
        if (!bHit && near(w.b, walls[j].a, walls[j].b)) bHit = true;
      }
      return aHit && bHit;
    });
  }
  /* A line around the building is the house, not the lot. A lot runs well past the walls. */
  function siteLooksLikeLot(site, house) {
    if (!site || site.length < 3 || !house || house.length < 3) return false;
    const s = bbox(site), h = bbox(house);
    const hw = Math.max(1, h.x1 - h.x0), hh = Math.max(1, h.y1 - h.y0);
    const pads = [(h.x0 - s.x0) / hw, (s.x1 - h.x1) / hw, (h.y0 - s.y0) / hh, (s.y1 - h.y1) / hh];
    const beyond = pads.filter(p => p > 0.12).length;
    let hs = 0, ss = 0;
    for (let i = 0; i < house.length; i++) { const a = house[i], b = house[(i + 1) % house.length]; hs += a[0] * b[1] - b[0] * a[1]; }
    for (let i = 0; i < site.length; i++) { const a = site[i], b = site[(i + 1) % site.length]; ss += a[0] * b[1] - b[0] * a[1]; }
    return beyond >= 2 && Math.abs(ss) > Math.abs(hs) * 1.8;
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

  /* The model sometimes returns room points mirrored across the sheet or across the house.
     Walls come from the pixels, so the pose that drops the labelled sizes into faces of the same shape is the plan.
     A face with two labels is open plan and does not vote. */
  const OUTDOOR_NAME = /deck|alfresco|verand|patio|porch|pergola|drive|yard|garden|shed|pool|terrace|balcon|lawn|court|landscap|ramp/i;
  function orientLabels(rooms, sheetW, sheetH, outline, faces) {
    const labs = Array.isArray(rooms) ? rooms : [];
    const W = +sheetW || 0, H = +sheetH || 0;
    if (labs.length < 2 || W <= 0 || H <= 0 || !outline || outline.length < 3 || !faces || faces.length < 2) return { rooms: labs, pose: "same" };
    const b = bbox(outline);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const toPx = (rm) => [(+rm.x || 0) / 1000 * W, (+rm.y || 0) / 1000 * H];
    const poses = [
      { name: "same", map: (p) => p },
      { name: "flipx", map: (p) => [W - p[0], p[1]] },
      { name: "flipy", map: (p) => [p[0], H - p[1]] },
      { name: "rot180", map: (p) => [W - p[0], H - p[1]] },
      { name: "housex", map: (p) => [2 * cx - p[0], p[1]] },
      { name: "housey", map: (p) => [p[0], 2 * cy - p[1]] },
      { name: "house180", map: (p) => [2 * cx - p[0], 2 * cy - p[1]] },
    ];
    const voters = labs.filter((rm) => +rm.width > 0 && +rm.length > 0 && !OUTDOOR_NAME.test(rm.name || ""));
    function score(map) {
      const placed = voters.map((rm, i) => {
        const p = map(toPx(rm));
        let fi = -1;
        for (let f = 0; f < faces.length; f++) if (pip(p, faces[f])) { fi = f; break; }
        return { i, fi, rm, p };
      });
      const count = {};
      placed.forEach((h) => { if (h.fi >= 0) count[h.fi] = (count[h.fi] || 0) + 1; });
      const hits = [];
      placed.forEach((h) => {
        if (h.fi < 0 || count[h.fi] !== 1) return;
        const bb = bbox(faces[h.fi]);
        const px = [bb.x1 - bb.x0, bb.y1 - bb.y0].sort((a, c) => a - c);
        const dm = [+h.rm.width, +h.rm.length].sort((a, c) => a - c);
        if (px[0] < 2 || dm[0] < 2) return;
        const r1 = dm[0] / px[0], r2 = dm[1] / px[1];
        const aspect = Math.abs(r1 / r2 - 1);
        if (aspect >= 0.08) return;
        hits.push({ i: h.i, fi: h.fi, mm: (r1 + r2) / 2, aspect });
      });
      hits.sort((a, c) => a.aspect - c.aspect);
      const usedF = {}, usedR = {}, kept = [];
      hits.forEach((h) => {
        if (usedF[h.fi] || usedR[h.i]) return;
        usedF[h.fi] = true;
        usedR[h.i] = true;
        kept.push(h.mm);
      });
      if (kept.length < 2) return { n: kept.length, rank: kept.length };
      kept.sort((a, c) => a - c);
      const spread = kept[kept.length - 1] / kept[0];
      if (spread > 1.12) return { n: 0, rank: 0 };
      return { n: kept.length, rank: kept.length * 10 - (spread - 1) };
    }
    let best = poses[0], bestS = score(poses[0].map);
    for (let i = 1; i < poses.length; i++) {
      const s = score(poses[i].map);
      if (s.rank > bestS.rank + 0.5) { best = poses[i]; bestS = s; }
    }
    if (best.name === "same" || bestS.n < 2) return { rooms: labs, pose: "same" };
    const map = best.map;
    return {
      pose: best.name,
      rooms: labs.map((rm) => {
        const p = map(toPx(rm));
        return Object.assign({}, rm, { x: Math.round(p[0] / W * 10000) / 10, y: Math.round(p[1] / H * 10000) / 10 });
      }),
    };
  }

  /* Roof sheet on the flat, then the slope. A flat roof is not stretched by a leftover hip pitch.
     Eaves add perimeter × eave, plus a corner square where the outline turns. */
  function roofCoverArea(footprint, perimeter, eaveM, convex, concave, pitchDeg, roofType) {
    const e = Math.max(0, +eaveM || 0);
    const planA = Math.max(0, (+footprint || 0) + (+perimeter || 0) * e + ((+convex || 0) - (+concave || 0)) * e * e);
    const flat = roofType === "flat";
    const pitch = flat ? 0 : Math.max(0, Math.min(75, +pitchDeg || 0));
    const c = Math.cos(pitch * Math.PI / 180);
    const slope = c > 0.2 ? 1 / c : 1;
    return { planA, roofA: planA * slope, pitch };
  }
  /* Lowest point of the sheet, at the outer eave. It sits on the wall plate so the walls cannot stick up through it. */
  function roofSeat(wallHmm, eaveMm, pitchDeg, roofType) {
    const H = Math.max(0, +wallHmm || 0) / 1000;
    const flat = roofType === "flat";
    const pitch = flat ? 0 : Math.max(0, Math.min(75, +pitchDeg || 0));
    const t = Math.tan(pitch * Math.PI / 180);
    const cover = 0.05;
    return { base: H + cover, t, cover, plate: H };
  }
  /* One light in a small room. Living and kitchen get one per 8 m², not a downlight every 2.5 m². */
  function defaultLights(net, type) {
    const a = Math.max(0, +net || 0);
    if (type === "robe" || type === "wc") return 1;
    if (type === "living" || type === "kitchen") return Math.max(1, Math.ceil(a / 8));
    if (a < 16) return 1;
    return Math.max(1, Math.ceil(a / 10));
  }
  /* Shared circuit, not a private run from the board to every point. */
  function elecCable(p) {
    p = p || {};
    const power = Math.max(0, +p.powerPts || 0);
    const lights = Math.max(0, +p.lights || 0);
    const extra = Math.max(0, (+p.switches || 0) + (+p.fans || 0) + (+p.smoke || 0));
    const ac = Math.max(0, +p.ac || 0);
    return { powerM: Math.ceil(power * 5 + ac * 8), lightM: Math.ceil(lights * 4 + extra * 2) };
  }

  const api = { orderDrawings, roofUncovered, scaleDrawing, mergeQty, gapLimits, scaleMmPerPx, dropEvenGrid, dropFloating, segmentExtent, scrubWalls, siteLooksLikeLot, orientLabels, roofCoverArea, roofSeat, defaultLights, elecCable, HOUSE_ONCE, pip, bbox };
  root.TraceGeom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
