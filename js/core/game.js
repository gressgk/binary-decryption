/* ==========================================================================
   game.js — the rules for ONE batch. All teams of the batch play together:
   one shared question, one timer. No DOM in here.

   Every function mutates the batch `b` and writes an audit-log entry; the UI
   layer is responsible for saving and re-rendering afterwards.

   Question phases:  ready → live → ended → responded → resulted
     ready      nothing shown yet
     live       the number is on screen, countdown running
     ended      number hidden (by hand or time-up); waiting for the first team
     responded  operator picked the team that responded first
     resulted   marked correct / wrong / no answer — locked
   ========================================================================== */
const Game = (() => {
  const RESULT_LABEL = {
    correct: "CORRECT",
    wrong: "WRONG",
    noanswer: "NO ANSWER",
    skipped: "SKIPPED",
  };
  const signed = (n) => (n > 0 ? `+${n}` : String(n));
  const roundConfig = (n) => CONFIG.rounds[n - 1];

  /* ------------------------------ audit log ------------------------------ */

  function log(b, action, details = {}) {
    b.auditLog.push({
      ts: Date.now(),
      action,
      old: details.old === undefined ? null : details.old,
      new: details.new === undefined ? null : details.new,
      reason: details.reason || "",
      type: details.type || "event", // event | result | manual | undo
    });
    b.updatedAt = Date.now();
  }

  /* ------------------------------ questions ------------------------------ */

  /** One question = several numbers shown together (top-left, top-right, bottom-left, bottom-right). */
  function buildQuestion(values, bits) {
    const numbers = values.map((v) => v.toString(2).padStart(bits, "0"));
    return {
      numbers,
      values,
      binary: numbers.join(" "),
      decimal: values.join(", "), // handy text versions for logs and tables
      status: "pending", // pending | correct | wrong | noanswer | skipped
      phase: "ready",
      teamId: null,
      answeredBy: "", // the team that responded first
      submittedAnswer: "",
      result: null,
      scoreChange: 0,
      lifeChange: 0,
      locked: false,
      timedOut: false,
      draft: null,
      resultAt: null,
    };
  }

  /** Random order of every non-zero value of `bits` bits (values in `avoid` go last). */
  function shuffledPool(bits, avoid) {
    const all = [];
    for (let v = 1; v < 1 << bits; v++) all.push(v);
    for (let i = all.length - 1; i > 0; i--) {
      const j = Rand.int(i + 1);
      [all[i], all[j]] = [all[j], all[i]];
    }
    return [
      ...all.filter((v) => !avoid.includes(v)),
      ...all.filter((v) => avoid.includes(v)),
    ];
  }

  /** N questions, each with 4 different numbers. Numbers repeat across questions only when the pool runs out. */
  function makeQuestions(bits, avoid = []) {
    let pool = shuffledPool(bits, avoid);
    const questions = [];
    while (questions.length < CONFIG.questionsPerRound) {
      const values = [];
      while (values.length < CONFIG.numbersPerQuestion) {
        if (!pool.length) pool = shuffledPool(bits, []);
        const v = pool.shift();
        if (!values.includes(v)) values.push(v);
      }
      questions.push(buildQuestion(values, bits));
    }
    return questions;
  }

  /** Questions that can still change: not answered yet and not on screen right now. */
  const isOpen = (q) => !q.locked && (q.phase || "ready") === "ready";

  /** Give every open question of a round brand-new numbers (avoiding the ones used before). Returns how many changed. */
  function refreshRound(b, n, why) {
    const round = b.rounds[n - 1];
    const bits = roundConfig(n).bits;
    const open = round.questions
      .map((q, i) => (isOpen(q) ? i : -1))
      .filter((i) => i >= 0);
    if (!open.length) return 0;
    const old = open.map((i) => round.questions[i].binary).join(", ");
    const fresh = makeQuestions(
      bits,
      round.questions.flatMap((q) => q.values || []),
    );
    open.forEach((i) => {
      round.questions[i] = fresh[i];
    });
    log(b, `Numbers randomized — Round ${n}`, {
      old,
      new: open.map((i) => round.questions[i].binary).join(", "),
      type: why === "manual" ? "manual" : undefined,
    });
    return open.length;
  }

  /** Data saved by an earlier build had one number per question: unanswered ones get 4 new numbers, answered ones are wrapped. */
  function fixQuestions(batch) {
    batch.rounds.forEach((round) => {
      round.questions.forEach((q, i) => {
        if (q.numbers) return;
        if (!q.locked && (q.phase || "ready") === "ready") {
          const bits = CONFIG.rounds[round.n - 1].bits;
          round.questions[i] = makeQuestions(bits, [])[i];
        } else {
          q.numbers = [q.binary];
          q.values = [q.decimal];
          q.decimal = String(q.decimal);
        }
      });
    });
  }

  /* ------------------------------ batch & teams -------------------------- */

  function newBatch(id, name) {
    const now = Date.now();
    const batch = {
      id,
      name,
      status: "READY", // READY | RUNNING | PAUSED | COMPLETED
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
      teams: [],
      quiz: { url: "", code: "" }, // where participants join on their phones
      currentRound: 1,
      currentQuestion: 0,
      timer: Timer.idle(),
      rounds: CONFIG.rounds.map((r) => ({
        n: r.n,
        status: "notstarted",
        questions: makeQuestions(r.bits),
      })),
      undoStack: [],
      auditLog: [],
    };
    log(batch, "Batch created", { new: name });
    log(batch, "Questions generated for Rounds 1–5 (saved)");
    return batch;
  }

  const findTeam = (b, id) => b.teams.find((t) => t.id === id) || null;

  function addTeam(b, id, name) {
    const team = {
      id,
      name,
      score: 0,
      lives: CONFIG.startingLives,
      createdAt: Date.now(),
    };
    b.teams.push(team);
    log(b, b.status === "READY" ? "Team added" : "Team added during the game", {
      new: name,
    });
    return team;
  }

  /** A team can leave only while it has no recorded result and no manual change. */
  function canRemoveTeam(b, team) {
    const untouched = team.score === 0 && team.lives === CONFIG.startingLives;
    const hasResult = b.rounds.some((r) =>
      r.questions.some((q) => q.teamId === team.id),
    );
    return untouched && !hasResult;
  }

  function removeTeam(b, team) {
    b.teams = b.teams.filter((t) => t.id !== team.id);
    log(b, "Team removed", { old: team.name });
  }

  const currentRound = (b) => b.rounds[b.currentRound - 1];
  const currentQuestion = (b) => currentRound(b).questions[b.currentQuestion];
  const questionTag = (b) => `Q${b.currentQuestion + 1}`;
  const allRoundsDone = (b) =>
    b.rounds.every((r) => r.status === "completed" || r.status === "skipped");

  /** correct / wrong / no-answer counts and the points they moved. */
  function roundCounts(round) {
    const count = (status) =>
      round.questions.filter((q) => q.status === status).length;
    return {
      correct: count("correct"),
      wrong: count("wrong"),
      noanswer: count("noanswer"),
      skipped: count("skipped"),
      points: round.questions.reduce((sum, q) => sum + q.scoreChange, 0),
    };
  }

  function progress(b) {
    let questionsDone = 0,
      roundsDone = 0;
    b.rounds.forEach((round) => {
      questionsDone += round.questions.filter(
        (q) => q.status !== "pending",
      ).length;
      if (round.status === "completed") roundsDone++;
    });
    return {
      questionsDone,
      questionsTotal: b.rounds.length * CONFIG.questionsPerRound,
      roundsDone,
      roundsTotal: b.rounds.length,
    };
  }

  function completeBatch(b, reason) {
    if (b.status === "COMPLETED") return;
    b.status = "COMPLETED";
    b.finishedAt = Date.now();
    log(b, reason);
  }

  /* ------------------------ showing a question --------------------------- */

  function showQuestion(b) {
    const q = currentQuestion(b);
    const round = currentRound(b);
    const config = roundConfig(b.currentRound);
    if (q.locked || b.status === "PAUSED") return false;

    if (b.status === "READY")
      log(b, "Game started", {
        new: `${b.teams.length} team(s) playing together`,
      });
    if (round.status === "notstarted") {
      round.status = "inprogress";
      log(b, `Round ${round.n} started`);
    }
    const again = q.phase === "ended";
    q.phase = "live";
    q.timedOut = false;
    Timer.start(b, config.seconds * 1000);
    if (b.status === "READY") b.status = "RUNNING";
    log(b, `${questionTag(b)} displayed: ${q.binary}`, {
      new: `${config.seconds}s timer started${again ? " (shown again)" : ""}`,
    });
    return true;
  }

  /** Hide the number. `why` is 'manual' or 'timeup'. */
  function endDisplay(b, why) {
    const q = currentQuestion(b);
    if (q.phase !== "live") return false;
    const secondsLeft = (Timer.remaining(b) / 1000).toFixed(1);
    q.phase = "ended";
    if (why === "timeup") {
      q.timedOut = true;
      Timer.expire(b);
      log(b, `${questionTag(b)} time up — hidden automatically`);
    } else {
      Timer.stop(b);
      log(b, `${questionTag(b)} hidden`, { old: `${secondsLeft}s left` });
    }
    return true;
  }

  /** Called by the UI ticker. Returns true if the state changed. */
  function tickCheck(b) {
    const q = currentQuestion(b);
    const expired =
      q.phase === "live" &&
      b.timer.state === "running" &&
      Timer.remaining(b) <= 0;
    return expired ? endDisplay(b, "timeup") : false;
  }

  function timerPause(b) {
    if (currentQuestion(b).phase !== "live" || b.timer.state !== "running")
      return false;
    Timer.freeze(b);
    log(b, `${questionTag(b)} timer paused`, {
      old: `${(b.timer.remainingMs / 1000).toFixed(1)}s left`,
    });
    return true;
  }

  function timerResume(b) {
    const blocked =
      currentQuestion(b).phase !== "live" ||
      b.timer.state !== "paused" ||
      b.status === "PAUSED";
    if (blocked) return false;
    Timer.thaw(b);
    log(b, `${questionTag(b)} timer resumed`);
    return true;
  }

  /** Show the same number again with a fresh countdown. */
  function timerRestart(b) {
    const q = currentQuestion(b);
    const config = roundConfig(b.currentRound);
    if (
      q.locked ||
      !["live", "ended"].includes(q.phase) ||
      b.status === "PAUSED"
    )
      return false;
    q.phase = "live";
    q.teamId = null;
    q.timedOut = false;
    Timer.start(b, config.seconds * 1000);
    log(b, `${questionTag(b)} timer restarted`, {
      new: `${config.seconds}s, binary ${q.binary} shown`,
    });
    return true;
  }

  /** Operator taps the team that responded first. Tapping another team changes it. */
  function setAnsweringTeam(b, teamId) {
    const q = currentQuestion(b);
    const team = findTeam(b, teamId);
    if (!team) return { ok: false, msg: "Team not found." };
    if (q.locked || !["ended", "responded"].includes(q.phase))
      return { ok: false, msg: "Hide the question first." };
    if (q.teamId === teamId) return { ok: true };

    const previous = findTeam(b, q.teamId);
    q.teamId = teamId;
    q.phase = "responded";
    if (previous)
      log(b, `${questionTag(b)} responding team changed`, {
        old: previous.name,
        new: team.name,
        type: "manual",
      });
    else log(b, `${questionTag(b)} FIRST RESPONSE LOCKED: ${team.name}`);
    return { ok: true };
  }

  /** Leaving a question while it is live: un-show it and stop the timer. */
  function abortLive(b) {
    const q = currentQuestion(b);
    if (q.phase === "live") {
      q.phase = "ready";
      log(b, `${questionTag(b)} hidden (operator navigated away)`);
    }
    Timer.stop(b);
  }

  /* ------------------------------- results ------------------------------- */

  function scoreFor(team, result, points) {
    if (result === "correct") return { score: points, life: 0 };
    if (result === "wrong")
      return team.lives > 0 ? { score: 0, life: -1 } : { score: -1, life: 0 };
    return { score: 0, life: 0 };
  }

  function describeChange(change) {
    if (change.score > 0) return `(${signed(change.score)} score)`;
    if (change.score < 0) return "(no lives left: score -1)";
    if (change.life < 0) return "(life -1, score unchanged)";
    return "(no change)";
  }

  /** Leave this question out (e.g. the event is running late). Nobody scores. */
  function skipQuestion(b) {
    const q = currentQuestion(b);
    if (q.locked)
      return { ok: false, msg: "This question is already finished." };
    abortLive(b);
    Object.assign(q, {
      status: "skipped",
      result: RESULT_LABEL.skipped,
      teamId: null,
      answeredBy: "",
      locked: true,
      phase: "resulted",
      resultAt: Date.now(),
    });
    b.undoStack.push({
      round: b.currentRound,
      q: b.currentQuestion,
      teamId: null,
      at: Date.now(),
    });
    log(b, `${questionTag(b)} skipped`, { type: "manual" });
    return { ok: true };
  }

  /** Mark the current question. Correct / wrong need the responding team. */
  function applyResult(b, result, answer) {
    const q = currentQuestion(b);
    if (q.locked) return { ok: false, msg: "This question is already locked." };
    if (!["ended", "responded"].includes(q.phase))
      return { ok: false, msg: "Hide the question first." };

    const team = result === "noanswer" ? null : findTeam(b, q.teamId);
    if (result !== "noanswer" && !team)
      return { ok: false, msg: "Tap the team that responded first." };

    const before = team ? { score: team.score, lives: team.lives } : null;
    const change = team
      ? scoreFor(team, result, roundConfig(b.currentRound).points)
      : { score: 0, life: 0 };
    if (team) {
      team.score += change.score;
      team.lives += change.life;
    }

    Object.assign(q, {
      status: result,
      result: RESULT_LABEL[result],
      teamId: team ? team.id : null,
      answeredBy: team ? team.name : "",
      submittedAnswer: team ? answer : "",
      scoreChange: change.score,
      lifeChange: change.life,
      locked: true,
      phase: "resulted",
      resultAt: Date.now(),
      draft: null,
    });
    b.undoStack.push({
      round: b.currentRound,
      q: b.currentQuestion,
      teamId: q.teamId,
      at: Date.now(),
    });

    const who = team ? `${team.name}: ` : "";
    if (team && answer)
      log(b, `${questionTag(b)} ${team.name} answered: ${answer}`);
    log(
      b,
      `${questionTag(b)} ${who}marked ${RESULT_LABEL[result]} ${describeChange(change)}`,
      {
        old: team ? `score ${before.score}, lives ${before.lives}` : null,
        new: team ? `score ${team.score}, lives ${team.lives}` : null,
        type: "result",
      },
    );
    return { ok: true };
  }

  function undoLast(b) {
    const entry = b.undoStack.pop();
    if (!entry) return { ok: false, msg: "Nothing to undo." };
    const round = b.rounds[entry.round - 1];
    const q = round.questions[entry.q];
    const team = findTeam(b, entry.teamId);
    const was = `${q.result}${team ? ` for ${team.name}` : ""} (score ${signed(q.scoreChange)}, lives ${signed(q.lifeChange)})`;
    const before = team ? `score ${team.score}, lives ${team.lives}` : null;

    // Take back exactly what this result did (manual edits made since are kept).
    if (team) {
      team.score -= q.scoreChange;
      team.lives -= q.lifeChange;
    }
    Object.assign(q, {
      status: "pending",
      result: null,
      scoreChange: 0,
      lifeChange: 0,
      locked: false,
      phase: team ? "responded" : "ended",
      resultAt: null,
      draft: null,
    });
    if (round.status === "completed") round.status = "inprogress";
    if (b.status === "COMPLETED") {
      b.status = "RUNNING";
      b.finishedAt = null;
    }
    Timer.stop(b);
    b.currentRound = entry.round;
    b.currentQuestion = entry.q;

    log(
      b,
      `UNDO: R${entry.round} Q${entry.q + 1} result reverted (was ${was})`,
      {
        old: before,
        new: team ? `score ${team.score}, lives ${team.lives}` : null,
        type: "undo",
      },
    );
    return { ok: true };
  }

  /* ----------------------------- navigation ------------------------------ */

  function openRound(b, n) {
    abortLive(b);
    const round = b.rounds[n - 1];
    b.currentRound = n;
    const firstPending = round.questions.findIndex(
      (q) => q.status === "pending",
    );
    b.currentQuestion = firstPending === -1 ? 0 : firstPending;

    if (round.status === "notstarted") {
      refreshRound(b, n);
      round.status = "inprogress";
      log(b, `Round ${n} started`);
    } else if (round.status === "skipped") {
      round.status = "inprogress";
      log(b, `Round ${n} reopened (was skipped)`);
    }

    if (
      round.status !== "completed" &&
      b.status !== "PAUSED" &&
      b.status !== "READY"
    ) {
      if (b.status === "COMPLETED") b.finishedAt = null;
      b.status = "RUNNING";
    }
  }

  /** The round to play next, or null when every round is finished. */
  const nextRound = (b) =>
    b.rounds.find(
      (r) => r.status === "inprogress" || r.status === "notstarted",
    ) || null;

  /** Move to the next pending question; completes the round when none remain. */
  function nextQuestion(b) {
    abortLive(b);
    const round = currentRound(b);
    const count = round.questions.length;
    for (let step = 1; step <= count; step++) {
      const index = (b.currentQuestion + step) % count;
      if (round.questions[index].status === "pending") {
        b.currentQuestion = index;
        return { roundDone: false };
      }
    }
    if (round.status !== "completed") {
      round.status = "completed";
      const counts = roundCounts(round);
      log(b, `Round ${round.n} completed`, {
        new: `${counts.correct} correct, ${counts.wrong} wrong, ${counts.noanswer} no answer`,
      });
    }
    const allDone = allRoundsDone(b);
    if (allDone) completeBatch(b, "All rounds finished — game COMPLETED");
    return { roundDone: true, allDone };
  }

  /* ----------------------------- corrections ----------------------------- */

  function skipRound(b, n, reason) {
    const round = b.rounds[n - 1];
    if (b.currentRound === n) abortLive(b);
    const old = round.status;
    round.status = "skipped";
    log(b, `Round ${n} skipped`, {
      old,
      new: "skipped",
      reason,
      type: "manual",
    });
    if (allRoundsDone(b))
      completeBatch(b, "All rounds finished — game COMPLETED");
  }

  function randomizeRound(b, n) {
    const changed = refreshRound(b, n, "manual");
    if (!changed)
      return {
        ok: false,
        msg: "Nothing to randomize — every question here is on screen or already answered.",
      };
    if (b.currentRound === n && !isOpen(currentQuestion(b))) {
      const firstOpen = b.rounds[n - 1].questions.findIndex(isOpen);
      if (firstOpen !== -1) b.currentQuestion = firstOpen;
    }
    return { ok: true, changed };
  }

  /** Called when the operator presses Start: round 1 gets fresh numbers every time. */
  function prepareStart(b) {
    if (b.status === "READY" && b.rounds[0].status === "notstarted")
      refreshRound(b, 1);
  }

  function adjustScore(b, teamId, value, reason) {
    const team = findTeam(b, teamId);
    const old = team.score;
    team.score = value;
    log(b, `Score manually adjusted — ${team.name}`, {
      old,
      new: value,
      reason: reason || "no reason given",
      type: "manual",
    });
  }

  function adjustLives(b, teamId, value, reason) {
    const team = findTeam(b, teamId);
    const old = team.lives;
    team.lives = Math.max(0, Math.min(CONFIG.maxLives, value));
    log(b, `Lives manually adjusted — ${team.name}`, {
      old,
      new: team.lives,
      reason: reason || "no reason given",
      type: "manual",
    });
  }

  /* ------------------------- pause / finish ------------------------------ */

  function pauseGame(b) {
    if (b.status !== "RUNNING") return false;
    b.pausedFrom = b.status;
    b.timer.byGame = false;
    const froze = Timer.freeze(b);
    b.timer.byGame = froze; // remember whether the game pause froze the timer
    b.status = "PAUSED";
    log(b, "Game PAUSED (technical / internal issue)");
    return true;
  }

  function resumeGame(b) {
    if (b.status !== "PAUSED") return false;
    b.status = b.pausedFrom || "RUNNING";
    if (b.timer.byGame) Timer.thaw(b);
    b.timer.byGame = false;
    log(b, "Game RESUMED");
    return true;
  }

  function finishBatch(b) {
    abortLive(b);
    completeBatch(b, "Game finished by operator");
    log(b, "Final result", {
      new: ranking(b.teams)
        .map((t) => `${t.name} ${t.score}`)
        .join(" | "),
    });
  }

  /* ----------------------------- leaderboard ----------------------------- */

  /** Score ↓, then lives ↓, then whoever was added first. Ties are broken, not shared. */
  function ranking(teams) {
    return teams
      .slice()
      .sort(
        (a, c) =>
          c.score - a.score || c.lives - a.lives || a.createdAt - c.createdAt,
      );
  }

  const reward = (index) => CONFIG.rewards[index] || 0;

  return {
    RESULT_LABEL,
    signed,
    roundConfig,
    log,
    makeQuestions,
    fixQuestions,
    newBatch,
    findTeam,
    addTeam,
    canRemoveTeam,
    removeTeam,
    currentRound,
    currentQuestion,
    progress,
    roundCounts,
    nextRound,
    showQuestion,
    endDisplay,
    tickCheck,
    timerPause,
    timerResume,
    timerRestart,
    setAnsweringTeam,
    abortLive,
    applyResult,
    skipQuestion,
    undoLast,
    scoreFor,
    describeChange,
    openRound,
    nextQuestion,
    skipRound,
    randomizeRound,
    prepareStart,
    isOpen,
    adjustScore,
    adjustLives,
    pauseGame,
    resumeGame,
    finishBatch,
    ranking,
    reward,
  };
})();
