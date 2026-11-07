// Prevent + detect split (feature #4). The same attack runs twice side by side:
// left = Cephalo only, right = Cephalo + SideEye. Cephalo verdicts come from Cephalo's real published rules.
// The SideEye column is a SIMULATION of a Planned feature: SideEye does not detect this today.
import { reducedMotion, onMotionChange, whenVisible, loadJSON, evalCephalo, evRow } from "./engine.js";
const root = document.getElementById("split-demo");
if (root) init(root).catch((e) => { console.error(e); root.querySelector(".sp-error")?.removeAttribute("hidden"); });

async function init(root) {
  const [S, RULES] = await Promise.all([loadJSON(root.dataset.scenario), loadJSON(root.dataset.rules)]);
  const q = (s) => root.querySelector(s);
  const lanes = { left: q(".sp-left ol"), right: q(".sp-right ol") };
  const sum = { left: q(".sp-left .sp-sum"), right: q(".sp-right .sp-sum") };
  const play = q(".sp-play"), next = q(".sp-next"), reset = q(".sp-reset"), live = q(".sp-live");
  let i = 0, timer = null, playing = false, visible = false, contained = false;
  const ran = { left: [], right: [] };

  const row = (lane, product, verdict, text, kind) => lanes[lane].append(evRow(product, verdict, text, kind));
  function step() {
    if (i >= S.steps.length) return false;
    const st = S.steps[i], hit = evalCephalo(RULES, st.call);
    const said = `${st.say}: ${st.call.command}`;
    row("left", "Agent", `STEP ${i + 1}`, said, "agent");
    if (hit) row("left", "Cephalo", "BLOCK", `rule ${hit.id}`, "block");
    else { row("left", "Cephalo", "ALLOW", "no rule matched", "allow"); row("left", "Tool", "RAN", "", "ran"); ran.left.push(st.harm); }

    row("right", "Agent", `STEP ${i + 1}`, said, "agent");
    if (contained) row("right", "SideEye", "CONTAINED", "the agent is paused, so this call did not happen", "contained");
    else {
      if (hit) row("right", "Cephalo", "BLOCK", `rule ${hit.id}`, "block");
      else { row("right", "Cephalo", "ALLOW", "no rule matched", "allow"); row("right", "Tool", "RAN", "", "ran"); ran.right.push(st.harm); }
      const s = st.side, flagged = s.flag && s.score >= S.flagAt;
      if (flagged) {
        row("right", "SideEye", "FLAGGED", `deviation ${s.score.toFixed(2)}. ${s.text}`, "flagged");
        row("right", "SideEye", "CONTAINED", "agent paused (a Planned feature, simulated)", "contained");
        contained = true; live.textContent = `SideEye: FLAGGED at step ${i + 1}. SideEye: CONTAINED.`;
      } else if (s.text) row("right", "SideEye", "WATCHING", `deviation ${s.score.toFixed(2)}, below ${S.flagAt.toFixed(2)}. ${s.text}`, "watching");
    }
    i++;
    if (i >= S.steps.length) finish();
    return true;
  }
  function finish() {
    const list = (a) => (a.length ? a.join("; ") : "nothing");
    sum.left.textContent = `Got through: ${list(ran.left)}.`;
    sum.right.textContent = `Got through: ${list(ran.right)}. Containing stops what comes next. It does not undo a call that already ran.`;
    playing = false; syncRun();
  }
  function stop() { clearTimeout(timer); timer = null; }
  function loop() { stop(); if (!playing || reducedMotion() || !visible) return; timer = setTimeout(() => { if (step()) loop(); }, 1500); }
  function syncRun() {
    const rm = reducedMotion(); play.hidden = rm; next.hidden = !rm;
    play.textContent = playing ? "Pause" : i >= S.steps.length ? "Replay" : "Play";
    play.setAttribute("aria-pressed", String(playing));
    next.disabled = i >= S.steps.length;
    if (rm) { playing = false; stop(); } else loop();
  }
  function clear() {
    i = 0; contained = false; ran.left = []; ran.right = [];
    lanes.left.replaceChildren(); lanes.right.replaceChildren(); sum.left.textContent = ""; sum.right.textContent = ""; live.textContent = "";
    stop(); playing = false; syncRun();
  }
  play.addEventListener("click", () => { if (i >= S.steps.length) clear(); playing = !playing; syncRun(); });
  next.addEventListener("click", () => { step(); syncRun(); });
  reset.addEventListener("click", clear);
  onMotionChange(syncRun);
  whenVisible(root, () => { visible = true; syncRun(); }, () => { visible = false; stop(); });
  q(".sp-loading")?.remove(); q(".sp-stage").hidden = false; syncRun();
}
