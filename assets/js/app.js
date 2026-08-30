/* ==========================================================================
   Tempat Impian Kita — util bersama, dipakai di semua halaman.
   Registrasi Alpine.data() bersama harus load SEBELUM script Alpine core
   (script ini tanpa `defer`, Alpine core pakai `defer`), supaya event
   'alpine:init' sempat ditangkap sebelum Alpine mulai memindai DOM.
   ========================================================================== */

// Ganti tanggal jadian di sini (format YYYY-MM-DD).
const ANNIVERSARY = '2025-09-01';

// --- Konfigurasi Supabase bersama (dipakai wishlist.html & kalender.html) ---
const SUPABASE_URL = 'https://bakaiqbjrezxqgmeqdiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJha2FpcWJqcmV6eHFnbWVxZGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Mzc4NjksImV4cCI6MjA5NjQxMzg2OX0.h8hQBKK5OACEHnRfbNnxsKnI9gup8J8uyd4tqkRhJ3I';
// Kode list yang sudah dipakai di data lama — JANGAN diubah kecuali kamu memang mau mulai list baru.
const LIST_CODE = 'kita-9f4b27e1a6c3';

let _supabaseClient = null;

/** Satu instance Supabase client dipakai bersama, biar tidak ada warning "Multiple GoTrueClient instances". */
function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Library Supabase belum termuat (cek koneksi internet / CDN).');
  }
  _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabaseClient;
}

/**
 * Hitung selisih ANNIVERSARY -> sekarang dalam tahun, bulan, hari kalender
 * (bukan cuma total hari), supaya "2 tahun 3 bulan 10 hari" akurat.
 */
function getAnniversaryDiff(fromDateStr) {
  const start = new Date(fromDateStr + 'T00:00:00');
  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));

  return { years, months, days, totalDays };
}

/** Teks counter "X tahun Y bulan Z hari" (bagian nol dilewati, kecuali hari). */
function formatAnniversaryCounter(dateStr = ANNIVERSARY) {
  const { years, months, days } = getAnniversaryDiff(dateStr);
  const parts = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  parts.push(`${days} hari`);
  return parts.join(' ');
}

/**
 * true kalau HARI INI tepat hari jadi tahunan — tanggal & bulan sama dengan
 * ANNIVERSARY, dan sudah lewat minimal satu tahun (hari pertama jadian sendiri
 * bukan "hari jadi ke-0").
 */
function isAnniversaryToday(dateStr = ANNIVERSARY) {
  const start = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const sameDay = now.getMonth() === start.getMonth() && now.getDate() === start.getDate();
  return sameDay && getAnniversaryDiff(dateStr).years >= 1;
}

/** Selisih hari dari hari ini ke `dateStr` (negatif = sudah lewat). */
function daysUntil(dateStr) {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

/** "Hari ini" / "Besok" / "3 hari lagi" — label ramah untuk hitung mundur. */
function daysUntilLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === 0) return 'Hari ini';
  if (d === 1) return 'Besok';
  if (d < 0) return `${Math.abs(d)} hari lalu`;
  return `${d} hari lagi`;
}

/** Format 'YYYY-MM-DD' -> "9 Juli 2026" (lokal Indonesia, tanpa dependency). */
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatDateID(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${BULAN_ID[m - 1]} ${y}`;
}

/** Date -> 'YYYY-MM-DD' pakai bagian tanggal lokal (bukan UTC), biar tidak geser sehari. */
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Bangun grid kalender 1 bulan (leading/trailing hari dari bulan sebelah,
 * total kelipatan 7 sel). Dipakai kalender.html (dot indicator) & date-picker
 * custom di wishlist/cerita (tanpa dot).
 * `isMarkedFn(dateStr)` opsional -> dipakai untuk menandai `hasEvents`.
 */
function buildCalendarGrid(year, month, isMarkedFn) {
  const today = toDateStr(new Date());
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const buildCell = (dateObj, inMonth) => {
    const dateStr = toDateStr(dateObj);
    return {
      dateStr,
      day: dateObj.getDate(),
      inMonth,
      isToday: dateStr === today,
      hasEvents: isMarkedFn ? !!isMarkedFn(dateStr) : false,
    };
  };

  const cells = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push(buildCell(new Date(year, month - 1, daysInPrevMonth - i), false));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(buildCell(new Date(year, month, day), true));
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push(buildCell(new Date(year, month + 1, nextDay), false));
    nextDay++;
  }
  return cells;
}

/* --------------------------------------------------------------------------
   Identitas pemakai ("aku ini Dido" / "aku ini Novi").
   Disimpan di localStorage HP masing-masing — app ini tanpa login, jadi ini
   cuma penanda lokal, bukan autentikasi. Dipakai Papan Kangen untuk mengisi
   pengirim otomatis & mendeteksi pesan baru dari pasangan.
   -------------------------------------------------------------------------- */
const PASANGAN = ['Dido', 'Novi'];
const STORAGE_ME = 'impian-kita:me';

function getMe() {
  try {
    return localStorage.getItem(STORAGE_ME) || '';
  } catch (err) {
    return '';
  }
}

function setMe(nama) {
  try {
    localStorage.setItem(STORAGE_ME, nama);
  } catch (err) {
    console.warn('Tidak bisa menyimpan identitas:', err);
  }
}

/** Nama pasangan dari sudut pandang `me` — dipakai untuk label "dari ...". */
function getPasangan(me = getMe()) {
  return PASANGAN.find((n) => n !== me) || '';
}

/** Timestamp ISO -> "baru saja" / "5 menit lalu" / "2 jam lalu" / "kemarin" / tanggal. */
function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (isNaN(then)) return '';

  const detik = Math.floor((Date.now() - then.getTime()) / 1000);
  if (detik < 60) return 'baru saja';

  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;

  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;

  const hari = Math.floor(jam / 24);
  if (hari === 1) return 'kemarin';
  if (hari < 7) return `${hari} hari lalu`;
  if (hari < 30) return `${Math.floor(hari / 7)} minggu lalu`;

  return formatDateID(toDateStr(then));
}

/** Daftarkan service worker (path relatif supaya aman di subfolder GitHub Pages). */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Gagal mendaftarkan service worker:', err);
    });
  });
}

// --- Bottom navigation, dipakai semua halaman lewat x-data="bottomNav" ---
const BOTTOM_NAV_ITEMS = [
  { href: 'index.html', label: 'Beranda' },
  { href: 'kalender.html', label: 'Kalender' },
  { href: 'cerita.html', label: 'Cerita' },
  { href: 'wishlist.html', label: 'Wishlist' },
  { href: 'nikah.html', label: 'Nikah' },
];

document.addEventListener('alpine:init', () => {
  Alpine.data('bottomNav', () => ({
    current: (location.pathname.split('/').pop() || 'index.html'),
    items: BOTTOM_NAV_ITEMS,
    isActive(href) {
      return href === this.current;
    },
  }));
});

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
});
