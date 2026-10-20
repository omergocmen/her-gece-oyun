// Kapadokya Yolları: oyun döngüsü, kontroller, HUD, ralli ve kayıtlar. Sabit adımlı fizik (120 Hz),
// çizim ekran tazelemesiyle; sekme gizlenince döngü durur.
import { Sahne, RENKLER } from './sahne.js';
import { Ses } from './ses.js';

const M = window.KapadokyaMantik;
const SIM = 1 / 120;
const ANAHTAR = { ses: 'kapadokya:ses', ralli: 'kapadokya:ralli', egim: 'kapadokya:egim' };
const RALLI_GECE = 0.1; // ralli hep alacakaranlıkta

const $ = (id) => document.getElementById(id);
const el = {
  sahne: $('sahne'), tuval: $('tuval'), hud: $('hud'), hudRalli: $('hud-ralli'), hudSerbest: $('hud-serbest'),
  sure: $('sure'), kn: $('kn'), fark: $('fark'), km: $('km'), saat: $('saat'), hizKutu: $('hiz-gosterge'), hiz: $('hiz'),
  mesaj: $('mesaj'), dirIz: $('direksiyon-iz'), gaz: $('gaz'), fren: $('fren'),
  menu: $('menu'), duraklat: $('duraklat'), sonuc: $('sonuc'), yukleniyor: $('yukleniyor'), hata: $('hata'),
  tohum: $('tohum'), zar: $('zar'), gunluge: $('gunluge'), rekorSatiri: $('rekor-satiri'),
  serbestBasla: $('serbest-basla'), ralliBasla: $('ralli-basla'), egimAyari: $('egim-ayari'), egim: $('egim'),
  sesDugme: $('ses-dugme'), duraklatDugme: $('duraklat-dugme'), tamEkran: $('tam-ekran'), yolaDon: $('yola-don'),
  devam: $('devam'), foto: $('foto-modu'), yeniden: $('yeniden'), modSec: $('mod-sec'),
  sonucUst: $('sonuc-ust'), rekorDamga: $('rekor-damga'), sonucSure: $('sonuc-sure'), sonucFark: $('sonuc-fark'),
  araGovde: $('ara-govde'), tekrar: $('tekrar'), sonucSerbest: $('sonuc-serbest')
};

const azHareket = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const dokunmatik = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (dokunmatik) document.documentElement.classList.add('dokunmatik');

let sahne;
try {
  sahne = new Sahne(el.tuval, { azHareket });
} catch (e) {
  el.yukleniyor.hidden = true;
  el.menu.hidden = true;
  el.hata.hidden = false;
  throw e;
}
const ses = new Ses();
ses.acik = Depo.oku(ANAHTAR.ses, true) !== false;

const bugun = new Date();
const gunlukTohum = M.gunlukTohum(bugun);
const gunNo = M.bulmacaNo(bugun);

// ---------- Oyun durumu ----------
let faz = 'yukleniyor'; // menu | geriSayim | surus | duraklat | foto | bitis
let mod = null;         // serbest | ralli
let dunya = null, tohum = gunlukTohum;
let arac, onceki = { x: 0, y: 0, z: 0, yon: 0 }, sus, tekerDonus = 0, sonY = 0, sonVy = 0, yolPayi = 1;
let birikim = 0, adim = 0, zaman = 0, km = 0, gokZaman = 0, geriSayim = 0, bitisBekle = 0, yoldanCikik = 0;
let parkur = null, ralli = null, hayaletKayit = null, eskiKayit = null, sonKonum = { s: 0, u: 0 };
let duraklatOncesi = 'surus';
const egimGorsel = { egim: 0, yalpa: 0 };
// Serbest sürüşe gecenin belli bir anından başlamak için (ör. ?saat=0.5 → döngünün yarısı, gece yarısı)
const baslangicSaati = (parseFloat(new URLSearchParams(location.search).get('saat')) || 0) * M.DONGU;

function dunyaHazirla(t) {
  if (dunya && dunya.tohum === t) return;
  dunya = new M.Dunya(t);
  sahne.dunyaKur(dunya);
}

function aracYerlestir(s, hiz) {
  const o = dunya.yol.noktaS(s);
  arac = M.yeniArac(o.x, o.z, o.yon);
  arac.y = o.y;
  if (hiz) { arac.vx = Math.sin(o.yon) * hiz; arac.vz = Math.cos(o.yon) * hiz; }
  sus = M.yeniSuspansiyon();
  sonY = o.y; sonVy = 0;
  onceki = { x: arac.x, y: arac.y, z: arac.z, yon: arac.yon };
  sonKonum = { s: s, u: 0 };
}

function hepsiniKur() {
  const o = dunya.yol.yakin(arac.x, arac.z, 60);
  sahne.dunyaGuncelle(arac.x, arac.z, o.s, Infinity);
}

// ---------- Girdi ----------
const tuslar = new Set();
const dokunma = { gaz: false, fren: false, yon: 0, kimlik: null, x0: 0 };
let egimYon = 0, egimAcik = false;

function girdi() {
  const sol = tuslar.has('ArrowLeft') || tuslar.has('KeyA');
  const sag = tuslar.has('ArrowRight') || tuslar.has('KeyD');
  let yon = (sag ? 1 : 0) - (sol ? 1 : 0);
  if (!yon && dokunma.kimlik != null) yon = dokunma.yon;
  if (!yon && egimAcik) yon = egimYon;
  return {
    gaz: tuslar.has('ArrowUp') || tuslar.has('KeyW') || dokunma.gaz ? 1 : 0,
    fren: tuslar.has('ArrowDown') || tuslar.has('KeyS') || dokunma.fren ? 1 : 0,
    yon,
    elFreni: tuslar.has('Space')
  };
}

const OYUN_TUSLARI = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']);
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (faz === 'foto') { e.preventDefault(); fotoBitir(); return; }
  const oyunda = faz === 'surus' || faz === 'geriSayim';
  if (OYUN_TUSLARI.has(e.code) && oyunda) { tuslar.add(e.code); e.preventDefault(); }
  if (e.repeat) return;
  if ((e.code === 'Escape' || e.code === 'KeyP') && (oyunda || faz === 'duraklat')) { e.preventDefault(); faz === 'duraklat' ? devamEt() : duraklat(); }
  else if (e.code === 'KeyR' && faz === 'surus') yolaDon();
  else if (e.code === 'KeyM') sesDegistir();
});
window.addEventListener('keyup', (e) => tuslar.delete(e.code));
window.addEventListener('blur', () => { tuslar.clear(); dokunma.gaz = dokunma.fren = false; dokunma.kimlik = null; });

function pedal(dugme, alan) {
  const birak = () => { dokunma[alan] = false; dugme.classList.remove('basili'); };
  dugme.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    try { dugme.setPointerCapture(e.pointerId); } catch (h) { /* sentetik olaylarda yakalama olmayabilir */ }
    dokunma[alan] = true; dugme.classList.add('basili');
    ses.baslat();
  });
  dugme.addEventListener('pointerup', birak);
  dugme.addEventListener('pointercancel', birak);
  dugme.addEventListener('lostpointercapture', birak);
  dugme.addEventListener('contextmenu', (e) => e.preventDefault());
}
pedal(el.gaz, 'gaz');
pedal(el.fren, 'fren');

// Direksiyon: ekranın sol yarısında yatay sürükleme
el.sahne.addEventListener('pointerdown', (e) => {
  if (faz === 'foto') { fotoBitir(); return; }
  if (!(faz === 'surus' || faz === 'geriSayim') || e.pointerType === 'mouse') return;
  if (e.target.closest('button, .kaplama, input, a')) return;
  const r = el.sahne.getBoundingClientRect();
  if (e.clientX - r.left > r.width / 2 || dokunma.kimlik != null) return;
  e.preventDefault();
  dokunma.kimlik = e.pointerId; dokunma.x0 = e.clientX; dokunma.yon = 0;
  try { el.sahne.setPointerCapture(e.pointerId); } catch (h) { /* yakalama yoksa da sürükleme çalışır */ }
  el.dirIz.hidden = false;
  el.dirIz.style.left = (e.clientX - r.left) + 'px';
  el.dirIz.style.top = (e.clientY - r.top) + 'px';
  el.dirIz.firstElementChild.style.transform = '';
});
el.sahne.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dokunma.kimlik) return;
  dokunma.yon = M.sinirla((e.clientX - dokunma.x0) / 64, -1, 1);
  el.dirIz.firstElementChild.style.transform = 'translateX(' + (dokunma.yon * 44) + 'px)';
});
const direksiyonBirak = (e) => {
  if (e.pointerId !== dokunma.kimlik) return;
  dokunma.kimlik = null; dokunma.yon = 0; el.dirIz.hidden = true;
};
el.sahne.addEventListener('pointerup', direksiyonBirak);
el.sahne.addEventListener('pointercancel', direksiyonBirak);
el.sahne.addEventListener('touchmove', (e) => { if (faz !== 'menu' && faz !== 'bitis') e.preventDefault(); }, { passive: false });

// Eğim ile direksiyon (isteğe bağlı)
function egimDinle(e) {
  const aci = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  let deger = aci === 90 ? e.beta : aci === -90 || aci === 270 ? -e.beta : e.gamma;
  if (deger == null) return;
  if (Math.abs(deger) < 3) deger = 0;
  egimYon = M.sinirla(deger / 26, -1, 1);
}
async function egimAyarla(acik) {
  if (acik && typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') acik = false; } catch (e) { acik = false; }
  }
  egimAcik = acik;
  el.egim.checked = acik;
  Depo.yaz(ANAHTAR.egim, acik);
  window.removeEventListener('deviceorientation', egimDinle);
  if (acik) window.addEventListener('deviceorientation', egimDinle);
  else egimYon = 0;
}
if (dokunmatik && 'DeviceOrientationEvent' in window) {
  el.egimAyari.hidden = false;
  el.egim.addEventListener('change', () => egimAyarla(el.egim.checked));
  if (Depo.oku(ANAHTAR.egim, false)) egimAyarla(true);
}

// ---------- Menü ve tohum ----------
function tohumOku() {
  const v = parseInt(el.tohum.value.replace(/\D/g, ''), 10);
  return isFinite(v) ? v % 1000000 : gunlukTohum;
}

function kayitlar() { return Depo.oku(ANAHTAR.ralli, {}) || {}; }

function menuYaz() {
  const t = tohumOku();
  const gunluk = t === gunlukTohum;
  el.ralliBasla.textContent = gunluk ? 'Günlük ralli' : 'Bu tohumla ralli';
  el.gunluge.hidden = gunluk;
  const k = kayitlar()[t];
  const ad = gunluk ? 'Günün parkuru #' + gunNo : 'Parkur ' + t;
  el.rekorSatiri.innerHTML = '';
  const b = document.createElement('b'); b.textContent = ad;
  el.rekorSatiri.append(b, document.createTextNode(k ? ' · rekorun ' + M.sureYaz(k.sure) : ' · henüz rekorun yok'));
}

let tohumZamanlayici = 0;
el.tohum.addEventListener('input', () => {
  el.tohum.value = el.tohum.value.replace(/\D/g, '').slice(0, 6);
  menuYaz();
  clearTimeout(tohumZamanlayici);
  tohumZamanlayici = setTimeout(onizle, 450);
});
el.zar.addEventListener('click', () => { el.tohum.value = String(Math.floor(Math.random() * 1000000)); menuYaz(); onizle(); });
el.gunluge.addEventListener('click', () => { el.tohum.value = String(gunlukTohum); menuYaz(); onizle(); });

function onizle() {
  const t = tohumOku();
  if (dunya && dunya.tohum === t) return;
  dunyaHazirla(t);
  aracYerlestir(60);
  hepsiniKur();
}

function kaplamaGoster(hangisi) {
  for (const k of ['menu', 'duraklat', 'sonuc']) el[k].hidden = k !== hangisi;
}

function hudGoster(acik) {
  el.hud.hidden = !acik;
  el.hizKutu.hidden = !acik;
  el.gaz.hidden = el.fren.hidden = !(acik && dokunmatik);
  if (!acik) { el.mesaj.textContent = ''; el.dirIz.hidden = true; }
}

// ---------- Mod başlatma ----------
function basla(yeniMod) {
  ses.baslat();
  mod = yeniMod;
  tohum = tohumOku();
  dunyaHazirla(tohum);
  aracYerlestir(60);
  hepsiniKur();
  birikim = 0; adim = 0; zaman = 0; km = 0; gokZaman = baslangicSaati; bitisBekle = 0; yoldanCikik = 0; tekerDonus = 0;
  tuslar.clear();
  el.fark.hidden = true;
  el.hudRalli.hidden = yeniMod !== 'ralli';
  el.hudSerbest.hidden = yeniMod !== 'serbest';
  if (yeniMod === 'ralli') {
    parkur = M.ralliParkuru(tohum);
    ralli = M.ralliDurumu();
    sahne.kapilariKur(parkur);
    eskiKayit = kayitlar()[tohum] || null;
    hayaletKayit = M.hayaletYeni();
    sahne.gokAyarla(RALLI_GECE);
    geriSayim = azHareket ? 2.999 : 3.999;
    faz = 'geriSayim';
    mesajYaz(String(Math.floor(geriSayim)), false, true);
    ses.bip(false);
  } else {
    parkur = ralli = eskiKayit = hayaletKayit = null;
    sahne.kapilariKur(null);
    faz = 'surus';
    mesajYaz('İyi yolculuklar', true, true, 2);
  }
  kaplamaGoster(null);
  hudGoster(true);
  hudYaz();
  el.tuval.focus({ preventScroll: true });
}

let mesajSure = 0;
function mesajYaz(metin, kucuk, vurgu, sure) {
  el.mesaj.textContent = metin;
  el.mesaj.classList.toggle('kucuk', !!kucuk);
  el.mesaj.classList.remove('vurgu');
  if (vurgu && !azHareket) { void el.mesaj.offsetWidth; el.mesaj.classList.add('vurgu'); }
  mesajSure = sure || 0;
}

function yolaDon() {
  if (!(faz === 'surus' && arac)) return;
  const q = dunya.yol.yakin(arac.x, arac.z, 400);
  let s = isFinite(q.d) ? q.s : sonKonum.s;
  if (ralli && !ralli.bitti) s = Math.min(s, parkur.kn[ralli.sonraki] - 20);
  aracYerlestir(Math.max(20, s));
  yoldanCikik = 0;
}

function farkGoster(kutu, fark) {
  kutu.textContent = M.farkYaz(fark);
  kutu.className = 'fark ' + (Math.abs(fark) < 0.05 ? 'esit' : fark > 0 ? 'yavas' : 'hizli');
  kutu.setAttribute('aria-label', fark > 0 ? M.farkYaz(fark) + ' saniye yavaş' : M.farkYaz(fark) + ' saniye hızlı');
}

function knGecildi(i) {
  sahne.kapiGecildi(i);
  ses.can();
  const fark = eskiKayit ? M.hayaletFarki(ralli.araSureler, eskiKayit.araSureler, i) : null;
  if (fark != null) {
    farkGoster(el.fark, fark);
    el.fark.hidden = false;
    if (!azHareket) { el.fark.classList.remove('vurgu'); void el.fark.offsetWidth; el.fark.classList.add('vurgu'); }
  }
  if (ralli.bitti) bitir();
  else mesajYaz('KN ' + (i + 1) + ' · ' + M.sureYaz(ralli.araSureler[i]), true, true, 1.6);
}

function bitir() {
  const sure = ralli.araSureler[ralli.araSureler.length - 1];
  M.hayaletEkle(hayaletKayit, arac.x, arac.z, arac.yon);
  const sonuc = M.rekorIsle(kayitlar(), String(tohum), sure, ralli.araSureler, hayaletKayit, Date.now());
  Depo.yaz(ANAHTAR.ralli, sonuc.kayitlar);
  ses.bitis(sonuc.rekor);
  mesajYaz(M.sureYaz(sure), false, true, 0);
  bitisBekle = 1.6;

  el.sonucUst.textContent = tohum === gunlukTohum ? 'Günün parkuru #' + gunNo : 'Parkur ' + tohum;
  el.sonucSure.textContent = M.sureYaz(sure);
  el.rekorDamga.hidden = !sonuc.rekor;
  if (sonuc.onceki != null) { farkGoster(el.sonucFark, sure - sonuc.onceki); el.sonucFark.hidden = false; }
  else el.sonucFark.hidden = true;
  el.araGovde.innerHTML = '';
  ralli.araSureler.forEach((t, i) => {
    const tr = document.createElement('tr');
    const a = document.createElement('td'); a.textContent = i === ralli.araSureler.length - 1 ? 'Bitiş' : String(i + 1);
    const b = document.createElement('td'); b.textContent = M.sureYaz(t);
    const c = document.createElement('td');
    const f = eskiKayit ? M.hayaletFarki(ralli.araSureler, eskiKayit.araSureler, i) : null;
    if (f != null) { const k = document.createElement('span'); farkGoster(k, f); c.append(k); } else c.textContent = '–';
    tr.append(a, b, c);
    el.araGovde.append(tr);
  });
}

function sonucGoster() {
  faz = 'bitis';
  hudGoster(false);
  kaplamaGoster('sonuc');
  el.tekrar.focus({ preventScroll: true });
}

function duraklat() {
  if (!(faz === 'surus' || faz === 'geriSayim')) return;
  duraklatOncesi = faz;
  faz = 'duraklat';
  tuslar.clear();
  dokunma.gaz = dokunma.fren = false; dokunma.kimlik = null;
  el.dirIz.hidden = true;
  el.gaz.classList.remove('basili'); el.fren.classList.remove('basili');
  kaplamaGoster('duraklat');
  ses.duraklat();
  el.devam.focus({ preventScroll: true });
}

function devamEt() {
  faz = duraklatOncesi;
  kaplamaGoster(null);
  hudGoster(true);
  ses.devam();
  son = performance.now();
}

function fotoBasla() {
  faz = 'foto';
  kaplamaGoster(null);
  el.sahne.classList.add('foto');
}
function fotoBitir() {
  el.sahne.classList.remove('foto');
  faz = 'duraklat';
  kaplamaGoster('duraklat');
}

function menuyeDon() {
  faz = 'menu';
  hudGoster(false);
  sahne.kapilariKur(null);
  parkur = ralli = null;
  kaplamaGoster('menu');
  menuYaz();
  ses.devam();
}

function sesDegistir() {
  ses.sessiz(ses.acik);
  Depo.yaz(ANAHTAR.ses, ses.acik);
  sesDugmesiYaz();
}
function sesDugmesiYaz() {
  el.sesDugme.setAttribute('aria-pressed', String(!ses.acik));
  el.sesDugme.setAttribute('aria-label', ses.acik ? 'Sesi kapat' : 'Sesi aç');
}

el.serbestBasla.addEventListener('click', () => basla('serbest'));
el.ralliBasla.addEventListener('click', () => basla('ralli'));
el.tekrar.addEventListener('click', () => basla('ralli'));
el.sonucSerbest.addEventListener('click', () => basla('serbest'));
el.devam.addEventListener('click', devamEt);
el.foto.addEventListener('click', fotoBasla);
el.yeniden.addEventListener('click', () => basla(mod));
el.modSec.addEventListener('click', menuyeDon);
el.duraklatDugme.addEventListener('click', duraklat);
el.sesDugme.addEventListener('click', () => { ses.baslat(); sesDegistir(); });
el.yolaDon.addEventListener('click', yolaDon);
// HUD düğmesine tıkladıktan sonra odak üzerinde kalmasın: Boşluk (el freni) düğmeyi yeniden tetiklemesin
el.hud.addEventListener('click', (e) => { const d = e.target.closest('button'); if (d) d.blur(); });
if (el.sahne.requestFullscreen) {
  el.tamEkran.hidden = false;
  el.tamEkran.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else el.sahne.requestFullscreen().catch(() => {});
  });
}

// ---------- Fizik adımı ----------
function simAdim(dt) {
  let g = faz === 'surus' ? girdi() : { gaz: 0, fren: 0, yon: 0 };
  if (ralli && ralli.bitti) g = { gaz: 0, fren: 0.5, yon: 0 };
  onceki.x = arac.x; onceki.y = arac.y; onceki.z = arac.z; onceki.yon = arac.yon;

  const z0 = dunya.zemin(arac.x, arac.z);
  const fx = Math.sin(arac.yon), fz = Math.cos(arac.yon);
  const yokus = (dunya.zemin(arac.x + fx * 1.3, arac.z + fz * 1.3).y - dunya.zemin(arac.x - fx * 1.3, arac.z - fz * 1.3).y) / 2.6;
  M.aracAdim(arac, g, dt, z0.yolPayi, yokus);
  const siddet = M.carpismaCoz(arac, sahne.engeller(arac.x, arac.z), 1.4);
  if (siddet > 2.5) ses.carpma(siddet);
  const z1 = dunya.zemin(arac.x, arac.z);
  arac.y = z1.y;
  yolPayi = z1.yolPayi;
  const vy = (arac.y - sonY) / dt;
  const ay = M.sinirla((vy - sonVy) / dt, -80, 80);
  sonY = arac.y; sonVy = vy;
  M.suspansiyonAdim(sus, arac.boyIvme, arac.yanIvme, ay, dt);
  tekerDonus += arac.ileriHiz * dt / 0.36;
  const hiz = Math.hypot(arac.vx, arac.vz);
  km += hiz * dt / 1000;
  yoldanCikik = yolPayi === 0 && (!isFinite(z1.yol.d) || z1.yol.d > 10) ? yoldanCikik + dt : 0;

  const q = isFinite(z1.yol.d) ? z1.yol : dunya.yol.yakin(arac.x, arac.z, 80);
  const simdi = isFinite(q.d) ? { s: q.s, u: q.u } : sonKonum;
  if (ralli && !ralli.bitti && faz === 'surus') {
    if (adim % Math.round(M.HAYALET_ARALIK / SIM) === 0) M.hayaletEkle(hayaletKayit, arac.x, arac.z, arac.yon);
    const i = M.ralliKontrol(ralli, parkur, sonKonum, simdi, zaman, dt);
    sonKonum = simdi;
    zaman += dt;
    adim++;
    if (i >= 0) knGecildi(i);
  } else {
    sonKonum = simdi;
    if (mod === 'serbest' && faz === 'surus') gokZaman += dt;
  }
}

// ---------- HUD ----------
let hudZaman = 0;
function hudYaz() {
  if (mod === 'ralli' && ralli) {
    el.sure.textContent = M.sureYaz(ralli.bitti ? ralli.araSureler[ralli.araSureler.length - 1] : zaman);
    el.kn.textContent = 'KN ' + ralli.sonraki + '/' + M.KN_SAYISI;
  } else if (mod === 'serbest') {
    el.km.textContent = km.toFixed(1);
    el.saat.textContent = M.gokDurumu(gokZaman).saat;
  }
  el.hiz.textContent = String(Math.round(Math.abs(arac.ileriHiz) * 3.6));
}

// ---------- Toz ve duman ----------
let tozBirikim = 0;
const TOZ_RENGI = RENKLER.kum.clone().lerp(RENKLER.kemik, 0.35); // kum tozu, ışıkta biraz açık
function tozSac(dt, x, y, z) {
  const hiz = Math.hypot(arac.vx, arac.vz);
  const arazi = 1 - yolPayi;
  const kayma = Math.max(0, arac.kayma - 3) * Math.min(1, hiz / 6);
  const oran = (arazi * Math.max(0, hiz - 2) * 2.2 + (1 - arazi) * kayma * 9) * (azHareket ? 0.4 : 1);
  tozBirikim += oran * dt;
  const fx = Math.sin(arac.yon), fz = Math.cos(arac.yon);
  while (tozBirikim >= 1) {
    tozBirikim -= 1;
    const yan = Math.random() < 0.5 ? -0.85 : 0.85;
    const renk = arazi > 0.5 ? TOZ_RENGI : RENKLER.soluk;
    sahne.tozSac(x - fx * 1.4 - fz * yan, y + 0.25, z - fz * 1.4 + fx * yan, -arac.vx * 0.3, -arac.vz * 0.3, renk, Math.min(1, hiz / 30));
  }
}

// ---------- Ana döngü ----------
let son = performance.now(), rafNo = 0, calisiyor = false;
const olcum = { kare: 0, toplam: 0, fps: 0, dusurme: 0, isMs: 0 };

function kare(simdi) {
  rafNo = requestAnimationFrame(kare);
  const basla0 = performance.now();
  kareIsle(simdi);
  const ms = performance.now() - basla0;
  olcum.isMs = olcum.isMs * 0.95 + ms * 0.05;
}

function kareIsle(simdi) {
  const gercekDt = Math.min(0.1, Math.max(0, (simdi - son) / 1000));
  son = simdi;
  if (faz === 'yukleniyor' || !arac) return;

  // Ölçüm ve uyarlanır çözünürlük: yavaş cihazda piksel oranı düşer, 30 fps altına inmesin
  olcum.kare++; olcum.toplam += gercekDt;
  if (olcum.toplam >= 2) {
    olcum.fps = olcum.kare / olcum.toplam;
    const ms = 1000 / olcum.fps;
    if (ms > 22 && sahne.oran > 0.61) { sahne.kaliteAyarla(sahne.oran - 0.15); olcum.dusurme = simdi; }
    else if (ms < 13 && sahne.oran < sahne.azamiOran && simdi - olcum.dusurme > 15000) sahne.kaliteAyarla(sahne.oran + 0.1);
    olcum.kare = 0; olcum.toplam = 0;
  }

  const fizikVar = faz === 'surus' || faz === 'bitis' || faz === 'geriSayim';
  if (faz === 'geriSayim') {
    const once = Math.ceil(geriSayim);
    geriSayim -= gercekDt;
    const sonra = Math.ceil(geriSayim);
    if (geriSayim <= 0) { faz = 'surus'; mesajYaz('Bas!', false, true, 0.8); ses.bip(true); }
    else if (sonra !== once) { mesajYaz(String(sonra), false, true); ses.bip(false); }
  }
  if (fizikVar) {
    birikim += gercekDt;
    let n = 0;
    while (birikim >= SIM && n < 12) { simAdim(SIM); birikim -= SIM; n++; }
    if (n === 12) birikim = 0;
  }
  if (faz === 'bitis' || (ralli && ralli.bitti && faz === 'surus')) {
    if (bitisBekle > 0) { bitisBekle -= gercekDt; if (bitisBekle <= 0 && faz === 'surus') sonucGoster(); }
  }
  if (mesajSure > 0) { mesajSure -= gercekDt; if (mesajSure <= 0) el.mesaj.textContent = ''; }

  // Ara değerli çizim konumu
  const t = fizikVar ? birikim / SIM : 1;
  const x = onceki.x + (arac.x - onceki.x) * t, y = onceki.y + (arac.y - onceki.y) * t, z = onceki.z + (arac.z - onceki.z) * t;
  const yon = onceki.yon + (arac.yon - onceki.yon) * t;

  // Gövdenin zemine göre eğimi: ön-arka ve sağ-sol yükseklik farkı
  const fx = Math.sin(yon), fz = Math.cos(yon), rx = -fz, rz = fx;
  const on = dunya.zemin(x + fx * 1.3, z + fz * 1.3).y, arka = dunya.zemin(x - fx * 1.3, z - fz * 1.3).y;
  const sag = dunya.zemin(x + rx * 0.8, z + rz * 0.8).y, sol = dunya.zemin(x - rx * 0.8, z - rz * 0.8).y;
  const yumu = 1 - Math.exp(-gercekDt * 14);
  egimGorsel.egim += (Math.atan2(arka - on, 2.6) - egimGorsel.egim) * yumu;
  egimGorsel.yalpa += (Math.atan2(sol - sag, 1.6) - egimGorsel.yalpa) * yumu;

  const gece = mod === 'serbest' ? M.gokDurumu(gokZaman).gece : RALLI_GECE;
  if (Math.abs(gece - sahne.gece) > 0.002 || faz === 'yukleniyor') sahne.gokAyarla(gece);

  let hayalet = null;
  if (eskiKayit && eskiKayit.hayalet && ralli && faz !== 'menu') {
    const h = M.hayaletKonum(eskiKayit.hayalet, zaman);
    if (h && !h.bitti) hayalet = { x: h.x, z: h.z, y: dunya.zemin(h.x, h.z).y, yon: h.yon };
  }

  const kameraModu = faz === 'menu' || faz === 'foto' || faz === 'bitis' ? 'yörünge' : 'kovalama';
  sahne.guncelle({
    arac: {
      x, y, z, yon, egim: egimGorsel.egim, yalpa: egimGorsel.yalpa, cokme: sus.cokme, susEgim: sus.egim, susYalpa: sus.yalpa,
      direksiyon: arac.direksiyon, tekerDonus, hiz: Math.hypot(arac.vx, arac.vz), vx: arac.vx, vz: arac.vz,
      fren: faz === 'surus' && girdi().fren > 0 && arac.ileriHiz > 0.5
    },
    hayalet, kameraModu, yorungeYaricap: faz === 'foto' ? 12 : 9.5
  }, faz === 'duraklat' ? 0 : gercekDt);
  if (faz !== 'duraklat') tozSac(gercekDt, x, y, z);

  // Yakındaki parçaları sırayla kur (karede bir tane: takılma olmasın)
  sahne.dunyaGuncelle(x, z, sonKonum.s, 1);
  sahne.ciz();

  hudZaman += gercekDt;
  if (hudZaman > 0.05 && !el.hud.hidden) { hudZaman = 0; hudYaz(); }
  if (faz === 'surus' && yoldanCikik > 4 && mesajSure <= 0) mesajYaz(dokunmatik ? 'Yola dönmek için ↺' : 'Yola dönmek için R', true, false, 2.5);

  const sesAktif = faz === 'surus' || faz === 'geriSayim' || faz === 'bitis' || faz === 'menu';
  const g = faz === 'surus' || faz === 'geriSayim' ? girdi() : { gaz: 0 };
  const vd = M.vitesDevir(arac.ileriHiz);
  ses.guncelle({
    devir: faz === 'geriSayim' ? 900 + g.gaz * 4200 : vd.devir, gaz: g.gaz, hiz: Math.hypot(arac.vx, arac.vz),
    kayma: arac.kayma, arazi: 1 - yolPayi, calisiyor: sesAktif && faz !== 'menu'
  });
}

function dongu(ac) {
  if (ac && !calisiyor) { calisiyor = true; son = performance.now(); rafNo = requestAnimationFrame(kare); }
  else if (!ac && calisiyor) { calisiyor = false; cancelAnimationFrame(rafNo); }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { duraklat(); ses.duraklat(); dongu(false); }
  else { dongu(true); if (faz !== 'duraklat') ses.devam(); }
});

new ResizeObserver(() => sahne.boyutla(el.sahne.clientWidth, el.sahne.clientHeight)).observe(el.sahne);
sahne.boyutla(el.sahne.clientWidth, el.sahne.clientHeight);

// Test ve hata ayıklama için küçük bir pencere (oyun durumunu değiştirmez)
window.kapadokyaIzle = () => Object.assign({ faz, mod, fps: Math.round(olcum.fps), jsMs: Math.round(olcum.isMs * 100) / 100, oran: sahne.oran, km, zaman, kn: ralli ? ralli.sonraki : null, x: arac && arac.x, z: arac && arac.z, yon: arac && arac.yon, tohum: dunya && dunya.tohum, hiz: arac && arac.ileriHiz }, sahne.bilgi());

// ---------- Başlangıç ----------
el.tohum.value = String(gunlukTohum);
sesDugmesiYaz();
menuYaz();
sahne.gokAyarla(RALLI_GECE);
requestAnimationFrame(() => {
  dunyaHazirla(gunlukTohum);
  aracYerlestir(60);
  hepsiniKur();
  faz = 'menu';
  el.yukleniyor.classList.add('gizli');
  setTimeout(() => (el.yukleniyor.hidden = true), 600);
  dongu(true);
});
