// Shared UI: theme, motion and "Just the facts" toggles, copy buttons, install progress. No dependencies.
const root = document.documentElement;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked: the setting just won't persist */ } },
};
const NS = root.dataset.ns || "nmc";

// Apply saved settings as early as possible (this file is loaded at the end of <head> with defer=false by build, see index.html)
const savedTheme = store.get(`${NS}.theme`); if (savedTheme === "dark" || savedTheme === "light") root.dataset.theme = savedTheme;
if (store.get(`${NS}.motion`) === "reduce") root.dataset.motion = "reduce";
if (store.get(`${NS}.facts`) === "on") root.dataset.facts = "on";

function currentTheme() {
  return root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

function wire() {
  const themeBtn = document.getElementById("toggle-theme");
  const motionBtn = document.getElementById("toggle-motion");
  const factsBtn = document.getElementById("toggle-facts");
  const syncTheme = () => { if (themeBtn) { const light = currentTheme() === "light"; themeBtn.setAttribute("aria-pressed", String(light)); themeBtn.textContent = light ? "Theme: light" : "Theme: dark"; } };
  const syncMotion = () => { if (motionBtn) { const r = root.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches; motionBtn.setAttribute("aria-pressed", String(r)); motionBtn.textContent = r ? "Motion: off" : "Motion: on"; } };
  const syncFacts = () => { if (factsBtn) { const on = root.dataset.facts === "on"; factsBtn.setAttribute("aria-pressed", String(on)); } };
  syncTheme(); syncMotion(); syncFacts();
  themeBtn?.addEventListener("click", () => { const next = currentTheme() === "light" ? "dark" : "light"; root.dataset.theme = next; store.set(`${NS}.theme`, next); syncTheme(); });
  motionBtn?.addEventListener("click", () => { const off = root.dataset.motion === "reduce"; if (off) { delete root.dataset.motion; store.set(`${NS}.motion`, "on"); } else { root.dataset.motion = "reduce"; store.set(`${NS}.motion`, "reduce"); } syncMotion(); });
  factsBtn?.addEventListener("click", () => { const on = root.dataset.facts === "on"; if (on) { delete root.dataset.facts; store.set(`${NS}.facts`, "off"); } else { root.dataset.facts = "on"; store.set(`${NS}.facts`, "on"); } syncFacts(); });

  // Copy buttons: <div class="code"><pre>..</pre><button class="copy">
  document.querySelectorAll(".code .copy").forEach((b) => {
    b.addEventListener("click", async () => {
      const text = b.parentElement.querySelector("pre").innerText.replace(/^\$ /gm, "");
      try { await navigator.clipboard.writeText(text.trim()); b.textContent = "Copied"; } catch { b.textContent = "Select and copy"; }
      setTimeout(() => (b.textContent = "Copy"), 1600);
    });
  });

  // Install stepper: ticks saved per site
  const steps = [...document.querySelectorAll("[data-step]")];
  if (steps.length) {
    const key = `${NS}.install`;
    let done = []; try { done = JSON.parse(store.get(key) || "[]"); } catch { done = []; }
    const paint = () => steps.forEach((li) => { const id = li.dataset.step; const on = done.includes(id); li.classList.toggle("done", on); const cb = li.querySelector("input"); if (cb) cb.checked = on; });
    steps.forEach((li) => li.querySelector("input")?.addEventListener("change", (e) => {
      const id = li.dataset.step; done = e.target.checked ? [...new Set([...done, id])] : done.filter((x) => x !== id);
      store.set(key, JSON.stringify(done)); paint(); count();
    }));
    const counter = document.getElementById("step-count");
    const count = () => { if (counter) counter.textContent = `${done.length} of ${steps.length} done`; };
    document.getElementById("steps-reset")?.addEventListener("click", () => { done = []; store.set(key, "[]"); paint(); count(); });
    paint(); count();
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
