/* ==========================================================================
   trial.js — practice mode, played exactly like the real game: show a number,
   pick the team that responded, mark Correct / Wrong, and the points and lives
   are worked out for you. Lives only in memory: nothing is saved or logged.
   ========================================================================== */
(() => {
  const POSE = {
    idle: "pointing",
    live: null,
    ended: "thinking",
    responded: "shocked",
    correct: "happy",
    wrong: "sad",
    noanswer: "exhausted",
  };

  /** Practice teams: the names of the current batch (copied), or three dummies. */
  function practiceTeams() {
    const batch = currentBatch();
    const names =
      batch && batch.teams.length
        ? batch.teams.map((t) => t.name)
        : ["Team A", "Team B", "Team C"];
    return names.map((name, i) => ({
      id: `p${i}`,
      name,
      score: 0,
      lives: CONFIG.startingLives,
    }));
  }

  function newRound(preset, teams, ownerId) {
    const config = Game.roundConfig(preset);
    return {
      owner: ownerId,
      preset,
      teams,
      bits: config.bits,
      seconds: config.seconds,
      points: config.points,
      effect: config.effect,
      numbers: Game.makeQuestions(config.bits)[0].numbers, // 4 different numbers, shown together
      phase: "idle", // idle | live | ended | responded | resulted
      endsAt: 0,
      timedOut: false,
      teamId: null,
      result: null,
      change: null,
    };
  }

  let trial = null;
  /** Start over whenever the trial is opened for a different batch. */
  function current() {
    const batch = currentBatch();
    const owner = batch ? batch.id : "-";
    if (!trial || trial.owner !== owner)
      trial = newRound(1, practiceTeams(), owner);
    return trial;
  }

  /* ------------------------------ stage ---------------------------------- */

  function stageHTML(t) {
    const team = t.teams.find((x) => x.id === t.teamId);
    const mascot = (pose) => (pose ? Ui.mascot(pose, "stage-mascot") : "");
    switch (t.phase) {
      case "live":
        return `<div class="timer" id="timer-text"></div>${Ui.bitsGrid(t.numbers, t.effect)}<div class="timer-bar"><i id="timer-bar"></i></div>`;
      case "ended":
        return `${mascot(POSE.ended)}<div class="stage-msg">${t.timedOut ? "TIME'S UP" : "HIDDEN"}</div><div class="stage-sub pulse">Which team responded first?</div>`;
      case "responded":
        return `${mascot(POSE.responded)}<div class="stage-kicker">FIRST RESPONSE</div><div class="stage-team">${esc(team ? team.name : "?")}</div><div class="stage-sub">Correct or wrong?</div>`;
      case "resulted":
        return `${Ui.resultHead(POSE[t.result], t.result, Game.RESULT_LABEL[t.result], `${team ? `<b>${esc(team.name)}</b> · ` : ""}${esc(t.change)}`)}
          ${Ui.answerGrid(t.numbers)}`;
      default:
        return `${mascot(POSE.idle)}<div class="stage-msg">READY</div><div class="stage-sub">Round ${t.preset}</div>`;
    }
  }

  function controlsHTML(t) {
    switch (t.phase) {
      case "live":
        return '<div class="btn-row center"><button class="btn btn-primary btn-lg" data-action="trial-hide">Hide now</button></div>';
      case "ended":
        return `<div class="btn-row center"><button class="btn btn-lg" data-action="trial-mark" data-result="noanswer">Nobody answered</button></div>
          <p class="ctrl-hint">Tap the team on the right that responded first.</p>`;
      case "responded":
        return `<div class="btn-row center">
            <button class="btn btn-lime btn-lg" data-action="trial-mark" data-result="correct">✔ Correct</button>
            <button class="btn btn-warn btn-lg" data-action="trial-mark" data-result="wrong">✘ Wrong</button>
            <button class="btn btn-lg" data-action="trial-mark" data-result="noanswer">No answer</button>
          </div>`;
      case "resulted":
        return '<div class="btn-row center"><button class="btn btn-primary btn-lg" data-action="trial-next">Next number →</button></div>';
      default:
        return '<div class="btn-row center"><button class="btn btn-lime btn-xl" data-action="trial-start">▶ Show number</button></div>';
    }
  }

  function boardHTML(t) {
    const picking = t.phase === "ended" || t.phase === "responded";
    const chips = CONFIG.rounds
      .map(
        (r) =>
          `<button class="chip ${r.n === t.preset ? "on" : ""}" data-action="trial-preset" data-n="${r.n}">${r.n}</button>`,
      )
      .join("");
    const cards = t.teams
      .map((team) => {
        const picked = team.id === t.teamId;
        const inner = `<span class="tc-name">${esc(team.name)}</span><span class="tc-meta">${Ui.hearts(team.lives)}</span><span class="tc-score">${team.score}</span>`;
        const cls = `team-card${picked ? " picked" : ""}${team.lives === 0 ? " zero" : ""}`;
        return picking
          ? `<button class="${cls} pickable" data-action="trial-pick" data-id="${esc(team.id)}">${inner}</button>`
          : `<div class="${cls}">${inner}</div>`;
      })
      .join("");
    return `
      <aside class="board">
        <div class="board-head">Practice round</div>
        <div class="chips">${chips}</div>
        <div class="board-head">${picking ? "Tap who responded first" : "Teams"}</div>
        <div class="board-list">${cards}</div>
        <button class="btn-link" data-action="trial-reset">Reset scores</button>
      </aside>`;
  }

  Views.trial = () => {
    const t = current();
    const flash = t.phase === "live" && t.effect === "glitch";
    return `
      <section class="lobby lobby-game">
        <div class="game-card paper">
          <span class="ribbon">TRIAL · points are not saved</span>
          <span class="tape"></span>
          <div class="game-grid">
            <div class="stage ${t.phase === "live" ? "live" : ""} ${flash ? "flash" : ""}">${stageHTML(t)}</div>
            ${boardHTML(t)}
          </div>
          <div class="ctrl">${controlsHTML(t)}</div>
        </div>
      </section>`;
  };

  /* ------------------------------ live timer ----------------------------- */

  Live.trial = {
    timer: () =>
      trial && trial.phase === "live"
        ? {
            ms: Math.max(0, trial.endsAt - Date.now()),
            total: trial.seconds * 1000,
            frozen: false,
          }
        : null,
    tick() {
      if (!trial || trial.phase !== "live" || Date.now() < trial.endsAt)
        return false;
      trial.phase = "ended";
      trial.timedOut = true;
      App.render();
      return true;
    },
  };

  /* ------------------------------ actions -------------------------------- */

  const redraw = (fn) => {
    fn(current());
    App.render();
  };

  Object.assign(Actions, {
    "trial-preset": ({ n }) =>
      redraw((t) => {
        trial = newRound(+n, t.teams, t.owner);
      }),
    "trial-next": () =>
      redraw((t) => {
        trial = newRound(t.preset, t.teams, t.owner);
      }),
    "trial-reset": () =>
      redraw((t) => {
        trial = newRound(t.preset, practiceTeams(), t.owner);
      }),

    "trial-start": () =>
      redraw((t) => {
        if (t.phase !== "idle") return;
        t.phase = "live";
        t.endsAt = Date.now() + t.seconds * 1000;
      }),
    "trial-hide": () =>
      redraw((t) => {
        if (t.phase === "live") t.phase = "ended";
      }),

    "trial-pick": ({ id }) =>
      redraw((t) => {
        if (t.phase !== "ended" && t.phase !== "responded") return;
        t.teamId = id;
        t.phase = "responded";
      }),

    "trial-mark": ({ result }) =>
      redraw((t) => {
        const team = t.teams.find((x) => x.id === t.teamId);
        if (result !== "noanswer" && !team)
          return toast("Tap the team that responded first");
        if (t.phase !== "ended" && t.phase !== "responded") return;
        const used = result === "noanswer" ? null : team;
        const change = used
          ? Game.scoreFor(used, result, t.points)
          : { score: 0, life: 0 };
        if (used) {
          used.score += change.score;
          used.lives += change.life;
        }
        t.result = result;
        t.teamId = used ? used.id : null;
        t.change = Game.describeChange(change).replace(/[()]/g, "");
        t.phase = "resulted";
      }),
  });
})();
