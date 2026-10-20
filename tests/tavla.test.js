'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/tavla/mantik.js');

// Konum kurucu: her oyuncu için { hane: taş } ve isteğe bağlı bar; kalan taşlar toplanmış sayılır.
function konum(ben, rakip) {
  return [ben, rakip].map((h) => {
    const d = new Array(26).fill(0);
    for (const [hane, adet] of Object.entries(h)) d[hane === 'bar' ? 25 : Number(hane)] = adet;
    d[0] = 15 - d.slice(1).reduce((a, b) => a + b, 0);
    return d;
  });
}

// Bir hamlenin oyuncu 0 için adım listesi, karşılaştırması kolay biçimde: "13/7 8/7".
const yaz = (o) => o.adimlar.map((a) => `${a.den}/${a.hedef}`).join(' ');
const hamleler = (t, zarlar) => M.oyunlar(t, 0, zarlar).map(yaz).sort();

test('başlangıç dizilişi: 15 taş, 167 pip, her iki taraf aynı', () => {
  const t = M.baslangic();
  for (const d of t) {
    assert.equal(d.reduce((a, b) => a + b, 0), 15);
    assert.equal(M.pip(d), 167);
  }
  assert.equal(M.oyunSonucu(t), null);
  // Açılışta 6-5 ile 15 farklı sonuç vardır (ör. 24/13 "kaçış" hamlesi bunlardan biri).
  assert.ok(hamleler(t, [6, 5]).includes('24/18 18/13'));
});

test('kırık taş önce girer; giriş kapalıysa başka taş oynanamaz', () => {
  // Bende bar'da bir taş; rakibin evinde (benim 19-24 hanelerim) 6'ya karşılık gelen hane kapı.
  const t = konum({ bar: 1, 13: 5, 6: 5, 8: 4 }, { 6: 2, 5: 2, 1: 3 });
  for (const o of M.oyunlar(t, 0, [6, 3])) assert.equal(o.adimlar[0].den, 25);
  // Rakibin 6. hanesi = benim 19. hanem; 6 ile giriş kapalı (25 − 6 = 19), 3 ile 22'ye girilir.
  assert.deepEqual(hamleler(t, [6, 3]).map((h) => h.split(' ')[0]).filter((v, i, a) => a.indexOf(v) === i), ['25/22']);
  // 6-6 atınca giriş yok: hamle de yok.
  assert.deepEqual(M.oyunlar(t, 0, [6, 6]), []);
  // İki kırık taş: ikisi de girmeden diğer taşlar oynamaz.
  const iki = konum({ bar: 2, 13: 5, 6: 5 }, { 6: 2 });
  for (const o of M.oyunlar(iki, 0, [4, 2])) assert.deepEqual(o.adimlar.map((a) => a.den), [25, 25]);
  // Tek kırık taş girip bir taş girememişse ikinci zar kullanılamaz.
  const yarim = konum({ bar: 2, 13: 5 }, { 3: 2 });
  assert.deepEqual(hamleler(yarim, [3, 1]), ['25/24']);
});

test('kapı kurallı haneye konulmaz, tek taş kırılır', () => {
  const t = konum({ 13: 1, 6: 14 }, { 17: 2, 15: 1 });
  // 13'ten 4 → 9 = rakibin 16'sı (boş), 13'ten 5 → 8 = rakibin 17'si (kapı), 13'ten 3 → 10 = rakibin 15'i (tek taş).
  assert.equal(M.adim(t, 0, 13, 5), null);
  const kir = M.adim(t, 0, 13, 3);
  assert.equal(kir.vurus, true);
  assert.equal(kir.t[1][15], 0);
  assert.equal(kir.t[1][25], 1);
});

test('zorunlu hamle: iki zar da kullanılabiliyorsa ikisi birden oynanır', () => {
  // Tek taşım 10'da, diğerleri toplanmış. 4 önce oynanırsa 6'ya varır ve 2 ile 4'e gidilebilir;
  // 2 önce oynanırsa 8'e varılır ve 4 ile 4'e gidilir. Rakip 25−5=20'de (benim 5) kapı tutuyor.
  // Asıl sınama: tek zar oynayıp kalanı boşa harcamak geçerli değil.
  const t = konum({ 10: 1, 3: 14 }, { 20: 2, 18: 2 });
  for (const o of M.oyunlar(t, 0, [4, 2])) assert.equal(o.adimlar.length, 2);
  // Tuzak: 11'deki taşı 5 ile 6'ya oynamak tek başına geçerli, ama sonra 6 oynanamaz
  // (10 → 4 rakibin 21'indeki kapıya çarpar, 10'daki taş dışarıda olduğu için toplama da yok).
  // İki zarı birden kullanan tek hamle 11/5 10/5'tir; arayüz 11/6'yı hiç sunmaz.
  const s = konum({ 11: 1, 10: 1 }, { 13: 2, 21: 2, 24: 2 });
  assert.ok(M.adim(s, 0, 11, 5), '11/6 tek başına geçerli');
  assert.deepEqual(hamleler(s, [6, 5]), ['11/5 10/5']);
  const adimlar = M.sonrakiAdimlar(s, 0, [6, 5], []).map((a) => `${a.den}/${a.hedef}`).sort();
  assert.deepEqual(adimlar, ['10/5', '11/5']);
});

test('yalnızca bir zar oynanabiliyorsa büyük zar oynanır; büyük oynanamıyorsa küçük', () => {
  // 24'teki tek taş: 6 ile 18, 5 ile 19 gidebilir; ama hangisi oynansa diğer zar kapıya çarpar.
  // Rakip kapıları: benim 13 (rakip 12) ve 13'ü oluşturan zincir: 18−5=13, 19−6=13.
  const t = konum({ 24: 1 }, { 12: 2 });
  assert.deepEqual(hamleler(t, [6, 5]), ['24/18']);
  // Büyük zar kapalıysa küçük zar oynanır.
  const k = konum({ 24: 1 }, { 12: 2, 7: 2 });
  assert.deepEqual(hamleler(k, [6, 1]).length > 0, true);
  const kapali = konum({ 24: 1 }, { 7: 2, 12: 2, 18: 2 });
  // 6 → 18 (rakip 7) kapalı, 1 → 23 (rakip 2) açık, sonra 6 ile 17 (rakip 8) açık: ikisi de oynanır.
  assert.deepEqual(hamleler(kapali, [6, 1]), ['24/23 23/17']);
  const sadeceKucuk = konum({ 24: 1 }, { 7: 2, 8: 2 });
  // 6 kapalı (rakip 7), 1 ile 23'e gidilir, sonra 6 ile 17 (rakip 8) kapalı: yalnız küçük zar.
  assert.deepEqual(hamleler(sadeceKucuk, [6, 1]), ['24/23']);
});

test('çift zar dört kez oynanır; tıkanırsa oynanabildiği kadar', () => {
  const t = M.baslangic();
  for (const o of M.oyunlar(t, 0, [3, 3])) assert.equal(o.adimlar.length, 4);
  // 24'te iki taş, rakip 25−12=13'te (benim 12) kapı: 4-4 ile 24 → 20 → 16 → 12 kapalı.
  const s = konum({ 24: 1 }, { 13: 2 });
  assert.deepEqual(hamleler(s, [4, 4]), ['24/20 20/16']);
});

test('toplama kuralları: dışarıda taş varken toplanmaz; fazla zar en uzaktakinden', () => {
  const disarida = konum({ 7: 1, 3: 2 }, { 24: 2 });
  for (const o of M.oyunlar(disarida, 0, [6, 3])) assert.ok(o.adimlar[0].den === 7 || o.adimlar[0].hedef !== 0);
  assert.equal(M.adim(disarida, 0, 3, 3), null);

  const ev = konum({ 5: 1, 3: 2, 1: 1 }, { 24: 2 });
  // 6 atınca en uzak taş (5) toplanır; 3'teki taş 6 ile toplanamaz çünkü 5'te taş var.
  assert.equal(M.adim(ev, 0, 3, 6), null);
  assert.equal(M.adim(ev, 0, 5, 6).hedef, 0);
  // Tam zarla toplama ve içeride oynama ikisi de geçerli.
  assert.equal(M.adim(ev, 0, 3, 3).hedef, 0);
  assert.equal(M.adim(ev, 0, 5, 2).hedef, 3);
  // 5'teki taş toplanınca 3 en uzak olur ve 6 ile toplanabilir.
  const sonra = M.adim(ev, 0, 5, 6).t;
  assert.equal(M.adim(sonra, 0, 3, 6).hedef, 0);
  // Toplarken kırılan taş eve dönmeden toplama durur.
  const kirik = konum({ bar: 1, 2: 3 }, { 24: 2 });
  assert.ok(M.oyunlar(kirik, 0, [6, 5]).every((o) => o.adimlar[0].den === 25));
});

test('mars: kaybeden hiç taş toplamamışsa iki puan', () => {
  const marsli = konum({}, { 6: 5, 5: 5, 4: 5 });
  assert.deepEqual(M.oyunSonucu(marsli), { kazanan: 0, mars: true, puan: 2 });
  const normal = konum({}, { 6: 5, 5: 5, 4: 4 });
  assert.deepEqual(M.oyunSonucu(normal), { kazanan: 0, mars: false, puan: 1 });
  const bilgisayar = konum({ 24: 1 }, {});
  assert.deepEqual(M.oyunSonucu(bilgisayar), { kazanan: 1, mars: false, puan: 1 });
  assert.equal(M.oyunSonucu(konum({ 2: 1 }, { 3: 1 })), null);
});

test('tur içi adımlar yalnızca geçerli bir tam hamleye götürür; zincir hedefleri hesaplanır', () => {
  const t = M.baslangic();
  const zarlar = [6, 5];
  const yasal = M.oyunlar(t, 0, zarlar);
  const ilk = M.sonrakiAdimlar(t, 0, zarlar, [], yasal);
  assert.ok(ilk.length > 0);
  // Her sunulan adımdan sonra ikinci adım da sunulur ve sonuç yasal listede bulunur.
  const yasalAnahtar = new Set(yasal.map((o) => M.anahtar(o.t)));
  for (const a of ilk) {
    const ikinci = M.sonrakiAdimlar(t, 0, zarlar, [a], yasal);
    assert.ok(ikinci.length > 0);
    for (const b of ikinci) assert.ok(yasalAnahtar.has(M.anahtar(M.adimlariUygula(t, 0, [a, b]))));
    assert.deepEqual(M.sonrakiAdimlar(t, 0, zarlar, [a, ikinci[0]], yasal), []);
  }
  // 24'ten tek dokunuşla 18'e ve zincirle 13'e gidilebilir; 19 rakibin 6'sındaki kapı.
  const hedefler = M.hedefSecenekleri(t, 0, zarlar, [], 24, yasal).map((h) => h.hedef).sort((a, b) => a - b);
  assert.deepEqual(hedefler, [13, 18]);
});

test('rastgele oyunlarda her hamle kurallara uyar ve taş sayısı korunur', () => {
  const r = M.uretec(7);
  for (let oyun = 0; oyun < 30; oyun++) {
    let t = M.baslangic();
    let sira = oyun % 2;
    for (let tur = 0; tur < 400 && !M.oyunSonucu(t); tur++) {
      const zarlar = M.zarAt(r);
      const liste = M.oyunlar(t, sira, zarlar);
      const uzunluk = liste.length ? liste[0].adimlar.length : 0;
      for (const o of liste) {
        assert.equal(o.adimlar.length, uzunluk, 'bütün hamleler aynı sayıda zar kullanır');
        let dt = t;
        for (const a of o.adimlar) {
          const s = M.adim(dt, sira, a.den, a.zar);
          assert.ok(s, 'adım geçerli');
          dt = s.t;
        }
        assert.equal(M.anahtar(dt), M.anahtar(o.t));
        for (const d of o.t) assert.equal(d.reduce((x, y) => x + y, 0), 15);
      }
      if (zarlar[0] === zarlar[1]) assert.ok(uzunluk <= 4); else assert.ok(uzunluk <= 2);
      if (liste.length) t = liste[Math.floor(r() * liste.length)].t;
      sira = 1 - sira;
    }
    assert.ok(M.oyunSonucu(t), 'oyun biter');
  }
});

test('Türkçe zar adları', () => {
  assert.equal(M.zarAdi([6, 5]), 'Şeş-beş');
  assert.equal(M.zarAdi([5, 6]), 'Şeş-beş');
  assert.equal(M.zarAdi([6, 6]), 'Dü-şeş');
  assert.equal(M.zarAdi([1, 1]), 'Hep yek');
  assert.equal(M.zarAdi([2, 2]), 'Dubara');
  assert.equal(M.zarAdi([4, 1]), 'Cihar-yek');
  assert.equal(M.zarAdi([3, 2]), 'Se-dü');
});

test('açılış zarı eşit gelmez ve büyük atan başlar', () => {
  const r = M.uretec(3);
  for (let i = 0; i < 200; i++) {
    const a = M.acilisZari(r);
    assert.notEqual(a.zarlar[0], a.zarlar[1]);
    assert.equal(a.baslayan, a.zarlar[0] > a.zarlar[1] ? 0 : 1);
  }
});

test('Zor yapay zekâ Kolay\'ı belirgin şekilde yener (tam ölçüm: scripts/tavla-simulasyon.js)', () => {
  let zor = 0;
  const N = 8;
  for (let i = 0; i < N; i++) {
    const ters = i % 2 === 1;
    const s = M.oyunSimule(ters ? ['kolay', 'zor'] : ['zor', 'kolay'], 1000 + i);
    if ((s.kazanan === 0) !== ters) zor++;
  }
  assert.ok(zor >= N - 1, `Zor ${zor}/${N} kazandı`);
  // Orta da Kolay'ı yener; 100 oyun hızlıdır.
  let orta = 0;
  for (let i = 0; i < 100; i++) if (M.oyunSimule(['orta', 'kolay'], 5000 + i).kazanan === 0) orta++;
  assert.ok(orta >= 90, `Orta ${orta}/100 kazandı`);
});

test('Zor yapay zekâ hamlesi hızlıdır', () => {
  // Rastgele oyunlardan orta oyun konumları toplanır; en yavaş hamle ölçülür.
  const r = M.uretec(11);
  let enYavas = 0;
  let toplam = 0, adet = 0;
  for (let oyun = 0; oyun < 4; oyun++) {
    let t = M.baslangic();
    let sira = 0;
    for (let tur = 0; tur < 60 && !M.oyunSonucu(t); tur++) {
      const zarlar = tur % 5 === 0 ? [3, 3] : M.zarAt(r); // çift zar en pahalı durumdur
      const bas = process.hrtime.bigint();
      const h = M.yapayZekaHamlesi(t, sira, zarlar, 'zor', r);
      const ms = Number(process.hrtime.bigint() - bas) / 1e6;
      enYavas = Math.max(enYavas, ms);
      toplam += ms; adet++;
      if (h) t = h.t;
      sira = 1 - sira;
    }
  }
  // Orta segment telefon masaüstünden ~4-5 kat yavaştır; 1 sn bütçesi için burada 200 ms sınırı.
  assert.ok(enYavas < 200, `en yavaş hamle ${enYavas.toFixed(0)} ms (ortalama ${(toplam / adet).toFixed(1)} ms)`);
});

test('istatistik oyun, maç ve mars sayar', () => {
  let ist = M.yeniIstatistik();
  ist = M.istatistikIsle(ist, { kazanan: 0, mars: true, puan: 2 }, false, false);
  ist = M.istatistikIsle(ist, { kazanan: 1, mars: false, puan: 1 }, false, false);
  ist = M.istatistikIsle(ist, { kazanan: 0, mars: false, puan: 1 }, true, true);
  assert.deepEqual(ist, { mac: 1, macKazanilan: 1, oyun: 3, oyunKazanilan: 2, marsYapilan: 1, marsYenilen: 0 });
});
