/* ==========================================================================
   batches.js — a batch is one game: many teams, played together, one
   leaderboard. All functions take the storage object `d` (Storage.get()).
   ========================================================================== */
const Batches = (() => {
  const find = (d, id) => d.batches.find((b) => b.id === id) || null;

  function uniqueName(d) {
    let n = d.batches.length + 1;
    while (d.batches.some((b) => b.name === `${CONFIG.batchLabel} ${n}`)) n++;
    return `${CONFIG.batchLabel} ${n}`;
  }

  function create(d) {
    const batch = Game.newBatch(
      Rand.id(
        "B",
        d.batches.map((b) => b.id),
      ),
      uniqueName(d),
    );
    batch.quiz.url = (d.settings && d.settings.quizUrl) || "";
    d.batches.push(batch);
    return batch;
  }

  /** Quiz join info. The URL is remembered for the next batch; the code is per batch. */
  function setQuiz(d, batch, field, value) {
    batch.quiz[field] = value.trim().slice(0, 80);
    if (field === "url") d.settings.quizUrl = batch.quiz.url;
    batch.updatedAt = Date.now();
  }

  function rename(batch, name) {
    const clean = name.trim();
    if (!clean) return false;
    batch.name = clean.slice(0, 40);
    batch.updatedAt = Date.now();
    return true;
  }

  function addTeam(batch, rawName) {
    if (batch.status === "COMPLETED")
      return { ok: false, msg: "This game is finished" };
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, msg: "Type a team name first" };
    if (batch.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return {
        ok: false,
        msg: `"${name}" is already in this ${CONFIG.batchLabel.toLowerCase()}`,
      };
    }
    const team = Game.addTeam(
      batch,
      Rand.id(
        "T",
        batch.teams.map((t) => t.id),
      ),
      name,
    );
    return { ok: true, team };
  }

  function removeBatch(d, batch) {
    d.batches = d.batches.filter((b) => b.id !== batch.id);
    if (d.ui.batchId === batch.id) d.ui.batchId = null;
  }

  function removeAll(d) {
    d.batches = [];
    d.ui.batchId = null;
  }

  /** Drop batches that never got a team (e.g. "Start" pressed by accident). */
  function pruneEmpty(d, keepId = null) {
    d.batches = d.batches.filter((b) => b.id === keepId || b.teams.length > 0);
    if (d.ui.batchId && !find(d, d.ui.batchId)) d.ui.batchId = null;
  }

  const standings = (batch) => Game.ranking(batch.teams);

  return {
    find,
    create,
    setQuiz,
    rename,
    addTeam,
    removeBatch,
    removeAll,
    pruneEmpty,
    standings,
  };
})();
