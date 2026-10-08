/* ==========================================================================
   main.js — wires everything together: render loop, events, countdown ticker.
   Loaded last; all features have registered themselves by now.
   ========================================================================== */

/* ------------------------------ rendering -------------------------------- */

/** Pick the screen to show, falling back to home when its data is missing. */
const BATCH_VIEWS = ["batch", "play", "summary", "final"];

function resolveView(view, batch) {
  if (!Views[view]) return "home";
  if (BATCH_VIEWS.includes(view) && !batch) return "home";
  return view;
}

function render() {
  const d = data();
  const batch = currentBatch();
  const view = resolveView(d.ui.view, batch);
  d.ui.view = view;

  document.body.dataset.view = view;
  document.body.dataset.theme = Chrome.isLobby(view) ? "lobby" : "plain";

  const scrollY = ui.lastView === view ? window.scrollY : 0;
  Chrome.renderHeader(view, batch);
  Chrome.renderBanner();
  $("#app").innerHTML = Views[view](batch);
  App.renderOverlay();
  ui.lastView = view;
  window.scrollTo(0, scrollY);

  if (ui.focus) {
    const target = $(ui.focus);
    if (target) target.focus();
    ui.focus = null;
  }
  Chrome.updateSavePill();
  updateCountdown();
}

function renderOverlay() {
  const batch = currentBatch();
  let html = "";
  if (ui.overlay && Overlays[ui.overlay]) html = Overlays[ui.overlay](batch);
  else if (data().ui.view === "play" && batch && batch.status === "PAUSED")
    html = Overlays.pause(batch);
  $("#overlay-root").innerHTML = html;
}

/* ------------------------------ countdown -------------------------------- */

/** Update the big timer text and bar. The countdown itself lives in the batch. */
function updateCountdown() {
  const el = $("#timer-text");
  const live = Live[data().ui.view];
  const info = el && live && live.timer();
  if (!info) return;

  const { ms, total, frozen } = info;
  el.textContent = Math.ceil(ms / 1000);
  el.className = `timer${ms <= 3000 && !frozen ? " urgent" : ""}${frozen ? " frozen" : ""}`;
  const bar = $("#timer-bar");
  if (bar) bar.style.width = `${Math.min(100, (ms / total) * 100)}%`;
}

setInterval(() => {
  const live = Live[data().ui.view];
  if (live && live.tick()) return; // tick() re-renders when the time runs out
  updateCountdown();
}, 100);

/* ------------------------------- events ---------------------------------- */

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const action = Actions[el.dataset.action];
  if (!action) return;

  const closesOverlay = el.dataset.close !== undefined; // menu items close the menu first
  if (closesOverlay) ui.overlay = null;
  action(el.dataset, el);
  if (closesOverlay) App.renderOverlay();
});

/** Inputs declare their handler with data-on-input / data-on-change. */
function dispatchField(event, key) {
  const name = event.target.dataset && event.target.dataset[key];
  if (name && Actions[name]) Actions[name](event.target.dataset, event.target);
}
document.addEventListener("input", (event) => dispatchField(event, "onInput"));
document.addEventListener("change", (event) =>
  dispatchField(event, "onChange"),
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (ui.modal) Actions["modal-cancel"]();
    else if (ui.overlay) Actions["overlay-close"]();
    return;
  }
  if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;

  if (ui.modal) {
    event.preventDefault();
    Actions["modal-ok"]();
    return;
  }
  const name = event.target.dataset.enter; // e.g. data-enter="team-add"
  if (name && Actions[name]) {
    event.preventDefault();
    Actions[name](event.target.dataset, event.target);
  }
});

/* -------------------------------- boot ----------------------------------- */

App.render = render;
App.renderOverlay = renderOverlay;

Storage.onChange(Chrome.updateSavePill);
Storage.onExternal(() => {
  ui.externalChange = true;
  Chrome.renderBanner();
});

const initial = Storage.load();
Batches.pruneEmpty(
  initial,
  initial.ui.view === "batch" ? initial.ui.batchId : null,
);
ui.backTo = initial.ui.batchId ? "batch" : "home";
render();
if (Storage.status().error) toast(Storage.status().error);
