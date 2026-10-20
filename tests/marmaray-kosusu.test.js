'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/marmaray-kosusu/mantik.js');

const TOHUMLAR = [1, 7, 42, 2026, 99991, 123456789];
const MESAFE = 6000;

function uret(tohum, mesafe) {
  const u = M.ureticiOlustur(tohum);
  u.ilerlet(mesafe);
  return u;
}

test('aynı tohum aynı parçaları, farklı tohum farklı parçaları üretir', () => {
  const ozet = (u) => u.engeller().map((e) => e.tur + e.serit + e.bas.toFixed(2)).join(',');
  assert.equal(ozet(uret(5, 2000)), ozet(uret(5, 2000)));
  assert.notEqual(ozet(uret(5, 2000)), ozet(uret(6, 2000)));
});

test('başlangıç engelsiz ve tüm engel türleri, gelen ve duran trenler görülür', () => {
  const sayac = { tren: 0, bariyer: 0, tabela: 0, gelen: 0, duran: 0 };
  for (const tohum of TOHUMLAR) {
    const u = uret(tohum, MESAFE);
    for (const e of u.engeller()) {
      assert.ok(e.bas >= M.ILK_BOSLUK - 1, `tohum ${tohum}: ${e.bas} m'de erken engel`);
      assert.ok(M.SERITLER.includes(e.serit));
      sayac[e.tur]++;
      if (e.tur === 'tren') sayac[e.gelen ? 'gelen' : 'duran']++;
    }
    assert.ok(u.jetonlar().length > 200, 'jeton az');
    assert.ok(u.guclendiriciler().length >= 6, 'güçlendirici az');
  }
  for (const k of Object.keys(sayac)) assert.ok(sayac[k] > 100, `${k} çok az: ${sayac[k]}`);
});

// Bağımsız denetim: p ekseninde 0.5 m adımla, trenleri duvar sayan, şerit değişimini süresiyle
// (her geçişte iki şerit de boş olmalı) hesaba katan dinamik programlama. Bariyer zıplanır, tabelanın altından kayılır.
test(`${MESAFE} m boyunca her zaman geçilebilir bir yol var (bağımsız denetim)`, () => {
  const ADIM = 0.5;
  for (const tohum of TOHUMLAR) {
    const u = uret(tohum, MESAFE + 200);
    const trenler = { '-1': [], 0: [], 1: [] };
    for (const e of u.engeller()) if (e.tur === 'tren') trenler[e.serit].push(e);
    const pd = M.OYUNCU.yariDerinlik;
    const serbest = (l, p) => !trenler[l].some((t) => p >= t.bas - pd && p <= t.son + pd);
    const gecmis = [];
    let ulasilan = { '-1': false, 0: true, 1: false };
    for (let i = 0, p = 0; p < MESAFE; i++, p += ADIM) {
      const K = Math.ceil(M.hiz(p) * M.SERIT_DEGISIM / ADIM) + 1;
      const yeni = {};
      for (const l of M.SERITLER) {
        if (!serbest(l, p)) { yeni[l] = false; continue; }
        let ok = ulasilan[l];
        for (const a of [l - 1, l + 1]) {
          if (ok || !(a in ulasilan) || i < K) continue;
          if (!gecmis[i - K][a]) continue;
          let pencere = true;
          for (let j = 0; j <= K && pencere; j++) pencere = serbest(a, p - j * ADIM) && serbest(l, p - j * ADIM);
          ok = pencere;
        }
        yeni[l] = ok;
      }
      gecmis.push(yeni);
      assert.ok(M.SERITLER.some((l) => yeni[l]), `tohum ${tohum}: ${p.toFixed(1)} m'de geçilecek şerit kalmadı`);
      ulasilan = yeni;
    }
  }
});

test('üretici her satırdan sonra ulaşılabilir şerit bırakır ve satırlar yeterince aralıklı', () => {
  for (const tohum of TOHUMLAR) {
    const u = uret(tohum, MESAFE);
    const satirlar = u.satirlar();
    for (let i = 0; i < satirlar.length; i++) {
      const s = satirlar[i];
      assert.ok(s.R.length >= 1, `tohum ${tohum}: ${s.p} m satırı kapalı`);
      for (const l of s.R) assert.notEqual(s.hucreler[l + 1], 'tren');
      if (i > 0) {
        const fark = s.p - satirlar[i - 1].p;
        const sure = fark / M.hiz(satirlar[i - 1].p);
        assert.ok(sure >= M.EN_AZ_SATIR_SURESI - 1e-9, `tohum ${tohum}: satırlar arası ${sure.toFixed(2)} sn`);
        // İki şerit değişimine ve bir zıplamaya yetecek kadar zaman
        assert.ok(sure > 2 * M.SERIT_DEGISIM + 0.3);
      }
    }
  }
});

test('bariyer ve tabela trenle ya da birbiriyle üst üste binmez', () => {
  for (const tohum of TOHUMLAR) {
    const e = uret(tohum, MESAFE).engeller();
    const kucuk = e.filter((x) => x.tur !== 'tren');
    for (const a of kucuk) {
      for (const b of e) {
        if (a === b || a.serit !== b.serit) continue;
        const ust = a.bas < b.son + 0.6 && a.son > b.bas - 0.6;
        assert.ok(!ust, `tohum ${tohum}: ${a.tur}@${a.bas.toFixed(1)} ile ${b.tur}@${b.bas.toFixed(1)} çakışıyor`);
      }
    }
  }
});

test('jetonlar ve güçlendiriciler trenlerin içinde değil', () => {
  for (const tohum of TOHUMLAR) {
    const u = uret(tohum, MESAFE);
    const trenler = u.engeller().filter((e) => e.tur === 'tren');
    for (const j of u.jetonlar().concat(u.guclendiriciler())) {
      for (const t of trenler) assert.ok(!(t.serit === j.serit && j.p > t.bas - 1 && j.p < t.son + 1), `tohum ${tohum}: ${j.p} m'deki ödül trende`);
    }
  }
});

test('hız eğrisi artar, sınırlıdır; zorluk 0..1', () => {
  let once = 0;
  for (let p = 0; p < 20000; p += 50) {
    const h = M.hiz(p);
    assert.ok(h >= once && h >= M.HIZ_BAS && h < M.HIZ_SON);
    once = h;
    const z = M.zorluk(p);
    assert.ok(z >= 0 && z < 1);
  }
  assert.equal(M.hiz(0), M.HIZ_BAS);
  assert.ok(M.hiz(3000) > 25);
});

test('gelen trenler en yüksek hızda da sis içinde en az 1 sn önceden görünür', () => {
  const sure = M.GORUS_MESAFESI / (M.HIZ_SON * (1 + M.GELEN_ORAN));
  assert.ok(sure >= 1, `gelen tren ${sure.toFixed(2)} sn önceden görünüyor`);
  assert.ok(M.GORUS_MESAFESI / M.HIZ_SON >= 1.5);
  // Gelen trenin görünür uzaklığı p ekseninin (1 + oran) katıdır.
  const t = { tur: 'tren', bas: 100, gelen: true };
  assert.equal(M.gorunurUzaklik(t, 90), 10 * (1 + M.GELEN_ORAN));
  assert.equal(M.gorunurUzaklik({ bas: 100 }, 90), 10);
});

test('şerit/kutu çarpışması', () => {
  const tren = { tur: 'tren', serit: 0, bas: 10, son: 20 };
  const bariyer = { tur: 'bariyer', serit: 1, bas: 30, son: 30.5 };
  const tabela = { tur: 'tabela', serit: -1, bas: 40, son: 40.4 };
  const ayakta = (x) => ({ x, y: 0, kayiyor: false });
  assert.equal(M.carpisiyorMu(tren, ayakta(0), 10), true);
  assert.equal(M.carpisiyorMu(tren, ayakta(0), 9.6), false);  // önünde
  assert.equal(M.carpisiyorMu(tren, ayakta(0), 20.4), false); // geçti
  assert.equal(M.carpisiyorMu(tren, ayakta(1), 15), false);   // yan şerit
  assert.equal(M.carpisiyorMu(tren, ayakta(0.5), 15), true);  // şerit değiştirirken yarı yolda
  assert.equal(M.carpisiyorMu(tren, { x: 0, y: 1.9, kayiyor: false }, 15), true); // trenin üstünden zıplanamaz
  // Bariyer: zıplayınca geçilir, kayarak geçilmez
  assert.equal(M.carpisiyorMu(bariyer, ayakta(1), 30.2), true);
  assert.equal(M.carpisiyorMu(bariyer, { x: 1, y: 1.0, kayiyor: false }, 30.2), false);
  assert.equal(M.carpisiyorMu(bariyer, { x: 1, y: 0, kayiyor: true }, 30.2), true);
  // Tabela: kayınca geçilir, ayakta çarpılır
  assert.equal(M.carpisiyorMu(tabela, ayakta(-1), 40.2), true);
  assert.equal(M.carpisiyorMu(tabela, { x: -1, y: 0, kayiyor: true }, 40.2), false);
  assert.equal(M.carpismaBul([tren, bariyer, tabela], ayakta(-1), 40.2), tabela);
  assert.equal(M.carpismaBul([tren, bariyer, tabela], ayakta(0), 25), null);
  // Önden mi yandan mı
  assert.equal(M.carpismaTuru(tren, 10.1), 'on');
  assert.equal(M.carpismaTuru(tren, 15), 'yan');
  assert.equal(M.carpismaTuru(bariyer, 30.2), 'on');
});

test('zıplama yayı bariyeri aşar ve süre içinde yere döner', () => {
  assert.equal(M.ziplamaY(0), 0);
  assert.equal(M.ziplamaY(M.ZIPLAMA.sure), 0);
  assert.ok(Math.abs(M.ziplamaY(M.ZIPLAMA.sure / 2) - M.ZIPLAMA.yukseklik) < 1e-9);
  // Bariyerin üstünde kalınan süre en yüksek hızda bariyeri geçmeye yeter
  let ustte = 0;
  for (let t = 0; t < M.ZIPLAMA.sure; t += 0.001) if (M.ziplamaY(t) > M.YUKSEKLIK.bariyer[1]) ustte += 0.001;
  const gecis = (M.DERINLIK.bariyer + 2 * M.OYUNCU.yariDerinlik) / M.HIZ_SON;
  assert.ok(ustte > gecis + 0.25, `bariyer üstünde ${ustte.toFixed(2)} sn`);
  // Kayarken boy tabelanın altında kalır
  assert.ok(M.OYUNCU.kayarkenBoy < M.YUKSEKLIK.tabela[0]);
  assert.ok(M.OYUNCU.boy > M.YUKSEKLIK.tabela[0]);
});

test('jeton ve güçlendirici toplama, mıknatıs', () => {
  const j = { serit: 0, p: 50, y: 0.9, alindi: false };
  assert.equal(M.jetonAlinirMi(j, { x: 0, y: 0 }, 50.2, false), true);
  assert.equal(M.jetonAlinirMi(j, { x: 1, y: 0 }, 50, false), false);
  assert.equal(M.jetonAlinirMi(j, { x: 1, y: 0 }, 45, true), true);
  assert.equal(M.jetonAlinirMi(j, { x: 0, y: 0 }, 30, true), false);
  assert.equal(M.jetonAlinirMi({ ...j, y: 2.4 }, { x: 0, y: 1.6 }, 50, false), true);
  assert.equal(M.jetonAlinirMi({ ...j, alindi: true }, { x: 0, y: 0 }, 50, false), false);
  assert.equal(M.gucAlinirMi({ serit: -1, p: 80, alindi: false }, { x: -1, y: 0 }, 80.5), true);
  assert.equal(M.gucAlinirMi({ serit: -1, p: 80, alindi: false }, { x: 0, y: 0 }, 80), false);
  assert.equal(M.puanArtisi(10, 2, false), 10 + 2 * M.JETON_PUAN);
  assert.equal(M.puanArtisi(10, 2, true), 2 * (10 + 2 * M.JETON_PUAN));
});

test('temizle sonrası bellek sabit kalır', () => {
  const u = M.ureticiOlustur(77);
  let enCok = 0;
  for (let p = 0; p < 20000; p += 20) {
    u.ilerlet(p + 160);
    u.temizle(p);
    enCok = Math.max(enCok, u.engeller().length + u.jetonlar().length + u.satirlar().length);
  }
  assert.ok(enCok < 400, `en çok ${enCok} nesne`);
});

test('bölümler tünel ve açık arasında sırayla değişir, istasyon adı taşır', () => {
  const u = M.ureticiOlustur(3);
  assert.equal(u.bolum(0).tur, 'tunel');
  const liste = u.bolumler(5000);
  for (let i = 1; i < liste.length; i++) {
    assert.notEqual(liste[i].tur, liste[i - 1].tur);
    assert.equal(liste[i].bas, liste[i - 1].son);
    assert.ok(liste[i].istasyon);
  }
  assert.equal(u.bolum(liste[1].bas + 1).tur, 'acik');
});

test('günlük görev tarihe göre sabittir ve tamamlanınca bir kez ödül verir', () => {
  const g1 = M.gunlukGorev('2026-10-20'), g2 = M.gunlukGorev('2026-10-20');
  assert.deepEqual(g1, g2);
  assert.ok(M.GOREVLER.some((g) => g.id === g1.id));
  assert.ok(!g1.metin.includes('{h}'));
  const turlar = new Set(Array.from({ length: 60 }, (_, i) => M.gunlukGorev(M.tarihAnahtari(new Date(2026, 0, 1 + i))).id));
  assert.ok(turlar.size >= 4);
  assert.equal(M.tarihAnahtari(new Date(2026, 9, 5)), '2026-10-05');

  const ist = { skor: 500, jeton: 1000, mesafe: 99999, zipla: 999, kay: 999, guc: 99 };
  let k = M.yeniKayit();
  const a = M.turuIsle(k, ist, '2026-10-20');
  assert.equal(a.gorevBitti, true);
  assert.equal(a.kayit.jeton, 1000 + M.GOREV_ODULU);
  assert.equal(a.yeniRekor, true);
  const b = M.turuIsle(a.kayit, ist, '2026-10-20');
  assert.equal(b.gorevBitti, false);
  assert.equal(b.kayit.jeton, a.kayit.jeton + 1000);
  assert.equal(b.yeniRekor, false);
  const c = M.turuIsle(b.kayit, { skor: 1, jeton: 0 }, '2026-10-21');
  assert.equal(c.kayit.gorev.tarih, '2026-10-21');
  assert.equal(M.gorevIlerleme({ id: 'jeton', hedef: 50 }, { jeton: 80 }), 50);
});

test('kayıt düzeltme ve karakter açma', () => {
  assert.deepEqual(M.kayitDuzelt(null), M.yeniKayit());
  assert.deepEqual(M.kayitDuzelt('bozuk'), M.yeniKayit());
  const k = M.kayitDuzelt({ enIyi: 12.7, jeton: -4, acik: ['kedi', 'yok', 'kedi'], secili: 'kedi', ses: false, gorev: { tarih: '2026-10-20', tamam: true } });
  assert.equal(k.enIyi, 12);
  assert.equal(k.jeton, 0);
  assert.deepEqual(k.acik, ['marti', 'kedi']);
  assert.equal(k.secili, 'kedi');
  assert.equal(k.ses, false);
  assert.deepEqual(k.gorev, { tarih: '2026-10-20', tamam: true });
  assert.equal(M.kayitDuzelt({ secili: 'hamal' }).secili, 'marti');

  let kayit = Object.assign(M.yeniKayit(), { jeton: 100 });
  let s = M.karakterAc(kayit, 'hamal');
  assert.match(s.hata, /50 jeton/);
  assert.equal(s.kayit, kayit);
  s = M.karakterAc(kayit, 'kedi');
  assert.equal(s.hata, null);
  assert.equal(s.kayit.jeton, 40);
  assert.equal(s.kayit.secili, 'kedi');
  assert.equal(kayit.jeton, 100, 'orijinal kayıt değişmez');
  s = M.karakterAc(s.kayit, 'marti');
  assert.equal(s.kayit.secili, 'marti');
  assert.equal(s.kayit.jeton, 40);
  assert.ok(M.karakterAc(kayit, 'ejder').hata);
});
