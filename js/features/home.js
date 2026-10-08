/* ==========================================================================
   home.js — the landing screen: game title, mascot, Start.
   Start creates a new batch and opens the team-entry screen.
   ========================================================================== */
(() => {
  const TILE_COLORS = ["lime", "white", "pink", "orange", "purple", "lime"];
  const TILE_TILTS = ["-6deg", "3deg", "-3deg", "5deg", "-4deg", "2deg"];
  const RECENT_LIMIT = 3;

  function titleHTML() {
    const [first, ...rest] = CONFIG.appName.toUpperCase().split(" ");
    const tiles = first
      .split("")
      .map(
        (letter, i) =>
          `<span class="title-tile" data-c="${TILE_COLORS[i % TILE_COLORS.length]}" style="--tilt:${TILE_TILTS[i % TILE_TILTS.length]}">${esc(letter)}</span>`,
      )
      .join("");
    return `<h1 class="game-title" aria-label="${esc(CONFIG.appName)}">
      <span class="title-tiles" aria-hidden="true">${tiles}</span>
      <span class="title-ribbon" aria-hidden="true">${esc(rest.join(" "))}</span>
    </h1>`;
  }

  function continueHTML(d) {
    const recent = d.batches
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, RECENT_LIMIT);
    if (!recent.length) return "";
    const chips = recent
      .map((batch) => {
        const label = Ui.BATCH_STATUS_LABEL[batch.status];
        return `<button class="chip-btn" data-action="batch-open" data-id="${esc(batch.id)}">${esc(batch.name)} <small>${batch.teams.length} teams · ${label}</small></button>`;
      })
      .join("");
    return `<div class="continue"><span>Continue:</span>${chips}</div>`;
  }

  Views.home = () => `
    <section class="lobby lobby-home">
      ${Ui.floatingBits()}
      <div class="lobby-center">
        ${titleHTML()}
        <div class="mascot-stage">${Ui.mascot("waving", "mascot-hero")}</div>
        <button class="btn btn-lime btn-xl btn-pop" data-action="batch-new">▶ Start</button>
      </div>
      <div class="lobby-bottom">${continueHTML(data())}</div>
    </section>`;

  Object.assign(Actions, {
    "batch-new": () => {
      const d = data();
      const batch = Batches.create(d);
      d.ui.batchId = batch.id;
      ui.focus = "#team-name";
      go("batch");
    },

    "batch-open": ({ id }) => {
      data().ui.batchId = id;
      go("batch");
    },
  });
})();
