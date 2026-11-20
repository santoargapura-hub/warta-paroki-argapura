/* ==========================================================
   WARTA PAROKI ARGAPURA
   ADMIN DASHBOARD - SUPABASE
   Zona waktu aplikasi: Asia/Jayapura
   ========================================================== */

const ADMIN_TABLES = {
  pengumuman: 'warta_pengumuman',
  galeri: 'warta_galeri',
  liturgi: 'warta_liturgi_bank',
  madah: 'warta_madah',
  dokumen: 'warta_dokumen',
  umkm: 'warta_umkm',
  petugas: 'warta_petugas',
  kolekte: 'warta_kolekte',
  entrop: 'warta_kolekte_entrop',
  lagu: 'warta_lagu_misa',
  laguHeader: 'warta_lagu_misa_header',
  settings: 'warta_settings'
};

const ADMIN_CACHE = {
  settings: {},
  liturgi: [],
  petugas: [],
  kolekte: [],
  entrop: [],
  lagu: [],
  pengumuman: [],
  galeri: [],
  madah: [],
  dokumen: [],
  umkm: [],
  laguHeader: null
};

let currentAdminUser = null;

/* -------------------- UTILITAS DASAR -------------------- */

function byId(id) {
  return document.getElementById(id);
}

function valueOf(id) {
  return byId(id)?.value?.trim() ?? '';
}

function setValue(id, value) {
  const el = byId(id);
  if (el) el.value = value ?? '';
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function showNotice(message, type = 'success', target = 'globalNotice') {
  const el = byId(target);
  if (!el) return;

  el.textContent = message;
  el.className = `notice show ${type}`;

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  window.setTimeout(() => {
    el.classList.remove('show');
  }, 6000);
}

function showError(error, target = 'globalNotice') {
  console.error(error);
  showNotice(error?.message || String(error), 'error', target);
}

function getTodayJayapura() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jayapura',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) return escapeHTML(value);

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jayapura'
  }).format(date);
}

function setButtonLoading(button, loading, loadingText = 'Menyimpan...') {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Simpan';
  }
}

function validateHttpUrl(url) {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function uploadFile(file, folder) {
  if (!file) return null;

  if (typeof uploadToSupabaseStorage !== 'function') {
    throw new Error('Fungsi uploadToSupabaseStorage tidak ditemukan. Periksa js/supabase-config.js.');
  }

  return await uploadToSupabaseStorage(file, folder);
}

async function getTableRows(table, orderColumn = 'id') {
  const { data, error } = await supabaseClient
    .from(table)
    .select('*')
    .order(orderColumn, { ascending: false });

  if (error) throw error;
  return data || [];
}

async function upsertSettings(settings) {
  const rows = Object.entries(settings).map(([k, v]) => ({
    k,
    v: v == null ? '' : String(v)
  }));

  if (!rows.length) return;

  const { error } = await supabaseClient
    .from(ADMIN_TABLES.settings)
    .upsert(rows, { onConflict: 'k' });

  if (error) throw error;
}

async function saveTextSetting(settingKey, inputId) {
  try {
    const value = valueOf(inputId);
    await upsertSettings({ [settingKey]: value });
    ADMIN_CACHE.settings[settingKey] = value;
    showNotice('Pengaturan berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- NAVIGASI TAB -------------------- */

function switchTab(tabId, button) {
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });

  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.classList.remove('active');
  });

  const target = byId(tabId);
  if (target) target.classList.add('active');

  if (button) button.classList.add('active');
}

/* -------------------- KEAMANAN DAN LOGIN -------------------- */

async function verifyAdminAccess() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data?.user) {
    return { allowed: false, user: null };
  }

  const user = data.user;
  const role = user.app_metadata?.role;

  if (role !== 'admin') {
    await supabaseClient.auth.signOut();
    return { allowed: false, user: null };
  }

  return { allowed: true, user };
}

async function handleLogin(event) {
  if (event) event.preventDefault();

  const email = valueOf('loginEmail');
  const password = byId('loginPassword')?.value || '';

  if (!email || !password) {
    showNotice('Masukkan email dan kata sandi.', 'error', 'loginNotice');
    return;
  }

  const button = byId('loginForm')?.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Memeriksa akun...');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const user = data?.user;
    if (!user || user.app_metadata?.role !== 'admin') {
      await supabaseClient.auth.signOut();
      throw new Error('Akun ini tidak memiliki hak administrator.');
    }

    currentAdminUser = user;
    await showAdminDashboard();
  } catch (error) {
    showError(error, 'loginNotice');
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleLogout() {
  const confirmed = window.confirm('Apakah kamu yakin ingin keluar dari panel admin?');
  if (!confirmed) return;

  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    currentAdminUser = null;
    byId('dashboardSection')?.classList.add('hidden');
    byId('loginSection')?.classList.remove('hidden');
    byId('logoutBtn')?.classList.add('hidden');
    byId('adminIdentity').textContent = '';
    showNotice('Kamu sudah keluar dari dashboard.', 'success', 'loginNotice');
  } catch (error) {
    showError(error);
  }
}

async function showAdminDashboard() {
  const result = await verifyAdminAccess();

  if (!result.allowed) {
    byId('dashboardSection')?.classList.add('hidden');
    byId('loginSection')?.classList.remove('hidden');
    byId('logoutBtn')?.classList.add('hidden');
    return;
  }

  currentAdminUser = result.user;

  byId('loginSection')?.classList.add('hidden');
  byId('dashboardSection')?.classList.remove('hidden');
  byId('logoutBtn')?.classList.remove('hidden');

  if (byId('adminIdentity')) {
    byId('adminIdentity').textContent = result.user.email || 'Administrator';
  }

  await loadAllAdminData();
}

/* -------------------- PENGATURAN WEBSITE -------------------- */

function updateCirclePreview(key, url) {
  const wrap = byId(`${key}_preview_wrap`);
  const img = byId(`${key}_preview`);
  if (!wrap || !img) return;
  if (url && url.trim() !== '') {
    img.src = url;
    wrap.style.display = 'flex';
  } else {
    wrap.style.display = 'none';
  }
}

async function loadSettingsToForm() {
  const { data, error } = await supabaseClient
    .from(ADMIN_TABLES.settings)
    .select('k,v');

  if (error) throw error;

  ADMIN_CACHE.settings = {};

  (data || []).forEach(row => {
    ADMIN_CACHE.settings[row.k] = row.v ?? '';
  });

  document.querySelectorAll('[data-setting]').forEach(input => {
    const key = input.dataset.setting;
    if (Object.prototype.hasOwnProperty.call(ADMIN_CACHE.settings, key)) {
      input.value = ADMIN_CACHE.settings[key] ?? '';
    }
  });

  const imageSettings = [
    'logo_paroki',
    'mazmur_gambar',
    'doremi_foto',
    'rekening_barcode',
    'laporan_gambar'
  ];

  imageSettings.forEach(key => {
    const current = ADMIN_CACHE.settings[key];
    const label = byId(`${key}_current`);

    if (label) {
      label.textContent = current ? `File saat ini: ${current}` : 'Belum ada file tersimpan.';
    }
  });

  updateCirclePreview('logo_paroki', ADMIN_CACHE.settings.logo_paroki);
  updateCirclePreview('doremi_foto', ADMIN_CACHE.settings.doremi_foto);

  setValue('kolekte_keterangan', ADMIN_CACHE.settings.kolekte_keterangan || '');
  setValue('entrop_keterangan', ADMIN_CACHE.settings.kolekte_entrop_keterangan || '');
}

async function saveSettingsForm(event) {
  event.preventDefault();

  const form = byId('settingsForm');
  const button = form?.querySelector('button[type="submit"]');
  setButtonLoading(button, true);

  try {
    const settings = {};

    document.querySelectorAll('[data-setting]').forEach(input => {
      const key = input.dataset.setting;
      settings[key] = input.value ?? '';
    });

    const urlKeys = [
      'youtube_link',
      'podcast_link',
      'podcast_link2',
      'podcast_link3',
      'podcast_link4',
      'doremi_link',
      'media_interaktif_url'
    ];

    urlKeys.forEach(key => {
      if (!validateHttpUrl(settings[key])) {
        throw new Error(`URL pada ${key} tidak valid. Gunakan alamat http:// atau https://.`);
      }
    });

    const fileSettings = [
      { input: 'logo_paroki_file', key: 'logo_paroki', folder: 'identitas' },
      { input: 'mazmur_gambar_file', key: 'mazmur_gambar', folder: 'mazmur' },
      { input: 'doremi_foto_file', key: 'doremi_foto', folder: 'doremi' },
      { input: 'rekening_barcode_file', key: 'rekening_barcode', folder: 'rekening' },
      { input: 'laporan_gambar_file', key: 'laporan_gambar', folder: 'laporan' },
      { input: 'media_interaktif_file', key: 'media_interaktif_url', folder: 'media-interaktif' }
    ];

    for (const item of fileSettings) {
      const file = byId(item.input)?.files?.[0];
      if (!file) continue;

      const uploadedUrl = await uploadFile(file, item.folder);
      if (uploadedUrl) {
        settings[item.key] = uploadedUrl;
      }
    }

    await upsertSettings(settings);

    ADMIN_CACHE.settings = {
      ...ADMIN_CACHE.settings,
      ...settings
    };

    await loadSettingsToForm();
    showNotice('Semua pengaturan berhasil disimpan.');
  } catch (error) {
    showError(error);
  } finally {
    setButtonLoading(button, false);
  }
}

/* -------------------- KOMPONEN DAFTAR DATA -------------------- */

function renderRecordList(containerId, rows, titleField, subtitleField, editFunction, deleteFunction) {
  const container = byId(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<p class="muted">Belum ada data.</p>';
    return;
  }

  container.innerHTML = rows.map(row => {
    const title = escapeHTML(row[titleField] || '(Tanpa judul)');
    const subtitle = escapeHTML(row[subtitleField] || '');

    return `
      <article class="record">
        <div>
          <strong>${title}</strong>
          <small>${subtitle}</small>
        </div>
        <div class="record-actions">
          <button class="btn btn-small btn-light" type="button"
            data-action="edit" data-id="${escapeHTML(row.id)}">Edit</button>
          <button class="btn btn-small btn-danger" type="button"
            data-action="delete" data-id="${escapeHTML(row.id)}">Hapus</button>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-action="edit"]').forEach(button => {
    button.addEventListener('click', () => editFunction(Number(button.dataset.id)));
  });

  container.querySelectorAll('[data-action="delete"]').forEach(button => {
    button.addEventListener('click', () => deleteFunction(Number(button.dataset.id)));
  });
}

async function deleteRow(table, id, reloadFunction) {
  if (!Number.isInteger(id) || id <= 0) {
    showNotice('ID data tidak valid.', 'error');
    return;
  }

  if (!window.confirm('Hapus data ini? Tindakan ini tidak dapat dibatalkan.')) return;

  try {
    const { error } = await supabaseClient
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;

    await reloadFunction();
    showNotice('Data berhasil dihapus.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- LITURGI -------------------- */

async function loadLiturgiList() {
  const rows = await getTableRows(ADMIN_TABLES.liturgi, 'tanggal');
  ADMIN_CACHE.liturgi = rows;

  const container = byId('liturgiList');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<p class="muted">Belum ada data liturgi.</p>';
    return;
  }

  container.innerHTML = rows.map(row => `
    <article class="record">
      <div>
        <strong>${escapeHTML(formatDate(row.tanggal))}</strong>
        <small>
          ${escapeHTML(row.bacaan1_judul || 'Bacaan I')} ·
          ${escapeHTML(row.bacaan2_judul || 'Bacaan II')} ·
          ${escapeHTML(row.injil_judul || 'Injil')}
        </small>
      </div>
      <div class="record-actions">
        <button class="btn btn-small btn-light" data-lit-edit="${row.id}">Edit</button>
        <button class="btn btn-small btn-danger" data-lit-delete="${row.id}">Hapus</button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-lit-edit]').forEach(button => {
    button.addEventListener('click', () => editLiturgi(Number(button.dataset.litEdit)));
  });

  container.querySelectorAll('[data-lit-delete]').forEach(button => {
    button.addEventListener('click', () => deleteRow(
      ADMIN_TABLES.liturgi,
      Number(button.dataset.litDelete),
      loadLiturgiList
    ));
  });
}

function editLiturgi(id) {
  const row = ADMIN_CACHE.liturgi.find(item => item.id === id);
  if (!row) return;

  setValue('lit_tanggal', row.tanggal);
  setValue('lit_bacaan1_judul', row.bacaan1_judul);
  setValue('lit_bacaan1_isi', row.bacaan1_isi);
  setValue('lit_bacaan2_judul', row.bacaan2_judul);
  setValue('lit_bacaan2_isi', row.bacaan2_isi);
  setValue('lit_injil_judul', row.injil_judul);
  setValue('lit_injil_isi', row.injil_isi);
  setValue('lit_keterangan', row.keterangan_liturgi);

  byId('liturgiForm')?.scrollIntoView({ behavior: 'smooth' });
}

function resetLiturgiForm() {
  byId('liturgiForm')?.reset();
  setValue('lit_tanggal', getTodayJayapura());
}

async function saveLiturgi(event) {
  event.preventDefault();

  const tanggal = valueOf('lit_tanggal');
  if (!tanggal) {
    showNotice('Tanggal liturgi wajib diisi.', 'error');
    return;
  }

  const payload = {
    tanggal,
    bacaan1_judul: valueOf('lit_bacaan1_judul'),
    bacaan1_isi: valueOf('lit_bacaan1_isi'),
    bacaan2_judul: valueOf('lit_bacaan2_judul'),
    bacaan2_isi: valueOf('lit_bacaan2_isi'),
    injil_judul: valueOf('lit_injil_judul'),
    injil_isi: valueOf('lit_injil_isi'),
    keterangan_liturgi: valueOf('lit_keterangan')
  };

  try {
    const { error } = await supabaseClient
      .from(ADMIN_TABLES.liturgi)
      .upsert(payload, { onConflict: 'tanggal' });

    if (error) throw error;

    await loadLiturgiList();
    showNotice('Liturgi berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- PETUGAS LITURGI -------------------- */

const PETUGAS_FIELDS = [
  'periode', 'misa', 'koor', 'akolit', 'lektor', 'pemazmur',
  'dirigen', 'organis', 'misdinar', 'tatalaksana', 'imam',
  'piket', 'hias', 'parkir', 'komuni'
];

async function loadPetugasList() {
  const rows = await getTableRows(ADMIN_TABLES.petugas);
  ADMIN_CACHE.petugas = rows;

  const container = byId('petugasList');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<p class="muted">Belum ada jadwal petugas.</p>';
    return;
  }

  container.innerHTML = rows.map(row => `
    <article class="record">
      <div>
        <strong>${escapeHTML(row.misa || 'Jadwal Misa')}</strong>
        <small>
          Periode: ${escapeHTML(row.periode || '-')}<br>
          Koor: ${escapeHTML(row.koor || '-')} ·
          Lektor: ${escapeHTML(row.lektor || '-')} ·
          Pemazmur: ${escapeHTML(row.pemazmur || '-')}
        </small>
      </div>
      <div class="record-actions">
        <button class="btn btn-small btn-light" data-pet-edit="${row.id}">Edit</button>
        <button class="btn btn-small btn-danger" data-pet-delete="${row.id}">Hapus</button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-pet-edit]').forEach(button => {
    button.addEventListener('click', () => editPetugas(Number(button.dataset.petEdit)));
  });

  container.querySelectorAll('[data-pet-delete]').forEach(button => {
    button.addEventListener('click', () => deleteRow(
      ADMIN_TABLES.petugas,
      Number(button.dataset.petDelete),
      loadPetugasList
    ));
  });
}

function resetPetugasForm() {
  byId('petugasForm')?.reset();
  setValue('petugas_id', '');
}

function editPetugas(id) {
  const row = ADMIN_CACHE.petugas.find(item => item.id === id);
  if (!row) return;

  setValue('petugas_id', row.id);

  PETUGAS_FIELDS.forEach(field => {
    setValue(`petugas_${field}`, row[field]);
  });

  byId('petugasForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function savePetugas(event) {
  event.preventDefault();

  const id = Number(valueOf('petugas_id'));
  const payload = {};

  PETUGAS_FIELDS.forEach(field => {
    payload[field] = valueOf(`petugas_${field}`);
  });

  try {
    let result;

    if (id > 0) {
      result = await supabaseClient
        .from(ADMIN_TABLES.petugas)
        .update(payload)
        .eq('id', id);
    } else {
      result = await supabaseClient
        .from(ADMIN_TABLES.petugas)
        .insert(payload);
    }

    if (result.error) throw result.error;

    resetPetugasForm();
    await loadPetugasList();
    showNotice('Jadwal petugas berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- KOLEKTE PUSAT -------------------- */

async function loadKolekteList() {
  const rows = await getTableRows(ADMIN_TABLES.kolekte);
  ADMIN_CACHE.kolekte = rows;

  renderRecordList(
    'kolekteList',
    rows,
    'uraian',
    'Misa 1: ket1 | Misa 2: ket2 | Misa 3: ket3',
    editKolekte,
    id => deleteRow(ADMIN_TABLES.kolekte, id, loadKolekteList)
  );

  const container = byId('kolekteList');
  container?.querySelectorAll('.record').forEach((element, index) => {
    const row = rows[index];
    const small = element.querySelector('small');

    if (small && row) {
      small.textContent =
        `Misa 1: ${row.ket1 || '-'} | Misa 2: ${row.ket2 || '-'} | ` +
        `Misa 3: ${row.ket3 || '-'} | Lainnya: ${row.ket_lain || '-'}`;
    }
  });
}

function resetKolekteForm() {
  byId('kolekteForm')?.reset();
  setValue('kolekte_id', '');
}

function editKolekte(id) {
  const row = ADMIN_CACHE.kolekte.find(item => item.id === id);
  if (!row) return;

  setValue('kolekte_id', row.id);
  setValue('kolekte_uraian', row.uraian);
  setValue('kolekte_ket1', row.ket1);
  setValue('kolekte_ket2', row.ket2);
  setValue('kolekte_ket3', row.ket3);
  setValue('kolekte_ket_lain', row.ket_lain);

  byId('kolekteForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function saveKolekte(event) {
  event.preventDefault();

  const id = Number(valueOf('kolekte_id'));
  const payload = {
    uraian: valueOf('kolekte_uraian'),
    ket1: valueOf('kolekte_ket1'),
    ket2: valueOf('kolekte_ket2'),
    ket3: valueOf('kolekte_ket3'),
    ket_lain: valueOf('kolekte_ket_lain')
  };

  try {
    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.kolekte).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.kolekte).insert(payload);

    if (result.error) throw result.error;

    resetKolekteForm();
    await loadKolekteList();
    showNotice('Data Kolekte Pusat berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- KOLEKTE STASI ENTROP -------------------- */

async function loadEntropList() {
  const rows = await getTableRows(ADMIN_TABLES.entrop);
  ADMIN_CACHE.entrop = rows;

  renderRecordList(
    'entropList',
    rows,
    'uraian',
    'Kolekte Stasi Entrop',
    editEntrop,
    id => deleteRow(ADMIN_TABLES.entrop, id, loadEntropList)
  );

  const container = byId('entropList');
  container?.querySelectorAll('.record').forEach((element, index) => {
    const row = rows[index];
    const small = element.querySelector('small');

    if (small && row) {
      small.textContent =
        `Tabel 1: ${row.tabel1 || '-'} | Tabel 2: ${row.tabel2 || '-'} | ` +
        `Lainnya: ${row.ket_lain || '-'}`;
    }
  });
}

function resetEntropForm() {
  byId('entropForm')?.reset();
  setValue('entrop_id', '');
}

function editEntrop(id) {
  const row = ADMIN_CACHE.entrop.find(item => item.id === id);
  if (!row) return;

  setValue('entrop_id', row.id);
  setValue('entrop_uraian', row.uraian);
  setValue('entrop_tabel1', row.tabel1);
  setValue('entrop_tabel2', row.tabel2);
  setValue('entrop_ket_lain', row.ket_lain);

  byId('entropForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function saveEntrop(event) {
  event.preventDefault();

  const id = Number(valueOf('entrop_id'));
  const payload = {
    uraian: valueOf('entrop_uraian'),
    tabel1: valueOf('entrop_tabel1'),
    tabel2: valueOf('entrop_tabel2'),
    ket_lain: valueOf('entrop_ket_lain')
  };

  try {
    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.entrop).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.entrop).insert(payload);

    if (result.error) throw result.error;

    resetEntropForm();
    await loadEntropList();
    showNotice('Data Kolekte Stasi Entrop berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- SUSUNAN LAGU MISA -------------------- */

async function loadLaguList() {
  const rows = await getTableRows(ADMIN_TABLES.lagu);
  ADMIN_CACHE.lagu = rows;

  renderRecordList(
    'laguList',
    rows,
    'c1',
    'Susunan lagu Misa',
    editLagu,
    id => deleteRow(ADMIN_TABLES.lagu, id, loadLaguList)
  );

  const container = byId('laguList');
  container?.querySelectorAll('.record').forEach((element, index) => {
    const row = rows[index];
    const small = element.querySelector('small');

    if (small && row) {
      small.textContent = [row.c1, row.c2, row.c3, row.c4, row.c5]
        .filter(Boolean).join(' | ');
    }
  });
}

async function loadLaguHeader() {
  const { data, error } = await supabaseClient
    .from(ADMIN_TABLES.laguHeader)
    .select('*')
    .order('id', { ascending: true })
    .limit(1);

  if (error) throw error;

  const row = data?.[0] || null;
  ADMIN_CACHE.laguHeader = row;

  if (row) {
    ['h1', 'h2', 'h3', 'h4', 'h5'].forEach(field => {
      setValue(`lagu_${field}`, row[field]);
    });
  }
}

async function saveLaguHeader(event) {
  event.preventDefault();

  const payload = {
    h1: valueOf('lagu_h1'),
    h2: valueOf('lagu_h2'),
    h3: valueOf('lagu_h3'),
    h4: valueOf('lagu_h4'),
    h5: valueOf('lagu_h5')
  };

  try {
    let result;

    if (ADMIN_CACHE.laguHeader?.id) {
      result = await supabaseClient
        .from(ADMIN_TABLES.laguHeader)
        .update(payload)
        .eq('id', ADMIN_CACHE.laguHeader.id);
    } else {
      result = await supabaseClient
        .from(ADMIN_TABLES.laguHeader)
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    await loadLaguHeader();
    showNotice('Judul kolom lagu berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

function resetLaguForm() {
  byId('laguForm')?.reset();
  setValue('lagu_id', '');
}

function editLagu(id) {
  const row = ADMIN_CACHE.lagu.find(item => item.id === id);
  if (!row) return;

  setValue('lagu_id', row.id);
  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(field => {
    setValue(`lagu_${field}`, row[field]);
  });

  byId('laguForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function saveLagu(event) {
  event.preventDefault();

  const id = Number(valueOf('lagu_id'));
  const payload = {
    c1: valueOf('lagu_c1'),
    c2: valueOf('lagu_c2'),
    c3: valueOf('lagu_c3'),
    c4: valueOf('lagu_c4'),
    c5: valueOf('lagu_c5')
  };

  try {
    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.lagu).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.lagu).insert(payload);

    if (result.error) throw result.error;

    resetLaguForm();
    await loadLaguList();
    showNotice('Susunan lagu berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- PENGUMUMAN -------------------- */

async function loadPengumumanList() {
  const rows = await getTableRows(ADMIN_TABLES.pengumuman);
  ADMIN_CACHE.pengumuman = rows;

  renderRecordList(
    'pengumumanList',
    rows,
    'judul',
    'Pengumuman',
    editPengumuman,
    id => deleteRow(ADMIN_TABLES.pengumuman, id, loadPengumumanList)
  );

  const container = byId('pengumumanList');
  container?.querySelectorAll('.record').forEach((element, index) => {
    const row = rows[index];
    const small = element.querySelector('small');
    if (small && row) {
      small.textContent = `${row.jenis || '-'} · ${row.tanggal || ''}`;
    }
  });
}

function resetPengumumanForm() {
  byId('pengumumanForm')?.reset();
  setValue('peng_id', '');
}

function editPengumuman(id) {
  const row = ADMIN_CACHE.pengumuman.find(item => item.id === id);
  if (!row) return;

  setValue('peng_id', row.id);
  setValue('peng_jenis', row.jenis);
  setValue('peng_judul', row.judul);
  setValue('peng_isi', row.isi);

  byId('pengumumanForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function savePengumuman(event) {
  event.preventDefault();

  const id = Number(valueOf('peng_id'));
  const file = byId('peng_gambar')?.files?.[0];

  const payload = {
    jenis: valueOf('peng_jenis'),
    judul: valueOf('peng_judul'),
    isi: valueOf('peng_isi')
  };

  try {
    if (file) {
      payload.gambar = await uploadFile(file, 'pengumuman');
    }

    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.pengumuman).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.pengumuman).insert(payload);

    if (result.error) throw result.error;

    resetPengumumanForm();
    await loadPengumumanList();
    showNotice('Pengumuman berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- GALERI -------------------- */

async function loadGaleriList() {
  const rows = await getTableRows(ADMIN_TABLES.galeri);
  ADMIN_CACHE.galeri = rows;

  renderRecordList(
    'galeriList',
    rows,
    'judul',
    'Galeri foto',
    editGaleri,
    id => deleteRow(ADMIN_TABLES.galeri, id, loadGaleriList)
  );
}

function resetGaleriForm() {
  byId('galeriForm')?.reset();
  setValue('galeri_id', '');
}

function editGaleri(id) {
  const row = ADMIN_CACHE.galeri.find(item => item.id === id);
  if (!row) return;

  setValue('galeri_id', row.id);
  setValue('galeri_judul', row.judul);

  byId('galeriForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function saveGaleri(event) {
  event.preventDefault();

  const id = Number(valueOf('galeri_id'));
  const file = byId('galeri_gambar')?.files?.[0];

  const payload = {
    judul: valueOf('galeri_judul')
  };

  try {
    if (file) {
      payload.gambar = await uploadFile(file, 'galeri');
    } else if (!id) {
      throw new Error('Pilih foto untuk data galeri baru.');
    }

    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.galeri).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.galeri).insert(payload);

    if (result.error) throw result.error;

    resetGaleriForm();
    await loadGaleriList();
    showNotice('Foto galeri berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- MADAH BHAKTI -------------------- */

async function loadMadahList() {
  const rows = await getTableRows(ADMIN_TABLES.madah);
  ADMIN_CACHE.madah = rows;

  renderRecordList(
    'madahList',
    rows,
    'judul',
    'Madah Bhakti',
    editMadah,
    id => deleteRow(ADMIN_TABLES.madah, id, loadMadahList)
  );
}

function resetMadahForm() {
  byId('madahForm')?.reset();
  setValue('madah_id', '');
}

function editMadah(id) {
  const row = ADMIN_CACHE.madah.find(item => item.id === id);
  if (!row) return;

  setValue('madah_id', row.id);
  setValue('madah_judul', row.judul);
  setValue('madah_isi', row.isi);

  byId('madahForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function saveMadah(event) {
  event.preventDefault();

  const id = Number(valueOf('madah_id'));
  const file = byId('madah_gambar')?.files?.[0];

  const payload = {
    judul: valueOf('madah_judul'),
    isi: valueOf('madah_isi')
  };

  try {
    if (file) {
      payload.gambar = await uploadFile(file, 'madah');
    }

    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.madah).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.madah).insert(payload);

    if (result.error) throw result.error;

    resetMadahForm();
    await loadMadahList();
    showNotice('Madah Bhakti berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- DOKUMEN PDF -------------------- */

async function loadDokumenList() {
  const rows = await getTableRows(ADMIN_TABLES.dokumen);
  ADMIN_CACHE.dokumen = rows;

  renderRecordList(
    'dokumenList',
    rows,
    'judul',
    'Dokumen PDF',
    editDokumen,
    id => deleteRow(ADMIN_TABLES.dokumen, id, loadDokumenList)
  );
}

function resetDokumenForm() {
  byId('dokumenForm')?.reset();
  setValue('dokumen_id', '');
}

function editDokumen(id) {
  const row = ADMIN_CACHE.dokumen.find(item => item.id === id);
  if (!row) return;

  setValue('dokumen_id', row.id);
  setValue('dokumen_judul', row.judul);
  setValue('dokumen_deskripsi', row.deskripsi);

  byId('dokumenForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function saveDokumen(event) {
  event.preventDefault();

  const id = Number(valueOf('dokumen_id'));
  const file = byId('dokumen_file')?.files?.[0];

  const payload = {
    judul: valueOf('dokumen_judul'),
    deskripsi: valueOf('dokumen_deskripsi')
  };

  try {
    if (file) {
      if (file.type !== 'application/pdf') {
        throw new Error('File dokumen harus berformat PDF.');
      }
      payload.file_pdf = await uploadFile(file, 'dokumen');
    } else if (!id) {
      throw new Error('Pilih file PDF untuk dokumen baru.');
    }

    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.dokumen).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.dokumen).insert(payload);

    if (result.error) throw result.error;

    resetDokumenForm();
    await loadDokumenList();
    showNotice('Dokumen berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- UMKM -------------------- */

async function loadUmkmList() {
  const rows = await getTableRows(ADMIN_TABLES.umkm);
  ADMIN_CACHE.umkm = rows;

  renderRecordList(
    'umkmList',
    rows,
    'nama',
    'Data UMKM',
    editUmkm,
    id => deleteRow(ADMIN_TABLES.umkm, id, loadUmkmList)
  );

  const container = byId('umkmList');
  container?.querySelectorAll('.record').forEach((element, index) => {
    const row = rows[index];
    const small = element.querySelector('small');

    if (small && row) {
      small.textContent = `${row.harga || '-'} · ${row.kontak || ''}`;
    }
  });
}

function resetUmkmForm() {
  byId('umkmForm')?.reset();
  setValue('umkm_id', '');
}

function editUmkm(id) {
  const row = ADMIN_CACHE.umkm.find(item => item.id === id);
  if (!row) return;

  setValue('umkm_id', row.id);
  setValue('umkm_nama', row.nama);
  setValue('umkm_harga', row.harga);
  setValue('umkm_kontak', row.kontak);
  setValue('umkm_deskripsi', row.deskripsi);

  byId('umkmForm')?.scrollIntoView({ behavior: 'smooth' });
}

async function saveUmkm(event) {
  event.preventDefault();

  const id = Number(valueOf('umkm_id'));
  const file = byId('umkm_gambar')?.files?.[0];

  const payload = {
    nama: valueOf('umkm_nama'),
    harga: valueOf('umkm_harga'),
    kontak: valueOf('umkm_kontak'),
    deskripsi: valueOf('umkm_deskripsi')
  };

  try {
    if (file) {
      payload.gambar = await uploadFile(file, 'umkm');
    }

    const result = id > 0
      ? await supabaseClient.from(ADMIN_TABLES.umkm).update(payload).eq('id', id)
      : await supabaseClient.from(ADMIN_TABLES.umkm).insert(payload);

    if (result.error) throw result.error;

    resetUmkmForm();
    await loadUmkmList();
    showNotice('Data UMKM berhasil disimpan.');
  } catch (error) {
    showError(error);
  }
}

/* -------------------- MUAT SEMUA DATA -------------------- */

async function loadAllAdminData() {
  try {
    await loadSettingsToForm();

    const jobs = [
      loadLiturgiList(),
      loadPetugasList(),
      loadKolekteList(),
      loadEntropList(),
      loadLaguList(),
      loadLaguHeader(),
      loadPengumumanList(),
      loadGaleriList(),
      loadMadahList(),
      loadDokumenList(),
      loadUmkmList()
    ];

    const results = await Promise.allSettled(jobs);
    const failed = results.filter(item => item.status === 'rejected');

    if (failed.length) {
      console.error('Sebagian data admin gagal dimuat:', failed);
      showNotice(
        `${failed.length} bagian data gagal dimuat. Periksa Console browser dan kebijakan RLS.`,
        'error'
      );
    }
  } catch (error) {
    showError(error);
  }
}

/* -------------------- INISIALISASI -------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  byId('loginForm')?.addEventListener('submit', handleLogin);
  byId('settingsForm')?.addEventListener('submit', saveSettingsForm);
  byId('liturgiForm')?.addEventListener('submit', saveLiturgi);
  byId('petugasForm')?.addEventListener('submit', savePetugas);
  byId('kolekteForm')?.addEventListener('submit', saveKolekte);
  byId('entropForm')?.addEventListener('submit', saveEntrop);
  byId('laguHeaderForm')?.addEventListener('submit', saveLaguHeader);
  byId('laguForm')?.addEventListener('submit', saveLagu);
  byId('pengumumanForm')?.addEventListener('submit', savePengumuman);
  byId('galeriForm')?.addEventListener('submit', saveGaleri);
  byId('madahForm')?.addEventListener('submit', saveMadah);
  byId('dokumenForm')?.addEventListener('submit', saveDokumen);
  byId('umkmForm')?.addEventListener('submit', saveUmkm);

  // Preview otomatis bulat saat memilih foto logo atau DoReMi baru
  byId('logo_paroki_file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) updateCirclePreview('logo_paroki', URL.createObjectURL(f));
  });
  byId('doremi_foto_file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) updateCirclePreview('doremi_foto', URL.createObjectURL(f));
  });

  setValue('lit_tanggal', getTodayJayapura());

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data?.session) {
      await showAdminDashboard();
    }
  } catch (error) {
    showError(error, 'loginNotice');
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      currentAdminUser = null;
      byId('dashboardSection')?.classList.add('hidden');
      byId('loginSection')?.classList.remove('hidden');
      byId('logoutBtn')?.classList.add('hidden');
      return;
    }

    window.setTimeout(async () => {
      try {
        await showAdminDashboard();
      } catch (error) {
        showError(error);
      }
    }, 0);
  });
});