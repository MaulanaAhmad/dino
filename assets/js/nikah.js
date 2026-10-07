/* ==========================================================================
   Tempat Impian Kita — komponen Alpine untuk nikah.html (Rencana Nikah).
   Tahap 1 "Perjalanan Menuju Nikah": hitung mundur ke langkah terdekat,
   timeline langkah (milestone), checklist & catatan hasil per langkah.
   Tabel: wedding_milestones & wedding_checklist (lihat README).
   Memakai getSupabaseClient()/LIST_CODE dari assets/js/app.js (shared).
   Script ini TANPA `defer` dan harus load sebelum Alpine core, supaya
   listener 'alpine:init' di bawah sempat terpasang sebelum Alpine start.
   ========================================================================== */

const STATUS_MILESTONE = [
  { value: 'belum', label: 'Belum' },
  { value: 'dijadwalkan', label: 'Dijadwalkan' },
  { value: 'selesai', label: 'Selesai' },
];

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** 'YYYY-MM-DD' -> "Sabtu, 24 Oktober 2026". */
function formatTanggalPanjang(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${HARI_ID[new Date(y, m - 1, d).getDay()]}, ${formatDateID(dateStr)}`;
}

/** Urutan tampil: sort_order, lalu created_at kalau sort_order-nya kembar. */
function _bandingUrutan(a, b) {
  const selisih = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
  if (selisih) return selisih;
  const ca = String(a.created_at || '');
  const cb = String(b.created_at || '');
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

function _urutanBerikut(list) {
  return list.length ? Math.max(...list.map((x) => Number(x.sort_order) || 0)) + 1 : 1;
}

/* Item yang baru ditambahkan langsung tampil dengan id sementara; id aslinya
   diambil dari balasan server (tipe kolom id tidak diasumsikan). */
let _nomorSementara = 0;
function _idSementara() {
  _nomorSementara += 1;
  return `tmp-${Date.now()}-${_nomorSementara}`;
}

document.addEventListener('alpine:init', () => {
  Alpine.data('nikah', () => {
    // Timer indikator "tersimpan" — sengaja di luar state Alpine (tidak perlu reaktif).
    const timerCatatan = {};

    return {
      milestones: [],
      checklist: [],
      statusOptions: STATUS_MILESTONE,
      loaded: false,
      syncStatus: 'syncing', // 'syncing' | 'synced' | 'offline'
      pending: 0,
      errorMessage: '',
      channels: [],

      expandedId: null,
      newItemText: {}, // milestone id -> isi kolom "tambah item"
      catatanDraft: {}, // milestone id -> isi textarea "Catatan hasil"
      catatanFokusId: null,
      catatanStatus: {}, // milestone id -> '' | 'menyimpan' | 'tersimpan' | 'gagal'

      // --- Bottom sheet tambah/edit langkah ---
      sheetOpen: false,
      editingId: null,
      sheetError: '',
      form: { title: '', event_date: '', status: 'belum' },
      confirmDelete: null,

      // --- Date-picker custom untuk field "Tanggal" ---
      datePickerOpen: false,
      datePickerViewYear: new Date().getFullYear(),
      datePickerViewMonth: new Date().getMonth(),

      async init() {
        await this.loadAll();
        this.subscribeRealtime();
        window.addEventListener('online', () => this.loadAll());
        window.addEventListener('offline', () => { this.syncStatus = 'offline'; });
        // PWA bisa ditinggal ke app lain tanpa textarea sempat blur — simpan dulu catatannya.
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.simpanSemuaCatatan();
        });
      },

      /* ---------- urutan & ringkasan ---------- */

      get sortedMilestones() {
        return [...this.milestones].sort(_bandingUrutan);
      },

      checklistOf(milestoneId) {
        return this.checklist.filter((c) => c.milestone_id === milestoneId).sort(_bandingUrutan);
      },

      progressOf(milestoneId) {
        const items = this.checklist.filter((c) => c.milestone_id === milestoneId);
        return { done: items.filter((c) => c.done).length, total: items.length };
      },

      get ringkasanTeks() {
        if (!this.milestones.length) return '';
        const selesai = this.milestones.filter((m) => m.status === 'selesai').length;
        return `${selesai} dari ${this.milestones.length} langkah selesai`;
      },

      get statusLabel() {
        return { syncing: 'Menyinkronkan...', synced: 'Tersinkron', offline: 'Offline' }[this.syncStatus];
      },

      statusLabelOf(m) {
        const s = STATUS_MILESTONE.find((x) => x.value === m.status);
        return s ? s.label : 'Belum';
      },

      statusKey(m) {
        return STATUS_MILESTONE.some((x) => x.value === m.status) ? m.status : 'belum';
      },

      tanggalLabel(m) {
        return m.event_date ? formatTanggalPanjang(m.event_date) : 'Tanggal menyusul';
      },

      /** "12 hari lagi" di samping tanggal — hanya untuk langkah bertanggal yang belum selesai. */
      sisaLabel(m) {
        if (!m.event_date || m.status === 'selesai') return '';
        return daysUntilLabel(m.event_date);
      },

      /* ---------- hitung mundur ---------- */

      /** Langkah bertanggal terdekat (hari ini atau nanti) yang statusnya belum 'selesai'. */
      get milestoneTerdekat() {
        const kandidat = this.milestones.filter(
          (m) => !m._tmp && m.event_date && m.status !== 'selesai' && daysUntil(m.event_date) >= 0
        );
        kandidat.sort((a, b) => {
          if (a.event_date !== b.event_date) return a.event_date < b.event_date ? -1 : 1;
          return _bandingUrutan(a, b);
        });
        return kandidat[0] || null;
      },

      get sisaHariTerdekat() {
        return this.milestoneTerdekat ? daysUntil(this.milestoneTerdekat.event_date) : null;
      },

      /* ---------- data ---------- */

      async loadAll() {
        if (!navigator.onLine) {
          this.syncStatus = 'offline';
          this.loaded = true;
          return;
        }
        this.syncStatus = 'syncing';
        this.errorMessage = '';
        try {
          const supabase = getSupabaseClient();
          const [hasilMilestone, hasilChecklist] = await Promise.all([
            supabase
              .from('wedding_milestones')
              .select('*')
              .eq('list_code', LIST_CODE)
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: true }),
            supabase
              .from('wedding_checklist')
              .select('*')
              .eq('list_code', LIST_CODE)
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: true }),
          ]);
          if (hasilMilestone.error) throw hasilMilestone.error;
          if (hasilChecklist.error) throw hasilChecklist.error;

          this.milestones = hasilMilestone.data || [];
          this.checklist = hasilChecklist.data || [];
          this.sinkronkanDraft();
          this.syncStatus = 'synced';
        } catch (err) {
          console.error(err);
          this.errorMessage = 'Gagal memuat perjalanan. (' + (err.message || err) + ')';
          this.syncStatus = 'offline';
        } finally {
          this.loaded = true;
        }
      },

      subscribeRealtime() {
        try {
          const supabase = getSupabaseClient();
          const tabel = [
            ['wedding_milestones', 'milestones'],
            ['wedding_checklist', 'checklist'],
          ];
          for (const [nama, kunci] of tabel) {
            const ch = supabase
              .channel(`${nama}-nikah`)
              .on('postgres_changes', { event: '*', schema: 'public', table: nama, filter: `list_code=eq.${LIST_CODE}` }, (payload) => {
                this.applyRealtimeChange(kunci, payload);
              })
              .subscribe((status) => {
                if (status === 'SUBSCRIBED') { if (!this.pending) this.syncStatus = 'synced'; }
                else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') this.syncStatus = 'offline';
              });
            this.channels.push(ch);
          }
        } catch (err) {
          console.error(err);
        }
      },

      applyRealtimeChange(kunci, payload) {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          if (this[kunci].some((x) => x.id === row.id)) return;
          // Gema dari tambah kita sendiri yang balasan servernya belum datang:
          // ganti item sementaranya, jangan sampai tampil dobel.
          const i = this[kunci].findIndex((x) => x._tmp && this._isiSama(kunci, x, row));
          if (i >= 0) this[kunci].splice(i, 1, row);
          else this[kunci].push(row);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          this[kunci] = this[kunci].map((x) => (x.id === row.id ? row : x));
        } else if (payload.eventType === 'DELETE') {
          const id = payload.old && payload.old.id;
          this[kunci] = this[kunci].filter((x) => x.id !== id);
          if (kunci === 'milestones') {
            // Checklist-nya ikut terhapus di database (cascade).
            this.checklist = this.checklist.filter((c) => c.milestone_id !== id);
            if (this.expandedId === id) this.expandedId = null;
          }
        }
        if (kunci === 'milestones') this.sinkronkanDraft();
      },

      _isiSama(kunci, lokal, row) {
        if (kunci === 'milestones') return lokal.title === row.title && Number(lokal.sort_order) === Number(row.sort_order);
        return lokal.milestone_id === row.milestone_id && lokal.text === row.text && Number(lokal.sort_order) === Number(row.sort_order);
      },

      /** Isi textarea catatan mengikuti database, kecuali yang sedang diketik. */
      sinkronkanDraft() {
        for (const m of this.milestones) {
          if (m.id !== this.catatanFokusId) this.catatanDraft[m.id] = m.notes || '';
          if (!(m.id in this.newItemText)) this.newItemText[m.id] = '';
        }
      },

      _patch(kunci, id, perubahan) {
        this[kunci] = this[kunci].map((x) => (x.id === id ? { ...x, ...perubahan } : x));
      },

      _gantiSementara(kunci, idSementara, row) {
        if (this[kunci].some((x) => x.id === row.id)) {
          this[kunci] = this[kunci].filter((x) => x.id !== idSementara);
        } else {
          this[kunci] = this[kunci].map((x) => (x.id === idSementara ? row : x));
        }
        if (kunci === 'milestones') this.sinkronkanDraft();
      },

      /**
       * Kirim satu perubahan ke Supabase. Layar sudah diubah duluan (optimistic);
       * kalau gagal, `rollback` mengembalikannya. Return hasil query, atau null kalau gagal.
       */
      async _kirim(aksi, rollback, pesanGagal) {
        this.errorMessage = '';
        this.pending += 1;
        this.syncStatus = 'syncing';
        let berhasil = false;
        try {
          const hasil = await aksi(getSupabaseClient());
          if (hasil.error) throw hasil.error;
          berhasil = true;
          return hasil;
        } catch (err) {
          console.error(err);
          this.errorMessage = pesanGagal + ' (' + (err.message || err) + ')';
          rollback();
          return null;
        } finally {
          this.pending -= 1;
          if (!berhasil) this.syncStatus = 'offline';
          else if (!this.pending) this.syncStatus = 'synced';
        }
      },

      /* ---------- expand ---------- */

      toggleExpand(m) {
        if (m._tmp) return;
        if (this.expandedId === m.id) {
          // Ditutup sebelum textarea sempat blur (umum di iOS) — simpan dulu.
          this.simpanCatatan(m);
          this.expandedId = null;
        } else {
          this.sinkronkanDraft();
          this.expandedId = m.id;
        }
      },

      /* ---------- checklist ---------- */

      async toggleItem(item) {
        if (item._tmp) return;
        const sebelum = !!item.done;
        this._patch('checklist', item.id, { done: !sebelum });
        await this._kirim(
          (sb) => sb.from('wedding_checklist').update({ done: !sebelum }).eq('id', item.id),
          () => this._patch('checklist', item.id, { done: sebelum }),
          'Gagal menyimpan centang.'
        );
      },

      async tambahItem(m) {
        const text = (this.newItemText[m.id] || '').trim();
        if (!text || m._tmp) return;

        const sort_order = _urutanBerikut(this.checklist.filter((c) => c.milestone_id === m.id));
        const sementara = {
          id: _idSementara(),
          _tmp: true,
          list_code: LIST_CODE,
          milestone_id: m.id,
          text,
          done: false,
          sort_order,
          created_at: new Date().toISOString(),
        };
        this.checklist.push(sementara);
        this.newItemText[m.id] = '';

        const hasil = await this._kirim(
          (sb) => sb
            .from('wedding_checklist')
            .insert({ list_code: LIST_CODE, milestone_id: m.id, text, done: false, sort_order })
            .select()
            .single(),
          () => {
            this.checklist = this.checklist.filter((c) => c.id !== sementara.id);
            // Kembalikan teksnya ke kolom input supaya tidak perlu diketik ulang.
            if (!this.newItemText[m.id]) this.newItemText[m.id] = text;
          },
          'Gagal menambah item.'
        );
        if (hasil) this._gantiSementara('checklist', sementara.id, hasil.data);
      },

      async hapusItem(item) {
        if (item._tmp) return;
        const salinan = { ...item };
        this.checklist = this.checklist.filter((c) => c.id !== item.id);
        await this._kirim(
          (sb) => sb.from('wedding_checklist').delete().eq('id', salinan.id),
          () => {
            if (!this.checklist.some((c) => c.id === salinan.id)) this.checklist.push(salinan);
          },
          'Gagal menghapus item.'
        );
      },

      /* ---------- catatan hasil (disimpan saat blur) ---------- */

      async simpanCatatan(m) {
        if (this.catatanFokusId === m.id) this.catatanFokusId = null;
        const teks = this.catatanDraft[m.id] ?? '';
        const terkini = this.milestones.find((x) => x.id === m.id);
        if (!terkini || terkini._tmp) return;
        const sebelum = terkini.notes || '';
        if (teks === sebelum) return;

        this._patch('milestones', m.id, { notes: teks });
        this._setCatatanStatus(m.id, 'menyimpan');
        const hasil = await this._kirim(
          (sb) => sb.from('wedding_milestones').update({ notes: teks }).eq('id', m.id),
          // Yang dikembalikan cuma data di layar; teks di textarea dibiarkan supaya
          // tidak hilang — blur berikutnya otomatis mencoba menyimpan lagi.
          () => this._patch('milestones', m.id, { notes: sebelum }),
          'Gagal menyimpan catatan.'
        );
        this._setCatatanStatus(m.id, hasil ? 'tersimpan' : 'gagal');
      },

      simpanSemuaCatatan() {
        for (const m of this.milestones) {
          if (!m._tmp && (this.catatanDraft[m.id] ?? '') !== (m.notes || '')) this.simpanCatatan(m);
        }
      },

      _setCatatanStatus(id, status) {
        clearTimeout(timerCatatan[id]);
        this.catatanStatus[id] = status;
        if (status === 'tersimpan') {
          timerCatatan[id] = setTimeout(() => {
            if (this.catatanStatus[id] === 'tersimpan') this.catatanStatus[id] = '';
          }, 2500);
        }
      },

      catatanStatusTeks(id) {
        return {
          menyimpan: 'Menyimpan…',
          tersimpan: '✓ Tersimpan',
          gagal: 'Gagal tersimpan — ketuk lalu keluar lagi untuk mencoba ulang',
        }[this.catatanStatus[id]] || '';
      },

      /* ---------- tambah / edit langkah (bottom sheet) ---------- */

      get sheetJudul() {
        return this.editingId ? 'Edit Langkah' : 'Tambah Langkah';
      },

      bukaTambah() {
        this.editingId = null;
        this.sheetError = '';
        this.datePickerOpen = false;
        this.form = { title: '', event_date: '', status: 'belum' };
        this.sheetOpen = true;
      },

      bukaEdit(m) {
        if (m._tmp) return;
        this.editingId = m.id;
        this.sheetError = '';
        this.datePickerOpen = false;
        this.form = { title: m.title || '', event_date: m.event_date || '', status: this.statusKey(m) };
        this.sheetOpen = true;
      },

      tutupSheet() {
        this.sheetOpen = false;
        this.datePickerOpen = false;
      },

      /** Kalau simpan gagal: sheet dibuka lagi dengan isian yang sama, biar tinggal coba ulang. */
      _bukaLagiSheet(editingId, form, pesan) {
        this.editingId = editingId;
        this.form = form;
        this.sheetError = pesan;
        this.errorMessage = '';
        this.sheetOpen = true;
      },

      async simpanMilestone() {
        const title = this.form.title.trim();
        if (!title) {
          this.sheetError = 'Isi dulu judul langkahnya.';
          return;
        }
        const data = { title, event_date: this.form.event_date || null, status: this.form.status };
        const formSalinan = { ...this.form };
        const editingId = this.editingId;
        this.tutupSheet();

        if (editingId) {
          const lama = this.milestones.find((x) => x.id === editingId);
          if (!lama) return;
          const sebelum = { title: lama.title, event_date: lama.event_date, status: lama.status };
          this._patch('milestones', editingId, data);
          await this._kirim(
            (sb) => sb.from('wedding_milestones').update(data).eq('id', editingId),
            () => {
              this._patch('milestones', editingId, sebelum);
              this._bukaLagiSheet(editingId, formSalinan, 'Gagal menyimpan perubahan. Coba lagi, ya.');
            },
            'Gagal menyimpan perubahan.'
          );
          return;
        }

        // Langkah baru selalu masuk di akhir urutan.
        const sort_order = _urutanBerikut(this.milestones);
        const sementara = {
          id: _idSementara(),
          _tmp: true,
          list_code: LIST_CODE,
          ...data,
          notes: '',
          sort_order,
          created_at: new Date().toISOString(),
        };
        this.milestones.push(sementara);

        const hasil = await this._kirim(
          (sb) => sb
            .from('wedding_milestones')
            .insert({ list_code: LIST_CODE, ...data, sort_order })
            .select()
            .single(),
          () => {
            this.milestones = this.milestones.filter((x) => x.id !== sementara.id);
            this._bukaLagiSheet(null, formSalinan, 'Gagal menambah langkah. Coba lagi, ya.');
          },
          'Gagal menambah langkah.'
        );
        if (hasil) this._gantiSementara('milestones', sementara.id, hasil.data);
      },

      /* ---------- hapus langkah (modal clay, bukan confirm() bawaan browser) ---------- */

      mintaHapus() {
        const m = this.milestones.find((x) => x.id === this.editingId);
        this.tutupSheet();
        if (m) this.confirmDelete = m;
      },

      batalHapus() {
        this.confirmDelete = null;
      },

      get jumlahItemDihapus() {
        return this.confirmDelete ? this.progressOf(this.confirmDelete.id).total : 0;
      },

      async hapusTerkonfirmasi() {
        const m = this.confirmDelete;
        this.confirmDelete = null;
        if (!m || m._tmp) return;

        const salinan = { ...m };
        const itemLama = this.checklist.filter((c) => c.milestone_id === m.id).map((c) => ({ ...c }));
        this.milestones = this.milestones.filter((x) => x.id !== m.id);
        this.checklist = this.checklist.filter((c) => c.milestone_id !== m.id);
        if (this.expandedId === m.id) this.expandedId = null;

        // Checklist-nya ikut terhapus di database lewat ON DELETE CASCADE.
        await this._kirim(
          (sb) => sb.from('wedding_milestones').delete().eq('id', salinan.id),
          () => {
            if (!this.milestones.some((x) => x.id === salinan.id)) this.milestones.push(salinan);
            for (const c of itemLama) {
              if (!this.checklist.some((x) => x.id === c.id)) this.checklist.push(c);
            }
          },
          'Gagal menghapus langkah.'
        );
      },

      /* ---------- date picker ---------- */

      get datePickerLabel() {
        return this.form.event_date ? formatTanggalPanjang(this.form.event_date) : 'Tanggal menyusul';
      },

      get datePickerDays() {
        return buildCalendarGrid(this.datePickerViewYear, this.datePickerViewMonth);
      },

      openDatePicker() {
        const base = this.form.event_date ? new Date(this.form.event_date + 'T00:00:00') : new Date();
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
        this.form.event_date = dateStr;
        // Sudah ada tanggalnya = sudah dijadwalkan. Tetap bisa diubah manual.
        if (this.form.status === 'belum') this.form.status = 'dijadwalkan';
        this.datePickerOpen = false;
      },

      clearDate() {
        this.form.event_date = '';
        this.datePickerOpen = false;
      },
    };
  });
});
