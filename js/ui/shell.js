/* ==========================================================================
   shell.js — the small framework every feature plugs into.

     Views[name](batch)           → HTML for a full screen
     Actions[name](dataset, el)   → handler for data-action="name" clicks
                                    (also data-on-input / data-on-change / data-enter)
     Overlays[name](batch)        → HTML for a layer on top of the screen
     Live[view] = { timer(), tick() } → countdown display + auto-hide logic

   Features register themselves into these tables; main.js wires up the DOM.
   ========================================================================== */
const Views = {};
const Actions = {};
const Overlays = {};
const Live = {};

/** main.js fills these in; shell code calls them after state changes. */
const App = { render: () => {}, renderOverlay: () => {} };

/** UI-only state. Anything that must survive a refresh lives in Storage instead. */
const ui = {
  overlay: null, // 'menu' | 'log' | 'leaderboard' | null
  modal: null,
  backTo: "home", // where the "Back" button goes
  lastView: null,
  focus: null, // CSS selector to focus after the next render
  peekKey: null, // question whose answer the operator chose to reveal
  externalChange: false,
};

const data = () => Storage.get();
const currentBatch = () => Batches.find(data(), data().ui.batchId);

/** Save to localStorage and redraw. (Game.log already stamps batch.updatedAt.) */
function commit() {
  Storage.save();
  App.render();
}

const REMEMBERED_VIEWS = ["home", "batch", "play", "final"];

function go(view) {
  const d = data();
  if (REMEMBERED_VIEWS.includes(d.ui.view) && d.ui.view !== view)
    ui.backTo = d.ui.view;
  ui.overlay = null;
  d.ui.view = view;
  if (view === "home") {
    Batches.pruneEmpty(d);
    d.ui.batchId = null;
  }
  Storage.save();
  window.scrollTo(0, 0);
  App.render();
}

/* ------------------------------- toast ----------------------------------- */

let toastTimer = null;
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

/* ------------------------------- modal ----------------------------------- */

/**
 * Confirmation dialog.
 * options: title, body, confirmText, danger, onConfirm({ number, reason, selected, text }),
 *          text ({ label, value, placeholder, max }) — one free-text field,
 *          select ({ label, items: [{ value, label, number }] }) — pick one item,
 *          number + numberLabel (numeric field), reason (optional text field),
 *          typeToConfirm (user must type this word).
 */
function openModal(options) {
  ui.modal = options;
  const selectField = !options.select
    ? ""
    : `<label><span class="lbl">${esc(options.select.label)}</span><select id="m-select" data-on-change="modal-select">${options.select.items
        .map(
          (item) =>
            `<option value="${esc(item.value)}">${esc(item.label)}</option>`,
        )
        .join("")}</select></label>`;
  const textField = !options.text
    ? ""
    : `<label><span class="lbl">${esc(options.text.label)}</span><input type="text" id="m-text" maxlength="${options.text.max || 40}" value="${esc(options.text.value)}" placeholder="${esc(options.text.placeholder || "")}" autocomplete="off"></label>`;
  const numberField =
    options.number == null
      ? ""
      : `<label><span class="lbl">${esc(options.numberLabel || "New value")}</span><input type="number" step="1" id="m-num" value="${options.number}"></label>`;
  const reasonField = !options.reason
    ? ""
    : `<label><span class="lbl">Reason (optional)</span><input type="text" id="m-reason" maxlength="160" placeholder="e.g. correction by committee"></label>`;
  const confirmField = !options.typeToConfirm
    ? ""
    : `<label><span class="lbl">Type <b class="mono">${esc(options.typeToConfirm)}</b> to confirm</span><input type="text" id="m-type" autocomplete="off"></label>`;

  $("#modal-root").innerHTML = `
    <div class="overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(options.title)}">
      <h2>${esc(options.title)}</h2>
      <div class="modal-body">${options.body || ""}</div>
      ${selectField}${textField}${numberField}${reasonField}${confirmField}
      <div class="err" id="m-err"></div>
      <div class="btn-row">
        <button class="btn" data-action="modal-cancel" id="m-cancel">Cancel</button>
        <button class="btn ${options.danger ? "btn-warn" : "btn-primary"}" data-action="modal-ok">${esc(options.confirmText || "Confirm")}</button>
      </div>
    </div></div>`;
  const first =
    $("#m-text") ||
    $("#m-select") ||
    $("#m-num") ||
    $("#m-type") ||
    $("#m-reason") ||
    $("#m-cancel");
  if (first) first.focus();
}

function closeModal() {
  ui.modal = null;
  $("#modal-root").innerHTML = "";
}

Object.assign(Actions, {
  "modal-cancel": closeModal,

  // Choosing another item (e.g. another team) refreshes the number field.
  "modal-select": (_dataset, select) => {
    const item = ui.modal.select.items.find((i) => i.value === select.value);
    if (item && item.number != null && $("#m-num"))
      $("#m-num").value = item.number;
  },

  "modal-ok": () => {
    const options = ui.modal;
    if (!options) return;
    const fail = (message) => {
      $("#m-err").textContent = message;
    };

    if (
      options.typeToConfirm &&
      $("#m-type").value.trim() !== options.typeToConfirm
    )
      return fail("Confirmation text does not match.");
    const number = $("#m-num") ? parseInt($("#m-num").value, 10) : null;
    if (options.number != null && !Number.isFinite(number))
      return fail("Enter a whole number.");
    const reason = $("#m-reason") ? $("#m-reason").value.trim() : "";
    const selected = $("#m-select") ? $("#m-select").value : null;
    const text = $("#m-text") ? $("#m-text").value.trim() : null;

    closeModal();
    options.onConfirm({ number, reason, selected, text });
  },

  go: ({ view }) => go(view),
  back: () => go(ui.backTo),
  "reload-data": () => location.reload(),

  "overlay-open": ({ name }) => {
    ui.overlay = name;
    App.renderOverlay();
  },
  "overlay-close": () => {
    ui.overlay = null;
    App.renderOverlay();
  },
});
