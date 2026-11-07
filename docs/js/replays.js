// Attack replays: scrub through a scripted session. Left: what the agent's own log says. Right: what SideEye saw.
// SIMULATION on scripted data. The flags and scores are illustrative: SideEye does not detect these today.
import { reducedMotion, onMotionChange, whenVisible, loadJSON, el, GLYPH } from "./engine.js";
const root = document.getElementById("replays-demo");
if (root) init(root).catch((e) => { console.error(e); root.querySelector(".rp-error")?.removeAttribute("hidden"); });

async function init(root) {
  const D = await loadJSON(root.dataset.scenario);
  const q = (s) => root.querySelector(s);
  const pick = q(".rp-pick"), scrub = q("#rp-step"), out = q("#rp-out"), logEl = q(".rp-log"), sawEl = q(".rp-saw");
  const contain = q(".rp-contain"), outcome = q(".rp-outcome"), play = q(".rp-play"), next = q(".rp-next"), reset = q(".rp-reset"), blurb = q(".rp-blurb");
  let sc = D.scenarios[0], cur = 0, containedAt = null, timer = null, playing = false, visible = false;

  D.scenarios.forEach((s, i) => {
    const id = `rp-sc-${s.id}`;
    const input = el("input", { type: "radio", name: "rp-sc", id, value: s.id }); if (i === 0) input.checked = true;
    input.addEventListener("change", () => { sc = s; load(); });
    pick.append(el("label", { for: id, class: "radio" }, input, el("span", { text: s.title })));
  });

  function load() {
    cur = 0; containedAt = null; stop(); outcome.textContent = ""; outcome.hidden = true;
    scrub.max = String(sc.steps.length - 1); scrub.value = "0"; blurb.textContent = sc.blurb;
    render();
  }
  function render() {
    out.textContent = `${cur + 1} of ${sc.steps.length} · ${sc.steps[cur].t}`;
    scrub.setAttribute("aria-valuetext", `Step ${cur + 1} of ${sc.steps.length}, at ${sc.steps[cur].t}`);
    logEl.replaceChildren(); sawEl.replaceChildren();
    sc.steps.slice(0, cur + 1).forEach((s, i) => {
      const prevented = containedAt !== null && i > containedAt;
      const l = el("li", { class: prevented ? "prevented" : "" });
      l.append(el("span", { class: "mono t", text: s.t }), el("span", { class: "what", text: prevented ? "No entry: the agent was paused." : s.log }));
      logEl.append(l);
      const f = s.saw.state === "flagged";
      const r = el("li", { class: prevented ? "prevented" : "", "data-kind": f ? "flagged" : "normal" });
      r.append(el("span", { class: "mono t", text: s.t }));
      const mark = el("span", { class: "mark" });
      mark.innerHTML = prevented ? `${GLYPH.contained}<span>PREVENTED</span>` : f ? `${GLYPH.flagged}<span>FLAGGED</span>` : '<span class="dot"></span>';
      const what = el("span", { class: "what" }, el("span", { text: s.saw.text }));
      if (f) what.append(el("span", { class: "why small", text: prevented ? "Would have been flagged." : `Deviation ${s.saw.score.toFixed(2)}. ${s.saw.reason}` }));
      r.append(mark, what); sawEl.append(r);
    });
    contain.disabled = containedAt !== null;
    contain.textContent = containedAt !== null ? `Contained at step ${containedAt + 1}` : `Contain the agent at step ${cur + 1}`;
  }
  function doContain() {
    containedAt = cur;
    const k = containedAt, o = sc.outcomes;
    const text = k < sc.firstFlag ? o.before : k < sc.harm ? o.between : o.after;
    const prevented = sc.steps.slice(k + 1).filter((s) => s.saw.state === "flagged").map((s) => s.saw.text);
    outcome.hidden = false; outcome.replaceChildren();
    outcome.append(el("p", { class: "mark-line", html: `${GLYPH.contained}<strong>CONTAINED at step ${k + 1}</strong>` }), el("p", { text: text }));
    if (prevented.length) outcome.append(el("p", { class: "small muted", text: `Later steps that did not happen: ${prevented.join("; ")}.` }));
    outcome.append(el("p", { class: "small muted", text: "Scrub forward to see the steps that were prevented." }));
    render();
  }
  function stop() { clearTimeout(timer); timer = null; }
  function loop() { stop(); if (!playing || reducedMotion() || !visible) return; timer = setTimeout(() => { if (cur < sc.steps.length - 1) { cur++; scrub.value = String(cur); render(); loop(); } else { playing = false; syncRun(); } }, 1600); }
  function syncRun() {
    const rm = reducedMotion();
    play.hidden = rm; next.hidden = !rm;
    play.textContent = playing ? "Pause replay" : "Play replay"; play.setAttribute("aria-pressed", String(playing));
    if (rm) { playing = false; stop(); } else loop();
  }
  scrub.addEventListener("input", () => { cur = Number(scrub.value); render(); });
  contain.addEventListener("click", doContain);
  reset.addEventListener("click", load);
  play.addEventListener("click", () => { if (!playing && cur >= sc.steps.length - 1) { cur = 0; scrub.value = "0"; render(); } playing = !playing; syncRun(); });
  next.addEventListener("click", () => { if (cur < sc.steps.length - 1) { cur++; scrub.value = String(cur); render(); } });
  onMotionChange(syncRun);
  whenVisible(root, () => { visible = true; syncRun(); }, () => { visible = false; stop(); });
  q(".rp-loading")?.remove(); q(".rp-stage").hidden = false;
  load(); syncRun();
}
