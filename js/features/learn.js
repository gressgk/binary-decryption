/* ==========================================================================
   learn.js — a short, step-by-step lesson (in simple Indonesian) on reading
   binary numbers, then the rules. Never touches game data.
   ========================================================================== */
(() => {
  const LAST = 5; // steps 0..5
  const POSES = [
    "idea",
    "thinking",
    "wink-thumbs-up",
    "pointing",
    "happy",
    "proud",
  ];

  let step = 0;
  let bits = [1, 0, 1, 0]; // the example the student can play with

  const weight = (i, n) => 1 << (n - 1 - i);
  const total = (list) =>
    list.reduce((sum, b, i) => sum + (b ? weight(i, list.length) : 0), 0);

  /* --------------------------- the bit boxes ------------------------------ */

  /** One column: price on top (optional), the 0/1 box, what it adds (optional). */
  function column(b, i, n, show) {
    const label = `Kotak ${i + 1}: ${b}`;
    const box = show.click
      ? `<button class="lb-tile b${b}" data-action="learn-toggle" data-idx="${i}" aria-label="${label}">${b}</button>`
      : `<div class="lb-tile b${b}">${b}</div>`;
    return `
      <div class="lb-col">
        ${show.price ? `<div class="lb-price">${weight(i, n)}</div>` : ""}
        ${box}
        ${show.gain ? `<div class="lb-gain ${b ? "on" : ""}">${b ? `+${weight(i, n)}` : "0"}</div>` : ""}
      </div>`;
  }

  const row = (show) =>
    `<div class="lb-row">${bits.map((b, i) => column(b, i, bits.length, show)).join("")}</div>`;

  const sizeSwitch = () => `
    <div class="size-switch" role="group" aria-label="Jumlah kotak">
      ${[4, 5].map((n) => `<button class="btn btn-sm ${bits.length === n ? "btn-dark" : ""}" data-action="learn-size" data-n="${n}">${n} kotak</button>`).join("")}
    </div>`;

  function sumLine() {
    const parts = bits
      .map((b, i) => (b ? weight(i, bits.length) : null))
      .filter((v) => v !== null);
    return `<div class="sum-line">${parts.length ? parts.join(" <i>+</i> ") : "0"} <i>=</i> <b>${total(bits)}</b></div>`;
  }

  /* ------------------------------- steps ---------------------------------- */

  const STEPS = [
    () => ({
      title: "Biner itu apa?",
      lead: "Komputer cuma kenal <b>2 angka</b>: <b>0</b> dan <b>1</b>. Deretan 0 dan 1 itulah yang disebut <b>angka biner</b>.",
      body: `${row({})}<p class="lb-note">Satu kotak = satu angka (0 atau 1)</p>`,
      tip: "Nanti di layar kamu akan lihat deretan kotak seperti ini. Tugasmu: <b>ubah jadi angka biasa</b>.",
    }),
    () => ({
      title: "Setiap kotak punya “harga”",
      lead: "Mulai dari <b>kanan</b>, harga kotak pertama adalah <b>1</b>. Setiap geser ke kiri, harganya <b>dikali 2</b>.",
      body: `${sizeSwitch()}${row({ price: true })}<p class="lb-note">← makin ke kiri, harga makin besar (× 2)</p>`,
      tip:
        bits.length === 4
          ? "Harganya selalu <b>8 · 4 · 2 · 1</b>. Hafalkan urutan ini!"
          : "Harganya selalu <b>16 · 8 · 4 · 2 · 1</b>. Hafalkan urutan ini!",
    }),
    () => ({
      title: "Cara menghitungnya",
      lead: "Cuma 3 langkah: <b>① cari kotak yang isinya 1</b> → <b>② lihat harganya</b> → <b>③ jumlahkan</b>. Kotak 0 diabaikan.",
      body: `${row({ price: true, click: true, gain: true })}${sumLine()}`,
      tip: "👆 Ketuk kotak untuk ganti 0 ↔ 1, lalu lihat jumlahnya berubah.",
    }),
    () => ({
      title: "Cara mainnya",
      lead: "Semua tim lihat soal yang sama, di waktu yang sama.",
      body: `
        <div class="play-split">
          <div class="how-list">
            <div class="how-row"><span class="flow-no">1</span><div><b>CATAT</b><p>Angka biner muncul di layar. Catat di <b>kertas yang dibagikan</b>, sekalian dihitung.</p></div></div>
            <div class="how-row"><span class="flow-no">2</span><div><b>PENCET</b><p>Angka hilang? <b>Cepat-cepatan pencet quiz button!</b></p></div></div>
            <div class="how-row"><span class="flow-no">3</span><div><b>DIKTE</b><p>Tim tercepat menjawab dengan <b>didikte</b>, urut seperti gambar →</p></div></div>
          </div>
          <div class="dictate">
            <div class="dictate-title">Urutan dikte jawaban (4 angka)</div>
            <div class="dictate-grid">
              <div class="dg"><b>1</b><span>kiri atas</span></div>
              <div class="dg"><b>2</b><span>kanan atas</span></div>
              <div class="dg"><b>3</b><span>kiri bawah</span></div>
              <div class="dg"><b>4</b><span>kanan bawah</span></div>
            </div>
          </div>
        </div>`,
      tip: "",
    }),
    () => ({
      title: "Waktu &amp; poin tiap ronde",
      lead: "Makin tinggi ronde, makin banyak kotaknya, makin besar poinnya.",
      body: `
        <table class="round-table">
          <thead><tr><th></th>${CONFIG.rounds.map((r) => `<th>Ronde ${r.n}</th>`).join("")}</tr></thead>
          <tbody>
            <tr><th>Kotak</th>${CONFIG.rounds.map((r) => `<td>${r.bits}</td>`).join("")}</tr>
            <tr><th>Waktu lihat</th>${CONFIG.rounds.map((r) => `<td>${r.seconds} dtk</td>`).join("")}</tr>
            <tr><th>Poin benar</th>${CONFIG.rounds.map((r) => `<td><b>+${r.points}</b></td>`).join("")}</tr>
          </tbody>
        </table>`,
      tip: "Angkanya sengaja dibuat bergerak di ronde-ronde akhir. Tetap fokus!",
    }),
    () => ({
      title: "Poin &amp; nyawa",
      lead: `Setiap tim punya <span class="life-chip">${Ui.hearts(CONFIG.startingLives)} ${CONFIG.startingLives} nyawa</span>`,
      body: `
        <div class="outcomes">
          <div class="oc oc-good"><b>BENAR</b><p>Dapat poin sesuai ronde.</p></div>
          <div class="oc oc-bad"><b>SALAH</b><p>Nyawa berkurang 1. Poin tetap.</p></div>
          <div class="oc oc-zero"><b>SALAH, NYAWA HABIS</b><p>Poin berkurang 1.</p></div>
          <div class="oc oc-none"><b>TIDAK JAWAB</b><p>Tidak ada yang berubah.</p></div>
        </div>`,
      tip: "🔒 Soal yang dijawab <b>salah</b> langsung dikunci — tim lain tidak bisa menjawabnya lagi.",
    }),
  ];

  /* ------------------------------- view ----------------------------------- */

  Views.learn = () => {
    const s = STEPS[step]();
    const dots = STEPS.map(
      (_, i) =>
        `<button class="ldot ${i === step ? "cur" : i < step ? "done" : ""}" data-action="learn-go" data-n="${i}" aria-label="Langkah ${i + 1}"></button>`,
    ).join("");
    return `
      <section class="lobby lobby-learn">
        <div class="learn-card paper">
          <span class="ribbon">LANGKAH ${step + 1} / ${STEPS.length}</span>
          <span class="tape"></span>
          <h1 class="learn-title">${s.title}</h1>
          <p class="learn-lead">${s.lead}</p>
          <div class="learn-body">${s.body}</div>
          <p class="learn-tip ${s.tip ? "" : "empty"}">${s.tip}</p>
          <div class="learn-nav">
            <button class="btn btn-lg" data-action="learn-prev" ${step === 0 ? "disabled" : ""}>← Sebelumnya</button>
            <div class="ldots">${dots}</div>
            ${
              step === LAST
                ? '<button class="btn btn-lime btn-lg" data-action="back">Selesai ✔</button>'
                : '<button class="btn btn-lime btn-lg" data-action="learn-next">Lanjut →</button>'
            }
          </div>
          ${Ui.mascot(POSES[step], "learn-mascot")}
        </div>
      </section>`;
  };

  /* ------------------------------ actions --------------------------------- */

  const goStep = (n) => {
    step = Math.max(0, Math.min(LAST, n));
    App.render();
  };

  Object.assign(Actions, {
    "learn-next": () => goStep(step + 1),
    "learn-prev": () => goStep(step - 1),
    "learn-go": ({ n }) => goStep(+n),

    "learn-toggle": ({ idx }) => {
      bits[+idx] = bits[+idx] ? 0 : 1;
      App.render();
    },

    "learn-size": ({ n }) => {
      bits = +n === 5 ? [1, 0, 1, 0, 1] : [1, 0, 1, 0];
      App.render();
    },
  });
})();
