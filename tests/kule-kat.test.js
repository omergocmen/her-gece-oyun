'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../games/kule-kat/mantik.js');

const yakin = (a, b, e) => assert.ok(Math.abs(a - b) <= (e || 1e-6), a + ' ≈ ' + b);

// Kayan katı verilen sapmayla (üst kat merkezine göre) bırakır.
function sapmayla(s, fark) {
  s.hareket.ofset = fark;
  return K.birak(s);
}

test('yeni oyun: taban katı, ilk kayan kat x ekseninde ve soldan gelir', () => {
  const s = K.yeni();
  assert.equal(s.kat, 0);
  assert.deepEqual(s.katlar[0], { cx: 0, cz: 0, w: 3, d: 3 });
  assert.equal(s.hareket.eksen, 'x');
  yakin(s.hareket.ofset, -K.MENZIL);
  assert.equal(s.hareket.yon, 1);
  assert.equal(s.hareket.w, 3);
});

test('ilerlet: uçlarda yansır, menzilden çıkmaz ve hız kat sayısıyla artar', () => {
  const s = K.yeni();
  for (let i = 0; i < 4000; i++) {
    K.ilerlet(s, 1 / 60);
    assert.ok(Math.abs(s.hareket.ofset) <= K.MENZIL + 1e-9);
  }
  const yavas = K.hiz(K.yeni());
  const t = K.yeni();
  t.kat = 50;
  assert.ok(K.hiz(t) > yavas);
  yakin(K.hizCarpani(10), 1.06);
  assert.equal(K.hizCarpani(10000), 1.9);
});

test('hız eğrisi yumuşak: ardışık katlar arasında %1\'den büyük sıçrama yok, 10 katta en çok %6', () => {
  for (let k = 0; k < 400; k++) {
    const oran = K.hizCarpani(k + 1) / K.hizCarpani(k);
    assert.ok(oran < 1.01, 'sıçrama ' + k + ': ' + oran);
  }
  for (let k = 0; k < 90; k += 10) assert.ok(K.hizCarpani(k + 10) / K.hizCarpani(k) <= 1.0601);
});

test('mükemmel hizada kat aynen oturur, seri artar, kesilen yok', () => {
  const s = K.yeni();
  const r = sapmayla(s, 0.05);
  assert.equal(r.tur, 'mukemmel');
  assert.equal(r.kesilen, null);
  assert.deepEqual(r.katman, { cx: 0, cz: 0, w: 3, d: 3 });
  assert.equal(s.kat, 1);
  assert.equal(s.seri, 1);
  assert.equal(s.hareket.eksen, 'z');
});

test('kesme: taşan kısım ayrılır, kalan katman örtüşme kadar (sağa kayık)', () => {
  const s = K.yeni();
  const r = sapmayla(s, 0.8);
  assert.equal(r.tur, 'kes');
  yakin(r.katman.w, 2.2);
  yakin(r.katman.cx, 0.4);
  yakin(r.kesilen.w, 0.8);
  yakin(r.kesilen.cx, 1.9);
  assert.equal(r.katman.d, 3);
  assert.equal(s.seri, 0);
  // kalan + kesilen = bırakılan katın tamamı
  yakin(r.katman.w + r.kesilen.w, 3);
});

test('kesme: sola kayık, z ekseni ve parçaların uç noktaları tutarlı', () => {
  const s = K.yeni();
  sapmayla(s, 0);
  const u = K.ust(s);
  const r = sapmayla(s, -0.6);
  assert.equal(s.katlar.length, 3);
  assert.equal(r.tur, 'kes');
  assert.equal(s.hareket.eksen, 'x');
  yakin(r.katman.d, u.d - 0.6);
  yakin(r.katman.cz, u.cz - 0.3);
  yakin(r.kesilen.cz, u.cz - u.d / 2 - 0.3);
  yakin(r.kesilen.d, 0.6);
  assert.equal(r.katman.w, u.w);
});

test('ıska: örtüşme yoksa oyun biter ve tüm kat düşer', () => {
  const s = K.yeni();
  const r = sapmayla(s, 3.0);
  assert.equal(r.tur, 'iska');
  assert.equal(s.bitti, true);
  assert.equal(s.kat, 0);
  assert.equal(r.katman, null);
  assert.equal(r.kesilen.w, 3);
  assert.equal(K.birak(s), null, 'bitmiş oyunda bırakma işlemez');
});

test('çok küçük örtüşme de kuleyi bitirir (AZ_ORTUSME)', () => {
  const s = K.yeni();
  const r = sapmayla(s, 3 - K.AZ_ORTUSME + 0.01);
  assert.equal(r.tur, 'iska');
});

test('seri: üçüncü mükemmelden sonra kule genişler ama başlangıç genişliğini aşmaz', () => {
  const s = K.yeni();
  sapmayla(s, 0.4); // 2.6 ... kesildi
  const genis = K.ust(s).w;
  assert.ok(genis < 3);
  for (let i = 0; i < 2; i++) assert.equal(sapmayla(s, 0).katman.w, genis, 'ilk iki mükemmel genişletmez');
  const r = sapmayla(s, 0);
  assert.equal(s.seri, 3);
  yakin(r.katman.w, genis + K.BUYUME);
  yakin(r.katman.d, K.ust(s).d);
  for (let i = 0; i < 30; i++) sapmayla(s, 0.02);
  assert.equal(K.ust(s).w, 3);
  assert.equal(K.ust(s).d, 3);
  assert.equal(s.enSeri, s.seri);
  assert.ok(s.mukemmel >= 33);
});

test('seri kesmede sıfırlanır, en uzun seri korunur', () => {
  const s = K.yeni();
  for (let i = 0; i < 4; i++) sapmayla(s, 0);
  assert.equal(s.seri, 4);
  sapmayla(s, 0.5);
  assert.equal(s.seri, 0);
  assert.equal(s.enSeri, 4);
});

test('kayanKat: üst katın merkezine göre konumlanır ve eksen dışı merkez korunur', () => {
  const s = K.yeni();
  sapmayla(s, 0.8);
  const u = K.ust(s);
  s.hareket.ofset = 1.1;
  const k = K.kayanKat(s);
  assert.equal(s.hareket.eksen, 'z');
  yakin(k.cx, u.cx);
  yakin(k.cz, u.cz + 1.1);
  assert.equal(k.w, u.w);
  assert.equal(k.d, u.d);
});

test('tema her 10 katta döner, gökyüzü karanlığı 0..1 ve katlar dört renkli döngüde', () => {
  assert.equal(K.tema(0), 'galata');
  assert.equal(K.tema(9), 'galata');
  assert.equal(K.tema(10), 'kiz');
  assert.equal(K.tema(20), 'suleymaniye');
  assert.equal(K.tema(30), 'galata');
  assert.equal(K.karanlik(0), 0);
  assert.equal(K.karanlik(1000), 1);
  assert.ok(K.karanlik(40) > K.karanlik(10));
  const renkler = [0, 1, 2, 3, 4].map(K.katRengi);
  assert.deepEqual(renkler.slice(0, 4), ['#e9dcc2', '#c9a46a', '#5a3b24', '#2f6fb0']);
  assert.equal(renkler[4], renkler[0]);
});

test('günlük: aynı gün herkese aynı parametre, farklı günlerde değişir', () => {
  const a = K.gunParam('2026-10-20'), b = K.gunParam('2026-10-20'), c = K.gunParam('2026-10-21');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (let g = 1; g <= 60; g++) {
    const p = K.gunParam('2026-11-' + String(g).padStart(2, '0'));
    assert.ok(p.en >= 2.6 && p.en <= 3.0, 'en ' + p.en);
    assert.ok(p.hiz >= 0.95 && p.hiz <= 1.12, 'hız ' + p.hiz);
    assert.ok(p.ilkYon === 1 || p.ilkYon === -1);
  }
  const s = K.yeni({ gunluk: true, tarih: '2026-10-20' });
  assert.equal(s.gunluk, true);
  assert.equal(s.tabanEn, a.en);
  assert.equal(s.katlar[0].w, a.en);
  assert.equal(K.gunAnahtari(new Date(2026, 9, 5)), '2026-10-05');
});

// Bot: kayan kat üst kat merkezine yaklaşınca bırakır; gürültü bırakma anındaki hata (birim).
function bot(s, gurultu, rnd, azamiKat) {
  const dt = 1 / 120;
  let sure = 0;
  while (!s.bitti && s.kat < azamiKat) {
    K.ilerlet(s, dt);
    sure += dt;
    const hedefHata = (rnd() - 0.5) * 2 * gurultu;
    // merkezi geçtiği an: işaret değişimi
    if (Math.abs(s.hareket.ofset - hedefHata) < K.hiz(s) * dt) K.birak(s);
    if (sure > azamiKat * 8) throw new Error('bot takıldı');
  }
  return s;
}

test('kusursuz bot yüzlerce kat çıkar, genişlik hep taban genişliği', () => {
  const s = bot(K.yeni(), 0.0, K.rng(1), 300);
  assert.equal(s.bitti, false);
  assert.equal(s.kat, 300);
  assert.equal(s.mukemmel, 300);
  assert.equal(K.ust(s).w, 3);
});

test('hatalı bot er geç kaybeder; hata arttıkça daha az kat çıkar', () => {
  const ort = (g) => {
    let t = 0;
    for (let i = 1; i <= 20; i++) t += bot(K.yeni(), g, K.rng(i * 7), 500).kat;
    return t / 20;
  };
  const kucuk = ort(0.12), buyuk = ort(0.9);
  assert.ok(kucuk > buyuk, kucuk + ' > ' + buyuk);
  assert.ok(buyuk < 40, 'büyük hatalı bot çok yükseldi: ' + buyuk);
});

test('oyun dosyaları: three.js ortak kopyadan, Kalite katmanı, harici adres yok, dosyalar games.json\'da', () => {
  const kok = path.join(__dirname, '..');
  const oyun = JSON.parse(fs.readFileSync(path.join(kok, 'games.json'), 'utf8')).find((o) => o.slug === 'kule-kat');
  assert.ok(oyun, 'games.json kaydı yok');
  assert.equal(oyun.boyut, '3D');
  assert.equal(oyun.gunluk, true);
  assert.ok(oyun.dosyalar.includes('assets/vendor/three/three.module.min.js'));
  assert.ok(oyun.dosyalar.includes('assets/js/kalite.js'));
  for (const d of oyun.dosyalar) assert.ok(fs.existsSync(path.join(kok, d)), 'eksik: ' + d);
  const js = fs.readFileSync(path.join(kok, 'games/kule-kat/oyun.js'), 'utf8');
  assert.match(js, /from 'three'/);
  assert.match(js, /Kalite\.kur\(/);
  assert.match(js, /Gunluk\.kaydet\('kule-kat'/);
  assert.match(js, /visibilitychange/);
  const html = fs.readFileSync(path.join(kok, 'games/kule-kat/index.html'), 'utf8');
  assert.match(html, /assets\/vendor\/three\/three\.module\.min\.js/);
  for (const dosya of ['oyun.js', 'mantik.js', 'stil.css']) {
    const m = fs.readFileSync(path.join(kok, 'games/kule-kat', dosya), 'utf8');
    assert.doesNotMatch(m, /https?:\/\//, dosya + ' harici adres içeriyor');
  }
  const toplam = oyun.dosyalar.filter((d) => d.startsWith('games/kule-kat/') && !d.endsWith('/'))
    .reduce((t, d) => t + fs.statSync(path.join(kok, d)).size, 0);
  assert.ok(toplam < 1.5 * 1024 * 1024, 'oyunun kendi dosyaları 1,5 MB üstünde: ' + toplam);
});
