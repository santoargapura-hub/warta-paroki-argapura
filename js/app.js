// APLIKASI UTAMA WARTA PAROKI (SUPABASE BACKEND)

// Canvas Asap Dupa Header
(function(){
  const canvas = document.getElementById('incenseCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize(){
    if(!canvas.parentElement) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  window.addEventListener('resize', resize);
  resize();
  for(let i=0; i<15; i++){
    particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 50,
      r: Math.random() * 18 + 10,
      speedY: Math.random() * 0.6 + 0.3,
      speedX: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.15 + 0.05
    });
  }
  function animate(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y -= p.speedY;
      p.x += Math.sin(p.y * 0.02) * 0.5 + p.speedX;
      p.r += 0.08;
      if(p.y < -50){
        p.y = canvas.height + 20;
        p.x = Math.random() * canvas.width;
        p.r = Math.random() * 18 + 10;
      }
      ctx.beginPath();
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
})();

let dataMadah = [];
let dataUmkm = [];
let dataDokumen = [];
let doremiPlayer = null;
let doremiInterval = null;
let doremiIsPlaying = false;
let doremiVideoId = '';
let forcedLiturgiDate = '';
let activePage = 'home';
let hasInteractiveMedia = false;
let lastPodcastSig = '';
let lastGaleriSig = '';
let lastPengumumanSig = '';

function getTodayDateStr(){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jayapura',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const p = t => parts.find(i => i.type === t)?.value || '';
  return `${p('year')}-${p('month')}-${p('day')}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const dateInput = document.getElementById('inputLiturgiDate');
  if(dateInput) dateInput.value = getTodayDateStr();
  
  await fetchAllData();
  setInterval(fetchAllData, 10000);
  
  renderMadahList();
  renderDokumenList();
  renderUmkmList();
});

function fetchLiturgiDate(dateVal) {
  forcedLiturgiDate = dateVal;
  loadLiturgiData(forcedLiturgiDate);
}

function ytIdJS(url){
  if(!url) return '';
  url = url.trim(); let m;
  if(m = url.match(/v=([a-zA-Z0-9_-]+)/)) return m[1];
  if(m = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)) return m[1];
  if(m = url.match(/embed\/([a-zA-Z0-9_-]+)/)) return m[1];
  if(m = url.match(/live\/([a-zA-Z0-9_-]+)/)) return m[1];
  if(m = url.match(/shorts\/([a-zA-Z0-9_-]+)/)) return m[1];
  return '';
}

function ytEmbedJS(url){
  if(!url) return '';
  const videoId = ytIdJS(url);
  return videoId ? 'https://www.youtube.com/embed/' + videoId + '?rel=0&modestbranding=1' : url.trim();
}

function autoLinkPengumumanJS(text) {
  if (!text) return '';
  const urlRegex = /(?<!href=["\'])(https?:\/\/[^\s<]+)/gi;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #1E3A8A; text-decoration: underline;">$1</a>');
}

function esc(s){
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function updateMediaVisibility() {
  const card = document.getElementById('media-interaktif');
  if (!card) return;
  const bolehTampil = (activePage === 'home' || activePage === 'pengumuman') && hasInteractiveMedia;
  card.style.display = bolehTampil ? 'block' : 'none';
}

// UTAMA: Ambil semua data dari Supabase
async function fetchAllData() {
  try {
    // 1. Settings
    const { data: settingsData } = await supabaseClient.from('warta_settings').select('*');
    if (settingsData) {
      let s = {};
      settingsData.forEach(item => s[item.k] = item.v);
      applySettings(s);
    }

    // 2. Liturgi
    const targetDate = forcedLiturgiDate || getTodayDateStr();
    loadLiturgiData(targetDate);

    // 3. Petugas
    const { data: petugasData } = await supabaseClient.from('warta_petugas').select('*').order('id', {ascending: true});
    if (petugasData) renderPetugas(petugasData);

    // 4. Kolekte Pusat & Entrop
    const { data: kolekteData } = await supabaseClient.from('warta_kolekte').select('*').order('id', {ascending: true});
    if (kolekteData) renderKolektePusat(kolekteData);

    const { data: entropData } = await supabaseClient.from('warta_kolekte_entrop').select('*').order('id', {ascending: true});
    if (entropData) renderKolekteEntrop(entropData);

    // 5. Pengumuman
    const { data: pengData } = await supabaseClient.from('warta_pengumuman').select('*').order('id', {ascending: false});
    if (pengData) renderPengumuman(pengData);

    // 6. Galeri
    const { data: galData } = await supabaseClient.from('warta_galeri').select('*').order('id', {ascending: false});
    if (galData) renderGaleri(galData);

    // 7. Modul Lain
    const { data: madahData } = await supabaseClient.from('warta_madah').select('*').order('judul', {ascending: true});
    if (madahData) { dataMadah = madahData; renderMadahList(); }

    const { data: umkmData } = await supabaseClient.from('warta_umkm').select('*').order('id', {ascending: false});
    if (umkmData) { dataUmkm = umkmData; renderUmkmList(); }

    const { data: dokData } = await supabaseClient.from('warta_dokumen').select('*').order('id', {ascending: false});
    if (dokData) { dataDokumen = dokData; renderDokumenList(); }

    const { data: laguMisaData } = await supabaseClient.from('warta_lagu_misa').select('*').order('id', {ascending: true}).limit(6);
    const { data: laguHeadData } = await supabaseClient.from('warta_lagu_misa_header').select('*').order('id', {ascending: true}).limit(1);
    if(laguHeadData?.[0] && laguMisaData) renderLaguMisa(laguHeadData[0], laguMisaData);

  } catch (err) {
    console.error("Gagal memuat data realtime Supabase:", err);
  }
}

function applySettings(s) {
  if (s.running_text) {
    const rt = document.getElementById('runningTextTrack');
    if (rt && rt.textContent !== s.running_text) rt.textContent = s.running_text;
  }
  if (s.renungan_judul) {
    const rj = document.getElementById('renunganJudul');
    if (rj) rj.innerHTML = '🕊️ ' + esc(s.renungan_judul);
  }
  if (s.renungan_isi) {
    const ri = document.getElementById('renunganIsi');
    if (ri) ri.textContent = s.renungan_isi;
  }

  // Logo Paroki otomatis presisi sesuai lingkaran border
  if (s.logo_paroki && s.logo_paroki.trim() !== '') {
    const logoMark = document.getElementById('brandLogoMark');
    if (logoMark) {
      const currentImg = logoMark.querySelector('img');
      if (!currentImg || currentImg.getAttribute('src') !== s.logo_paroki) {
        logoMark.innerHTML = `<img src="${esc(s.logo_paroki)}" alt="Logo Paroki">`;
      }
    }
  }

  // Live Streaming
  if (s.youtube_judul) {
    const yj = document.getElementById('ytJudul');
    if (yj) yj.innerHTML = '🔴 ' + esc(s.youtube_judul);
  }
  if (s.youtube_link) {
    const emb = ytEmbedJS(s.youtube_link);
    const yF = document.getElementById('ytFrame');
    if (yF && yF.src !== emb) yF.src = emb;
    const yL = document.getElementById('ytLink');
    if (yL) yL.href = s.youtube_link;
  }

  // Podcast (Utama + Semua 1..4)
  if (s.podcast_judul) {
    const pj = document.getElementById('podcastJudulText');
    if (pj) pj.textContent = s.podcast_judul;
  }
  const sigPod = [
    s.podcast_link || '', s.podcast_link2 || '', s.podcast_link3 || '', s.podcast_link4 || '',
    s.podcast_judul || '', s.podcast_judul2 || '', s.podcast_judul3 || '', s.podcast_judul4 || ''
  ].join('|');

  if (sigPod !== lastPodcastSig) {
    lastPodcastSig = sigPod;
    const pEmb = ytEmbedJS(s.podcast_link || '');
    const pFrame = document.getElementById('podcastFrame');
    if (pFrame && pEmb && pFrame.src !== pEmb) pFrame.src = pEmb;
    const pLink = document.getElementById('podcastLink');
    if (pLink && s.podcast_link) pLink.href = s.podcast_link;

    const pHome = document.getElementById('podcastHomeSingle');
    const pEmpty = document.getElementById('podcastEmpty');
    const isPodcastPage = activePage === 'podcast';

    if (!isPodcastPage) {
      if (s.podcast_link && s.podcast_link.trim() !== '') {
        if (pHome) pHome.style.display = 'block';
        if (pEmpty) pEmpty.style.display = 'none';
      } else {
        if (pHome) pHome.style.display = 'none';
        if (pEmpty) pEmpty.style.display = 'block';
      }
    }

    const grid = document.getElementById('podcastGrid');
    if (grid) {
      let html = '';
      let found = 0;
      for (let i = 1; i <= 4; i++) {
        const lk = i === 1 ? 'podcast_link' : 'podcast_link' + i;
        const jk = i === 1 ? 'podcast_judul' : 'podcast_judul' + i;
        const rawLink = (s[lk] || '').trim();
        if (rawLink !== '') {
          const em = ytEmbedJS(rawLink);
          const jd = (s[jk] || '').trim() || ('Podcast ' + i);
          if (em !== '') {
            html += `
              <div style="background:#000;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
                <div style="position:relative;padding-bottom:56.25%;height:0">
                  <iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" src="${esc(em)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                </div>
                <div style="background:#fff;padding:10px 12px;font-size:12px;font-weight:700;color:#1e293b;display:flex;justify-content:space-between;align-items:center;gap:8px">
                  <span>${esc(jd)}</span>
                  <a href="${esc(rawLink)}" target="_blank" rel="noopener noreferrer" style="color:#1E3A8A;text-decoration:none;font-size:11px;white-space:nowrap">▶️ YouTube</a>
                </div>
              </div>
            `;
            found++;
          }
        }
      }
      grid.innerHTML = found > 0
        ? html
        : '<div style="background:#fff;border:2px dashed #FDE68A;border-radius:14px;padding:24px;text-align:center;color:#64748b;grid-column:1/-1">Belum ada daftar video Podcast.</div>';
    }
  }

  // DoReMi (Judul, Foto Bulat Presisi Otomatis, Keterangan, dan Audio)
  if (s.doremi_judul) {
    const jt = document.getElementById('doremiJudulText');
    if (jt) jt.textContent = s.doremi_judul;
    const np = document.getElementById('doremiNowPlaying');
    if (np) np.textContent = s.doremi_judul;
  }
  if (s.doremi_foto !== undefined) {
    const fotoWrap = document.getElementById('doremiFotoWrap');
    if (fotoWrap) {
      if (s.doremi_foto && s.doremi_foto.trim() !== '') {
        const curImg = fotoWrap.querySelector('img');
        if (!curImg || curImg.getAttribute('src') !== s.doremi_foto) {
          fotoWrap.innerHTML = `<img id="doremiFotoImg" src="${esc(s.doremi_foto)}" alt="Foto DoReMi">`;
        }
      } else {
        fotoWrap.textContent = '🎵';
      }
    }
  }
  if (s.doremi_keterangan !== undefined) {
    const ket = document.getElementById('doremiKeterangan');
    if (ket) {
      ket.textContent = s.doremi_keterangan;
      ket.style.display = s.doremi_keterangan.trim() !== '' ? 'block' : 'none';
    }
  }
  if (s.doremi_link !== undefined) {
    const newId = ytIdJS(s.doremi_link);
    if (newId !== doremiVideoId) {
      doremiVideoId = newId;
      const ui = document.getElementById('doremiPlayerUI');
      const empty = document.getElementById('doremiEmptyMsg');
      if (newId !== '') {
        if (ui) ui.style.display = 'block';
        if (empty) empty.style.display = 'none';
        initDoremiPlayer(newId);
      } else {
        if (ui) ui.style.display = 'none';
        if (empty) empty.style.display = 'block';
      }
    }
  }

  // Rekening & Keuangan
  if (s.rekening_info) {
    const ri = document.getElementById('rekeningInfo');
    if (ri) ri.textContent = s.rekening_info;
  }
  if (s.rekening_barcode !== undefined) {
    const wrap = document.getElementById('rekeningBarcodeWrap');
    const imgB = document.getElementById('rekeningBarcodeImg');
    if (s.rekening_barcode && s.rekening_barcode.trim() !== '') {
      if (imgB) imgB.src = s.rekening_barcode;
      if (wrap) wrap.style.display = 'block';
    } else if (wrap) {
      wrap.style.display = 'none';
    }
  }
  if (s.judul_minggu_ini) {
    const jmi = document.getElementById('judulMingguIniDisplay');
    if (jmi) jmi.textContent = s.judul_minggu_ini;
  }
  if (s.kolekte_keterangan !== undefined) {
    const kp = document.getElementById('ketPusat');
    if (kp) {
      kp.textContent = s.kolekte_keterangan;
      kp.style.display = s.kolekte_keterangan.trim() !== '' ? 'block' : 'none';
    }
  }
  if (s.kolekte_entrop_keterangan !== undefined) {
    const ke = document.getElementById('ketEntrop');
    if (ke) {
      ke.textContent = s.kolekte_entrop_keterangan;
      ke.style.display = s.kolekte_entrop_keterangan.trim() !== '' ? 'block' : 'none';
    }
  }
  if (s.laporan_gambar && s.laporan_gambar.trim() !== '') {
    const wrap = document.getElementById('keuanganWrap');
    if (wrap) wrap.innerHTML = `<img src="${esc(s.laporan_gambar)}" style="max-width:100%;border-radius:12px;border:1px solid #e5e7eb;cursor:zoom-in" onclick="openLb('${esc(s.laporan_gambar)}','Laporan Keuangan')">`;
  }

  // Mazmur
  if (s.mazmur_isi !== undefined) {
    const mi = document.getElementById('mazmurIsi');
    if (mi) mi.textContent = s.mazmur_isi;
  }
  if (s.mazmur_gambar && s.mazmur_gambar.trim() !== '') {
    const mImg = document.getElementById('mazmurGambar');
    const mEmpty = document.getElementById('mazmurEmpty');
    if (mImg && mEmpty) {
      mImg.src = s.mazmur_gambar;
      mImg.style.display = 'block';
      mEmpty.style.display = 'none';
    }
  }

  // Media Interaktif (Hanya tampil pada Home & Pengumuman)
  const mediaUrl = (s.media_interaktif_url || '').trim();
  const frame = document.getElementById('mediaInteraktifFrame');
  const cap = document.getElementById('mediaInteraktifCaption');
  if (mediaUrl !== '' && frame) {
    hasInteractiveMedia = true;
    const isVideo = s.media_interaktif_tipe === 'video';
    const existingMedia = frame.querySelector('img, video');
    if (!existingMedia || existingMedia.getAttribute('src') !== mediaUrl || (isVideo && existingMedia.tagName !== 'VIDEO') || (!isVideo && existingMedia.tagName !== 'IMG')) {
      if (isVideo) {
        frame.innerHTML = `<video class="media-interaktif-visual" src="${esc(mediaUrl)}" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>`;
      } else {
        frame.innerHTML = `<img class="media-interaktif-visual" src="${esc(mediaUrl)}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
      }
    }
    if (cap) {
      if (s.media_interaktif_keterangan && s.media_interaktif_keterangan.trim() !== '') {
        cap.textContent = s.media_interaktif_keterangan;
        cap.style.display = 'block';
      } else {
        cap.style.display = 'none';
      }
    }
  } else {
    hasInteractiveMedia = false;
  }
  updateMediaVisibility();
}

async function loadLiturgiData(targetDate) {
  const { data } = await supabaseClient.from('warta_liturgi_bank').select('*').eq('tanggal', targetDate).maybeSingle();
  const b1j = document.getElementById('b1Judul');
  const b1i = document.getElementById('b1Isi');
  const b2j = document.getElementById('b2Judul');
  const b2i = document.getElementById('b2Isi');
  const inj = document.getElementById('injilJudul');
  const inji = document.getElementById('injilIsi');
  const ket = document.getElementById('liturgiKeterangan');

  if (data) {
    if(b1j) b1j.textContent = data.bacaan1_judul || 'Bacaan I';
    if(b1i) b1i.innerHTML = data.bacaan1_isi || '';
    if(b2j) b2j.textContent = data.bacaan2_judul || 'Bacaan II';
    if(b2i) b2i.innerHTML = data.bacaan2_isi || '';
    if(inj) inj.textContent = data.injil_judul || 'Injil';
    if(inji) inji.innerHTML = data.injil_isi || '';
    if(ket) {
      ket.textContent = data.keterangan_liturgi || '';
      ket.style.display = (data.keterangan_liturgi && data.keterangan_liturgi.trim() !== '') ? 'block' : 'none';
    }
  } else {
    if(b1j) b1j.textContent = 'Belum ada data';
    if(b1i) b1i.innerHTML = `<i style="color:#64748b">Tidak ada data bacaan untuk tanggal ${targetDate}.</i>`;
    if(b2j) b2j.textContent = 'Belum ada data';
    if(b2i) b2i.innerHTML = '';
    if(inj) inj.textContent = 'Belum ada data';
    if(inji) inji.innerHTML = '';
    if(ket) ket.style.display = 'none';
  }
}

function renderPetugas(list) {
  const minggu_ini = list.filter(x => x.periode === 'minggu_ini');
  const minggu_depan = list.filter(x => x.periode === 'minggu_depan');
  const pc = document.getElementById('petugasContainer');
  if(pc) {
    pc.innerHTML = renderTableHTML(minggu_ini, '', false) + renderTableHTML(minggu_depan, 'Sabtu & Minggu Akan Datang', true);
  }
}

function renderTableHTML(list, title, showTitle) {
  let h = '';
  if(showTitle && title) h += `<h3 style='margin:18px 0 8px;color:var(--hijau-tua)'>${esc(title)}</h3>`;
  h += `<div class='petugas-scroll-full'><table class='warta'><tr><th>PELAYANAN</th>`;
  list.forEach(p => { h += `<th>${esc(p.misa||'').toUpperCase().replace(/\n/g,'<br>')}</th>`; });
  h += `</tr>`;
  const fields = [
    ['koor','Koor Pemandu'],['akolit','Akolit'],['lektor','Lektor'],['pemazmur','Pemazmur'],
    ['dirigen','Dirigen'],['organis','Organis'],['misdinar','Misdinar'],['tatalaksana','Tata Laksana'],
    ['imam','Imam'],['piket','Piket Liturgi'],['hias','Hias Altar'],['parkir','Parkir'],['komuni','Pengantar Komuni']
  ];
  fields.forEach(f => {
    h += `<tr><td><b>${f[1]}</b></td>`;
    list.forEach(p => { h += `<td>${esc(p[f[0]]||'-').replace(/\n/g,'<br>')}</td>`; });
    h += `</tr>`;
  });
  h += `</table></div>`;
  return h;
}

function parseRp(str){
  if(!str) return 0;
  let clean = str.toString().replace(/[^0-9]/g, '');
  return clean === '' ? 0 : parseInt(clean, 10);
}
function formatRp(angka){
  angka = angka.toString().replace(/[^0-9]/g,'');
  if(angka==='') return '0';
  return angka.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function renderKolektePusat(data) {
  let html = '';
  let t1=0, t2=0, t3=0, tL=0;
  data.forEach(k => {
    t1 += parseRp(k.ket1);
    t2 += parseRp(k.ket2);
    t3 += parseRp(k.ket3);
    tL += parseRp(k.ket_lain);
    html += `<tr><td>${esc(k.uraian)}</td><td class="kolekte-num">${esc(k.ket1)}</td><td class="kolekte-num">${esc(k.ket2)}</td><td class="kolekte-num">${esc(k.ket3||'')}</td><td class="kolekte-num">${esc(k.ket_lain)}</td></tr>`;
  });
  const tb = document.querySelector('#tblPusat tbody');
  if(tb) tb.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:#64748b">Belum ada data kolekte pusat.</td></tr>';
  const e1 = document.getElementById('webTotalPusat1');
  const e2 = document.getElementById('webTotalPusat2');
  const e3 = document.getElementById('webTotalPusat3');
  const eL = document.getElementById('webTotalPusatLain');
  if(e1) e1.textContent = formatRp(t1);
  if(e2) e2.textContent = formatRp(t2);
  if(e3) e3.textContent = formatRp(t3);
  if(eL) eL.textContent = formatRp(tL);
}

function renderKolekteEntrop(data) {
  let html = '';
  let t1=0, t2=0, tL=0;
  data.forEach(k => {
    t1 += parseRp(k.tabel1);
    t2 += parseRp(k.tabel2);
    tL += parseRp(k.ket_lain);
    html += `<tr><td>${esc(k.uraian)}</td><td class="kolekte-num">${esc(k.tabel1)}</td><td class="kolekte-num">${esc(k.tabel2)}</td><td class="kolekte-num">${esc(k.ket_lain)}</td></tr>`;
  });
  const tb = document.querySelector('#tblEntrop tbody');
  if(tb) tb.innerHTML = html || '<tr><td colspan="4" style="text-align:center;color:#64748b">Belum ada data kolekte Stasi Entrop.</td></tr>';
  const e1 = document.getElementById('webTotalEntrop1');
  const e2 = document.getElementById('webTotalEntrop2');
  const eL = document.getElementById('webTotalEntropLain');
  if(e1) e1.textContent = formatRp(t1);
  if(e2) e2.textContent = formatRp(t2);
  if(eL) eL.textContent = formatRp(tL);
}

function renderPengumuman(list) {
  const sig = JSON.stringify(list);
  if (sig === lastPengumumanSig) return; // <-- Jangan render ulang jika data sama
  lastPengumumanSig = sig;

  const kawin = list.filter(x => x.jenis === 'perkawinan');
  const keg = list.filter(x => x.jenis === 'kegiatan');
  
  const pkBox = document.getElementById('pengKawin');
  if(pkBox) {
    if(kawin.length === 0) pkBox.innerHTML = "<div style='color:#64748b;font-size:13px'>Belum ada.</div>";
    else {
      pkBox.innerHTML = kawin.map(p => `
        <div class='pengumuman-item' style='border-left:3px solid var(--emas);padding:10px 12px;background:#FFFBF0;border-radius:0 10px 10px 0;margin:10px 0; cursor:pointer;' onclick='togglePengumuman(this, event)'>
          <div style='display:flex; justify-content:space-between; align-items:center;'>
            <b style='flex:1; font-size:14px; color:#111827;'>${esc(p.judul)}</b>
            <span class='toggle-icon' style='font-size:14px; transition:transform 0.3s; color:#1E3A8A;'>▼</span>
          </div>
          <div style='font-size:12px;color:#64748b; margin-top:4px;'>${p.tanggal ? new Date(p.tanggal).toLocaleDateString('id-ID') : ''}</div>
          <div class='peng-content' style='display:none; border-top:1px dashed #cbd5e1; padding-top:10px; margin-top:10px;'>
            <div class='peng-isi' style='color:#374151'>${autoLinkPengumumanJS(p.isi||'')}</div>
            ${p.gambar ? `<img src="${esc(p.gambar)}" style="width:140px;height:100px;object-fit:cover;border-radius:8px;margin-top:10px;cursor:zoom-in" onclick="openLb('${esc(p.gambar)}','${esc(p.judul)}')">` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  const pkgBox = document.getElementById('pengKegiatan');
  if(pkgBox) {
    if(keg.length === 0) pkgBox.innerHTML = "<div style='color:#64748b'>Belum ada.</div>";
    else {
      pkgBox.innerHTML = keg.map(p => `
        <div class='pengumuman-item' style='border:1px solid #e5e7eb;padding:12px;border-radius:12px;margin:10px 0; cursor:pointer;' onclick='togglePengumuman(this, event)'>
          <div style='display:flex; justify-content:space-between; align-items:center;'>
            <b style='flex:1; font-size:14px; color:#111827;'>${esc(p.judul)}</b>
            <span class='toggle-icon' style='font-size:14px; transition:transform 0.3s; color:#1E3A8A;'>▼</span>
          </div>
          <div style='font-size:12px;color:#64748b; margin-top:4px;'>${p.tanggal ? new Date(p.tanggal).toLocaleDateString('id-ID') : ''}</div>
          <div class='peng-content' style='display:none; border-top:1px dashed #cbd5e1; padding-top:10px; margin-top:10px;'>
            <div class='peng-isi' style='color:#374151'>${autoLinkPengumumanJS(p.isi||'')}</div>
            ${p.gambar ? `<img src="${esc(p.gambar)}" style="width:140px;height:100px;object-fit:cover;border-radius:8px;margin-top:10px;cursor:zoom-in" onclick="openLb('${esc(p.gambar)}','${esc(p.judul)}')">` : ''}
          </div>
        </div>
      `).join('');
    }
  }
}

function renderGaleri(list) {
  const track = document.getElementById('galeriTrack');
  if(!track) return;
  const sig = JSON.stringify(list);
  if (sig === lastGaleriSig) return;
  lastGaleriSig = sig;

  if(list.length === 0) {
    track.innerHTML = '<div style="color:#64748b;padding:20px;">Belum ada foto galeri.</div>';
    return;
  }
  track.innerHTML = list.map(g => `
    <div class='galeri-item' onclick="openLb('${esc(g.gambar)}','${esc(g.judul)}')">
      <img src='${esc(g.gambar)}' loading='lazy'><p>${esc(g.judul)}</p>
    </div>
  `).join('');
}

// Efek Transisi Galeri Foto Bergerak Otomatis (Sama seperti index(5).php)
(function(){
  const track = document.getElementById('galeriTrack');
  if(!track) return;
  let idx = 0;
  const itemW = 234;
  let timer = null;
  let isDown = false, startX = 0, moved = 0;

  function autoGaleri(){
    if(isDown || track.matches(':hover')) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    if(maxScroll <= 0) return;
    idx++;
    if(track.scrollLeft + 5 >= maxScroll){
      idx = 0;
    }
    track.scrollTo({ left: idx * itemW, behavior: 'smooth' });
  }

  timer = setInterval(autoGaleri, 2800);

  track.addEventListener('touchstart', (e) => {
    isDown = true;
    startX = e.touches[0].clientX;
    moved = 0;
    clearInterval(timer);
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    moved = Math.abs(e.touches[0].clientX - startX);
  }, { passive: true });

  track.addEventListener('touchend', () => {
    isDown = false;
    timer = setInterval(autoGaleri, 2800);
    setTimeout(() => { moved = 0; }, 200);
  }, { passive: true });

  track.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.clientX;
    moved = 0;
    clearInterval(timer);
  });

  track.addEventListener('mousemove', (e) => {
    if(isDown) moved = Math.abs(e.clientX - startX);
  });

  track.addEventListener('mouseup', () => {
    isDown = false;
    timer = setInterval(autoGaleri, 2800);
    setTimeout(() => { moved = 0; }, 200);
  });

  window._galeriMoved = () => moved > 12;
})();

function renderLaguMisa(head, list) {
  const tr = document.getElementById('laguMisaHeader');
  if(tr && head) {
    tr.innerHTML = `<th>${esc(head.h1||'Bagian')}</th><th>${esc(head.h2||'Misa 1')}</th><th>${esc(head.h3||'Misa 2')}</th><th>${esc(head.h4||'Misa 3')}</th><th>${esc(head.h5||'Stasi')}</th>`;
  }
  const tb = document.getElementById('laguMisaBody');
  if(tb && list) {
    tb.innerHTML = list.map(row => `
      <tr><td>${esc(row.c1||'-')}</td><td>${esc(row.c2||'-')}</td><td>${esc(row.c3||'-')}</td><td>${esc(row.c4||'-')}</td><td>${esc(row.c5||'-')}</td></tr>
    `).join('');
  }
}

// DoReMi Youtube Audio Player API
function initDoremiPlayer(videoId) {
  if(window.YT && window.YT.Player) {
    createYtPlayer(videoId);
  } else {
    window.onYouTubeIframeAPIReady = function() {
      createYtPlayer(videoId);
    };
    if(!document.getElementById('ytIframeApiScript')) {
      const tag = document.createElement('script');
      tag.id = 'ytIframeApiScript';
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }
}

function createYtPlayer(videoId) {
  if(doremiPlayer && typeof doremiPlayer.loadVideoById === 'function') {
    doremiPlayer.loadVideoById(videoId);
    doremiPlayer.pauseVideo();
    return;
  }
  doremiPlayer = new YT.Player('doremiPlayerHidden', {
    height: '1', width: '1',
    videoId: videoId,
    host: 'https://www.youtube-nocookie.com',
    playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0 },
    events: {
      'onStateChange': function(ev) {
        if(ev.data === 0) {
          doremiIsPlaying = false;
          const btn = document.getElementById('doremiPlayBtn');
          if(btn) btn.innerHTML = '▶️';
          clearInterval(doremiInterval);
        }
      }
    }
  });
}

function toggleDoremi() {
  if(!doremiPlayer) return;
  const btn = document.getElementById('doremiPlayBtn');
  if(doremiIsPlaying) {
    doremiPlayer.pauseVideo();
    btn.innerHTML = '▶️';
    doremiIsPlaying = false;
    clearInterval(doremiInterval);
  } else {
    doremiPlayer.playVideo();
    btn.innerHTML = '⏸️';
    doremiIsPlaying = true;
    doremiInterval = setInterval(updateDoremiProgress, 500);
  }
}

function updateDoremiProgress() {
  if(!doremiPlayer || !doremiIsPlaying) return;
  const cur = doremiPlayer.getCurrentTime();
  const dur = doremiPlayer.getDuration();
  const pct = dur > 0 ? (cur / dur * 100) : 0;
  const pb = document.getElementById('doremiProgress');
  if(pb) pb.style.width = pct + '%';
  const ct = document.getElementById('doremiTime');
  if(ct) ct.textContent = formatTime(cur);
}

function seekDoremi(e) {
  if(!doremiPlayer) return;
  const bar = e.currentTarget;
  const rect = bar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  doremiPlayer.seekTo(pct * doremiPlayer.getDuration(), true);
}

function formatTime(s) {
  if(!s || isNaN(s)) return '00:00';
  s = Math.floor(s);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}

// Navigasi & UI Interaktif
function clickHomeMenu() {
  showHome();
}

function showHome() {
  activePage = 'home';
  document.getElementById('menu-utama').style.display = 'block';
  document.getElementById('global-back-bar').style.display = 'none';
  updateMediaVisibility();
  
  const cards = document.querySelectorAll('.container .card');
  cards.forEach(c => {
    if(['youtube','podcast','doremi','bacaan','mazmur','galeri'].includes(c.id)) {
      c.style.display = 'block';
    } else {
      c.style.display = 'none';
    }
  });
  document.querySelectorAll('.grid2').forEach(g => g.style.display = 'grid');

  const laguMisaSec = document.getElementById('laguMisaSection');
  if(laguMisaSec) laguMisaSec.style.display = 'block';

  const homeSingle = document.getElementById('podcastHomeSingle');
  const allWrap = document.getElementById('podcastAllWrap');
  if(homeSingle) homeSingle.style.display = 'block';
  if(allWrap) allWrap.style.display = 'none';
  const badge = document.getElementById('podcastBadge');
  if(badge) badge.textContent = 'TERBARU';

  window.scrollTo({top:0, behavior:'smooth'});
}

function showPage(target) {
  activePage = target;
  document.getElementById('menu-utama').style.display = 'none';
  document.getElementById('global-back-bar').style.display = 'block';
  updateMediaVisibility();

  const cards = document.querySelectorAll('.container .card');
  cards.forEach(c => c.style.display = 'none');
  document.querySelectorAll('.grid2').forEach(g => g.style.display = 'none');

  const laguMisaSec = document.getElementById('laguMisaSection');
  if(laguMisaSec) laguMisaSec.style.display = (target === 'liturgi') ? 'block' : 'none';

  if(target === 'liturgi') {
    document.getElementById('bacaan').style.display = 'block';
    document.getElementById('mazmur').style.display = 'block';
    document.getElementById('bacaan').closest('.grid2').style.display = 'grid';
  } else {
    const el = document.getElementById(target);
    if(el) {
      el.style.display = 'block';
      let parentGrid = el.closest('.grid2');
      if(parentGrid) parentGrid.style.display = 'grid';
    }
  }

  if(target === 'podcast') {
    const homeSingle = document.getElementById('podcastHomeSingle');
    const allWrap = document.getElementById('podcastAllWrap');
    const emptyMsg = document.getElementById('podcastEmpty');
    if(homeSingle) homeSingle.style.display = 'none';
    if(emptyMsg) emptyMsg.style.display = 'none';
    if(allWrap) allWrap.style.display = 'block';
    const badge = document.getElementById('podcastBadge');
    if(badge) badge.textContent = 'VIDEO LENGKAP';
  }

  if(target === 'keuangan') {
    navKeu('home');
  }

  if(target === 'madah') {
    document.getElementById('madah-list-view').style.display = 'block';
    document.getElementById('madah-detail-view').style.display = 'none';
  }
  if(target === 'dokumen') {
    document.getElementById('dokumen-list-view').style.display = 'block';
    document.getElementById('dokumen-viewer-view').style.display = 'none';
  }
  window.scrollTo({top:0, behavior:'smooth'});
}

document.querySelectorAll('.menu-tile').forEach(a => {
  const href = a.getAttribute('href') || '';
  if(href.startsWith('#') && href.length > 1) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(href.slice(1));
    });
  }
});

function togglePengumuman(el, event) {
  if(event && event.target && event.target.tagName === 'IMG') return;
  const content = el.querySelector('.peng-content');
  const icon = el.querySelector('.toggle-icon');
  if(content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  } else {
    content.style.display = 'none';
    icon.style.transform = 'rotate(0deg)';
  }
}

function navKeu(view) {
  document.getElementById('keu-home').style.display = (view === 'home') ? 'block' : 'none';
  document.getElementById('keu-laporan').style.display = (view === 'laporan') ? 'block' : 'none';
  document.getElementById('keu-kolekte').style.display = (view === 'kolekte') ? 'block' : 'none';
}

function openMadah(id) {
  const item = dataMadah.find(m => m.id == id);
  if(item) {
    document.getElementById('detail-madah-title').textContent = item.judul;
    let html = item.isi || '';
    if(item.gambar) {
      html += `<img src="${esc(item.gambar)}" style="max-width:100%;border-radius:12px;margin-top:16px;cursor:zoom-in" onclick="openLb('${esc(item.gambar)}','${esc(item.judul)}')">`;
    }
    document.getElementById('detail-madah-content').innerHTML = html;
    document.getElementById('madah-list-view').style.display = 'none';
    document.getElementById('madah-detail-view').style.display = 'block';
  }
}
function closeMadahDetail() {
  document.getElementById('madah-list-view').style.display = 'block';
  document.getElementById('madah-detail-view').style.display = 'none';
}
function renderMadahList(filter='') {
  const c = document.getElementById('container-list-madah');
  if(!c) return;
  let filtered = dataMadah;
  if(filter.trim() !== '') {
    const f = filter.toLowerCase();
    filtered = dataMadah.filter(m => m.judul.toLowerCase().includes(f));
  }
  if(filtered.length === 0) c.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;">Tidak ada lagu ditemukan.</div>';
  else {
    c.innerHTML = filtered.map(m => `
      <div class="drill-item" onclick="openMadah(${m.id})">
        <span style="flex:1;">${esc(m.judul)}</span>
        <span style="color:var(--emas);">➔</span>
      </div>
    `).join('');
  }
}
function filterMadahList() {
  const val = document.getElementById('searchMadahInput').value;
  renderMadahList(val);
}

function openDokumenViewer(id) {
  const d = dataDokumen.find(x => x.id == id);
  if(!d) return;
  document.getElementById('dokumenTitle').textContent = d.judul;
  document.getElementById('dokumenDesc').textContent = d.deskripsi || '';
  document.getElementById('pdfIframe').src = d.file_pdf;
  document.getElementById('dokumenPrintBtn').href = d.file_pdf;
  
  document.getElementById('dokumen-list-view').style.display = 'none';
  document.getElementById('dokumen-viewer-view').style.display = 'block';
}
function closeDokumenViewer() {
  document.getElementById('pdfIframe').src = '';
  document.getElementById('dokumen-list-view').style.display = 'block';
  document.getElementById('dokumen-viewer-view').style.display = 'none';
}
function renderDokumenList() {
  const c = document.getElementById('dokumenContainer');
  if(!c) return;
  if(dataDokumen.length === 0) {
    c.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;">Belum ada dokumen PDF.</div>';
  } else {
    c.innerHTML = dataDokumen.map(d => `
      <div class="drill-item" onclick="openDokumenViewer(${d.id})">
        <span style="display:flex;align-items:center;gap:10px;"><span style="font-size:20px">📄</span> ${esc(d.judul)}</span>
        <span style="color:var(--emas);">➔</span>
      </div>
    `).join('');
  }
}

function openUmkmDetail(id) {
  const item = dataUmkm.find(u => u.id == id);
  if(!item) return;
  const modal = document.getElementById('umkmModal');
  const body = document.getElementById('umkmModalBody');
  let waBtn = '';
  if(item.kontak && item.kontak.trim() !== '') {
    let clean = item.kontak.replace(/[^0-9]/g, '');
    if(clean.startsWith('0')) clean = '62' + clean.slice(1);
    waBtn = `<a href="https://wa.me/${clean}?text=Halo,%20saya%20tertarik%20dengan%20produk%20${encodeURIComponent(item.nama)}" target="_blank" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:12px;margin-top:16px;text-align:center;width:100%;">💬 Hubungi Penjual via WhatsApp</a>`;
  }
  body.innerHTML = `
    <img src="${esc(item.gambar)}" style="width:100%;height:220px;object-fit:cover;border-radius:14px;">
    <h3 style="font-family:'Playfair Display',serif;color:var(--hijau-tua);font-size:20px;margin-top:14px;">${esc(item.nama)}</h3>
    <div style="font-weight:800;color:#b45309;margin-top:6px;">${esc(item.harga)}</div>
    <div style="margin-top:12px;font-size:14px;color:#374151;white-space:pre-wrap;">${esc(item.deskripsi)}</div>
    ${waBtn}
  `;
  modal.style.display = 'grid';
}
function closeUmkmModal() {
  document.getElementById('umkmModal').style.display = 'none';
}
function renderUmkmList() {
  const c = document.getElementById('umkmContainer');
  if(!c) return;
  if(dataUmkm.length === 0) {
    c.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;">Belum ada produk UMKM.</div>';
  } else {
    c.innerHTML = `<div class="umkm-grid">` + dataUmkm.map(u => `
      <div class="umkm-card" onclick="openUmkmDetail(${u.id})">
        <span class="umkm-badge-tag">UMKM</span>
        <div class="umkm-img-wrap"><img src="${esc(u.gambar)}" loading="lazy"></div>
        <div class="umkm-info">
          <div class="umkm-title">${esc(u.nama)}</div>
          <div class="umkm-price">${esc(u.harga)}</div>
          <div class="umkm-desc-preview">${esc(u.deskripsi)}</div>
        </div>
      </div>
    `).join('') + `</div>`;
  }
}

function openLb(src, judul) {
  if(window._galeriMoved && window._galeriMoved()) return;
  const lb = document.getElementById('galeriLightbox');
  document.getElementById('lbImg').src = src;
  document.getElementById('lbCaption').textContent = judul || '';
  lb.classList.add('show');
}
function closeLb() {
  document.getElementById('galeriLightbox').classList.remove('show');
}

showHome();
