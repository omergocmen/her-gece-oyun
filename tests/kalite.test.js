'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const oyunlar = JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8'));
const ucBoyutlu = oyunlar.filter((o) => o.boyut === '3D');

// Depo'nun yerine konan sahte: kalite.js tercihi Depo üzerinden okur ve yazar.
const sahteDepo = { veri: {}, oku(a, v) { return a in this.veri ? this.veri[a] : v; }, yaz(a, d) { this.veri[a] = d; } };
globalThis.Depo = sahteDepo;
globalThis.devicePixelRatio = 3;
const Kalite = require('../assets/js/kalite.js');

function sahteRenderer() {
  return { oranlar: [], setPixelRatio(o) { this.oranlar.push(o); } };
}
// Sabit kare süresiyle ms kadar animasyon karesi besler.
function besle(kalite, bas, sure, kareMs) {
  let t = bas;
  kalite.kare(t);
  for (; t < bas + sure; ) { t += kareMs; kalite.kare(t); }
  return t;
}

test('azamiOran ekranın, oyunun ve düşük grafik tercihinin en küçüğüdür', () => {
  assert.equal(Kalite.azamiOran(3, 1.75, false), 1.75);
  assert.equal(Kalite.azamiOran(1, 2, false), 1);
  assert.equal(Kalite.azamiOran(3, 2, true), Kalite.DUSUK_AZAMI);
  assert.equal(Kalite.azamiOran(0.5, 2, true), 0.5);
});

test('sonrakiOran yavaş karede oranı düşürür, tabanın altına indirmez', () => {
  const d = { oran: 1.5, azami: 2, dusurme: 0 };
  assert.equal(Kalite.sonrakiOran(d, 40, 5000), 1.35);
  assert.equal(Kalite.sonrakiOran({ oran: 0.7, azami: 2, dusurme: 0 }, 40, 5000), Kalite.TABAN);
  assert.equal(Kalite.sonrakiOran({ oran: Kalite.TABAN, azami: 2, dusurme: 0 }, 80, 5000), Kalite.TABAN);
  // Tavan tabandan küçükse (düşük grafik, 1x ekran) oran tavanın altına zorlanmaz.
  assert.equal(Kalite.sonrakiOran({ oran: 0.5, azami: 0.5, dusurme: 0 }, 80, 5000), 0.5);
});

test('sonrakiOran yalnızca düşüşten sonra yeterince beklenince ve hızlıysa yükseltir', () => {
  const hizli = Kalite.HIZLI_MS - 2;
  assert.equal(Kalite.sonrakiOran({ oran: 1, azami: 2, dusurme: 1000 }, hizli, 1000 + Kalite.TOPARLANMA - 1), 1);
  assert.equal(Kalite.sonrakiOran({ oran: 1, azami: 2, dusurme: 1000 }, hizli, 1000 + Kalite.TOPARLANMA + 1), 1.1);
  assert.equal(Kalite.sonrakiOran({ oran: 2, azami: 2, dusurme: 0 }, hizli, 99999), 2, 'tavanı aşmaz');
  assert.equal(Kalite.sonrakiOran({ oran: 1, azami: 2, dusurme: 0 }, 18, 99999), 1, 'orta bölgede değişmez');
});

test('kur: yavaş kareler oranı düşürür ve oyunun yeniden boyutlandırmasını çağırır', () => {
  sahteDepo.veri = {};
  const r = sahteRenderer();
  let boyutlandi = 0;
  const k = Kalite.kur(r, { azami: 2, boyutla: () => { boyutlandi++; } });
  assert.equal(k.oran, 1.5);
  assert.equal(k.azami, 2);
  besle(k, 1000, 2500, 40);
  assert.equal(k.oran, 1.35);
  assert.equal(r.oranlar[r.oranlar.length - 1], 1.35);
  assert.equal(boyutlandi, 1);
  assert.ok(k.ortalamaMs > 30);
});

test('kur: hızlı cihazda 2 sn sonra üst sınıra çıkar', () => {
  sahteDepo.veri = {};
  const k = Kalite.kur(sahteRenderer(), { azami: 2, boyutla() {} });
  // Sayfa açıldıktan 20 sn sonra: son düşüş yok, yükselme serbest.
  const t = besle(k, 20000, 2100, 8);
  assert.equal(k.oran, 1.6);
  besle(k, t + 100, 10000, 8);
  assert.equal(k.oran, 2);
});

test('kur: arka plan ya da duraklatmadan gelen uzun kareler ölçüme katılmaz', () => {
  sahteDepo.veri = {};
  const k = Kalite.kur(sahteRenderer(), { azami: 2, boyutla() {} });
  let t = 1000;
  k.kare(t);
  for (let i = 0; i < 40; i++) { t += 5000; k.kare(t); }
  assert.equal(k.oran, 1.5, 'uzun kareler oranı düşürmemeli');
});

test('düşük grafik tercihi kalıcıdır, tavanı indirir ve kapanınca geri verir', () => {
  sahteDepo.veri = {};
  const r = sahteRenderer();
  const k = Kalite.kur(r, { azami: 2, boyutla() {} });
  assert.equal(k.dusuk, false);
  k.dusukAyarla(true);
  assert.equal(sahteDepo.veri['kalite-dusuk'], true);
  assert.equal(k.azami, Kalite.DUSUK_AZAMI);
  assert.equal(k.oran, Kalite.DUSUK_AZAMI);
  assert.equal(Kalite.dusukMu(), true);
  // Başka bir 3D oyun aynı tercihle açılır.
  const baska = Kalite.kur(sahteRenderer(), { azami: 1.75, boyutla() {} });
  assert.equal(baska.dusuk, true);
  assert.equal(baska.oran, Kalite.DUSUK_AZAMI);
  assert.equal(Kalite.rendererSecenek({ alpha: true }).antialias, false);
  assert.equal(Kalite.rendererSecenek({ alpha: true }).alpha, true);
  k.dusukAyarla(false);
  assert.equal(sahteDepo.veri['kalite-dusuk'], false);
  assert.equal(k.azami, 2);
  globalThis.devicePixelRatio = 2;
  assert.equal(Kalite.rendererSecenek().antialias, true, 'tam kalitede orta yoğunlukta kenar yumuşatma açık');
  globalThis.devicePixelRatio = 3;
  assert.equal(Kalite.rendererSecenek().antialias, false, 'çok yoğun ekranda zaten kapalı');
});

test('düşük grafik açıkken oran tavanı hiçbir zaman aşmaz', () => {
  sahteDepo.veri = { 'kalite-dusuk': true };
  const k = Kalite.kur(sahteRenderer(), { azami: 2, boyutla() {} });
  besle(k, 1000, 60000, 6);
  assert.equal(k.oran, Kalite.DUSUK_AZAMI);
});

test('depolama yokken kalite.js hata vermez', () => {
  const eski = globalThis.Depo;
  delete globalThis.Depo;
  try {
    assert.equal(Kalite.dusukMu(), false);
    Kalite.dusukYaz(true);
    const k = Kalite.kur(sahteRenderer(), { azami: 2, boyutla() {} });
    assert.equal(k.dusuk, false);
  } finally { globalThis.Depo = eski; }
});

test('tüm 3D oyunlar ortak kalite yardımcısını kullanır, oyun başına kopya kalmaz', () => {
  assert.ok(ucBoyutlu.length >= 8);
  for (const oyun of ucBoyutlu) {
    const dir = path.join(KOK, 'games', oyun.slug);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('assets/js/kalite.js'), `${oyun.slug}: index.html kalite.js yüklemiyor`);
    assert.ok(html.indexOf('assets/js/depo.js') < html.indexOf('assets/js/kalite.js'), `${oyun.slug}: kalite.js depo.js'den sonra yüklenmeli`);
    assert.ok(html.indexOf('assets/js/kalite.js') < html.indexOf('type="module"'), `${oyun.slug}: kalite.js oyun modülünden önce yüklenmeli`);
    assert.ok(oyun.dosyalar.includes('assets/js/kalite.js'), `${oyun.slug}: games.json dosyalar listesinde kalite.js yok (çevrimdışı)`);
    const kod = oyun.dosyalar.filter((d) => d.startsWith(`games/${oyun.slug}/`) && d.endsWith('.js'))
      .map((d) => fs.readFileSync(path.join(KOK, d), 'utf8')).join('\n');
    assert.ok(/Kalite\.kur\(/.test(kod), `${oyun.slug}: Kalite.kur kullanmıyor`);
    assert.ok(/Kalite\.dugmeEkle\(|kalite\.dusukAyarla\(/.test(kod), `${oyun.slug}: Düşük grafik düğmesi yok`);
    assert.ok(/\.kare\(\s*(simdi|zaman)\s*\)/.test(kod), `${oyun.slug}: kalite.kare her karede çağrılmıyor`);
    assert.ok(!/setPixelRatio\(/.test(kod), `${oyun.slug}: kendi setPixelRatio kodu kalmış`);
    assert.ok(!/kaliteAyarla|pikselOrani/.test(kod), `${oyun.slug}: eski kopya kalite kodu kalmış`);
    assert.ok(!/antialias:/.test(kod), `${oyun.slug}: antialias kararı Kalite.rendererSecenek'te verilir`);
  }
});

test('düşük grafik düğmesi referans düğmenin sınıfını alır ve durumu yazıyla da bildirir', () => {
  sahteDepo.veri = {};
  const eleman = (etiket) => ({
    etiket, ozellik: {}, dinleyici: {}, className: '', id: '', title: '', innerHTML: '', parentNode: null, nextSibling: null,
    setAttribute(a, d) { this.ozellik[a] = d; }, getAttribute(a) { return this.ozellik[a] || null; },
    addEventListener(t, f) { this.dinleyici[t] = f; }, querySelector() { return { getAttribute: () => '20' }; }
  });
  const ata = { eklenen: null, insertBefore(el) { this.eklenen = el; } };
  const ref = eleman('button'); ref.className = 'ikon-buton'; ref.parentNode = ata;
  globalThis.document = { createElement: (e) => eleman(e) };
  // kalite.js belge nesnesini kendi kapsamından (kok) okur; Node'da kok modül nesnesidir.
  const vm = require('node:vm');
  const kod = fs.readFileSync(path.join(KOK, 'assets/js/kalite.js'), 'utf8');
  const kok = { document: globalThis.document, Depo: sahteDepo, devicePixelRatio: 3 };
  vm.runInNewContext(kod, kok);
  const k = kok.Kalite.kur(sahteRenderer(), { azami: 2, boyutla() {} });
  const b = kok.Kalite.dugmeEkle(ref, k);
  assert.equal(b, ata.eklenen);
  assert.equal(b.className, 'ikon-buton');
  assert.equal(b.getAttribute('aria-pressed'), 'false');
  assert.match(b.getAttribute('aria-label'), /kapalı/);
  b.dinleyici.click();
  assert.equal(b.getAttribute('aria-pressed'), 'true');
  assert.match(b.getAttribute('aria-label'), /açık/);
  assert.equal(k.dusuk, true);
  delete globalThis.document;
});
