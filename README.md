# Ujian Fisika — Situs Ujian dengan Kode Sesi & Panel Guru

Situs ujian pilihan ganda statis (siap di-*publish* ke GitHub Pages) dengan:

- Halaman siswa (`index.html`): masuk pakai nama + kelas + kode sesi dari
  guru, mode layar penuh, deteksi kecurangan, timer, 12 soal pilihan
  ganda, skor langsung ditampilkan setelah selesai.
- Panel Guru (`teacher.html`): masuk pakai kode kontrol rahasia,
  membuat kode sesi baru, memonitor siswa yang sedang mengerjakan
  (status, jumlah pelanggaran, skor) secara *real-time* (polling).
- Backend (`apps-script/Code.gs`): relai sederhana berbasis Google Apps
  Script + `PropertiesService`, tanpa database eksternal dan tanpa API
  key AI apa pun.

## Baca ini dulu — batas kemampuan sesungguhnya

Sebelum dipakai untuk ujian sungguhan, penting dipahami: **tidak ada
situs web yang bisa benar-benar mencegah Alt+Tab, keluar layar penuh,
menyalin teks, atau mengambil screenshot.** Ini bukan kelemahan
implementasi — ini batas dari apa yang boleh dilakukan JavaScript di
browser mana pun, demi keamanan pengguna.

| Yang diminta | Yang benar-benar bisa dilakukan situs ini |
|---|---|
| Siswa tidak bisa Alt+Tab / pindah aplikasi | **Sama sekali tidak bisa dicegah** — ini pintasan level sistem operasi, ditangani sebelum browser sempat melihatnya. Yang bisa dilakukan hanyalah **mendeteksi akibatnya** (jendela kehilangan fokus, lewat event `blur`) begitu terjadi, lalu bereaksi tegas: peringatan di kejadian ke-1, ujian dihentikan + akses dikunci di kejadian ke-2. |
| Siswa tidak bisa menutup web / keluar fullscreen | Meminta mode layar penuh, lalu **mendeteksi** kalau keluar (termasuk lewat tombol Esc, yang **tidak bisa diblokir** oleh situs mana pun) — diperlakukan sama seperti Alt+Tab di atas (peringatan lalu dihentikan+dikunci). Menutup tab/browser sama sekali tidak bisa dicegah maupun "dikembalikan". |
| Siswa tidak bisa copy-paste | Klik kanan, `Ctrl+C/X`, dan seleksi teks dinonaktifkan untuk penggunaan biasa. Siswa yang membuka DevTools browser tetap bisa mengakses teks halaman — F12/Ctrl+Shift+I dicoba diblokir, tapi ini upaya terbaik, bukan jaminan. |
| Siswa tidak bisa screenshot | **Tidak mungkin dicegah oleh web sama sekali.** Situs ini hanya mendeteksi tombol *Print Screen* fisik di Windows (tidak berlaku di Mac/HP) dan langsung mem-blur konten sesaat — sekadar mengurangi kegunaan hasil tangkapan cepat, bukan pencegahan. Foto layar pakai HP/kamera lain **tidak bisa dideteksi maupun dicegah sama sekali.** |

Yang situs ini benar-benar tawarkan: **pencegahan kasual + deteksi
tegas + pencatatan pelanggaran yang terlihat jelas oleh guru.** Ini
cukup untuk mencegah sebagian besar kecurangan biasa dan memberi guru
kendali penuh untuk menindaklanjuti, tapi jangan menjanjikan ke siswa
atau pihak sekolah bahwa sistem ini "tidak bisa ditembus" — itu tidak
akurat untuk platform web apa pun.

### Aturan "meninggalkan ujian" (Alt+Tab, pindah tab, keluar fullscreen)

Tiga cara siswa bisa "meninggalkan" tampilan ujian — keluar layar
penuh (`fullscreenchange`), jendela kehilangan fokus (`blur`, ini yang
mendeteksi Alt+Tab), dan tab tidak lagi terlihat (`visibilitychange`)
— semuanya digabung jadi SATU hitungan pelanggaran (`leftExam`), agar
tidak dihitung ganda saat dua sinyal terpicu bersamaan untuk satu
kejadian yang sama:

1. **Kejadian ke-1**: layar penuh terkunci dengan overlay peringatan
   ("Peringatan 1/2") yang harus diklik "Saya Mengerti, Lanjutkan"
   untuk melanjutkan (sekaligus mencoba masuk lagi ke mode layar
   penuh).
2. **Kejadian ke-2**: ujian langsung dihentikan (jawaban sejauh ini
   otomatis dikumpulkan dan dinilai seperti biasa), DAN akses siswa
   tersebut **dikunci** — mencoba masuk lagi dengan nama+kelas yang
   sama akan selalu ditolak, **walaupun dia masih punya sisa
   percobaan**, sampai guru membuka aksesnya secara manual.

Guru membuka akses lewat tombol **"Buka Akses"** yang muncul di baris
siswa tersebut pada tabel "Aktivitas Siswa" (kolom Aksi) begitu status
mereka "Dikunci". Setelah dibuka, siswa bisa langsung memakai tombol
"Coba Masuk Lagi" di layar mereka (kalau masih terbuka) atau membuka
ulang link ujian dan login lagi — percobaan yang terpakai saat dikunci
tetap terhitung sebagai satu percobaan yang sudah dipakai.

Pelanggaran lain (klik kanan/menyalin, upaya DevTools, Print Screen)
TIDAK memicu kunci ini — pelanggaran-pelanggaran itu masih memakai
jalur lama: digabung sebagai satu total, dan begitu totalnya mencapai
`maxViolationsBeforeAutoSubmit` (default 6) di `js/config.js`, ujian
otomatis dikumpulkan seperti biasa **tanpa** mengunci akses.

## Struktur file

```
ujian-fisika/
├── index.html            (halaman siswa)
├── teacher.html           (panel guru)
├── css/style.css
├── js/
│   ├── config.js           (URL backend + pengaturan — edit ini)
│   ├── questions.js         (12 soal MCQ, lihat di bawah)
│   ├── exam.js               (logika siswa: login, anti-cheat, timer, skor)
│   └── teacher.js             (logika panel guru)
├── apps-script/Code.gs    (backend Google Apps Script)
└── README.md
```

## Langkah pemasangan

### 1. Deploy backend (Google Apps Script)

1. Buka [script.google.com](https://script.google.com), buat project baru.
2. Hapus isi `Code.gs` bawaan, tempel isi `apps-script/Code.gs` dari
   folder ini.
3. Ganti baris berikut dengan kode rahasia Anda sendiri (jangan pakai
   contoh apa adanya):
   ```js
   const TEACHER_CONTROL_CODE = "GANTI_KODE_GURU_INI";
   ```
   Kode ini **tidak pernah** dikirim ke browser siapa pun — hanya
   dicocokkan di server. Ini yang dipakai untuk masuk ke Panel Guru.
4. **Deploy > New deployment > Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin URL yang diakhiri `/exec`.
6. **Penting:** setiap kali Anda mengedit `Code.gs` lagi di kemudian
   hari, ulangi lewat **Deploy > Manage deployments > (ikon pensil) >
   Version: New version > Deploy**. Menyimpan draf saja **tidak**
   memperbarui Web App yang sudah live — ini kesalahan paling umum.

### 2. Isi konfigurasi front-end

Buka `js/config.js`, tempel URL `/exec` Anda:

```js
window.EXAM_CONFIG = {
  backendUrl: "https://script.google.com/macros/s/AKfycb.../exec",
  ...
};
```

Satu file `config.js` ini dipakai bersama oleh `index.html` dan
`teacher.html` — cukup diisi sekali.

### 3. Publish ke GitHub Pages

1. Buat repository baru di GitHub, upload seluruh isi folder
   `ujian-fisika/` (bisa lewat "Add file > Upload files" di web
   GitHub, atau `git push` kalau Anda memakai command line).
2. Di repo: **Settings > Pages** → Source: `Deploy from a branch` →
   Branch: `main` / folder `/ (root)` → Save.
3. Setelah beberapa menit, situs Anda aktif di
   `https://<username>.github.io/<nama-repo>/`.
4. Bagikan link **teacher.html** ke diri Anda sendiri (guru), dan link
   **index.html** (atau link root, yang otomatis membuka `index.html`)
   ke siswa.

## Cara memakai

**Guru:**
1. Buka `teacher.html`, masuk dengan kode kontrol dari `Code.gs`.
2. Isi judul ujian, durasi (menit), dan **maksimal percobaan per siswa**
   (default 2), klik **Mulai Sesi Baru**.
3. Kode 6 karakter akan muncul besar — tuliskan di papan tulis / bagikan
   ke siswa.
4. Pantau tabel "Aktivitas Siswa": status, jumlah percobaan yang sudah
   dipakai (mis. "1/2"), jumlah pelanggaran, dan **skor tertinggi** di
   antara semua percobaan siswa tersebut — diperbarui otomatis tiap
   beberapa detik. Arahkan kursor ke kolom skor untuk melihat rincian
   tiap percobaan (mis. "6/12, 12/12"). Kalau status seorang siswa
   berubah jadi **"Dikunci"** (dia meninggalkan tampilan ujian 2 kali),
   klik tombol **"Buka Akses"** di kolom Aksi begitu Anda sudah
   menindaklanjuti (misalnya menegur siswa tersebut) untuk mengizinkan
   dia mencoba lagi.
5. Klik **Akhiri Sesi** setelah waktu ujian selesai. Siswa yang belum
   mengumpulkan tidak bisa lagi bergabung/melanjutkan setelah sesi
   diakhiri.

**Siswa:**
1. Buka link ujian, isi nama, kelas, dan kode dari guru.
2. Baca aturan (ada info "Ini percobaan ke-N dari M"), klik
   **Mulai Ujian** (browser akan meminta izin mode layar penuh —
   izinkan).
3. Jawab 12 soal, navigasi lewat tombol atau titik nomor soal di atas.
4. Klik **Kumpulkan Ujian** di soal terakhir, atau ujian otomatis
   terkumpul saat waktu habis / pelanggaran melewati batas.
5. Skor percobaan ini langsung tampil, beserta skor TERTINGGI sejauh
   ini. Kalau masih ada percobaan tersisa, tombol **Coba Lagi** muncul
   — klik untuk langsung memulai percobaan berikutnya (tidak perlu
   mengetik ulang nama/kelas/kode). Begitu percobaan terakhir dipakai,
   tombol ini hilang dan mencoba masuk lagi dengan nama+kelas yang
   sama akan ditolak.

### Cara kerja percobaan ganda (multi-attempt)

- Siswa dikenali lewat kombinasi **nama + kelas** yang ia ketikkan saat
  masuk — bukan lewat akun/password sungguhan. Nama+kelas yang sama
  dianggap satu orang, sehingga percobaan ke-2 tetap terhitung sebagai
  bagian dari siswa yang sama, bukan siswa baru.
  **Keterbatasan yang jujur perlu diketahui:** siswa yang mengetik
  namanya sedikit berbeda di percobaan berikutnya (mis. "Budi S."
  lalu "Budi Santoso") akan dianggap dua orang berbeda oleh sistem,
  sehingga bisa mendapat percobaan tambahan di luar batas. Untuk kelas
  biasa ini jarang jadi masalah; untuk ujian yang taruhannya tinggi,
  pertimbangkan menambah kolom NISN/ID siswa ke `student_join` di
  `Code.gs` dan `index.html` sebagai identitas yang lebih kuat.
- Skor yang dikirim ke guru dan ditampilkan di Panel Guru adalah
  **skor TERTINGGI** di antara seluruh percobaan yang sudah
  dikumpulkan siswa tersebut — dihitung ulang di server setiap kali
  ada percobaan baru masuk, bukan hanya percobaan terakhir.
- Percobaan yang berakhir karena auto-submit (waktu habis atau batas
  pelanggaran tercapai) tetap dihitung sebagai satu percobaan yang
  terpakai, sama seperti percobaan yang dikumpulkan manual.

## Menyesuaikan

- **Jumlah pelanggaran sebelum auto-submit (non-kunci)**:
  `maxViolationsBeforeAutoSubmit` di `js/config.js` (default 6,
  menghitung klik-kanan/menyalin/DevTools/Print Screen digabung,
  dihitung ulang dari nol di setiap percobaan baru). Ini TIDAK
  memicu penguncian akses.
- **Jumlah "meninggalkan ujian" sebelum dihentikan+dikunci**:
  konstanta `MAX_LEAVES_BEFORE_KICK` di `js/exam.js` (default 2, sesuai
  permintaan "2 kali keluar"). Ubah nilainya di situ kalau ingin ambang
  batas berbeda.
- **Maksimal percobaan per siswa**: diatur guru langsung di Panel Guru
  saat memulai sesi (field "Maksimal percobaan per siswa", default 2,
  batas 1–5), bukan di kode — jadi bisa beda-beda tiap sesi.
- **Bank soal**: edit `js/questions.js`. Setiap soal adalah satu objek
  `{ id, topic, text, options: [4 string], correctIndex }`. Field
  `explanation` hanya catatan internal, tidak ditampilkan ke siswa.
  Notasi eksponen dan simbol pakai HTML biasa (`<sup>`, karakter
  Unicode seperti ω, π, Δ, √, °) — sengaja tidak memakai MathJax/KaTeX
  dari CDN eksternal supaya ujian tetap bisa jalan walau koneksi
  sekolah ke internet luar sedang lambat/terputus sebagian.
- **Durasi ujian**: diatur guru langsung di Panel Guru saat memulai
  sesi (bukan di kode), jadi bisa beda-beda tiap sesi tanpa edit file.

## Soal-soal

12 soal (4 per topik: **Oscillations**, **Ideal Gases**, **Thermal
Properties of Materials**) diambil dan dihitung ulang dari kumpulan
soal ujian asli Cambridge International AS & A Level Physics 9702
Paper 4 (2016–2021). Setiap angka pada opsi jawaban diverifikasi
ulang secara independen (lihat komentar `explanation` di
`questions.js`); untuk soal yang aslinya memuat perintah "show that",
jawaban situs ini dicocokkan dan sesuai dengan nilai resmi tersebut.
Pengecoh (opsi salah) dirancang mencerminkan kesalahan hitung yang
umum terjadi (lupa faktor 2π, lupa mengonversi satuan, lupa satu suku
dalam kekekalan energi kalor, dsb.), bukan angka acak.

## Catatan teknis

- Data siswa (roster, jawaban, skor) disimpan di `PropertiesService`
  Apps Script — cocok untuk satu kelas per sesi (puluhan siswa). Untuk
  penggunaan jauh lebih besar (ratusan siswa bersamaan), pertimbangkan
  mengganti penyimpanan ke Google Sheets atau database lain.
  Memulai sesi baru otomatis menghapus data roster/hasil dari sesi
  sebelumnya dengan kode yang sama.
- Hanya **satu sesi ujian aktif** dalam satu waktu per deployment
  Apps Script (sesuai desain — kalau perlu beberapa kelas ujian
  bersamaan dengan soal berbeda, deploy Apps Script terpisah per
  kelas/soal).
- Refresh halaman siswa yang tidak sengaja tidak menghilangkan
  progres (jawaban tersimpan sementara di `localStorage` browser),
  tapi tetap akan keluar dari mode layar penuh dan tercatat sebagai
  satu pelanggaran — beri tahu siswa untuk tidak me-refresh secara
  sengaja.
- Semua permintaan ke Apps Script memakai `Content-Type: text/plain`
  supaya tidak memicu CORS preflight (Apps Script Web App tidak
  mendukung preflight OPTIONS dengan baik).
