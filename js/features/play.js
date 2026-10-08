/* ==========================================================================
   play.js — the live game screen. The whole batch plays together: the stage
   is what everyone watches, the team list on the right is the scoreboard.
   Only the operator touches the controls.
   ========================================================================== */
(() => {
  const POSE = {
    ready: "pointing",
    ended: "thinking",
    responded: "shocked",
    correct: "happy",
    wrong: "sad",
    noanswer: "exhausted",
    skipped: "crossed-arm",
  };

  /** Round 1–5 dots: finished, skipped, current. */
  function roundStrip(batch) {
    return `<div class="steps">${batch.rounds
      .map(
        (r) =>
          `<span class="step ${r.status} ${r.n === batch.currentRound ? "cur" : ""}" title="Round ${r.n}">${r.n}</span>`,
      )
      .join("")}</div>`;
  }

  /* ------------------------------ stage ---------------------------------- */

  const stageMascot = (pose) => Ui.mascot(pose, "stage-mascot");

  /** "Join at … / code …" for the people watching the shared screen. */
  function joinInfo(batch, big) {
    const { url, code } = batch.quiz;
    if (!url && !code) return "";
    return `<div class="join-info ${big ? "big" : ""}">
      ${url ? `<span class="join-url">${esc(url)}</span>` : ""}
      ${code ? `<span class="join-code">${esc(code)}</span>` : ""}
    </div>`;
  }

  function stageQuestion(batch, round, q) {
    const config = Game.roundConfig(batch.currentRound);
    const team = Game.findTeam(batch, q.teamId);

    switch (q.phase) {
      case "live":
        return `<div class="timer" id="timer-text"></div>${Ui.bitsGrid(q.numbers, config.effect)}<div class="timer-bar"><i id="timer-bar"></i></div>`;
      case "ended":
        return `${stageMascot(POSE.ended)}
          <div class="stage-msg">${q.timedOut ? "TIME'S UP" : "HIDDEN"}</div>
          <div class="stage-sub pulse">Which team responded first?</div>`;
      case "responded":
        return `${stageMascot(POSE.responded)}
          <div class="stage-kicker">FIRST RESPONSE LOCKED</div>
          <div class="stage-team">${esc(team ? team.name : "?")}</div>
          <div class="stage-sub">Waiting for the answer…</div>`;
      case "resulted": {
        if (q.status === "skipped") {
          return `${stageMascot("crossed-arm")}<div class="stage-msg">SKIPPED</div><div class="stage-sub">Nobody scores on this question</div>`;
        }
        const change = Game.describeChange({
          score: q.scoreChange,
          life: q.lifeChange,
        }).replace(/[()]/g, "");
        return `${Ui.resultHead(POSE[q.status], q.status, q.result, `${q.answeredBy ? `<b>${esc(q.answeredBy)}</b> · ` : ""}${esc(change)}`)}
          ${Ui.answerGrid(q.numbers)}`;
      }
      default:
        return `${stageMascot(POSE.ready)}
          <div class="stage-msg">READY</div>
          <div class="stage-sub">Round ${batch.currentRound} · Question ${batch.currentQuestion + 1}</div>
          ${joinInfo(batch, true)}`;
    }
  }

  function stageRoundOver(batch, round) {
    const counts = Game.roundCounts(round);
    if (round.status === "skipped") {
      return `${stageMascot("crossed-arm")}<div class="stage-msg">ROUND ${round.n} SKIPPED</div><div class="stage-sub">You can reopen it from the menu</div>`;
    }
    return `${stageMascot("proud")}<div class="stage-msg">ROUND ${round.n} COMPLETE</div>
      <div class="stage-sub">${counts.correct} correct · ${counts.wrong} wrong · ${counts.noanswer} no answer</div>`;
  }

  function stageFinished() {
    return `${stageMascot("celebrating")}<div class="stage-msg">GAME FINISHED</div><div class="stage-sub">Time for the results</div>`;
  }

  /* ----------------------------- controls -------------------------------- */

  function peekBar(batch, q) {
    const key = `${batch.id}:${batch.currentRound}:${batch.currentQuestion}`;
    if (q.locked) return '<div class="peekbar"></div>';
    if (ui.peekKey === key) {
      return `<div class="peekbar"><span class="peek"><b>OPERATOR</b>${q.values.join(" · ")}</span>
        <button class="peek-btn" data-action="peek-hide">hide</button></div>`;
    }
    return '<div class="peekbar"><button class="peek-btn" data-action="peek-show">👁 Peek answer (operator only)</button></div>';
  }

  function controlsQuestion(batch, q) {
    const paused = batch.status === "PAUSED";
    const off = paused ? "disabled" : "";
    switch (q.phase) {
      case "live":
        return `<div class="btn-row center">
          <button class="btn btn-primary btn-lg" data-action="hide-now">Hide now</button>
          ${
            batch.timer.state === "paused"
              ? `<button class="btn btn-lg" data-action="timer-resume" ${off}>Resume timer</button>`
              : `<button class="btn btn-lg" data-action="timer-pause" ${off}>Pause timer</button>`
          }
        </div>`;
      case "ended":
        return `<div class="btn-row center">
          <button class="btn btn-lg" data-action="show-again" ${off}>↻ Show again</button>
          <button class="btn btn-lg" data-action="mark" data-result="noanswer" ${off}>Nobody answered</button>
        </div>
        <p class="ctrl-hint">Tap the team on the right that responded first.</p>`;
      case "responded":
        return `<div class="btn-row center">
            <button class="btn btn-lime btn-lg" data-action="mark" data-result="correct" ${off}>✔ Correct</button>
            <button class="btn btn-warn btn-lg" data-action="mark" data-result="wrong" ${off}>✘ Wrong</button>
            <button class="btn btn-lg" data-action="mark" data-result="noanswer" ${off}>No answer</button>
          </div>
          <p class="ctrl-hint">Wrong team? Tap another team on the right.</p>`;
      case "resulted":
        return `<div class="btn-row center">
          <button class="btn btn-primary btn-lg" data-action="q-next">Next →</button>
          <button class="btn" data-action="undo">↶ Undo</button>
        </div>`;
      default:
        return `<div class="btn-row center"><button class="btn btn-lime btn-xl" data-action="start-question" ${off}>▶ Show question</button></div>`;
    }
  }

  function controlsRoundOver(batch) {
    const next = Game.nextRound(batch);
    return `<div class="btn-row center">${
      next
        ? `<button class="btn btn-primary btn-xl" data-action="round-next">Round ${next.n} →</button>`
        : '<button class="btn btn-primary btn-xl" data-action="go" data-view="final">🏆 Final results</button>'
    }</div>`;
  }

  /* ----------------------------- scoreboard ------------------------------ */

  function scoreboard(batch, q, picking) {
    const cards = batch.teams
      .map((team) => {
        const answered = team.id === q.teamId;
        const delta =
          answered && q.locked
            ? `<span class="tc-delta">${q.scoreChange ? signed(q.scoreChange) : q.lifeChange ? "♥ −1" : ""}</span>`
            : "";
        const inner = `
        <span class="tc-name">${esc(team.name)}</span>
        <span class="tc-meta">${Ui.hearts(team.lives)}</span>
        <span class="tc-score">${team.score}${delta}</span>`;
        const cls = `team-card${answered ? " picked" : ""}${team.lives === 0 ? " zero" : ""}`;
        return picking
          ? `<button class="${cls} pickable" data-action="pick-team" data-id="${esc(team.id)}">${inner}</button>`
          : `<div class="${cls}">${inner}</div>`;
      })
      .join("");
    return `
      <aside class="board">
        ${roundStrip(batch)}
        <div class="board-head">${picking ? "Tap who responded first" : "Teams"}</div>
        <div class="board-list">${cards}</div>
        ${joinInfo(batch, false)}
      </aside>`;
  }

  /** Small "skip / finish" buttons for when the schedule runs late. */
  function extras(batch, q, roundOver) {
    const skipQ =
      !roundOver && !q.locked
        ? '<button class="btn btn-sm" data-action="skip-question">Skip question</button>'
        : "";
    const dice =
      !roundOver && Game.isOpen(q)
        ? '<button class="btn btn-sm" data-action="new-numbers">🎲 New numbers</button>'
        : "";
    const skipR = !roundOver
      ? '<button class="btn btn-sm" data-action="skip-round-now">Skip round →</button>'
      : "";
    return `<div class="extras">${dice}${skipQ}${skipR}<button class="btn btn-sm btn-danger" data-action="finish">Finish game</button></div>`;
  }

  /* ------------------------------- view ---------------------------------- */

  Views.play = (batch) => {
    const round = Game.currentRound(batch);
    const q = Game.currentQuestion(batch);
    const finished = batch.status === "COMPLETED";
    const roundOver =
      round.status === "completed" || round.status === "skipped";
    const picking =
      !finished &&
      !roundOver &&
      ["ended", "responded"].includes(q.phase) &&
      !q.locked;

    let stage, controls;
    if (finished) {
      stage = stageFinished();
      controls =
        '<div class="btn-row center"><button class="btn btn-primary btn-xl" data-action="go" data-view="final">🏆 Final results</button></div>';
    } else if (roundOver) {
      stage = stageRoundOver(batch, round);
      controls = controlsRoundOver(batch);
    } else {
      stage = stageQuestion(batch, round, q);
      controls = controlsQuestion(batch, q);
    }
    const playing = !finished && !roundOver;
    const flash =
      playing &&
      q.phase === "live" &&
      Game.roundConfig(batch.currentRound).effect === "glitch";
    const ribbon = playing
      ? `ROUND ${batch.currentRound} · QUESTION ${batch.currentQuestion + 1}/${CONFIG.questionsPerRound}`
      : `ROUND ${batch.currentRound}`;

    return `
      <section class="lobby lobby-game is-play">
        <div class="game-card paper">
          <span class="ribbon">${ribbon}</span>
          <span class="tape"></span>
          <div class="game-grid">
            <div class="stage ${playing && q.phase === "live" ? "live" : ""} ${flash ? "flash" : ""}">${stage}</div>
            ${scoreboard(batch, q, picking)}
          </div>
          <div class="ctrl">${controls}
            <div class="ctrl-foot">${playing ? peekBar(batch, q) : '<div class="peekbar"></div>'}${finished ? "" : extras(batch, q, roundOver)}</div>
          </div>
        </div>
      </section>`;
  };

  Overlays.pause = () => `
    <div class="overlay pause"><div class="pause-sheet">
      ${Ui.mascot("exhausted", "pause-mascot")}
      <h1>PAUSED</h1>
      <div class="sub">A short technical break — we'll be right back.</div>
      <button class="btn btn-lime btn-xl" data-action="resume">▶ Resume</button>
    </div></div>`;

  /* ------------------------------ live timer ----------------------------- */

  Live.play = {
    timer() {
      const batch = currentBatch();
      if (!batch || Game.currentQuestion(batch).phase !== "live") return null;
      const seconds = Game.roundConfig(batch.currentRound).seconds;
      return {
        ms: Timer.remaining(batch),
        total: seconds * 1000,
        frozen: batch.timer.state === "paused",
      };
    },
    tick() {
      const batch = currentBatch();
      if (!batch || batch.status === "PAUSED" || !Game.tickCheck(batch))
        return false;
      commit();
      return true;
    },
  };

  /* ------------------------------ actions -------------------------------- */

  /** Run a Game call on the current batch; toast the reason if it refuses. */
  function run(fn) {
    const batch = currentBatch();
    const outcome = fn(batch);
    if (outcome && outcome.ok === false) toast(outcome.msg);
    commit();
  }

  Object.assign(Actions, {
    "start-question": () => run((b) => Game.showQuestion(b)),
    "hide-now": () => run((b) => Game.endDisplay(b, "manual")),
    "timer-pause": () => run((b) => Game.timerPause(b)),
    "timer-resume": () => run((b) => Game.timerResume(b)),
    "show-again": () => run((b) => Game.timerRestart(b)),
    "pick-team": ({ id }) => run((b) => Game.setAnsweringTeam(b, id)),

    mark: ({ result }) => run((b) => Game.applyResult(b, result, "")),

    "q-next": () => {
      const batch = currentBatch();
      const outcome = Game.nextQuestion(batch);
      if (outcome.allDone) {
        Storage.save();
        go("final");
      } else commit();
    },

    "round-next": () => {
      const batch = currentBatch();
      const next = Game.nextRound(batch);
      if (!next) return go("final");
      Game.openRound(batch, next.n);
      commit();
    },

    "open-round": ({ n }) => run((b) => Game.openRound(b, +n)),

    "new-numbers": () =>
      run((b) => {
        const outcome = Game.randomizeRound(b, b.currentRound);
        toast(outcome.ok ? "New numbers for this round" : outcome.msg);
      }),

    "skip-question": () => {
      const batch = currentBatch();
      openModal({
        title: "Skip this question?",
        body: "<p>Nobody scores on it and the game moves on. You can undo this from the menu.</p>",
        confirmText: "Skip question",
        danger: true,
        onConfirm: () => {
          Game.skipQuestion(batch);
          const outcome = Game.nextQuestion(batch);
          if (outcome.allDone) {
            Storage.save();
            go("final");
          } else commit();
        },
      });
    },

    "skip-round-now": () => {
      const batch = currentBatch();
      const n = batch.currentRound;
      const left = Game.currentRound(batch).questions.filter(
        (q) => q.status === "pending",
      ).length;
      openModal({
        title: `Skip the rest of Round ${n}?`,
        body: `<p>${left} unanswered question${left === 1 ? "" : "s"} will be left out, then the next round opens. Results already recorded stay.</p>`,
        confirmText: "Skip round",
        danger: true,
        onConfirm: () => {
          Game.skipRound(batch, n, "skipped from the game screen");
          const next = Game.nextRound(batch);
          if (!next) {
            Storage.save();
            return go("final");
          }
          Game.openRound(batch, next.n);
          commit();
        },
      });
    },

    pause: () => run((b) => Game.pauseGame(b)),
    resume: () => run((b) => Game.resumeGame(b)),

    "peek-show": () => {
      const b = currentBatch();
      ui.peekKey = `${b.id}:${b.currentRound}:${b.currentQuestion}`;
      App.render();
    },
    "peek-hide": () => {
      ui.peekKey = null;
      App.render();
    },
  });
})();
