'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../games/pasyans/mantik.js');

const KOK = path.join(__dirname, '..');
const T = { maca: 0, kupa: 1, karo: 2, sinek: 3 };
const c = (tip, deger) => T[tip] * 13 + deger - 1;

// Elle durum kurar: sutun = [[kapali, acik], ...] (eksik sütunlar boş), temel = { maca: 3, ... } (As'tan o değere kadar).
function kur({ sutun = [], temel = {}, stok = [], atik = [], cekilis = 1, turSiniri = null, tur = 1 } = {}) {
  const d = M.yeniEl(1, cekilis, turSiniri);
  d.sutun = Array.from({ length: 7 }, (_, i) => ({ kapali: (sutun[i] && sutun[i][0]) || [], acik: (sutun[i] && sutun[i][1]) || [] }));
  d.temel = ['maca', 'kupa', 'karo', 'sinek'].map((ad, t) => Array.from({ length: temel[ad] || 0 }, (_, j) => t * 13 + j));
  d.stok = stok.slice(); d.atik = atik.slice(); d.tur = tur; d.hamle = 0; d.gecmis = [];
  return d;
}
const tasi = (kaynak, hedef) => ({ tip: 'tasi', kaynak, hedef });
const sut = (i, n = 1) => ({ yer: 'sutun', i, n });
const hs = (i) => ({ yer: 'sutun', i });
const ht = (ad) => ({ yer: 'temel', i: T[ad] });

function tumKartlar(d) {
  const hepsi = [];
  d.sutun.forEach((s) => hepsi.push(...s.kapali, ...s.acik));
  d.temel.forEach((t) => hepsi.push(...t));
  hepsi.push(...d.stok, ...d.atik);
  return hepsi;
}
const kopya = (d) => JSON.parse(JSON.stringify(d));
const sadeli = (d) => { const k = kopya(d); delete k.gecmis; return k; };

test('deste 52 benzersiz kart içerir; dağıtım 1..7 sütun ve 24 kartlık stok verir', () => {
  const d = M.yeniEl(42, 1, null);
  assert.equal(new Set(tumKartlar(d)).size, 52);
  assert.equal(tumKartlar(d).length, 52);
  d.sutun.forEach((s, i) => {
    assert.equal(s.kapali.length, i);
    assert.equal(s.acik.length, 1, 'her sütunda yalnızca en alttaki kart açık');
  });
  assert.equal(d.stok.length, 24);
  assert.equal(d.atik.length, 0);
  assert.ok(M.durumGecerliMi(d));
});

test('aynı tohum aynı desteyi, farklı tohum farklı desteyi verir', () => {
  assert.deepEqual(M.karistir(7), M.karistir(7));
  assert.notDeepEqual(M.karistir(7), M.karistir(8));
});

test('kart bilgisi: tip, değer, renk ve Türkçe ad', () => {
  assert.equal(M.kartAdi(c('kupa', 13)), 'Kupa Papaz');
  assert.equal(M.kartAdi(c('maca', 1)), 'Maça As');
  assert.equal(M.kartAdi(c('sinek', 12)), 'Sinek Kız');
  assert.equal(M.kartAdi(c('karo', 11)), 'Karo Vale');
  assert.ok(M.kirmizi(c('kupa', 5)) && M.kirmizi(c('karo', 5)));
  assert.ok(!M.kirmizi(c('maca', 5)) && !M.kirmizi(c('sinek', 5)));
});

test('sütun hamlesi: renk değişimi ve azalan sıra şart', () => {
  const d = kur({ sutun: [[[], [c('kupa', 7)]], [[], [c('sinek', 6)]], [[], [c('maca', 6)]], [[], [c('kupa', 6)]], [[], [c('sinek', 5)]]] });
  assert.ok(M.hamleGecerliMi(d, tasi(sut(1), hs(0))), 'siyah 6 kırmızı 7 üstüne');
  assert.ok(M.hamleGecerliMi(d, tasi(sut(2), hs(0))));
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(3), hs(0))), 'aynı renk (kırmızı 6 kırmızı 7 üstüne) olmaz');
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(4), hs(0))), 'sıra atlanamaz (5, 7 üstüne olmaz)');
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(0), hs(1))), 'büyük kart küçüğün üstüne olmaz');
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(0), hs(0))), 'aynı sütuna taşınmaz');
});

test('boş sütuna yalnızca papaz konabilir', () => {
  const d = kur({ sutun: [[[], [c('kupa', 13)]], [[], [c('maca', 12)]]] });
  assert.ok(M.hamleGecerliMi(d, tasi(sut(0), hs(2))));
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(1), hs(2))), 'kız boş sütuna konmaz');
  const e = kur({ sutun: [[[], [c('kupa', 13)]]], atik: [c('sinek', 13)] });
  assert.ok(M.hamleGecerliMi(e, tasi({ yer: 'atik' }, hs(3))));
});

test('as temele gider, sonrası sırayla; temel yuvası takıma göre', () => {
  const d = kur({ sutun: [[[], [c('kupa', 1)]], [[], [c('kupa', 3)]], [[], [c('maca', 1)]]], temel: {} });
  assert.ok(M.hamleGecerliMi(d, tasi(sut(0), ht('kupa'))));
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(0), ht('maca'))), 'yanlış takım yuvası');
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(1), ht('kupa'))), '3, As olmadan temele gitmez');
  const e = M.hamleYap(d, tasi(sut(0), ht('kupa')));
  assert.deepEqual(e.temel[1], [c('kupa', 1)]);
  const f = kur({ sutun: [[[], [c('kupa', 3)]]], temel: { kupa: 1 } });
  assert.ok(!M.hamleGecerliMi(f, tasi(sut(0), ht('kupa'))), '2 eksik');
  const g = kur({ sutun: [[[], [c('kupa', 2)]]], temel: { kupa: 1 } });
  assert.ok(M.hamleGecerliMi(g, tasi(sut(0), ht('kupa'))));
});

test('sıralı kartlar birlikte taşınır; yalnızca geçerli başlangıç kartı sayılır', () => {
  const d = kur({ sutun: [[[], [c('kupa', 8), c('sinek', 7), c('karo', 6)]], [[], [c('maca', 9)]]] });
  assert.ok(M.hamleGecerliMi(d, tasi(sut(0, 3), hs(1))), '8-7-6 dizisi maça 9 üstüne');
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(0, 2), hs(1))), '7-6 dizisi 9 üstüne olmaz');
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(0, 4), hs(1))), 'olmayan kart sayısı');
  assert.ok(!M.hamleGecerliMi(d, tasi(sut(0, 3), ht('kupa'))), 'dizi temele gitmez');
  const e = M.hamleYap(d, tasi(sut(0, 3), hs(1)));
  assert.deepEqual(e.sutun[1].acik, [c('maca', 9), c('kupa', 8), c('sinek', 7), c('karo', 6)]);
  assert.deepEqual(e.sutun[0].acik, []);
});

test('sütunun açık kartı kalmayınca alttaki kapalı kart otomatik açılır', () => {
  const d = kur({ sutun: [[[c('maca', 4), c('karo', 9)], [c('kupa', 5)]], [[], [c('sinek', 6)]]] });
  const e = M.hamleYap(d, tasi(sut(0), hs(1)));
  assert.deepEqual(e.sutun[0].kapali, [c('maca', 4)]);
  assert.deepEqual(e.sutun[0].acik, [c('karo', 9)]);
});

test('geçersiz hamle null döner ve durumu değiştirmez', () => {
  const d = kur({ sutun: [[[], [c('kupa', 7)]], [[], [c('kupa', 6)]]] });
  const once = sadeli(d);
  assert.equal(M.hamleYap(d, tasi(sut(1), hs(0))), null);
  assert.equal(M.hamleYap(d, { tip: 'tasi', kaynak: { yer: 'atik' }, hedef: hs(0) }), null);
  assert.equal(M.hamleYap(d, { tip: 'sacma' }), null);
  assert.deepEqual(sadeli(d), once);
});

test('1 kart çekiliş: tek kart atığa geçer, stok bitince atık desteye çevrilir (sınırsız)', () => {
  let d = kur({ stok: [5, 6, 7] });
  d = M.hamleYap(d, { tip: 'cek' });
  assert.deepEqual(d.atik, [7]);
  d = M.hamleYap(d, { tip: 'cek' });
  d = M.hamleYap(d, { tip: 'cek' });
  assert.deepEqual(d.atik, [7, 6, 5]);
  assert.deepEqual(d.stok, []);
  d = M.hamleYap(d, { tip: 'cek' });
  assert.deepEqual(d.atik, []);
  assert.deepEqual(d.stok, [5, 6, 7], 'çevirme ilk sırayı korur');
  assert.equal(d.tur, 2);
  d = M.hamleYap(d, { tip: 'cek' });
  assert.deepEqual(d.atik, [7]);
});

test('3 kart çekiliş: üç kart birden gelir, sonuncusu üstte; kalan azsa kalanı gelir', () => {
  let d = kur({ stok: [1, 2, 3, 4, 5], cekilis: 3 });
  d = M.hamleYap(d, { tip: 'cek' });
  assert.deepEqual(d.atik, [5, 4, 3]);
  assert.equal(d.atik[d.atik.length - 1], 3, 'son çekilen kart oynanabilir');
  d = M.hamleYap(d, { tip: 'cek' });
  assert.deepEqual(d.atik, [5, 4, 3, 2, 1]);
  assert.deepEqual(d.stok, []);
});

test('sınırlı deste turu: tur bitince çevrilemez', () => {
  let d = kur({ stok: [1, 2], atik: [], cekilis: 1, turSiniri: 2 });
  d = M.hamleYap(d, { tip: 'cek' }); d = M.hamleYap(d, { tip: 'cek' });
  assert.ok(M.cekebilirMi(d));
  d = M.hamleYap(d, { tip: 'cek' });
  assert.equal(d.tur, 2);
  d = M.hamleYap(d, { tip: 'cek' }); d = M.hamleYap(d, { tip: 'cek' });
  assert.equal(d.stok.length, 0);
  assert.ok(!M.cekebilirMi(d), '2 tur doldu');
  assert.equal(M.hamleYap(d, { tip: 'cek' }), null);
});

test('atıktan sütuna ve temele taşıma', () => {
  const d = kur({ sutun: [[[], [c('kupa', 7)]]], atik: [c('maca', 1), c('sinek', 6)] });
  const e = M.hamleYap(d, tasi({ yer: 'atik' }, hs(0)));
  assert.deepEqual(e.sutun[0].acik, [c('kupa', 7), c('sinek', 6)]);
  const f = M.hamleYap(e, tasi({ yer: 'atik' }, ht('maca')));
  assert.deepEqual(f.temel[0], [c('maca', 1)]);
  assert.deepEqual(f.atik, []);
});

test('temelden sütuna geri alma hamlesi serbest', () => {
  const d = kur({ sutun: [[[], [c('sinek', 6)]]], temel: { kupa: 5 } });
  const h = tasi({ yer: 'temel', i: T.kupa }, hs(0));
  assert.ok(M.hamleGecerliMi(d, h));
  const e = M.hamleYap(d, h);
  assert.equal(e.temel[1].length, 4);
  assert.equal(e.sutun[0].acik[1], c('kupa', 5));
});

test('geri al: her hamle türünde önceki durumu aynen getirir (çekme, çevirme, taşıma, açma, temel)', () => {
  const baslangic = kur({
    sutun: [[[c('maca', 4)], [c('kupa', 5)]], [[], [c('sinek', 6)]], [[], [c('karo', 1)]], [[], [c('maca', 9), c('kupa', 8)]], [[], [c('sinek', 7)]]],
    temel: { kupa: 2 }, stok: [c('karo', 3), c('maca', 10)], atik: [c('kupa', 3)]
  });
  const hamleler = [
    { tip: 'cek' }, // stoktan çek
    tasi({ yer: 'atik' }, ht('kupa')), // atık -> temel? (atık üstü maça 10: geçersiz; aşağıda dene)
    tasi(sut(2), ht('karo')), // as temele
    tasi(sut(0), hs(1)), // kupa 5 -> sinek 6 (kapalı kart açılır)
    tasi(sut(3, 2), { yer: 'sutun', i: 5 }) // 9-8 dizisi boş sütuna: geçersiz (papaz değil)
  ];
  let d = baslangic;
  const gecmis = [];
  for (const h of hamleler) {
    const n = M.hamleYap(d, h);
    if (!n) continue;
    gecmis.push(sadeli(d));
    d = n;
  }
  assert.ok(gecmis.length >= 3);
  while (gecmis.length) {
    d = M.geriAl(d);
    assert.deepEqual(sadeli(d), gecmis.pop());
  }
  assert.equal(M.geriAl(d), null, 'başlangıçta geri alınacak bir şey yok');
  assert.deepEqual(sadeli(d), sadeli(baslangic));
});

test('geri al: stok çevirme ve temelden sütuna hamleyi de geri alır', () => {
  let d = kur({ stok: [], atik: [1, 2, 3], sutun: [[[], [c('sinek', 6)]]], temel: { kupa: 5 } });
  const a0 = sadeli(d);
  d = M.hamleYap(d, { tip: 'cek' });
  assert.equal(d.tur, 2);
  assert.deepEqual(sadeli(M.geriAl(d)), a0, 'çevirme geri alınır (tur sayacı dahil)');
  const e = M.hamleYap(d, tasi({ yer: 'temel', i: T.kupa }, hs(0)));
  assert.deepEqual(sadeli(M.geriAl(e)), sadeli(d));
});

test('geri al: rastgele oyunlarda her adımda geriye sarar ve kart sayısı korunur', () => {
  for (let tohum = 1; tohum <= 6; tohum++) {
    const rast = M.uretec(tohum * 101);
    let d = M.yeniEl(tohum, tohum % 2 ? 1 : 3, tohum % 2 ? null : 3);
    const onceki = [];
    for (let adim = 0; adim < 150; adim++) {
      const liste = M.ipuclari(d);
      const secenekler = liste.length ? liste : [{ tip: 'cek' }];
      const h = secenekler[Math.floor(rast() * secenekler.length)];
      const n = M.hamleYap(d, h);
      if (!n) break;
      onceki.push(sadeli(d));
      d = n;
      assert.equal(new Set(tumKartlar(d)).size, 52);
      assert.ok(M.durumGecerliMi(d));
    }
    while (onceki.length) {
      d = M.geriAl(d);
      assert.deepEqual(sadeli(d), onceki.pop());
    }
  }
});

test('otomatik temel yalnızca güvenli kartları taşır ve geçmişe yazılmaz', () => {
  // As ve 2 her zaman güvenli
  let d = kur({ sutun: [[[], [c('kupa', 1)]], [[], [c('maca', 9)]]] });
  let h = M.otoTemelHamle(d);
  assert.deepEqual(h.hedef, ht('kupa'));
  // 3: zıt renk (maça, sinek) temelde 2'ye varmadıysa güvensiz
  d = kur({ sutun: [[[], [c('kupa', 3)]]], temel: { kupa: 2 } });
  assert.equal(M.otoTemelHamle(d), null, 'kırmızı 3: maça/sinek ilerlemedi');
  d = kur({ sutun: [[[], [c('kupa', 3)]]], temel: { kupa: 2, maca: 2, sinek: 2 } });
  assert.ok(M.otoTemelHamle(d));
  const n = M.otoUygula(d, M.otoTemelHamle(d));
  assert.equal(n.hamle, d.hamle, 'otomatik taşıma hamle sayılmaz');
  assert.equal(n.gecmis.length, d.gecmis.length, 'geçmişe yazılmaz: geri al kullanıcı hamlesiyle birlikte sarar');
  // atık da taranır
  d = kur({ atik: [c('sinek', 1)] });
  assert.deepEqual(M.otoTemelHamle(d).kaynak, { yer: 'atik' });
});

test('kullanıcı hamlesi + otomatik taşımalar tek geri al ile geri sarılır', () => {
  let d = kur({ sutun: [[[], [c('kupa', 2), c('maca', 1)]], [[], [c('kupa', 1)]]], temel: {} });
  d.sutun[0].acik = [c('kupa', 2)];
  d.sutun[1].acik = [c('maca', 5)];
  d.atik = [c('kupa', 1)];
  const baslangic = sadeli(d);
  let n = M.hamleYap(d, tasi({ yer: 'atik' }, ht('kupa')));
  for (let h; (h = M.otoTemelHamle(n));) n = M.otoUygula(n, h);
  assert.equal(n.temel[1].length, 2, 'kupa 2 de otomatik gitti');
  assert.deepEqual(sadeli(M.geriAl(n)), baslangic);
});

test('oyun sonu: kapalı kart kalmadıysa kalan kartlar otomatik temele bitirilir', () => {
  // Son iki takım sütunlarda sıralı, hepsi açık
  const d = kur({
    temel: { maca: 13, kupa: 13 },
    sutun: [[[], [c('sinek', 13), c('karo', 12), c('sinek', 11)]], [[], [c('karo', 13), c('sinek', 12), c('karo', 11)]]],
    atik: [c('karo', 10)]
  });
  d.temel[2] = Array.from({ length: 9 }, (_, j) => 26 + j);
  d.temel[3] = Array.from({ length: 10 }, (_, j) => 39 + j);
  const dizi = M.bitirDizisi(d);
  assert.ok(dizi && dizi.length >= 4);
  let n = d;
  for (const h of dizi) { n = M.otoUygula(n, h); assert.ok(n, 'dizideki her hamle geçerli'); }
  assert.ok(M.kazandiMi(n));
  // kapalı kart varken bitirilemez
  const e = kur({ sutun: [[[c('maca', 2)], [c('kupa', 5)]]] });
  assert.equal(M.bitirDizisi(e), null);
});

test('bitirme diziliminde destedeki kartlar da çekilerek temele taşınır', () => {
  const d = kur({ temel: { maca: 13, kupa: 13, karo: 12 }, stok: [], atik: [c('karo', 13)] });
  d.temel[3] = Array.from({ length: 12 }, (_, j) => 39 + j);
  d.sutun[0] = { kapali: [], acik: [] };
  d.atik = [c('sinek', 13), c('karo', 13)];
  d.temel[2] = d.temel[2].slice(0, 12);
  const dizi = M.bitirDizisi(d);
  assert.ok(dizi);
  let n = d;
  dizi.forEach((h) => { n = M.otoUygula(n, h); });
  assert.ok(M.kazandiMi(n));
});

test('kazanma: 52 kart temelde olunca kazandiMi doğru', () => {
  const d = kur({ temel: { maca: 13, kupa: 13, karo: 13, sinek: 12 }, sutun: [[[], [c('sinek', 13)]]] });
  assert.ok(!M.kazandiMi(d));
  const n = M.hamleYap(d, tasi(sut(0), ht('sinek')));
  assert.ok(M.kazandiMi(n));
  assert.ok(M.durumGecerliMi(n));
});

test('en iyi hedef: önce temel, sonra dolu sütun, boş sütun en sonda', () => {
  let d = kur({ sutun: [[[], [c('kupa', 1)]]], temel: {} });
  assert.deepEqual(M.enIyiHedef(d, sut(0)), ht('kupa'));
  d = kur({ sutun: [[[], [c('kupa', 13)]], [[], [c('maca', 12)]]], atik: [c('sinek', 12)] });
  assert.deepEqual(M.enIyiHedef(d, { yer: 'atik' }), hs(0), 'kız papaz üstüne');
  // tüm sütunu başka boş sütuna taşımak önerilmez
  d = kur({ sutun: [[[], [c('kupa', 13)]]] });
  assert.equal(M.enIyiHedef(d, sut(0)), null);
  // kapalı kartı açacak papaz boş sütuna önerilir
  d = kur({ sutun: [[[c('maca', 3)], [c('kupa', 13)]]] });
  assert.deepEqual(M.enIyiHedef(d, sut(0)), hs(1));
  assert.equal(M.hedefler(kur({ sutun: [[[], [c('kupa', 7)]]] }), sut(0)).length, 0);
});

test('ipucu geçerli hamle verir; kapalı kart açan hamle önce gelir', () => {
  const d = kur({
    sutun: [[[c('maca', 4)], [c('kupa', 5)]], [[], [c('sinek', 6)]], [[], [c('maca', 9), c('kupa', 8)]], [[], [c('sinek', 7)]]],
    atik: []
  });
  const liste = M.ipuclari(d);
  assert.ok(liste.length > 0);
  liste.forEach((h) => assert.ok(M.hamleGecerliMi(d, h), JSON.stringify(h)));
  assert.deepEqual(liste[0], tasi(sut(0), hs(1)), 'kapalı kartı açan hamle');
  assert.ok(M.hamleMetni(d, liste[0]).includes('Kupa 5'));
  assert.ok(M.hamleMetni(d, liste[0]).includes('Sinek 6'));
  assert.equal(M.hamleMetni(d, tasi(sut(0), ht('kupa'))), 'Kupa 5 kartını temele gönder.');
});

test('ipucu: temel hamlesi her şeyden önce; yoksa deste çekmeyi önerir', () => {
  const d = kur({ sutun: [[[c('maca', 4)], [c('kupa', 1)]], [[], [c('sinek', 6)]]] });
  assert.deepEqual(M.ipuclari(d)[0].hedef, ht('kupa'));
  const bos = kur({ sutun: [[[], [c('kupa', 7)]], [[], [c('kupa', 9)]]], stok: [c('maca', 6)] });
  assert.deepEqual(M.ipuclari(bos), [{ tip: 'cek' }]);
  const hic = kur({ sutun: [[[], [c('kupa', 7)]], [[], [c('kupa', 9)]]] });
  assert.deepEqual(M.ipuclari(hic), []);
});

test('hamle kalmadı: deste çevrilerek de ilerlenemiyorsa takıldı sayılır', () => {
  const takili = kur({ sutun: [[[], [c('kupa', 7)]], [[], [c('kupa', 9)]]], stok: [c('maca', 3)] });
  assert.equal(M.hamleVarMi(takili), false, 'stoktaki 3 hiçbir yere gitmez');
  const kurtulur = kur({ sutun: [[[], [c('kupa', 7)]], [[], [c('kupa', 9)]]], stok: [c('maca', 6)] });
  assert.equal(M.hamleVarMi(kurtulur), true, 'stoktaki maça 6, kupa 7 üstüne gider');
  const sinirli = kur({ sutun: [[[], [c('kupa', 7)]]], stok: [], atik: [c('maca', 6), c('karo', 2)], turSiniri: 1, tur: 1 });
  assert.equal(M.hamleVarMi(sinirli), false, 'tur hakkı bittiği için atıktaki maça 6 artık ulaşılamaz');
  assert.equal(M.hamleVarMi(kur({ temel: { maca: 13, kupa: 13, karo: 13, sinek: 13 } })), false, 'kazanılmış oyunda hamle yok');
});

test('3 kartlık çekilişte atıktaki ulaşılabilir kartlar hesaba katılır', () => {
  // stok sondan çekilir: ikinci çekilişin üstündeki kart maça 6
  const d = kur({ sutun: [[[], [c('kupa', 7)]]], stok: [c('maca', 6), c('sinek', 2), c('karo', 2), c('sinek', 3), c('karo', 4), c('karo', 5)], cekilis: 3 });
  const makrolar = M.atikMakrolari(d);
  assert.ok(makrolar.some((m) => m.hamle.kaynak.yer === 'atik' && m.hamle.hedef.yer === 'sutun'));
  assert.equal(M.hamleVarMi(d), true);
});

test('hamle sayacı ve geçmiş: her kullanıcı hamlesi sayılır', () => {
  let d = kur({ stok: [1, 2, 3] });
  d = M.hamleYap(d, { tip: 'cek' }); d = M.hamleYap(d, { tip: 'cek' });
  assert.equal(d.hamle, 2);
  assert.equal(d.gecmis.length, 2);
  d = M.geriAl(d);
  assert.equal(d.hamle, 1);
});

test('çözücü: kazanılabilir desteyi çözer ve çözümü gerçek kurallarla oynayınca oyun kazanılır', () => {
  let cozulen = 0;
  for (let tohum = 1; tohum <= 12 && cozulen < 3; tohum++) {
    const d = M.yeniEl(tohum, 1, null);
    const r = M.coz(d, { dugumSiniri: 6000 });
    if (r.sonuc !== 'kazanir') continue;
    cozulen++;
    const son = M.cozumuOyna(d, r.hamleler);
    assert.ok(son, 'çözümdeki her hamle geçerli');
    assert.ok(M.kazandiMi(son));
  }
  assert.ok(cozulen >= 2, 'çözücü sıradan desteleri çözebilmeli');
});

test('çözücü: 3 kartlık ve sınırlı turlu çekilişte de geçerli çözüm üretir', () => {
  let bulundu = false;
  for (let tohum = 1; tohum <= 25 && !bulundu; tohum++) {
    const d = M.yeniEl(tohum, 3, 3);
    const r = M.coz(d, { dugumSiniri: 5000 });
    if (r.sonuc === 'kazanir') {
      bulundu = true;
      assert.ok(M.kazandiMi(M.cozumuOyna(d, r.hamleler)));
    }
  }
  assert.ok(bulundu);
});

test('çözücü: kazanılamaz durumu (tek hamlesiz) doğru tanır; düğüm sınırı "bilinmiyor" döner', () => {
  const sikisik = kur({ sutun: [[[], [c('kupa', 7)]], [[], [c('kupa', 9)]]], stok: [], atik: [] });
  assert.equal(M.coz(sikisik).sonuc, 'kazanamaz');
  const d = M.yeniEl(3, 1, null);
  const r = M.coz(d, { dugumSiniri: 5 });
  assert.ok(r.sonuc === 'bilinmiyor' || r.sonuc === 'kazanir');
});

test('günlük deste: aynı tarih herkese aynı, farklı tarih farklı', () => {
  const a = M.gunlukDagit('2026-10-20');
  const b = M.gunlukDagit('2026-10-20');
  assert.deepEqual(a.durum.sutun, b.durum.sutun);
  assert.deepEqual(a.durum.stok, b.durum.stok);
  assert.equal(a.deneme, b.deneme, 'çözücü düğüm sınırıyla belirleyici: herkeste aynı deneme seçilir');
  const c2 = M.gunlukDagit('2026-10-21');
  assert.notDeepEqual(a.durum.stok.concat(a.durum.sutun.map((s) => s.acik[0])), c2.durum.stok.concat(c2.durum.sutun.map((s) => s.acik[0])));
  // tohum yalnızca tarih anahtarından türer
  assert.equal(M.gunlukTohum('2026-10-20', 0), M.gunlukTohum('2026-10-20', 0));
  assert.notEqual(M.gunlukTohum('2026-10-20', 0), M.gunlukTohum('2026-10-21', 0));
  assert.notEqual(M.gunlukTohum('2026-10-20', 0), M.gunlukTohum('2026-10-20', 1));
});

test('günlük deste çözücü tarafından kazanılabilir bulunur (çözüm gerçek kurallarla oynanıp kazanılır)', () => {
  for (const tarih of ['2026-10-20', '2026-10-21', '2026-12-31', '2027-02-14']) {
    const g = M.gunlukDagit(tarih);
    assert.ok(g.cozum, `${tarih}: çözüm bulunmalı`);
    assert.ok(g.durum.dogrulandi);
    const yeniden = M.yeniEl(M.gunlukTohum(tarih, g.deneme), 1, null);
    assert.deepEqual(yeniden.sutun, g.durum.sutun);
    const son = M.cozumuOyna(yeniden, g.cozum);
    assert.ok(son && M.kazandiMi(son), `${tarih}: çözüm oyunu bitirmeli`);
    assert.equal(M.coz(yeniden, { dugumSiniri: 6000 }).sonuc, 'kazanir', `${tarih}: çözücü bağımsız çalışınca da kazanılabilir bulur`);
  }
});

test('kazanılabilir dağıtma: süre sınırı içinde doğrulanmış deste verir (verilen sınırda yoksa yine de geçerli deste)', () => {
  const d = M.kazanilabilirDagit(1, null, { sureMs: 1500, rastgele: M.uretec(5) });
  assert.ok(M.durumGecerliMi(d));
  if (d.dogrulandi) assert.equal(M.coz(d, { dugumSiniri: 6000 }).sonuc, 'kazanir');
  const yedek = M.kazanilabilirDagit(3, 3, { sureMs: 0 });
  assert.ok(M.durumGecerliMi(yedek));
  assert.equal(yedek.dogrulandi, false);
  assert.equal(yedek.cekilis, 3);
});

test('durumGecerliMi bozuk kaydı reddeder; JSON gidiş-dönüşte durum korunur', () => {
  const d = M.hamleYap(M.yeniEl(9, 1, null), { tip: 'cek' });
  const geri = JSON.parse(JSON.stringify(d));
  assert.ok(M.durumGecerliMi(geri));
  assert.deepEqual(geri, d);
  const bozuk = kopya(geri); bozuk.stok.pop();
  assert.ok(!M.durumGecerliMi(bozuk), 'eksik kart');
  const tekrar = kopya(geri); tekrar.stok[0] = tekrar.sutun[0].acik[0];
  assert.ok(!M.durumGecerliMi(tekrar), 'tekrarlı kart');
  assert.ok(!M.durumGecerliMi(null));
  assert.ok(!M.durumGecerliMi({}));
});

test('süre ve paylaşım metni biçimi', () => {
  assert.equal(M.sureBicim(161000), '02:41');
  assert.equal(M.sureBicim(0), '00:00');
  assert.equal(M.sureBicim(3725000), '1:02:05');
  assert.equal(M.ozetMetni(161000, 98), '02:41 · 98 hamle');
  assert.equal(M.paylasimMetni(new Date(2026, 9, 20), 161000, 98), 'Pasyans · Günün destesi 20 Ekim · 02:41 · 98 hamle');
  assert.equal(M.tarihAnahtari(new Date(2026, 0, 5)), '2026-01-05');
});

// ---------- Sayfa ve tel örgüsü ----------
test('games.json kaydı: günlük, 2D, masa oyunu, dosyalar tam', () => {
  const oyunlar = JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8'));
  const o = oyunlar.find((x) => x.slug === 'pasyans');
  assert.ok(o, 'pasyans kaydı var');
  assert.equal(o.boyut, '2D');
  assert.equal(o.kategori, 'Masa oyunu');
  assert.equal(o.gunluk, true);
  assert.equal(o.eklenme, '2026-10-20');
  for (const d of ['games/pasyans/', 'games/pasyans/stil.css', 'games/pasyans/mantik.js', 'games/pasyans/oyun.js', 'games/pasyans/kapak.svg']) {
    assert.ok(o.dosyalar.includes(d), d);
  }
  assert.ok(fs.existsSync(path.join(KOK, 'sitemap.xml')));
  assert.ok(fs.readFileSync(path.join(KOK, 'sitemap.xml'), 'utf8').includes('/games/pasyans/'));
});

test('sayfa: Nasıl oynanır?, tüm betikler yerel, canvas şelale ve kapak var', () => {
  const html = fs.readFileSync(path.join(KOK, 'games/pasyans/index.html'), 'utf8');
  assert.match(html, /<h2>Nasıl oynanır\?<\/h2>/);
  assert.match(html, /<html lang="tr">/);
  assert.match(html, /sw-kayit\.js/);
  assert.ok(!/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//.test(html.replace(/<!-- SEO:BASLA -->[\s\S]*?<!-- SEO:BITIS -->/, '')));
  const kapak = fs.readFileSync(path.join(KOK, 'games/pasyans/kapak.svg'), 'utf8');
  assert.match(kapak, /^<svg /);
});

test('oyun.js: günlük yardımcı korumalı çağrılır, özet yazılır, reduced-motion şelaleyi kapatır, depo.js kullanılır', () => {
  const js = fs.readFileSync(path.join(KOK, 'games/pasyans/oyun.js'), 'utf8');
  assert.ok(js.includes("Depo.ozetYaz('pasyans'"));
  assert.match(js, /window\.Gunluk && typeof window\.Gunluk\.kaydet === 'function'/);
  assert.ok(js.includes("'pasyans', { durum: durumAd, ozet: ozet }"));
  assert.match(js, /gunlukBildir\('yarim'/);
  assert.match(js, /gunlukBildir\('bitti'/);
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /if \(!hizli\) selale\(\)/, 'hareket azaltma açıkken şelale çalışmaz');
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\//.test(js.replace(/http:\/\/www\.w3\.org\/2000\/svg/, '')), 'harici istek yok');
  const css = fs.readFileSync(path.join(KOK, 'games/pasyans/stil.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.ok(!/url\(/.test(css), 'harici görsel yok');
});

test('yerleşim: 390 px genişlikte 7 sütun yatay kaydırmasız sığar ve kartlar en az 48×68 olur', () => {
  // oyun.js olc() ile aynı hesap: mobilde masa kenara taşar (padding 12), konteyner 16 px boşluklu
  const viewport = 390, masaGenisligi = viewport - 24; // .masa-alani margin -16 px, padding 12 px
  const aralik = 3;
  const kw = Math.floor(((masaGenisligi - 6 * aralik) / 7) * 2) / 2;
  const kh = Math.round(kw * 1.4);
  assert.ok(kw >= 48, `kart genişliği ${kw}`);
  assert.ok(kh >= 68, `kart yüksekliği ${kh}`);
  assert.ok(7 * kw + 6 * aralik <= masaGenisligi);
  const js = fs.readFileSync(path.join(KOK, 'games/pasyans/oyun.js'), 'utf8');
  assert.match(js, /var aralik = kucuk \? 3 : 12;/, 'testteki hesapla aynı aralık');
  assert.match(js, /Math\.floor\(\(\(W - 6 \* aralik\) \/ SUTUN\) \* 2\) \/ 2/);
});
