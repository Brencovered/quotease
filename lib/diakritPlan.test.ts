import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const FIX = path.resolve("test/fixtures/diakrit-single-storey.png");
/* The plan the owner uploaded: thick black poche, small house on a large white sheet. */
const FIX_SHA256 = "a67461e5382dea179c3759c67fd724e2cc57438f1123914654cec2bd98bcb5a0";
/* The five photos of that house. Offline tests do not call the vision model. They pin the bytes and check that a weatherboard and skillion read cannot change the plan. */
const PHOTO_SHA: Record<string, string> = {
  "covered-deck.jpg": "100efe358224f6528400c9ed9ff398d8f00dcafe30c875ca6eadc53156ff2a19",
  "living-dining.jpg": "a2c7579ed2f59602ebe1a643ff41e6c7f6e941f804d5caa63010da412764920b",
  "living-fireplace.jpg": "e7731446d9ddc96d5c797023fb9e364beb62f47be2d5a69450e782cec3b9d777",
  "living-stone.jpg": "95acd61d797a7a1fe537e1201ba8baad268b73d21704ecaecf620aca5d140c61",
  "rear-elevation.jpg": "a4e770a3157aa643641c75c3b98a4dc0b41e8a87971c223ac0d99ee89ec35ed1",
};

/* Label positions are 0–1000 of the sheet. Sizes are millimetres, as printed on the plan.
   Living and Dining share one open face, so their sizes must not veto the scale.
   The two bedrooms that close (3.5×3.0 and 4.2×3.2) are what the scale is taken from.
   The top bedroom (3.7×3.2) is drawn, but its partition is not a continuous thick wall, so it is not a separate face and must not be glued onto the living room name. */
const ROOMS = [
  { name: "Living", x: 437, y: 551, width: 9300, length: 3000 },
  { name: "Dining", x: 465, y: 593, width: 3800, length: 2800 },
  { name: "Kitchen", x: 446, y: 569 },
  { name: "Laundry", x: 380, y: 559 },
  { name: "Bath", x: 380, y: 631 },
  { name: "Bedroom", x: 388, y: 694, width: 3500, length: 3000 },
  { name: "Bedroom", x: 455, y: 692, width: 4200, length: 3200 },
  { name: "Robe", x: 419, y: 715 },
  { name: "Ensuite", x: 419, y: 699 },
  { name: "Bedroom", x: 430, y: 480, width: 3700, length: 3200 },
  { name: "Alfresco", x: 385, y: 390 },
  { name: "Deck", x: 538, y: 569 },
  { name: "Ramp", x: 500, y: 640 },
  { name: "Driveway", x: 615, y: 732 },
  { name: "Shed", x: 377, y: 341 },
];

function chromePath() {
  const candidates = [process.env.CHROME_PATH, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome"].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function serve(dir: string, port: number) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.join(dir, url === "/" ? "/planner/plan-trace.html" : url);
    if (!file.startsWith(path.resolve(dir))) { res.writeHead(403); res.end("no"); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("missing"); return; }
    const ext = path.extname(file);
    const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise<http.Server>((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

describe("Diakrit poche plan", () => {
  it("uses the owner's uploaded sheet as the fixture", () => {
    const buf = fs.readFileSync(FIX);
    expect(createHash("sha256").update(buf).digest("hex")).toBe(FIX_SHA256);
    expect(buf.length).toBeGreaterThan(50_000);
  });

  it("keeps the house photos that were read with this plan", () => {
    const dir = path.resolve("test/fixtures/house-rear");
    for (const [name, sha] of Object.entries(PHOTO_SHA)) {
      const buf = fs.readFileSync(path.join(dir, name));
      expect(createHash("sha256").update(buf).digest("hex"), name).toBe(sha);
    }
  });

  it("follows the house walls and scales from the labelled rooms", async () => {
    const chrome = chromePath();
    let puppeteer: { launch: (opts: object) => Promise<{ newPage: () => Promise<Page>; close: () => Promise<void> }> } | null = null;
    try { puppeteer = require("puppeteer-core"); } catch { puppeteer = null; }
    if (!chrome || !puppeteer) return;

    const png = fs.readFileSync(FIX);
    const server = await serve(path.resolve("public"), 8779);
    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: "new",
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(90000);
      await page.setViewport({ width: 1500, height: 900, deviceScaleFactor: 1 });
      const errors: string[] = [];
      page.on("pageerror", (e: Error) => errors.push(String(e).slice(0, 240)));
      await page.evaluateOnNewDocument(() => {
        window.fetch = async (input: RequestInfo | URL) => {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          if (url.includes("trace-draft")) {
            let rooms: unknown[] = [];
            try { rooms = JSON.parse(sessionStorage.getItem("rooms") || "[]"); } catch { /* empty draft */ }
            return new Response(JSON.stringify({
              draft: { rooms, openings: [{ type: "garage", x: 420, y: 480 }, { type: "garage", x: 480, y: 500 }] },
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } });
        };
      });
      await page.goto("http://127.0.0.1:8779/planner/plan-trace.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#ulFile");
      await page.evaluate((rooms) => sessionStorage.setItem("rooms", JSON.stringify(rooms)), ROOMS);
      await page.evaluate(async (b64) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const file = new File([arr], "diakrit-single-storey.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.querySelector("#ulFile") as HTMLInputElement;
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, png.toString("base64"));
      await page.waitForFunction(() => {
        const btn = document.querySelector("#aiBtn");
        if (btn && /Tracing/.test(btn.textContent || "")) return false;
        const f = document.querySelector("#flash");
        const t = f instanceof HTMLElement && !f.hidden ? (f.textContent || "") : "";
        return !!t && !/Opening the plan|Finding the walls/.test(t);
      });

      const data = await page.evaluate(() => {
        const outl = document.querySelector("#ed .outl");
        const pts = (outl?.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean).map((s) => s.split(",").map(Number));
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const box = pts.length ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } : null;
        const walls = [...document.querySelectorAll("#ed .iw")].map((e) => ({
          x1: +e.getAttribute("x1")!, y1: +e.getAttribute("y1")!, x2: +e.getAttribute("x2")!, y2: +e.getAttribute("y2")!,
        }));
        const labels = [...document.querySelectorAll("#ed .rlab")].map((e) => {
          const next = e.nextElementSibling;
          return {
            t: e.textContent || "",
            x: +(e.getAttribute("x") || 0),
            y: +(e.getAttribute("y") || 0),
            orphan: e.classList.contains("orphan"),
            area: next && next.classList.contains("rarea") ? (next.textContent || "") : "",
          };
        });
        const site = document.querySelector("#ed .site");
        let siteBox = null as null | { x0: number; y0: number; x1: number; y1: number };
        if (site) {
          const sp = (site.getAttribute("points") || "").trim().split(/\s+/).map((s) => s.split(",").map(Number));
          const sx = sp.map((p) => p[0]), sy = sp.map((p) => p[1]);
          siteBox = { x0: Math.min(...sx), y0: Math.min(...sy), x1: Math.max(...sx), y1: Math.max(...sy) };
        }
        const img = document.querySelector("#ed image");
        const tab = document.querySelector("#tab-plan")?.textContent || "";
        const px = tab.match(/1 m is ([\d.]+) px/);
        const foot = tab.match(/Footprint\s*([\d.]+)/);
        const openings = [...document.querySelectorAll("#ed .op")].map((e) => {
          const cls = (e.getAttribute("class") || "").split(/\s+/);
          return cls.find((c) => c === "door" || c === "window" || c === "slider" || c === "garage") || "";
        });
        const areas = [...document.querySelectorAll("#ed polygon.area")].map((el) => {
          const next = el.nextElementSibling;
          const pts = (el.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean).map((s) => s.split(",").map(Number));
          const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
          return {
            cls: el.getAttribute("class") || "",
            name: next && next.tagName === "text" ? (next.textContent || "") : "",
            cx: xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0,
            cy: ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0,
          };
        });
        return {
          box, walls, labels, siteBox, openings, areas, corners: pts.length,
          underlay: img ? { w: +img.getAttribute("width")!, h: +img.getAttribute("height")! } : null,
          pxPerM: px ? +px[1] : null,
          footprint: foot ? +foot[1] : null,
          flash: document.querySelector("#flash")?.textContent || "",
          hint: document.querySelector("#stats .hint")?.textContent || "",
        };
      });

      expect(errors, errors.join("\n")).toEqual([]);
      expect(data.underlay?.w).toBeGreaterThan(2000);
      expect(data.box, data.flash).toBeTruthy();
      const box = data.box!;
      const ow = box.x1 - box.x0, oh = box.y1 - box.y0;
      const sheetW = data.underlay!.w, sheetH = data.underlay!.h;
      // The red outline is the house, not the empty margin around it.
      expect(ow).toBeGreaterThan(250);
      expect(ow).toBeLessThan(sheetW * 0.25);
      expect(oh).toBeGreaterThan(250);
      expect(oh).toBeLessThan(sheetH * 0.5);
      expect(box.x0).toBeGreaterThan(sheetW * 0.2);
      expect(box.x1).toBeLessThan(sheetW * 0.7);
      expect(box.y0).toBeGreaterThan(sheetH * 0.25);

      expect(data.walls.length).toBeGreaterThanOrEqual(8);
      expect(data.walls.length).toBeLessThanOrEqual(18);
      for (const w of data.walls) {
        const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
        expect(len).toBeLessThan(Math.max(ow, oh) * 0.85);
        // A line through the yard or the sheet margin sticks out of the house box.
        for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
          expect(x).toBeGreaterThan(box.x0 - 24);
          expect(x).toBeLessThan(box.x1 + 24);
          expect(y).toBeGreaterThan(box.y0 - 24);
          expect(y).toBeLessThan(box.y1 + 24);
        }
      }

      const text = data.labels.map((l) => l.t).join(" | ");
      const orphans = data.labels.filter((l) => l.orphan).map((l) => l.t);
      // The top bedroom has no thick wall of its own, so it may sit outside a closed room. It must not be renamed onto the living room.
      expect(orphans.every((t) => /^Bedroom/.test(t))).toBe(true);
      expect(orphans.length).toBeLessThanOrEqual(1);
      const named = data.labels.filter((l) => !l.orphan).map((l) => l.t).join(" | ");
      expect(named).not.toMatch(/\/ Bedroom|Bedroom \//);
      for (const name of ["Living", "Dining", "Kitchen", "Laundry", "Bath", "Bedroom", "Robe", "Ensuite"]) {
        expect(text, text).toContain(name);
      }
      expect(text).not.toMatch(/Driveway|Shed/i);
      expect(data.corners).toBeLessThanOrEqual(4);
      expect(data.openings).not.toContain("garage");
      expect(data.openings.filter((t) => t === "slider" || t === "window").length).toBeGreaterThan(0);
      const areaNames = data.areas.map((a) => a.name).join(" | ");
      for (const name of ["Alfresco", "Deck", "Ramp"]) expect(areaNames, areaNames).toMatch(new RegExp(name, "i"));
      expect(areaNames).not.toMatch(/Driveway|Shed/i);
      expect(data.areas.every((a) => /\bdeck\b/.test(a.cls))).toBe(true);

      expect(data.flash).toMatch(/Scale set from the room sizes/);
      expect(data.hint).not.toMatch(/AI draft/);
      expect(data.pxPerM).toBeGreaterThan(30);
      expect(data.pxPerM).toBeLessThan(45);
      expect(data.footprint).toBeGreaterThan(85);
      expect(data.footprint).toBeLessThan(120);

      if (data.siteBox) {
        const sw = data.siteBox.x1 - data.siteBox.x0;
        expect(sw).toBeLessThan(sheetW * 0.7);
        expect(data.siteBox.x0).toBeGreaterThan(40);
      }
      expectLayout(data);

      const roof = await page.evaluate(() => {
        const num = (re: RegExp) => {
          const t = document.querySelector(".summary")?.textContent || "";
          const m = t.match(re);
          return m ? parseFloat(m[1]) : 0;
        };
        const hip = num(/Roof area\s*([\d.]+)/);
        const foot = num(/Footprint\s*([\d.]+)/);
        const el = document.querySelector('[data-set="roofType"]') as HTMLSelectElement | null;
        if (el) { el.value = "flat"; el.dispatchEvent(new Event("change", { bubbles: true })); }
        const flat = num(/Roof area\s*([\d.]+)/);
        return { hip, foot, flat };
      });
      expect(roof.foot).toBeGreaterThan(100);
      expect(roof.foot).toBeLessThan(115);
      expect(roof.hip).toBeGreaterThan(120);
      expect(roof.hip).toBeLessThan(150);
      expect(roof.flat).toBeGreaterThan(roof.foot);
      expect(roof.flat).toBeLessThan(roof.hip);
      expect(roof.flat).toBeLessThan(140);
      await page.evaluate(() => { const b = document.querySelector('[data-tab="materials"]'); if (b instanceof HTMLElement) b.click(); });
      const qty = await page.evaluate(() => {
        const row = (name: string) => [...document.querySelectorAll(".mrow")].find((r) => (r.textContent || "").includes(name));
        return {
          text: document.querySelector("#tab-materials")?.textContent || "",
          power: row("Power cable")?.querySelector(".mq")?.textContent || "",
          light: row("Lighting cable")?.querySelector(".mq")?.textContent || "",
        };
      });
      expect(qty.text).not.toContain("matched");
      expect(qty.text).toContain("About 5 m per point");
      expect(qty.text).toContain("About 4 m per light");
      const powerM = parseFloat(qty.power);
      const lightM = parseFloat(qty.light);
      expect(powerM).toBeGreaterThan(40);
      expect(powerM).toBeLessThan(140);
      expect(lightM).toBeGreaterThan(30);
      expect(lightM).toBeLessThan(140);

      // The live model has returned these same rooms mirrored. The browser path must put them back
      // on the traced rooms, or the scale stays on the wall thickness and the names sit on the wrong side.
      const cx = (box.x0 + box.x1) / 2 / sheetW * 1000;
      const poses = [
        ROOMS.map((r) => ({ ...r, x: Math.round((1000 - r.x) * 10) / 10 })),
        ROOMS.map((r) => ({ ...r, x: Math.round((2 * cx - r.x) * 10) / 10 })),
      ];
      const b64 = png.toString("base64");
      for (const rooms of poses) {
        await page.evaluate((next) => sessionStorage.setItem("rooms", JSON.stringify(next)), rooms);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector("#ulFile");
        await page.evaluate(async (src) => {
          const bin = atob(src);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const file = new File([arr], "diakrit-single-storey.png", { type: "image/png" });
          const dt = new DataTransfer();
          dt.items.add(file);
          const input = document.querySelector("#ulFile") as HTMLInputElement;
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }, b64);
        await page.waitForFunction(() => {
          const btn = document.querySelector("#aiBtn");
          if (btn && /Tracing/.test(btn.textContent || "")) return false;
          const f = document.querySelector("#flash");
          const t = f instanceof HTMLElement && !f.hidden ? (f.textContent || "") : "";
          return !!t && !/Opening the plan|Finding the walls/.test(t);
        });
        const again = await page.evaluate(readCanvas);
        expect(errors, errors.join("\n")).toEqual([]);
        expectLayout(again);
      }
    } finally {
      await browser.close();
      server.close();
    }
  }, 180_000);
});

function expectLayout(data: {
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  labels: { t: string; x: number; y: number; orphan: boolean; area: string }[];
  areas: { name: string; cx: number; cy: number; cls: string }[];
  footprint: number | null;
  pxPerM: number | null;
  flash: string;
  openings: string[];
  hint: string;
}) {
  expect(data.flash).toMatch(/Scale set from the room sizes/);
  expect(data.hint).not.toMatch(/AI draft/);
  expect(data.pxPerM).toBeGreaterThan(30);
  expect(data.pxPerM).toBeLessThan(45);
  expect(data.footprint).toBeGreaterThan(95);
  expect(data.footprint).toBeLessThan(120);
  expect(data.openings).not.toContain("garage");
  const box = data.box!;
  const listed = data.labels.map((l) => `${l.t} @${Math.round(l.x)} ${l.area}`).join(" | ");
  const bedBig = data.labels.find((l) => /plan 13\./.test(l.area));
  const bedSmall = data.labels.find((l) => /plan 10\./.test(l.area));
  expect(bedBig, listed).toBeTruthy();
  expect(bedSmall, listed).toBeTruthy();
  expect(bedBig!.x).toBeGreaterThan(bedSmall!.x + 20);
  const laundry = data.labels.find((l) => /^Laundry/.test(l.t));
  const living = data.labels.find((l) => /Living/.test(l.t) && !l.orphan);
  expect(laundry && !laundry.orphan, listed).toBeTruthy();
  expect(living, listed).toBeTruthy();
  expect(laundry!.x).toBeLessThan(living!.x);
  const dining = data.labels.find((l) => /Dining/.test(l.t));
  expect(dining && !dining.orphan, listed).toBeTruthy();
  const ramp = data.areas.find((a) => /ramp/i.test(a.name));
  const alf = data.areas.find((a) => /alfresco/i.test(a.name));
  expect(ramp, data.areas.map((a) => a.name).join(" | ")).toBeTruthy();
  expect(alf).toBeTruthy();
  expect(ramp!.cx).toBeGreaterThan((box.x0 + box.x1) / 2);
  expect(alf!.cy).toBeLessThan(box.y0 + 40);
  const orphans = data.labels.filter((l) => l.orphan).map((l) => l.t);
  expect(orphans.every((t) => /^Bedroom/.test(t)), orphans.join(" | ")).toBe(true);
  expect(orphans.length).toBeLessThanOrEqual(1);
}

function readCanvas() {
  const outl = document.querySelector("#ed .outl");
  const pts = (outl?.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean).map((s) => s.split(",").map(Number));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const box = pts.length ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } : null;
  const labels = [...document.querySelectorAll("#ed .rlab")].map((e) => {
    const next = e.nextElementSibling;
    return {
      t: e.textContent || "",
      x: +(e.getAttribute("x") || 0),
      y: +(e.getAttribute("y") || 0),
      orphan: e.classList.contains("orphan"),
      area: next && next.classList.contains("rarea") ? (next.textContent || "") : "",
    };
  });
  const areas = [...document.querySelectorAll("#ed polygon.area")].map((el) => {
    const next = el.nextElementSibling;
    const poly = (el.getAttribute("points") || "").trim().split(/\s+/).filter(Boolean).map((s) => s.split(",").map(Number));
    const ax = poly.map((p) => p[0]), ay = poly.map((p) => p[1]);
    return {
      cls: el.getAttribute("class") || "",
      name: next && next.tagName === "text" ? (next.textContent || "") : "",
      cx: ax.length ? (Math.min(...ax) + Math.max(...ax)) / 2 : 0,
      cy: ay.length ? (Math.min(...ay) + Math.max(...ay)) / 2 : 0,
    };
  });
  const tab = document.querySelector("#tab-plan")?.textContent || "";
  const px = tab.match(/1 m is ([\d.]+) px/);
  const foot = tab.match(/Footprint\s*([\d.]+)/);
  const openings = [...document.querySelectorAll("#ed .op")].map((e) => {
    const cls = (e.getAttribute("class") || "").split(/\s+/);
    return cls.find((c) => c === "door" || c === "window" || c === "slider" || c === "garage") || "";
  });
  return {
    box, labels, areas, openings,
    pxPerM: px ? +px[1] : null,
    footprint: foot ? +foot[1] : null,
    flash: document.querySelector("#flash")?.textContent || "",
    hint: document.querySelector("#stats .hint")?.textContent || "",
  };
}

interface Page {
  setDefaultTimeout: (n: number) => void;
  setViewport: (v: object) => Promise<void>;
  on: (ev: string, fn: (e: Error) => void) => void;
  evaluateOnNewDocument: (fn: () => void) => Promise<void>;
  goto: (url: string, opts: object) => Promise<void>;
  reload: (opts: object) => Promise<void>;
  waitForSelector: (sel: string) => Promise<unknown>;
  evaluate: <T>(fn: (...args: never[]) => T, ...args: unknown[]) => Promise<T>;
  waitForFunction: (fn: () => boolean) => Promise<unknown>;
}
