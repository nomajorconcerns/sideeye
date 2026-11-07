// Eye tracking (delight only): the hero chameleon's pupil follows the cursor, keyboard focus, or the newest feed event.
// After 20 s idle it slowly gives the visitor the side-eye. Does nothing under reduced motion.
import { reducedMotion, onMotionChange, clamp } from "./engine.js";
const ch = document.getElementById("chameleon");
const ring = ch?.querySelector(".ch-eye-ring");
if (ch && ring) {
  let idleTimer = null, last = performance.now(), active = false;
  const look = (x, y, ms = 120) => {
    const b = ring.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const vx = x - cx, vy = y - cy, d = Math.hypot(vx, vy) || 1, m = Math.min(1, d / 220);
    ch.style.setProperty("--pupil-dx", `${(vx / d) * 6.5 * m}px`);
    ch.style.setProperty("--pupil-dy", `${clamp((vy / d) * 4.5 * m, -4.5, 4.5)}px`);
    ch.style.setProperty("--pupil-ms", `${ms}ms`);
  };
  const rest = () => { ch.style.removeProperty("--pupil-dx"); ch.style.removeProperty("--pupil-dy"); ch.style.removeProperty("--pupil-ms"); };
  const sideeye = () => { ch.dataset.idle = "true"; ch.style.setProperty("--pupil-ms", "1400ms"); ch.style.setProperty("--pupil-dx", "-9px"); ch.style.setProperty("--pupil-dy", "1px"); };
  const touch = () => { last = performance.now(); if (ch.dataset.idle) delete ch.dataset.idle; clearTimeout(idleTimer); idleTimer = setTimeout(sideeye, 20000); };
  const onMove = (e) => { touch(); look(e.clientX, e.clientY); };
  const onFocus = (e) => { touch(); const r = e.target.getBoundingClientRect?.(); if (r) look(r.left + r.width / 2, r.top + r.height / 2, 250); };
  const onFeed = () => { if (ch.dataset.idle) return; const r = document.getElementById("hero-feed")?.getBoundingClientRect(); if (r) look(r.left + 40, r.top + r.height / 2, 300); };
  const on = () => { if (active) return; active = true; addEventListener("pointermove", onMove, { passive: true }); addEventListener("focusin", onFocus); addEventListener("scroll", touch, { passive: true }); addEventListener("keydown", touch); document.addEventListener("se:event", onFeed); touch(); };
  const off = () => { if (!active) return; active = false; removeEventListener("pointermove", onMove); removeEventListener("focusin", onFocus); removeEventListener("scroll", touch); removeEventListener("keydown", touch); document.removeEventListener("se:event", onFeed); clearTimeout(idleTimer); delete ch.dataset.idle; rest(); };
  const sync = () => (reducedMotion() ? off() : on());
  onMotionChange(sync); sync();
}
