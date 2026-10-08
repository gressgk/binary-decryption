/* ==========================================================================
   config.js — everything you may want to edit without touching the logic.
   ========================================================================== */
const CONFIG = {
  appName: "Binary Decryption",

  // What one group of teams is called in the UI (e.g. 'Batch' or 'Putaran').
  batchLabel: "Batch",

  startingLives: 2,
  maxLives: 9,
  questionsPerRound: 4,
  numbersPerQuestion: 4, // binary numbers shown together in one question

  // Image files. Replace the PNGs in /assets, or point these to other paths.
  // The mascot folder holds one PNG per pose (waving.png, thinking.png, ...).
  assets: {
    logos: "assets/logos.png",
    mascotDir: "assets/mascot/",
  },

  rounds: [
    {
      n: 1,
      bits: 4,
      seconds: 8,
      points: 1,
      effect: "fade",
      effectLabel: "Fade in & out",
    },
    {
      n: 2,
      bits: 4,
      seconds: 8,
      points: 1,
      effect: "blink",
      effectLabel: "Blink + Zoom",
    },
    {
      n: 3,
      bits: 4,
      seconds: 15,
      points: 5,
      effect: "shake",
      effectLabel: "Fade + Tilt",
    },
    {
      n: 4,
      bits: 5,
      seconds: 15,
      points: 5,
      effect: "spin",
      effectLabel: "Spin",
    },
    {
      n: 5,
      bits: 5,
      seconds: 20,
      points: 10,
      effect: "glitch",
      effectLabel: "Tilt + Blue flash",
    },
  ],

  // Final reward by rank (index 0 = rank 1).
  rewards: [350000, 200000],
};
