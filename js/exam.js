/* ============================================================
   exam.js — logika sisi siswa (index.html)

   Catatan penting soal batas kemampuan (baca juga README.md):
   - Alt+Tab / Cmd+Tab / pindah aplikasi: ini pintasan level SISTEM
     OPERASI, terjadi sebelum browser sempat melihatnya sama sekali.
     TIDAK ADA halaman web yang bisa mencegah atau menangkapnya
     secara langsung. Yang BISA dilakukan adalah mendeteksi AKIBATNYA
     (jendela kehilangan fokus / tab tidak lagi terlihat) begitu
     siswa kembali, lalu bereaksi tegas — itulah yang dilakukan di
     bawah lewat event 'blur' dan 'visibilitychange'.
   - Fullscreen: tombol Esc SELALU bisa keluar dari layar penuh,
     dikontrol browser, tidak bisa diblokir JavaScript apa pun. Yang
     bisa dilakukan hanyalah mendeteksi keluarnya.
   - Copy/paste/klik kanan: bisa dicegah untuk penggunaan biasa,
     tapi siswa yang membuka DevTools tetap bisa menyalin teks.
   - Screenshot: TIDAK ADA cara bagi halaman web untuk mencegah
     screenshot OS/HP/kamera eksternal.
   - Percobaan ganda & kunci akses: siswa diidentifikasi lewat
     nama+kelas yang ia ketik (bukan login sungguhan) — lihat
     catatan di Code.gs.
   ============================================================ */
(function () {
  "use strict";

  const CFG = window.EXAM_CONFIG;
  const QUESTIONS = window.EXAM_QUESTIONS;
  const STORAGE_KEY = "examSiswa.session.v3";
  const MAX_LEAVES_BEFORE_KICK = 2;
  const LEAVE_DEBOUNCE_MS = 400; // hanya untuk menyatukan blur+hidden yang terpicu BERSAMAAN pada satu alt-tab, bukan untuk menahan kejadian kedua yang sungguh terpisah

  // ---------- state ----------
  let state = {
    code: "",
    studentId: "",
    name: "",
    className: "",
    examTitle: CFG.examTitle,
    durationMinutes: 20,
    attemptNumber: 1,
    maxAttempts: 2,
    answers: new Array(QUESTIONS.length).fill(null),
    violations: { leftExam: 0, copyAttempt: 0, devtoolsSuspect: 0, printScreen: 0 },
    currentQ: 0,
    examStartedAt: null,
    submitted: false
  };

  let heartbeatTimer = null;
  let tickTimer = null;
  let toastTimer = null;
  let lastLeaveAt = 0;

  // ---------- DOM ----------
  const screens = {
    login: document.getElementById("screen-login"),
    rules: document.getElementById("screen-rules"),
    exam: document.getElementById("screen-exam"),
    result: document.getElementById("screen-result"),
    kicked: document.getElementById("screen-kicked")
  };

  function showScreen(name) {
    Object.keys(screens).forEach((k) => {
      screens[k].hidden = k !== name;
    });
  }

  // ---------- backend ----------
  function callBackend(payload) {
    if (!CFG.backendUrl || CFG.backendUrl.indexOf("PASTE_YOUR") === 0) {
      return Promise.reject(new Error("Backend belum dikonfigurasi (lihat js/config.js)."));
    }
    return fetch(CFG.backendUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    }).then((r) => r.json());
  }

  // ---------- persistence (bertahan dari refresh tidak sengaja) ----------
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* storage penuh/dinonaktifkan — abaikan */ }
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearPersisted() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  }

  // ================= JOIN (dipakai oleh form login, tombol "Coba Lagi", dan layar dikeluarkan) =================
  function doJoin(name, className, code, onSuccess, onError, btn, busyText, idleText) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = busyText;
    }
    callBackend({ mode: "student_join", code: code, name: name, className: className })
      .then((res) => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = idleText;
        }
        if (!res || !res.ok) {
          onError(res && res.error ? res.error : "Kode sesi tidak valid atau sesi belum dimulai guru.");
          return;
        }
        state.code = code;
        state.studentId = res.studentId;
        state.name = name;
        state.className = className;
        state.examTitle = res.examTitle || CFG.examTitle;
        state.durationMinutes = res.durationMinutes || 20;
        state.attemptNumber = res.attemptNumber || 1;
        state.maxAttempts = res.maxAttempts || 2;
        state.answers = new Array(QUESTIONS.length).fill(null);
        state.violations = { leftExam: 0, copyAttempt: 0, devtoolsSuspect: 0, printScreen: 0 };
        state.currentQ = 0;
        state.examStartedAt = null;
        state.submitted = false;
        persist();
        onSuccess();
      })
      .catch((err) => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = idleText;
        }
        onError("Tidak bisa menghubungi server: " + err.message);
      });
  }

  // ================= LOGIN =================
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginBtn = document.getElementById("login-submit");

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.hidden = true;
    const name = document.getElementById("in-name").value.trim();
    const className = document.getElementById("in-class").value.trim();
    const code = document.getElementById("in-code").value.trim().toUpperCase();

    if (!name || !className || !code) {
      loginError.textContent = "Semua kolom wajib diisi.";
      loginError.hidden = false;
      return;
    }

    doJoin(
      name, className, code,
      function () { showRulesScreen(); },
      function (msg) { loginError.textContent = msg; loginError.hidden = false; },
      loginBtn, "Memeriksa kode...", "Masuk"
    );
  });

  function showRulesScreen() {
    document.getElementById("rules-attempt-info").textContent =
      "Ini percobaan ke-" + state.attemptNumber + " dari " + state.maxAttempts + ". " +
      (state.maxAttempts > 1 ? "Nilai TERTINGGI di antara semua percobaanmu yang akan dikirim ke guru." : "");
    showScreen("rules");
  }

  // ================= RULES / START =================
  document.getElementById("start-exam-btn").addEventListener("click", function () {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      req.call(el).catch(function () { /* beberapa browser menolak tanpa gesture langsung — tetap lanjut */ });
    }
    beginExam();
  });

  function beginExam() {
    state.examStartedAt = state.examStartedAt || Date.now();
    persist();
    showScreen("exam");
    document.getElementById("who-name").textContent = state.name + " (" + state.className + ")";
    document.getElementById("exam-title-tag").textContent = state.examTitle;
    document.getElementById("attempt-badge").textContent = "Percobaan " + state.attemptNumber + "/" + state.maxAttempts;
    renderProgress();
    renderQuestion(state.currentQ);
    startTimer();
    startHeartbeat();
    attachAntiCheat();
  }

  // ================= QUESTION RENDERING =================
  const qCard = document.getElementById("q-card");
  const qProgress = document.getElementById("q-progress");

  function renderProgress() {
    qProgress.innerHTML = "";
    QUESTIONS.forEach((q, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "q-dot" + (state.answers[i] !== null ? " answered" : "") + (i === state.currentQ ? " current" : "");
      dot.textContent = String(i + 1);
      dot.addEventListener("click", function () {
        state.currentQ = i;
        renderQuestion(i);
        renderProgress();
      });
      qProgress.appendChild(dot);
    });
  }

  function renderQuestion(index) {
    const q = QUESTIONS[index];
    const optionsHtml = q.options
      .map(function (opt, i) {
        const letter = String.fromCharCode(65 + i);
        const selected = state.answers[index] === i;
        return (
          '<label class="option' + (selected ? " selected" : "") + '" data-idx="' + i + '">' +
          '<input type="radio" name="opt" ' + (selected ? "checked" : "") + " />" +
          '<span class="opt-label">' + letter + "</span>" +
          '<span class="opt-text">' + opt + "</span>" +
          "</label>"
        );
      })
      .join("");

    qCard.innerHTML =
      '<div class="q-topic">Soal ' + (index + 1) + " dari " + QUESTIONS.length + " &middot; " + q.topic + "</div>" +
      '<p class="q-text">' + q.text + "</p>" +
      '<div class="options">' + optionsHtml + "</div>" +
      '<div class="q-nav">' +
      '<button type="button" class="btn btn-secondary" id="prev-btn"' + (index === 0 ? " disabled" : "") + ">Sebelumnya</button>" +
      (index === QUESTIONS.length - 1
        ? '<button type="button" class="btn btn-primary" id="submit-btn">Kumpulkan Ujian</button>'
        : '<button type="button" class="btn btn-primary" id="next-btn">Berikutnya</button>') +
      "</div>";

    Array.prototype.forEach.call(qCard.querySelectorAll(".option"), function (optEl) {
      optEl.addEventListener("click", function () {
        const idx = parseInt(optEl.getAttribute("data-idx"), 10);
        state.answers[index] = idx;
        persist();
        renderQuestion(index);
        renderProgress();
      });
    });

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        state.currentQ = Math.max(0, index - 1);
        renderQuestion(state.currentQ);
        renderProgress();
      });
    }
    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        state.currentQ = Math.min(QUESTIONS.length - 1, index + 1);
        renderQuestion(state.currentQ);
        renderProgress();
      });
    }
    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        const unanswered = state.answers.filter(function (a) { return a === null; }).length;
        const proceed = unanswered === 0 || window.confirm(
          "Masih ada " + unanswered + " soal yang belum dijawab. Tetap kumpulkan sekarang?"
        );
        if (proceed) submitExam(false);
      });
    }
  }

  // ================= TIMER =================
  const timerEl = document.getElementById("timer");

  function startTimer() {
    tick();
    tickTimer = setInterval(tick, 1000);
  }

  function tick() {
    const totalMs = state.durationMinutes * 60 * 1000;
    const elapsed = Date.now() - state.examStartedAt;
    const remaining = Math.max(0, totalMs - elapsed);
    const mm = Math.floor(remaining / 60000);
    const ss = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
    timerEl.classList.toggle("timer--low", remaining <= 60000);
    if (remaining <= 0) {
      clearInterval(tickTimer);
      submitExam(true, "Waktu ujian habis.");
    }
  }

  // ================= HEARTBEAT =================
  function startHeartbeat() {
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, CFG.heartbeatIntervalMs);
  }

  function sendHeartbeat() {
    if (state.submitted) return;
    callBackend({
      mode: "student_heartbeat",
      code: state.code,
      studentId: state.studentId,
      status: "in-progress",
      answeredCount: state.answers.filter(function (a) { return a !== null; }).length,
      violations: state.violations
    }).catch(function () { /* koneksi sempat putus — coba lagi di siklus berikutnya */ });
  }

  // ================= ANTI-CHEAT =================
  const toastEl = document.getElementById("violation-toast");
  const leaveOverlay = document.getElementById("fs-overlay");
  const examShell = document.getElementById("screen-exam");

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }

  // ---- "meninggalkan ujian" (alt-tab / pindah tab / keluar fullscreen) : jalur KHUSUS, tegas ----
  function registerLeave(reasonText) {
    if (state.submitted) return;
    const now = Date.now();
    if (now - lastLeaveAt < LEAVE_DEBOUNCE_MS) return; // blur+hidden sering terpicu bersamaan — hitung 1x saja
    lastLeaveAt = now;

    state.violations.leftExam = (state.violations.leftExam || 0) + 1;
    persist();
    const count = state.violations.leftExam;

    if (count >= MAX_LEAVES_BEFORE_KICK) {
      kickStudent(reasonText);
    } else {
      showLeaveWarning(count, reasonText);
    }
  }

  function showLeaveWarning(count, reasonText) {
    document.getElementById("leave-overlay-title").textContent =
      "Peringatan " + count + "/" + MAX_LEAVES_BEFORE_KICK;
    document.getElementById("leave-overlay-body").textContent =
      reasonText + " Sekali lagi dan ujianmu akan DIHENTIKAN — gurumu harus membuka akses lagi sebelum kamu bisa melanjutkan.";
    leaveOverlay.hidden = false;
  }

  document.getElementById("fs-resume-btn").addEventListener("click", function () {
    leaveOverlay.hidden = true;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) req.call(el).catch(function () {});
  });

  // ---- pelanggaran lain (salin/klik-kanan/devtools/print-screen): jalur umum, ambang batas total ----
  function recordMinorViolation(type, message) {
    if (state.submitted) return;
    state.violations[type] = (state.violations[type] || 0) + 1;
    persist();
    toast(message);
    const total = Object.keys(state.violations).reduce(function (sum, k) { return sum + state.violations[k]; }, 0);
    if (total >= CFG.maxViolationsBeforeAutoSubmit) {
      submitExam(true, "Ujian dikumpulkan otomatis karena batas total pelanggaran tercapai.");
    }
  }

  let awayHandled = false;

  function attachAntiCheat() {
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    window.addEventListener("blur", function () {
      if (state.submitted) return;
      examShell.classList.add("is-blurred");
      if (!awayHandled) {
        awayHandled = true;
        registerLeave("Kamu berpindah ke jendela/aplikasi lain (mis. Alt+Tab).");
      }
    });
    window.addEventListener("focus", function () {
      examShell.classList.remove("is-blurred");
      awayHandled = false;
    });

    document.addEventListener("visibilitychange", function () {
      if (state.submitted) return;
      if (document.hidden) {
        if (!awayHandled) {
          awayHandled = true;
          registerLeave("Kamu berpindah tab atau meninggalkan halaman ujian.");
        }
      } else {
        awayHandled = false;
      }
    });

    document.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      recordMinorViolation("copyAttempt", "Klik kanan dinonaktifkan selama ujian.");
    });
    document.addEventListener("copy", function (e) {
      e.preventDefault();
      recordMinorViolation("copyAttempt", "Menyalin teks dinonaktifkan selama ujian.");
    });
    document.addEventListener("cut", function (e) { e.preventDefault(); });
    document.addEventListener("selectstart", function (e) {
      if (!state.submitted) e.preventDefault();
    });

    document.addEventListener("keydown", function (e) {
      const key = (e.key || "").toLowerCase();
      const blockCombo = (e.ctrlKey || e.metaKey) && ["c", "x", "u", "s", "p"].indexOf(key) !== -1;
      const blockDevtools =
        key === "f12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].indexOf(key) !== -1);

      if (blockDevtools) {
        e.preventDefault();
        recordMinorViolation("devtoolsSuspect", "Upaya membuka DevTools terdeteksi dan tercatat.");
        return;
      }
      if (blockCombo) {
        e.preventDefault();
        recordMinorViolation("copyAttempt", "Pintasan keyboard ini dinonaktifkan selama ujian.");
      }
    });

    document.addEventListener("keyup", function (e) {
      if (e.key === "PrintScreen") {
        recordMinorViolation("printScreen", "Tombol Print Screen terdeteksi dan tercatat.");
      }
    });
  }

  function onFullscreenChange() {
    const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!inFs && !state.submitted) {
      registerLeave("Kamu keluar dari mode layar penuh.");
    }
  }

  function detachAntiCheat() {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  }

  // ================= KICK (2x meninggalkan ujian) =================
  function kickStudent(reasonText) {
    if (state.submitted) return;
    state.submitted = true;
    clearInterval(tickTimer);
    clearInterval(heartbeatTimer);
    detachAntiCheat();
    leaveOverlay.hidden = true;

    let score = 0;
    QUESTIONS.forEach(function (q, i) {
      if (state.answers[i] === q.correctIndex) score += 1;
    });

    callBackend({
      mode: "student_submit",
      code: state.code,
      studentId: state.studentId,
      answers: state.answers,
      score: score,
      total: QUESTIONS.length,
      autoSubmitted: true,
      kicked: true,
      violations: state.violations
    }).catch(function () { /* status terkunci tetap berlaku di server walau respons ini gagal diterima */ });

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(function () {});
    }

    clearPersisted();
    document.getElementById("kicked-score").textContent = score + "/" + QUESTIONS.length;
    document.getElementById("kicked-error").hidden = true;
    showScreen("kicked");
  }

  document.getElementById("kicked-retry-btn").addEventListener("click", function () {
    const errEl = document.getElementById("kicked-error");
    errEl.hidden = true;
    doJoin(
      state.name, state.className, state.code,
      function () { showRulesScreen(); },
      function (msg) { errEl.textContent = msg; errEl.hidden = false; },
      this, "Memeriksa akses...", "Coba Masuk Lagi"
    );
  });

  // ================= SUBMIT & SCORE (normal / waktu habis / ambang pelanggaran umum) =================
  function submitExam(auto, autoMessage) {
    if (state.submitted) return;
    state.submitted = true;
    clearInterval(tickTimer);
    clearInterval(heartbeatTimer);
    detachAntiCheat();

    let score = 0;
    const perTopic = {};
    QUESTIONS.forEach(function (q, i) {
      perTopic[q.topic] = perTopic[q.topic] || { correct: 0, total: 0 };
      perTopic[q.topic].total += 1;
      if (state.answers[i] === q.correctIndex) {
        score += 1;
        perTopic[q.topic].correct += 1;
      }
    });

    const totalViolations = Object.keys(state.violations).reduce(function (sum, k) { return sum + state.violations[k]; }, 0);

    callBackend({
      mode: "student_submit",
      code: state.code,
      studentId: state.studentId,
      answers: state.answers,
      score: score,
      total: QUESTIONS.length,
      autoSubmitted: !!auto,
      violations: state.violations
    })
      .then(function (res) {
        const remaining = res && res.ok ? res.remainingAttempts : Math.max(0, state.maxAttempts - state.attemptNumber);
        const bestScore = res && res.ok ? res.bestScore : score;
        const bestTotal = res && res.ok ? res.bestTotal : QUESTIONS.length;
        finishUI(score, QUESTIONS.length, perTopic, totalViolations, auto, autoMessage, remaining, bestScore, bestTotal);
      })
      .catch(function () {
        const remaining = Math.max(0, state.maxAttempts - state.attemptNumber);
        finishUI(score, QUESTIONS.length, perTopic, totalViolations, auto, autoMessage, remaining, score, QUESTIONS.length);
      });

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(function () {});
    }
  }

  function finishUI(score, total, perTopic, totalViolations, auto, autoMessage, remainingAttempts, bestScore, bestTotal) {
    clearPersisted();
    showResult(score, total, perTopic, totalViolations, auto, autoMessage, remainingAttempts, bestScore, bestTotal);
  }

  function showResult(score, total, perTopic, totalViolations, auto, autoMessage, remainingAttempts, bestScore, bestTotal) {
    showScreen("result");
    document.getElementById("result-auto-note").hidden = !auto;
    document.getElementById("result-auto-note").textContent = autoMessage || "";
    document.getElementById("score-ring-text").textContent = score + "/" + total;
    document.getElementById("result-name").textContent = state.name + " (" + state.className + ")";

    const pct = Math.round((score / total) * 100);
    document.getElementById("stat-percent").textContent = pct + "%";
    document.getElementById("stat-violations").textContent = String(totalViolations);

    const topicList = document.getElementById("topic-breakdown");
    topicList.innerHTML = "";
    Object.keys(perTopic).forEach(function (topic) {
      const row = document.createElement("div");
      row.className = "field";
      row.style.marginBottom = "8px";
      const t = perTopic[topic];
      row.innerHTML =
        '<div style="display:flex;justify-content:space-between;font-size:0.88rem;">' +
        "<span>" + topic + "</span><span><strong>" + t.correct + "</strong>/" + t.total + "</span></div>";
      topicList.appendChild(row);
    });

    const attemptNote = document.getElementById("attempt-result-note");
    const retryBtn = document.getElementById("retry-btn");
    const retryError = document.getElementById("retry-error");
    retryError.hidden = true;

    if (state.maxAttempts > 1) {
      attemptNote.hidden = false;
      attemptNote.textContent =
        "Percobaan ke-" + state.attemptNumber + " dari " + state.maxAttempts + " selesai — skor " + score + "/" + total + ". " +
        "Skor TERTINGGImu sejauh ini: " + bestScore + "/" + bestTotal + " (inilah yang dikirim ke guru).";
    } else {
      attemptNote.hidden = true;
    }

    if (remainingAttempts > 0) {
      retryBtn.hidden = false;
      retryBtn.textContent = "Coba Lagi (Percobaan " + (state.attemptNumber + 1) + " dari " + state.maxAttempts + ")";
    } else {
      retryBtn.hidden = true;
    }
  }

  document.getElementById("retry-btn").addEventListener("click", function () {
    const retryError = document.getElementById("retry-error");
    retryError.hidden = true;
    doJoin(
      state.name, state.className, state.code,
      function () { showRulesScreen(); },
      function (msg) { retryError.textContent = msg; retryError.hidden = false; },
      this, "Menyiapkan percobaan berikutnya...", "Coba lagi"
    );
  });

  // ================= RESUME AFTER REFRESH (mid-attempt saja) =================
  (function tryResume() {
    const saved = loadPersisted();
    if (!saved || saved.submitted) return;
    state = Object.assign(state, saved);
    state.answers = saved.answers || new Array(QUESTIONS.length).fill(null);
    document.getElementById("in-name").value = state.name || "";
    document.getElementById("in-class").value = state.className || "";
    document.getElementById("in-code").value = state.code || "";
    if (state.examStartedAt) {
      beginExam();
    }
  })();
})();
