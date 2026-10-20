'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../games/yokus-asagi/mantik.js');

// Koridoru izleyen basit sürücü: iki satır ötedeki güvenli noktaya yönelir.
function surucu(s) {
  const i = Math.floor(s.d);
  const a = Y.satir(s.p, i + 1), b = Y.satir(s.p, i + 2);
  const hedef = (a.guvenli * 2 + b.guvenli) / 3;
  const istenen = Math.max(-Y.VX, Math.min(Y.VX, (hedef - s.x) * 10));
  return istenen > s.vx + 0.4 ? 1 : istenen < s.vx - 0.4 ? -1 : 0;
}

test('üretici her satırda güvenli koridor bırakır: zemin var (boşluk hariç), engel yok, kayma sınırlı', () => {
  for (const tohum of [1, 2, 3, 99, 12345, Y.gunTohumu('2026-10-20')]) {
    const p = Y.pist(tohum);
    let onceki = Y.satir(p, 0);
    let bosluk = 0;
    for (let i = 1; i < 4000; i++) {
      const s = Y.satir(p, i);
      assert.ok(Math.abs(s.guvenli - onceki.guvenli) <= Y.enFazlaKayma(i) + 1e-9, 'koridor çok hızlı kaydı: ' + i);
      if (!s.zeminler.length) bosluk++;
      else {
        bosluk = 0;
        const k = Y.kayma(s.kayma, Y.varis(i + 0.5));
        assert.ok(s.zeminler.some((z) => z[0] + k <= s.guvenli - 0.5 && z[1] + k >= s.guvenli + 0.5), 'koridor zeminsiz: ' + i);
      }
      for (const e of s.engeller) assert.ok(e[1] <= s.guvenli - Y.KORIDOR || e[0] >= s.guvenli + Y.KORIDOR, 'koridorda engel: ' + i);
      assert.ok(bosluk <= 9, 'çok uzun boşluk: ' + i);
      onceki = s;
    }
  }
});

test('koridoru izleyen top 4000 m boyunca düşmeden ilerler', () => {
  for (const tohum of [7, 8, 9, 2026]) {
    const s = Y.yeniOyun(tohum);
    while (!s.oldu && s.d < 4000) Y.adim(s, surucu(s));
    assert.equal(s.oldu, false, 'tohum ' + tohum + ' ' + Math.floor(s.d) + ' m, ' + s.neden);
  }
});

test('yönlendirmeyen top kısa sürede düşer ya da çarpar', () => {
  const s = Y.yeniOyun(5);
  while (!s.oldu && s.d < 4000) Y.adim(s, 0);
  assert.ok(s.oldu && s.d < 1000);
});

test('fizik sabit adımlı: aynı girdi farklı kare hızlarında aynı sonucu verir', () => {
  for (const girdi of [1, -1, 0]) {
    const e = Y.yeniOyun(42), f = Y.yeniOyun(42);
    let be = 0, bf = 0;
    for (let i = 0; i < 120; i++) be = Y.ilerlet(e, be, 1 / 60, girdi);
    for (let i = 0; i < 288; i++) bf = Y.ilerlet(f, bf, 1 / 144, girdi);
    // Kayan nokta birikimi bir adımlık fark bırakabilir: adım sayılarını eşitle
    const n = (s) => Math.round(s.t / Y.DT);
    while (n(f) < n(e) && !f.oldu) Y.adim(f, girdi);
    while (n(e) < n(f) && !e.oldu) Y.adim(e, girdi);
    assert.ok(n(e) > 200 || e.oldu);
    assert.equal(e.oldu, f.oldu);
    if (!e.oldu) assert.ok(Math.abs(e.d - f.d) < 1e-9 && Math.abs(e.x - f.x) < 1e-9 && Math.abs(e.y - f.y) < 1e-9);
    else assert.ok(Math.abs(e.d - f.d) < 1e-9);
  }
});

test('rampa topu zıplatır ve boşluğun ötesine indirir', () => {
  const p = Y.pist(3);
  let i = 300;
  while (!Y.satir(p, i).rampa) i++;
  const s = Y.yeniOyun(3);
  let zipladi = false;
  while (!s.oldu && s.d < i + 40) {
    Y.adim(s, surucu(s));
    if (s.olaylar.some((o) => o.tur === 'zipla')) zipladi = true;
    s.olaylar.length = 0;
  }
  assert.ok(zipladi);
  assert.equal(s.oldu, false);
});

test('kor engele çarpan top ölür', () => {
  const s = Y.yeniOyun(1);
  const sat = Y.satir(s.p, 0);
  sat.engeller.push([-0.5, 0.5]);
  Y.adim(s, 0);
  assert.equal(s.oldu, true);
  assert.equal(s.neden, 'engel');
});

test('bellek sabit kalır: geride kalan satırlar atılır', () => {
  const s = Y.yeniOyun(11);
  while (!s.oldu && s.d < 3000) Y.adim(s, surucu(s));
  assert.ok(s.p.satirlar.size < 60);
});

test('günlük tohum tarihe göre sabittir', () => {
  assert.equal(Y.gunTohumu('2026-10-20'), Y.gunTohumu('2026-10-20'));
  assert.notEqual(Y.gunTohumu('2026-10-20'), Y.gunTohumu('2026-10-21'));
});
