/* Fitur publik Warta: formulir digital, arsip pengunjung, judul kolekte, tema. */
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.supabaseClient||(typeof supabaseClient!=='undefined'?supabaseClient:null);

function applyTheme(name) {
    name = name || 'incense';

    document.body.dataset.wartaTheme = name;

    const header = document.querySelector('.header');
    if (!header) return;

    header.style.position = 'relative';
    header.style.overflow = 'hidden';
    header.style.isolation = 'isolate';

    let fx = header.querySelector('#wartaThemeFx');

    if (!fx) {
        fx = document.createElement('div');
        fx.id = 'wartaThemeFx';
        fx.setAttribute('aria-hidden', 'true');
        header.insertBefore(fx, header.firstChild);
    }

    fx.innerHTML = '';

    // TEMA NATAL: SALJU DAN BINTANG
    if (name === 'christmas') {

        for (let i = 0; i < 40; i++) {
            const snow = document.createElement('i');
            snow.className = 'warta-snow';

            snow.style.left = Math.random() * 100 + '%';
            snow.style.animationDelay = -Math.random() * 12 + 's';
            snow.style.animationDuration = (6 + Math.random() * 8) + 's';

            fx.appendChild(snow);
        }

        for (let i = 0; i < 25; i++) {
            const star = document.createElement('b');
            star.className = 'warta-star';
            star.textContent = '✦';

            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 85 + '%';
            star.style.animationDelay = -Math.random() * 4 + 's';

            fx.appendChild(star);
        }
    }

    // TEMA ADVEN, PASKAH, PRAPASKAH, ROSARIO
    else {
        let symbol = '';

        if (name === 'advent') symbol = '✧';
        if (name === 'easter') symbol = '✦';
        if (name === 'lent') symbol = '✝';
        if (name === 'rosary') symbol = '✧';

        if (symbol) {
            for (let i = 0; i < 20; i++) {
                const item = document.createElement('b');

                item.className = 'warta-glow';
                item.textContent = symbol;

                item.style.left = Math.random() * 100 + '%';
                item.style.top = Math.random() * 85 + '%';
                item.style.animationDelay = -Math.random() * 5 + 's';

                fx.appendChild(item);
            }
        }
    }
}

const css = document.createElement('style');

css.textContent = `
.header {
    position: relative !important;
    overflow: hidden !important;
    isolation: isolate;
}

#wartaThemeFx {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
    z-index: 2;
}

.header #incenseCanvas {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
}

.header .topbar,
.header .running-text {
    position: relative;
    z-index: 3;
}

#wartaThemeFx .warta-snow {
    position: absolute;
    top: -15px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 9px white;
    animation: wartaSnowFall linear infinite;
}

#wartaThemeFx .warta-star {
    position: absolute;
    color: #ffe9a6;
    font-size: 17px;
    text-shadow: 0 0 12px #fff;
    animation: wartaTwinkle 2s ease-in-out infinite alternate;
}

#wartaThemeFx .warta-glow {
    position: absolute;
    color: #f5d78e;
    font-size: 20px;
    text-shadow: 0 0 14px #f5d78e;
    animation: wartaTwinkle 3s ease-in-out infinite alternate;
}

@keyframes wartaSnowFall {
    from {
        transform: translateY(0) translateX(0);
    }
    to {
        transform: translateY(300px) translateX(25px);
    }
}

@keyframes wartaTwinkle {
    from {
        opacity: .2;
        transform: scale(.7);
    }
    to {
        opacity: 1;
        transform: scale(1.2);
    }
}

/* WARNA HEADER BERDASARKAN TEMA */

body[data-warta-theme="incense"] .header {
    background: linear-gradient(135deg,#0F2A5E,#1E3A8A,#0F2A5E);
}

body[data-warta-theme="christmas"] .header {
    background: linear-gradient(135deg,#082d22,#14532d,#0b2545);
}

body[data-warta-theme="advent"] .header {
    background: linear-gradient(135deg,#32145e,#5b2b82,#241044);
}

body[data-warta-theme="easter"] .header {
    background: linear-gradient(135deg,#173b68,#32699a,#b99b58);
}

body[data-warta-theme="lent"] .header {
    background: linear-gradient(135deg,#241044,#4c2c70,#241044);
}

body[data-warta-theme="rosary"] .header {
    background: linear-gradient(135deg,#102e58,#234d83,#172b4d);
}

body[data-warta-theme="minimal"] .header {
    background: #ffffff;
    color: #17345f;
}

body[data-warta-theme="minimal"] #incenseCanvas {
    display: none !important;
}
`;

document.head.appendChild(css);
const originalApply=window.applySettings;if(typeof originalApply==='function'){window.applySettings=function(s){originalApply(s);applyTheme(s.theme_preset||'incense');applyHeaders(s);};}
function applyHeaders(s={}){const p=document.querySelectorAll('#headerPusatRow th'),e=document.querySelectorAll('#headerEntropRow th');p.forEach((th,i)=>{const v=s['kolekte_pusat_header_'+i];if(v)th.textContent=v;});e.forEach((th,i)=>{const v=s['kolekte_entrop_header_'+i];if(v)th.textContent=v;});}
const oldP=window.renderKolektePusat,oldE=window.renderKolekteEntrop;if(typeof oldP==='function')window.renderKolektePusat=function(data){oldP(data);loadSettingsHeaders();};if(typeof oldE==='function')window.renderKolekteEntrop=function(data){oldE(data);loadSettingsHeaders();};
async function loadSettingsHeaders(){try{const {data,error}=await sb().from('warta_settings').select('*');if(error)throw error;const s={};(data||[]).forEach(x=>s[x.k]=x.v);applyHeaders(s);applyTheme(s.theme_preset||'incense');}catch(e){console.warn('Pengaturan tampilan kolekte/tema:',e.message);}}
function addFormStyles(){if(document.getElementById('wartaFormStyle'))return;const st=document.createElement('style');st.id='wartaFormStyle';st.textContent=`.warta-form-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:15px;margin:10px 0}.warta-form-card button,.warta-form-modal button{border:0;border-radius:9px;padding:10px 14px;background:#1e3a8a;color:white;font-weight:700;cursor:pointer}.warta-form-modal{position:fixed;inset:0;background:#0b173dcc;z-index:10020;display:grid;place-items:center;padding:14px}.warta-form-modal>div{background:#fff;border-radius:16px;max-width:760px;width:100%;max-height:92vh;overflow:auto;padding:20px}.warta-form-modal label{display:block;font-weight:600;margin:12px 0}.warta-form-modal input,.warta-form-modal textarea,.warta-form-modal select{width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;margin-top:5px;font:inherit}.warta-form-modal .warta-form-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}`;document.head.appendChild(st);}
async function loadPublishedForms(){const c=document.getElementById('dokumenContainer');if(!c||c.dataset.formsLoaded==='1')return;c.dataset.formsLoaded='1';try{const {data,error}=await sb().from('warta_formulir').select('*').eq('status','published').order('created_at',{ascending:false});if(error)throw error;if(!data?.length)return;addFormStyles();const heading=document.createElement('h3');heading.textContent='Formulir Digital';heading.style.cssText='margin:18px 0 8px;color:var(--hijau-tua)';c.appendChild(heading);data.forEach(f=>{const card=document.createElement('div');card.className='warta-form-card';card.innerHTML=`<b>📝 ${esc(f.judul)}</b><p>${esc(f.deskripsi||'')}</p><button type="button">Isi Formulir</button>`;card.querySelector('button').onclick=()=>openPublicForm(f);c.appendChild(card);});}catch(e){console.error('Gagal memuat formulir terbit:',e);c.dataset.formsLoaded='0';}}
function openPublicForm(f){addFormStyles();const modal=document.createElement('div');modal.className='warta-form-modal';const fields=Array.isArray(f.fields)?f.fields:[];modal.innerHTML=`<div><button type="button" class="wf-close" style="float:right">Tutup ✕</button><div style="text-align:center">${f.kop_logo?`<img src="${esc(f.kop_logo)}" style="width:68px;height:68px;object-fit:contain">`:''}<h3>${esc(f.kop_nama||'PAROKI ST. PETRUS DAN PAULUS ARGAPURA')}</h3><p>${esc(f.kop_alamat||'')}</p></div><hr><h3 style="text-align:center">${esc(f.judul)}</h3><p>${esc(f.deskripsi||'')}</p><form id="wartaPublicForm"><label>Nama pemohon<input name="_nama" required></label>${fields.map((x,i)=>`<label>${esc(x.label)}${x.type==='textarea'?`<textarea name="${esc(x.id)}" ${x.required?'required':''}></textarea>`:x.type==='select'?`<select name="${esc(x.id)}" required><option value="">Pilih</option>${(x.options||[]).map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`:`<input name="${esc(x.id)}" type="${['text','date','number','email'].includes(x.type)?x.type:'text'}" ${x.required?'required':''}>`}</label>`).join('')}<p>${esc(f.keterangan_bawah||'')}</p><div class="warta-form-actions"><button type="submit">Kirim & Buat PDF</button></div></form></div>`;modal.querySelector('.wf-close').onclick=()=>modal.remove();modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});modal.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),answers={};fields.forEach(x=>answers[x.id]=fd.get(x.id)||'');const name=String(fd.get('_nama')||'').trim();const snapshot={judul:f.judul,deskripsi:f.deskripsi,kop_nama:f.kop_nama,kop_alamat:f.kop_alamat,kop_logo:f.kop_logo,keterangan_bawah:f.keterangan_bawah,label_ttd_pemohon:f.label_ttd_pemohon,label_ttd_admin:f.label_ttd_admin,nama_ttd_admin:f.nama_ttd_admin,tempat_tanggal:f.tempat_tanggal,fields};const payload={formulir_id:f.id,judul_formulir:f.judul,nama_pemohon:name,jawaban:answers,snapshot_formulir:snapshot,status:'diajukan'};try{const {error}=await sb().from('warta_formulir_arsip').insert(payload);if(error)throw error;printDraft(payload);modal.remove();alert('Pengisian berhasil dikirim dan disimpan sebagai arsip. Silakan cetak atau simpan PDF.');}catch(e){alert('Gagal mengirim formulir: '+e.message);}};document.body.appendChild(modal);}
function printDraft(a){const s=a.snapshot_formulir,ans=a.jawaban;const rows=s.fields.map(f=>`<tr><th>${esc(f.label)}</th><td>${esc(ans[f.id]||'')}</td></tr>`).join('');const w=window.open('','_blank');if(!w){alert('Izinkan pop-up browser untuk membuat PDF.');return;}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.judul_formulir)}</title><style>@page{size:A4;margin:20mm}body{font:12pt Arial;color:#222}.kop{text-align:center;display:flex;align-items:center;gap:14px}.kop img{width:75px;height:75px;object-fit:contain}.kop div{flex:1}hr{border:0;border-top:3px double #222}h3{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:8px;text-align:left}.sign{display:flex;justify-content:space-between;text-align:center;margin-top:45px}.sign div{width:42%}</style></head><body><div class="kop">${s.kop_logo?`<img src="${esc(s.kop_logo)}">`:''}<div><b>${esc(s.kop_nama||'')}</b><p>${esc(s.kop_alamat||'')}</p></div></div><hr><h3>${esc(a.judul_formulir)}</h3><p>${esc(s.deskripsi||'')}</p><table>${rows}</table><p>${esc(s.keterangan_bawah||'')}</p><div class="sign"><div>${esc(s.label_ttd_pemohon||'Pemohon')}<br><br><br><b>${esc(a.nama_pemohon)}</b></div><div>${esc(s.tempat_tanggal||'Jayapura')}, ${new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jayapura'})}<br>${esc(s.label_ttd_admin||'Mengetahui')}<br><br><br><b>${esc(s.nama_ttd_admin||'')}</b></div></div><script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);w.document.close();}
const oldRender=window.renderDokumenList;if(typeof oldRender==='function')window.renderDokumenList=function(){oldRender();const c=document.getElementById('dokumenContainer');if(c)c.dataset.formsLoaded='0';loadPublishedForms();};
document.addEventListener('DOMContentLoaded',()=>{loadSettingsHeaders();setTimeout(loadPublishedForms,1200);});
})();
