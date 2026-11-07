// Small hero feed: scripted normal events for one agent. SIMULATION. Pausable; advances by button under reduced motion.
import { mulberry32, between, pickWeighted, clock, reducedMotion, onMotionChange, whenVisible, loadJSON } from "./engine.js";
const box = document.getElementById("hero-feed");
if (box) (async () => {
  const S = await loadJSON(box.dataset.scenario), rng = mulberry32(S.seed + 7), a = S.agents["claude-code"];
  const list = box.querySelector("ul"), pause = box.querySelector(".hf-pause"), next = box.querySelector(".hf-next");
  let t = S.startClock + 600, paused = false, visible = false, timer = null;
  const add = () => {
    t += between(rng, ...S.tickSeconds);
    const li = document.createElement("li"); li.innerHTML = '<span class="mono t"></span><span class="what"></span>';
    li.children[0].textContent = clock(t); li.children[1].textContent = pickWeighted(rng, a.normal).text;
    list.append(li); document.dispatchEvent(new CustomEvent("se:event")); while (list.children.length > 4) list.firstChild.remove();
  };
  const run = () => { clearTimeout(timer); timer = null; if (paused || reducedMotion() || !visible) return; timer = setTimeout(() => { add(); run(); }, between(rng, 1600, 2400)); };
  const sync = () => { const rm = reducedMotion(); pause.hidden = rm; next.hidden = !rm; pause.textContent = paused ? "Resume" : "Pause"; pause.setAttribute("aria-pressed", String(paused)); rm ? (clearTimeout(timer), timer = null) : run(); };
  pause.addEventListener("click", () => { paused = !paused; sync(); }); next.addEventListener("click", add);
  onMotionChange(sync); list.replaceChildren(); for (let i = 0; i < 3; i++) add();
  whenVisible(box, () => { visible = true; sync(); }, () => { visible = false; clearTimeout(timer); timer = null; });
  sync();
})().catch(console.error);
