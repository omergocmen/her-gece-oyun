'use strict';
// Ana sayfa "Bugünün meydan okumaları": ortak günlük kayıt (Gunluk), seri hesabı, sıralama ve paylaşım metni.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const vm = require('vm');
const fs = require('fs');
const { spawnSync } = require('child_process');
const Gunluk = require('../assets/js/depo.js');
const Katalog = require('../assets/js/katalog.js');

const KOK = path.join(__dirname, '..');
const depoYolu = path.join(KOK, 'assets/js/depo.js');
const depoKodu = fs.readFileSync(depoYolu, 'utf8');

function sahteDepo() {
  const veri = {};
  return { veri, getItem: (k) => (k in veri ? veri[k] : null), setItem: (k, v) => { veri[k] = String(v); } };
}
function calistir(depo) {
  const ortam = { location: { pathname: '/' } };
  if (depo) ortam.localStorage = depo;
  else Object.defineProperty(ortam, 'localStorage', { get() { throw new Error('depolama kapalı'); } });
  vm.runInNewContext(depoKodu, ortam);
  return ortam;
}
const gun = (a) => { const p = a.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 15, 30); };

test('gunFarki: ardışık gün, ay ve yıl sınırı, artık yıl', () => {
  assert.equal(Gunluk.gunFarki('2026-10-19', '2026-10-20'), 1);
  assert.equal(Gunluk.gunFarki('2026-10-20', '2026-10-20'), 0);
  assert.equal(Gunluk.gunFarki('2026-10-31', '2026-11-01'), 1);
  assert.equal(Gunluk.gunFarki('2026-12-31', '2027-01-01'), 1);
  assert.equal(Gunluk.gunFarki('2028-02-28', '2028-03-01'), 2);
  assert.equal(Gunluk.gunFarki('2026-10-20', '2026-10-17'), -3);
});

test('gunAnahtari yerel takvim gününü verir (UTC değil)', () => {
  assert.equal(Gunluk.gunAnahtari(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
  assert.equal(Gunluk.gunAnahtari(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('seri: ardışık günlerde uzar, aynı gün tekrar bitirmek saymaz', () => {
  let d = null;
  d = Gunluk.isle(d, 'a', { durum: 'bitti', ozet: '4/6' }, '2026-10-18');
  assert.deepEqual(d.seri, { son: '2026-10-18', sayi: 1 });
  d = Gunluk.isle(d, 'a', { durum: 'bitti', ozet: '3/6' }, '2026-10-19');
  d = Gunluk.isle(d, 'b', { durum: 'bitti', ozet: '02:41' }, '2026-10-19');
  assert.deepEqual(d.seri, { son: '2026-10-19', sayi: 2 });
  d = Gunluk.isle(d, 'a', { durum: 'bitti', ozet: '2/6' }, '2026-10-20');
  assert.deepEqual(d.seri, { son: '2026-10-20', sayi: 3 });
  assert.deepEqual(Gunluk.seri(d, '2026-10-20'), { sayi: 3, bugunBitti: true });
});

test('seri: atlanan gün seriyi 1\'e döndürür; rozet atlanan günde 0 gösterir', () => {
  let d = Gunluk.isle(null, 'a', { durum: 'bitti', ozet: 'x' }, '2026-10-10');
  d = Gunluk.isle(d, 'a', { durum: 'bitti', ozet: 'x' }, '2026-10-11');
  assert.equal(d.seri.sayi, 2);
  assert.deepEqual(Gunluk.seri(d, '2026-10-12'), { sayi: 2, bugunBitti: false }, 'dün bitti: seri sürdürülebilir');
  assert.deepEqual(Gunluk.seri(d, '2026-10-13'), { sayi: 0, bugunBitti: false }, 'bir gün atlandı: seri kopmuş');
  d = Gunluk.isle(d, 'a', { durum: 'bitti', ozet: 'x' }, '2026-10-13');
  assert.deepEqual(d.seri, { son: '2026-10-13', sayi: 1 });
});

test('seri: ay ve yıl sınırında sürer', () => {
  let d = Gunluk.isle(null, 'a', { durum: 'bitti' }, '2026-12-31');
  d = Gunluk.isle(d, 'a', { durum: 'bitti' }, '2027-01-01');
  assert.equal(d.seri.sayi, 2);
  d = Gunluk.isle(d, 'a', { durum: 'bitti' }, '2027-01-02');
  assert.equal(d.seri.sayi, 3);
  let e = Gunluk.isle(null, 'a', { durum: 'bitti' }, '2028-02-28');
  e = Gunluk.isle(e, 'a', { durum: 'bitti' }, '2028-02-29');
  e = Gunluk.isle(e, 'a', { durum: 'bitti' }, '2028-03-01');
  assert.equal(e.seri.sayi, 3, 'artık gün araya girer');
});

test('yarım kayıt seriyi uzatmaz; bitti yarımla ezilmez; yeni gün oyunları sıfırlar, seriyi değil', () => {
  let d = Gunluk.isle(null, 'a', { durum: 'yarim', ozet: '' }, '2026-10-20');
  assert.equal(d.seri.sayi, 0);
  assert.equal(d.oyunlar.a.durum, 'yarim');
  d = Gunluk.isle(d, 'a', { durum: 'bitti', ozet: '4/6' }, '2026-10-20');
  d = Gunluk.isle(d, 'a', { durum: 'yarim', ozet: '' }, '2026-10-20');
  assert.deepEqual(d.oyunlar.a, { durum: 'bitti', ozet: '4/6' });
  const yarin = Gunluk.normalle(d, '2026-10-21');
  assert.deepEqual(yarin.oyunlar, {});
  assert.deepEqual(yarin.seri, { son: '2026-10-20', sayi: 1 });
});

test('bozuk ya da eski kayıt normalleştirilir, geçersiz sonuç yok sayılır', () => {
  for (const ham of [null, 'x', 5, [], { oyunlar: 3 }, { tarih: '2026-10-20', oyunlar: { a: { durum: 'kazandi' }, b: null }, seri: { son: 'dun', sayi: 'x' } }]) {
    const n = Gunluk.normalle(ham, '2026-10-20');
    assert.deepEqual(n, { tarih: '2026-10-20', oyunlar: {}, seri: { son: null, sayi: 0 } });
  }
  const d = Gunluk.isle(null, 'a', { durum: 'belki' }, '2026-10-20');
  assert.deepEqual(d.oyunlar, {});
});

test('kaydet/oku: localStorage anahtarı hgo:gunluk, şekil sözleşmeye uyar', () => {
  const depo = sahteDepo();
  const { Gunluk: G } = calistir(depo);
  G.kaydet('gunun-kelimesi', { durum: 'yarim', ozet: '' }, gun('2026-10-20'));
  G.kaydet('gunun-kelimesi', { durum: 'bitti', ozet: '4/6' }, gun('2026-10-20'));
  const ham = JSON.parse(depo.veri['hgo:gunluk']);
  assert.deepEqual(ham, { tarih: '2026-10-20', oyunlar: { 'gunun-kelimesi': { durum: 'bitti', ozet: '4/6' } }, seri: { son: '2026-10-20', sayi: 1 } });
  assert.equal(G.oku(gun('2026-10-20')).oyunlar['gunun-kelimesi'].ozet, '4/6');
  assert.deepEqual(JSON.parse(JSON.stringify(G.oku(gun('2026-10-21')).oyunlar)), {});
});

test('depolama kapalıyken kaydet sessizce geçer, oku null döner', () => {
  const { Gunluk: G } = calistir(null);
  assert.doesNotThrow(() => G.kaydet('a', { durum: 'bitti', ozet: 'x' }));
  assert.equal(G.oku(), null);
});

test('yazma hata veren depoda kaydet hata vermez', () => {
  const depo = { getItem: () => null, setItem: () => { throw new Error('dolu'); } };
  const { Gunluk: G } = calistir(depo);
  assert.doesNotThrow(() => G.kaydet('a', { durum: 'bitti', ozet: 'x' }));
});

test('yaz saati geçişi: 23 ve 25 saatlik günlerde seri doğru sayılır (gerçek saat dilimleriyle)', () => {
  const kod = `
    const G = require(${JSON.stringify(depoYolu)});
    function dene(gunler) {
      let d = null;
      gunler.forEach(([y, a, g, s]) => { d = G.isle(d, 'a', { durum: 'bitti' }, G.gunAnahtari(new Date(y, a - 1, g, s, 0))); });
      return d.seri.sayi;
    }
    console.log(JSON.stringify([
      dene([[2026,3,7,23],[2026,3,8,23],[2026,3,9,0]]),
      dene([[2026,10,31,23],[2026,11,1,0],[2026,11,2,0]]),
      dene([[2026,3,28,23],[2026,3,29,1],[2026,3,30,23]]),
      dene([[2026,10,24,23],[2026,10,25,0],[2026,10,25,23],[2026,10,26,0]]),
    ]));`;
  for (const tz of ['America/New_York', 'Europe/Berlin', 'Australia/Sydney', 'Pacific/Auckland']) {
    const r = spawnSync(process.execPath, ['-e', kod], { env: Object.assign({}, process.env, { TZ: tz }), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), [3, 3, 3, 3], tz);
  }
  assert.equal(Gunluk.gunFarki('2026-03-07', '2026-03-09'), 2);
});

// ---------- Ana sayfa mantığı (Katalog) ----------
const OYUNLAR = [
  { slug: 'a', ad: 'Alfa', gunluk: true }, { slug: 'b', ad: 'Beta', gunluk: true },
  { slug: 'c', ad: 'Çok', gunluk: true }, { slug: 'd', ad: 'Dört' }, { slug: 'e', ad: 'Eşek', gunluk: true }
];

test('meydanSatirlari: yalnızca gunluk:true; yapılmayan, yarım, biten sırasıyla', () => {
  const durum = { oyunlar: { a: { durum: 'bitti', ozet: '4/6' }, c: { durum: 'yarim', ozet: '' }, d: { durum: 'bitti', ozet: 'x' } } };
  const s = Katalog.meydanSatirlari(OYUNLAR, durum);
  assert.deepEqual(s.map((x) => x.oyun.slug + ':' + x.durum), ['b:yok', 'e:yok', 'c:yarim', 'a:bitti']);
  assert.equal(s[3].ozet, '4/6');
  assert.equal(s[0].ozet, '');
  assert.deepEqual(Katalog.meydanSatirlari(OYUNLAR, null).map((x) => x.durum), ['yok', 'yok', 'yok', 'yok']);
  assert.deepEqual(Katalog.meydanSatirlari([{ slug: 'x' }], {}), [], 'günlük oyun yoksa liste boş');
});

test('paylasimMetni: tasarım notundaki biçim; biten yoksa null', () => {
  const durum = { oyunlar: { a: { durum: 'bitti', ozet: '4/6' }, b: { durum: 'bitti', ozet: '02:41' }, c: { durum: 'yarim', ozet: '' } } };
  const s = Katalog.meydanSatirlari(OYUNLAR, durum);
  assert.equal(Katalog.paylasimMetni(s, 5, new Date(2026, 9, 20)), 'Her Gece Oyun · 20 Eki\n🌙 Alfa 4/6\n🧩 Beta 02:41\nSeri: 5 gün');
  assert.equal(Katalog.paylasimMetni(Katalog.meydanSatirlari(OYUNLAR, { oyunlar: { c: { durum: 'yarim' } } }), 3, new Date(2026, 9, 20)), null);
  assert.ok(!Katalog.paylasimMetni(s, 0, new Date(2026, 0, 1)).includes('Seri:'));
});
