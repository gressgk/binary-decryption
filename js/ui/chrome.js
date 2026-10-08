/* ==========================================================================
   chrome.js — the frame around every screen: one top bar that looks the same
   everywhere (logo fixed in the centre, a button slot on each side), plus
   banners and the save indicator.
   ========================================================================== */
const Chrome = (() => {
  const LOBBY_VIEWS = ["home", "batch", "learn", "trial", "play", "final"]; // blue, playful background
  const PAGE_TITLES = {
    learn: "Learn",
    trial: "Trial",
    history: "History & Backup",
    summary: "Summary",
    final: "Final leaderboard",
  };

  const isLobby = (view) => LOBBY_VIEWS.includes(view);

  const button = (label, action, view) =>
    `<button class="btn" data-action="${action}" ${view ? `data-view="${view}"` : ""}>${label}</button>`;

  function gameInfo(batch) {
    const round = Game.currentRound(batch);
    const roundOver =
      round.status === "completed" || round.status === "skipped";
    return `
      <div class="hbar">
        <b class="hbar-name">${esc(batch.name)}</b>
        <span>Round <b>${batch.currentRound}</b>/${CONFIG.rounds.length}</span>
        ${roundOver ? "" : `<span>Q <b>${batch.currentQuestion + 1}</b>/${CONFIG.questionsPerRound}</span>`}
      </div>`;
  }

  function gameButtons(batch) {
    return `
      <button class="btn btn-warn" data-action="pause" ${batch.status === "RUNNING" ? "" : "disabled"}>Pause</button>
      <button class="btn btn-dark" data-action="overlay-open" data-name="menu">☰ Menu</button>`;
  }

  /** What goes in the left and right slots of the bar for each screen. */
  function slots(view, batch) {
    switch (view) {
      case "home":
        return {
          left: "",
          right: button("History &amp; Backup", "go", "history"),
        };
      case "batch":
        return {
          left: button("← Home", "go", "home"),
          right: button("History &amp; Backup", "go", "history"),
        };
      case "play":
        return { left: gameInfo(batch), right: gameButtons(batch) };
      default:
        return {
          left: button("← Back", "back"),
          right: `<span class="page-name">${esc(PAGE_TITLES[view] || "")}</span>`,
        };
    }
  }

  function renderHeader(view, batch) {
    const { left, right } = slots(view, batch);
    $("#app-header").innerHTML = `
      <div class="tb-left">${left}</div>
      <div class="tb-logo">${Ui.logoBar()}</div>
      <div class="tb-right">${right}</div>`;
  }

  function renderBanner() {
    const messages = [];
    if (ui.externalChange) {
      messages.push(
        '⚠ Data was changed in another browser tab. <button class="btn btn-sm" data-action="reload-data">Reload latest data</button>',
      );
    }
    const status = Storage.status();
    if (!status.ok)
      messages.push(
        `⚠ Browser storage failed: ${esc(status.error)}. Export your data now.`,
      );
    $("#banner-root").innerHTML = messages
      .map((m) => `<div class="banner">${m}</div>`)
      .join("");
  }

  function updateSavePill() {
    const pill = $("#save-pill");
    if (!pill) return;
    const status = Storage.status();
    pill.textContent = status.ok
      ? `✓ Saved ${status.at ? Fmt.clock(status.at) : ""}`
      : "⚠ SAVE FAILED — export now";
    pill.classList.toggle("bad", !status.ok);
  }

  return { isLobby, renderHeader, renderBanner, updateSavePill };
})();
