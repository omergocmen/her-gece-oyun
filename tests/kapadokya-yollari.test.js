'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../games/kapadokya-yollari/mantik.js');

const KLASOR = path.join(__dirname, '..', 'games', 'kapadokya-yollari');

test('arazi ve yol deterministik: aynı tohum aynı yol, farklı tohum farklı yol', () => {
  const a = new M.Dunya(4242), b = new M.Dunya(4242), c = new M.Dunya(4243);
  for (const i of [0, 37, 500, 1999]) assert.deepEqual(a.yol.ornek(i), b.yol.ornek(i));
  for (const [ix, iz] of [[0, 0], [-7, 40], [25, 310]]) assert.equal(a.kafesY(ix, iz), b.kafesY(ix, iz));
  assert.deepEqual(a.parcaNesneleri(2, 5), b.parcaNesneleri(2, 5));
  assert.notDeepEqual(a.yol.ornek(800), c.yol.ornek(800));
  assert.notEqual(a.kafesY(30, 30), c.kafesY(30, 30));
});

test('silinen yol blokları aynen yeniden üretilir, bellekte sınırlı blok kalır', () => {
  const d = new M.Dunya(77);
  const once = [10, 300, 1500].map((i) => d.yol.ornek(i));
  // 24 km'lik (10 dakikalık) sürüş: her adımda yakın arama ve budama
  let enCok = 0;
  for (let s = 0; s < 24000; s += 40) {
    const o = d.yol.noktaS(s);
    d.yol.yakin(o.x + 5, o.z);
    d.zemin(o.x + 20, o.z);
    d.yol.buda(Math.floor(s / (M.BLOK * M.ADIM)), 6);
    enCok = Math.max(enCok, d.yol.bloklar.size);
  }
  assert.ok(enCok <= 14, `bellekte ${enCok} blok kaldı`);
  assert.ok(d._kafes.size <= 40001, 'yükseklik önbelleği sınırlı');
  assert.deepEqual([10, 300, 1500].map((i) => d.yol.ornek(i)), once);
});

test('yol hep kuzeye ilerler, kendini kesmez ve virajları sürülebilir', () => {
  for (const tohum of [1, 2, 3, 99, 123456]) {
    const yol = new M.Yol(tohum);
    let enKucukYaricap = Infinity;
    for (let i = 1; i < 2500; i++) {
      const a = yol.ornek(i - 1), b = yol.ornek(i);
      assert.ok(b.z > a.z, 'z her örnekte artmalı');
      assert.ok(Math.abs(b.yon) <= M.MAKS_YON + 1e-9);
      assert.ok(Math.abs(b.y - a.y) <= 0.3, 'eğim %7.5\'i geçmemeli');
      const k = Math.abs(b.yon - a.yon) / M.ADIM;
      if (k > 0) enKucukYaricap = Math.min(enKucukYaricap, 1 / k);
    }
    assert.ok(enKucukYaricap > 40, `tohum ${tohum}: viraj yarıçapı ${enKucukYaricap}`);
  }
});

test('yola en yakın nokta: yanal uzaklık ve yön (sağ pozitif)', () => {
  const yol = new M.Yol(5);
  const o = yol.noktaS(1000);
  const sagX = -Math.cos(o.yon), sagZ = Math.sin(o.yon);
  const sag = yol.yakin(o.x + sagX * 3, o.z + sagZ * 3);
  assert.ok(Math.abs(sag.s - 1000) < 0.5);
  assert.ok(Math.abs(sag.u - 3) < 0.05);
  assert.ok(Math.abs(sag.d - 3) < 0.05);
  const sol = yol.yakin(o.x - sagX * 6, o.z - sagZ * 6);
  assert.ok(Math.abs(sol.u + 6) < 0.05);
  assert.equal(yol.yakin(o.x + 500, o.z, 40).d, Infinity);
});

test('zemin: asfaltta yol yüksekliği, arazide örgüyle aynı üçgen ara değeri', () => {
  const d = new M.Dunya(31);
  const o = d.yol.noktaS(700);
  const z = d.zemin(o.x, o.z);
  assert.equal(z.yolPayi, 1);
  assert.ok(Math.abs(z.y - o.y) < 1e-6);
  // Kafes köşelerinde araziY, kafesY ile aynıdır
  for (const [ix, iz] of [[3, 9], [-20, 50], [40, 120]]) {
    assert.ok(Math.abs(d.araziY(ix * M.KAFES, iz * M.KAFES) - d.kafesY(ix, iz)) < 1e-9);
  }
  // Yolun 10 m yanında arazi yol seviyesine düzlenmiştir (asfaltın hemen altında)
  const yan = d.zemin(o.x - Math.cos(o.yon) * 10, o.z + Math.sin(o.yon) * 10);
  assert.equal(yan.yolPayi, 0);
  assert.ok(Math.abs(yan.y - (o.y - M.YOL_ALTI)) < 0.6);
});

test('parça yükleme listesi sınırlıdır ve yakından uzağa sıralanır', () => {
  const liste = M.gerekliParcalar(1234, 5678, 340);
  assert.ok(liste.length > 30 && liste.length < 70, `${liste.length} parça`);
  for (let i = 1; i < liste.length; i++) assert.ok(liste[i].mesafe >= liste[i - 1].mesafe);
  assert.equal(liste[0].mesafe, 0);
  assert.equal(new Set(liste.map((p) => p.anahtar)).size, liste.length);
});

test('parça nesneleri yolun üstüne konmaz', () => {
  const d = new M.Dunya(8);
  let sayi = 0;
  for (let cx = -3; cx <= 3; cx++) for (let cz = 0; cz < 8; cz++) {
    for (const n of d.parcaNesneleri(cx, cz)) {
      sayi++;
      assert.ok(d.yol.yakin(n.x, n.z, 60).d > M.YOL_YARI + M.OMUZ + n.r, `${n.tur} yolun üstünde`);
    }
  }
  assert.ok(sayi > 20);
});

function sur(adimlar, yolPayi) {
  const a = M.yeniArac(0, 0, 0);
  for (const [g, sn] of adimlar) for (let i = 0; i < sn * 120; i++) M.aracAdim(a, g, 1 / 120, yolPayi == null ? 1 : yolPayi);
  return a;
}

test('araç fiziği: hızlanır, azami hızı aşmaz, arazide yavaştır, fren durdurur ve geri gider', () => {
  const hizli = sur([[{ gaz: 1 }, 3]]);
  assert.ok(hizli.ileriHiz > 15 && hizli.ileriHiz < 30);
  const son = sur([[{ gaz: 1 }, 60]]);
  assert.ok(son.ileriHiz < M.ARAC.azamiHiz && son.ileriHiz > 32);
  const arazi = sur([[{ gaz: 1 }, 60]], 0);
  assert.ok(arazi.ileriHiz < son.ileriHiz * 0.6);
  const fren = sur([[{ gaz: 1 }, 5], [{ fren: 1 }, 1.5]]);
  assert.ok(fren.ileriHiz < 1);
  const geri = sur([[{ fren: 1 }, 3]]);
  assert.ok(geri.ileriHiz < -4 && geri.ileriHiz > -10);
  const yokus = M.yeniArac(0, 0, 0), inis = M.yeniArac(0, 0, 0);
  for (let i = 0; i < 600; i++) { M.aracAdim(yokus, { gaz: 1 }, 1 / 120, 1, 0.25); M.aracAdim(inis, { gaz: 1 }, 1 / 120, 1, -0.1); }
  const duz = sur([[{ gaz: 1 }, 5]]);
  assert.ok(yokus.ileriHiz < duz.ileriHiz * 0.9 && inis.ileriHiz > duz.ileriHiz, 'yokuş yavaşlatır, iniş hızlandırır');
  const bos = sur([[{ gaz: 1 }, 2], [{}, 40]]);
  assert.ok(Math.abs(bos.ileriHiz) < 0.5, 'gaz bırakınca araç yavaşça durur');
});

test('araç fiziği: sağa direksiyon sağa döndürür, el freni kaydırır, sonuç deterministik', () => {
  const sag = sur([[{ gaz: 1 }, 2], [{ gaz: 1, yon: 1 }, 1]]);
  assert.ok(sag.yon < -0.3, 'sağa dönüş yönü azaltır');
  assert.ok(sag.x < 0, 'sağ, yolun -x tarafıdır (u > 0)');
  const sol = sur([[{ gaz: 1 }, 2], [{ gaz: 1, yon: -1 }, 1]]);
  assert.ok(Math.abs(sol.yon + sag.yon) < 1e-9);
  const normal = sur([[{ gaz: 1 }, 6], [{ gaz: 1, yon: 1 }, 0.6]]);
  const drift = sur([[{ gaz: 1 }, 6], [{ gaz: 1, yon: 1, elFreni: true }, 0.6]]);
  assert.ok(drift.kayma > normal.kayma + 3, 'el freni yanal kaymayı artırır');
  assert.deepEqual(sur([[{ gaz: 1, yon: 0.4 }, 4]]), sur([[{ gaz: 1, yon: 0.4 }, 4]]));
});

test('çarpışma aracı engelin dışına iter ve hızı söndürür', () => {
  const a = M.yeniArac(0, 0, 0);
  a.vz = 20;
  a.z = 1.5;
  const siddet = M.carpismaCoz(a, [{ x: 0, z: 3, r: 1 }], 1.3);
  assert.ok(siddet > 10);
  assert.ok(Math.hypot(a.x, a.z - 3) >= 2.3 - 1e-9);
  assert.ok(a.vz < 0, 'araç geri seker');
  assert.equal(M.carpismaCoz(a, [{ x: 50, z: 50, r: 2 }]), 0);
});

test('vites ve devir: devir sınırlar içinde, vites atınca düşer', () => {
  let oncekiVites = 1;
  for (let v = 0; v <= 45; v += 0.5) {
    const { vites, devir } = M.vitesDevir(v);
    assert.ok(devir >= 900 && devir <= 6800);
    assert.ok(vites >= oncekiVites);
    oncekiVites = vites;
  }
  assert.ok(M.vitesDevir(10.9).devir > M.vitesDevir(11.1).devir);
});

test('ralli: 8 kontrol noktası, geçiş anı adım içinde ara değerle bulunur', () => {
  const p = M.ralliParkuru(5);
  assert.equal(p.kn.length, M.KN_SAYISI);
  assert.equal(p.bitis, p.kn[7]);
  const d = M.ralliDurumu();
  // 1. kapı s = 360; araç bir adımda 350'den 370'e geçiyor, kapının ortasından
  assert.equal(M.ralliKontrol(d, p, { s: 350, u: 0 }, { s: 370, u: 0 }, 10, 0.5), 0);
  assert.ok(Math.abs(d.araSureler[0] - 10.25) < 1e-9);
  // Kapının dışından (u = 12 m) geçmek sayılmaz, sıradaki kapı değişmez
  assert.equal(M.ralliKontrol(d, p, { s: 650, u: 12 }, { s: 670, u: 12 }, 20, 0.1), -1);
  assert.equal(d.sonraki, 1);
  // Geri dönüp içeriden geçince sayılır
  assert.equal(M.ralliKontrol(d, p, { s: 655, u: 2 }, { s: 662, u: 2 }, 30, 0.1), 1);
  // Sıradaki kapıyı atlayıp ilerideki kapıdan geçmek sayılmaz
  assert.equal(M.ralliKontrol(d, p, { s: 1250, u: 0 }, { s: 1270, u: 0 }, 40, 0.1), -1);
  for (let i = 2; i < 8; i++) M.ralliKontrol(d, p, { s: p.kn[i] - 1, u: 0 }, { s: p.kn[i] + 1, u: 0 }, 40 + i, 1);
  assert.equal(d.bitti, true);
  assert.equal(d.araSureler.length, 8);
  assert.ok(Math.abs(d.araSureler[7] - 47.5) < 1e-9);
  assert.equal(M.ralliKontrol(d, p, { s: 0, u: 0 }, { s: 5000, u: 0 }, 99, 1), -1);
});

test('hayalet kaydı yenilemede korunur: JSON gidiş-dönüşünden sonra aynı konumlar', () => {
  const h = M.hayaletYeni();
  for (let i = 0; i <= 50; i++) M.hayaletEkle(h, i * 2.5, 100 + i, Math.PI - 0.05 + i * 0.0008);
  // Açı ±π sınırını geçerken kısa yoldan ara değer alınır
  M.hayaletEkle(h, 130, 151, -Math.PI + 0.02);
  const kayit = M.rekorIsle({}, '42', 80.5, [10, 20, 30, 40, 50, 60, 70, 80.5], h, 1000);
  const yeniden = JSON.parse(JSON.stringify(kayit.kayitlar));
  const g = yeniden['42'].hayalet;
  assert.equal(M.hayaletUzunluk(g), 52);
  const k = M.hayaletKonum(g, 1.05);
  assert.ok(Math.abs(k.x - 26.25) < 0.06 && Math.abs(k.z - 110.5) < 0.06);
  const sinir = M.hayaletKonum(g, 5.05);
  assert.ok(Math.abs(Math.abs(sinir.yon) - Math.PI) < 0.05, 'açı sarması');
  assert.equal(M.hayaletKonum(g, 999).bitti, true);
  assert.deepEqual(yeniden['42'].araSureler, [10, 20, 30, 40, 50, 60, 70, 80.5]);
});

test('rekor: yalnızca daha iyi süre yazılır, en yeni 8 parkur saklanır', () => {
  const h = M.hayaletYeni();
  let r = M.rekorIsle({}, '1', 90, [90], h, 1);
  assert.equal(r.rekor, true);
  assert.equal(r.onceki, null);
  r = M.rekorIsle(r.kayitlar, '1', 95, [95], { aralik: 0.1, v: [1, 2, 3] }, 2);
  assert.equal(r.rekor, false);
  assert.equal(r.onceki, 90);
  assert.equal(r.kayitlar['1'].sure, 90);
  assert.equal(r.kayitlar['1'].hayalet, h);
  r = M.rekorIsle(r.kayitlar, '1', 85, [85], h, 3);
  assert.equal(r.rekor, true);
  assert.equal(r.kayitlar['1'].sure, 85);
  let k = r.kayitlar;
  for (let i = 2; i <= 12; i++) k = M.rekorIsle(k, String(i), 100, [100], h, 10 + i).kayitlar;
  assert.equal(Object.keys(k).length, M.KAYIT_SINIRI);
  assert.ok(k['12'] && !k['1']);
});

test('fark ve süre yazımı: + yavaş, − (eksi işareti) hızlı', () => {
  assert.equal(M.farkYaz(0.84), '+0.8');
  assert.equal(M.farkYaz(-1.23), '−1.2');
  assert.equal(M.farkYaz(0.02), '±0.0');
  assert.equal(M.hayaletFarki([10, 21], [11, 20], 1), 1);
  assert.equal(M.hayaletFarki([10], null, 0), null);
  assert.equal(M.sureYaz(83.456), '1:23.45');
  assert.equal(M.sureYaz(5), '0:05.00');
  assert.equal(M.sureYaz(null), '–');
});

test('günlük tohum: aynı gün aynı parkur, ertesi gün farklı', () => {
  const sabah = new Date(2026, 10, 3, 0, 5), gece = new Date(2026, 10, 3, 23, 55), ertesi = new Date(2026, 10, 4, 0, 1);
  assert.equal(M.gunlukTohum(sabah), M.gunlukTohum(gece));
  assert.notEqual(M.gunlukTohum(gece), M.gunlukTohum(ertesi));
  assert.equal(M.bulmacaNo(new Date(2026, 9, 20, 12)), 1);
  assert.ok(M.gunlukTohum(sabah) >= 0 && M.gunlukTohum(sabah) < 1000000);
});

test('serbest sürüş saati alacakaranlıkla gece arasında kalır, gündüz yok', () => {
  for (let t = 0; t < M.DONGU * 2; t += 3.7) {
    const g = M.gokDurumu(t);
    assert.ok(g.gece >= 0 && g.gece <= 1);
    const [ss, dd] = g.saat.split(':').map(Number);
    const dk = ss * 60 + dd;
    assert.ok(dk >= 19 * 60 || dk <= 6 * 60, `${g.saat} gündüz`);
  }
  assert.equal(M.gokDurumu(0).gece, 0);
  assert.equal(M.gokDurumu(M.DONGU / 2).gece, 1);
});

test('oyun dosyaları yalnızca DESIGN.md paletindeki renkleri kullanır', () => {
  const palet = new Set(['110f0d', '1b1815', '26211c', '3b332b', 'f3ead8', 'b4a78f', 'ffb23f', '1d1307', 'b8741a', 'ffc266',
    'ff6a48', '1a0703', '368549', 'ffffff', '9db4ff', '2e2822', 'a89c88', '2f6fb0', '2aa198', '5a3b24', 'e9dcc2', '2c5a3a', 'c9a46a']);
  for (const dosya of ['sahne.js', 'stil.css', 'kapak.svg', 'oyun.js']) {
    const icerik = fs.readFileSync(path.join(KLASOR, dosya), 'utf8');
    const renkler = [...icerik.matchAll(/(?:#|0x)([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase());
    for (const r of renkler) assert.ok(palet.has(r), `${dosya}: #${r} paletten değil`);
    for (const m of icerik.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
      const hex = [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
      assert.ok(palet.has(hex), `${dosya}: rgb(${m[1]},${m[2]},${m[3]}) paletten değil`);
    }
  }
});

test('three.js tek yerel kopyadan yüklenir ve önbellek listesindedir', () => {
  const sahne = fs.readFileSync(path.join(KLASOR, 'sahne.js'), 'utf8');
  assert.match(sahne, /from '\.\.\/\.\.\/assets\/vendor\/three\/three\.module\.min\.js'/);
  const oyun = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'games.json'), 'utf8')).find((o) => o.slug === 'kapadokya-yollari');
  assert.ok(oyun.dosyalar.includes('assets/vendor/three/three.module.min.js'));
  for (const ad of fs.readdirSync(KLASOR)) assert.ok(oyun.dosyalar.includes(`games/kapadokya-yollari/${ad === 'index.html' ? '' : ad}`), `${ad} önbellekte değil`);
  // Toplam boyut ~1.5 MB bütçesinde
  const toplam = oyun.dosyalar.reduce((t, d) => t + fs.statSync(path.join(__dirname, '..', d.endsWith('/') ? d + 'index.html' : d)).size, 0);
  assert.ok(toplam < 1.5 * 1024 * 1024, `${toplam} bayt`);
});
