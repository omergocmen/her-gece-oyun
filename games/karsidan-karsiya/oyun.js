// Gece Yarısı Karşıdan Karşıya: oyun döngüsü, girdiler (dokunma, kaydırma, klavye), HUD, kayıt ve sesler.
// Kurallar mantik.js'te (window.KarsiMantik), çizim sahne.js'te.
import { sahneOlustur, ZEMIN } from './sahne.js';
import { sesOlustur } from './ses.js';

const M = window.KarsiMantik;
const Depo = window.Depo;
const DEPO_ANAHTARI = 'karsidan:kayit';
const ZIPLAMA = 0.12;      // bir hücre zıplama süresi (sn)
const OLUM_BEKLEME = 0.6;  // çarpmadan sonuç paneline kadar
const KUYRUK_SINIRI = 3;   // art arda dokunuşlar kaybolmasın diye tampon
const KAYDIRMA_ESIGI = 26; // px
// Kameranın oyuncunun ne kadar önüne baktığı: başlangıçta karakter ortada, oyunda ileri görüş geniş.
const KAMERA_ONDE = { hazir: 0.9, oyun: 2.4 };

// yön → [sütun farkı, satır farkı, karakterin bakış açısı]
const YONLER = {
  ileri: [0, 1, 0], geri: [0, -1, Math.PI], sol: [-1, 0, Math.PI / 2], sag: [1, 0, -Math.PI / 2]
};
const TUSLAR = {
  ArrowUp: 'ileri', KeyW: 'ileri', Space: 'ileri', ArrowDown: 'geri', KeyS: 'geri',
  ArrowLeft: 'sol', KeyA: 'sol', ArrowRight: 'sag', KeyD: 'sag'
};
const NEDENLER = {
  arac: 'Gece trafiği affetmez.', tramvay: 'Tramvay zili boşuna çalmıyor.', su: 'Boğaz serin bu gece.',
  akinti: 'Akıntı seni uzaklara götürdü.', marti: 'Oyalandın, koca martı seni kaptı.'
};

const $ = (id) => document.getElementById(id);
const alan = $('alan'), tuval = $('tuval');
const ogeler = {
  skor: $('skor'), enIyi: $('en-iyi'), simit: $('simit'), uyari: $('uyari'), flas: $('flas'),
  baslangic: $('baslangic'), duraklama: $('duraklama'), karakterler: $('karakterler'), cuzdan: $('cuzdan'),
  karakterMesaj: $('karakter-mesaj'), sesDugme: $('ses-dugme'), duraklatDugme: $('duraklat-dugme'),
  sonuc: $('sonuc'), sonucMesafe: $('sonuc-mesafe'), sonucEnIyi: $('sonuc-en-iyi'), sonucSimit: $('sonuc-simit'),
  rekor: $('rekor-damga'), neden: $('neden')
};

const hareketAz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let kayit = M.kayitDuzelt(Depo.oku(DEPO_ANAHTARI, null));
function kaydet() { Depo.yaz(DEPO_ANAHTARI, kayit); }

const ses = sesOlustur(kayit.ses);
let sahne;
try {
  sahne = sahneOlustur(tuval, { hareketAz });
} catch (e) {
  $('destek-yok').hidden = false;
  ogeler.baslangic.hidden = true;
  throw e;
}

// ---------- Oyun durumu ----------
let durum = 'hazir';       // hazir | oyun | olum | bitti
let duraklatildi = false;
let t = 0;                 // dünya zamanı: yalnızca döngü çalışırken ilerler
let uretici, oy, tur;
const kuyruk = [];

function seritAl(satir) { return satir >= 0 ? uretici.seritAl(satir) : null; }

// Oyuncunun bulunduğu noktadaki zemin yüksekliği (teknede güverte, suda su yüzü).
function zeminY(satir, x, zaman, tekneIdx) {
  const s = seritAl(satir);
  if (!s) return ZEMIN.kaldirim;
  if (s.tur !== 'su') return ZEMIN[s.tur];
  const idx = tekneIdx != null ? tekneIdx : M.tekneBul(s, x, zaman);
  return idx >= 0 ? ZEMIN.su + sahne.GUVERTE[s.nesneler[idx].tip] + sahne.tekneSallantisi(satir, idx) : ZEMIN.su;
}

// ?tohum=123 aynı dünyayı yeniden üretir (hata ayıklama ve ekran görüntüsü için).
const ADRES = new URLSearchParams(location.search);
function tohum() {
  const sabit = parseInt(ADRES.get('tohum'), 10);
  return Number.isFinite(sabit) ? sabit : ((Date.now() & 0xffffff) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function yeniTur() {
  uretici = M.ureticiOlustur(tohum());
  sahne.dunyaKur(uretici);
  sahne.efektleriTemizle();
  const s = M.BASLANGIC_SATIRI;
  oy = { satir: s, x: 0, y: ZEMIN.kaldirim, aci: 0, hedefAci: 0, hop: null, tekne: null, inis: 0, tumsek: 0, ezik: 0, batma: 0, kapildi: null };
  tur = { enIleri: s, toplanan: 0, bosSure: 0, toplananlar: new Set(), neden: null, olumZamani: 0, uyariVerildi: false, sonKorna: -9, sonDuduk: -9, zilCalan: new Set() };
  kuyruk.length = 0;
  durum = 'hazir';
  sahne.oyuncuyuAyarla(kayit.secili);
  sahne.seritleriAyarla(s - 9, s + 22);
  sahne.kameraGuncelle(0, -s - KAMERA_ONDE.hazir, 1, true);
  sahne.kocaMartiCiz({ gorunur: false, golgeBoyu: 0 });
  hudGuncelle();
  ogeler.uyari.hidden = true;
}

// ---------- Hareket ----------
function hareketEt(yon) {
  const [dc, dr, aci] = YONLER[yon];
  oy.hedefAci = aci;
  const s0 = oy.satir, s1 = s0 + dr;
  const serit0 = seritAl(s0), serit1 = seritAl(s1);
  if (s1 < 0 || !serit1) { oy.tumsek = 1; return; }
  let x1;
  if (serit1.tur === 'su') {
    // Suya: karadan hücre merkezinden, tekneden sürekli konumdan zıplanır.
    x1 = (serit0 && serit0.tur === 'su' ? oy.x : Math.round(oy.x)) + dc;
    if (Math.abs(x1) > M.SINIR + 0.5) { oy.tumsek = 1; return; }
  } else {
    x1 = Math.round(oy.x + dc);
    if (!M.hareketSerbest(serit1, x1)) { oy.tumsek = 1; ses.carpisma(); return; }
  }
  oy.hop = { s0, x0: oy.x, y0: oy.y, s1, x1, p: 0 };
  oy.tekne = null;
  ses.zipla();
}

function inis() {
  const h = oy.hop;
  oy.hop = null;
  oy.satir = h.s1;
  oy.x = h.x1;
  oy.inis = 1;
  const s = seritAl(oy.satir);
  if (s.tur === 'su') {
    const idx = M.tekneBul(s, oy.x, t);
    if (idx < 0) { olumBaslat('su'); return; }
    const n = s.nesneler[idx];
    const merkez = M.nesneKonumu(s, n, t);
    oy.tekne = { idx, ofset: M.yuvaOfseti(n.uzunluk, M.sar(oy.x - merkez, s.dongu)) };
    oy.x = merkez + oy.tekne.ofset;
    if (n.tip === 'vapur' && t - tur.sonDuduk > 4) { ses.duduk(); tur.sonDuduk = t; }
  } else if (!hareketAz) {
    sahne.parcacikSac(oy.x, ZEMIN[s.tur] + 0.05, -oy.satir, [0x3b332b, 0xb4a78f], 4, 0.7);
  }
  // Simit
  const sutun = Math.round(oy.x), anahtar = oy.satir + ':' + sutun;
  if (s.simitler.indexOf(sutun) !== -1 && !tur.toplananlar.has(anahtar)) {
    tur.toplananlar.add(anahtar);
    tur.toplanan++;
    sahne.simitTopla(oy.satir, sutun);
    ses.simit();
  }
  if (oy.satir > tur.enIleri) {
    tur.enIleri = oy.satir;
    tur.bosSure = 0;
    tur.uyariVerildi = false;
  }
  hudGuncelle();
}

function olumBaslat(neden) {
  if (durum !== 'oyun') return;
  durum = 'olum';
  tur.neden = neden;
  tur.olumZamani = 0;
  kuyruk.length = 0;
  ogeler.uyari.hidden = true;
  const y = oy.y, z = -oy.satir;
  if (neden === 'arac' || neden === 'tramvay') {
    oy.ezik = 1;
    ses.ezilme();
    sahne.sars(0.35);
    sahne.korTonu();
    sahne.parcacikSac(oy.x, y + 0.3, z, [0xf3ead8, 0xff6a48, 0xffb23f], 12, 2.2);
    flas();
  } else if (neden === 'su' || neden === 'akinti') {
    oy.batma = 0.001;
    ses.su();
    sahne.halkaAc(oy.x, ZEMIN.su, z);
    sahne.parcacikSac(oy.x, ZEMIN.su + 0.1, z, [0x9db4ff, 0xe9dcc2], 12, 2);
    sahne.korTonu();
    flas();
  } else if (neden === 'marti') {
    oy.kapildi = { x: oy.x, y: oy.y, z };
    ses.marti();
    sahne.korTonu();
  }
}

function flas() {
  if (hareketAz) return;
  ogeler.flas.classList.remove('yan');
  void ogeler.flas.offsetWidth;
  ogeler.flas.classList.add('yan');
}

// ---------- Kare güncellemesi ----------
function guncelle(dt) {
  t += dt;
  if (durum === 'oyun') {
    // Bekleme cezası: koca martı
    tur.bosSure += dt;
    const kov = M.kovalayiciDurumu(tur.bosSure, tur.enIleri);
    ogeler.uyari.hidden = !kov.uyari;
    if (kov.uyari && !tur.uyariVerildi) { tur.uyariVerildi = true; ses.marti(); }
    if (kov.yakala) olumBaslat('marti');

    if (!oy.hop && kuyruk.length && durum === 'oyun') hareketEt(kuyruk.shift());
    if (oy.hop) {
      oy.hop.p += dt / ZIPLAMA;
      if (oy.hop.p >= 1) {
        inis();
        if (durum === 'oyun' && kuyruk.length) hareketEt(kuyruk.shift());
      }
    }
    // Tekneyle sürüklenme
    if (durum === 'oyun' && !oy.hop && oy.tekne) {
      const s = seritAl(oy.satir);
      oy.x = M.nesneKonumu(s, s.nesneler[oy.tekne.idx], t) + oy.tekne.ofset;
      if (Math.abs(oy.x) > M.SINIR + 0.7) olumBaslat('akinti');
    }
    // Izgara çarpışması
    if (durum === 'oyun') {
      const satir = oy.hop ? (oy.hop.p < 0.5 ? oy.hop.s0 : oy.hop.s1) : oy.satir;
      const x = oy.hop ? oy.hop.x0 + (oy.hop.x1 - oy.hop.x0) * oy.hop.p : oy.x;
      const s = seritAl(satir);
      if (M.carpismaVarMi(s, x, t)) olumBaslat(s.tur === 'ray' ? 'tramvay' : 'arac');
    }
    sesliUyarilar();
  } else if (durum === 'olum') {
    tur.olumZamani += dt;
    const sure = tur.neden === 'marti' ? 1.3 : OLUM_BEKLEME;
    if (tur.olumZamani >= sure) sonucGoster();
  }
  oyuncuyuCiz(dt);
  kocaMarti(dt);

  // Şeritler, nesneler, ışıklar ve kamera
  const satirAkis = oy.hop ? oy.hop.s0 + (oy.hop.s1 - oy.hop.s0) * oy.hop.p : oy.satir;
  sahne.seritleriAyarla(Math.floor(satirAkis) - 9, Math.floor(satirAkis) + 22);
  sahne.nesneleriGuncelle(t, M, tramvayUyarilari);
  sahne.lambalariYerlestir(-satirAkis);
  sahne.parcaciklariGuncelle(dt);
  sahne.halkalariGuncelle(dt);
  sahne.ucanSimitleriGuncelle(dt);
  const kx = Math.max(-1.8, Math.min(1.8, oy.x * 0.5));
  sahne.kameraGuncelle(kx, -satirAkis - (durum === 'hazir' ? KAMERA_ONDE.hazir : KAMERA_ONDE.oyun), dt, false);
}

// Tramvay zili, korna ve vapur düdüğü: oyuncunun yakınındaki şeritler.
const tramvayUyarilari = new Set();
function sesliUyarilar() {
  tramvayUyarilari.clear();
  for (let s = oy.satir - 2; s <= oy.satir + 7; s++) {
    const serit = seritAl(s);
    if (!serit) continue;
    if (serit.tur === 'ray') {
      const kalan = M.tramvayaKalan(serit, t);
      if (kalan > 0 && kalan < 1.8) {
        tramvayUyarilari.add(s);
        if (!tur.zilCalan.has(s)) { tur.zilCalan.add(s); if (Math.abs(s - oy.satir) <= 4) ses.zil(); }
      } else if (kalan > 2.5) tur.zilCalan.delete(s);
      if (kalan === 0) tramvayUyarilari.add(s);
    } else if (serit.tur === 'yol' && (s === oy.satir || s === oy.satir + 1) && t - tur.sonKorna > 2.2) {
      for (const n of serit.nesneler) {
        const fark = (oy.x - M.nesneKonumu(serit, n, t)) * serit.yon; // pozitif: araç oyuncuya geliyor
        if (fark > n.uzunluk / 2 + 0.6 && fark < n.uzunluk / 2 + 1.6 && Math.random() < 0.4) { ses.korna(); tur.sonKorna = t; break; }
      }
    } else if (serit.tur === 'su' && serit.nesneler[0].tip === 'vapur' && t - tur.sonDuduk > 9 && Math.random() < 0.004) {
      ses.duduk(); tur.sonDuduk = t;
    }
  }
}

// Ezilme-esneme, zıplama yayı ve ölüm canlandırmaları.
function oyuncuyuCiz(dt) {
  let x = oy.x, z = -oy.satir, y, zemin, sx = 1, sy = 1, egim = 0, gorunur = true, golge = true;
  oy.aci += (aciFarki(oy.hedefAci, oy.aci)) * Math.min(1, dt * 22);
  if (oy.hop) {
    const p = Math.min(1, oy.hop.p);
    x = oy.hop.x0 + (oy.hop.x1 - oy.hop.x0) * p;
    z = -(oy.hop.s0 + (oy.hop.s1 - oy.hop.s0) * p);
    const y1 = zeminY(oy.hop.s1, oy.hop.x1, t);
    zemin = p < 0.5 ? oy.hop.y0 : y1;
    y = oy.hop.y0 + (y1 - oy.hop.y0) * p + Math.sin(p * Math.PI) * 0.5;
    const e = Math.sin(p * Math.PI);
    sy = 1 + 0.22 * e; sx = 1 - 0.1 * e;
  } else {
    zemin = zeminY(oy.satir, oy.x, t, oy.tekne ? oy.tekne.idx : null);
    y = zemin;
    if (oy.inis > 0) {
      sy = 1 - 0.26 * oy.inis; sx = 1 + 0.16 * oy.inis;
      oy.inis = Math.max(0, oy.inis - dt * 9);
    } else if (!hareketAz && durum !== 'olum') {
      sy = 1 + Math.sin(t * 3.2) * 0.025;
    }
    if (oy.tumsek > 0) {
      sy *= 1 - 0.12 * oy.tumsek; sx *= 1 + 0.08 * oy.tumsek;
      oy.tumsek = Math.max(0, oy.tumsek - dt * 7);
    }
  }
  if (oy.ezik > 0) { sy = 0.16; sx = 1.5; }
  if (oy.batma > 0) {
    oy.batma = Math.min(1, oy.batma + dt * 2.4);
    y = ZEMIN.su - oy.batma * 0.9; golge = false; egim = oy.batma * 0.5;
    gorunur = oy.batma < 1;
  }
  if (oy.kapildi) {
    const k = oy.kapildi;
    const p = tur.olumZamani;
    if (p > 0.42) {
      const u = p - 0.42;
      x = k.x - u * 4; y = k.y + u * u * 9 + u * 3; z = k.z - u * 5;
      golge = false;
    }
  }
  oy.y = y;
  sahne.oyuncuyuCiz({ x, y, z, zeminY: zemin, yonAci: oy.aci, sx, sy, egim, gorunur, golge });
  oy.cizimKonumu = { x, y, z };
}

function aciFarki(hedef, simdi) {
  let d = hedef - simdi;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Koca martı: uyarıda tepede döner ve gölgesi büyür; yakalayınca dalar.
function kocaMarti() {
  const c = oy.cizimKonumu;
  if (!c) return;
  const kanat = Math.sin(t * 12) * 0.6;
  if (durum === 'olum' && tur.neden === 'marti') {
    const p = tur.olumZamani, k = oy.kapildi;
    let x, y, z;
    if (p <= 0.42) {
      const u = p / 0.42, e = 1 - (1 - u) * (1 - u);
      x = k.x + 5 * (1 - e); y = k.y + 0.5 + 6 * (1 - e); z = k.z + 4 * (1 - e);
    } else { x = c.x; y = c.y + 0.45; z = c.z; }
    sahne.kocaMartiCiz({ gorunur: true, x, y, z, kanat, aci: Math.PI * 0.75, golgeX: x, golgeZ: z, golgeY: zeminY(oy.satir, oy.x, t), golgeBoyu: Math.max(0, 1.2 - (y - k.y) * 0.15) });
    return;
  }
  if (durum === 'oyun' && !ogeler.uyari.hidden) {
    const kalan = M.kovalayiciDurumu(tur.bosSure, tur.enIleri).kalan;
    const yakin = 1 - kalan / 2.5;
    const a = t * 1.6;
    sahne.kocaMartiCiz({
      gorunur: true, x: c.x + Math.cos(a) * 3, y: c.y + 6 - yakin * 1.5, z: c.z + Math.sin(a) * 2 - 1, kanat, aci: -a,
      golgeX: c.x + Math.cos(a) * 0.6 * (1 - yakin), golgeZ: c.z + Math.sin(a) * 0.4 * (1 - yakin), golgeY: zeminY(oy.satir, oy.x, t), golgeBoyu: 0.25 + yakin * 0.85
    });
    return;
  }
  sahne.kocaMartiCiz({ gorunur: false, golgeBoyu: 0 });
}

// ---------- HUD ve paneller ----------
function hudGuncelle() {
  ogeler.skor.textContent = M.skorHesapla(tur.enIleri);
  ogeler.enIyi.textContent = Math.max(kayit.enIyi, M.skorHesapla(tur.enIleri));
  ogeler.simit.textContent = kayit.simit + tur.toplanan;
  ogeler.cuzdan.textContent = kayit.simit;
}

function sonucGoster() {
  durum = 'bitti';
  const skor = M.skorHesapla(tur.enIleri);
  const sonuc = M.turuIsle(kayit, skor, tur.toplanan);
  kayit = sonuc.kayit;
  kaydet();
  Depo.ozetYaz('karsidan-karsiya', kayit.enIyi && 'En iyi ' + kayit.enIyi);
  ogeler.sonucMesafe.textContent = skor;
  ogeler.sonucEnIyi.textContent = kayit.enIyi;
  ogeler.sonucSimit.textContent = '+' + tur.toplanan;
  ogeler.rekor.hidden = !sonuc.yeniRekor;
  ogeler.neden.textContent = NEDENLER[tur.neden] || '';
  if (sonuc.yeniRekor && skor > 0) ses.rekor();
  if (typeof ogeler.sonuc.showModal === 'function') ogeler.sonuc.showModal();
  else ogeler.sonuc.setAttribute('open', '');
}

function karakterleriCiz() {
  ogeler.karakterler.innerHTML = '';
  for (const k of M.KARAKTERLER) {
    const acik = kayit.acik.indexOf(k.id) !== -1, secili = kayit.secili === k.id;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'karakter' + (acik ? '' : ' kilitli') + (secili ? ' secili' : '');
    b.setAttribute('role', 'listitem');
    b.setAttribute('aria-pressed', secili ? 'true' : 'false');
    const img = document.createElement('img');
    img.alt = '';
    img.width = img.height = 64;
    if (onizleme[k.id]) img.src = onizleme[k.id];
    const ad = document.createElement('span');
    ad.className = 'karakter-ad';
    ad.textContent = k.ad;
    const alt = document.createElement('span');
    alt.className = 'karakter-durum';
    if (secili) alt.textContent = 'Seçili';
    else if (acik) alt.textContent = 'Seç';
    else alt.innerHTML = SIMIT_SVG + '<span>' + k.fiyat + '</span>';
    b.setAttribute('aria-label', k.ad + (secili ? ', seçili' : acik ? '' : ', kilitli, ' + k.fiyat + ' simit'));
    b.append(img, ad, alt);
    b.addEventListener('click', () => karakterTiklandi(k));
    ogeler.karakterler.append(b);
  }
}

function karakterTiklandi(k) {
  ses.hazirla();
  const sonuc = M.karakterAc(kayit, k.id);
  if (sonuc.hata) {
    ogeler.karakterMesaj.textContent = k.ad + ' için ' + sonuc.hata;
    ses.carpisma();
    return;
  }
  const yeniAcildi = kayit.acik.indexOf(k.id) === -1;
  kayit = sonuc.kayit;
  kaydet();
  ogeler.karakterMesaj.textContent = yeniAcildi ? k.ad + ' açıldı!' : '';
  if (yeniAcildi) ses.rekor(); else ses.zipla();
  sahne.oyuncuyuAyarla(kayit.secili);
  oy.inis = 1;
  karakterleriCiz();
  hudGuncelle();
}

const SIMIT_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="4.5"/></svg>';

function baslangicGoster(karakterlerle) {
  ogeler.baslangic.hidden = false;
  ogeler.baslangic.classList.toggle('sade', !karakterlerle);
  ogeler.karakterMesaj.textContent = '';
  karakterleriCiz();
}

function oyunuBaslat() {
  ses.hazirla();
  ogeler.baslangic.hidden = true;
  durum = 'oyun';
  tur.bosSure = 0;
}

// ---------- Girdi ----------
function yonGirdisi(yon) {
  if (duraklatildi) return;
  if (durum === 'hazir') oyunuBaslat();
  if (durum !== 'oyun') return;
  if (kuyruk.length < KUYRUK_SINIRI) kuyruk.push(yon);
}

document.addEventListener('keydown', (e) => {
  if (ogeler.sonuc.open || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (durum === 'oyun') duraklatDegistir(); return; }
  const yon = TUSLAR[e.code];
  if (!yon) return;
  if (e.target.closest && e.target.closest('button, a, input') && e.code === 'Space') return;
  e.preventDefault();
  if (duraklatildi) { devamEt(); return; }
  if (!e.repeat) yonGirdisi(yon);
});

let dokunus = null;
alan.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, a, .karakterler')) return;
  if (duraklatildi) return;
  dokunus = { x: e.clientX, y: e.clientY, kullanildi: false, id: e.pointerId };
  try { alan.setPointerCapture(e.pointerId); } catch (_) { /* eski tarayıcı */ }
});
alan.addEventListener('pointermove', (e) => {
  if (!dokunus || dokunus.kullanildi || e.pointerId !== dokunus.id) return;
  const dx = e.clientX - dokunus.x, dy = e.clientY - dokunus.y;
  if (Math.hypot(dx, dy) < KAYDIRMA_ESIGI) return;
  dokunus.kullanildi = true;
  yonGirdisi(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'sag' : 'sol') : (dy > 0 ? 'geri' : 'ileri'));
});
alan.addEventListener('pointerup', (e) => {
  if (!dokunus || e.pointerId !== dokunus.id) return;
  if (!dokunus.kullanildi) yonGirdisi('ileri');
  dokunus = null;
});
alan.addEventListener('pointercancel', () => { dokunus = null; });
alan.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Ses, duraklatma ve sekme görünürlüğü ----------
function sesDugmesiniCiz() {
  ogeler.sesDugme.setAttribute('aria-pressed', kayit.ses ? 'false' : 'true');
  ogeler.sesDugme.setAttribute('aria-label', kayit.ses ? 'Sesi kapat' : 'Sesi aç');
  ogeler.sesDugme.classList.toggle('kapali', !kayit.ses);
}
ogeler.sesDugme.addEventListener('click', () => {
  kayit.ses = !kayit.ses;
  kaydet();
  ses.ayarla(kayit.ses);
  sesDugmesiniCiz();
});

function duraklatDegistir() { if (duraklatildi) devamEt(); else duraklat(); }
function duraklat() {
  if (durum !== 'oyun' || duraklatildi) return;
  duraklatildi = true;
  ogeler.duraklama.hidden = false;
  ogeler.duraklatDugme.setAttribute('aria-label', 'Devam et');
  ogeler.duraklatDugme.classList.add('durdu');
  dongu.dur();
  $('devam').focus({ preventScroll: true });
}
function devamEt() {
  if (!duraklatildi) return;
  duraklatildi = false;
  ogeler.duraklama.hidden = true;
  ogeler.duraklatDugme.setAttribute('aria-label', 'Duraklat');
  ogeler.duraklatDugme.classList.remove('durdu');
  kuyruk.length = 0;
  dongu.basla();
}
ogeler.duraklatDugme.addEventListener('click', () => {
  if (durum === 'oyun') duraklatDegistir();
});
$('devam').addEventListener('click', devamEt);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { duraklat(); dongu.dur(); } else if (!duraklatildi) dongu.basla();
});

$('tekrar').addEventListener('click', () => { ogeler.sonuc.close(); });
$('karakter-ac').addEventListener('click', () => { tur.karakterIstendi = true; ogeler.sonuc.close(); });
ogeler.sonuc.addEventListener('close', () => {
  const karakterlerle = !!tur.karakterIstendi;
  yeniTur();
  baslangicGoster(karakterlerle);
  alan.scrollIntoView({ block: 'nearest' });
});

window.addEventListener('resize', () => { sahne.boyutla(); if (duraklatildi) sahne.ciz(); });

// ---------- Döngü ----------
const dongu = (() => {
  let id = 0, son = 0, kareSayisi = 0, kareToplam = 0, isToplam = 0;
  function kare(zaman) {
    id = requestAnimationFrame(kare);
    const dt = son ? Math.min(0.05, (zaman - son) / 1000) : 0.016;
    if (son) { kareToplam += zaman - son; kareSayisi++; }
    son = zaman;
    const bas = performance.now();
    guncelle(dt);
    sahne.ciz();
    isToplam += performance.now() - bas;
    if (alan.dataset.durum !== durum) alan.dataset.durum = durum;
    // Her iki saniyede ortalama kare süresi: gerekirse çözünürlük düşer; fps veri özniteliğinde görünür.
    if (kareToplam > 2000) {
      const ort = kareToplam / kareSayisi;
      alan.dataset.fps = Math.round(1000 / ort);
      alan.dataset.ms = (isToplam / kareSayisi).toFixed(1); // ana iş parçacığında kare başına iş
      alan.dataset.cizim = sahne.renderer.info.render.calls;
      sahne.kaliteAyarla(ort);
      kareToplam = 0; kareSayisi = 0; isToplam = 0;
    }
  }
  return {
    basla() { if (!id && !document.hidden) { son = 0; id = requestAnimationFrame(kare); } },
    dur() { if (id) cancelAnimationFrame(id); id = 0; }
  };
})();

// ---------- Otomatik test kancası (yalnızca ?test adresinde) ----------
if (ADRES.has('test')) {
  window.KarsiTest = {
    durum: () => ({ durum, t, satir: oy.satir, x: oy.x, hop: !!oy.hop, tekne: oy.tekne, enIleri: tur.enIleri }),
    serit: (i) => seritAl(i),
    // Oyuncuyu verilen satıra taşır (ekran görüntüsünde su ve tramvayı hızlıca göstermek için).
    isinla(satir, sutun) {
      oy.satir = satir; oy.x = sutun; oy.hop = null; oy.tekne = null; kuyruk.length = 0;
      tur.enIleri = Math.max(tur.enIleri, satir); tur.bosSure = 0;
      hudGuncelle();
    }
  };
}

// ---------- Başlat ----------
const onizleme = (() => { try { return sahne.onizlemeler(M.KARAKTERLER.map((k) => k.id), 128); } catch (e) { return {}; } })();
sesDugmesiniCiz();
yeniTur();
baslangicGoster(true);
dongu.basla();
