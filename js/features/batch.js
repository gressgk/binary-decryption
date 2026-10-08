/* ==========================================================================
   batch.js — one batch: type in the team names, then Learn / Trial / Start.
   The whole batch plays together, so there is a single Start button.
   ========================================================================== */
(() => {
  const batchWord = () => CONFIG.batchLabel.toLowerCase();

  function rosterRow(batch, team, index) {
    const started = batch.status !== "READY";
    const remove = Game.canRemoveTeam(batch, team)
      ? `<button class="btn btn-sm btn-icon" data-action="team-remove" data-id="${esc(team.id)}" aria-label="Remove ${esc(team.name)}" title="Remove">✕</button>`
      : "";
    return `
      <li class="roster-row">
        <span class="roster-no">${index + 1}</span>
        <b class="roster-name">${esc(team.name)}</b>
        ${started ? `<span class="roster-meta"><span>${team.score} pts</span>${Ui.hearts(team.lives)}</span>` : ""}
        ${remove}
      </li>`;
  }

  function teamsPaper(batch) {
    const finished = batch.status === "COMPLETED";
    const adder = finished
      ? ""
      : `
      <div class="add-team">
        <input type="text" id="team-name" placeholder="Team name, then press Enter" maxlength="40" autocomplete="off" data-enter="team-add">
        <button class="btn btn-primary" data-action="team-add">+ Add</button>
      </div>`;
    return `
      <div class="paper paper-teams">
        <span class="tape"></span>
        <div class="paper-head">
          <input class="batch-name" id="batch-name" type="text" maxlength="40" value="${esc(batch.name)}"
                 data-on-change="batch-rename" aria-label="${esc(CONFIG.batchLabel)} name">
        </div>
        ${adder}
        ${
          batch.teams.length
            ? `<ol class="roster">${batch.teams.map((t, i) => rosterRow(batch, t, i)).join("")}</ol>`
            : '<div class="roster-empty">No teams yet — add the first one above</div>'
        }
        <div class="roster-foot">
          <span class="roster-count">${batch.teams.length} team${batch.teams.length === 1 ? "" : "s"} ${Ui.batchBadge(batch)}</span>
          <button class="btn-link" data-action="batch-delete" data-id="${esc(batch.id)}">Delete this ${batchWord()}</button>
        </div>
      </div>`;
  }

  /** Where the participants join on their phones. Typing updates it live. */
  function quizCard(batch) {
    return `
      <div class="quiz-card">
        <label class="quiz-field quiz-url">
          <span class="lbl">Join at (website)</span>
          <input type="text" id="quiz-url" value="${esc(batch.quiz.url)}" placeholder="e.g. quizizz.com/join" maxlength="80"
                 autocomplete="off" data-on-input="quiz-url">
        </label>
        <label class="quiz-field quiz-code-field">
          <span class="lbl">Room code</span>
          <input class="quiz-code" type="text" id="quiz-code" value="${esc(batch.quiz.code)}" placeholder="— — —" maxlength="24"
                 autocomplete="off" data-on-input="quiz-code">
        </label>
      </div>`;
  }

  /** Small Learn / Trial / Start buttons, right under the card. */
  function launchRow(batch) {
    if (!batch.teams.length) {
      return '<div class="hub-actions"><span class="hub-hint">🔒 Add your first team to unlock Learn, Trial and Start</span></div>';
    }
    const finished = batch.status === "COMPLETED";
    const main = finished
      ? '<button class="btn btn-lime" data-action="go" data-view="final">🏆 Final results</button>'
      : `<button class="btn btn-lime" data-action="batch-start">▶ ${batch.status === "READY" ? "Start" : "Continue"}</button>`;
    const hint =
      batch.status === "READY"
        ? `All teams play together — you control the game. Press Start when everyone is ready.`
        : finished
          ? "This game is finished."
          : "The game is in progress.";
    return `
      <div class="hub-actions">
        <div class="hub-actions-row">
          <button class="btn" data-action="go" data-view="learn">Learn</button>
          <button class="btn" data-action="go" data-view="trial">Trial</button>
          ${main}
        </div>
        <span class="hub-hint">${hint}</span>
      </div>`;
  }

  Views.batch = (batch) => `
    <section class="lobby lobby-hub">
      ${Ui.floatingBits(5)}
      <div class="hub-main">
        ${teamsPaper(batch)}
        ${quizCard(batch)}
        ${launchRow(batch)}
        ${Ui.mascot("pointing", "mascot-peek")}
      </div>
    </section>`;

  Object.assign(Actions, {
    "batch-rename": (_dataset, input) => {
      const batch = currentBatch();
      if (!Batches.rename(batch, input.value)) {
        input.value = batch.name;
        return toast("The name cannot be empty");
      }
      commit();
    },

    "team-add": () => {
      const input = $("#team-name");
      const result = Batches.addTeam(currentBatch(), input.value);
      if (!result.ok) {
        toast(result.msg);
        input.focus();
        return;
      }
      ui.focus = "#team-name";
      commit();
    },

    "team-remove": ({ id }) => {
      const batch = currentBatch();
      const team = Game.findTeam(batch, id);
      openModal({
        title: `Remove ${team.name}?`,
        body: "<p>This team has not played yet, so nothing is lost.</p>",
        confirmText: "Remove",
        danger: true,
        onConfirm: () => {
          Game.removeTeam(batch, team);
          commit();
        },
      });
    },

    // Saved on every keystroke, no redraw (so the cursor stays put).
    "quiz-url": (_dataset, input) => {
      Batches.setQuiz(data(), currentBatch(), "url", input.value);
      Storage.save();
    },
    "quiz-code": (_dataset, input) => {
      Batches.setQuiz(data(), currentBatch(), "code", input.value);
      Storage.save();
    },

    "batch-start": () => {
      Game.prepareStart(currentBatch());
      go("play");
    },
  });
})();
