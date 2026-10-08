/* ==========================================================================
   timer.js — the countdown stored on a session (survives page refresh).

   A running timer keeps an absolute `endsAt` timestamp, so after a reload it
   simply continues (or has already run out). Frozen timers keep `remainingMs`.
   States: idle · running · paused · done
   ========================================================================== */
const Timer = (() => {
  const idle = () => ({ state: 'idle', remainingMs: 0, endsAt: 0, byGame: false });

  function remaining(session) {
    const t = session.timer;
    return t.state === 'running' ? Math.max(0, t.endsAt - Date.now()) : t.remainingMs;
  }

  function start(session, ms) {
    session.timer = { state: 'running', remainingMs: ms, endsAt: Date.now() + ms, byGame: false };
  }

  const stop = session => { session.timer = idle(); };
  const expire = session => { session.timer = { ...idle(), state: 'done' }; };

  /** Freeze a running timer. Returns true if it was running. */
  function freeze(session) {
    if (session.timer.state !== 'running') return false;
    session.timer.remainingMs = remaining(session);
    session.timer.state = 'paused';
    return true;
  }

  function thaw(session) {
    if (session.timer.state !== 'paused') return;
    session.timer.endsAt = Date.now() + session.timer.remainingMs;
    session.timer.state = 'running';
  }

  return { idle, remaining, start, stop, expire, freeze, thaw };
})();
