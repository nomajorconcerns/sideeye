// Baseline timeline: a "days observed" slider. The normal band starts wide (nothing learned) and narrows as days pass.
// SIMULATION on seeded data. It also shows a false positive on purpose.
import { mulberry32, clamp, loadJSON, el, GLYPH, LABEL } from "./engine.js";

const root = document.getElementById("baseline-demo");
if (root) init(root).catch((e) => { console.error(e); root.querySelector(".bl-error")?.removeAttribute("hidden"); });

async function init(root) {
  const S = await loadJSON(root.dataset.scenario);
  const rng = mulberry32(S.seed);
  // Seeded daily series (one value per day: typical hourly outbound volume). Box-Muller from the seeded rng.
  const gauss = () => Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
  const series = Array.from({ length: S.days }, () => Math.max(2, S.mean + S.sd * gauss()));

  const slider = root.querySelector("#bl-days"), out = root.querySelector("#bl-days-out");
  const svg = root.querySelector("svg.bl-chart"), stateEl = root.querySelector(".bl-state"), verdict = root.querySelector(".bl-verdict");
  const live = root.querySelector(".bl-live"), mascot = root.querySelector(".bl-mascot");
  let eventKey = "send", lastState = null;
  const W = 640, H = 260, M = { l: 52, r: 16, t: 14, b: 34 };
  const x = (d) => M.l + ((d - 1) / (S.days - 1)) * (W - M.l - M.r);
  const y = (v) => H - M.b - (clamp(v, 0, S.yMax) / S.yMax) * (H - M.t - M.b);

  // The band: wide prior at day 0, converging on mean ± k·sd of what has been seen. w grows with days observed.
  function bandAt(d) {
    const seen = series.slice(0, d);
    if (!d) return S.priorBand;
    const m = seen.reduce((s, v) => s + v, 0) / d;
    const sd = Math.sqrt(seen.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, d - 1)) || S.sd;
    const w = Math.min(1, d / 14);
    const lo = (1 - w) * S.priorBand[0] + w * Math.max(0, m - S.bandSigmas * sd);
    const hi = (1 - w) * S.priorBand[1] + w * (m + S.bandSigmas * sd);
    return [lo, hi];
  }
  const NS = "http://www.w3.org/2000/svg";
  const mk = (t, a) => { const n = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); return n; };

  function draw() {
    const d = Number(slider.value); out.textContent = String(d);
    svg.replaceChildren();
    // y grid + labels
    for (const v of [0, 100, 200, 300, 400]) {
      svg.append(mk("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: "bl-grid" }));
      const t = mk("text", { x: M.l - 8, y: y(v) + 4, "text-anchor": "end", class: "bl-axis" }); t.textContent = String(v); svg.append(t);
    }
    for (const dd of [1, 7, 14, 21, 30]) { const t = mk("text", { x: x(dd), y: H - 10, "text-anchor": dd === S.days ? "end" : "middle", class: "bl-axis" }); t.textContent = `day ${dd}`; svg.append(t); }
    const yl = mk("text", { x: 12, y: (H - M.b + M.t) / 2, transform: `rotate(-90 12 ${(H - M.b + M.t) / 2})`, "text-anchor": "middle", class: "bl-axis" }); yl.textContent = S.unit; svg.append(yl);
    // band polygon: from day 1 to d (what the agent "knew" on each day), extended to the event day
    if (d > 0) {
      const top = [], bot = [];
      for (let i = 1; i <= d; i++) { const [lo, hi] = bandAt(i); top.push(`${x(i)},${y(hi)}`); bot.unshift(`${x(i)},${y(lo)}`); }
      svg.append(mk("polygon", { points: [...top, ...bot].join(" "), class: "bl-band" }));
      const pts = series.slice(0, d).map((v, i) => `${x(i + 1)},${y(v)}`).join(" ");
      svg.append(mk("polyline", { points: pts, class: "bl-line" }));
    } else {
      svg.append(mk("rect", { x: M.l, y: y(S.priorBand[1]), width: W - M.l - M.r, height: y(S.priorBand[0]) - y(S.priorBand[1]), class: "bl-band bl-band-prior" }));
    }
    // the event happens "today" (day d+1, or day 1 when nothing observed)
    const ev = S.events[eventKey], ed = Math.min(S.days, d + 1);
    const [lo, hi] = bandAt(d);
    const learning = d < S.learningDays;
    const outside = ev.value > hi || ev.value < lo;
    const state = learning ? "learning" : outside ? "flagged" : "normal";
    svg.append(mk("line", { x1: x(ed), x2: x(ed), y1: M.t, y2: H - M.b, class: "bl-today" }));
    const pt = mk("g", { class: `bl-event ${state}` });
    if (state === "flagged") pt.append(mk("path", { d: `M${x(ed)} ${y(ev.value) - 9} l9 16 h-18 z` }));
    else pt.append(mk("circle", { cx: x(ed), cy: y(ev.value), r: 6 }));
    svg.append(pt);
    svg.setAttribute("aria-label", `Chart of ${S.unit} over ${d} observed days. Normal band is ${Math.round(lo)} to ${Math.round(hi)}. The event at ${ev.value} is ${state === "learning" ? "not judged, still learning" : state === "flagged" ? "outside the band: flagged" : "inside the band"}.`);

    stateEl.innerHTML = `${GLYPH[state]}<span>${LABEL[state].toUpperCase()}</span>`; stateEl.dataset.state = state;
    mascot.dataset.state = state === "learning" ? "learning" : state;
    mascot.setAttribute("aria-label", `SideEye chameleon. State: ${LABEL[state]}.`);
    root.querySelector(".bl-day").textContent = learning ? `Day ${d} of ${S.learningDays} of learning` : `${d} days observed`;
    const band = `Normal band now: ${Math.round(lo)} to ${Math.round(hi)} KB/h.`;
    verdict.textContent = learning
      ? `${band} Event: ${ev.label}. Not judged yet. After ${d} day${d === 1 ? "" : "s"} there is too little history to say what is unusual, so this reads as unremarkable.`
      : outside
        ? `${band} Event: ${ev.label}. ${ev.value} is outside the band: ${state.toUpperCase()}${eventKey === "refactor" ? ". " + ev.note + ": this is a false positive." : "."}`
        : `${band} Event: ${ev.label}. ${ev.value} is inside the band: unremarkable.`;
    if (state !== lastState && state === "flagged") live.textContent = `FLAGGED at ${d} days observed: ${ev.label}.`;
    lastState = state;
  }
  slider.addEventListener("input", draw);
  root.querySelectorAll("input[name=bl-event]").forEach((r) => r.addEventListener("change", () => { eventKey = r.value; draw(); }));
  root.querySelector(".bl-loading")?.remove(); root.querySelector(".bl-stage").hidden = false;
  draw();
}
