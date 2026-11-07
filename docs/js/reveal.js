// Smooth entrance: sections and cards fade and rise once as they scroll into view. Content is visible without JS, and under reduced motion.
const rm = () => document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!rm() && "IntersectionObserver" in window) {
  const root = document.documentElement; root.classList.add("js-reveal");
  const targets = [...document.querySelectorAll("main section > .wrap > *, .card, .how > li, .tbl-wrap, details.faq")];
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  targets.forEach((t, i) => { t.classList.add("rv"); io.observe(t); });
  // anything already past the fold on load (deep links) must not stay hidden
  addEventListener("hashchange", () => targets.forEach((t) => t.classList.add("in")));
  setTimeout(() => { if (location.hash) targets.forEach((t) => t.classList.add("in")); }, 0);
}
// Top-bar link for the section on screen
const links = [...document.querySelectorAll(".topnav a[href^='#']")];
if (links.length && "IntersectionObserver" in window) {
  const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { links.forEach((a) => a.removeAttribute("aria-current")); map.get(e.target.id)?.setAttribute("aria-current", "true"); } }), { rootMargin: "-35% 0px -55% 0px" });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) so.observe(s); });
}
