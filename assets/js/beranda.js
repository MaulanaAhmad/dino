/* ==========================================================================
   Tempat Impian Kita — komponen Alpine untuk index.html (Beranda).
   Berisi: hero/counter hari jadi, Papan Kangen, Rencana Terdekat, Surat, Info.
   Memakai helper dari assets/js/app.js (shared). Script ini TANPA `defer`,
   harus load sebelum Alpine core supaya 'alpine:init' terpasang lebih dulu.
   ========================================================================== */

/* ---------------------------------------------------------------------------
   SURAT UNTUK PASANGANMU — ganti isinya dengan kata-katamu sendiri.
   Tiap item array = satu paragraf. Boleh ditambah/dikurangi sesukanya.
   --------------------------------------------------------------------------- */
const SURAT_JUDUL = 'Untuk Novi';
const SURAT_PARAGRAF = [
  'Hai sayang, selamat hari jadi kita yang pertama.',
  'Setahun ini rasanya cepat sekali, tapi kalau diingat-ingat lagi, banyak banget yang sudah kita lewati bareng. Ada hari-hari yang biasa saja, ada yang bikin ketawa sampai sakit perut, ada juga yang berat — dan semuanya jadi lebih ringan karena ada kamu.',
  'App kecil ini aku buat sendiri buat kita berdua. Isinya tempat-tempat yang pengen kita datangi, film yang pengen kita tonton, foto-foto kita, dan papan buat saling nitip pesan kalau lagi kangen. Anggap saja rumah kecil buat mimpi-mimpi kita.',
  'Terima kasih sudah mau jalan bareng aku sejauh ini. Semoga masih banyak tahun-tahun berikutnya yang bisa kita isi di sini.',
];
const SURAT_PENUTUP = 'Dengan sayang,';
const SURAT_TTD = 'Dido';

/* Ucapan yang muncul di kartu waktu tepat pada hari jadi — ganti sesukamu. */
const ANNIV_UCAPAN = 'Selamat hari jadi, sayang. Terima kasih untuk setahun ini 🤍';

const PAPAN_NOTE_LIMIT = 8;
const PAPAN_SEEN_KEY = 'impian-kita:papan-seen';
const RENCANA_LIMIT = 3;

/** Bikin daftar hati untuk animasi hujan hati pas hari jadi. */
function buildHearts(jumlah = 14) {
  const glyphs = ['♥', '♥', '♥', '❤', '🤍'];
  const colors = ['var(--rose-soft)', 'var(--rose)', 'var(--gold)', 'var(--blush)'];
  const hearts = [];
  for (let i = 0; i < jumlah; i++) {
    hearts.push({
      id: i,
      left: Math.round(Math.random() * 94) + 2,
      size: 12 + Math.round(Math.random() * 14),
      glyph: glyphs[Math.floor(Math.random() * glyphs.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 9 + Math.random() * 8,
      delay: Math.random() * 9,
    });
  }
  return hearts;
}

document.addEventListener('alpine:init', () => {
  /* --- Hero: counter hari jadi + dekorasi khusus pas hari jadi tahunan --- */
  Alpine.data('heroAnniversary', () => ({
    counterText: '',
    isAnniversary: false,
    years: 0,
    ucapan: ANNIV_UCAPAN,
    hearts: [],

    init() {
      this.hearts = buildHearts();
      this.counterText = formatAnniversaryCounter();
      this.years = getAnniversaryDiff(ANNIVERSARY).years;
      this.isAnniversary = isAnniversaryToday();

      // Mode pratinjau: buka index.html?anniv=1 untuk melihat tampilan hari jadi
      // kapan saja tanpa menunggu tanggalnya. Tidak mengganggu tampilan normal.
      const params = new URLSearchParams(location.search);
      if (params.get('anniv') === '1') {
        this.isAnniversary = true;
        if (this.years < 1) {
          this.years = 1;
          this.counterText = '1 tahun';
        }
      }
    },

    get anniversaryLabel() {
      return `Hari Jadi ke-${this.years}`;
    },
  }));

  /* --- Surat: amplop yang diketuk lalu menampilkan pesan --- */
  Alpine.data('surat', () => ({
    open: false,
    judul: SURAT_JUDUL,
    paragraf: SURAT_PARAGRAF,
    penutup: SURAT_PENUTUP,
    ttd: SURAT_TTD,

    openLetter() {
      this.open = true;
    },

    closeLetter() {
      this.open = false;
    },
  }));

  /* --- Rencana terdekat: ambil wishlist ber-visit_date yang belum lewat --- */
  Alpine.data('rencanaTerdekat', () => ({
    items: [],
    loaded: false,
    errorMessage: '',
    channel: null,

    async init() {
      await this.loadRencana();
      this.subscribeRealtime();
    },

    async loadRencana() {
      this.errorMessage = '';
      try {
        const supabase = getSupabaseClient();
        const today = toDateStr(new Date());

        const [hasilPlaces, hasilAgenda] = await Promise.all([
          supabase
            .from('places')
            .select('*')
            .eq('list_code', LIST_CODE)
            .eq('visited', false)
            .not('visit_date', 'is', null)
            .gte('visit_date', today)
            .order('visit_date', { ascending: true })
            .limit(RENCANA_LIMIT),
          supabase
            .from('agenda')
            .select('*')
            .eq('list_code', LIST_CODE)
            .eq('done', false)
            .gte('agenda_date', today)
            .order('agenda_date', { ascending: true })
            .limit(RENCANA_LIMIT),
        ]);

        if (hasilPlaces.error) throw hasilPlaces.error;

        // Agenda & wishlist disatukan lalu diurutkan bareng, diambil yang terdekat.
        // Tabel agenda opsional — kalau belum dibuat, Beranda tetap jalan.
        const dariWishlist = (hasilPlaces.data || []).map((p) => ({
          id: p.id,
          jenis: p.item_type === 'film' ? 'film' : 'tempat',
          nama: p.name,
          lokasi: p.location,
          tanggal: p.visit_date,
        }));

        if (hasilAgenda.error) {
          console.warn('Agenda tidak bisa dimuat:', hasilAgenda.error.message);
        }
        // Agenda tidak punya lokasi — jamnya yang lebih berguna ditampilkan.
        const dariAgenda = (hasilAgenda.data || []).map((a) => ({
          id: a.id,
          jenis: 'agenda',
          nama: a.title,
          lokasi: a.agenda_time ? a.agenda_time.slice(0, 5).replace(':', '.') : '',
          tanggal: a.agenda_date,
        }));

        this.items = [...dariAgenda, ...dariWishlist]
          .sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0))
          .slice(0, RENCANA_LIMIT);
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal memuat rencana terdekat.';
      } finally {
        this.loaded = true;
      }
    },

    subscribeRealtime() {
      try {
        const supabase = getSupabaseClient();
        this.channel = supabase
          .channel('places-beranda')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter: `list_code=eq.${LIST_CODE}` }, () => {
            this.loadRencana();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda', filter: `list_code=eq.${LIST_CODE}` }, () => {
            this.loadRencana();
          })
          .subscribe();
      } catch (err) {
        console.error(err);
      }
    },

    countdownLabel(item) {
      return daysUntilLabel(item.tanggal);
    },

    isSoon(item) {
      return daysUntil(item.tanggal) <= 3;
    },

    ikonLokasi(item) {
      if (item.jenis === 'film') return '📺';
      if (item.jenis === 'agenda') return '🕘';
      return '📍';
    },
  }));

  /* --- Papan Kangen: sticky notes pesan singkat --- */
  Alpine.data('papan', () => ({
    notes: [],
    modalOpen: false,
    errorMessage: '',
    channel: null,
    form: { message: '' },

    me: '',
    // Snapshot waktu "terakhir dilihat" diambil sekali saat init dan TIDAK berubah
    // selama sesi ini — supaya penanda "baru" tidak hilang sendiri saat sedang dibaca.
    seenAt: '',
    seenTimer: null,
    confirmDelete: null,

    async init() {
      this.me = getMe();
      this.seenAt = this.loadSeenAt();
      await this.loadNotes();
      this.subscribeRealtime();
    },

    /* ---- identitas ---- */

    get pasangan() {
      return getPasangan(this.me);
    },

    pilihIdentitas(nama) {
      this.me = nama;
      setMe(nama);
    },

    gantiIdentitas() {
      this.me = '';
      setMe('');
    },

    /* ---- penanda pesan baru ---- */

    loadSeenAt() {
      try {
        return localStorage.getItem(PAPAN_SEEN_KEY) || '';
      } catch (err) {
        return '';
      }
    },

    /** Pesan dianggap baru kalau ditulis pasangan DAN lebih baru dari kunjungan terakhir. */
    isNew(note) {
      if (!this.me) return false;
      if (note.who === this.me) return false;
      if (!this.seenAt) return true;
      return new Date(note.created_at) > new Date(this.seenAt);
    },

    get jumlahBaru() {
      return this.notes.filter((n) => this.isNew(n)).length;
    },

    /**
     * Tandai sudah dibaca memakai created_at note terbaru (bukan jam HP),
     * supaya tidak meleset kalau jam HP dan jam server beda.
     * Ditunda sebentar biar penandanya sempat terlihat dulu.
     */
    scheduleMarkSeen() {
      if (!this.notes.length) return;
      const terbaru = this.notes[0].created_at;
      clearTimeout(this.seenTimer);
      this.seenTimer = setTimeout(() => {
        try {
          localStorage.setItem(PAPAN_SEEN_KEY, terbaru);
        } catch (err) {
          console.warn('Tidak bisa menyimpan penanda dibaca:', err);
        }
      }, 5000);
    },

    waktuNote(note) {
      return timeAgo(note.created_at);
    },

    async loadNotes() {
      this.errorMessage = '';
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('list_code', LIST_CODE)
          .order('created_at', { ascending: false })
          .limit(PAPAN_NOTE_LIMIT);

        if (error) throw error;
        this.notes = data || [];
        this.scheduleMarkSeen();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal memuat papan kangen.';
      }
    },

    subscribeRealtime() {
      try {
        const supabase = getSupabaseClient();
        this.channel = supabase
          .channel('notes-papan')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `list_code=eq.${LIST_CODE}` }, () => {
            this.loadNotes();
          })
          .subscribe();
      } catch (err) {
        console.error(err);
      }
    },

    openAddModal() {
      this.errorMessage = '';
      this.form = { message: '' };
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
    },

    async submitNote() {
      const message = this.form.message.trim();
      if (!message || !this.me) return;

      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('notes').insert({
          list_code: LIST_CODE,
          message,
          who: this.me,
        });
        if (error) throw error;

        this.closeModal();
        await this.loadNotes();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal mengirim pesan. (' + (err.message || err) + ')';
      }
    },

    /* ---- hapus (pakai modal clay, bukan confirm() bawaan browser) ---- */

    mintaHapus(note) {
      this.confirmDelete = note;
    },

    batalHapus() {
      this.confirmDelete = null;
    },

    async hapusTerkonfirmasi() {
      const note = this.confirmDelete;
      this.confirmDelete = null;
      if (!note) return;
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('notes').delete().eq('id', note.id);
        if (error) throw error;
        await this.loadNotes();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal menghapus pesan.';
      }
    },
  }));

  /* --- Info aplikasi: modal clay (pengganti alert() bawaan browser) --- */
  Alpine.data('infoApp', () => ({
    open: false,
  }));
});
