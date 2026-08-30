/* ==========================================================================
   Tempat Impian Kita — komponen Alpine untuk kalender.html.

   Kalender ini linimasa DUA ARAH:
     - ke depan : rencana dari wishlist (`places.visit_date`)
     - ke belakang: kenangan dari Cerita (`moments.moment_date`)
     - plus hari jadi tahunan, dihitung otomatis dari ANNIVERSARY
   Semua sumber digabung jadi satu peta `eventsByDate`.

   Memakai helper dari assets/js/app.js (shared). Script ini TANPA `defer`,
   harus load sebelum Alpine core supaya 'alpine:init' terpasang lebih dulu.
   ========================================================================== */

document.addEventListener('alpine:init', () => {
  Alpine.data('calendar', () => ({
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(), // 0-11
    places: [],
    moments: [],
    agenda: [],
    selectedDate: null,
    loading: true,
    errorMessage: '',
    channels: [],

    // --- Agenda: rencana kencan bertanggal, terpisah dari wishlist ---
    me: '',
    agendaModalOpen: false,
    agendaEditingId: null,
    agendaError: '',
    agendaForm: { title: '', agenda_time: '', note: '' },
    confirmDeleteAgenda: null,

    async init() {
      this.me = getMe();
      await this.loadAll();
      this.subscribeRealtime();

      // Datang dari Wishlist lewat tanggal rencana: kalender.html?tanggal=YYYY-MM-DD
      // -> langsung buka bulan & pilih tanggalnya.
      const diminta = new URLSearchParams(location.search).get('tanggal');
      if (diminta && /^\d{4}-\d{2}-\d{2}$/.test(diminta)) {
        const d = new Date(diminta + 'T00:00:00');
        this.viewYear = d.getFullYear();
        this.viewMonth = d.getMonth();
        this.selectedDate = diminta;
        return;
      }

      // Kalau hari ini ada isinya, langsung pilih — biar halaman tidak terasa kosong.
      const hariIni = toDateStr(new Date());
      if ((this.eventsByDate[hariIni] || []).length || this.isAnniversaryDate(hariIni)) {
        this.selectedDate = hariIni;
      }
    },

    /* ---------- label & ringkasan ---------- */

    get monthLabel() {
      return `${BULAN_ID[this.viewMonth]} ${this.viewYear}`;
    },

    get ringkasanBulan() {
      let agenda = 0;
      let rencana = 0;
      let kenangan = 0;
      for (const cell of this.calendarDays) {
        if (!cell.inMonth) continue;
        for (const ev of this.eventsByDate[cell.dateStr] || []) {
          if (ev.kind === 'agenda') agenda += 1;
          else if (ev.kind === 'momen') kenangan += 1;
          else rencana += 1;
        }
      }
      return { agenda, rencana, kenangan };
    },

    get ringkasanTeks() {
      const { agenda, rencana, kenangan } = this.ringkasanBulan;
      const bagian = [];
      if (agenda) bagian.push(`${agenda} agenda`);
      if (rencana) bagian.push(`${rencana} rencana`);
      if (kenangan) bagian.push(`${kenangan} kenangan`);
      return bagian.length ? bagian.join(' · ') : 'Belum ada apa-apa di bulan ini';
    },

    /* ---------- gabungan semua sumber ---------- */

    get eventsByDate() {
      const map = {};
      const tambah = (tanggal, item) => {
        if (!tanggal) return;
        if (!map[tanggal]) map[tanggal] = [];
        map[tanggal].push(item);
      };

      // Agenda ditaruh paling awal karena ini rencana pasti, bukan sekadar keinginan.
      for (const a of this.agenda) {
        tambah(a.agenda_date, { kind: 'agenda', data: a });
      }
      for (const p of this.places) {
        tambah(p.visit_date, { kind: p.item_type === 'film' ? 'film' : 'tempat', data: p });
      }
      for (const m of this.moments) {
        tambah(m.moment_date, { kind: 'momen', data: m });
      }
      return map;
    },

    /** Apakah tanggal ini hari jadi tahunan (tanggal & bulan sama, tahun sudah lewat)? */
    isAnniversaryDate(dateStr) {
      if (!dateStr) return false;
      const mulai = new Date(ANNIVERSARY + 'T00:00:00');
      const d = new Date(dateStr + 'T00:00:00');
      return (
        d.getMonth() === mulai.getMonth() &&
        d.getDate() === mulai.getDate() &&
        d.getFullYear() > mulai.getFullYear()
      );
    },

    anniversaryKe(dateStr) {
      const mulai = new Date(ANNIVERSARY + 'T00:00:00');
      return new Date(dateStr + 'T00:00:00').getFullYear() - mulai.getFullYear();
    },

    get calendarDays() {
      const ev = this.eventsByDate;
      return buildCalendarGrid(this.viewYear, this.viewMonth).map((cell) => {
        const items = ev[cell.dateStr] || [];
        // Maksimal 3 titik supaya sel tidak penuh; jenisnya diurutkan konsisten.
        const urutan = ['agenda', 'tempat', 'film', 'momen'];
        const jenis = urutan.filter((k) => items.some((i) => i.kind === k)).slice(0, 3);
        return {
          ...cell,
          dots: jenis,
          jumlah: items.length,
          isAnniv: this.isAnniversaryDate(cell.dateStr),
        };
      });
    },

    /* ---------- tanggal terpilih ---------- */

    get selectedEvents() {
      if (!this.selectedDate) return [];
      return this.eventsByDate[this.selectedDate] || [];
    },

    get selectedIsAnniv() {
      return this.isAnniversaryDate(this.selectedDate);
    },

    get selectedDateLabel() {
      return this.selectedDate ? formatDateID(this.selectedDate) : '';
    },

    /** true kalau tanggal dipilih tapi memang tidak ada apa-apa di sana. */
    get selectedKosong() {
      return !!this.selectedDate && !this.selectedEvents.length && !this.selectedIsAnniv;
    },

    /** Link ke wishlist dengan form tambah langsung terbuka & tanggal terisi. */
    get tambahRencanaUrl() {
      return `./wishlist.html?tambah=1&tanggal=${this.selectedDate}`;
    },

    isPast(dateStr) {
      return daysUntil(dateStr) < 0;
    },

    /** Rencana diredupkan kalau sudah dijalani, atau tanggalnya sudah lewat. */
    isRedup(ev) {
      if (ev.kind === 'momen') return false;
      const selesai = ev.kind === 'agenda' ? ev.data.done : ev.data.visited;
      return !!selesai || this.isPast(this.selectedDate);
    },

    countdownLabel(dateStr) {
      return daysUntilLabel(dateStr);
    },

    /* ---------- navigasi ---------- */

    prevMonth() {
      this.viewMonth -= 1;
      if (this.viewMonth < 0) {
        this.viewMonth = 11;
        this.viewYear -= 1;
      }
    },

    nextMonth() {
      this.viewMonth += 1;
      if (this.viewMonth > 11) {
        this.viewMonth = 0;
        this.viewYear += 1;
      }
    },

    goToday() {
      const now = new Date();
      this.viewYear = now.getFullYear();
      this.viewMonth = now.getMonth();
      this.selectedDate = toDateStr(now);
    },

    get sedangDiBulanIni() {
      const now = new Date();
      return this.viewYear === now.getFullYear() && this.viewMonth === now.getMonth();
    },

    selectDate(dateStr) {
      this.selectedDate = dateStr;
    },

    /* ---------- agenda: rencana kencan bertanggal ---------- */

    /** Jam disimpan sebagai "HH:MM:SS", ditampilkan "19.30". */
    jamLabel(item) {
      if (!item.agenda_time) return '';
      const [jam, menit] = item.agenda_time.split(':');
      return `${jam}.${menit}`;
    },

    bukaAgendaBaru() {
      this.agendaEditingId = null;
      this.agendaError = '';
      this.agendaForm = { title: '', agenda_time: '', note: '' };
      this.agendaModalOpen = true;
    },

    bukaAgendaEdit(item) {
      this.agendaEditingId = item.id;
      this.agendaError = '';
      this.agendaForm = {
        title: item.title || '',
        agenda_time: item.agenda_time ? item.agenda_time.slice(0, 5) : '',
        note: item.note || '',
      };
      this.agendaModalOpen = true;
    },

    tutupAgendaModal() {
      this.agendaModalOpen = false;
    },

    async simpanAgenda() {
      const title = this.agendaForm.title.trim();
      if (!title) {
        this.agendaError = 'Isi dulu mau ke mana atau ngapain.';
        return;
      }
      if (!this.selectedDate) return;

      const payload = {
        title,
        agenda_date: this.selectedDate,
        agenda_time: this.agendaForm.agenda_time || null,
        note: this.agendaForm.note.trim(),
      };

      this.agendaError = '';
      try {
        const supabase = getSupabaseClient();
        const { error } = this.agendaEditingId
          ? await supabase.from('agenda').update(payload).eq('id', this.agendaEditingId)
          : await supabase.from('agenda').insert({ ...payload, list_code: LIST_CODE, who: this.me || 'Dido & Novi' });
        if (error) throw error;

        this.tutupAgendaModal();
        await this.loadAll();
      } catch (err) {
        console.error(err);
        this.agendaError = 'Gagal menyimpan agenda. (' + (err.message || err) + ')';
      }
    },

    async toggleAgendaSelesai(item) {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('agenda').update({ done: !item.done }).eq('id', item.id);
        if (error) throw error;
        await this.loadAll();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Terjadi kesalahan. (' + (err.message || err) + ')';
      }
    },

    mintaHapusAgenda(item) {
      this.confirmDeleteAgenda = item;
    },

    batalHapusAgenda() {
      this.confirmDeleteAgenda = null;
    },

    async hapusAgendaTerkonfirmasi() {
      const item = this.confirmDeleteAgenda;
      this.confirmDeleteAgenda = null;
      if (!item) return;
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('agenda').delete().eq('id', item.id);
        if (error) throw error;
        await this.loadAll();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal menghapus agenda. (' + (err.message || err) + ')';
      }
    },

    /* ---------- data ---------- */

    async loadAll() {
      this.loading = true;
      this.errorMessage = '';
      try {
        const supabase = getSupabaseClient();
        const [hasilPlaces, hasilMoments, hasilAgenda] = await Promise.all([
          supabase.from('places').select('*').eq('list_code', LIST_CODE).not('visit_date', 'is', null),
          supabase.from('moments').select('*').eq('list_code', LIST_CODE).not('moment_date', 'is', null),
          supabase.from('agenda').select('*').eq('list_code', LIST_CODE).order('agenda_time', { ascending: true }),
        ]);

        if (hasilPlaces.error) throw hasilPlaces.error;
        this.places = hasilPlaces.data || [];

        // Cerita & agenda opsional: kalau tabelnya belum ada, kalender tetap jalan
        // menampilkan sisanya, tidak ikut gagal total.
        if (hasilMoments.error) {
          console.warn('Momen tidak bisa dimuat:', hasilMoments.error.message);
          this.moments = [];
        } else {
          this.moments = hasilMoments.data || [];
        }

        if (hasilAgenda.error) {
          console.warn('Agenda tidak bisa dimuat:', hasilAgenda.error.message);
          this.agenda = [];
        } else {
          this.agenda = hasilAgenda.data || [];
        }
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal memuat data kalender. (' + (err.message || err) + ')';
      } finally {
        this.loading = false;
      }
    },

    subscribeRealtime() {
      try {
        const supabase = getSupabaseClient();
        for (const tabel of ['places', 'moments', 'agenda']) {
          const ch = supabase
            .channel(`${tabel}-kalender`)
            .on('postgres_changes', { event: '*', schema: 'public', table: tabel, filter: `list_code=eq.${LIST_CODE}` }, () => {
              this.loadAll();
            })
            .subscribe();
          this.channels.push(ch);
        }
      } catch (err) {
        console.error(err);
      }
    },
  }));
});
