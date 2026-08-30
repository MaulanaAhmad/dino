# Tempat Impian Kita — Dido & Novi

Web app PWA privat untuk Dido & Novi. Static site (HTML + Alpine.js + Supabase), **tanpa build tool/bundler** — semua file jalan langsung, cukup upload ke GitHub Pages (termasuk kalau di subfolder, misalnya `username.github.io/repo/`).

## Rekap yang sudah dikerjakan

1. **App shell & design system** — claymorphism (Fraunces + Mulish, palet warm rose/wine/cream), bottom navigation 5 menu, PWA (manifest + service worker, installable di Android & iOS).
2. **Beranda** — hero foto pasangan + counter "bersama sejak", **Papan Kangen** (sticky notes pesan singkat antar pasangan), shortcut ke halaman lain.
3. **Wishlist** — CRUD tempat impian tersambung Supabase (kategori, lokasi, siapa yang pengen ke sana, rencana tanggal), filter, realtime sync antar device, status "Tersinkron/Menyinkronkan/Offline".
4. **Kalender** — grid bulanan, dot indicator di tanggal yang punya rencana wishlist, tap tanggal untuk lihat daftarnya.
5. **Cerita Kita** — timeline feed foto: upload foto (otomatis di-resize & dikompres di browser), caption, tanggal momen, heart reaction, realtime sync.
6. **Rencana Nikah** — sengaja dibiarkan ringkas dan belum berfungsi, cukup sebagai pengantar bahwa halaman ini menyusul. Statis, tanpa database.
7. **Migrasi ke Alpine.js** — semua interaktivitas (modal, filter, form, list) pakai `x-data`/`x-for`/`x-model`/`x-transition`, tidak ada lagi `addEventListener`/`onclick` manual.
8. **Date-picker & dropdown custom** — `<input type="date">` diganti kalender popup bergaya clay; semua `<select>` punya chevron custom (bukan tampilan default browser).
9. **Tab Film di Wishlist** — wishlist sekarang punya 2 tab: "Tempat" (asli) dan "Film" (watchlist movie/series) — satu tabel yang sama, dibedakan kolom `item_type`, dengan kategori/label form yang berubah otomatis sesuai tab (genre vs kategori, platform vs lokasi, "rencana nonton" vs "rencana tanggal").
10. **Beranda diperkaya** — kartu hari jadi otomatis berhias (badge "Hari Jadi ke-N", gradasi emas, hujan hati satu halaman, ucapan, bingkai foto keemasan) tepat di tanggal hari jadi tahunan; **Surat** berbentuk amplop yang diketuk untuk membaca pesan; **Rencana Terdekat** yang menarik wishlist ber-tanggal terdekat lengkap dengan hitung mundur; tombol info memakai modal clay (bukan `alert()` bawaan browser); Kalender ditambahkan ke daftar Jelajahi.
11. **Kalender jadi linimasa dua arah** — bukan cuma rencana ke depan, tapi juga kenangan ke belakang: foto dari Cerita ikut muncul sesuai `moment_date`, dan hari jadi tahunan ditandai hati otomatis dari `ANNIVERSARY`. Ditambah titik berwarna per jenis + legenda, ringkasan isi bulan, tombol "kembali ke bulan ini", rencana yang sudah dijalani/lewat tampil redup, dan tanggal kosong menawarkan tombol yang membuka form Wishlist dengan tanggalnya sudah terisi (`wishlist.html?tambah=1&tanggal=YYYY-MM-DD`).
12. **Cerita disempurnakan** — foto tidak lagi dipotong paksa ke 4:3 (foto potret dulu kehilangan hampir separuh tingginya) dan bisa diketuk untuk dilihat ukuran penuh lewat lightbox; bisa **edit** caption/tanggal/foto tanpa unggah ulang dari awal; momen dikelompokkan per bulan; jumlah kenangan tampil di header; pengirim terisi otomatis dari identitas; reaction memakai `loved_by` sehingga terbaca "Kalian berdua suka ini" atau "Novi suka ini"; konfirmasi hapus memakai modal clay.
13. **Wishlist disempurnakan** — konfirmasi hapus memakai modal clay (ini yang terakhir; sekarang benar-benar tidak ada lagi `alert()`/`confirm()` bawaan browser di seluruh app); default "yang pengen ke sana" mengikuti identitas; ringkasan "7 tempat · 1 sudah dikunjungi" di header; item yang punya rencana tanggal bisa diketuk langsung ke Kalender di tanggal tersebut (`kalender.html?tanggal=YYYY-MM-DD`) lengkap dengan badge hitung mundur; tab Tempat/Film terakhir diingat; dan urutan daftar jadi lebih berguna — yang punya tanggal terdekat di atas, yang sudah dijalani turun ke bawah.
14. **Agenda kencan** — rencana bertanggal yang **bukan** wishlist ("Sabtu nonton jam 7"), diinput langsung dari Kalender dengan mengetuk tanggalnya. Punya jam, tempat ketemu, catatan, dan penanda sudah dijalani. Muncul di Kalender dengan titik wine, dan ikut terhitung di "Rencana Terdekat" pada Beranda.
15. **Papan Kangen disempurnakan** — app mengingat "kamu siapa" (Dido/Novi) di HP masing-masing, jadi pengirim terisi otomatis; tiap pesan menampilkan **waktu relatif** ("baru saja", "2 jam lalu", "kemarin"); **pesan baru dari pasangan** ditandai badge jumlah di judul + cincin rose + titik merah di note-nya; konfirmasi hapus memakai modal clay (bukan `confirm()` bawaan browser).

## Struktur halaman & fitur

| Halaman | Fitur |
|---|---|
| [index.html](index.html) | Hero + counter jadian (berhias otomatis pas hari jadi tahunan), **Surat**, **Papan Kangen**, **Rencana Terdekat**, shortcut ke semua halaman |
| [kalender.html](kalender.html) | Linimasa dua arah: rencana (`places.visit_date`) + kenangan (`moments.moment_date`) + hari jadi tahunan. Titik berwarna per jenis, ringkasan bulan, tombol "kembali ke bulan ini", dan tanggal kosong menawarkan tambah rencana |
| [cerita.html](cerita.html) | Timeline foto dikelompokkan per bulan: foto tampil utuh (tidak dipotong) & bisa diketuk untuk lihat penuh, caption, tanggal, edit, hapus, dan reaction yang menunjukkan siapa yang suka |
| [wishlist.html](wishlist.html) | Tab **Tempat**: CRUD wisata/kuliner (nama, kategori, siapa, lokasi, rencana tanggal, catatan). Tab **Film**: watchlist movie/series (judul, genre, siapa, platform, rencana nonton) |
| [nikah.html](nikah.html) | Sengaja dibiarkan ringkas — cincin, judul, dan satu kalimat pengantar. Belum berfungsi, statis, tanpa database |

## Struktur file

```
index.html              Beranda (+ Papan Kangen)
kalender.html            Kalender rencana wishlist
cerita.html              Timeline foto Cerita Kita
wishlist.html            Wishlist tempat impian
nikah.html               Rencana Nikah (placeholder)
manifest.json            Manifest PWA
sw.js                    Service worker (cache app shell, offline)

assets/css/app.css       Design tokens + komponen clay + bottom nav + modal + date-picker + calendar-grid (SEMUA shared, dipakai lintas halaman)

assets/js/app.js         Util bersama: konstanta Supabase, getSupabaseClient(), anniversary counter,
                         formatDateID/toDateStr/buildCalendarGrid, Alpine.data('bottomNav')
assets/js/beranda.js     Komponen Beranda: 'heroAnniversary', 'surat', 'papan',
                         'rencanaTerdekat', 'infoApp'
assets/js/wishlist.js    Alpine component 'wishlist' (CRUD + realtime + date-picker)
assets/js/kalender.js    Alpine component 'calendar'
assets/js/cerita.js      Alpine component 'cerita' (upload foto + kompres + realtime + date-picker)

assets/img/              Foto & icon
```

## Skema database (Supabase)

Project sudah ada dan dipakai bersama untuk beberapa fitur, semua difilter kolom `list_code = 'kita-9f4b27e1a6c3'` (didefinisikan di [assets/js/app.js](assets/js/app.js)).

### Tabel `places` (Wishlist — Tempat & Film)

| kolom | tipe | keterangan |
|---|---|---|
| id | uuid | primary key |
| list_code | text | filter |
| item_type | text | `tempat` (default) / `film` — nentuin tab & opsi kategori di form |
| name | text | nama tempat / judul film |
| category | text | Tempat: `Wisata`/`Kuliner`/`Staycation`/`Lainnya`. Film: `Action`/`Drama`/`Komedi`/`Horror`/`Animasi`/`Dokumenter`/`Lainnya` |
| location | text | lokasi (tempat) atau platform nonton (film), opsional |
| who | text | `Dido & Novi` / `Dido` / `Novi` |
| note | text | catatan (opsional) |
| visited | bool | sudah dikunjungi (tempat) / sudah ditonton (film) |
| visit_date | date | rencana tanggal kunjungan/nonton (opsional, dipakai halaman Kalender) |
| created_at | timestamptz | default `now()` |

Catatan implementasi: kolom `item_type` **hanya dikirim ke Supabase saat item bertipe `film`** ([assets/js/wishlist.js](assets/js/wishlist.js)) — item tipe "Tempat" tidak pernah menyertakan kolom ini di payload, supaya form tetap 100% jalan normal buat siapa pun yang belum menjalankan migration di bawah.

### Tabel `moments` (Cerita Kita)

| kolom | tipe | keterangan |
|---|---|---|
| id | uuid | primary key |
| list_code | text | filter |
| photo_url | text | public URL foto di Storage |
| storage_path | text | path di bucket `moments`, dipakai buat hapus foto |
| caption | text | opsional |
| who | text | `Dido & Novi` / `Dido` / `Novi` |
| moment_date | date | tanggal momen |
| loved_by | text[] | siapa saja yang menyukai, mis. `{Dido,Novi}` — default `{}` |
| created_at | timestamptz | default `now()` |

Kolom `loved` (boolean) dari versi awal sudah **tidak dipakai lagi**, digantikan `loved_by` supaya ketahuan siapa yang menekan hati dan keduanya bisa menyukai secara terpisah.

**Storage bucket** `moments` (public read) — foto di-resize maks 1600px & dikompres JPEG 80% di browser sebelum upload.

### Tabel `agenda` (rencana kencan bertanggal)

Beda dengan `places`: wishlist itu **keinginan tanpa waktu pasti**, agenda itu **rencana yang sudah punya tanggal** ("Sabtu nonton di bioskop jam 7"). Diinput langsung dari halaman Kalender.

| kolom | tipe | keterangan |
|---|---|---|
| id | uuid | primary key |
| list_code | text | filter |
| title | text | mau ke mana / ngapain |
| agenda_date | date | tanggal |
| agenda_time | time | jam (opsional) |
| location | text | tempat ketemu (opsional) |
| note | text | catatan (opsional) |
| who | text | pembuatnya |
| done | bool | sudah dijalani |
| created_at | timestamptz | default `now()` |

### Tabel `notes` (Papan Kangen)

| kolom | tipe | keterangan |
|---|---|---|
| id | uuid | primary key |
| list_code | text | filter |
| message | text | pesan singkat (maks 140 karakter di form) |
| who | text | `Dido & Novi` / `Dido` / `Novi` |
| created_at | timestamptz | default `now()` — dipakai urutkan & batasi 8 pesan terbaru |

Semua tabel: RLS aktif dengan policy `for all to anon using (true) with check (true)` (akses penuh pakai anon/publishable key — wajar untuk app privat tanpa sistem login, key-nya tidak pernah dipublikasikan di luar app).

## Konfigurasi

Semua konstanta yang sering diganti ada di **satu tempat**: [assets/js/app.js](assets/js/app.js).

```js
const ANNIVERSARY = '2025-09-01';      // tanggal jadian, format YYYY-MM-DD
const SUPABASE_URL = '...';             // project URL Supabase
const SUPABASE_ANON_KEY = '...';        // publishable/anon key Supabase
const LIST_CODE = 'kita-9f4b27e1a6c3';  // JANGAN diubah kecuali mau mulai data baru
```

**Ganti isi surat**: edit konstanta di bagian atas [assets/js/beranda.js](assets/js/beranda.js) — `SURAT_JUDUL`, `SURAT_PARAGRAF` (satu item array = satu paragraf), `SURAT_PENUTUP`, `SURAT_TTD`.

**Ganti ucapan hari jadi**: konstanta `ANNIV_UCAPAN` di [assets/js/beranda.js](assets/js/beranda.js) — kalimat yang muncul di kartu waktu tepat pada hari jadi.

**Ganti foto pasangan**: timpa `assets/img/couple.jpg` (rasio **persegi**, misal 800×800). Hero menampilkannya dalam kotak membulat dengan `object-fit: cover`, jadi potong dulu ke persegi supaya wajah tidak terpotong.

**Pratinjau hiasan hari jadi**: buka `index.html?anniv=1` untuk melihat tampilan hari jadi (badge, gradasi emas, confetti) kapan saja tanpa menunggu tanggalnya. Tanpa parameter itu, tampilan tetap normal.

**Ganti icon aplikasi**: timpa `assets/img/icon-192.png`, `icon-512.png`, dan versi `-maskable` (ukuran sama, PNG).

## Konvensi teknis (buat pengembangan lanjutan)

- **Alpine.js dari CDN**, `defer`. Setiap halaman punya file JS sendiri di `assets/js/` yang mendaftarkan komponennya lewat `document.addEventListener('alpine:init', () => Alpine.data('nama', () => ({...})))`. File ini **tanpa** `defer` dan harus di-load **sebelum** script Alpine core, supaya listener `alpine:init` sempat terpasang duluan. Urutan script yang benar di tiap halaman:
  ```html
  <script src=".../supabase.min.js"></script>   <!-- kalau butuh Supabase -->
  <script src="./assets/js/app.js"></script>      <!-- shared, selalu ada -->
  <script src="./assets/js/<halaman>.js"></script> <!-- komponen halaman ini -->
  <script src=".../alpinejs@3.x.x/cdn.min.js" defer></script> <!-- HARUS paling akhir -->
  ```
- **Supabase client** cukup satu instance (`getSupabaseClient()` di `app.js`, memoized) — jangan panggil `createClient()` sendiri di file lain, supaya tidak muncul warning "Multiple GoTrueClient instances".
- **Realtime**: tiap komponen yang butuh sinkron live subscribe ke `postgres_changes` lalu reload data (pola sederhana: reload penuh, bukan patch manual — cukup untuk skala data kecil app ini).
- **Status sync** ('syncing' | 'synced' | 'offline') dipakai di wishlist & cerita, styling-nya `.sync-pill`/`.sync-dot` di `app.css`.
- **Modal bottom-sheet**, **grid kalender**, dan **date-picker** semua CSS-nya di `app.css` (shared) — jangan duplikasi ulang di `<style>` per halaman. Kalender & date-picker sama-sama pakai `buildCalendarGrid(year, month, isMarkedFn)` dari `app.js`.
- **Transisi Alpine** (`x-transition:enter="..."`) pakai nama kelas custom (`modal-anim-*`, `sheet-anim-*`) yang didefinisikan manual di `app.css` — project ini **tanpa Tailwind**, jadi nama kelas seperti `opacity-0` TIDAK akan bekerja kecuali didefinisikan sendiri.
- **Identitas pemakai** disimpan di `localStorage` (`impian-kita:me` → `'Dido'` / `'Novi'`) lewat `getMe()`/`setMe()`/`getPasangan()` di `app.js`. Ini **bukan autentikasi** — cuma penanda lokal per-HP supaya Papan Kangen tahu siapa pengirimnya dan mana pesan dari pasangan. Jangan dipakai untuk hal yang butuh keamanan.
- **Penanda "sudah dibaca"** Papan Kangen (`impian-kita:papan-seen`) menyimpan `created_at` note terbaru, **bukan** jam HP — supaya tidak meleset kalau jam HP beda dengan jam server. Nilainya dibaca sekali saat init (snapshot) dan baru ditulis ulang 5 detik kemudian, supaya penanda "baru" tidak hilang sendiri saat pesannya sedang dibaca.

## PWA & Install

**Android (Chrome)**: menu (⋮) → **Install app** (atau banner otomatis).
**iOS (Safari — bukan Chrome)**: ikon **Share** → **Add to Home Screen**.

Service worker (`sw.js`) meng-cache app shell untuk offline. Setiap kali menambah file baru yang perlu offline, tambahkan ke `APP_SHELL` di `sw.js` **dan** naikkan `CACHE_VERSION` supaya user dapat versi baru.

> **Wajib: naikkan `CACHE_VERSION` setiap kali mengubah HTML/CSS/JS.** Kalau lupa, service worker akan terus menyajikan versi lama dari cache dan perubahanmu tidak akan kelihatan sama sekali di HP/PWA — walaupun sudah hard refresh.
>
> Saat install, service worker mengambil semua file dengan `cache: 'reload'` (lihat [sw.js](sw.js)) supaya melewati HTTP cache browser. Tanpa itu, menaikkan `CACHE_VERSION` pun masih bisa menyimpan file versi lama, karena browser/Apache menyajikan salinan lamanya.
>
> Kalau perubahan tetap tidak muncul: buka DevTools → Application → Service Workers → **Unregister**, lalu reload. Di HP, tutup penuh app PWA-nya lalu buka lagi dua kali.

## Menambah halaman baru

1. Salin `nikah.html` sebagai starting point (sudah ada meta PWA + bottom nav 5 item + script tags).
2. Kalau butuh Supabase, tambah script `supabase.min.js` + buat `assets/js/<nama>.js` sendiri (ikuti pola `alpine:init` di atas).
3. Tambahkan halaman baru ke `APP_SHELL` di `sw.js`, naikkan `CACHE_VERSION`.
4. Kalau jadi menu ke-6 di bottom nav: update `BOTTOM_NAV_ITEMS` di `app.js` **dan** tambahkan `<a>` item barunya secara manual di markup nav semua halaman (nav tidak di-generate dari array, karena tanpa build tool markup-nya memang diduplikasi per halaman — hanya logic active-state yang shared).

## Deploy (Vercel)

Situs ini **statis murni** — tidak ada build step. Setelan project di Vercel:

| Setelan | Nilai |
|---|---|
| Framework Preset | Other |
| Build Command | *(kosongkan)* |
| Output Directory | *(kosongkan — pakai root repo)* |
| Install Command | *(kosongkan)* |

[vercel.json](vercel.json) memaksa semua berkas **selalu divalidasi ulang** (`max-age=0, must-revalidate`). Ini disengaja: nama berkasnya tidak ber-hash (`app.js`, `app.css` tetap sama tiap versi), jadi kalau dicache lama, perubahan tidak akan pernah sampai ke HP kalian. Kecepatan & mode offline tetap ditangani service worker, bukan HTTP cache.

Alur update setelah live: ubah kode → **naikkan `CACHE_VERSION` di [sw.js](sw.js)** → commit → push. Vercel deploy otomatis.

### Subdomain lewat Cloudflare

DNS domain ada di Cloudflare. Tambahkan record: **CNAME** · nama `impian` · target `cname.vercel-dns.com`.

> **Proxy harus DNS only (awan abu-abu), bukan Proxied (awan oranye).**
> Kalau proxy menyala sementara mode SSL/TLS Cloudflare masih "Flexible", Cloudflare mengirim permintaan ke Vercel lewat HTTP, sedangkan Vercel selalu mengalihkan ke HTTPS — hasilnya *redirect loop* ("Too many redirects") dan situs tidak bisa dibuka. Dengan DNS only, Vercel yang menangani sertifikatnya sendiri dan semuanya beres.
> Kalau memang mau proxy tetap menyala, mode SSL/TLS Cloudflare wajib diubah ke **Full (strict)** lebih dulu.

## Catatan deploy

- Semua path pakai `./` (relatif) — aman untuk root domain maupun subfolder `/repo/` di GitHub Pages.
- `sw.js` harus tetap di root (bukan di dalam `assets/`) supaya scope-nya mencakup seluruh situs.
- Kredensial Supabase (`SUPABASE_ANON_KEY`) memang publik/terlihat di source — itu sudah wajar untuk anon/publishable key, keamanan datanya ditangani lewat Row Level Security (RLS) di Supabase, bukan dengan menyembunyikan key.
