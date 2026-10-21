"use client";

import { useEffect } from "react";

/**
 * Switches body text onto Inter only after window.load.
 *
 * Chrome holds window.onload until an in-use @font-face file finishes,
 * even with font-display: swap. The root layout therefore paints with
 * next/font's local() fallback faces. This effect adds `fonts-ready` once
 * load has fired so the Inter woff2 files cannot sit in the load group.
 *
 * The condensed display face (Anton) is applied earlier, from the inline
 * warmup in the root layout, once its latin file is in the HTTP cache.
 * That script polls for the font CSS (it can land after the inline
 * script on a streamed document) and injects a style tag instead of
 * changing `<html class>`, which React would wipe on hydrate.
 *
 * It has to be an effect rather than an inline script. The not-found
 * response is Next's `__next_error__` shell; the real layout is applied
 * on the client, and scripts React inserts do not run. An effect also
 * runs after hydration, so it does not change `<html class>` out from
 * under the server markup.
 */
export default function BrandFonts() {
  useEffect(() => {
    const enable = () => document.documentElement.classList.add("fonts-ready");
    if (document.readyState === "complete") enable();
    else window.addEventListener("load", enable, { once: true });
    return () => window.removeEventListener("load", enable);
  }, []);
  return null;
}

/**
 * Starts the Anton latin download during HTML parse. fetch() is not a
 * document subresource, so a slow woff2 does not hold window.onload.
 * The real family is applied only after the bytes are cached; applying
 * it earlier would put that request back in the load group.
 */
export const BRAND_DISPLAY_FONT_WARMUP = `(function(){
  var STYLE_ID = "brand-display-font";
  var applied = false;
  function apply() {
    if (applied || document.getElementById(STYLE_ID)) { applied = true; return; }
    applied = true;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "html .font-display{font-family:var(--font-anton),sans-serif}";
    document.head.appendChild(style);
  }
  function urlsFromCss() {
    var urls = [];
    function walk(rules) {
      if (!rules) return;
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (rule.cssRules) { try { walk(rule.cssRules); } catch (e) {} }
        if (!rule.style || rule.type !== 5) continue;
        var fam = (rule.style.getPropertyValue("font-family") || "").replace(/["']/g, "").trim();
        if (fam !== "Anton") continue;
        var range = (rule.style.getPropertyValue("unicode-range") || "").toLowerCase().replace(/\\s/g, "");
        // Chrome normalizes u+00?? to U+0-FF. Either form is the latin file.
        if (range && range.indexOf("u+0-ff") !== 0 && range.indexOf("u+0000-00ff") !== 0 && range.indexOf("u+00") === -1) continue;
        var src = rule.style.getPropertyValue("src") || "";
        var re = /url\\((?:"|')?([^"')]+)(?:"|')?\\)/g, match;
        while ((match = re.exec(src))) {
          if (match[1].indexOf("woff2") !== -1) urls.push(match[1]);
        }
      }
    }
    for (var s = 0; s < document.styleSheets.length; s++) {
      try { walk(document.styleSheets[s].cssRules); } catch (e) {}
    }
    var seen = {};
    return urls.filter(function (u) { if (seen[u]) return false; seen[u] = 1; return true; });
  }
  function load(urls) {
    // FontFace.load is not a document subresource, so a slow file does
    // not hold window.onload. Once the face is in the font set, applying
    // the family paints from that cache instead of starting a second fetch.
    var jobs = urls.map(function (u) {
      try {
        var face = new FontFace("Anton", 'url("' + u.replace(/"/g, "") + '")', { weight: "400", display: "swap" });
        return face.load().then(function (loaded) { document.fonts.add(loaded); });
      } catch (e) {
        return fetch(u, { cache: "force-cache", credentials: "same-origin" }).then(function (res) {
          if (!res.ok) throw new Error("font");
          return res.arrayBuffer();
        });
      }
    });
    Promise.all(jobs).then(apply).catch(function () {});
  }
  var tries = 0;
  function tick() {
    var urls = [];
    try { urls = urlsFromCss(); } catch (e) {}
    if (urls.length) { load(urls); return; }
    // The font CSS can arrive after this script. DOMContentLoaded on a
    // large document is too late (the headline stayed on the fallback
    // until then). Poll briefly instead.
    if (tries++ < 80) setTimeout(tick, 25);
  }
  try { tick(); } catch (e) {}
})();`;
