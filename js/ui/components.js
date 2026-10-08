/* ==========================================================================
   components.js — small HTML builders reused across screens (namespace: Ui).
   ========================================================================== */
const Ui = (() => {
  const BATCH_STATUS_LABEL = {
    READY: "Not started",
    RUNNING: "Playing",
    PAUSED: "Paused",
    COMPLETED: "Finished",
  };
  const ROUND_STATUS_LABEL = {
    notstarted: "Not started",
    inprogress: "In progress",
    completed: "Completed",
    skipped: "Skipped",
  };

  const logoBar = (extraClass = "") =>
    `<img class="brand-logo ${extraClass}" src="${esc(CONFIG.assets.logos)}" alt="Event and sponsor logos" onerror="this.hidden=true">`;

  /** The mascot in one of its poses (file name without .png in assets/mascot/). */
  const mascot = (pose, extraClass = "") =>
    `<img class="mascot ${extraClass}" src="${esc(CONFIG.assets.mascotDir)}${esc(pose)}.png" alt="" onerror="this.hidden=true">`;

  function hearts(count) {
    const total = Math.max(CONFIG.startingLives, count);
    if (count <= 0)
      return `<span class="hearts zero" title="0 lives">${"♡".repeat(CONFIG.startingLives)}</span>`;
    return `<span class="hearts" title="${count} lives">${"♥".repeat(count)}<span class="lost">${"♥".repeat(total - count)}</span></span>`;
  }

  const badge = (status, label) =>
    `<span class="badge ${esc(status)}">${esc(label)}</span>`;
  const batchBadge = (batch) =>
    badge(batch.status, BATCH_STATUS_LABEL[batch.status] || batch.status);
  const roundBadge = (round) =>
    badge(round.status, ROUND_STATUS_LABEL[round.status]);

  const delta = (n) =>
    `<span class="delta ${n > 0 ? "pos" : n < 0 ? "neg" : ""}">${signed(n)}</span>`;

  const stat = (label, value) =>
    `<div class="stat"><div class="v">${value}</div><div class="k">${label}</div></div>`;

  /** The big binary number. `effect` is one of the fx-* classes (see game.css). */
  function bits(binary, effect, small) {
    return `<div class="bits ${small ? "sm" : ""} ${effect ? `fx-${effect}` : ""}" aria-label="Binary number ${binary}"><span class="bits-text">${binary}</span></div>`;
  }

  /** Four numbers on screen at once: top-left, top-right, bottom-left, bottom-right. */
  function bitsGrid(binaries, effect) {
    const cells = binaries
      .map((b) => `<span class="bits-text">${b}</span>`)
      .join("");
    return `<div class="bits-grid len-${binaries[0].length} ${effect ? `fx-${effect}` : ""}" aria-label="Binary numbers ${binaries.join(", ")}">${cells}</div>`;
  }

  /** The answers, laid out like the Learn page: bit boxes → decimal value, in the same 2×2 order. */
  function answerGrid(binaries) {
    const cells = binaries
      .map(
        (binary, i) => `
      <div class="ans-cell">
        <span class="ans-no">${i + 1}</span>
        <span class="ans-bin">${binary
          .split("")
          .map((b) => `<i class="ans-bit b${b}">${b}</i>`)
          .join("")}</span>
        <span class="ans-arrow">→</span>
        <b class="ans-val">${parseInt(binary, 2)}</b>
      </div>`,
      )
      .join("");
    return `<div class="ans-grid">${cells}</div>`;
  }

  /** CORRECT / WRONG banner with the mascot, shown above the answer boxes. */
  function resultHead(pose, status, label, line) {
    return `<div class="res-head">${mascot(pose, "res-mascot")}
      <div><div class="stage-msg res-${status}">${esc(label)}</div><div class="res-line">${line}</div></div></div>`;
  }

  /** "8 + 2 = 10" for a binary string. */
  function equation(binary) {
    const length = binary.length;
    const terms = binary
      .split("")
      .map((b, i) => (b === "1" ? 1 << (length - 1 - i) : 0))
      .filter(Boolean);
    return terms.length ? `${terms.join(" + ")} = ${parseInt(binary, 2)}` : "0";
  }

  function logEntries(entries, newestFirst = true) {
    const items = newestFirst ? entries.slice().reverse() : entries;
    if (!items.length)
      return '<div class="log-item muted">No activity yet.</div>';
    return items
      .map((entry) => {
        const details = [];
        if (entry.old != null || entry.new != null) {
          details.push(
            `${entry.old != null ? esc(entry.old) : "—"} → ${entry.new != null ? esc(entry.new) : "—"}`,
          );
        }
        if (entry.reason) details.push(`Reason: ${esc(entry.reason)}`);
        return `<div class="log-item ${esc(entry.type)}"><time>${Fmt.clock(entry.ts)}</time>${esc(entry.action)}${details.length ? `<div class="det">${details.join(" · ")}</div>` : ""}</div>`;
      })
      .join("");
  }

  function leaderboard(teams, highlightId) {
    if (!teams.length) return '<p class="muted">No teams yet.</p>';
    const rows = teams
      .map(
        (team, i) => `
      <tr class="${i === 0 ? "hl-first" : ""} ${team.lives === 0 ? "hl-zero" : ""} ${team.id === highlightId ? "hl-current" : ""}">
        <td class="rank">${i + 1}</td><td><b>${esc(team.name)}</b></td>
        <td>${hearts(team.lives)}</td><td><b>${team.score}</b></td>
      </tr>`,
      )
      .join("");
    return `<div class="table-wrap"><table class="lb-table">
      <thead><tr><th>Rank</th><th>Team</th><th>Lives</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /** Decorative floating 0/1 tiles for the playful lobby background. */
  const FLOATERS = [
    { v: "1", x: "5%", y: "12%", s: "68px", r: "-12deg", d: "5.5s", c: "lime" },
    { v: "0", x: "88%", y: "24%", s: "58px", r: "10deg", d: "6.5s", c: "pink" },
    { v: "1", x: "12%", y: "66%", s: "54px", r: "14deg", d: "6s", c: "orange" },
    { v: "0", x: "84%", y: "62%", s: "74px", r: "-8deg", d: "7s", c: "lime" },
    { v: "1", x: "93%", y: "38%", s: "46px", r: "16deg", d: "5s", c: "purple" },
    {
      v: "0",
      x: "3%",
      y: "40%",
      s: "44px",
      r: "-14deg",
      d: "6.8s",
      c: "white",
    },
    { v: "1", x: "76%", y: "86%", s: "50px", r: "9deg", d: "5.8s", c: "pink" },
    {
      v: "0",
      x: "22%",
      y: "88%",
      s: "60px",
      r: "-6deg",
      d: "6.2s",
      c: "purple",
    },
  ];

  function floatingBits(count = FLOATERS.length) {
    return `<div class="floaters" aria-hidden="true">${FLOATERS.slice(0, count)
      .map(
        (f) =>
          `<span class="float-bit" data-c="${f.c}" style="--x:${f.x};--y:${f.y};--s:${f.s};--r:${f.r};--d:${f.d}">${f.v}</span>`,
      )
      .join("")}</div>`;
  }

  return {
    BATCH_STATUS_LABEL,
    ROUND_STATUS_LABEL,
    logoBar,
    mascot,
    hearts,
    badge,
    batchBadge,
    roundBadge,
    delta,
    stat,
    bits,
    bitsGrid,
    answerGrid,
    resultHead,
    equation,
    logEntries,
    leaderboard,
    floatingBits,
  };
})();
