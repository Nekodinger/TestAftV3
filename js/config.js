/* ============================================================
   Konfigurasi bersama — index.html (siswa) & teacher.html (guru)
   backendUrl di bawah sudah diisi dengan URL /exec Apps Script
   yang sudah di-deploy. Kalau suatu saat Anda redeploy dan
   mendapat URL /exec BARU (jarang terjadi — "New version" pada
   deployment yang sama tidak mengubah URL), ganti nilainya di
   sini.
   ============================================================ */
window.EXAM_CONFIG = {
  backendUrl: "https://script.google.com/macros/s/AKfycbxvaKofLgmx2HSQy0BBrrU4drZ3J50riN_wHz9GMuOWs85NsAALh1ZqXZsxFtHvh_Cffw/exec",

  examTitle: "QUIZ",

  // Berapa kali pelanggaran (total, semua jenis) sebelum ujian
  // seorang siswa otomatis dikumpulkan.
  maxViolationsBeforeAutoSubmit: 6,

  // Seberapa sering status siswa dikirim ke backend (ms)
  heartbeatIntervalMs: 10000,

  // Seberapa sering Panel Guru menarik ulang data roster (ms)
  teacherPollIntervalMs: 8000
};
