/* ==========================================================================
   menu.js — the operator menu and the activity log, plus every correction
   (undo, edit score/lives, randomize, skip, finish). Each one asks for
   confirmation and is written to the audit log.
   ========================================================================== */
(() => {
  const menuButton = (label, attrs, extra = "") =>
    `<button class="btn ${extra}" ${attrs} data-close>${label}</button>`;

  Overlays.menu = (b) => {
    if (!b) return "";
    const rounds = b.rounds
      .map(
        (r) => `
      <button class="round-btn ${r.status} ${r.n === b.currentRound ? "cur" : ""}" data-action="open-round" data-n="${r.n}" data-close>
        Round ${r.n}<small>${Ui.ROUND_STATUS_LABEL[r.status]}</small>
      </button>`,
      )
      .join("");

    return `
      <div class="overlay"><div class="sheet">
        <div class="menu-head"><h2>Operator menu</h2><button class="btn" data-action="overlay-close">Close</button></div>

        <div class="menu-sec"><div class="eyebrow">Open a round</div><div class="round-grid">${rounds}</div></div>

        <div class="menu-sec"><div class="eyebrow">Go to</div><div class="btn-row">
          ${menuButton("← Teams", 'data-action="go" data-view="batch"')}
          ${menuButton("🏆 Leaderboard", 'data-action="overlay-open" data-name="leaderboard"')}
          ${menuButton("📋 Activity log", 'data-action="overlay-open" data-name="log"')}
          ${menuButton("Summary", 'data-action="go" data-view="summary"')}
          ${menuButton("Room code…", 'data-action="edit-quiz"')}
          ${menuButton("Learn", 'data-action="go" data-view="learn"')}
          ${menuButton("Trial", 'data-action="go" data-view="trial"')}
          ${menuButton("Export this " + CONFIG.batchLabel.toLowerCase(), `data-action="export-batch" data-id="${esc(b.id)}"`)}
        </div></div>

        <div class="menu-sec danger"><div class="eyebrow">Corrections — all logged</div><div class="btn-row">
          ${menuButton("Undo last result…", `data-action="undo" ${b.undoStack.length ? "" : "disabled"}`, "btn-danger")}
          ${menuButton("Edit score…", 'data-action="edit-score"', "btn-danger")}
          ${menuButton("Edit lives…", 'data-action="edit-lives"', "btn-danger")}
          ${menuButton(`Randomize Round ${b.currentRound}…`, 'data-action="randomize"', "btn-danger")}
          ${menuButton(`Skip Round ${b.currentRound}…`, 'data-action="skip-round"', "btn-danger")}
        </div></div>

        <div class="menu-sec danger"><div class="eyebrow">End</div>
          ${menuButton("Finish the game…", 'data-action="finish"', "btn-danger")}
        </div>
      </div></div>`;
  };

  Overlays.log = (b) => {
    if (!b) return "";
    return `
      <div class="overlay"><div class="sheet">
        <div class="menu-head"><h2>Activity log <span class="muted small">(${b.auditLog.length})</span></h2>
          <button class="btn" data-action="overlay-close">Close</button></div>
        <div class="log">${Ui.logEntries(b.auditLog)}</div>
      </div></div>`;
  };

  /* ---------------------------- corrections ------------------------------ */

  /** Modal field to choose a team; `pick` says which number to prefill (score or lives). */
  function teamSelect(b, pick) {
    return {
      label: "Team",
      items: b.teams.map((t) => ({
        value: t.id,
        label: `${t.name} (${pick(t)})`,
        number: pick(t),
      })),
    };
  }

  Object.assign(Actions, {
    "edit-quiz": () => {
      const b = currentBatch();
      openModal({
        title: "Room code",
        body: "<p>Participants see this on the shared screen.</p>",
        text: {
          label: "Code",
          value: b.quiz.code,
          placeholder: "e.g. 123 456",
          max: 24,
        },
        confirmText: "Save",
        onConfirm: ({ text }) => {
          Batches.setQuiz(data(), b, "code", text);
          Game.log(b, "Room code changed", { new: text });
          commit();
        },
      });
    },

    undo: () => {
      const b = currentBatch();
      openModal({
        title: "Undo last result?",
        body: "<p>Takes back the last score / life change and lets you mark the question again. This is recorded in the activity log.</p>",
        confirmText: "Undo result",
        danger: true,
        onConfirm: () => {
          const outcome = Game.undoLast(b);
          if (outcome.ok) data().ui.view = "play";
          else toast(outcome.msg);
          commit();
        },
      });
    },

    "edit-score": () => {
      const b = currentBatch();
      if (!b.teams.length) return;
      openModal({
        title: "Edit score",
        body: "<p>Pick a team and type its new score.</p>",
        select: teamSelect(b, (t) => t.score),
        number: b.teams[0].score,
        numberLabel: "New score",
        reason: true,
        confirmText: "Apply",
        danger: true,
        onConfirm: ({ number, reason, selected }) => {
          if (number === Game.findTeam(b, selected).score)
            return toast("Score unchanged");
          Game.adjustScore(b, selected, number, reason);
          commit();
        },
      });
    },

    "edit-lives": () => {
      const b = currentBatch();
      if (!b.teams.length) return;
      openModal({
        title: "Edit lives",
        body: `<p>Pick a team and type its new number of lives (0–${CONFIG.maxLives}).</p>`,
        select: teamSelect(b, (t) => t.lives),
        number: b.teams[0].lives,
        numberLabel: "New lives",
        reason: true,
        confirmText: "Apply",
        danger: true,
        onConfirm: ({ number, reason, selected }) => {
          const lives = Math.max(0, Math.min(CONFIG.maxLives, number));
          if (lives === Game.findTeam(b, selected).lives)
            return toast("Lives unchanged");
          Game.adjustLives(b, selected, lives, reason);
          commit();
        },
      });
    },

    randomize: () => {
      const b = currentBatch();
      const round = b.currentRound;
      openModal({
        title: "New random numbers for this round?",
        body: `<p>Every question in Round ${round} that is not answered yet gets brand-new numbers. Logged with old and new values.</p>`,
        confirmText: "Randomize",
        danger: true,
        onConfirm: () => {
          const outcome = Game.randomizeRound(b, round);
          toast(outcome.ok ? `Round ${round} questions replaced` : outcome.msg);
          commit();
        },
      });
    },

    "skip-round": () => {
      const b = currentBatch();
      const round = b.currentRound;
      openModal({
        title: `Skip Round ${round}?`,
        body: "<p>The round is marked Skipped. You can reopen it later.</p>",
        reason: true,
        confirmText: "Skip round",
        danger: true,
        onConfirm: ({ reason }) => {
          Game.skipRound(b, round, reason);
          commit();
        },
      });
    },

    finish: () => {
      const b = currentBatch();
      const p = Game.progress(b);
      openModal({
        title: "Finish the game now?",
        body: `<p>Rounds completed: <b>${p.roundsDone}/${p.roundsTotal}</b><br>Questions completed: <b>${p.questionsDone}/${p.questionsTotal}</b></p>`,
        confirmText: "Finish and show results",
        danger: true,
        onConfirm: () => {
          Game.finishBatch(b);
          Storage.save();
          go("final");
        },
      });
    },
  });
})();
