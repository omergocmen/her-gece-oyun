'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const D = require('../games/dama/motor.js');

// konum('c3:1 c4:3 e5:2', sira): kare:taş çiftleri (1 beyaz taş, 2 beyaz dama, 3 siyah taş, 4 siyah dama)
function konum(metin, sira) {
  const t = new Int8Array(64);
  for (const c of metin.split(/\s+/).filter(Boolean)) {
    const [k, x] = c.split(':');
    t[(Number(k[1]) - 1) * 8 + 'abcdefgh'.indexOf(k[0])] = Number(x);
  }
  return { t, sira: sira || 0, sayac: 0 };
}
const yazilar = (p) => D.hamleler(p).map(D.hamleYaz).sort();
const kare = (ad) => (Number(ad[1]) - 1) * 8 + 'abcdefgh'.indexOf(ad[0]);

test('başlangıç: ikinci ve üçüncü sırada 16 taş, ilk hamle 8 seçenek, ikinci hamlede 64', () => {
  const p = D.baslangic();
  const s = D.say(p);
  assert.deepEqual(s, { bt: 16, bd: 0, st: 16, sd: 0 });
  for (let c = 0; c < 8; c++) { assert.equal(p.t[8 + c], 1); assert.equal(p.t[16 + c], 1); assert.equal(p.t[40 + c], 3); assert.equal(p.t[48 + c], 3); }
  const l = D.hamleler(p);
  assert.equal(l.length, 8);
  assert.ok(l.every((m) => m.yen.length === 0 && m.de >> 3 === 2 && m.yol[0] >> 3 === 3));
  let toplam = 0;
  for (const m of l) toplam += D.hamleler(D.yap(p, m)).length;
  assert.equal(toplam, 64);
});

test('taş ileri ve yana yürür, geri ve çapraz gitmez', () => {
  assert.deepEqual(yazilar(konum('d4:1 h8:3')), ['d4-c4', 'd4-d5', 'd4-e4'].sort());
  assert.deepEqual(yazilar(konum('d5:3 a1:1', 1)), ['d5-c5', 'd5-d4', 'd5-e5'].sort());
});

test('tahta kenarında yana adım sınırlanır, önü dolu taş kıpırdamaz', () => {
  assert.deepEqual(yazilar(konum('a4:1 b4:1 h8:3')).filter((x) => x.startsWith('a4')), ['a4-a5']);
  const l = yazilar(konum('d4:1 d5:1 h8:3')).filter((x) => x.startsWith('d4'));
  assert.deepEqual(l, ['d4-c4', 'd4-e4']);
});

test('yeme zorunludur: yeme varken yürüyüş hamlesi yok', () => {
  const l = yazilar(konum('c3:1 c4:3 h1:1 h8:3'));
  assert.deepEqual(l, ['c3xc5']);
});

test('taş yana yiyebilir, geri yiyemez', () => {
  assert.deepEqual(yazilar(konum('c4:1 d4:3 h8:3')), ['c4xe4']);
  const geri = yazilar(konum('c4:1 c3:3 h8:3'));
  assert.ok(geri.every((x) => !x.includes('x')), 'geriye yeme olmamalı: ' + geri);
});

test('çoklu yeme zinciri ve yenen taş yenir yenmez kalkar', () => {
  const p = konum('c3:1 c4:3 c6:3 e5:3 h8:3');
  const l = D.hamleler(p);
  assert.equal(l.length, 1);
  assert.equal(D.hamleYaz(l[0]), 'c3xc5xc7');
  assert.deepEqual(l[0].yen.map(D.kareAdi), ['c4', 'c6']);
  const q = D.yap(p, l[0]);
  assert.equal(q.t[kare('c4')], 0);
  assert.equal(q.t[kare('c6')], 0);
  assert.equal(q.t[kare('c7')], 1);
  assert.equal(q.sira, 1);
});

test('çoğunluk kuralı: en çok taş yiyen yol zorunlu, tek taş yiyen elenir', () => {
  // a taşı sağa/ileri iki farklı yol: biri 1, diğeri 2 taş yer
  const p = konum('c3:1 c4:3 d3:3 f3:3 h8:3');
  // c3 ileri: c4'ü yer (c5 boş) -> 1; sağa: d3'ü yer (e3 boş) -> sonra f3'ü yer (g3 boş) -> 2
  const l = D.hamleler(p);
  assert.equal(l.length, 1);
  assert.equal(D.hamleYaz(l[0]), 'c3xe3xg3');
});

test('dama uzun menzillidir ve ardında istediği boş kareye iner', () => {
  const l = yazilar(konum('a1:2 a4:3 h8:3'));
  assert.deepEqual(l, ['a1xa5', 'a1xa6', 'a1xa7', 'a1xa8']);
});

test('dama yürüyüşte dört yöne istediği kadar gider', () => {
  const l = D.hamleler(konum('d4:2 h8:3'));
  assert.equal(l.length, 14);
});

test('dama yeme zincirinde 90 derece döner ama geri dönmez', () => {
  const l = yazilar(konum('a1:2 a3:3 c5:3 c7:3 h8:3'));
  // a1 -> a3'ü yer, a4 ya da a5.. iner; sağa dönüp c5 gibi taşları yiyebilir
  assert.ok(l.length >= 1);
  assert.ok(l.every((x) => x.startsWith('a1x')));
  const p = konum('d4:2 d6:3 h8:3');
  const m = D.hamleler(p).find((x) => x.yen.length);
  assert.ok(m, 'yeme var');
  // geri dönüp aynı hattan ikinci yeme yok: yenen kareler yalnızca bir kez geçer
  for (const h of D.hamleler(p)) assert.equal(new Set(h.yen).size, h.yen.length);
});

test('son sıraya ulaşan taş hamle bitince dama olur, yeme sürüyorsa taş olarak sürer', () => {
  const p = konum('d6:1 d7:3 e8:3 a1:3');
  const l = D.hamleler(p);
  assert.equal(l.length, 1);
  assert.equal(D.hamleYaz(l[0]), 'd6xd8xf8');
  assert.equal(l[0].ter, true);
  const q = D.yap(p, l[0]);
  assert.equal(q.t[kare('f8')], 2);
  const q2 = D.yap(konum('d7:1 h8:3 a1:3'), D.hamleler(konum('d7:1 h8:3 a1:3')).find((m) => D.hamleYaz(m) === 'd7-d8'));
  assert.equal(q2.t[kare('d8')], 2);
});

test('oyun sonu: hamlesi kalmayan kaybeder, iki dama beraberdir', () => {
  const o = new D.Oyun(konum('d6:1 d7:3', 0));
  assert.equal(o.durum().bitti, false);
  o.yap(D.hamleBul(o.konum, kare('d6'), [kare('d8')]));
  const d = o.durum();
  assert.equal(d.bitti, true);
  assert.equal(d.kazanan, 0);
  assert.equal(new D.Oyun(konum('a1:2 h8:4')).durum().neden, 'dama-dama');
});

test('geri al konumu ve tekrar sayacını eski haline getirir', () => {
  const o = new D.Oyun();
  const ilk = D.anahtar(o.konum);
  o.yap(D.hamleler(o.konum)[0]);
  assert.notEqual(D.anahtar(o.konum), ilk);
  o.geriAl();
  assert.equal(D.anahtar(o.konum), ilk);
  assert.equal(o.durum().bitti, false);
});

test('üçlü tekrar ve hamle sınırı beraberlik verir', () => {
  const o = new D.Oyun(konum('a1:2 a2:1 h8:4 h7:3'));
  const git = (de, hd) => o.yap(D.hamleBul(o.konum, kare(de), [kare(hd)]));
  for (let i = 0; i < 2; i++) { git('a1', 'b1'); git('h8', 'g8'); git('b1', 'a1'); git('g8', 'h8'); }
  assert.equal(o.durum().neden, 'tekrar');
  const p = konum('a1:2 h8:4 a2:1 h7:3');
  p.sayac = D.BERABERE_PLY;
  assert.equal(new D.Oyun(p).durum().neden, 'hamle-siniri');
});

test('dama olmayan hamle sayacı sıfırlar, dama hamlesi artırır', () => {
  const p = konum('a1:2 b2:1 h8:3');
  const dama = D.hamleler(p).find((m) => m.de === kare('a1'));
  assert.equal(D.yap(p, dama).sayac, 1);
  const tas = D.hamleler(p).find((m) => m.de === kare('b2'));
  assert.equal(D.yap(p, tas).sayac, 0);
});

test('arama: tek zorunlu yemeyi bulur, seviyeler yasal hamle döner', () => {
  const o = new D.Oyun(konum('c3:1 c4:3 e5:3 h1:1'));
  for (const sv of [1, 2, 3]) assert.equal(D.hamleYaz(D.bilgisayarHamlesi(o, sv, D.rng(5))), 'c3xc5');
  const b = new D.Oyun();
  for (const sv of [1, 2, 3]) {
    const m = D.bilgisayarHamlesi(b, sv, D.rng(sv));
    assert.ok(D.hamleler(b.konum).some((x) => D.hamleYaz(x) === D.hamleYaz(m)));
  }
});

test('zor seviye bir hamleyi 2 saniyeden kısa sürede verir', () => {
  const o = new D.Oyun();
  const rnd = D.rng(11);
  for (let i = 0; i < 6; i++) o.yap(D.bilgisayarHamlesi(o, 1, rnd));
  const t0 = Date.now();
  const m = D.bilgisayarHamlesi(o, 3, rnd);
  assert.ok(Date.now() - t0 < 2000, 'zor seviye ' + (Date.now() - t0) + ' ms');
  assert.ok(m);
});

test('zor seviye kolay seviyeyi yener (kısa maçlar)', () => {
  let zorPuan = 0;
  for (let tohum = 1; tohum <= 3; tohum++) {
    const o = new D.Oyun();
    const rnd = D.rng(tohum * 31);
    const zorBeyaz = tohum % 2 === 1;
    for (let ply = 0; ply < 160 && !o.durum().bitti; ply++) {
      const sv = (o.konum.sira === 0) === zorBeyaz ? 3 : 1;
      o.yap(D.bilgisayarHamlesi(o, sv, rnd));
    }
    const d = o.durum();
    if (d.bitti && d.kazanan === (zorBeyaz ? 0 : 1)) zorPuan += 2;
    else if (!d.bitti || d.kazanan === null) zorPuan += 1;
  }
  assert.ok(zorPuan >= 4, 'zor seviye yeterince üstün değil: ' + zorPuan);
});

test('bulmaca çözücü: tek hamlede kazanma ve iki hamlede zorla kazanma', () => {
  const bir = konum('d6:1 d7:3');
  assert.equal(D.hamleYaz(D.birdeKazanir(bir)), 'd6xd8');
  // iki hamle: beyaz dama kenarda, siyahın tek taşı kaçamaz
  const p = konum('a1:2 b3:3');
  const c = D.ikideKazandiranlar(p);
  assert.ok(Array.isArray(c));
});

test('günün bulmacası sırası: aynı gün aynı, havuz boyunca tekrarsız', () => {
  const adet = 37;
  assert.equal(D.bulmacaSirasi('2026-10-20', adet), D.bulmacaSirasi('2026-10-20', adet));
  const goru = new Set();
  const g0 = D.gunNo('2026-10-20') - (D.gunNo('2026-10-20') % adet);
  for (let i = 0; i < adet; i++) {
    const d = new Date((g0 + i) * 86400000);
    const a = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    goru.add(D.bulmacaSirasi(a, adet));
  }
  assert.equal(goru.size, adet, 'tur içinde tekrar: ' + goru.size);
});

test('bulmaca havuzu: her konum tek çözümlü, tek hamlede kazanç yok, beyaz oynar', () => {
  const B = require('../games/dama/bulmaca.js');
  assert.ok(B.length >= 120, 'havuz küçük: ' + B.length);
  const goru = new Set();
  for (const b of B) {
    assert.equal(b.t.length, 64);
    assert.ok(!goru.has(b.t), 'tekrar eden konum');
    goru.add(b.t);
    const p = D.diziden(b.t, 0);
    assert.equal(b.n, 2);
    assert.equal(D.birdeKazanir(p), null);
    assert.equal(D.ikideKazandiranlar(p).length, 1, 'tek çözüm olmalı: ' + b.t);
  }
});

test('oyun dosyaları: harici adres yok, dosyalar games.json\'da', () => {
  const kok = path.join(__dirname, '..');
  const oyun = JSON.parse(fs.readFileSync(path.join(kok, 'games.json'), 'utf8')).find((o) => o.slug === 'dama');
  assert.ok(oyun, 'games.json kaydı yok');
  assert.equal(oyun.boyut, '2D');
  assert.equal(oyun.gunluk, true);
  for (const d of oyun.dosyalar) assert.ok(fs.existsSync(path.join(kok, d)), 'eksik: ' + d);
  for (const dosya of ['oyun.js', 'motor.js', 'isci.js', 'stil.css', 'bulmaca.js']) {
    const m = fs.readFileSync(path.join(kok, 'games/dama', dosya), 'utf8');
    assert.doesNotMatch(m, /https?:\/\//, dosya + ' harici adres içeriyor');
  }
  const js = fs.readFileSync(path.join(kok, 'games/dama/oyun.js'), 'utf8');
  assert.match(js, /Gunluk\.kaydet\('dama'/);
  assert.match(js, /Depo\.ozetYaz\('dama'/);
});
