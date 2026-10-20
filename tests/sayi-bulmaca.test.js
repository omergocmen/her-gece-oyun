'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/sayi-tahmin/mantik.js');

test('+/− ipucu doğru hesaplanır', () => {
  assert.deepEqual(M.ipucu('7309', '7309'), { arti: 4, eksi: 0 });
  assert.deepEqual(M.ipucu('3709', '7309'), { arti: 2, eksi: 2 });
  assert.deepEqual(M.ipucu('1245', '7309'), { arti: 0, eksi: 0 });
  assert.deepEqual(M.ipucu('9037', '7309'), { arti: 0, eksi: 4 });
  assert.deepEqual(M.ipucu('7390', '7309'), { arti: 2, eksi: 2 });
  assert.deepEqual(M.ipucu('123', '321'), { arti: 1, eksi: 2 });
  assert.deepEqual(M.ipucu('01234', '43210'), { arti: 1, eksi: 4 });
});

test('geçersiz tahminler reddedilir', () => {
  assert.equal(M.gecersizlik('1234', 4), null);
  assert.equal(M.gecersizlik('0123', 4), null);
  assert.match(M.gecersizlik('1123', 4), /farklı/);
  assert.match(M.gecersizlik('123', 4), /4 hane/);
  assert.match(M.gecersizlik('12a4', 4), /rakam/);
  assert.equal(M.gecersizlik('987', 3), null);
});

test('gizli sayı her seviyede farklı rakamlı ve istenirse 0 ile başlamaz', () => {
  for (const hane of M.SEVIYELER) {
    const r = M.uretec(hane * 7919);
    for (let i = 0; i < 500; i++) {
      const s = M.gizliUret(hane, r, false);
      assert.equal(s.length, hane);
      assert.equal(new Set(s).size, hane, `${s} tekrarlı rakam içeriyor`);
      assert.notEqual(s[0], '0', `${s} 0 ile başlıyor`);
    }
  }
  // Ayar açıkken 0 ile başlayan sayılar da üretilebilir
  const r = M.uretec(42);
  const sifirla = Array.from({ length: 500 }, () => M.gizliUret(4, r, true)).filter((s) => s[0] === '0');
  assert.ok(sifirla.length > 0);
});

test('günlük modda aynı gün herkes aynı sayıyı alır, ertesi gün değişir', () => {
  const sabah = new Date(2026, 10, 3, 0, 5);
  const gece = new Date(2026, 10, 3, 23, 55);
  const ertesi = new Date(2026, 10, 4, 0, 1);
  assert.equal(M.gununSayisi(sabah), M.gununSayisi(gece));
  assert.notEqual(M.gununSayisi(gece), M.gununSayisi(ertesi));
  assert.equal(M.gununSayisi(sabah).length, M.GUNLUK_HANE);
  assert.equal(M.bulmacaNo(new Date(2026, 9, 20, 12)), 1);
  // 60 günde sayılar çoğunlukla farklıdır
  const sayilar = new Set(Array.from({ length: 60 }, (_, i) => M.gununSayisi(new Date(2026, 9, 20 + i))));
  assert.ok(sayilar.size > 55);
});

test('istatistik: ortalama, en iyi ve dağılım; günlük seri ardışık günlerde artar', () => {
  let ist = M.yeniIstatistik();
  ist = M.istatistikIsle(ist, 6, 1);
  ist = M.istatistikIsle(ist, 4, 2);
  ist = M.istatistikIsle(ist, 4, 2); // aynı gün ikinci kez sayılmaz
  assert.equal(ist.oynanan, 2);
  assert.equal(ist.seri, 2);
  ist = M.istatistikIsle(ist, 12, null); // serbest tur seriyi etkilemez
  assert.equal(ist.seri, 2);
  ist = M.istatistikIsle(ist, 5, 4); // bir gün atlandı
  assert.equal(ist.seri, 1);
  assert.equal(ist.enIyiSeri, 2);
  assert.equal(ist.oynanan, 4);
  assert.equal(ist.toplamDeneme, 6 + 4 + 12 + 5);
  assert.equal(ist.enIyi, 4);
  assert.deepEqual(ist.dagilim, [0, 0, 0, 1, 1, 1, 0, 0, 0, 1]);
});

test('paylaşım metni +/− satırlarını içerir, emoji ve gizli sayı içermez', () => {
  const metin = M.paylasimMetni(7, 4, ['1234', '3709', '7309'], '7309');
  assert.equal(metin, 'Sayı Bulmaca #7 · 4 hane · 3 deneme\n\n+0 −1\n+2 −2\n+4 −0');
  assert.ok(!/\p{Extended_Pictographic}/u.test(metin));
  assert.equal(M.paylasimMetni(null, 5, ['12345'], '67890').split('\n')[0], 'Sayı Bulmaca · serbest · 5 hane · 1 deneme');
});

test('rakam işareti normal → yok → var → yeri belli → normal döner', () => {
  assert.equal(M.sonrakiIsaret(undefined), 'yok');
  assert.equal(M.sonrakiIsaret('yok'), 'var');
  assert.equal(M.sonrakiIsaret('var'), 'yeri');
  assert.equal(M.sonrakiIsaret('yeri'), 'normal');
});
