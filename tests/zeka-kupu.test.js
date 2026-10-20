'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/zeka-kupu/mantik.js');
const C = require('../games/zeka-kupu/cozucu.js');

function tumHamleler(n) {
  const s = [];
  for (let a = 0; a < 3; a++) {
    for (let k = -(n - 1); k <= n - 1; k += 2) {
      s.push({ a, k, d: 1 }, { a, k, d: -1 });
    }
  }
  return s;
}

test('çözülmüş küp doğru sayıda çıkartma içerir ve çözülmüş algılanır', () => {
  for (const n of M.BOYUTLAR) {
    const d = M.cozulmus(n);
    assert.equal(d.c.length, 6 * n * n);
    assert.ok(M.cozulduMu(d));
  }
});

test('her hamle ve tersi kimlik verir', () => {
  for (const n of M.BOYUTLAR) {
    const imza = M.imza(M.cozulmus(n));
    for (const h of tumHamleler(n)) {
      const d = M.cozulmus(n);
      M.uygula(d, h);
      M.uygula(d, M.ters(h));
      assert.equal(M.imza(d), imza);
    }
  }
});

test('aynı hamle dört kez kimlik verir, bir kez dış katmanda küpü bozar', () => {
  for (const n of M.BOYUTLAR) {
    const imza = M.imza(M.cozulmus(n));
    for (const h of tumHamleler(n)) {
      const d = M.cozulmus(n);
      M.uygula(d, h);
      if (Math.abs(h.k) === n - 1) assert.ok(!M.cozulduMu(d), 'dış katman hamlesi küpü bozmalı');
      M.uygula(d, h); M.uygula(d, h); M.uygula(d, h);
      assert.equal(M.imza(d), imza);
    }
  }
});

test('3×3 orta katman döndürülünce de çözülmüş sayılır', () => {
  const d = M.cozulmus(3);
  M.uygula(d, { a: 0, k: -2, d: 1 });
  M.uygula(d, { a: 0, k: 0, d: 1 });
  M.uygula(d, { a: 0, k: 2, d: 1 });
  assert.ok(M.cozulduMu(d));
});

test('notasyon: R yüzü saat yönünde döner, ön yüzü üste taşır', () => {
  const d = M.hepsiniUygula(M.cozulmus(3), M.coz('R', 3));
  const ustSagOn = d.c.find((s) => s.x === 2 && s.y === 2 && s.z === 2 && s.ny === 1);
  assert.equal(ustSagOn.c, M.YUZ_RENGI[4], 'R sonrası üstte ön yüzün rengi olmalı');
  // Sexy move altı kez kimliktir.
  const k = M.cozulmus(3);
  for (let i = 0; i < 6; i++) M.hepsiniUygula(k, M.coz("R U R' U'", 3));
  assert.ok(M.cozulduMu(k));
  assert.equal(M.coz('U2', 3).length, 2);
});

test('karıştırma geçerli hamlelerden oluşur ve tersiyle çözülür', () => {
  for (const n of M.BOYUTLAR) {
    for (let tohum = 1; tohum <= 30; tohum++) {
      const dizi = M.karistir(n, M.uretec(tohum * 7919 + n));
      assert.ok(dizi.length >= 11);
      for (let i = 1; i < dizi.length; i++) {
        const ayni = dizi[i].a === dizi[i - 1].a;
        // Aynı eksen yalnızca yarım dönüşün iki çeyreği olarak gelebilir.
        if (ayni) assert.deepEqual(dizi[i], dizi[i - 1]);
      }
      const d = M.hepsiniUygula(M.cozulmus(n), dizi);
      assert.ok(!M.cozulduMu(d), 'karıştırma küpü bozmalı');
      M.hepsiniUygula(d, M.tersDizi(dizi));
      assert.ok(M.cozulduMu(d));
    }
  }
});

test('günlük karıştırma aynı gün ve boyut için aynıdır', () => {
  assert.deepEqual(M.gununKaristirmasi(5, 3), M.gununKaristirmasi(5, 3));
  assert.notDeepEqual(M.gununKaristirmasi(5, 3), M.gununKaristirmasi(6, 3));
  assert.equal(M.gunNo(new Date(2026, 9, 20, 23, 59)), 1);
  assert.equal(M.gunNo(new Date(2026, 9, 21, 0, 1)), 2);
});

test('sadeleştirme ardışık hamleleri birleştirir', () => {
  const R = M.coz('R', 3)[0];
  assert.deepEqual(M.sadelestir([R, M.ters(R)]), []);
  assert.equal(M.sadelestir([R, R, R]).length, 1);
  assert.equal(M.sadelestir([R, R, R])[0].d, -R.d);
  assert.equal(M.sadelestir(M.coz("R U U' R'", 3)).length, 0);
});

test('hamle adları standart notasyona uyar', () => {
  for (const ad of ['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'B', "B'"]) {
    assert.equal(M.hamleAdi(M.coz(ad, 3)[0], 3), ad);
  }
  assert.equal(M.hamleAdi({ a: 0, k: 0, d: 1 }, 3), 'M');
  assert.equal(M.hamleAdi({ a: 1, k: 0, d: 1 }, 3), 'E');
  assert.equal(M.hamleAdi({ a: 2, k: 0, d: -1 }, 3), 'S');
  assert.equal(M.hamleAdi({ a: 0, k: 1, d: -1 }, 4), '2R');
  // Görünüm: önde dünya +x yüzü varken R = dünya -z yüzü.
  const gorunum = { F: 0, B: 1, U: 2, D: 3, R: 5, L: 4 };
  assert.equal(M.hamleAdi(M.yuzHamlesi('F', 3, ''), 3, gorunum), 'L');
});

test('3×3 çözücü rastgele karıştırmaları çözer', () => {
  for (let tohum = 1; tohum <= 60; tohum++) {
    const d = M.hepsiniUygula(M.cozulmus(3), M.karistir(3, M.uretec(tohum * 104729)));
    const sonuc = C.coz(d);
    assert.ok(sonuc.basarili, `tohum ${tohum}: çözülemedi`);
    M.hepsiniUygula(d, sonuc.hamleler);
    assert.ok(M.cozulduMu(d), `tohum ${tohum}: çözüm küpü çözmedi`);
    assert.equal(sonuc.adimlar.length, 7);
  }
});

test('çözücü orta katmanı döndürülmüş küpü de çözer ve çözülmüşte boş döner', () => {
  const d = M.hepsiniUygula(M.cozulmus(3), [{ a: 0, k: 0, d: 1 }].concat(M.coz("R U F' D2 L B", 3)));
  const sonuc = C.coz(d);
  assert.ok(sonuc.basarili);
  assert.ok(M.cozulduMu(M.hepsiniUygula(d, sonuc.hamleler)));
  assert.equal(C.coz(M.cozulmus(3)).hamleler.length, 0);
});

test('rekor ve paylaşım metni', () => {
  let r = M.rekorIsle(null, 72400, 58);
  assert.ok(r.sureRekor && r.hamleRekor);
  r = M.rekorIsle(r.rekor, 80000, 50);
  assert.ok(!r.sureRekor && r.hamleRekor);
  assert.equal(r.rekor.sure, 72400);
  assert.equal(r.rekor.cozulen, 2);
  assert.equal(M.sureMetni(72400), '01:12.4');
  assert.equal(M.paylasimMetni(null, 3, 72400, 58), 'Zekâ Küpü · 3×3 · 01:12.4 · 58 hamle');
});
