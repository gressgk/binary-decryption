/* ==========================================================================
   results.js — the batch summary, the leaderboard overlay and the final podium.
   ========================================================================== */
(() => {
  /* ------------------------------ summary -------------------------------- */

  const numbersText = (q) => (q.numbers || [q.binary]).join(" · ");
  const valuesText = (q) => (q.values || [q.decimal]).join(" · ");

  /** One table per round: which numbers were asked, who answered, what it was worth. */
  function roundSection(round) {
    const c = Game.roundCounts(round);
    const rows = round.questions
      .map(
        (q, i) => `
      <tr><td><b>Q${i + 1}</b></td>
        <td class="mono nowrap">${numbersText(q)}</td><td class="mono nowrap">${valuesText(q)}</td>
        <td>${q.answeredBy ? `<b>${esc(q.answeredBy)}</b>` : "—"}</td>
        <td>${Ui.badge(q.status, q.result || "Pending")}</td>
        <td>${q.locked ? Ui.delta(q.scoreChange) : "—"}</td><td>${q.locked ? Ui.delta(q.lifeChange) : "—"}</td></tr>`,
      )
      .join("");
    return `
      <section class="card">
        <div class="round-head"><h2 class="no-margin">Round ${round.n}</h2>${Ui.roundBadge(round)}
          <span class="muted small">${c.correct} correct · ${c.wrong} wrong · ${c.noanswer} no answer${c.skipped ? ` · ${c.skipped} skipped` : ""}</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Q</th><th>Numbers (in dictation order)</th><th>Answers</th><th>Answered by</th><th>Result</th><th>Score</th><th>Lives</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
      </section>`;
  }

  /** Rank, team, lives, score and the prize money for the winners. */
  function rankingTable(b) {
    const rows = Batches.standings(b)
      .map((team, i) => {
        const prize = Game.reward(i);
        return `<tr class="${prize ? "hl-first" : ""}"><td class="rank">${i + 1}</td><td><b>${esc(team.name)}</b></td>
        <td>${Ui.hearts(team.lives)}</td><td><b>${team.score}</b></td>
        <td>${prize ? `<span class="prize-chip">${Fmt.reward(prize)}</span>` : "—"}</td></tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="lb-table">
      <thead><tr><th>Rank</th><th>Team</th><th>Lives</th><th>Score</th><th>Extra capital</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function winnersLine(b) {
    if (b.status !== "COMPLETED")
      return '<p class="muted no-margin">This game is not finished yet — the ranking below is the current one.</p>';
    const teams = Batches.standings(b);
    const winners = CONFIG.rewards
      .map((amount, i) =>
        teams[i]
          ? `<div class="win-pill"><span>${i + 1}${i ? "nd" : "st"}</span><b>${esc(teams[i].name)}</b><i>${Fmt.reward(amount)}</i></div>`
          : "",
      )
      .join("");
    return `<div class="win-pills">${winners}</div>`;
  }

  Views.summary = (b) => {
    const manual = b.auditLog.filter(
      (e) => e.type === "manual" || e.type === "undo",
    );
    const roundRows = b.rounds
      .map((r) => {
        const c = Game.roundCounts(r);
        return `<tr><td>Round ${r.n}</td><td>${Ui.roundBadge(r)}</td><td>${c.correct}</td><td>${c.wrong}</td><td>${c.noanswer}</td><td><b>${signed(c.points)}</b></td></tr>`;
      })
      .join("");

    return `
      <div class="page-title no-print">
        <div class="muted">Generated ${Fmt.dateTime(Date.now())}</div>
        <div class="btn-row">
          <button class="btn btn-primary" data-action="export-batch" data-id="${esc(b.id)}">Export JSON</button>
          <button class="btn" data-action="print">Print / Save as PDF</button>
        </div>
      </div>
      <section class="card hero">
        <div><h2 class="no-margin">${esc(b.name)}</h2>
          <div class="muted">${Ui.batchBadge(b)} · ${b.teams.length} teams · ${Fmt.dateTime(b.createdAt)}</div></div>
      </section>
      <section class="card"><h2>Result &amp; extra capital</h2>${winnersLine(b)}${rankingTable(b)}</section>
      <section class="card"><h2>Teams that played</h2>
        <div class="team-chips">${b.teams.map((t) => `<span class="team-chip">${esc(t.name)}</span>`).join("") || '<span class="muted">No teams.</span>'}</div></section>
      <section class="card"><h2>Rounds</h2><div class="table-wrap"><table>
        <thead><tr><th>Round</th><th>Status</th><th>Correct</th><th>Wrong</th><th>No answer</th><th>Points</th></tr></thead>
        <tbody>${roundRows}</tbody></table></div></section>
      ${b.rounds.map(roundSection).join("")}
      <section class="card"><h2>Manual adjustments &amp; corrections</h2>
        <div class="log log--full">${manual.length ? Ui.logEntries(manual, false) : '<div class="log-item muted">None.</div>'}</div></section>
      <section class="card"><h2>Full activity log</h2><div class="log">${Ui.logEntries(b.auditLog, false)}</div></section>`;
  };

  /* ---------------------------- leaderboard overlay ---------------------- */

  Overlays.leaderboard = (b) => {
    if (!b) return "";
    return `
      <div class="overlay"><div class="sheet">
        <h1>🏆 ${esc(b.name)}</h1>
        ${Ui.leaderboard(Batches.standings(b))}
        <div class="btn-row sheet-actions">
          <button class="btn btn-primary btn-lg" data-action="overlay-close">Close</button>
        </div>
      </div></div>`;
  };

  /* ---------------------------- final podium ----------------------------- */

  const CONFETTI_COLORS = [
    "#1D44F9",
    "#CCF02A",
    "#5C30FF",
    "#FF5F05",
    "#FF00C0",
  ];
  const PLACES = ["1ST", "2ND"];
  const WIN_POSE = ["celebrating", "proud"];

  function confetti(count = 30) {
    return Array.from({ length: count }, () => {
      const color =
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      return `<i style="left:${Math.random() * 100}%;background:${color};animation-duration:${5 + Math.random() * 6}s;animation-delay:${-Math.random() * 8}s"></i>`;
    }).join("");
  }

  function winnerCard(team, index) {
    if (!team)
      return `<div class="win win${index + 1}"><div class="place">${PLACES[index]}</div><div class="win-name muted">—</div></div>`;
    return `
      <div class="win win${index + 1}">
        ${Ui.mascot(WIN_POSE[index], "win-mascot")}
        <div class="place">${PLACES[index]}</div>
        <div class="win-name">${esc(team.name)}</div>
        <div class="win-stats"><b>${team.score}</b> pts · ${Ui.hearts(team.lives)}</div>
        <div class="prize">${Fmt.reward(Game.reward(index))}</div>
        <div class="prize-note">extra capital</div>
      </div>`;
  }

  Views.final = (b) => {
    const teams = Batches.standings(b);
    const winners = CONFIG.rewards.length;
    const others = teams
      .slice(winners)
      .map(
        (team, i) => `
      <div class="other-row"><span class="rank">${i + winners + 1}</span><b>${esc(team.name)}</b><span>${Ui.hearts(team.lives)}</span><span class="other-score">${team.score}</span></div>`,
      )
      .join("");
    const live = b.status !== "COMPLETED";

    return `
      <div class="confetti no-print">${confetti()}</div>
      <section class="lobby lobby-game lobby-final">
        <div class="game-card paper">
          <span class="ribbon">FINAL LEADERBOARD</span>
          <span class="tape"></span>
          <h1 class="final-title">${esc(b.name)}</h1>
          ${live ? '<p class="center muted no-margin">The game is not finished yet — this is the current ranking.</p>' : ""}
          <div class="win-grid">${CONFIG.rewards.map((_, i) => winnerCard(teams[i], i)).join("")}</div>
          ${others ? `<div class="other-list">${others}</div>` : ""}
          <div class="btn-row center no-print final-actions">
            <button class="btn btn-lg" data-action="go" data-view="batch">← Teams</button>
            <button class="btn btn-lg" data-action="go" data-view="summary">Full recap</button>
            <button class="btn btn-primary btn-lg" data-action="export-result">Export Result</button>
            <button class="btn btn-lg" data-action="print">Print</button>
          </div>
          <p class="center small muted no-margin">Ties: more lives first, then the team added first.</p>
        </div>
      </section>`;
  };

  /* ---------------------------- actions ---------------------------------- */

  Object.assign(Actions, {
    print: () => window.print(),

    "export-result": () => {
      const batch = currentBatch();
      const leaderboard = Batches.standings(batch).map((team, i) => ({
        rank: i + 1,
        team: team.name,
        score: team.score,
        lives: team.lives,
        reward: Game.reward(i) ? Fmt.reward(Game.reward(i)) : null,
      }));
      download(
        `binary-decryption_RESULT_${Fmt.slug(batch.name)}_${Fmt.stamp()}.json`,
        JSON.stringify(
          {
            app: "binary-decryption",
            batch: batch.name,
            exportedAt: new Date().toISOString(),
            teams: batch.teams.map((t) => t.name),
            leaderboard,
            rounds: batch.rounds.map((r) => ({
              round: r.n,
              status: r.status,
              questions: r.questions.map((q, i) => ({
                q: i + 1,
                numbers: q.numbers || [q.binary],
                answers: q.values || [q.decimal],
                answeredBy: q.answeredBy || null,
                result: q.result || "Pending",
                score: q.scoreChange || 0,
                lives: q.lifeChange || 0,
              })),
            })),
          },
          null,
          2,
        ),
      );
      toast("Result exported");
    },
  });
})();
