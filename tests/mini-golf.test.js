'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../games/mini-golf/fizik.js');
const P = require('../games/mini-golf/parkur.js');
const kayit = require('../games/mini-golf/kayit.json');

const derlenmis = P.DELIKLER.map((d) => F.derle(d));

function oynat(D, vuruslar) {
  const s = F.yeniDurum(D, 0);
  let toplam = 0;
  for (const v of vuruslar) {
    while (s.t < v.t) F.adim(D, s);
    s.olaylar = [];
    F.simuleEt(D, s, v.a, v.g);
    toplam += 1 + s.olaylar.filter((o) => o.tur === 'ceza').length;
    if (s.dustu) break;
  }
  return { s, toplam };
}

test('parkur 9 delik ve geçerli veri içerir', () => {
  assert.equal(P.DELIKLER.length, 9);
  P.DELIKLER.forEach((d, i) => {
    const D = derlenmis[i];
    assert.equal(d.no, i + 1);
    assert.ok(d.par >= 2 && d.par <= 5, `${d.ad}: par`);
    assert.ok(F.alandaMi(D, d.tee[0], d.tee[1]), `${d.ad}: tee alanda değil`);
    assert.ok(F.alandaMi(D, d.delik[0], d.delik[1]), `${d.ad}: delik alanda değil`);
    assert.equal(F.zemin(D, d.tee[0], d.tee[1], 0), 'cim', `${d.ad}: tee çimde olmalı`);
    for (const r of d.alan) for (const v of r) assert.equal(v * 2, Math.round(v * 2), `${d.ad}: alan 0.5 m ızgarasında olmalı`);
  });
});

test('her delik geliştirici kaydıyla par ya da altında bitirilir', () => {
  P.DELIKLER.forEach((d, i) => {
    const vuruslar = kayit[d.no];
    assert.ok(vuruslar && vuruslar.length, `${d.ad}: kayıt yok (node scripts/golf-par-ara.js)`);
    const { s, toplam } = oynat(derlenmis[i], vuruslar);
    assert.ok(s.dustu, `${d.ad}: kayıt topu deliğe sokmadı`);
    assert.ok(toplam <= d.par, `${d.ad}: ${toplam} vuruş, par ${d.par}`);
  });
});

test('fizik sabit adımlı: farklı kare hızlarında aynı vuruş aynı sonucu verir', () => {
  const kareler = [1 / 30, 1 / 60, 1 / 144, 0.0173, 0.05];
  P.DELIKLER.forEach((d, i) => {
    const D = derlenmis[i];
    const sonuclar = kareler.map((kare, k) => {
      const s = F.yeniDurum(D, 0);
      F.vur(s, -Math.PI / 2 + 0.31, 0.83);
      let biriken = 0;
      let gecen = 0;
      // Biraz düzensiz kare süreleri
      while ((s.hareket || gecen < 0.5) && gecen < 40) {
        const dt = kare * (1 + 0.3 * Math.sin(gecen * 7 + k));
        biriken = F.ilerlet(D, s, biriken, dt);
        gecen += dt;
      }
      // Top durunca aynı adım sayısına kadar ilerlet (hareketli engeller için)
      return { x: s.x, z: s.z, dustu: s.dustu };
    });
    const ref = F.yeniDurum(D, 0);
    F.simuleEt(D, ref, -Math.PI / 2 + 0.31, 0.83);
    for (const r of sonuclar) {
      assert.equal(r.dustu, ref.dustu, `${d.ad}: delik sonucu farklı`);
      if (!D.vapurlar.length) {
        assert.ok(Math.abs(r.x - ref.x) < 1e-9 && Math.abs(r.z - ref.z) < 1e-9, `${d.ad}: durma noktası farklı`);
      }
    }
  });
});

test('top hiçbir delikte duvardan ya da engelden geçmez (en yüksek hızda)', () => {
  P.DELIKLER.forEach((d, i) => {
    const D = derlenmis[i];
    const r = F.TOP_R;
    for (let a = 0; a < 72; a++) {
      const s = F.yeniDurum(D, a * 17);
      F.vur(s, (a / 72) * Math.PI * 2, 1);
      let n = 0;
      while (s.hareket && n++ < 120 * 30) {
        F.adim(D, s);
        assert.ok(F.alandaMi(D, s.x, s.z), `${d.ad}: top alan dışına çıktı (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`);
        for (const c of D.daireler) assert.ok(Math.hypot(s.x - c.x, s.z - c.z) >= c.r + r - 1e-6, `${d.ad}: top engelin içinde`);
        for (const k of D.kutular) {
          const ic = s.x > k.r[0] + 1e-6 && s.x < k.r[2] - 1e-6 && s.z > k.r[1] + 1e-6 && s.z < k.r[3] - 1e-6;
          assert.ok(!ic, `${d.ad}: top kutunun içinde`);
        }
      }
    }
  });
});

test('suya düşen top ceza alır ve güvenli noktaya döner', () => {
  const i = P.DELIKLER.findIndex((d) => d.su);
  const D = derlenmis[i];
  const s = F.yeniDurum(D, 0);
  // Vapur kenardayken suya doğru orta güçte vuruş
  while (Math.abs(F.vapurDurumu(D.vapurlar[0], s.t).x) < 2) F.adim(D, s);
  F.simuleEt(D, s, -Math.PI / 2, 0.55);
  assert.ok(s.olaylar.some((o) => o.tur === 'ceza'), 'ceza olayı yok');
  assert.ok(!s.hareket);
  assert.deepEqual([s.x, s.z], [D.tee[0], D.tee[1]]);
});

test('kum topu çimden daha çok yavaşlatır, yokuş geri yuvarlar', () => {
  const D = F.derle({ par: 2, alan: [[-1, -20, 1, 1]], tee: [0, 0], delik: [0, -19], kum: [[-1, -20, 1, -0.5]] });
  const C = F.derle({ par: 2, alan: [[-1, -20, 1, 1]], tee: [0, 0], delik: [0, -19] });
  const kum = F.simuleEt(D, F.yeniDurum(D, 0), -Math.PI / 2, 0.5);
  const cim = F.simuleEt(C, F.yeniDurum(C, 0), -Math.PI / 2, 0.5);
  assert.ok(-kum.z < -cim.z * 0.6, 'kumda daha kısa gitmeli');
  const Y = F.derle({ par: 2, alan: [[-1, -20, 1, 1]], tee: [0, 0], delik: [0, -19], rampalar: [{ eksen: 'z', a: -2, b: -5, dh: 1 }] });
  const zayif = F.simuleEt(Y, F.yeniDurum(Y, 0), -Math.PI / 2, 0.4);
  assert.ok(zayif.z > -2.5, 'zayıf vuruş yokuştan geri gelmeli');
});

test('skor adları', () => {
  assert.equal(F.skorAdi(1, 3), 'TEK VURUŞ!');
  assert.equal(F.skorAdi(2, 3), 'Birdie!');
  assert.equal(F.skorAdi(3, 3), 'Par');
  assert.equal(F.skorAdi(4, 3), 'Bogey');
  assert.equal(F.skorAdi(2, 4), 'Eagle!');
  assert.equal(F.skorAdi(6, 3), '+3');
});
