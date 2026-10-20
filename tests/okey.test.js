'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/okey/mantik.js');

// Taş kurucu: renk 0-3 (kırmızı, sarı, mavi, siyah), sayı 1-13, kopya 0-1.
const T = (r, s, k = 0) => r * 26 + (s - 1) * 2 + k;
const SAHTE1 = 104, SAHTE2 = 105;
// Okey sarı 8 olsun: gösterge sarı 7.
const GOSTERGE = T(1, 7);
const OKEY = M.okeyBelirle(GOSTERGE);
const J1 = T(1, 8, 0), J2 = T(1, 8, 1); // iki gerçek okey (joker)
const AYAR = { seviye: 'orta', eller: 3, cifte: true, okeyAtarak: true };

test('takım: 106 taş, 4 renk × 13 sayı × 2 + 2 sahte okey', () => {
  const l = M.tamTakim();
  assert.equal(l.length, 106);
  assert.equal(new Set(l).size, 106);
  const sayac = {};
  for (const id of l.filter((i) => !M.sahteMi(i))) {
    const k = M.renkOf(id) * 14 + M.sayiOf(id);
    sayac[k] = (sayac[k] || 0) + 1;
  }
  assert.equal(Object.keys(sayac).length, 52);
  assert.ok(Object.values(sayac).every((n) => n === 2));
  assert.equal(l.filter(M.sahteMi).length, 2);
});

test('okey belirleme: gösterge + 1, 13 göstergesinde okey 1 olur', () => {
  assert.deepEqual(M.okeyBelirle(T(0, 4)), { renk: 0, sayi: 5 });
  assert.deepEqual(M.okeyBelirle(T(3, 12)), { renk: 3, sayi: 13 });
  assert.deepEqual(M.okeyBelirle(T(2, 13)), { renk: 2, sayi: 1 });
  assert.throws(() => M.okeyBelirle(SAHTE1));
});

test('okey ve sahte okey: gerçek okey joker, sahte okey okeyin yüzünü taşır ama joker değildir', () => {
  assert.equal(M.jokerMi(J1, OKEY), true);
  assert.equal(M.jokerMi(J2, OKEY), true);
  assert.equal(M.jokerMi(SAHTE1, OKEY), false);
  assert.equal(M.jokerMi(GOSTERGE, OKEY), false);
  const y = M.yuz(SAHTE1, OKEY);
  assert.equal(y.sahte, true);
  assert.equal(y.r, 1);
  assert.equal(y.s, 8);
  // sahte okey, okey yüzlü 8'in yerine geçer: sarı 7-8(sahte)-9 geçerli seridir
  assert.equal(M.grupTuru([T(1, 7), SAHTE1, T(1, 9)], OKEY), 'seri');
  // ama sahte okey başka sayının yerine geçmez
  assert.equal(M.grupTuru([T(1, 7), SAHTE1, T(1, 10)], OKEY), null);
});

test('per: aynı sayı, farklı renkler, 3-4 taş', () => {
  assert.equal(M.grupTuru([T(0, 5), T(1, 5), T(2, 5)], OKEY), 'per');
  assert.equal(M.grupTuru([T(0, 5), T(1, 5), T(2, 5), T(3, 5)], OKEY), 'per');
  assert.equal(M.grupTuru([T(0, 5), T(0, 5, 1), T(2, 5)], OKEY), null, 'aynı renk iki kez olmaz');
  assert.equal(M.grupTuru([T(0, 5), T(1, 5)], OKEY), null, 'iki taş per değildir');
  assert.equal(M.grupTuru([T(0, 5), T(1, 5), T(2, 5), T(3, 5), J1], OKEY), null, 'beş taşlık per olmaz');
  assert.equal(M.grupTuru([T(0, 5), T(1, 5), J1], OKEY), 'per', 'okey eksik rengin yerine geçer');
  assert.equal(M.grupTuru([T(0, 5), T(1, 6), T(2, 5)], OKEY), null);
});

test('seri: aynı renk ardışık; 12-13-1 geçerli, 13-1-2 geçersiz', () => {
  assert.equal(M.grupTuru([T(0, 3), T(0, 4), T(0, 5)], OKEY), 'seri');
  assert.equal(M.grupTuru([T(3, 1), T(3, 2), T(3, 3), T(3, 4)], OKEY), 'seri');
  assert.equal(M.grupTuru([T(2, 12), T(2, 13), T(2, 1)], OKEY), 'seri');
  assert.equal(M.grupTuru([T(2, 11), T(2, 12), T(2, 13), T(2, 1)], OKEY), 'seri');
  assert.equal(M.grupTuru([T(2, 13), T(2, 1), T(2, 2)], OKEY), null);
  assert.equal(M.grupTuru([T(2, 5), T(2, 6)], OKEY), null);
  assert.equal(M.grupTuru([T(2, 5), T(2, 6), T(1, 7)], OKEY), null, 'renk karışmaz');
  assert.equal(M.grupTuru([T(2, 5), T(2, 5, 1), T(2, 6)], OKEY), null, 'tekrarlı sayı olmaz');
  assert.equal(M.grupTuru([T(2, 5), T(2, 7), T(2, 9)], OKEY), null, 'boşluk jokersiz olmaz');
});

test('seri: okey boşluğu ve uçları doldurur', () => {
  assert.equal(M.grupTuru([T(2, 5), J1, T(2, 7)], OKEY), 'seri');
  assert.equal(M.grupTuru([J1, T(2, 5), T(2, 6)], OKEY), 'seri');
  assert.equal(M.grupTuru([T(2, 5), T(2, 6), J1, J2], OKEY), 'seri');
  assert.equal(M.grupTuru([T(2, 12), J1, T(2, 1)], OKEY), 'seri', '12-okey(13)-1');
  assert.equal(M.grupTuru([T(2, 5), J1, T(2, 9)], OKEY), null, 'iki boşluk tek okeyle kapanmaz');
  assert.equal(M.grupTuru([T(2, 5), J1, T(2, 8)], OKEY), null);
});

test('el bitirme: 14 taşlık geçerli bölmeler', () => {
  const el = [
    T(0, 1), T(0, 2), T(0, 3), // seri
    T(1, 9), T(2, 9), T(3, 9), // per
    T(3, 10), T(3, 11), T(3, 12), T(3, 13), // dört taşlık seri
    T(2, 4), T(2, 5), T(2, 6), T(2, 7) // seri
  ];
  assert.equal(el.length, 14);
  const g = M.perlereBol(el, OKEY);
  assert.ok(g);
  assert.equal(g.reduce((a, x) => a + x.taslar.length, 0), 14);
  g.forEach((x) => assert.equal(M.grupTuru(x.taslar, OKEY), x.tur));
  assert.equal(M.bitisTuru(el, OKEY, AYAR), 'normal');
});

test('el bitirme: okey joker olarak iki ayrı per için kullanılabilir (hangisine gerekirse)', () => {
  const el = [
    T(0, 1), T(0, 2), J1, // seri (okey 3)
    T(1, 9), T(2, 9), J2, // per (okey 9)
    T(3, 10), T(3, 11), T(3, 12), // seri
    T(2, 4), T(2, 5), T(2, 6), T(2, 7), T(2, 8) // seri
  ];
  assert.equal(el.length, 14);
  assert.ok(M.perlereBol(el, OKEY));
});

test('el bitirme: bölünemeyen eller reddedilir', () => {
  const el = [
    T(0, 1), T(0, 2), T(0, 4), // 3 yok
    T(1, 9), T(2, 9), T(3, 9),
    T(3, 10), T(3, 11), T(3, 12), T(3, 13),
    T(2, 4), T(2, 5), T(2, 6), T(2, 7)
  ];
  assert.equal(M.perlereBol(el, OKEY), null);
  assert.equal(M.bitisTuru(el, OKEY, AYAR), null);
  // 13 taş bölünse bile 14 gerekli
  assert.equal(M.bitisTuru(el.slice(0, 13), OKEY, AYAR), null);
});

test('el bitirme: tek okey ile geçen ama sahte okey ile geçmeyen el', () => {
  const taban = [
    T(0, 1), T(0, 2), T(0, 3),
    T(1, 9), T(2, 9), T(3, 9),
    T(3, 10), T(3, 11), T(3, 12), T(3, 13),
    T(2, 4), T(2, 5), T(2, 6)
  ];
  assert.ok(M.perlereBol(taban.concat([T(2, 7)]), OKEY));
  // joker 7'nin yerine geçer
  assert.ok(M.perlereBol(taban.concat([J1]), OKEY));
  // sahte okey yalnızca sarı 8 yerine geçer, burada işe yaramaz
  assert.equal(M.perlereBol(taban.concat([SAHTE1]), OKEY), null);
});

test('el bitirme: yarıya bölünen uzun seri ve iki ardışık okey', () => {
  const el = [
    T(0, 1), T(0, 2), T(0, 3), T(0, 4), T(0, 5), T(0, 6), T(0, 7), // yedi taş seri
    T(1, 1), T(2, 1), J1, // per (okey)
    T(3, 5), T(3, 6), J2, T(3, 8) // 5-6-J-8
  ];
  assert.equal(el.length, 14);
  assert.ok(M.perlereBol(el, OKEY));
});

test('okey bitirmeyi hiç bozmaz: 14 taş + 2 okey, hepsi okey yerine geçecek durumda', () => {
  const el = [T(0, 1), T(0, 2), T(0, 3), T(0, 4), T(1, 5), T(2, 5), T(3, 5), T(0, 9), T(0, 10), T(0, 11), J1, J2, T(3, 1), T(3, 2)];
  assert.equal(el.length, 14);
  const g = M.perlereBol(el, OKEY);
  assert.ok(g, 'tüm taşlar gruplanmalı');
  assert.equal(g.reduce((a, x) => a + x.taslar.length, 0), 14);
});

test('çifte gitme: 7 çift, okey tek taşla eşleşir', () => {
  const yedi = [T(0, 1), T(0, 1, 1), T(0, 3), T(0, 3, 1), T(1, 5), T(1, 5, 1), T(2, 7), T(2, 7, 1),
    T(3, 9), T(3, 9, 1), T(3, 11), T(3, 11, 1), T(2, 13), T(2, 13, 1)];
  assert.equal(M.cifteMi(yedi, OKEY), true);
  assert.equal(M.bitisTuru(yedi, OKEY, AYAR), 'cifte');
  // kapalıysa çifte sayılmaz (bu elin seri/per bölmesi yoktur)
  assert.equal(M.bitisTuru(yedi, OKEY, { ...AYAR, cifte: false }), null);
  // bir çiftin yarısı okeyle tamamlanır
  const okeyli = yedi.slice(0, 13).concat([J1]);
  assert.equal(M.cifteMi(okeyli, OKEY), true);
  // iki okey: iki tek taşı tamamlar
  const iki = [T(0, 1), T(0, 1, 1), T(0, 3), T(0, 3, 1), T(1, 5), T(1, 5, 1), T(2, 7), T(2, 7, 1),
    T(3, 9), T(3, 9, 1), T(3, 11), T(3, 12), J1, J2];
  assert.equal(M.cifteMi(iki, OKEY), true);
  // iki tek taş okeysiz: çifte değil
  const olmaz = yedi.slice(0, 12).concat([T(0, 5), T(0, 6)]);
  assert.equal(M.cifteMi(olmaz, OKEY), false);
  // sahte okey joker değil, okeyin yüzünü taşıyan normal taştır: iki sahte okey bir çift olur
  const sahteli = yedi.slice(0, 12).concat([SAHTE1, SAHTE2]);
  assert.equal(M.cifteMi(sahteli, OKEY), true);
  // tek sahte okey bir tek taştır: okeyle ya da başka sahteyle eşleşir, yoksa çifte bozulur
  assert.equal(M.cifteMi(yedi.slice(0, 12).concat([SAHTE1, T(0, 8)]), OKEY), false);
  assert.equal(M.cifteMi(yedi.slice(0, 12).concat([SAHTE1, J1]), OKEY), true);
});

test('bitiş adayları: atılacak taşı bulur, okey atarak bitirme ayara bağlıdır', () => {
  const tam14 = [
    T(0, 1), T(0, 2), T(0, 3),
    T(1, 9), T(2, 9), T(3, 9),
    T(3, 10), T(3, 11), T(3, 12), T(3, 13),
    T(2, 4), T(2, 5), T(2, 6), T(2, 7)
  ];
  const el15 = tam14.concat([T(0, 13)]);
  const a = M.bitisAdaylari(el15, OKEY, AYAR);
  assert.ok(a.some((x) => x.id === T(0, 13)));
  assert.equal(a.find((x) => x.id === T(0, 13)).puan, 1);
  // okey atarak bitirme: 14 taş + okey fazlası
  const jokerli = tam14.concat([J1]);
  const b = M.bitisAdaylari(jokerli, OKEY, AYAR);
  const okeyAdayi = b.find((x) => x.id === J1);
  assert.ok(okeyAdayi, 'okey atılarak bitebilir');
  assert.equal(okeyAdayi.okeyle, true);
  assert.equal(okeyAdayi.puan, 2);
  assert.ok(!M.bitisAdaylari(jokerli, OKEY, { ...AYAR, okeyAtarak: false }).some((x) => x.id === J1));
});

test('puanlama: normal 1, çifte 2, okey atarak ×2, ikisi birden 4', () => {
  assert.equal(M.elPuani('normal', false), 1);
  assert.equal(M.elPuani('cifte', false), 2);
  assert.equal(M.elPuani('normal', true), 2);
  assert.equal(M.elPuani('cifte', true), 4);
  assert.equal(M.macKazanani([3, 5, 2, 0]), 1);
  assert.equal(M.macKazanani([4, 4, 1, 0]), -1);
});

test('dağıtım: starter 15, diğerleri 14 taş, desteden gösterge çıkar, 106 taş eksiksiz', () => {
  const d = M.yeniEl(12345, 2);
  assert.deepEqual(d.eller.map((e) => e.length), [14, 14, 15, 14]);
  assert.equal(d.sira, 2);
  assert.equal(d.faz, 'at');
  assert.equal(d.deste.length, 106 - 57 - 1);
  const hepsi = [].concat(...d.eller, d.deste, [d.gosterge]);
  assert.equal(new Set(hepsi).size, 106);
  assert.equal(M.sahteMi(d.gosterge), false);
  assert.deepEqual(d.okey, M.okeyBelirle(d.gosterge));
});

test('tohumlu dağıtım deterministik; günlük tohum aynı günde aynı, farklı günde farklı', () => {
  assert.deepEqual(M.yeniEl(99, 0), M.yeniEl(99, 0));
  assert.notDeepEqual(M.yeniEl(99, 0).eller, M.yeniEl(100, 0).eller);
  assert.equal(M.gunTohumu('2026-10-20'), M.gunTohumu('2026-10-20'));
  assert.notEqual(M.gunTohumu('2026-10-20'), M.gunTohumu('2026-10-21'));
  assert.deepEqual(M.yeniEl(M.gunTohumu('2026-10-20'), 0).eller, M.yeniEl(M.gunTohumu('2026-10-20'), 0).eller);
});

test('motor: çekme, atma, sıra saat yönünde ve önceki oyuncunun ıskartası alınır', () => {
  const d = M.yeniEl(7, 0);
  const ilk = d.eller[0][0];
  // başlayan çekmez, atar
  assert.equal(M.cek(d, 'deste'), null);
  const sonuc = M.at(d, ilk, AYAR);
  assert.equal(sonuc.ok, true);
  assert.equal(d.sira, 1);
  assert.equal(d.faz, 'cek');
  assert.deepEqual(d.atik[0], [ilk]);
  // 1. oyuncu 0'ın taşını alır
  const alinan = M.cek(d, 'iskarta');
  assert.equal(alinan, ilk);
  assert.equal(d.atik[0].length, 0);
  assert.equal(d.eller[1].length, 15);
  assert.equal(d.faz, 'at');
  // aldığı taşı geri atamaz
  assert.equal(M.at(d, ilk, AYAR).hata, 'yasak');
  // desteden çekmek
  const d2 = M.yeniEl(7, 0);
  M.at(d2, d2.eller[0][0], AYAR);
  const ustDeste = d2.deste[0];
  assert.equal(M.cek(d2, 'deste'), ustDeste);
  assert.equal(d2.deste.length, 48 - 1);
  // sahip olmadığı taşı atamaz
  assert.equal(M.at(d2, d2.eller[0][0], AYAR).ok, false);
});

test('motor: geçerli eli bırakan taş atılınca el biter; deste bitince berabere', () => {
  const d = M.yeniEl(3, 0);
  const tam14 = [
    T(0, 1), T(0, 2), T(0, 3), T(1, 9), T(2, 9), T(3, 9),
    T(3, 10), T(3, 11), T(3, 12), T(3, 13), T(2, 4), T(2, 5), T(2, 6), T(2, 7)
  ];
  d.okey = OKEY;
  d.eller[0] = tam14.concat([T(0, 13)]);
  const r = M.at(d, T(0, 13), AYAR);
  assert.equal(r.bitti, true);
  assert.equal(d.bitti.kazanan, 0);
  assert.equal(d.bitti.tur, 'normal');
  assert.equal(d.bitti.puan, 1);
  // deste bitti
  const e = M.yeniEl(4, 1);
  e.deste = [];
  M.at(e, e.eller[1].find((id) => true), AYAR);
  assert.equal(e.bitti.kazanan, -1);
  assert.equal(e.bitti.tur, 'berabere');
});

test('motor: durum JSON ile gidip gelir ve oyun kaldığı yerden aynı sürer', () => {
  const sev = ['orta', 'orta', 'orta', 'orta'], stil = ['temkinli', 'saldirgan', 'cifteci', 'temkinli'];
  const tam = M.simule(sev, stil, 31337, AYAR, 0);
  // yarıya kadar oyna, kopyala, devam ettir
  const d = M.yeniEl(31337, 0);
  const adim = (x) => {
    const p = x.sira;
    if (x.faz === 'cek') {
      const k = M.yzAl(M.gorunum(x, p), AYAR, sev[p], stil[p], M.karma(31337, x.hamle, p, 1));
      if (M.cek(x, k) === null) M.cek(x, 'deste');
    }
    const k2 = M.yzAt(M.gorunum(x, p), AYAR, sev[p], stil[p], M.karma(31337, x.hamle, p, 2));
    M.at(x, k2.at, AYAR);
  };
  for (let i = 0; i < 10 && !d.bitti; i++) adim(d);
  const kopya = JSON.parse(JSON.stringify(d));
  while (!kopya.bitti) adim(kopya);
  assert.deepEqual(kopya.bitti, tam.bitti);
  assert.equal(kopya.hamle, tam.hamle);
});

test('istaka dizme: Seri diz tüm taşları 16 yuvaya koyar ve grupları bitişik tutar', () => {
  const d = M.yeniEl(55, 0);
  for (const el of [d.eller[0], d.eller[1]]) {
    const yuvalar = M.seriDiz(el, d.okey);
    assert.equal(yuvalar.length, 16);
    assert.deepEqual(yuvalar.filter((x) => x !== null).sort((a, b) => a - b), el.slice().sort((a, b) => a - b));
  }
  // bilinen bir el: gruplar ardışık yuvalarda
  const el = [
    T(0, 1), T(0, 2), T(0, 3), T(1, 9), T(2, 9), T(3, 9), T(3, 10), T(3, 11), T(3, 12), T(3, 13),
    T(2, 4), T(2, 5), T(2, 6), T(2, 7), T(0, 13)
  ];
  const y = M.seriDiz(el, OKEY);
  const e = M.enIyiDizilis(el, OKEY);
  assert.equal(e.kapsanan, 14);
  assert.equal(e.artan.length, 1);
  // her grubun taşları aynı satırda ve ardışık
  e.gruplar.forEach((g) => {
    const konumlar = g.taslar.map((id) => y.indexOf(id)).sort((a, b) => a - b);
    assert.equal(konumlar[konumlar.length - 1] - konumlar[0], konumlar.length - 1, 'grup bitişik');
  });
});

test('Çift diz: çiftler yan yana', () => {
  const el = [T(0, 1), T(0, 1, 1), T(0, 3), T(1, 5), T(1, 5, 1), T(2, 7), T(2, 7, 1), T(3, 9), T(3, 9, 1), T(3, 11), T(3, 11, 1), T(2, 13), T(2, 13, 1), T(0, 8)];
  const y = M.ciftDiz(el, OKEY);
  assert.equal(y.filter((x) => x !== null).length, 14);
  const c = M.ciftGruplari(el, OKEY);
  assert.equal(c.ciftler.length, 6);
  c.ciftler.forEach(([a, b]) => assert.equal(Math.abs(y.indexOf(a) - y.indexOf(b)), 1));
});

test('en iyi dizilim: kapsanan taş sayısı doğru, okey grupları birleştirir', () => {
  const e = M.enIyiDizilis([T(0, 1), T(0, 2), T(0, 3), T(1, 5), T(2, 9)], OKEY);
  assert.equal(e.kapsanan, 3);
  assert.equal(e.artan.length, 2);
  const j = M.enIyiDizilis([T(0, 1), T(0, 2), J1, T(1, 5), T(2, 9)], OKEY);
  assert.equal(j.kapsanan, 3);
});

test('bilgisayar: bitiren taşı bulur, tamamlayan ıskartayı alır, aldığı taşı geri atmaz', () => {
  const tam14 = [
    T(0, 1), T(0, 2), T(0, 3), T(1, 9), T(2, 9), T(3, 9),
    T(3, 10), T(3, 11), T(3, 12), T(3, 13), T(2, 4), T(2, 5), T(2, 6), T(2, 7)
  ];
  const g = { oyuncu: 0, el: tam14.concat([T(0, 13)]), okey: OKEY, gosterge: GOSTERGE, atik: [[], [], [], []], alinan: [[], [], [], []], yasak: null, desteSayisi: 30 };
  for (const sev of ['orta', 'zor']) {
    const k = M.yzAt(g, AYAR, sev, 'saldirgan', 1);
    assert.equal(k.bitis, true);
    assert.equal(k.at, T(0, 13));
  }
  // önceki oyuncunun (3) ıskartası eli tamamlıyor
  const eksik = tam14.filter((id) => id !== T(2, 7));
  const g2 = { oyuncu: 0, el: eksik.concat([T(0, 12)]).slice(0, 14), okey: OKEY, gosterge: GOSTERGE, atik: [[], [], [], [T(2, 7)]], alinan: [[], [], [], []], yasak: null, desteSayisi: 30 };
  g2.el = eksik.concat([T(0, 11)]); // 14 taş: bir fazlalık ile tek eksik T(2,7)
  assert.equal(g2.el.length, 14);
  for (const sev of ['orta', 'zor']) assert.equal(M.yzAl(g2, AYAR, sev, 'temkinli', 2), 'iskarta');
  // işe yaramaz ıskarta alınmaz
  const g3 = { ...g2, atik: [[], [], [], [T(3, 3)]] };
  assert.equal(M.yzAl(g3, AYAR, 'orta', 'temkinli', 2), 'deste');
  // yasak taş atılmaz
  const g4 = { ...g, el: tam14.concat([T(0, 13)]), yasak: T(0, 13) };
  assert.notEqual(M.yzAt(g4, AYAR, 'orta', 'temkinli', 1).at, T(0, 13));
  // okeyi (joker) boş yere atmaz
  const el = [T(0, 1), T(0, 2), T(0, 3), T(1, 9), T(2, 9), J1, T(3, 10), T(3, 11), T(3, 12), T(2, 4), T(2, 5), T(0, 13), T(3, 2), T(1, 3), T(2, 12)];
  const gj = { ...g, el, yasak: null };
  assert.notEqual(M.yzAt(gj, AYAR, 'zor', 'temkinli', 3).at, J1);
  assert.notEqual(M.yzAt(gj, AYAR, 'orta', 'saldirgan', 3).at, J1);
});

test('çifteci rakip yedi çifte yaklaşan elde çift peşinde gider', () => {
  const el = [T(0, 1), T(0, 1, 1), T(0, 3), T(0, 3, 1), T(1, 5), T(1, 5, 1), T(2, 7), T(2, 7, 1), T(3, 9), T(3, 9, 1), T(3, 11), T(3, 12), T(0, 8), T(2, 2), T(1, 13)];
  const g = { oyuncu: 0, el, okey: OKEY, gosterge: GOSTERGE, atik: [[], [], [], []], alinan: [[], [], [], []], yasak: null, desteSayisi: 30 };
  const k = M.yzAt(g, AYAR, 'orta', 'cifteci', 4);
  // çiftlerden birini bozmaz
  const kalan = el.filter((id) => id !== k.at);
  assert.ok(M.ciftSayisi(kalan, OKEY) >= 5, 'çift sayısı korunur');
  // çifte açıkken çiftle eşleşen ıskarta alınır
  const g2 = { ...g, el: el.filter((id) => id !== T(3, 11) && id !== T(1, 13) && id !== T(0, 8)).concat([T(0, 8), T(1, 13)]).slice(0, 14), atik: [[], [], [], [T(0, 8, 1)]] };
  assert.equal(M.yzAl(g2, AYAR, 'orta', 'cifteci', 4), 'iskarta');
});

test('bilgisayar hamlesi hızlıdır: kararlar milisaniyeler içinde (en kötü durum < 250 ms)', () => {
  let enKotu = 0;
  for (let s = 1; s <= 40; s++) {
    const d = M.yeniEl(s * 31, s % 4);
    for (let p = 0; p < 4; p++) {
      const g = M.gorunum(d, p);
      for (const sev of ['kolay', 'orta', 'zor']) {
        const t0 = process.hrtime.bigint();
        if (g.el.length === 15) M.yzAt(g, AYAR, sev, 'temkinli', s);
        else M.yzAl({ ...g, atik: [[], [], [], [T(0, 5)]] }, AYAR, sev, 'saldirgan', s);
        enKotu = Math.max(enKotu, Number(process.hrtime.bigint() - t0) / 1e6);
      }
    }
  }
  assert.ok(enKotu < 250, `en yavaş karar ${enKotu.toFixed(1)} ms`);
});

test('simülasyon: bir el biter; Zor seviye Kolay seviyeyi belirgin yener', () => {
  const stiller = ['temkinli', 'saldirgan', 'cifteci', 'temkinli'];
  // Koltuklar 0 ve 2 Zor, 1 ve 3 Kolay; her koltuğun başlama avantajı dengelenir.
  const sev = ['zor', 'kolay', 'zor', 'kolay'];
  let zor = 0, kolay = 0, beraberlik = 0;
  const N = 60;
  for (let s = 1; s <= N; s++) {
    const d = M.simule(sev, stiller, s * 7919, AYAR, s % 4);
    assert.ok(d.bitti, 'el sonlanmalı');
    if (d.bitti.kazanan < 0) beraberlik++;
    else if (sev[d.bitti.kazanan] === 'zor') zor++; else kolay++;
  }
  assert.ok(zor >= kolay * 1.5, `Zor ${zor} - Kolay ${kolay} (berabere ${beraberlik})`);
});

test('simülasyon: bitiş her zaman geçerli bir el bırakır', () => {
  for (let s = 1; s <= 25; s++) {
    const d = M.simule(['orta', 'orta', 'orta', 'orta'], ['temkinli', 'saldirgan', 'cifteci', 'temkinli'], s * 101, AYAR, s % 4);
    if (d.bitti.kazanan < 0) continue;
    assert.equal(d.bitti.el.length, 14);
    assert.ok(M.bitisTuru(d.bitti.el, d.okey, AYAR), 'kazanan el geçerli per/seri ya da çifte');
    assert.equal(d.bitti.puan, M.elPuani(d.bitti.tur, d.bitti.okeyle));
  }
});
