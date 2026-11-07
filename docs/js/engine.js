// Shared, dependency-free demo engine (ES module). Seeded randomness, motion preference, visibility-gated start/stop.
// Every visitor gets the same numbers: all randomness comes from mulberry32(seed).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const between = (rng, lo, hi) => lo + (hi - lo) * rng();
export function pickWeighted(rng, items) {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = rng() * total;
  for (const i of items) { r -= i.weight ?? 1; if (r <= 0) return i; }
  return items[items.length - 1];
}
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const pad = (n, w = 2) => String(n).padStart(w, "0");
export function clock(seconds) { const s = Math.floor(seconds); return `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; }

// Reduced motion = OS preference OR the site's Motion toggle (data-motion="reduce" on <html>).
export function reducedMotion() {
  return document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
}
export function onMotionChange(cb) {
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener?.("change", () => cb(reducedMotion()));
  new MutationObserver(() => cb(reducedMotion())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
}
// Run start() when el is on screen, stop() when it leaves. Returns a function that reports visibility.
export function whenVisible(el, start, stop) {
  let visible = false;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { visible = e.isIntersecting; visible ? start() : stop(); }
  }, { threshold: 0.15 });
  io.observe(el);
  return () => visible;
}
export async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === "text") n.textContent = v; else if (k === "html") n.innerHTML = v; else n.setAttribute(k, v); }
  for (const k of kids) if (k) n.append(k);
  return n;
};
// State glyphs: every state has a shape as well as a colour and a word.
export const GLYPH = {
  learning: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.4"/></svg>',
  normal: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  flagged: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 15 14H1Z" fill="currentColor"/></svg>',
  contained: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3" width="3" height="10" rx="1" fill="currentColor"/><rect x="9.5" y="3" width="3" height="10" rx="1" fill="currentColor"/></svg>',
};
export const LABEL = { learning: "Learning", normal: "Normal", flagged: "Flagged", contained: "Contained" };

// Cephalo's real rule matching, as in the published 0.1.1 engine: first matching rule wins; command rules test the shell command,
// path rules test the file path of file-tool calls (on: any|read|write). Patterns are the published built-in rules (data/cephalo-rules-0.1.1.json).
// Simplification: the real engine also tests a platform-normalised variant of the text. Not needed for these examples.
export function evalCephalo(rules, call) {
  for (const r of rules) {
    let re; try { re = new RegExp(r.pattern, "i"); } catch { continue; }
    if (r.type === "command" && call.command !== undefined && re.test(call.command)) return r;
    if (r.type === "path" && call.path !== undefined) {
      const on = r.on ?? "any", access = call.access ?? "read";
      if ((on === "any" || on === access) && re.test(call.path)) return r;
    }
  }
  return null;
}

// One event row, used by every product-labelled feed. The product is always named in text ("Cephalo: BLOCK"); symbols and colour are extra.
const SYM = { BLOCK: "\u2715", ALLOW: "\u2713", FLAGGED: "\u25B2", CONTAINED: "\u275A\u275A", WATCHING: "\u25CB", RAN: "\u25B6", OFF: "\u2013" };
export function evRow(product, verdict, text, kind) {
  const li = el("li", { "data-product": product.toLowerCase(), "data-kind": kind });
  const who = el("span", { class: "who" });
  if (SYM[verdict]) who.append(el("span", { "aria-hidden": "true", class: "sym", text: SYM[verdict] + " " }));
  who.append(document.createTextNode(`${product}: ${verdict}`));
  li.append(who, el("span", { class: "what", text }));
  return li;
}
