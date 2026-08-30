/* ==========================================================================
   Tempat Impian Kita — komponen Alpine untuk wishlist.html.
   Memakai getSupabaseClient()/LIST_CODE dari assets/js/app.js (shared).
   Script ini TANPA `defer` dan harus load sebelum Alpine core, supaya
   listener 'alpine:init' di bawah sempat terpasang sebelum Alpine start.
   ========================================================================== */

const CATEGORY_OPTIONS = {
  tempat: ['Wisata', 'Kuliner', 'Staycation', 'Lainnya'],
  film: ['Action', 'Drama', 'Komedi', 'Horror', 'Animasi', 'Dokumenter', 'Lainnya'],
};

const WISHLIST_TAB_KEY = 'impian-kita:wishlist-tab';

document.addEventListener('alpine:init', () => {
  Alpine.data('wishlist', () => ({
    places: [],
    filter: 'all',
    activeType: 'tempat', // 'tempat' | 'film'
    syncStatus: 'syncing', // 'syncing' | 'synced' | 'offline'
    modalOpen: false,
    editingId: null,
    editingHadDate: false,
    confirmDelete: null,
    me: '',
    form: { name: '', category: 'Wisata', who: 'Dido & Novi', location: '', note: '', visit_date: '', item_type: 'tempat' },
    channel: null,
    errorMessage: '',

    // --- Date-picker custom untuk field "Rencana tanggal" ---
    datePickerOpen: false,
    datePickerViewYear: new Date().getFullYear(),
    datePickerViewMonth: new Date().getMonth(),

    async init() {
      this.me = getMe();
      this.activeType = this.loadTab();
      await this.loadPlaces();
      this.subscribeRealtime();
      window.addEventListener('online', () => this.loadPlaces());
      window.addEventListener('offline', () => { this.syncStatus = 'offline'; });

      // Datang dari Kalender lewat "Rencanakan sesuatu":
      // wishlist.html?tambah=1&tanggal=YYYY-MM-DD -> form langsung terbuka & tanggal terisi.
      const params = new URLSearchParams(location.search);
      if (params.get('tambah') === '1') {
        this.openAddModal();
        const tanggal = params.get('tanggal');
        if (tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
          this.form.visit_date = tanggal;
        }
      }
    },

    get filteredPlaces() {
      const hasil = this.places.filter((p) => {
        if ((p.item_type || 'tempat') !== this.activeType) return false;
        if (this.filter === 'pending') return !p.visited;
        if (this.filter === 'done') return p.visited;
        return true;
      });

      // Urutan: yang belum selesai dulu, lalu yang punya rencana tanggal
      // terdekat, baru sisanya. Yang sudah dijalani turun ke bawah.
      return hasil.sort((a, b) => {
        if (!!a.visited !== !!b.visited) return a.visited ? 1 : -1;
        if (a.visit_date && b.visit_date) return a.visit_date < b.visit_date ? -1 : 1;
        if (a.visit_date) return -1;
        if (b.visit_date) return 1;
        return 0;
      });
    },

    /** "4 tempat · 1 sudah dikunjungi" — ringkasan tab yang sedang dibuka. */
    get ringkasanTeks() {
      const semua = this.places.filter((p) => (p.item_type || 'tempat') === this.activeType);
      if (!semua.length) return '';
      const selesai = semua.filter((p) => p.visited).length;
      const satuan = this.isFilmTab ? 'film' : 'tempat';
      const kata = this.isFilmTab ? 'sudah ditonton' : 'sudah dikunjungi';
      return selesai ? `${semua.length} ${satuan} · ${selesai} ${kata}` : `${semua.length} ${satuan}`;
    },

    get categoryOptions() {
      return CATEGORY_OPTIONS[this.form.item_type] || CATEGORY_OPTIONS.tempat;
    },

    get isFilmTab() {
      return this.activeType === 'film';
    },

    get locationLabel() {
      return this.form.item_type === 'film' ? 'Platform (opsional)' : 'Lokasi (opsional)';
    },

    get locationPlaceholder() {
      return this.form.item_type === 'film' ? 'Contoh: Netflix, Bioskop' : 'Contoh: Banyuwangi, Jawa Timur';
    },

    get visitDateLabel() {
      return this.form.item_type === 'film' ? 'Rencana nonton (opsional)' : 'Rencana tanggal (opsional)';
    },

    get emptyStateText() {
      return this.activeType === 'film'
        ? 'Belum ada film di daftar ini. Ketuk + untuk menambah 🍿'
        : 'Belum ada tempat di daftar ini. Ketuk + untuk menambah 🤍';
    },

    /* ---- tab terakhir diingat, biar tidak balik ke "Tempat" terus ---- */

    loadTab() {
      try {
        const t = localStorage.getItem(WISHLIST_TAB_KEY);
        return t === 'film' || t === 'tempat' ? t : 'tempat';
      } catch (err) {
        return 'tempat';
      }
    },

    setActiveType(type) {
      this.activeType = type;
      try {
        localStorage.setItem(WISHLIST_TAB_KEY, type);
      } catch (err) {
        console.warn('Tidak bisa menyimpan pilihan tab:', err);
      }
    },

    /** Tautan ke Kalender untuk item yang punya rencana tanggal. */
    kalenderUrl(place) {
      return `./kalender.html?tanggal=${place.visit_date}`;
    },

    get statusLabel() {
      return { syncing: 'Menyinkronkan...', synced: 'Tersinkron', offline: 'Offline' }[this.syncStatus];
    },

    get datePickerLabel() {
      return this.form.visit_date ? formatDateID(this.form.visit_date) : 'Pilih tanggal';
    },

    get datePickerDays() {
      return buildCalendarGrid(this.datePickerViewYear, this.datePickerViewMonth);
    },

    async loadPlaces() {
      if (!navigator.onLine) {
        this.syncStatus = 'offline';
        return;
      }
      this.syncStatus = 'syncing';
      this.errorMessage = '';
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('places')
          .select('*')
          .eq('list_code', LIST_CODE)
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.places = data || [];
        this.syncStatus = 'synced';
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal memuat data. (' + (err.message || err) + ')';
        this.syncStatus = 'offline';
      }
    },

    subscribeRealtime() {
      try {
        const supabase = getSupabaseClient();
        this.channel = supabase
          .channel('places-wishlist')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter: `list_code=eq.${LIST_CODE}` }, (payload) => {
            this.applyRealtimeChange(payload);
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') this.syncStatus = 'synced';
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') this.syncStatus = 'offline';
          });
      } catch (err) {
        console.error(err);
      }
    },

    applyRealtimeChange(payload) {
      if (payload.eventType === 'INSERT') {
        if (!this.places.some((p) => p.id === payload.new.id)) this.places.unshift(payload.new);
      } else if (payload.eventType === 'UPDATE') {
        this.places = this.places.map((p) => (p.id === payload.new.id ? payload.new : p));
      } else if (payload.eventType === 'DELETE') {
        this.places = this.places.filter((p) => p.id !== payload.old.id);
      }
    },

    openAddModal() {
      this.editingId = null;
      this.editingHadDate = false;
      this.errorMessage = '';
      this.datePickerOpen = false;
      const type = this.activeType;
      // Default "yang pengen ke sana" mengikuti identitas di HP ini. Tetap bisa
      // diubah, karena di sini pilihannya memang bermakna (bisa kamu, dia, atau berdua).
      this.form = {
        name: '',
        category: CATEGORY_OPTIONS[type][0],
        who: this.me || 'Dido & Novi',
        location: '',
        note: '',
        visit_date: '',
        item_type: type,
      };
      this.modalOpen = true;
    },

    openEditModal(place) {
      this.editingId = place.id;
      this.errorMessage = '';
      this.datePickerOpen = false;
      const type = place.item_type || 'tempat';
      // Dipakai submitForm() untuk tahu apakah perlu kirim visit_date: null (menghapus
      // tanggal) — hanya kalau kolomnya memang sudah pernah terisi sebelumnya.
      this.editingHadDate = !!place.visit_date;
      this.form = {
        name: place.name || '',
        category: place.category || CATEGORY_OPTIONS[type][0],
        who: place.who || 'Dido & Novi',
        location: place.location || '',
        note: place.note || '',
        visit_date: place.visit_date || '',
        item_type: type,
      };
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
      this.datePickerOpen = false;
    },

    openDatePicker() {
      const base = this.form.visit_date ? new Date(this.form.visit_date + 'T00:00:00') : new Date();
      this.datePickerViewYear = base.getFullYear();
      this.datePickerViewMonth = base.getMonth();
      this.datePickerOpen = !this.datePickerOpen;
    },

    datePickerPrevMonth() {
      this.datePickerViewMonth -= 1;
      if (this.datePickerViewMonth < 0) {
        this.datePickerViewMonth = 11;
        this.datePickerViewYear -= 1;
      }
    },

    datePickerNextMonth() {
      this.datePickerViewMonth += 1;
      if (this.datePickerViewMonth > 11) {
        this.datePickerViewMonth = 0;
        this.datePickerViewYear += 1;
      }
    },

    pickDate(dateStr) {
      this.form.visit_date = dateStr;
      this.datePickerOpen = false;
    },

    clearDate() {
      this.form.visit_date = '';
      this.datePickerOpen = false;
    },

    async submitForm() {
      const name = this.form.name.trim();
      if (!name) return;

      const payload = {
        name,
        category: this.form.category,
        who: this.form.who,
        location: this.form.location.trim(),
        note: this.form.note.trim(),
        list_code: LIST_CODE,
      };
      // Hanya kirim `visit_date` kalau memang perlu (diisi, atau menghapus tanggal
      // yang sebelumnya ada) — supaya form tetap jalan normal buat yang belum
      // menjalankan migration SQL kolom ini.
      if (this.form.visit_date) {
        payload.visit_date = this.form.visit_date;
      } else if (this.editingId && this.editingHadDate) {
        payload.visit_date = null;
      }
      // Sama seperti visit_date: `item_type` cuma dikirim untuk item Film, supaya
      // tab Tempat tetap jalan normal sebelum migration kolom `item_type` dijalankan.
      if (this.form.item_type === 'film') {
        payload.item_type = 'film';
      }

      this.syncStatus = 'syncing';
      try {
        const supabase = getSupabaseClient();
        const query = this.editingId
          ? supabase.from('places').update(payload).eq('id', this.editingId)
          : supabase.from('places').insert({ ...payload, visited: false });

        const { error } = await query;
        if (error) throw error;

        this.closeModal();
        await this.loadPlaces();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal menyimpan data. (' + (err.message || err) + ')';
        this.syncStatus = 'offline';
      }
    },

    async toggleVisited(place) {
      this.syncStatus = 'syncing';
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('places').update({ visited: !place.visited }).eq('id', place.id);
        if (error) throw error;
        await this.loadPlaces();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Terjadi kesalahan. (' + (err.message || err) + ')';
        this.syncStatus = 'offline';
      }
    },

    /* ---- hapus (modal clay, bukan confirm() bawaan browser) ---- */

    mintaHapus(place) {
      this.confirmDelete = place;
    },

    batalHapus() {
      this.confirmDelete = null;
    },

    async hapusTerkonfirmasi() {
      const place = this.confirmDelete;
      this.confirmDelete = null;
      if (!place) return;

      this.syncStatus = 'syncing';
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('places').delete().eq('id', place.id);
        if (error) throw error;
        await this.loadPlaces();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal menghapus data. (' + (err.message || err) + ')';
        this.syncStatus = 'offline';
      }
    },
  }));
});
