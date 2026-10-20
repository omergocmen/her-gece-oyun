'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/cam-ustasi/mantik.js');

function kam(s) { return { x: 0, y: M.KAM_Y, z: -s.d }; }
function yeterli(s, n) { for (let i = 0; i < n && !s.bitti; i++) M.adim(s); }

// Basit oyuncu: önündeki ilk kapatıcı camı ya da kristali ortasından vurur.
function oyna(s, maksAdim) {
  let bekle = 0;
  for (let i = 0; i < maksAdim && !s.bitti; i++) {
    M.adim(s);
    if (--bekle > 0) continue;
    const kz = -s.d;
    const hedef = s.engeller.find((e) => {
      const uz = kz - e.z;
      if (uz < 4 || uz > 13) return false;
      if (e.tur === 'kristal') return !e.toplandi;
      if (e.tur === 'nazar' || e.kirik) return false;
      return M.kamerayiKapatir(e, s.t + uz / M.hiz(s.oda));
    });
    if (!hedef) continue;
    const P = hedef.tur === 'kristal' ? { x: hedef.x, y: hedef.y, z: hedef.z }
      : { x: (hedef.x0 + hedef.x1) / 2 + M.kayma(hedef, s.t + 0.5), y: (hedef.y0 + hedef.y1) / 2, z: hedef.z };
    M.at(s, kam(s), P);
    bekle = 30;
  }
  return s;
}

test('yörünge: bilye nişan alınan noktadan geçer (yerçekimi dahil)', () => {
  const p0 = { x: 0, y: 1.5, z: 0 };
  for (const P of [{ x: 1.2, y: 2.4, z: -9 }, { x: -1.9, y: 0.2, z: -14 }, { x: 0, y: 1.5, z: -3 }]) {
    const { v, T } = M.yorunge(p0, P);
    const q = M.konum(p0, v, T);
    assert.ok(Math.hypot(q.x - P.x, q.y - P.y, q.z - P.z) < 1e-9);
  }
});

test('nişan noktası ışının değdiği ilk sağlam cama düşer', () => {
  const s = M.yeniOyun({ mod: 'oda', oda: 1 });
  const ilk = s.engeller.filter((e) => e.tur !== 'kristal' && M.kamerayiKapatir(e, 0)).sort((a, b) => b.z - a.z)[0];
  const P = M.nisanNoktasi(s, kam(s), { x: 0, y: 0, z: -1 });
  assert.ok(Math.abs(P.z - ilk.z) < 1e-9);
  assert.ok(Math.abs(P.y - M.KAM_Y) < 1e-9);
});

test('atılan bilye simülasyonda hedef cama çarpıp kırar', () => {
  const s = M.yeniOyun({ mod: 'oda', oda: 1 });
  const P = M.nisanNoktasi(s, kam(s), { x: 0.1, y: -0.05, z: -1 });
  const hedef = s.engeller.find((e) => e.tur !== 'kristal' && Math.abs(e.z - P.z) < 1e-9 && M.camIcinde(e, P.x, P.y, 0, 0));
  assert.ok(M.at(s, kam(s), P));
  yeterli(s, 120);
  assert.equal(hedef.kirik, true);
  assert.ok(s.olaylar.some((o) => o.tur === 'kirildi' && o.id === hedef.id));
});

test('her atış bir bilye harcar; bilye yokken atılamaz', () => {
  const s = M.yeniOyun({ mod: 'oda', oda: 1 });
  M.at(s, kam(s), { x: 0, y: 1.5, z: -5 });
  assert.equal(s.bilye, M.BASLANGIC - 1);
  s.bilye = 0;
  assert.equal(M.at(s, kam(s), { x: 0, y: 1.5, z: -5 }), false);
});

test('kombo: art arda isabet seviye kazandırır, ıska sıfırlar, çoklu atış tek bilye', () => {
  const s = M.yeniOyun({ mod: 'oda', oda: 1 });
  s.engeller = [];
  for (let i = 0; i < M.KOMBO_ADIM; i++) {
    s.engeller.push({ id: 'k' + i, tur: 'kristal', x: 0, y: 1.5, z: -s.d - 6, r: 0.38, toplandi: false });
    const once = s.bilye;
    M.at(s, kam(s), { x: 0, y: 1.5, z: -s.d - 6 });
    yeterli(s, 60);
    assert.equal(s.bilye, once - 1 + M.KRISTAL_ODUL);
  }
  assert.equal(s.kombo, 2);
  const once = s.bilye, ucan = s.toplar.length;
  M.at(s, kam(s), { x: 0, y: 2.5, z: -s.d - 8 });
  assert.equal(s.toplar.length - ucan, 2);
  assert.equal(s.bilye, once - 1);
  yeterli(s, 400);
  assert.equal(s.kombo, 1);
  assert.equal(s.seri, 0);
});

test('kapatıcı cama çarpmak bilye kaybettirir ve komboyu sıfırlar', () => {
  const s = M.yeniOyun({ mod: 'oda', oda: 1 });
  s.kombo = 3; s.seri = 10;
  const ilk = s.engeller.filter((e) => e.tur !== 'kristal' && M.kamerayiKapatir(e, 0)).sort((a, b) => b.z - a.z)[0];
  while (-s.d > ilk.z) M.adim(s);
  assert.ok(s.olaylar.some((o) => o.tur === 'carpma'));
  assert.equal(s.bilye, M.BASLANGIC - M.CARPMA_CEZA);
  assert.equal(s.kombo, 1);
});

test('nazar boncuğu: kırılırsa ceza, sağlam geçilirse ödül; ortası kamerayı kapatmaz', () => {
  const n = M.odaUret(1).find((e) => e.tur === 'nazar');
  assert.ok(!M.nazarIcinde(n, 0, M.KAM_Y + M.KAM_R));
  assert.ok(M.nazarIcinde(n, 0, M.KAM_Y + 1.1));
  const s = M.yeniOyun({ mod: 'oda', oda: 1 });
  s.engeller = [Object.assign({}, n, { z: -s.d - 6 })];
  M.at(s, kam(s), { x: 0, y: M.KAM_Y + 1.1, z: -s.d - 6 });
  yeterli(s, 60);
  assert.equal(s.bilye, M.BASLANGIC - 1 - M.NAZAR_CEZA);
  const s2 = M.yeniOyun({ mod: 'oda', oda: 1 });
  s2.engeller = [Object.assign({}, n, { z: -s2.d - 2 })];
  yeterli(s2, 120);
  assert.equal(s2.bilye, M.BASLANGIC + M.NAZAR_ODUL);
});

test('bilye biterse oyun biter', () => {
  const s = M.yeniOyun({ mod: 'oda', oda: 1 });
  s.bilye = 0;
  M.adim(s);
  assert.equal(s.bitti, true);
  assert.equal(s.kazandi, false);
});

test('odalar tohumlu ve aynıdır; kapatıcı her engel kırılabilir', () => {
  for (let n = 1; n <= 14; n++) {
    assert.deepEqual(M.odaUret(n), M.odaUret(n));
    for (const e of M.odaUret(n)) {
      if (e.tur === 'cam' || e.tur === 'bulbul') {
        assert.ok(e.x0 < e.x1 && e.y0 < e.y1 && e.y0 >= 0 && e.y1 <= M.YUK);
        assert.ok(e.dayanim >= 1 && e.dayanim <= 2);
      }
    }
  }
});

test('basit bir oyuncu 10 odayı bitirebilir; sonuç kare hızından bağımsız', () => {
  const s = oyna(M.yeniOyun({ mod: 'oda', oda: 1 }), 60 * 10 * 120);
  assert.equal(s.kazandi, true, 'oyun ' + s.oda + '. odada bitti, bilye ' + s.bilye);
  const a = M.yeniOyun({ mod: 'sonsuz', oda: 1 }), b = M.yeniOyun({ mod: 'sonsuz', oda: 1 });
  let ba = 0, bb = 0;
  for (let i = 0; i < 600; i++) ba = M.ilerlet(a, ba, 1 / 60);
  for (let i = 0; i < 1440; i++) bb = M.ilerlet(b, bb, 1 / 144);
  assert.ok(Math.abs(a.d - b.d) < 1e-6);
});

test('sonsuz modda 10. odadan sonra da odalar gelir', () => {
  const s = M.yeniOyun({ mod: 'sonsuz', oda: 10 });
  s.bilye = 9999;
  while (s.oda < 12 && !s.bitti) M.adim(s);
  assert.equal(s.oda, 12);
  assert.ok(s.engeller.some((e) => e.oda === 12));
});
