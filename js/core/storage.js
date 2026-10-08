/* ==========================================================================
   storage.js — localStorage persistence.

   Every state change calls Storage.save(). Before each save the previous good
   copy is kept under a backup key; if the main copy is corrupted on load, the
   backup is used.

   Shape:  { version: 3, batches: [Batch], settings: { quizUrl }, ui: { view, batchId } }
   A batch is one game: all of its teams play together (see game.js).
   ========================================================================== */
const Storage = (() => {
  const KEY = "binaryDecryption.v3";
  const BACKUP_KEY = `${KEY}.prev`;

  const VIEWS = [
    "home",
    "batch",
    "play",
    "learn",
    "trial",
    "history",
    "summary",
    "final",
  ];

  let data = null;
  let status = { ok: true, at: null, error: "" };
  const listeners = { change: () => {}, external: () => {} };

  const blank = () => ({
    version: 3,
    batches: [],
    settings: { quizUrl: "" },
    ui: { view: "home", batchId: null },
  });

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw && JSON.parse(raw);
      return parsed && Array.isArray(parsed.batches) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  /** Fill in anything missing so the rest of the app can trust the shape. */
  function normalize(d) {
    d.version = 3;
    d.ui = { view: "home", batchId: null, ...d.ui };
    d.settings = { quizUrl: "", ...d.settings }; // remembered between batches
    d.batches.forEach((b) => {
      b.quiz = { url: "", code: "", ...b.quiz };
      Game.fixQuestions(b);
    });
    if (!VIEWS.includes(d.ui.view)) d.ui.view = "home";
    return d;
  }

  function load() {
    for (const key of [KEY, BACKUP_KEY]) {
      const parsed = read(key);
      if (!parsed) continue;
      data = normalize(parsed);
      if (key === BACKUP_KEY) status.error = "Recovered from backup copy";
      return data;
    }
    data = blank();
    return data;
  }

  function save() {
    try {
      const previous = localStorage.getItem(KEY);
      if (previous) localStorage.setItem(BACKUP_KEY, previous);
      localStorage.setItem(KEY, JSON.stringify(data));
      status = { ok: true, at: Date.now(), error: "" };
    } catch (error) {
      status = {
        ok: false,
        at: status.at,
        error: String((error && error.message) || error),
      };
    }
    listeners.change(status);
    return status.ok;
  }

  // Another tab wrote new data: warn instead of silently overwriting it.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === KEY) listeners.external();
    });
  }

  return {
    load,
    save,
    VIEWS,
    get: () => data,
    status: () => status,
    onChange: (fn) => {
      listeners.change = fn;
    },
    onExternal: (fn) => {
      listeners.external = fn;
    },
  };
})();
