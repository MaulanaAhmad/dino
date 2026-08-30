/* ==========================================================================
   Tempat Impian Kita — komponen Alpine untuk cerita.html (timeline foto).
   Memakai helper dari assets/js/app.js (shared). Script ini TANPA `defer`,
   harus load sebelum Alpine core supaya 'alpine:init' terpasang lebih dulu.
   ========================================================================== */

/** Resize + kompres foto di browser sebelum upload (hemat kuota & storage). */
function _compressImage(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Gagal memproses foto.'))),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Gagal membaca foto.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

document.addEventListener('alpine:init', () => {
  Alpine.data('cerita', () => ({
    moments: [],
    syncStatus: 'syncing', // 'syncing' | 'synced' | 'offline'
    uploading: false,
    modalOpen: false,
    errorMessage: '',
    channel: null,

    me: '',
    editingId: null,
    editingMoment: null,
    confirmDelete: null,
    lightbox: null,

    form: { caption: '', who: 'Dido & Novi', moment_date: '', file: null, previewUrl: null },

    // --- Date-picker custom untuk field "Tanggal momen" ---
    datePickerOpen: false,
    datePickerViewYear: new Date().getFullYear(),
    datePickerViewMonth: new Date().getMonth(),

    async init() {
      this.me = getMe();
      await this.loadMoments();
      this.subscribeRealtime();
      window.addEventListener('online', () => this.loadMoments());
      window.addEventListener('offline', () => { this.syncStatus = 'offline'; });
    },

    /* ---------- identitas ---------- */

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

    /* ---------- label ---------- */

    get statusLabel() {
      return { syncing: 'Menyinkronkan...', synced: 'Tersinkron', offline: 'Offline' }[this.syncStatus];
    },

    get jumlahLabel() {
      const n = this.moments.length;
      return n ? `${n} kenangan` : '';
    },

    /** Momen dikelompokkan per bulan supaya linimasa panjang tetap terbaca. */
    get momentGroups() {
      const grup = [];
      let kunciTerakhir = null;
      for (const m of this.moments) {
        const [tahun, bulan] = (m.moment_date || '').split('-');
        const kunci = `${tahun}-${bulan}`;
        if (kunci !== kunciTerakhir) {
          grup.push({ key: kunci, label: `${BULAN_ID[Number(bulan) - 1]} ${tahun}`, items: [] });
          kunciTerakhir = kunci;
        }
        grup[grup.length - 1].items.push(m);
      }
      return grup;
    },

    /* ---------- reaksi (siapa yang suka) ---------- */

    lovedBy(moment) {
      return Array.isArray(moment.loved_by) ? moment.loved_by : [];
    },

    akuSuka(moment) {
      return !!this.me && this.lovedBy(moment).includes(this.me);
    },

    /** "Kalian berdua suka ini" / "Novi suka ini" / "" */
    reaksiLabel(moment) {
      const daftar = this.lovedBy(moment);
      if (daftar.length >= 2) return 'Kalian berdua suka ini';
      if (daftar.length === 1) return `${daftar[0]} suka ini`;
      return '';
    },

    async toggleLoved(moment) {
      if (!this.me) {
        this.errorMessage = 'Pilih dulu kamu Dido atau Novi di atas, ya.';
        return;
      }
      const sekarang = this.lovedBy(moment);
      const baru = sekarang.includes(this.me)
        ? sekarang.filter((n) => n !== this.me)
        : [...sekarang, this.me];

      this.syncStatus = 'syncing';
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('moments').update({ loved_by: baru }).eq('id', moment.id);
        if (error) throw error;
        await this.loadMoments();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Terjadi kesalahan. (' + (err.message || err) + ')';
        this.syncStatus = 'offline';
      }
    },

    /* ---------- lightbox ---------- */

    bukaLightbox(moment) {
      this.lightbox = moment;
    },

    tutupLightbox() {
      this.lightbox = null;
    },

    /* ---------- data ---------- */

    async loadMoments() {
      if (!navigator.onLine) {
        this.syncStatus = 'offline';
        return;
      }
      this.syncStatus = 'syncing';
      this.errorMessage = '';
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('moments')
          .select('*')
          .eq('list_code', LIST_CODE)
          .order('moment_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        this.moments = data || [];
        this.syncStatus = 'synced';
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal memuat cerita. (' + (err.message || err) + ')';
        this.syncStatus = 'offline';
      }
    },

    subscribeRealtime() {
      try {
        const supabase = getSupabaseClient();
        this.channel = supabase
          .channel('moments-cerita')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'moments', filter: `list_code=eq.${LIST_CODE}` }, () => {
            this.loadMoments();
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') this.syncStatus = 'synced';
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') this.syncStatus = 'offline';
          });
      } catch (err) {
        console.error(err);
      }
    },

    /* ---------- form tambah / edit ---------- */

    get modalJudul() {
      return this.editingId ? 'Edit Cerita' : 'Tambah Cerita';
    },

    get labelTombolFoto() {
      if (this.form.file) return 'Ganti foto';
      return this.editingId ? 'Ganti foto (opsional)' : 'Pilih foto';
    },

    openAddModal() {
      this.errorMessage = '';
      this.datePickerOpen = false;
      this.editingId = null;
      this.editingMoment = null;
      this.form = {
        caption: '',
        who: this.me,
        moment_date: toDateStr(new Date()),
        file: null,
        previewUrl: null,
      };
      this.modalOpen = true;
    },

    openEditModal(moment) {
      this.errorMessage = '';
      this.datePickerOpen = false;
      this.editingId = moment.id;
      this.editingMoment = moment;
      this.form = {
        caption: moment.caption || '',
        // Pengirim asli dipertahankan saat mengedit — supaya momen lama tidak
        // diam-diam berpindah nama ke orang yang kebetulan sedang mengedit.
        who: moment.who || this.me,
        moment_date: moment.moment_date || toDateStr(new Date()),
        file: null,
        previewUrl: null,
      };
      this.modalOpen = true;
    },

    closeModal() {
      if (this.form.previewUrl) URL.revokeObjectURL(this.form.previewUrl);
      this.modalOpen = false;
      this.datePickerOpen = false;
    },

    onFileSelected(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (this.form.previewUrl) URL.revokeObjectURL(this.form.previewUrl);
      this.form.file = file;
      this.form.previewUrl = URL.createObjectURL(file);
    },

    /** Foto yang tampil di pratinjau: file baru kalau ada, kalau tidak foto lama. */
    get previewSrc() {
      if (this.form.previewUrl) return this.form.previewUrl;
      if (this.editingMoment) return this.editingMoment.photo_url;
      return '';
    },

    async submitForm() {
      // Saat menambah, foto wajib. Saat mengedit, foto lama dipakai kalau tidak diganti.
      if (!this.editingId && !this.form.file) {
        this.errorMessage = 'Pilih foto dulu, ya.';
        return;
      }
      if (!this.form.moment_date) {
        this.errorMessage = 'Isi tanggal momennya dulu.';
        return;
      }

      this.uploading = true;
      this.errorMessage = '';
      try {
        const supabase = getSupabaseClient();

        // Unggah foto baru hanya kalau memang ada file baru dipilih.
        let photoUrl = this.editingMoment?.photo_url || '';
        let storagePath = this.editingMoment?.storage_path || '';
        let pathLama = '';

        if (this.form.file) {
          const compressed = await _compressImage(this.form.file);
          const pathBaru = `${LIST_CODE}/${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage.from('moments').upload(pathBaru, compressed, {
            contentType: 'image/jpeg',
            cacheControl: '31536000',
          });
          if (uploadError) throw uploadError;

          pathLama = storagePath;
          storagePath = pathBaru;
          photoUrl = supabase.storage.from('moments').getPublicUrl(pathBaru).data.publicUrl;
        }

        const payload = {
          caption: this.form.caption.trim(),
          who: this.form.who,
          moment_date: this.form.moment_date,
          photo_url: photoUrl,
          storage_path: storagePath,
        };

        // `loved_by` sengaja TIDAK dikirim — biarkan default kolomnya ('{}') yang
        // mengisi. Selain lebih ringkas, ini bikin tambah/edit cerita tetap jalan
        // buat yang belum menjalankan migration kolom tersebut.
        const { error } = this.editingId
          ? await supabase.from('moments').update(payload).eq('id', this.editingId)
          : await supabase.from('moments').insert({ ...payload, list_code: LIST_CODE });
        if (error) throw error;

        // Foto lama baru dibuang setelah barisnya benar-benar tersimpan,
        // supaya tidak kehilangan foto kalau update-nya gagal di tengah jalan.
        if (pathLama) {
          await supabase.storage.from('moments').remove([pathLama]);
        }

        this.closeModal();
        await this.loadMoments();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal menyimpan cerita. (' + (err.message || err) + ')';
      } finally {
        this.uploading = false;
      }
    },

    /* ---------- hapus (modal clay, bukan confirm() bawaan browser) ---------- */

    mintaHapus(moment) {
      this.confirmDelete = moment;
    },

    batalHapus() {
      this.confirmDelete = null;
    },

    async hapusTerkonfirmasi() {
      const moment = this.confirmDelete;
      this.confirmDelete = null;
      if (!moment) return;

      this.syncStatus = 'syncing';
      try {
        const supabase = getSupabaseClient();
        if (moment.storage_path) {
          await supabase.storage.from('moments').remove([moment.storage_path]);
        }
        const { error } = await supabase.from('moments').delete().eq('id', moment.id);
        if (error) throw error;
        await this.loadMoments();
      } catch (err) {
        console.error(err);
        this.errorMessage = 'Gagal menghapus cerita. (' + (err.message || err) + ')';
        this.syncStatus = 'offline';
      }
    },

    /* ---------- date picker ---------- */

    get datePickerLabel() {
      return this.form.moment_date ? formatDateID(this.form.moment_date) : 'Pilih tanggal';
    },

    get datePickerDays() {
      return buildCalendarGrid(this.datePickerViewYear, this.datePickerViewMonth);
    },

    openDatePicker() {
      const base = this.form.moment_date ? new Date(this.form.moment_date + 'T00:00:00') : new Date();
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
      this.form.moment_date = dateStr;
      this.datePickerOpen = false;
    },
  }));
});
