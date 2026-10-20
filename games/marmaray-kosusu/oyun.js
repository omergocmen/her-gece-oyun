// Marmaray Koşusu: oyun döngüsü, girdiler (kaydırma, klavye), fizik, HUD, kayıt ve sesler.
// Kurallar mantik.js'te (window.MarmarayMantik), çizim sahne.js'te.
import { sahneOlustur } from './sahne.js';
import { sesOlustur } from './ses.js';

const M = window.MarmarayMantik;
const Depo = window.Depo;
const DEPO_ANAHTARI = 'marmaray:kayit';
const S = M.SERIT_GENISLIK;
const OLUM_BEKLEME = 0.6;     // çarpmadan sonuç paneline kadar (sn)
const KAYDIRMA_ESIGI = 30;    // px
const ZIPLAMA_HIZI = 4 * M.ZIPLAMA.yukseklik / M.ZIPLAMA.sure;
const YERCEKIMI = 2 * ZIPLAMA_HIZI / M.ZIPLAMA.sure;
const JETPACK_Y = 6.3;
const NEDENLER = {
  gelen: 'Gelen trenin farları uyarmıştı.', tren: 'Duran trene tam önden daldın.',
  bariyer: 'Bariyerin üstünden zıplamak gerekiyordu.', tabela: 'DİKKAT tabelası boşuna asılmamış.'
};
const GUC_ADI = { miknatis: 'Mıknatıs', jetpack: 'Jetpack', x2: '×2 puan' };
const GUC_IKON = {
  miknatis: '<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v8a6 6 0 0 0 12 0V4" fill="none" stroke="currentColor" stroke-width="4"/><path d="M4 4h4M16 4h4" stroke="#ff6a48" stroke-width="4"/></svg>',
  jetpack: '<svg class="ikon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5.5" height="12" rx="2" fill="currentColor"/><rect x="13.5" y="4" width="5.5" height="12" rx="2" fill="currentColor"/><path d="M7.7 18v3M16.3 18v3" stroke="#ffb23f" stroke-width="2.4" stroke-linecap="round"/></svg>',
  x2: '<span class="x2">×2</span>'
};
const JETON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="#f3ead8"/></svg>';
const TUSLAR = {
  ArrowLeft: 'sol', KeyA: 'sol', ArrowRight: 'sag', KeyD: 'sag',
  ArrowUp: 'zipla', KeyW: 'zipla', Space: 'zipla', ArrowDown: 'kay', KeyS: 'kay'
};

const $ = (id) => document.getElementById(id);
const alan = $('alan'), tuval = $('tuval');
const ogeler = {
  skor: $('skor'), enIyi: $('en-iyi'), jeton: $('jeton'), jetonSayac: $('jeton-sayac'), uyari: $('uyari'), flas: $('flas'),
  guclar: $('guclar'), ucanlar: $('ucanlar'), gorev: $('gorev'),
  baslangic: $('baslangic'), duraklama: $('duraklama'), karakterler: $('karakterler'), cuzdan: $('cuzdan'),
  karakterMesaj: $('karakter-mesaj'), sesDugme: $('ses-dugme'), duraklatDugme: $('duraklat-dugme'),
  sonuc: $('sonuc'), sonucPuan: $('sonuc-puan'), sonucMesafe: $('sonuc-mesafe'), sonucEnIyi: $('sonuc-en-iyi'),
  sonucJeton: $('sonuc-jeton'), sonucGorev: $('sonuc-gorev'), rekor: $('rekor-damga'), neden: $('neden')
};

const hareketAz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let kayit = M.kayitDuzelt(Depo.oku(DEPO_ANAHTARI, null));
function kaydet() { Depo.yaz(DEPO_ANAHTARI, kayit); }

const ses = sesOlustur(kayit.ses);
let sahne;
try {
  sahne = sahneOlustur(tuval, { hareketAz, gorus: M.GORUS_MESAFESI });
} catch (e) {
  $('destek-yok').hidden = false;
  ogeler.baslangic.hidden = true;
  throw e;
}

const ADRES = new URLSearchParams(location.search);
const TEST = ADRES.has('test');
function tohum() {
  const sabit = parseInt(ADRES.get('tohum'), 10);
  return Number.isFinite(sabit) ? sabit : ((Date.now() & 0xffffff) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
const bugun = () => M.tarihAnahtari(new Date());

// ---------- Durum ----------
let durum = 'hazir';   // hazir | oyun | olum | bitti
let duraklatildi = false;
let t = 0;
let uretici, oy, tur;
const cekilen = new Map(); // mıknatısla çekilen jetonlar → ilerleme (0..1)

function yeniTur() {
  uretici = M.ureticiOlustur(tohum());
  uretici.ilerlet(200);
  oy = {
    serit: 0, x: 0, gecis: null, y: 0, vy: 0, havada: false, kaymaT: 0, kaymaBekliyor: false,
    egim: 0, sx: 1, sy: 1, sz: 1, inis: 0, tumsek: 0, faz: 0, devrilme: 0, sendele: 0, dokunulmaz: 0
  };
  tur = {
    p: 0, hiz: 0, puan: 0, jeton: 0, seri: 0, sonJeton: -9, neden: null, olumZamani: 0,
    etkin: { miknatis: 0, jetpack: 0, x2: 0 }, ist: { jeton: 0, mesafe: 0, zipla: 0, kay: 0, guc: 0 },
    baslamaT: 0, sonUcus: 0, kornalar: new Set(), karakterIstendi: false
  };
  cekilen.clear();
  durum = 'hazir';
  sahne.temizle();
  sahne.karakterAyarla(kayit.secili);
  hudGuncelle();
  guclerHud(true);
  ogeler.uyari.hidden = true;
}

// ---------- Hareketler ----------
function seritDegistir(yon) {
  const hedef = Math.max(-1, Math.min(1, oy.serit + yon));
  if (hedef === oy.serit) { oy.tumsek = 1; ses.yan(); sahne.tekme(-1.5); return; }
  oy.gecis = { x0: oy.x, hedef, t: 0, onceki: oy.serit };
  oy.serit = hedef;
  oy.egim = -yon * 0.32;
  oy.sx = 1.12; oy.sy = 0.92;
  ses.serit(yon);
}

function zipla() {
  if (tur.etkin.jetpack > 0) return;
  if (oy.havada) return;
  oy.vy = ZIPLAMA_HIZI;
  oy.havada = true;
  oy.kaymaT = 0;
  oy.sy = 1.25; oy.sx = 0.85;
  tur.ist.zipla++;
  ses.zipla();
  if (!hareketAz) sahne.parcacikSac(oy.x * S, 0.05, 0.2, [0x3b332b, 0xb4a78f], 5, 1.2, 0.4, true);
}

function kay() {
  if (tur.etkin.jetpack > 0) return;
  if (oy.havada) { oy.vy = Math.min(oy.vy, -22); oy.kaymaBekliyor = true; return; } // havadan hızlı iniş, sonra kayma
  kaymaBaslat();
}
function kaymaBaslat() {
  oy.kaymaT = M.KAYMA_SURESI;
  oy.kaymaBekliyor = false;
  tur.ist.kay++;
  ses.kay();
  if (!hareketAz) sahne.parcacikSac(oy.x * S, 0.05, 0.3, [0x3b332b, 0xb4a78f, 0xffb23f], 6, 1.4, 0.3, true);
}

function girdi(eylem) {
  if (duraklatildi) return;
  if (durum === 'hazir') oyunuBaslat();
  if (durum !== 'oyun') return;
  if (eylem === 'sol') seritDegistir(-1);
  else if (eylem === 'sag') seritDegistir(1);
  else if (eylem === 'zipla') zipla();
  else if (eylem === 'kay') kay();
}

function oyunuBaslat() {
  ses.hazirla();
  ses.muzik(true);
  ogeler.baslangic.hidden = true;
  durum = 'oyun';
  tur.baslamaT = t;
}

// ---------- Kare güncellemesi ----------
function guncelle(dt) {
  t += dt;
  if (durum === 'oyun') {
    // Hız: başta yarım saniyede ivmelenir, sonra mesafeyle artar.
    const ivme = Math.min(1, (t - tur.baslamaT) / 0.6);
    tur.hiz = M.hiz(tur.p) * (0.35 + 0.65 * ivme);
    const dp = tur.hiz * dt;
    tur.p += dp;
    tur.puan += M.puanArtisi(dp, 0, tur.etkin.x2 > 0);
    tur.ist.mesafe = tur.p;
    uretici.ilerlet(tur.p + 200);
    // Geride kalanları her 20 m'de bir at (her karede dizi kopyalamamak için).
    if (tur.p - (tur.temizlik || 0) > 20) { uretici.temizle(tur.p); tur.temizlik = tur.p; }
    fizik(dt);
    if (durum === 'oyun') carpismalar(dt);
    if (durum === 'oyun') toplama(dt);
    guclerGuncelle(dt);
    uyarilar();
  } else if (durum === 'olum') {
    tur.olumZamani += dt;
    // Çarpınca hafifçe geri seker, sonra durur (engelin içine girmez).
    tur.hiz = Math.min(0, tur.hiz + dt * 30);
    tur.p += tur.hiz * dt;
    oy.devrilme = Math.min(1, tur.olumZamani * 4) * -0.9;
    oy.y = Math.max(0, oy.y + oy.vy * dt); oy.vy -= YERCEKIMI * dt;
    if (tur.olumZamani >= OLUM_BEKLEME) sonucGoster();
  } else if (durum === 'hazir') {
    tur.hiz = 0;
  }
  // Ezilme-esneme yumuşakça 1'e döner
  const geri = Math.min(1, dt * 12);
  oy.sx += (1 - oy.sx) * geri; oy.sy += (1 - oy.sy) * geri;
  oy.egim += (0 - oy.egim) * Math.min(1, dt * 9);
  if (oy.tumsek > 0) { oy.sx = 1 + 0.1 * oy.tumsek; oy.sy = 1 - 0.1 * oy.tumsek; oy.tumsek = Math.max(0, oy.tumsek - dt * 7); }
  oy.faz += dt * (durum === 'oyun' ? 4 + tur.hiz * 0.38 : 0);

  const kayma = oy.kaymaT > 0 ? Math.min(1, (M.KAYMA_SURESI - oy.kaymaT) / 0.08, oy.kaymaT / 0.12) : 0;
  sahne.kare({
    p: tur.p, t, dt, hiz: tur.hiz, uretici, cekilen,
    oyuncu: {
      x: oy.x * S, y: oy.y, faz: oy.faz, kosuyor: durum === 'oyun', kayma, sx: oy.sx, sy: oy.sy, sz: 1,
      egim: oy.egim, devrilme: oy.devrilme, jetpack: tur.etkin.jetpack > 0, miknatis: tur.etkin.miknatis > 0,
      gorunur: !(oy.dokunulmaz > 0 && Math.floor(t * 14) % 2 === 0)
    }
  });
  ses.kare(dt, durum === 'oyun' ? tur.hiz : 0);
  hudGuncelle();
}

function fizik(dt) {
  // Şerit geçişi: 140 ms, yumuşak bitiş
  if (oy.gecis) {
    oy.gecis.t += dt;
    const u = Math.min(1, oy.gecis.t / M.SERIT_DEGISIM), e = 1 - Math.pow(1 - u, 3);
    oy.x = oy.gecis.x0 + (oy.gecis.hedef - oy.gecis.x0) * e;
    if (u >= 1) { oy.x = oy.gecis.hedef; oy.gecis = null; }
  }
  oy.sendele = Math.max(0, oy.sendele - dt);
  oy.dokunulmaz = Math.max(0, oy.dokunulmaz - dt);
  // Jetpack: yükselir ve süzülür; bitince yere iner
  if (tur.etkin.jetpack > 0) {
    oy.y += (JETPACK_Y - oy.y) * Math.min(1, dt * 3);
    oy.vy = 0; oy.havada = true; oy.kaymaT = 0;
    return;
  }
  if (oy.havada) {
    oy.vy -= YERCEKIMI * dt;
    oy.y += oy.vy * dt;
    if (oy.y <= 0) {
      const sert = oy.vy < -16;
      oy.y = 0; oy.vy = 0; oy.havada = false;
      oy.sx = sert ? 1.3 : 1.2; oy.sy = sert ? 0.7 : 0.78;
      ses.inis();
      sahne.tekme(sert ? -3.5 : -2);
      if (!hareketAz) sahne.parcacikSac(oy.x * S, 0.05, 0.2, [0x3b332b, 0xb4a78f], 6, 1.6, 0.4, true);
      if (oy.kaymaBekliyor) kaymaBaslat();
    }
  }
  if (oy.kaymaT > 0) oy.kaymaT = Math.max(0, oy.kaymaT - dt);
}

function carpismalar() {
  if (tur.etkin.jetpack > 0 || oy.dokunulmaz > 0) return;
  const e = M.carpismaBul(uretici.engeller(), { x: oy.x, y: oy.y, kayiyor: oy.kaymaT > 0 }, tur.p);
  if (!e) return;
  const tip = M.carpismaTuru(e, tur.p);
  if (tip === 'yan') {
    if (oy.sendele > 0) return;
    if (oy.gecis) {
      // Trene yandan sürtündü: geri seker, eski şeridine döner.
      const onceki = oy.gecis.onceki;
      oy.gecis = { x0: oy.x, hedef: onceki, t: 0, onceki: oy.serit };
      oy.serit = onceki;
      oy.sendele = 0.5;
      oy.tumsek = 1;
      oy.egim = (onceki - oy.x) * 0.5;
      ses.yan();
      sahne.tekme(-4);
      sahne.parcacikSac(oy.x * S + (e.serit - oy.x) * 0.8, 1.0, 0, [0xffc266, 0xffb23f, 0xf3ead8], 10, 2.4, 0.6, true);
      return;
    }
  }
  olumBaslat(e);
}

function olumBaslat(e) {
  if (durum !== 'oyun' || (TEST && window.__olumsuz)) return;
  durum = 'olum';
  tur.neden = e.tur === 'tren' && e.gelen ? 'gelen' : e.tur;
  tur.olumZamani = 0;
  oy.vy = 4; oy.gecis = null;
  tur.hiz = -7;
  ses.muzik(false);
  ses.fren();
  sahne.korTonu();
  sahne.tekme(9);
  sahne.parcacikSac(oy.x * S, 1.0, -0.4, [0xf3ead8, 0xff6a48, 0xffb23f, 0xffc266], 22, 3.4, 0.7, true);
  ogeler.uyari.hidden = true;
  if (!hareketAz) {
    ogeler.flas.classList.remove('yan');
    void ogeler.flas.offsetWidth;
    ogeler.flas.classList.add('yan');
  }
}

function toplama(dt) {
  const miknatis = tur.etkin.miknatis > 0;
  const durumOy = { x: oy.x, y: oy.y };
  for (const j of uretici.jetonlar()) {
    if (j.alindi) continue;
    const fark = j.p - tur.p;
    if (fark > 12) continue;
    if (fark < -2) continue;
    if (cekilen.has(j)) {
      const c = cekilen.get(j) + dt / 0.2;
      if (c >= 1) { cekilen.delete(j); jetonTopla(j); } else cekilen.set(j, c);
      continue;
    }
    if (M.jetonAlinirMi(j, durumOy, tur.p, false)) jetonTopla(j);
    else if (miknatis && M.jetonAlinirMi(j, durumOy, tur.p, true)) cekilen.set(j, 0);
  }
  for (const g of uretici.guclendiriciler()) {
    if (M.gucAlinirMi(g, durumOy, tur.p)) gucAl(g);
  }
}

function jetonTopla(j) {
  j.alindi = true;
  tur.jeton++;
  tur.ist.jeton++;
  tur.seri = t - tur.sonJeton < 0.45 ? tur.seri + 1 : 0;
  tur.sonJeton = t;
  tur.puan += M.puanArtisi(0, 1, tur.etkin.x2 > 0);
  ses.jeton(tur.seri);
  const x = oy.x * S, y = oy.y + 0.9;
  if (!hareketAz) sahne.parcacikSac(x, y, -0.6, [0xffb23f, 0xffc266, 0xf3ead8], 4, 1.1, 0.5, false);
  jetonUcur(x, y);
  ogeler.jetonSayac.classList.remove('vur');
  void ogeler.jetonSayac.offsetWidth;
  ogeler.jetonSayac.classList.add('vur');
}

// Toplanan jeton HUD sayacına kısa bir uçuş yapar (DOM havuzu).
const ucanHavuz = Array.from({ length: 8 }, () => {
  const el = document.createElement('span');
  el.className = 'ucan-jeton';
  ogeler.ucanlar.append(el);
  return el;
});
let ucanSira = 0;
function jetonUcur(x, y) {
  if (hareketAz || !ogeler.ucanlar.animate || t - tur.sonUcus < 0.05) return;
  tur.sonUcus = t;
  const bas = sahne.ekranKonumu(x, y, -0.6);
  const a = alan.getBoundingClientRect(), s = ogeler.jetonSayac.getBoundingClientRect();
  const hx = s.left - a.left + 22, hy = s.top - a.top + s.height / 2;
  const el = ucanHavuz[ucanSira++ % ucanHavuz.length];
  el.animate([
    { transform: `translate(${bas.x}px, ${bas.y}px) scale(1.4)`, opacity: 1 },
    { transform: `translate(${(bas.x + hx) / 2}px, ${Math.min(bas.y, hy) - 30}px) scale(1.1)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${hx}px, ${hy}px) scale(.7)`, opacity: 0.9 }
  ], { duration: 420, easing: 'cubic-bezier(.45,0,.7,1)' });
}

function gucAl(g) {
  g.alindi = true;
  tur.ist.guc++;
  tur.etkin[g.tur] = M.GUC_SURESI[g.tur];
  ses.guc();
  sahne.tekme(2);
  if (!hareketAz) sahne.parcacikSac(oy.x * S, 1.2, -0.5, [0xffb23f, 0xffc266, 0xf3ead8], 16, 2.6, 0.8, false);
  uyariGoster(GUC_ADI[g.tur] + '!');
  if (g.tur === 'jetpack') {
    oy.kaymaT = 0;
    // Gökyüzünde jeton yolu
    const sure = M.GUC_SURESI.jetpack, hiz = M.hiz(tur.p);
    let serit = Math.round(oy.x), sayac = 0;
    for (let p = tur.p + 18; p < tur.p + hiz * (sure - 0.6); p += 3.2) {
      if (++sayac % 9 === 0) serit = Math.max(-1, Math.min(1, serit + (Math.random() < 0.5 ? -1 : 1)));
      uretici.jetonlar().push({ serit, p, y: JETPACK_Y + 0.9, alindi: false });
    }
  }
  guclerHud(true);
}

function guclerGuncelle(dt) {
  for (const tur_ of M.GUCLER) {
    if (tur.etkin[tur_] <= 0) continue;
    tur.etkin[tur_] = Math.max(0, tur.etkin[tur_] - dt);
    if (tur.etkin[tur_] === 0) {
      ses.gucBitti();
      if (tur_ === 'jetpack') { oy.havada = true; oy.vy = 0; oy.dokunulmaz = 1.2; }
      if (tur_ === 'miknatis') cekilen.clear();
      guclerHud(true);
    }
  }
  guclerHud(false);
}

let uyariZamani = 0;
function uyariGoster(metin) {
  ogeler.uyari.textContent = metin;
  ogeler.uyari.classList.add('guc-uyari');
  ogeler.uyari.hidden = false;
  uyariZamani = t + 1.4;
}
// Önden gelen trenin düdüğü: oyuncunun şeridinde, görünür uzaklığı 40–75 m arasında.
function uyarilar() {
  if (!ogeler.uyari.hidden && t > uyariZamani) ogeler.uyari.hidden = true;
  for (const e of uretici.engeller()) {
    if (e.tur !== 'tren' || !e.gelen || tur.kornalar.has(e.id)) continue;
    const uz = M.gorunurUzaklik(e, tur.p);
    if (uz < 75 && uz > 30 && Math.abs(e.serit - oy.x) < 0.6) { tur.kornalar.add(e.id); ses.korna(); }
  }
  if (tur.kornalar.size > 40) tur.kornalar.clear();
}

// ---------- HUD ----------
let sonHud = '';
function hudGuncelle() {
  const skor = Math.floor(tur.puan);
  const anahtar = skor + ':' + tur.jeton + ':' + kayit.jeton;
  if (anahtar === sonHud) return;
  sonHud = anahtar;
  ogeler.skor.textContent = skor;
  ogeler.enIyi.textContent = Math.max(kayit.enIyi, skor);
  ogeler.jeton.textContent = kayit.jeton + tur.jeton;
  ogeler.cuzdan.textContent = kayit.jeton;
}

const CEVRE = 2 * Math.PI * 17;
const gucOgeleri = {};
function guclerHud(yeniden) {
  if (yeniden) {
    for (const g of M.GUCLER) {
      const acik = tur && tur.etkin[g] > 0;
      if (acik && !gucOgeleri[g]) {
        const el = document.createElement('span');
        el.className = 'guc';
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', GUC_ADI[g]);
        el.innerHTML = '<svg class="halka" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle class="iz" cx="20" cy="20" r="17"/><circle class="kalan" cx="20" cy="20" r="17" stroke-dasharray="' + CEVRE.toFixed(1) + '"/></svg>' + GUC_IKON[g];
        ogeler.guclar.append(el);
        gucOgeleri[g] = { el, halka: el.querySelector('.kalan'), son: -1 };
      } else if (!acik && gucOgeleri[g]) {
        gucOgeleri[g].el.remove();
        delete gucOgeleri[g];
      }
    }
  }
  for (const g in gucOgeleri) {
    const o = gucOgeleri[g], oran = tur.etkin[g] / M.GUC_SURESI[g];
    const yuvarla = Math.round(oran * 200);
    if (yuvarla === o.son) continue;
    o.son = yuvarla;
    o.halka.style.strokeDashoffset = (CEVRE * (1 - oran)).toFixed(1);
    o.el.classList.toggle('bitiyor', tur.etkin[g] < 1.6);
  }
}

function gorevYaz() {
  const g = M.gunlukGorev(bugun());
  const tamam = kayit.gorev.tarih === g.tarih && kayit.gorev.tamam;
  ogeler.gorev.innerHTML = '';
  const et = document.createElement('span');
  et.className = 'etiket';
  et.textContent = 'Günün görevi';
  et.title = 'Her gün yenilenir';
  const m = document.createElement('span');
  m.textContent = g.metin;
  const o = document.createElement('span');
  o.className = tamam ? 'tamam' : '';
  o.textContent = tamam ? '· tamamlandı' : '· +' + g.odul + ' jeton';
  ogeler.gorev.append(et, m, o);
}

function sonucGoster() {
  durum = 'bitti';
  const skor = Math.floor(tur.puan);
  const sonuc = M.turuIsle(kayit, Object.assign({ skor }, tur.ist), bugun());
  kayit = sonuc.kayit;
  kaydet();
  ogeler.sonucPuan.textContent = skor;
  ogeler.sonucMesafe.textContent = Math.floor(tur.p);
  ogeler.sonucEnIyi.textContent = kayit.enIyi;
  ogeler.sonucJeton.textContent = '+' + (tur.jeton + (sonuc.gorevBitti ? sonuc.gorev.odul : 0));
  ogeler.rekor.hidden = !sonuc.yeniRekor;
  ogeler.neden.textContent = NEDENLER[tur.neden] || '';
  const g = sonuc.gorev;
  ogeler.sonucGorev.classList.toggle('bitti', sonuc.gorevBitti || kayit.gorev.tamam);
  if (sonuc.gorevBitti) ogeler.sonucGorev.innerHTML = 'Günün görevi tamam: <b>+' + g.odul + ' jeton</b>';
  else if (kayit.gorev.tamam) ogeler.sonucGorev.textContent = 'Günün görevi bugün tamamlandı.';
  else ogeler.sonucGorev.innerHTML = g.metin + ': <b>' + M.gorevIlerleme(g, tur.ist) + ' / ' + g.hedef + '</b>';
  if ((sonuc.yeniRekor && skor > 0) || sonuc.gorevBitti) ses.rekor();
  hudGuncelle();
  if (typeof ogeler.sonuc.showModal === 'function') ogeler.sonuc.showModal();
  else ogeler.sonuc.setAttribute('open', '');
}

// ---------- Karakterler ----------
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
    else alt.innerHTML = JETON_SVG + '<span>' + k.fiyat + '</span>';
    b.setAttribute('aria-label', k.ad + (secili ? ', seçili' : acik ? '' : ', kilitli, ' + k.fiyat + ' jeton'));
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
    ses.yan();
    return;
  }
  const yeniAcildi = kayit.acik.indexOf(k.id) === -1;
  kayit = sonuc.kayit;
  kaydet();
  ogeler.karakterMesaj.textContent = yeniAcildi ? k.ad + ' açıldı!' : '';
  if (yeniAcildi) ses.rekor(); else ses.inis();
  sahne.karakterAyarla(kayit.secili);
  oy.sx = 1.25; oy.sy = 0.75;
  karakterleriCiz();
  sonHud = '';
  hudGuncelle();
}

function baslangicGoster(karakterlerle) {
  ogeler.baslangic.hidden = false;
  ogeler.baslangic.classList.toggle('sade', !karakterlerle);
  ogeler.karakterMesaj.textContent = '';
  gorevYaz();
  karakterleriCiz();
}

// ---------- Girdi ----------
document.addEventListener('keydown', (e) => {
  if (ogeler.sonuc.open || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (durum === 'oyun') duraklatDegistir(); return; }
  const eylem = TUSLAR[e.code];
  if (!eylem) return;
  if (e.target.closest && e.target.closest('button, a, input') && (e.code === 'Space' || e.code === 'Enter')) return;
  e.preventDefault();
  if (duraklatildi) { devamEt(); return; }
  if (!e.repeat) girdi(eylem);
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
  girdi(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'sag' : 'sol') : (dy > 0 ? 'kay' : 'zipla'));
});
alan.addEventListener('pointerup', (e) => {
  if (!dokunus || e.pointerId !== dokunus.id) return;
  if (!dokunus.kullanildi && durum === 'hazir') girdi('baslat');
  dokunus = null;
});
alan.addEventListener('pointercancel', () => { dokunus = null; });
alan.addEventListener('contextmenu', (e) => e.preventDefault());
// iOS Safari: oyun alanında sayfa kaymasın (touch-action yanında ikinci güvence).
alan.addEventListener('touchmove', (e) => { if (!e.target.closest('.karakterler')) e.preventDefault(); }, { passive: false });

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
  if (kayit.ses && durum === 'oyun') ses.muzik(true);
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
  ses.duraklat();
  $('devam').focus({ preventScroll: true });
}
function devamEt() {
  if (!duraklatildi) return;
  duraklatildi = false;
  ogeler.duraklama.hidden = true;
  ogeler.duraklatDugme.setAttribute('aria-label', 'Duraklat');
  ogeler.duraklatDugme.classList.remove('durdu');
  ses.surdur();
  dongu.basla();
}
ogeler.duraklatDugme.addEventListener('click', () => { if (durum === 'oyun') duraklatDegistir(); });
$('devam').addEventListener('click', devamEt);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { duraklat(); dongu.dur(); ses.duraklat(); }
  else if (!duraklatildi) { ses.surdur(); dongu.basla(); }
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
  let id = 0, son = 0, kareSayisi = 0, kareToplam = 0, isToplam = 0, enKotu = 0;
  function kare(zaman) {
    id = requestAnimationFrame(kare);
    const dt = son ? Math.min(0.05, (zaman - son) / 1000) : 0.016;
    if (son) { kareToplam += zaman - son; kareSayisi++; enKotu = Math.max(enKotu, zaman - son); }
    son = zaman;
    const bas = performance.now();
    guncelle(dt);
    sahne.ciz();
    isToplam += performance.now() - bas;
    if (alan.dataset.durum !== durum) alan.dataset.durum = durum;
    if (kareToplam > 2000) {
      const ort = kareToplam / kareSayisi;
      alan.dataset.fps = Math.round(1000 / ort);
      alan.dataset.ms = (isToplam / kareSayisi).toFixed(1);
      alan.dataset.enKotu = Math.round(enKotu);
      alan.dataset.cizim = sahne.renderer.info.render.calls;
      sahne.kaliteAyarla(ort);
      kareToplam = 0; kareSayisi = 0; isToplam = 0; enKotu = 0;
    }
  }
  return {
    basla() { if (!id && !document.hidden) { son = 0; id = requestAnimationFrame(kare); } },
    dur() { if (id) cancelAnimationFrame(id); id = 0; }
  };
})();

// ---------- Otomatik test kancası (yalnızca ?test adresinde) ----------
if (TEST) {
  window.MarmarayTest = {
    durum: () => ({ durum, ist: Object.assign({}, tur.ist), p: tur.p, hiz: tur.hiz, x: oy.x, y: oy.y, serit: oy.serit, kayiyor: oy.kaymaT > 0, puan: tur.puan, jeton: tur.jeton, etkin: Object.assign({}, tur.etkin), bolum: uretici.bolum(tur.p).tur }),
    engeller: () => uretici.engeller().map((e) => Object.assign({}, e)),
    // Ölümsüz kip: ekran görüntüsü ve kare süresi ölçümü için.
    olumsuz(acik) { window.__olumsuz = acik; },
    git(p) { tur.p = p; uretici.ilerlet(p + 200); uretici.temizle(p); sahne.sifirla(p); },
    guc(g) { gucAl({ tur: g, alindi: false }); },
    bellek: () => ({ engel: uretici.engeller().length, jeton: uretici.jetonlar().length, kornalar: tur.kornalar.size, cekilen: cekilen.size })
  };
}

// ---------- Başlat ----------
const onizleme = (() => { try { return sahne.onizlemeler(M.KARAKTERLER.map((k) => k.id), 128); } catch (e) { return {}; } })();
sesDugmesiniCiz();
yeniTur();
baslangicGoster(true);
dongu.basla();
