/**
 * Ujian Fisika — backend Apps Script.
 *
 * Cara pakai singkat (detail lengkap ada di README.md):
 * 1. Buka https://script.google.com, buat project baru, ganti isi
 *    Code.gs dengan file ini.
 * 2. Ganti TEACHER_CONTROL_CODE di bawah dengan kode rahasia Anda
 *    sendiri (jangan pakai nilai contoh).
 * 3. Deploy > New deployment > Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Salin URL yang diakhiri /exec, tempel ke js/config.js
 *    (backendUrl) di kedua sisi (siswa & guru memakai file yang
 *    sama).
 * 5. Setiap kali Code.gs ini diubah, ulangi Deploy > Manage
 *    deployments > (pensil) > Version: New version > Deploy —
 *    menyimpan draf saja TIDAK memperbarui Web App yang sudah
 *    live.
 *
 * Penyimpanan: PropertiesService (key-value sederhana, tanpa
 * database eksternal), dengan LockService untuk mencegah race
 * condition saat banyak siswa mengirim heartbeat bersamaan.
 *
 * Model percobaan ganda (v2): setiap siswa diidentifikasi lewat
 * kombinasi nama+kelas yang diketikkan saat masuk (bukan ID acak),
 * supaya percobaan ke-2 seorang siswa bisa dikenali sebagai orang
 * yang sama, bukan "siswa baru". Setiap percobaan disimpan sebagai
 * satu entri dalam daftar attempts_<kode>_<studentKey>; nilai
 * TERTINGGI di antara seluruh percobaan itulah yang ditampilkan ke
 * guru sebagai skor siswa tersebut.
 *
 * Model kick+lock (v3): kalau siswa meninggalkan tampilan ujian
 * (keluar fullscreen ATAU pindah tab/aplikasi) 2 kali dalam satu
 * percobaan, sisi klien mengirim submit dengan flag kicked=true.
 * Backend menandai roster siswa itu locked=true — begitu locked,
 * student_join akan SELALU ditolak (walau masih ada sisa percobaan)
 * sampai guru memanggil teacher_unlock_student untuk membuka
 * kembali aksesnya.
 */

// GANTI INI — jangan gunakan nilai contoh untuk ujian sungguhan.
// Nilai ini TIDAK PERNAH dikirim ke browser siswa atau guru.
const TEACHER_CONTROL_CODE = "GANTI_KODE_GURU_INI";

const SESSION_KEY = "exam_session";
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // tanpa 0/O/1/I yang mirip
const DEFAULT_MAX_ATTEMPTS = 2;
const LOCK_REASON_TEXT = "Meninggalkan tampilan ujian (layar penuh/tab) 2 kali dalam satu percobaan.";

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: "Permintaan tidak valid." });
  }

  const mode = body.mode;
  try {
    switch (mode) {
      case "teacher_login":
        return jsonOut(handleTeacherLogin(body));
      case "teacher_start_session":
        return jsonOut(handleTeacherStartSession(body));
      case "teacher_end_session":
        return jsonOut(handleTeacherEndSession(body));
      case "teacher_roster":
        return jsonOut(handleTeacherRoster(body));
      case "teacher_unlock_student":
        return jsonOut(handleTeacherUnlockStudent(body));
      case "student_join":
        return jsonOut(handleStudentJoin(body));
      case "student_heartbeat":
        return jsonOut(handleStudentHeartbeat(body));
      case "student_submit":
        return jsonOut(handleStudentSubmit(body));
      default:
        return jsonOut({ ok: false, error: "Mode tidak dikenali." });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: "Kesalahan server: " + err.message });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function requireTeacher(body) {
  return body.teacherCode === TEACHER_CONTROL_CODE;
}

function getSession() {
  const raw = PropertiesService.getScriptProperties().getProperty(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveSession(session) {
  PropertiesService.getScriptProperties().setProperty(SESSION_KEY, JSON.stringify(session));
}

function publicSession(session) {
  if (!session) return null;
  return {
    code: session.code,
    examTitle: session.examTitle,
    durationMinutes: session.durationMinutes,
    maxAttempts: session.maxAttempts || DEFAULT_MAX_ATTEMPTS,
    active: session.active
  };
}

// ---------------- STUDENT IDENTITY & ATTEMPTS ----------------

// Kunci identitas siswa = slug dari nama+kelas yang diketik saat masuk.
// Catatan jujur: ini BUKAN autentikasi sungguhan. Dua siswa dengan
// nama+kelas identik akan dianggap satu orang, dan siswa yang sengaja
// mengetik namanya sedikit berbeda di percobaan berikutnya bisa lolos
// dari batas percobaan maupun dari status terkunci. Cukup untuk
// penggunaan kelas biasa; untuk ujian berisiko tinggi, pertimbangkan
// menambah kolom NISN/ID siswa.
function slugifyStudentKey(name, className) {
  const raw = (name + "_" + className).toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (slug || "siswa").slice(0, 60);
}

function getAttempts(code, studentKey) {
  const raw = PropertiesService.getScriptProperties().getProperty("attempts_" + code + "_" + studentKey);
  return raw ? JSON.parse(raw) : [];
}

function saveAttempts(code, studentKey, attempts) {
  PropertiesService.getScriptProperties().setProperty("attempts_" + code + "_" + studentKey, JSON.stringify(attempts));
}

function bestAttempt(attempts) {
  return attempts.reduce(function (best, a) { return a.score > best.score ? a : best; }, attempts[0]);
}

function getRosterEntry(code, studentKey) {
  const raw = PropertiesService.getScriptProperties().getProperty("roster_" + code + "_" + studentKey);
  return raw ? JSON.parse(raw) : null;
}

function saveRosterEntry(code, studentKey, entry) {
  PropertiesService.getScriptProperties().setProperty("roster_" + code + "_" + studentKey, JSON.stringify(entry));
}

// ---------------- TEACHER ----------------

function handleTeacherLogin(body) {
  if (!requireTeacher(body)) return { ok: false, error: "Kode kontrol guru salah." };
  return { ok: true, session: publicSession(getSession()) };
}

function handleTeacherStartSession(body) {
  if (!requireTeacher(body)) return { ok: false, error: "Kode kontrol guru salah." };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const prevSession = getSession();
    if (prevSession && prevSession.code) {
      clearRosterAndResults(prevSession.code);
    }

    const code = generateSessionCode();
    const session = {
      code: code,
      examTitle: (body.examTitle || "Ulangan Fisika").toString().slice(0, 120),
      durationMinutes: clampInt(body.durationMinutes, 5, 180, 20),
      maxAttempts: clampInt(body.maxAttempts, 1, 5, DEFAULT_MAX_ATTEMPTS),
      startedAt: Date.now(),
      active: true
    };
    saveSession(session);
    return { ok: true, session: publicSession(session) };
  } finally {
    lock.releaseLock();
  }
}

function handleTeacherEndSession(body) {
  if (!requireTeacher(body)) return { ok: false, error: "Kode kontrol guru salah." };
  const session = getSession();
  if (session) {
    session.active = false;
    saveSession(session);
  }
  return { ok: true, session: publicSession(session) };
}

function handleTeacherRoster(body) {
  if (!requireTeacher(body)) return { ok: false, error: "Kode kontrol guru salah." };
  const session = getSession();
  if (!session || session.code !== body.code) {
    return { ok: true, session: publicSession(session), roster: [] };
  }

  const props = PropertiesService.getScriptProperties().getProperties();
  const rosterPrefix = "roster_" + session.code + "_";
  const attemptsPrefix = "attempts_" + session.code + "_";

  const roster = {};
  Object.keys(props).forEach(function (key) {
    if (key.indexOf(rosterPrefix) === 0) {
      const entry = JSON.parse(props[key]);
      roster[entry.id] = entry;
    }
  });

  Object.keys(roster).forEach(function (studentKey) {
    const raw = props[attemptsPrefix + studentKey];
    const attempts = raw ? JSON.parse(raw) : [];
    const entry = roster[studentKey];
    entry.attemptsUsed = attempts.length;
    entry.maxAttempts = session.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    entry.attemptsSummary = attempts.map(function (a) { return a.score + "/" + a.total; });
    entry.locked = !!entry.locked;
    if (attempts.length) {
      const best = bestAttempt(attempts);
      entry.bestScore = best.score;
      entry.bestTotal = best.total;
      entry.anyAutoSubmitted = attempts.some(function (a) { return a.autoSubmitted && !a.kicked; });
    }
  });

  return { ok: true, session: publicSession(session), roster: Object.keys(roster).map((k) => roster[k]) };
}

function handleTeacherUnlockStudent(body) {
  if (!requireTeacher(body)) return { ok: false, error: "Kode kontrol guru salah." };
  const session = getSession();
  if (!session || session.code !== body.code) return { ok: false, error: "Sesi tidak ditemukan." };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const entry = getRosterEntry(body.code, body.studentId);
    if (!entry) return { ok: false, error: "Siswa tidak ditemukan." };
    entry.locked = false;
    entry.lockedReason = null;
    saveRosterEntry(body.code, body.studentId, entry);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function clearRosterAndResults(oldCode) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const prefix1 = "roster_" + oldCode + "_";
  const prefix2 = "attempts_" + oldCode + "_";
  Object.keys(all).forEach(function (key) {
    if (key.indexOf(prefix1) === 0 || key.indexOf(prefix2) === 0) {
      props.deleteProperty(key);
    }
  });
}

function generateSessionCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ---------------- STUDENT ----------------

function handleStudentJoin(body) {
  const session = getSession();
  const code = (body.code || "").toString().toUpperCase().trim();
  if (!session || !session.active || session.code !== code) {
    return { ok: false, error: "Kode sesi tidak valid atau sesi belum/tidak lagi aktif." };
  }
  const name = (body.name || "").toString().slice(0, 60).trim();
  const className = (body.className || "").toString().slice(0, 30).trim();
  if (!name || !className) return { ok: false, error: "Nama dan kelas wajib diisi." };

  const maxAttempts = session.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const studentKey = slugifyStudentKey(name, className);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = getRosterEntry(session.code, studentKey);
    if (existing && existing.locked) {
      return {
        ok: false,
        error: "Aksesmu dikunci oleh guru karena meninggalkan tampilan ujian 2 kali. Minta gurumu membuka akses lagi sebelum bisa mencoba."
      };
    }

    const attempts = getAttempts(session.code, studentKey);
    if (attempts.length >= maxAttempts) {
      return {
        ok: false,
        error:
          "Kamu sudah menggunakan " + maxAttempts + " dari " + maxAttempts +
          " kesempatan mengerjakan ujian ini. Nilai tertinggimu sudah dikirim ke guru."
      };
    }

    const entry = {
      id: studentKey,
      name: name,
      className: className,
      joinedAt: existing ? existing.joinedAt : Date.now(),
      lastSeen: Date.now(),
      status: "in-progress",
      currentAttempt: attempts.length + 1,
      locked: false,
      lockedReason: null,
      violations: {}
    };
    saveRosterEntry(session.code, studentKey, entry);

    return {
      ok: true,
      studentId: studentKey,
      examTitle: session.examTitle,
      durationMinutes: session.durationMinutes,
      attemptNumber: attempts.length + 1,
      maxAttempts: maxAttempts
    };
  } finally {
    lock.releaseLock();
  }
}

function handleStudentHeartbeat(body) {
  const session = getSession();
  const code = (body.code || "").toString().toUpperCase().trim();
  if (!session || session.code !== code) return { ok: false, error: "Sesi tidak ditemukan." };

  const entry = getRosterEntry(code, body.studentId);
  if (!entry) return { ok: false, error: "Peserta tidak ditemukan." };

  entry.lastSeen = Date.now();
  entry.violations = body.violations || entry.violations;
  entry.answeredCount = body.answeredCount;
  if (entry.status !== "submitted") entry.status = "in-progress";
  saveRosterEntry(code, body.studentId, entry);
  return { ok: true, sessionActive: !!session.active };
}

function handleStudentSubmit(body) {
  const session = getSession();
  const code = (body.code || "").toString().toUpperCase().trim();
  if (!session || session.code !== code) return { ok: false, error: "Sesi tidak ditemukan." };

  const maxAttempts = session.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const studentKey = body.studentId;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const attempts = getAttempts(code, studentKey);
    if (attempts.length >= maxAttempts) {
      return { ok: false, error: "Batas percobaan sudah tercapai." };
    }

    const attemptRecord = {
      attemptNumber: attempts.length + 1,
      answers: body.answers,
      score: body.score,
      total: body.total,
      autoSubmitted: !!body.autoSubmitted,
      kicked: !!body.kicked,
      violations: body.violations || {},
      submittedAt: Date.now()
    };
    attempts.push(attemptRecord);
    saveAttempts(code, studentKey, attempts);

    const best = bestAttempt(attempts);

    const entry = getRosterEntry(code, studentKey);
    if (entry) {
      entry.status = "submitted";
      entry.lastSeen = Date.now();
      if (body.kicked) {
        entry.locked = true;
        entry.lockedReason = LOCK_REASON_TEXT;
      }
      saveRosterEntry(code, studentKey, entry);
    }

    return {
      ok: true,
      score: body.score,
      total: body.total,
      attemptNumber: attemptRecord.attemptNumber,
      attemptsUsed: attempts.length,
      maxAttempts: maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - attempts.length),
      bestScore: best.score,
      bestTotal: best.total,
      locked: !!body.kicked
    };
  } finally {
    lock.releaseLock();
  }
}
