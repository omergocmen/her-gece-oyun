'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('../games/sudoku/mantik.js');

const KOK = path.join(__dirname, '..');
const yolu = (d) => path.join(KOK, 'games/sudoku', d);
const SEVIYELER = S.SEVIYELER;

function gecerliTam(g) {
  for (const u of S.BIRIMLER) if (new Set(u.map((i) => g[i])).size !== 9 || u.some((i) => !g[i])) return false;
  return true;
}
function verilenSayisi(b) { return b.filter(Boolean).length; }

test('üretilen her bulmaca geçerli, tek çözümlü ve çözümüyle tutarlı (çok sayıda tohum, her seviye)', () => {
  for (const seviye of SEVIYELER) {
    for (let t = 0; t < 12; t++) {
      const r = S.uret('test-' + t, seviye);
      assert.ok(gecerliTam(r.cozum), `${seviye}/${t}: çözüm geçerli bir ızgara değil`);
      assert.ok(r.bulmaca.every((d, i) => !d || d === r.cozum[i]), `${seviye}/${t}: verilenler çözümle çelişiyor`);
      const say = S.cozumleriSay(r.bulmaca, 2);
      assert.equal(say.adet, 1, `${seviye}/${t}: tek çözümlü olmalı`);
      assert.deepEqual(say.cozum, r.cozum);
      assert.ok(verilenSayisi(r.bulmaca) >= 17 && verilenSayisi(r.bulmaca) < 81);
      assert.deepEqual(S.cakisanlar(r.bulmaca), [], 'başlangıçta çakışma yok');
    }
  }
});

test('seviye ayrımı: Kolay yalnızca tek-aday, Orta gizli tek ister, Zor eleme tekniği, Uzman daha fazlası', () => {
  for (let t = 0; t < 10; t++) {
    const kolay = S.uret('sev-' + t, 'kolay');
    assert.equal(kolay.seviye, 'kolay');
    const k = S.mantikla(kolay.bulmaca, 1, true);
    assert.ok(k.cozuldu, 'Kolay yalnızca tek-aday ile çözülmeli');
    assert.ok(k.adimlar.every((a) => a.teknik === 'tek-aday'));

    const orta = S.uret('sev-' + t, 'orta');
    assert.equal(orta.seviye, 'orta');
    assert.equal(S.mantikla(orta.bulmaca, 1).cozuldu, false, 'Orta yalnızca tek-aday ile çözülmemeli');
    assert.ok(S.mantikla(orta.bulmaca, 2).cozuldu, 'Orta gizli tek ile çözülmeli');

    const zor = S.uret('sev-' + t, 'zor');
    assert.equal(zor.seviye, 'zor');
    assert.equal(S.mantikla(zor.bulmaca, 2).cozuldu, false);
    assert.ok(S.mantikla(zor.bulmaca, 3).cozuldu);

    const uzman = S.uret('sev-' + t, 'uzman');
    assert.equal(uzman.seviye, 'uzman');
    assert.equal(S.mantikla(uzman.bulmaca, 3).cozuldu, false, 'Uzman çıplak çift/kutu-çizgi ile çözülmemeli');
  }
});

test('üretim tohumludur: aynı tohum ve seviye aynı bulmacayı, farklı tohum farklısını verir', () => {
  const a = S.uret('ayni', 'orta'), b = S.uret('ayni', 'orta'), c = S.uret('baska', 'orta');
  assert.deepEqual(a.bulmaca, b.bulmaca);
  assert.deepEqual(a.cozum, b.cozum);
  assert.notDeepEqual(a.bulmaca, c.bulmaca);
});

test('günlük bulmaca: aynı gün herkese aynı, günler farklı, seviye haftanın gününe göre', () => {
  const d1 = S.gunlukUret('2026-10-20'), d2 = S.gunlukUret('2026-10-20'), d3 = S.gunlukUret('2026-10-21');
  assert.deepEqual(d1.bulmaca, d2.bulmaca);
  assert.notDeepEqual(d1.bulmaca, d3.bulmaca);
  assert.equal(S.gunSeviyesi('2026-10-20'), 'kolay', 'salı');
  assert.equal(S.gunSeviyesi('2026-10-22'), 'orta', 'perşembe');
  assert.equal(S.gunSeviyesi('2026-10-24'), 'zor', 'cumartesi');
  assert.equal(S.gunSeviyesi('2026-10-25'), 'uzman', 'pazar');
  assert.equal(d1.seviye, 'kolay');
  assert.equal(S.gunSeviyesi('bozuk'), 'orta');
  for (let g = 0; g < 7; g++) {
    const gun = '2026-11-' + String(2 + g).padStart(2, '0');
    assert.equal(S.gunlukUret(gun).seviye, S.gunSeviyesi(gun), gun);
  }
});

test('üretici hızlı: her seviyede bulmaca üretimi 500 ms altında (Node, worker dışı)', () => {
  const sureler = {};
  for (const seviye of SEVIYELER) {
    let enUzun = 0;
    for (let t = 0; t < 10; t++) { const t0 = Date.now(); S.uret('hiz-' + t, seviye); enUzun = Math.max(enUzun, Date.now() - t0); }
    sureler[seviye] = enUzun;
    assert.ok(enUzun < 500, `${seviye}: ${enUzun} ms`);
  }
});

test('çözücü: çözümsüz ve çoklu çözümlü ızgaraları tanır', () => {
  assert.equal(S.cozumleriSay(new Array(81).fill(0), 2).adet, 2, 'boş ızgara çok çözümlü');
  const r = S.uret('coz', 'orta'), bozuk = r.bulmaca.slice();
  const i = bozuk.findIndex((d) => !d);
  bozuk[i] = (r.cozum[i] % 9) + 1; // yanlış rakam: çoğunlukla çözümsüz
  const sonuc = S.cozumleriSay(bozuk, 2);
  assert.ok(sonuc.adet <= 1 && (sonuc.adet === 0 || sonuc.cozum.some((d, k) => d !== r.cozum[k])));
  const celiski = r.bulmaca.slice(); celiski[r.bulmaca.findIndex((d) => !d)] = r.bulmaca[0];
  const cakis = S.cakisanlar(celiski);
  assert.ok(Array.isArray(cakis));
  assert.deepEqual(S.cakisanlar([1, 1, ...new Array(79).fill(0)]), [0, 1]);
});

test('ipucu: tek aday ve gizli tek Türkçe açıklanır, rakam çözümle tutarlıdır, yanlış rakam önce gösterilir', () => {
  const r = S.uret('ipucu', 'orta');
  const ipucu = S.ipucuBul(r.bulmaca, r.cozum);
  assert.ok(ipucu && ipucu.kutu >= 0 && !r.bulmaca[ipucu.kutu]);
  assert.equal(ipucu.rakam, r.cozum[ipucu.kutu]);
  assert.match(ipucu.aciklama, /tek aday|yeri tek bir kutu/);
  assert.ok(ipucu.aciklama.includes(String(ipucu.rakam)));
  // ipucuyla yerleştirerek bitirilir; her adım çözümle tutarlı kalır
  let g = r.bulmaca.slice(), adim = 0;
  while (g.some((d) => !d) && adim++ < 90) {
    const h = S.ipucuBul(g, r.cozum);
    assert.ok(h && h.yanlis === undefined, 'yanlış rakam yok');
    assert.equal(h.rakam, r.cozum[h.kutu]);
    g[h.kutu] = h.rakam;
  }
  assert.deepEqual(g, r.cozum);
  assert.equal(S.ipucuBul(r.cozum, r.cozum), null, 'çözülmüş ızgarada ipucu yok');
  const yanlis = r.bulmaca.slice(), i = yanlis.findIndex((d) => !d);
  yanlis[i] = (r.cozum[i] % 9) + 1;
  const h = S.ipucuBul(yanlis, r.cozum);
  assert.equal(h.yanlis, i);
  assert.match(h.aciklama, /yanlış/);
  assert.equal(S.rakamEki(7), "7'nin");
  assert.equal(S.rakamEki(6), "6'nın");
  assert.equal(S.rakamEki(3), "3'ün");
  assert.equal(S.rakamEki(9), "9'un");
});

test('ipucu: gizli tek birimi (satır/sütun/blok) belirtir ve zor bulmacada elemelerden sonra da yerleştirme önerir', () => {
  let gizli = null;
  for (let t = 0; t < 20 && !gizli; t++) {
    const r = S.uret('gizli-' + t, 'orta'), h = S.ipucuBul(r.bulmaca, r.cozum);
    if (h && h.teknik === 'gizli-tek') gizli = h;
  }
  assert.ok(gizli, 'orta bulmacalarda gizli tek ipucu çıkmalı');
  assert.ok(gizli.birim >= 0 && gizli.birim < 27);
  assert.match(gizli.aciklama, /(satırda|sütunda|blokta)/);
  const zor = S.uret('zor-ipucu', 'zor');
  const g = zor.bulmaca.slice();
  let adim = 0, eleme = 0;
  while (g.some((d) => !d) && adim++ < 90) {
    const h = S.ipucuBul(g, zor.cozum);
    assert.ok(h, 'ipucu bulunmalı');
    if (h.onceki && h.onceki.length) eleme++;
    g[h.kutu] = h.rakam;
  }
  assert.deepEqual(g, zor.cozum);
});

test('çakışma ve çözüm denetimi', () => {
  const r = S.uret('cak', 'kolay');
  const g = r.cozum.slice();
  assert.deepEqual(S.cakisanlar(g), []);
  g[0] = g[1];
  assert.ok(S.cakisanlar(g).includes(0) && S.cakisanlar(g).includes(1));
});

test('isci.js: gelen isteği 81 rakamlık metinlerle yanıtlar (tohumlu ve günlük)', () => {
  const gelenler = [];
  const self = { postMessage: (v) => gelenler.push(v) };
  const baglam = vm.createContext({ self, importScripts: () => { vm.runInContext(fs.readFileSync(yolu('mantik.js'), 'utf8'), baglam); }, Math });
  vm.runInContext(fs.readFileSync(yolu('isci.js'), 'utf8'), baglam);
  self.onmessage({ data: { no: 3, tohum: 'x', seviye: 'kolay' } });
  self.onmessage({ data: { no: 4, gun: '2026-10-20' } });
  assert.equal(gelenler.length, 2);
  assert.equal(gelenler[0].no, 3);
  assert.match(gelenler[0].bulmaca, /^\d{81}$/); assert.match(gelenler[0].cozum, /^[1-9]{81}$/);
  assert.deepEqual(gelenler[0].bulmaca, S.uret('x', 'kolay').bulmaca.join(''));
  assert.equal(gelenler[1].bulmaca, S.gunlukUret('2026-10-20').bulmaca.join(''));
});

test('sayfa: script sırası, yerleşim öğeleri, nasıl oynanır, kayıt ve günlük çağrıları, tasarım dışı renk yok', () => {
  const html = fs.readFileSync(yolu('index.html'), 'utf8');
  const sira = ['depo.js', 'mantik.js', 'oyun.js'].map((d) => html.indexOf(d + '"'));
  assert.ok(sira.every((x) => x > 0) && sira.every((x, i) => !i || x > sira[i - 1]));
  for (const id of ['izgara', 'tuslar', 'geri-al', 'yinele', 'sil', 'kalem', 'ipucu', 'sure', 'seviye-rozet', 'ayarlar', 'sonuc', 'istatistik']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('<h2>Nasıl oynanır?</h2>'));
  const kod = fs.readFileSync(yolu('oyun.js'), 'utf8');
  assert.ok(kod.includes("Depo.ozetYaz('sudoku'") && kod.includes("Gunluk.kaydet('sudoku'"));
  assert.ok(!/https?:\/\//.test(kod + fs.readFileSync(yolu('mantik.js'), 'utf8')), 'dış bağlantı yok');
  const css = fs.readFileSync(yolu('stil.css'), 'utf8');
  for (const r of css.match(/#[0-9a-fA-F]{3,8}\b/g) || []) assert.equal(r.toLowerCase(), '#b8741a', `stil.css tasarım dışı renk: ${r}`);
});
