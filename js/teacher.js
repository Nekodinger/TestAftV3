/* ============================================================
   teacher.js — logika Panel Guru (teacher.html)
   ============================================================ */
(function () {
  "use strict";

  const CFG = window.EXAM_CONFIG;
  const TEACHER_KEY = "examGuru.teacherCode.v1";
  let teacherCode = sessionStorage.getItem(TEACHER_KEY) || "";
  let currentSession = null; // {code, examTitle, durationMinutes, active}
  let pollTimer = null;

  const screens = {
    login: document.getElementById("t-screen-login"),
    panel: document.getElementById("t-screen-panel")
  };
  function showScreen(name) {
    Object.keys(screens).forEach((k) => { screens[k].hidden = k !== name; });
  }

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

  // ============ LOGIN ============
  const loginForm = document.getElementById("t-login-form");
  const loginError = document.getElementById("t-login-error");
  const loginBtn = document.getElementById("t-login-submit");

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.hidden = true;
    const code = document.getElementById("t-in-code").value.trim();
    if (!code) return;

    loginBtn.disabled = true;
    loginBtn.textContent = "Memeriksa...";

    callBackend({ mode: "teacher_login", teacherCode: code })
      .then((res) => {
        loginBtn.disabled = false;
        loginBtn.textContent = "Masuk Panel Guru";
        if (!res || !res.ok) {
          loginError.textContent = res && res.error ? res.error : "Kode kontrol guru salah.";
          loginError.hidden = false;
          return;
        }
        teacherCode = code;
        sessionStorage.setItem(TEACHER_KEY, teacherCode);
        currentSession = res.session || null;
        showScreen("panel");
        renderSessionUI();
        startPolling();
      })
      .catch((err) => {
        loginBtn.disabled = false;
        loginBtn.textContent = "Masuk Panel Guru";
        loginError.textContent = "Tidak bisa menghubungi server: " + err.message;
        loginError.hidden = false;
      });
  });

  document.getElementById("t-logout-btn").addEventListener("click", function () {
    sessionStorage.removeItem(TEACHER_KEY);
    teacherCode = "";
    clearInterval(pollTimer);
    showScreen("login");
  });

  // ============ SESSION CONTROL ============
  const startForm = document.getElementById("start-session-form");
  const noSessionPanel = document.getElementById("panel-no-session");
  const activeSessionPanel = document.getElementById("panel-active-session");

  startForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const title = document.getElementById("start-title").value.trim() || CFG.examTitle;
    const duration = parseInt(document.getElementById("start-duration").value, 10) || 20;
    const maxAttempts = parseInt(document.getElementById("start-max-attempts").value, 10) || 2;
    const btn = document.getElementById("start-session-btn");
    btn.disabled = true;
    btn.textContent = "Membuat sesi...";

    callBackend({ mode: "teacher_start_session", teacherCode: teacherCode, examTitle: title, durationMinutes: duration, maxAttempts: maxAttempts })
      .then((res) => {
        btn.disabled = false;
        btn.textContent = "Mulai Sesi Baru";
        if (!res || !res.ok) {
          alert(res && res.error ? res.error : "Gagal memulai sesi.");
          return;
        }
        currentSession = res.session;
        renderSessionUI();
      })
      .catch((err) => {
        btn.disabled = false;
        btn.textContent = "Mulai Sesi Baru";
        alert("Gagal menghubungi server: " + err.message);
      });
  });

  document.getElementById("end-session-btn").addEventListener("click", function () {
    if (!window.confirm("Akhiri sesi ujian ini? Siswa yang belum selesai tidak akan bisa melanjutkan.")) return;
    callBackend({ mode: "teacher_end_session", teacherCode: teacherCode })
      .then((res) => {
        if (res && res.ok) {
          currentSession = res.session;
          renderSessionUI();
        }
      })
      .catch((err) => alert("Gagal menghubungi server: " + err.message));
  });

  function renderSessionUI() {
    const hasActive = currentSession && currentSession.active;
    noSessionPanel.hidden = !!hasActive;
    activeSessionPanel.hidden = !hasActive;
    if (hasActive) {
      document.getElementById("active-code").textContent = currentSession.code;
      document.getElementById("active-title").textContent = currentSession.examTitle;
      document.getElementById("active-duration").textContent = currentSession.durationMinutes + " menit";
      document.getElementById("active-max-attempts").textContent = currentSession.maxAttempts || 2;
    }
  }

  // ============ ROSTER POLLING ============
  function startPolling() {
    pollRoster();
    pollTimer = setInterval(pollRoster, CFG.teacherPollIntervalMs);
  }

  function pollRoster() {
    if (!currentSession || !currentSession.code) return;
    callBackend({ mode: "teacher_roster", teacherCode: teacherCode, code: currentSession.code })
      .then((res) => {
        if (!res || !res.ok) return;
        currentSession = res.session || currentSession;
        renderSessionUI();
        renderRoster(res.roster || []);
      })
      .catch(() => { /* koneksi sempat putus — dicoba lagi di siklus berikutnya */ });
  }

  function timeAgo(ts) {
    if (!ts) return "-";
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + " dtk lalu";
    return Math.floor(s / 60) + " mnt lalu";
  }

  function violationClass(n) {
    if (!n) return "zero";
    if (n <= 2) return "some";
    return "many";
  }

  function statusPill(entry) {
    if (entry.locked) return '<span class="status-pill s-danger-strong">Dikunci</span>';
    if (entry.status === "submitted") return '<span class="status-pill s-submitted">Selesai</span>';
    const away = Date.now() - (entry.lastSeen || 0) > CFG.heartbeatIntervalMs * 2.5;
    if (away) return '<span class="status-pill s-away">Tidak aktif</span>';
    return '<span class="status-pill s-active">Mengerjakan</span>';
  }

  function renderRoster(roster) {
    const tbody = document.getElementById("roster-body");
    document.getElementById("stat-joined").textContent = String(roster.length);
    const submitted = roster.filter((r) => r.status === "submitted");
    document.getElementById("stat-submitted").textContent = String(submitted.length);

    // rata-rata dihitung dari skor TERTINGGI tiap siswa yang sudah submit minimal 1x
    const withBest = roster.filter((r) => typeof r.bestScore === "number");
    {
      const a = withBest.length ? (withBest.reduce((s, r) => s + r.bestScore, 0) / withBest.length).toFixed(1) : "-";
      document.getElementById("stat-avg").textContent = a;
    }

    if (!roster.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Belum ada siswa yang bergabung.</td></tr>';
      return;
    }

    roster.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    tbody.innerHTML = roster
      .map(function (r) {
        const totalViol = Object.keys(r.violations || {}).reduce((s, k) => s + (r.violations[k] || 0), 0);
        const attemptsUsed = r.attemptsUsed || 0;
        const maxAttempts = r.maxAttempts || (currentSession ? currentSession.maxAttempts : 2) || 2;
        const attemptsText = attemptsUsed + "/" + maxAttempts;
        const bestText = typeof r.bestScore === "number" ? (r.bestScore + "/" + r.bestTotal) : "-";
        const summaryTitle = (r.attemptsSummary && r.attemptsSummary.length)
          ? "Rincian percobaan: " + r.attemptsSummary.join(", ")
          : "Belum ada percobaan selesai";
        const autoTag = r.anyAutoSubmitted ? ' <span class="status-pill s-auto" title="Salah satu percobaan dikumpulkan otomatis karena waktu habis">waktu habis</span>' : "";
        const actionCell = r.locked
          ? '<button type="button" class="btn btn-secondary unlock-btn" data-student-id="' + escapeHtml(r.id) + '" style="padding:6px 12px;font-size:0.78rem;">Buka Akses</button>'
          : "-";
        return (
          "<tr>" +
          "<td>" + escapeHtml(r.name) + "</td>" +
          "<td>" + escapeHtml(r.className) + "</td>" +
          "<td>" + statusPill(r) + "</td>" +
          "<td>" + attemptsText + "</td>" +
          '<td class="viol-count ' + violationClass(totalViol) + '">' + totalViol + "</td>" +
          '<td title="' + escapeHtml(summaryTitle) + '">' + bestText + autoTag + "</td>" +
          "<td>" + timeAgo(r.lastSeen) + "</td>" +
          "<td>" + timeAgo(r.joinedAt) + "</td>" +
          "<td>" + actionCell + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  // Event delegation: tombol "Buka Akses" dibuat ulang tiap render, jadi listener
  // dipasang sekali di tbody, bukan per tombol.
  document.getElementById("roster-body").addEventListener("click", function (e) {
    const btn = e.target.closest(".unlock-btn");
    if (!btn) return;
    const studentId = btn.getAttribute("data-student-id");
    btn.disabled = true;
    btn.textContent = "Membuka...";
    callBackend({ mode: "teacher_unlock_student", teacherCode: teacherCode, code: currentSession.code, studentId: studentId })
      .then((res) => {
        if (!res || !res.ok) {
          alert(res && res.error ? res.error : "Gagal membuka akses.");
          btn.disabled = false;
          btn.textContent = "Buka Akses";
          return;
        }
        pollRoster();
      })
      .catch((err) => {
        alert("Gagal menghubungi server: " + err.message);
        btn.disabled = false;
        btn.textContent = "Buka Akses";
      });
  });

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ============ AUTO-RESUME (kode guru sempat tersimpan) ============
  (function tryResume() {
    if (!teacherCode) return;
    callBackend({ mode: "teacher_login", teacherCode: teacherCode })
      .then((res) => {
        if (res && res.ok) {
          currentSession = res.session || null;
          showScreen("panel");
          renderSessionUI();
          startPolling();
        }
      })
      .catch(() => { /* biarkan di layar login jika gagal */ });
  })();
})();
