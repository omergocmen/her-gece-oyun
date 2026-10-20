'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/kayip-minareler/mantik.js');
const BOLUMLER = require('../games/kayip-minareler/bolumler.json');

const RENKLER = ['turkuaz', 'kor', 'iznik', 'sodyum', 'yaprak', 'ay', 'kemik', 'kum'];

function bolum(bloklar, ek) {
  return Object.assign({ no: 0, ad: 'deneme', baslangic: [0, 0, 0], hedef: [0, 0, 0], bloklar, gruplar: [] }, ek || {});
}

test('90° döndürmeler dört kez kimliktir ve three.js yönüyle aynıdır', () => {
  const v = [1, 2, 3];
  for (const e of ['x', 'y', 'z']) assert.deepEqual(M.dondur(v, e, 4), v);
  assert.deepEqual(M.dondur([0, 1, 0], 'x', 1), [0, 0, 1]);
  assert.deepEqual(M.dondur([1, 0, 0], 'y', 1), [0, 0, -1]);
  assert.deepEqual(M.dondur([1, 0, 0], 'z', 1), [0, 1, 0]);
});

test('görsel bağlantı: ekranda yan yana görünen farklı yükseklikteki karolar birleşir', () => {
  // (3,0,0) ile (6,2,2): ekran hücreleri (3,0) ve (4,0)
  const b = bolum([[3, 0, 0, 'y'], [6, 2, 2, 'y']], { baslangic: [3, 0, 0], hedef: [6, 2, 2] });
  const s = M.kur(b);
  assert.deepEqual(M.yol(s, [6, 2, 2]), [[6, 2, 2]]);
  // Gerçekte bitişik ama ekranda bitişik olmayan karolar bağlı değildir: (0,0,0) ile (0,1,1) aynı hücrede değil, Δ = (−1,0)
  const b2 = bolum([[0, 0, 0, 'y'], [1, 1, 0, 'y'], [3, 0, 0, 'y']], { hedef: [3, 0, 0] });
  assert.equal(M.yol(M.kur(b2), [3, 0, 0]), null);
});

test('kameraya daha yakın bir küpün arkasında kalan karo görünmez ve yürünemez', () => {
  const b = bolum([[0, 0, 0, 'y'], [1, 0, 0, 'y'], [3, 1, 1, 't']], { hedef: [1, 0, 0] });
  // (3,1,1) hücresi (2,0): (1,0,0)'ın komşusu (2,0,0) olsaydı; burada (1,0,0) açık kalır
  assert.ok(M.yol(M.kur(b), [1, 0, 0]));
  const gizli = bolum([[0, 0, 0, 'y'], [1, 0, 0, 'y'], [2, 1, 1, 't']], { hedef: [1, 0, 0] });
  assert.equal(M.yol(M.kur(gizli), [1, 0, 0]), null);
  // Üstü dolu küp yürünemez
  const ustu = bolum([[0, 0, 0, 'y'], [1, 0, 0, 'y'], [1, 1, 0, 't']], { hedef: [1, 0, 0] });
  assert.equal(M.yol(M.kur(ustu), [1, 0, 0]), null);
});

test('dikey eksenli dönen parça bekçiyi taşır; yatay eksenli parça üstündeyken kilitlidir', () => {
  const b = BOLUMLER.find((x) => x.no === 2);
  const s = M.kur(b);
  assert.ok(M.oynat(s, 'teker', 3));
  assert.ok(M.yuru(s, [3, 0, 0]));
  assert.ok(M.oynat(s, 'teker', 1));
  assert.deepEqual(s.konum, [5, 0, 0]);
  const b3 = BOLUMLER.find((x) => x.no === 3);
  const s3 = M.kur(b3);
  M.oynat(s3, 'kanat', 0);
  M.yuru(s3, [6, 2, 3]);
  assert.equal(M.kilitli(s3, 'kanat'), true);
});

test('basınç plakası grubu taşır ve oyuncu o grubu oynatamaz', () => {
  const b = BOLUMLER.find((x) => x.no === 4);
  const s = M.kur(b);
  assert.equal(M.kilitli(s, 'sutun'), true);
  assert.equal(M.yol(s, b.hedef), null);
  M.yuru(s, [1, 0, 2]);
  assert.equal(s.durum.sutun, 3);
  assert.ok(M.yol(s, b.hedef));
});

test('bölüm verisi geçerli: başlangıç ve hedef yürünebilir, renkler paletten', () => {
  assert.equal(BOLUMLER.length, 8);
  BOLUMLER.forEach((b, i) => {
    assert.equal(b.no, i + 1);
    assert.ok(RENKLER.includes(b.renk), b.ad + ' rengi');
    assert.ok(b.siir && b.ad && b.rakam);
    const s = M.kur(b);
    const kr = M.karolar(s);
    assert.ok(kr.has(M.hucre(b.baslangic)), b.ad + ' başlangıç');
    const h = M.dunya(s).get(M.anahtar(...b.hedef));
    assert.ok(h && M.YURUNUR[h.tur], b.ad + ' hedef');
    assert.ok(b.bloklar.some((x) => x[3] === 'k'), b.ad + ' minare');
  });
});

for (const b of BOLUMLER) {
  test(`bölüm ${b.no} (${b.ad}) çözülebilir ve etkileşimsiz çözülemez`, () => {
    const h = M.coz(b);
    assert.ok(h, 'çözüm yok');
    // Çözümü baştan oynat
    const s = M.kur(b);
    for (const a of h) a.tur === 'yuru' ? M.yuru(s, a.k) : assert.ok(M.oynat(s, a.id, a.v));
    assert.equal(s.bitti, true);
    const kilitsiz = JSON.parse(JSON.stringify(b));
    (kilitsiz.gruplar || []).forEach((g) => { g.surekli = false; });
    kilitsiz.plakalar = [];
    assert.equal(M.coz(kilitsiz), null);
  });
}
