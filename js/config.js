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
      seconds: 20,
      points: 10,
      effect: "rainbow-jolt",
      effectLabel: "Blink background + jedag-jedug text",
    },
    {
      n: 5,
      bits: 5,
      seconds: 20,
      points: 10,
      effect: "rainbow-jolt-spin",
      effectLabel: "Blink + rainbow + jedag-jedug + rotate",
    },
  ],

  // Extra capital by rank (index 0 = rank 1). The amounts depend on how many teams played.
  rewards: [350000, 300000, 200000, 100000], // 4 teams or more
  rewardsSmall: {
    2: [200000, 100000], // 2 teams (or fewer)
    3: [300000, 200000, 100000], // 3 teams
  },
  // With only 2 or 3 teams, anyone who ends below 0 points gets this flat amount instead.
  flatReward: 100000,
};
