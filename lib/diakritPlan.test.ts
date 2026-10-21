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

/* Label positions are 0–1000 of the sheet. Sizes are millimetres, as printed on the plan.
   Living and Dining share one open face, so their sizes must not veto the scale.
   The two bedrooms that close (3.5×3.0 and 4.2×3.2) are what the scale is taken from.
   A third bedroom (3.3×3.2) is drawn, but its partition is not a continuous thick wall, so it is not a separate face. */
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
  { name: "Alfresco", x: 385, y: 390 },
  { name: "Deck", x: 538, y: 569 },
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
            return new Response(JSON.stringify({ draft: { rooms } }), { status: 200, headers: { "Content-Type": "application/json" } });
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
        const labels = [...document.querySelectorAll("#ed .rlab")].map((e) => ({ t: e.textContent || "", orphan: e.classList.contains("orphan") }));
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
        return {
          box, walls, labels, siteBox,
          underlay: img ? { w: +img.getAttribute("width")!, h: +img.getAttribute("height")! } : null,
          pxPerM: px ? +px[1] : null,
          footprint: foot ? +foot[1] : null,
          flash: document.querySelector("#flash")?.textContent || "",
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
      expect(data.labels.filter((l) => l.orphan).map((l) => l.t)).toEqual([]);
      expect(text).not.toMatch(/not in a room/i);
      for (const name of ["Living", "Dining", "Kitchen", "Laundry", "Bath", "Bedroom", "Robe", "Ensuite"]) {
        expect(text, text).toContain(name);
      }
      expect(text).not.toMatch(/Driveway|Shed/i);

      expect(data.flash).toMatch(/Scale set from the room sizes/);
      expect(data.pxPerM).toBeGreaterThan(30);
      expect(data.pxPerM).toBeLessThan(45);
      expect(data.footprint).toBeGreaterThan(80);
      expect(data.footprint).toBeLessThan(130);

      if (data.siteBox) {
        const sw = data.siteBox.x1 - data.siteBox.x0;
        expect(sw).toBeLessThan(sheetW * 0.7);
        expect(data.siteBox.x0).toBeGreaterThan(40);
      }
    } finally {
      await browser.close();
      server.close();
    }
  }, 90_000);
});

interface Page {
  setDefaultTimeout: (n: number) => void;
  setViewport: (v: object) => Promise<void>;
  on: (ev: string, fn: (e: Error) => void) => void;
  evaluateOnNewDocument: (fn: () => void) => Promise<void>;
  goto: (url: string, opts: object) => Promise<void>;
  waitForSelector: (sel: string) => Promise<unknown>;
  evaluate: <T>(fn: (...args: never[]) => T, ...args: unknown[]) => Promise<T>;
  waitForFunction: (fn: () => boolean) => Promise<unknown>;
}
