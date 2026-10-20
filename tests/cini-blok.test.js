'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/cini-blok/mantik.js');

// '#' dolu (renk 0), '.' boş; 8 satırlık metinden tahta kurar.
function tahtaKur(satirlar) {
  const t = M.bosTahta();
  satirlar.forEach((satir, r) => {
    for (let c = 0; c < 8; c++) if (satir[c] === '#') t[r * 8 + c] = 0;
  });
  return t;
}
const BOS = '........';

test('şekiller kalıplardan doğru çözülür ve sınır dışına taşmaz', () => {
  assert.deepEqual(M.sekil('kose-1').hucreler, [[0, 0], [0, 1], [1, 0]]);
  assert.equal(M.sekil('kare-3').hucreler.length, 9);
  assert.equal(M.sekil('besli-d').boy, 5);
  const t = M.bosTahta();
  assert.ok(M.sigarMi(t, 'besli-y', 0, 3));
  assert.ok(!M.sigarMi(t, 'besli-y', 0, 4), 'sağ kenardan taşar');
  assert.ok(!M.sigarMi(t, 'besli-d', 4, 0), 'alt kenardan taşar');
  assert.ok(!M.sigarMi(t, 'tek', -1, 0));
});

test('dolu hücreye parça konamaz, boşluğa tam oturan parça konur', () => {
  const t = tahtaKur(['##.#####', '#..#####', BOS, BOS, BOS, BOS, BOS, BOS]);
  assert.ok(!M.sigarMi(t, 'kare-2', 0, 1));
  assert.ok(M.sigarMi(t, 'kose-4', 0, 1));
  assert.equal(M.yerlestir(t, 'kare-2', 0, 0, 1), null);
});

test('yerleştirme girdiyi değiştirmez; dolan satır temizlenir', () => {
  const t = tahtaKur(['######..', BOS, BOS, BOS, BOS, BOS, BOS, BOS]);
  const once = t.slice();
  const s = M.yerlestir(t, 'ikili-y', 0, 6, 2);
  assert.deepEqual(t, once);
  assert.deepEqual(s.satirlar, [0]);
  assert.deepEqual(s.sutunlar, []);
  assert.equal(s.cizgi, 1);
  assert.equal(s.temizlenen.length, 8);
  assert.ok(s.tahta.every((h) => h === -1));
  assert.ok(s.tertemiz);
});

test('aynı hamlede satır ve sütun birlikte temizlenir, kesişim hücresi bir kez sayılır', () => {
  const t = tahtaKur(['#######.', '.......#', '.......#', '.......#', '.......#', '.......#', '.......#', '.......#']);
  t[63] = -1; // sütun 7'nin son hücresi boş kalsın
  t[8 * 7] = 0; // tertemiz olmasın diye sol altta bir çini
  const s = M.yerlestir(t, 'tek', 0, 7, 3);
  assert.deepEqual(s.satirlar, [0]);
  assert.deepEqual(s.sutunlar, []);
  const s2 = M.yerlestir(tahtaKur(['#######.', '.......#', '.......#', '.......#', '.......#', '.......#', '.......#', '#......#']), 'tek', 0, 7, 3);
  assert.deepEqual(s2.satirlar, [0]);
  assert.deepEqual(s2.sutunlar, [7]);
  assert.equal(s2.cizgi, 2);
  assert.equal(s2.temizlenen.length, 15);
  assert.equal(new Set(s2.temizlenen.map((h) => h.dizin)).size, 15);
  assert.equal(s2.tahta[56], 0, 'temizlenmeyen çini yerinde kalır');
  assert.ok(!s2.tertemiz);
});

test('üç çizgiyi aynı anda temizleyen dikey parça', () => {
  const t = tahtaKur(['###.####', '###.####', '###.####', BOS, BOS, BOS, BOS, '#.......']);
  const s = M.yerlestir(t, 'uclu-d', 0, 3, 1);
  assert.deepEqual(s.satirlar, [0, 1, 2]);
  assert.equal(s.cizgi, 3);
});

test('puan: kare başına 1, çizgi puanı kombo ve seriyle çarpılır, tertemiz bonusu eklenir', () => {
  assert.deepEqual(M.puanHesapla(4, 0, 0, false), { hucre: 4, cizgiPuani: 0, kombo: 0, carpan: 1, bonus: 0, toplam: 4 });
  assert.equal(M.puanHesapla(3, 1, 1, false).toplam, 3 + 20);
  assert.equal(M.puanHesapla(3, 2, 1, false).toplam, 3 + 20 * 2 * 2);
  assert.equal(M.puanHesapla(5, 3, 1, false).cizgiPuani, 20 * 3 * 3);
  assert.equal(M.puanHesapla(2, 2, 3, false).cizgiPuani, 20 * 2 * 2 * 3);
  assert.equal(M.puanHesapla(1, 1, 1, true).toplam, 1 + 20 + M.TERTEMIZ_BONUS);
});

test('seri: en geç her üç hamlede bir temizlendikçe büyür, sonra sıfırlanır', () => {
  let s = { seri: 0, bosHamle: 0 };
  s = M.seriGuncelle(s.seri, s.bosHamle, 1); assert.equal(s.seri, 1);
  s = M.seriGuncelle(s.seri, s.bosHamle, 0); assert.equal(s.seri, 1);
  s = M.seriGuncelle(s.seri, s.bosHamle, 0); assert.equal(s.seri, 1);
  s = M.seriGuncelle(s.seri, s.bosHamle, 2); assert.equal(s.seri, 2); // iki boş hamleden sonra sürer
  s = M.seriGuncelle(s.seri, s.bosHamle, 0);
  s = M.seriGuncelle(s.seri, s.bosHamle, 0);
  s = M.seriGuncelle(s.seri, s.bosHamle, 0); assert.equal(s.seri, 0); // üçüncü boş hamle bitirir
  s = M.seriGuncelle(s.seri, s.bosHamle, 1); assert.equal(s.seri, 1);
});

test('hamleUygula puanı, çizgiyi ve seriyi birlikte işler', () => {
  let d = M.yeniDurum();
  d.tahta = tahtaKur(['######..', '######..', BOS, BOS, BOS, BOS, BOS, '#.......']);
  d.tepsi = [{ sekil: 'kare-2', renk: 1 }, { sekil: 'tek', renk: 2 }, null];
  const h = M.hamleUygula(d, 0, 0, 6);
  assert.equal(h.sonuc.cizgi, 2);
  assert.equal(h.puan.toplam, 4 + 20 * 2 * 2);
  assert.equal(h.durum.puan, 84);
  assert.equal(h.durum.cizgi, 2);
  assert.equal(h.durum.seri, 1);
  assert.deepEqual(h.durum.tepsi, [null, { sekil: 'tek', renk: 2 }, null]);
  assert.equal(M.hamleUygula(h.durum, 0, 3, 3), null, 'kullanılmış yuva tekrar oynanamaz');
  assert.equal(M.hamleUygula(h.durum, 1, 7, 0), null, 'dolu hücreye konamaz');
});

test('hiçbir parça sığmayınca oyun biter', () => {
  // Dama tahtası: her boş hücre tek başına; yalnızca tek kare sığar.
  const dama = M.bosTahta().map((_, i) => ((Math.floor(i / 8) + i) % 2 ? 0 : -1));
  assert.ok(M.oyunBittiMi(dama, [{ sekil: 'ikili-y', renk: 0 }, { sekil: 'kare-2', renk: 1 }, null]));
  assert.ok(!M.oyunBittiMi(dama, [{ sekil: 'ikili-y', renk: 0 }, { sekil: 'tek', renk: 1 }, null]));
  assert.ok(!M.oyunBittiMi(dama, [null, null, null]), 'tepsi boşken yeni üçlü beklenir');
  assert.ok(!M.oyunBittiMi(M.bosTahta(), [{ sekil: 'kare-3', renk: 0 }, null, null]));

  // Son sığan parça oynanınca kalan parçalar sığmıyorsa hamle oyunu bitirir.
  const d = M.yeniDurum();
  d.tahta = dama.slice();
  d.tahta[0] = 0; d.tahta[2] = 0; // tek kare ilk satırın boş hücrelerinden birine gider
  d.tepsi = [{ sekil: 'tek', renk: 0 }, { sekil: 'kare-2', renk: 1 }, null];
  const yer = M.ilkYer(d.tahta, 'tek');
  const h = M.hamleUygula(d, 0, yer.satir, yer.sutun);
  assert.ok(h.durum.bitti, 'kalan 2×2 kare hiçbir yere sığmıyor');
});

test('klasik üreteç her zaman en az bir sığan parça verir', () => {
  const r = M.uretec(2026);
  for (let deneme = 0; deneme < 300; deneme++) {
    // Rastgele dolulukta, dolu çizgisi olmayan tahtalar
    const t = M.bosTahta().map(() => (r() < 0.25 + r() * 0.6 ? 0 : -1));
    const c = M.doluCizgiler(t);
    c.satirlar.forEach((s) => { t[s * 8 + Math.floor(r() * 8)] = -1; });
    M.doluCizgiler(t).sutunlar.forEach((s) => { t[Math.floor(r() * 8) * 8 + s] = -1; });
    const uclu = M.ucluUret(t, r, Math.floor(r() * 9000));
    assert.equal(uclu.length, 3);
    assert.ok(uclu.some((p) => M.yerVarMi(t, p.sekil)), 'üçlüden en az biri sığmalı');
    uclu.forEach((p) => { assert.ok(M.sekil(p.sekil)); assert.ok(p.renk >= 0 && p.renk < M.RENK_SAYISI); });
  }
});

test('boş tahtada klasik üçlü her zaman üçü birden yerleşebilir', () => {
  const r = M.uretec(7);
  for (let i = 0; i < 40; i++) {
    const uclu = M.ucluUret(M.bosTahta(), r, 0);
    assert.ok(M.hepsiYerlesirMi(M.bosTahta(), uclu.map((p) => p.sekil)));
  }
});

test('hepsiYerlesirMi aradaki temizlemeyi hesaba katar', () => {
  // İlk yedi satırda yalnızca son sütun boş: 3×3 kare ancak dikey parçalar satırları temizledikten sonra sığar.
  const t = tahtaKur(['#######.', '#######.', '#######.', '#######.', '#######.', '#######.', '#######.', BOS]);
  assert.ok(!M.yerVarMi(t, 'kare-3'));
  assert.ok(M.hepsiYerlesirMi(t, ['kare-3', 'dortlu-d', 'dortlu-d']));
  assert.ok(!M.hepsiYerlesirMi(t, ['kare-3', 'kare-3', 'kare-3']));
});

test('günlük modda aynı gün herkes aynı parça dizisini alır, ertesi gün değişir', () => {
  const sabah = new Date(2026, 10, 3, 0, 5);
  const gece = new Date(2026, 10, 3, 23, 55);
  const ertesi = new Date(2026, 10, 4, 0, 1);
  assert.equal(M.gunNo(sabah), M.gunNo(gece));
  assert.equal(M.gunNo(new Date(2026, 9, 20, 12)), 1);
  const dizi = (no) => Array.from({ length: 20 }, (_, tur) => M.gunlukUclu(no, tur));
  assert.deepEqual(dizi(M.gunNo(sabah)), dizi(M.gunNo(gece)));
  assert.notDeepEqual(dizi(M.gunNo(gece)), dizi(M.gunNo(ertesi)));
  // Dizi tahtadan bağımsızdır: farklı oynayan iki oyuncu da aynı sıradaki üçlüyü alır.
  let a = M.yeniDurum(), b = M.yeniDurum();
  b.tahta = tahtaKur(['####....', BOS, BOS, BOS, BOS, BOS, BOS, BOS]);
  a = M.tepsiDoldur(a, 'gunluk', { gunNo: 5 });
  b = M.tepsiDoldur(b, 'gunluk', { gunNo: 5 });
  assert.deepEqual(a.tepsi, b.tepsi);
  assert.equal(a.tur, 1);
  // Her günlük üçlüde en az bir küçük parça vardır
  for (let no = 1; no < 40; no++) {
    for (let tur = 0; tur < 30; tur++) {
      assert.ok(M.gunlukUclu(no, tur).some((p) => M.sekil(p.sekil).hucreler.length <= 3));
    }
  }
});

test('tepsiDoldur yalnızca tepsi boşken doldurur ve bitişi denetler', () => {
  const d = M.yeniDurum();
  d.tepsi = [null, { sekil: 'tek', renk: 0 }, null];
  assert.equal(M.tepsiDoldur(d, 'klasik', { rastgele: M.uretec(1) }), d);
  const bos = M.tepsiDoldur(M.yeniDurum(), 'klasik', { rastgele: M.uretec(1) });
  assert.equal(bos.tepsi.filter(Boolean).length, 3);
  assert.equal(bos.bitti, false);
});

test('paylaşım metni tasarım notundaki biçimde ve emojisiz', () => {
  const metin = M.paylasimMetni(new Date(2026, 9, 20), 1240, 14);
  assert.equal(metin, 'Çini Blok · 20 Ekim · 1240 puan · 14 çizgi');
  assert.ok(!/\p{Extended_Pictographic}/u.test(metin));
  assert.equal(M.paylasimMetni(new Date(2027, 1, 3), 0, 0), 'Çini Blok · 3 Şubat · 0 puan · 0 çizgi');
});

test('kayıtlı durum denetimi bozuk veriyi reddeder', () => {
  const d = M.tepsiDoldur(M.yeniDurum(), 'gunluk', { gunNo: 1 });
  assert.ok(M.durumGecerliMi(JSON.parse(JSON.stringify(d))));
  assert.ok(!M.durumGecerliMi(null));
  assert.ok(!M.durumGecerliMi(Object.assign({}, d, { tahta: [1, 2] })));
  assert.ok(!M.durumGecerliMi(Object.assign({}, d, { tepsi: [{ sekil: 'yok', renk: 0 }, null, null] })));
  assert.ok(!M.durumGecerliMi(Object.assign({}, d, { puan: 'çok' })));
});

test('uzun bir otomatik oyun tutarlı kalır: puan artar, oyun sonunda biter', () => {
  const r = M.uretec(99);
  let d = M.tepsiDoldur(M.yeniDurum(), 'klasik', { rastgele: r });
  let adim = 0;
  while (!d.bitti && adim < 2000) {
    const yuva = d.tepsi.findIndex((p) => p && M.yerVarMi(d.tahta, p.sekil));
    assert.ok(yuva >= 0, 'bitmemiş oyunda sığan parça olmalı');
    const yer = M.ilkYer(d.tahta, d.tepsi[yuva].sekil);
    const h = M.hamleUygula(d, yuva, yer.satir, yer.sutun);
    assert.ok(h.durum.puan > d.puan);
    d = h.durum.bitti ? h.durum : M.tepsiDoldur(h.durum, 'klasik', { rastgele: r });
    adim++;
  }
  assert.ok(d.bitti, 'açgözlü oyuncu er geç sıkışır');
  assert.ok(d.cizgi > 0);
});
