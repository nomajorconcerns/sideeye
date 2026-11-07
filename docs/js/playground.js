// "Make it weird": three scripted agent lanes, an anomaly injector, a deviation score with a plain-English reason, Contain, Reset.
// SIMULATION. The scoring below is illustrative: SideEye's real detection is not built.
import { mulberry32, between, pickWeighted, clamp, clock, reducedMotion, onMotionChange, whenVisible, loadJSON, el, GLYPH, LABEL } from "./engine.js";

const root = document.getElementById("playground");
if (root) init(root).catch((e) => { root.querySelector(".pg-error")?.removeAttribute("hidden"); console.error(e); });

async function init(root) {
  const S = await loadJSON(root.dataset.scenario);
  let rng = mulberry32(S.seed);
  const names = Object.keys(S.agents);
  let simT = S.startClock, selected = names[0], paused = false, timer = null, visible = false;

  const live = el("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });
  const stage = root.querySelector(".pg-stage");
  const lanesEl = root.querySelector(".pg-lanes");
  const ctrl = root.querySelector(".pg-controls");
  const mascot = root.querySelector(".pg-mascot");
  const stateLabel = root.querySelector(".pg-state");
  const voice = root.querySelector(".pg-voice");
  const status = root.querySelector(".pg-status");
  root.append(live);

  // --- build lanes
  const lanes = {};
  for (const n of names) {
    const a = S.agents[n];
    const card = el("section", { class: "lane", "aria-labelledby": `lane-${n}`, "data-state": "normal" });
    const head = el("div", { class: "lane-head" }, el("h3", { id: `lane-${n}`, class: "mono", text: n }), el("span", { class: "lane-state", "data-role": "state" }));
    const meter = el("div", { class: "meter", role: "img", "aria-label": "" });
    meter.innerHTML = `<span class="meter-band"></span><span class="meter-now"></span>`;
    const meterTxt = el("p", { class: "small muted meter-txt" });
    const list = el("ul", { class: "feed", "aria-label": `Recent actions by ${n}` });
    const actions = el("div", { class: "lane-actions" });
    const contain = el("button", { type: "button", class: "btn btn-contain", hidden: "" , text: `Contain ${n}` });
    actions.append(contain);
    card.append(head, meter, meterTxt, list, actions);
    lanesEl.append(card);
    lanes[n] = { name: n, card, list, meter, meterTxt, contain, state: "normal", events: [], log: [] };
    contain.addEventListener("click", () => containLane(n));
  }
  const MAXVIS = 5;

  function renderMeter(L) {
    const a = S.agents[L.name];
    const rate = L.log.filter((e) => e.t > simT - 60).reduce((s, e) => s + e.w, 0);
    const max = 80, [lo, hi] = a.band;
    const band = L.meter.querySelector(".meter-band"), now = L.meter.querySelector(".meter-now");
    band.style.left = `${(lo / max) * 100}%`; band.style.width = `${((hi - lo) / max) * 100}%`;
    now.style.left = `${clamp(rate / max, 0, 1) * 100}%`;
    const inside = rate >= lo && rate <= hi;
    L.meter.setAttribute("aria-label", `Actions per minute: ${rate}. Normal for ${L.name}: ${lo} to ${hi}.`);
    L.meterTxt.textContent = `${rate} actions/min · normal for ${L.name}: ${lo}–${hi} (${inside ? "inside" : "outside"} its band)`;
    L.meter.dataset.inside = inside;
  }

  function addRow(L, o) {
    const li = el("li", { "data-kind": o.kind });
    li.append(el("span", { class: "mono t", text: clock(simT) }));
    const mark = el("span", { class: "mark", "aria-hidden": o.kind === "normal" ? "true" : "false" });
    if (o.kind !== "normal") mark.innerHTML = `${GLYPH[o.kind === "ok" ? "normal" : o.kind]}<span>${o.tag}</span>`;
    else mark.innerHTML = '<span class="dot"></span>';
    const body = el("span", { class: "what" });
    body.append(el("span", { text: o.text }));
    if (o.why) body.append(el("span", { class: "why small", text: o.why }));
    li.append(mark, body);
    L.list.append(li);
    while (L.list.children.length > MAXVIS) L.list.firstChild.remove();
  }

  function normalEvent(L) {
    const a = S.agents[L.name];
    const e = pickWeighted(rng, a.normal);
    L.log.push({ t: simT, w: 1 });
    addRow(L, { kind: "normal", text: e.text });
  }
  function step(silent = false) {
    simT += between(rng, ...S.tickSeconds);
    for (const n of names) {
      const L = lanes[n];
      if (L.state === "contained") { renderMeter(L); continue; }
      if (silent) { pickWeighted(rng, S.agents[n].normal); L.log.push({ t: simT, w: 1 }); } else normalEvent(L);
      renderMeter(L);
    }
  }

  // --- anomalies
  const ctrlBox = ctrl.querySelector(".pg-buttons");
  S.anomalies.forEach((an) => {
    const b = el("button", { type: "button", class: "btn", text: an.button });
    b.addEventListener("click", () => inject(an));
    ctrlBox.append(b);
  });
  const radios = ctrl.querySelector(".pg-agents");
  names.forEach((n, i) => {
    const id = `pg-agent-${n}`;
    const input = el("input", { type: "radio", name: "pg-agent", id, value: n }); if (i === 0) input.checked = true;
    input.addEventListener("change", () => { selected = n; });
    radios.append(el("label", { for: id, class: "radio" }, input, el("span", { class: "mono", text: n })));
  });

  function inject(an) {
    const L = lanes[selected], a = S.agents[selected];
    if (L.state === "contained") { setStatus(`${selected} is contained. Reset to start again.`); return; }
    simT += 1.2;
    const seen = an.seen[selected], j = rng();
    const score = seen === 0 ? 0.9 + 0.09 * j : clamp(0.78 - (seen / a.events) * 4 + 0.05 * j, 0.1, 0.95);
    const flagged = score >= S.flagAt;
    const sc = score.toFixed(2);
    if (!flagged) {
      L.log.push({ t: simT, w: 1 });
      addRow(L, { kind: "ok", tag: "WITHIN NORMAL", text: `${selected} ${an.text}`, why: `Deviation ${sc}, below the ${S.flagAt.toFixed(2)} flag line. ${selected} has ${an.verb} ${seen} times in ${a.events} events, so this is normal for it.` });
      renderMeter(L);
      setStatus(`Not flagged: ${selected} ${an.text}. Normal for this agent (deviation ${sc}).`);
      return;
    }
    L.log.push({ t: simT, w: an.burst });
    const reason = seen === 0 ? `${selected} has never ${an.verb} in ${a.events} events.` : `${selected} has ${an.verb} only ${seen} times in ${a.events} events.`;
    addRow(L, { kind: "flagged", tag: "FLAGGED", text: `${selected} ${an.text}`, why: `Deviation ${sc}. ${reason}` });
    L.state = "flagged"; renderMeter(L); paintState();
    L.contain.hidden = false;
    live.textContent = `FLAGGED: ${selected} ${an.text}. ${reason} The Contain button is next.`;
    setStatus(`Flagged: ${reason}`);
    L.contain.focus({ preventScroll: false });
  }

  function containLane(n) {
    const L = lanes[n];
    L.state = "contained"; L.contain.hidden = true;
    addRow(L, { kind: "contained", tag: "CONTAINED", text: `${n} paused`, why: "Simulation: in the real product this is Planned, not built." });
    paintState();
    live.textContent = `CONTAINED: ${n} is paused.`;
    setStatus(`${n} is paused. Its lane has stopped.`);
    root.querySelector(".pg-reset").focus();
  }

  function worst() {
    const st = Object.values(lanes).map((l) => l.state);
    return st.includes("flagged") ? "flagged" : st.includes("contained") ? "contained" : "normal";
  }
  function paintState() {
    for (const L of Object.values(lanes)) {
      L.card.dataset.state = L.state;
      const s = L.card.querySelector("[data-role=state]");
      s.innerHTML = `${GLYPH[L.state]}<span>${LABEL[L.state].toUpperCase()}</span>`;
    }
    const w = worst();
    mascot.dataset.state = w;
    stateLabel.innerHTML = `${GLYPH[w]}<span>${LABEL[w].toUpperCase()}</span>`;
    stateLabel.dataset.state = w;
    const flaggedName = Object.values(lanes).find((l) => l.state === "flagged")?.name;
    voice.textContent = w === "flagged" ? `Not like ${flaggedName} at all.` : w === "contained" ? "Noted." : "Hm.";
    mascot.setAttribute("aria-label", `SideEye chameleon. State: ${LABEL[w]}.`);
  }
  function setStatus(t) { status.textContent = t; }

  // --- reset / pause / next
  function reset() {
    for (const L of Object.values(lanes)) { L.state = "normal"; L.list.replaceChildren(); L.log = []; L.contain.hidden = true; }
    simT = S.startClock; rng = mulberry32(S.seed); // re-seed so every reset (and every visitor) sees the same numbers
    for (let i = 0; i < 12; i++) step(true); // a minute of history first, so the rate meter starts where a normal agent would be
    for (let i = 0; i < 3; i++) step();
    paintState(); setStatus("Reset. Each agent is back to normal.");
  }
  root.querySelector(".pg-reset").addEventListener("click", reset);
  const pauseBtn = root.querySelector(".pg-pause"), nextBtn = root.querySelector(".pg-next");
  pauseBtn.addEventListener("click", () => { paused = !paused; syncRun(); });
  nextBtn.addEventListener("click", () => step());

  function run() { clearTimeout(timer); timer = null; if (paused || reducedMotion() || !visible) return; timer = setTimeout(() => { step(); run(); }, between(rng, ...S.tickMs)); }
  function syncRun() {
    const rm = reducedMotion();
    pauseBtn.hidden = rm; nextBtn.hidden = !rm;
    pauseBtn.textContent = paused ? "Resume feed" : "Pause feed"; pauseBtn.setAttribute("aria-pressed", String(paused));
    if (rm) { clearTimeout(timer); timer = null; } else run();
  }
  onMotionChange(syncRun);
  whenVisible(root, () => { visible = true; syncRun(); }, () => { visible = false; clearTimeout(timer); timer = null; });

  root.querySelector(".pg-loading")?.remove();
  stage.hidden = false;
  reset();
  syncRun();
}
