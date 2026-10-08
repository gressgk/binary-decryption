/* ==========================================================================
   backup.js — export / import as JSON.
     { app, version: 3, exportedAt, batches: [...] }
   Import never overwrites existing data: clashing ids get new ones.
   Files from the older per-team versions are recognised and refused.
   ========================================================================== */
const Backup = (() => {
  const APP = "binary-decryption";
  const VERSION = 3;

  const pack = (batches) =>
    JSON.stringify(
      {
        app: APP,
        version: VERSION,
        exportedAt: new Date().toISOString(),
        batches,
      },
      null,
      2,
    );
  const packBatch = (batch) => pack([batch]);
  const packAll = (d) => pack(d.batches);

  function isValidBatch(x) {
    return (
      !!x &&
      typeof x.id === "string" &&
      typeof x.name === "string" &&
      Array.isArray(x.teams) &&
      Array.isArray(x.rounds) &&
      x.rounds.length === CONFIG.rounds.length &&
      Array.isArray(x.auditLog)
    );
  }

  /** Merge a JSON export into `d`. Returns { ok, batches, renamed, lastBatchId } or { ok:false, msg }. */
  function unpack(d, text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      return { ok: false, msg: "not valid JSON" };
    }
    if (raw && Array.isArray(raw.sessions))
      return {
        ok: false,
        msg: "this file is from an older version (per-team games)",
      };

    const batches = (
      raw && Array.isArray(raw.batches) ? raw.batches : []
    ).filter(isValidBatch);
    if (!batches.length)
      return { ok: false, msg: "no valid batches found in file" };

    let renamed = 0;
    batches.forEach((batch) => {
      if (d.batches.some((b) => b.id === batch.id)) {
        batch.id = Rand.id(
          "B",
          d.batches.map((b) => b.id),
        );
        renamed++;
      }
      batch.quiz = { url: "", code: "", ...batch.quiz };
      Game.fixQuestions(batch);
      batch.undoStack = batch.undoStack || [];
      batch.timer = batch.timer || Timer.idle();
      Game.log(batch, "Imported from JSON");
      d.batches.push(batch);
    });
    return {
      ok: true,
      batches: batches.length,
      renamed,
      lastBatchId: batches[batches.length - 1].id,
    };
  }

  return { packBatch, packAll, unpack };
})();
