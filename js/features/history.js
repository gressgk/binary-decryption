/* ==========================================================================
   history.js — every saved batch as a simple card: Open · Export · Delete.
   Also import / export-everything and a "delete all data" zone.
   ========================================================================== */
(() => {
  const batchWord = () => CONFIG.batchLabel.toLowerCase();

  /** "🏆 Garuda +350K · Pixel +200K" once the game is finished. */
  function winnerText(batch) {
    if (batch.status !== "COMPLETED") return "";
    const teams = Batches.standings(batch);
    const text = CONFIG.rewards
      .map((amount, i) =>
        teams[i] ? `${esc(teams[i].name)} ${Fmt.reward(amount)}` : "",
      )
      .filter(Boolean)
      .join(" · ");
    return text ? `<span class="hist-win">🏆 ${text}</span>` : "";
  }

  const batchCard = (batch) => `
    <article class="hist-card">
      <div class="hist-info">
        <b class="hist-name">${esc(batch.name)}</b>
        <span class="hist-meta">${batch.teams.length} team${batch.teams.length === 1 ? "" : "s"} · ${Fmt.dateTime(batch.createdAt)}</span>
        ${winnerText(batch)}
      </div>
      ${Ui.batchBadge(batch)}
      <div class="hist-actions">
        <button class="btn btn-primary" data-action="batch-open" data-id="${esc(batch.id)}">Open</button>
        <button class="btn" data-action="batch-recap" data-id="${esc(batch.id)}">Recap</button>
        <button class="btn" data-action="export-batch" data-id="${esc(batch.id)}">Export</button>
        <button class="btn btn-danger" data-action="batch-delete" data-id="${esc(batch.id)}">Delete</button>
      </div>
    </article>`;

  Views.history = () => {
    const batches = data()
      .batches.slice()
      .sort((a, b) => b.createdAt - a.createdAt);
    return `
      <div class="page-title">
        <div>
          <h1>Saved ${batchWord()}es</h1>
          <p class="muted no-margin">Everything is saved automatically in this browser.</p>
        </div>
        <div class="btn-row">
          <button class="btn" data-action="import">Import file</button>
          <button class="btn btn-primary" data-action="export-all" ${batches.length ? "" : "disabled"}>Export everything</button>
        </div>
      </div>
      <div class="hist-list">
        ${batches.length ? batches.map(batchCard).join("") : `<div class="card center muted">Nothing saved yet. Press Start on the home screen to create the first ${batchWord()}.</div>`}
      </div>
      ${
        batches.length
          ? `
        <section class="danger-zone">
          <div><b>Start fresh</b><div class="muted small">Removes every ${batchWord()} from this browser. Export first if you might need them.</div></div>
          <button class="btn btn-danger" data-action="delete-all">Delete all data…</button>
        </section>`
          : ""
      }`;
  };

  /* ---------------------------- export / import -------------------------- */

  const exportName = (label) =>
    `binary-decryption_${Fmt.slug(label)}_${Fmt.stamp()}.json`;

  Object.assign(Actions, {
    "export-all": () => {
      const d = data();
      download(exportName("ALL"), Backup.packAll(d));
      toast(`Exported ${d.batches.length} ${batchWord()}(s)`);
    },

    "export-batch": ({ id }) => {
      const batch = Batches.find(data(), id);
      Game.log(batch, "Batch exported to JSON");
      Storage.save();
      download(exportName(batch.name), Backup.packBatch(batch));
      toast(`Exported ${batch.name}`);
    },

    import: () => $("#import-file").click(),

    "batch-recap": ({ id }) => {
      data().ui.batchId = id;
      ui.backTo = "history";
      go("summary");
    },

    "batch-delete": ({ id }) => {
      const batch = Batches.find(data(), id);
      openModal({
        title: `Delete ${batch.name}?`,
        body: `<p>This removes the ${batchWord()} with its <b>${batch.teams.length}</b> team(s) and all results.<br>It cannot be undone — use Export first if unsure.</p>`,
        confirmText: "Delete",
        danger: true,
        onConfirm: () => {
          Batches.removeBatch(data(), batch);
          if (data().ui.view === "batch") return go("home");
          commit();
          toast(`${batch.name} deleted`);
        },
      });
    },

    "delete-all": () => {
      openModal({
        title: "Delete ALL data?",
        body: `<p>Every ${batchWord()}, team and result in this browser will be removed. This cannot be undone.</p>`,
        typeToConfirm: "DELETE",
        confirmText: "Delete everything",
        danger: true,
        onConfirm: () => {
          Batches.removeAll(data());
          commit();
          toast("All data deleted");
        },
      });
    },
  });

  $("#import-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = Backup.unpack(data(), String(reader.result));
      if (!result.ok) return toast(`Import failed: ${result.msg}`);
      Storage.save();
      go("history");
      const note = result.renamed
        ? ` (${result.renamed} got a new id to avoid overwriting)`
        : "";
      toast(`Imported ${result.batches} ${batchWord()}(s)${note}`);
    };
    reader.readAsText(file);
    event.target.value = "";
  });
})();
