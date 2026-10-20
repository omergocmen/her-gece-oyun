'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../games/karsidan-karsiya/mantik.js');

const TOHUMLAR = [1, 7, 42, 2026, 99991, 123456789];
const N = 1500;

// Döngü üzerinde sıralı nesneler arasındaki boşluklar (sarmalı, son ile ilk arası dahil).
function bosluklar(serit) {
  const araliklar = serit.nesneler
    .map((n) => [M.sar(n.x0 - n.uzunluk / 2, serit.dongu), n.uzunluk])
    .sort((a, b) => a[0] - b[0]);
  return araliklar.map(([bas, u], i) => {
    const [sonrakiBas] = araliklar[(i + 1) % araliklar.length];
    let b = sonrakiBas - (bas + u);
    if (i === araliklar.length - 1) b += serit.dongu;
    return b;
  });
}

test('aynı tohum aynı şeritleri, farklı tohum farklı şeritleri üretir', () => {
  const a = M.ureticiOlustur(5), b = M.ureticiOlustur(5), c = M.ureticiOlustur(6);
  const ozet = (u) => Array.from({ length: 200 }, (_, i) => u.seritAl(i).tur).join(',');
  assert.equal(ozet(a), ozet(b));
  assert.notEqual(ozet(a), ozet(c));
  assert.equal(a.seritAl(-1), null);
});

test('başlangıç kaldırımı boş ve karakterin önü açık', () => {
  for (const tohum of TOHUMLAR) {
    const u = M.ureticiOlustur(tohum);
    for (let i = 0; i < 5; i++) {
      const s = u.seritAl(i);
      assert.equal(s.tur, 'kaldirim');
      for (const c of [-1, 0, 1]) assert.ok(!M.engelVarMi(s, c), `tohum ${tohum} satır ${i} sütun ${c} kapalı`);
    }
  }
});

test(`üretilen ${N} şeritte her zaman geçilebilir bir yol var (ızgara BFS)`, () => {
  for (const tohum of TOHUMLAR) {
    const u = M.ureticiOlustur(tohum);
    // Bağımsız BFS: sabit engeller duvar; hareketli şeritlerde araç/tekne zamanlaması ayrıca test edilir.
    let ulasilan = new Set([0]);
    for (let satir = M.BASLANGIC_SATIRI + 1; satir < N; satir++) {
      const s = u.seritAl(satir);
      const yeni = new Set();
      for (const c of ulasilan) if (M.hareketSerbest(s, c)) yeni.add(c);
      // Satır içinde sola/sağa yayıl (yol, ray ve su şeritleri sabit engel içermez).
      const kuyruk = [...yeni];
      while (kuyruk.length) {
        const c = kuyruk.pop();
        for (const k of [c - 1, c + 1]) if (!yeni.has(k) && M.hareketSerbest(s, k)) { yeni.add(k); kuyruk.push(k); }
      }
      assert.ok(yeni.size > 0, `tohum ${tohum}: satır ${satir} geçilemiyor`);
      if (s.tur === 'kaldirim') assert.ok(yeni.size >= 2, `tohum ${tohum}: satır ${satir} çok dar`);
      ulasilan = yeni;
    }
  }
});

test('her hareketli şeritte güvenli geçiş penceresi var', () => {
  const sayac = { yol: 0, ray: 0, su: 0, kaldirim: 0 };
  for (const tohum of TOHUMLAR) {
    const u = M.ureticiOlustur(tohum);
    for (let satir = 0; satir < N; satir++) {
      const s = u.seritAl(satir);
      sayac[s.tur]++;
      if (s.tur === 'yol') {
        assert.ok(s.nesneler.length >= 1);
        for (const b of bosluklar(s)) assert.ok(b >= M.EN_AZ_ARABA_ARASI - 1e-9, `satır ${satir}: araç arası ${b.toFixed(2)}`);
        assert.ok(s.hiz > 0 && s.hiz <= 5.6);
        // Araç arası, oyuncu hücresi ve zıplama süresine (0.12 sn) yetecek kadar geniş.
        assert.ok(M.EN_AZ_ARABA_ARASI > 2 * M.OYUNCU_YARI + s.hiz * 0.12 + 0.5);
      } else if (s.tur === 'su') {
        assert.ok(s.nesneler.length >= 2);
        for (const b of bosluklar(s)) {
          assert.ok(b <= M.EN_COK_SU_BOSLUGU + 1e-9, `satır ${satir}: su boşluğu ${b.toFixed(2)}`);
          assert.ok(b > 0, `satır ${satir}: tekneler üst üste`);
        }
      } else if (s.tur === 'ray') {
        const gecis = (2 * M.SINIR + 1 + s.nesneler[0].uzunluk) / s.hiz;
        assert.ok(s.periyot - gecis >= M.TRAMVAY_EN_AZ_BOSLUK, `satır ${satir}: tramvay arası çok kısa`);
      }
    }
  }
  // Uzun koşuda tüm şerit türleri görülür.
  for (const tur of Object.keys(sayac)) assert.ok(sayac[tur] > 50, `${tur} şeridi çok az: ${sayac[tur]}`);
});

test('her yol şeridinde herhangi bir sütun beklenince kısa sürede boşalır', () => {
  const u = M.ureticiOlustur(31337);
  for (let satir = 0; satir < 600; satir++) {
    const s = u.seritAl(satir);
    if (s.tur !== 'yol') continue;
    for (let c = -M.SINIR; c <= M.SINIR; c++) {
      // 0-6 sn içinde hücrenin en az 0.4 sn kesintisiz boş kaldığı bir an bulunmalı.
      let bos = 0, bulundu = false;
      for (let t = 0; t < 6 && !bulundu; t += 0.02) {
        bos = M.hucreDoluMu(s, c, t) ? 0 : bos + 0.02;
        if (bos >= 0.4) bulundu = true;
      }
      assert.ok(bulundu, `satır ${satir} sütun ${c} hiç boşalmıyor`);
    }
  }
});

test('ızgara çarpışması: araç kapladığı hücrelerde çarpar, boşlukta çarpmaz', () => {
  const serit = { tur: 'yol', yon: 1, hiz: 2, dongu: M.DUNYA, nesneler: [{ tip: 'taksi', uzunluk: 1.5, x0: 0 }] };
  assert.equal(M.hucreDoluMu(serit, 0, 0), true);
  assert.equal(M.hucreDoluMu(serit, 1, 0), true);   // |1-0| < 0.75+0.3
  assert.equal(M.hucreDoluMu(serit, 2, 0), false);
  assert.equal(M.hucreDoluMu(serit, -2, 0), false);
  // 1 sn sonra araç 2 hücre sağa gitmiştir.
  assert.equal(M.hucreDoluMu(serit, 2, 1), true);
  assert.equal(M.hucreDoluMu(serit, 0, 1), false);
  // Şerit sonunda sarılır: x0 = 12.5 → bir sn sonra -11.5 civarı.
  const sarilan = Object.assign({}, serit, { nesneler: [{ tip: 'taksi', uzunluk: 1.5, x0: 12.5 }] });
  assert.equal(M.hucreDoluMu(sarilan, -12, 1), true);
  // Kaldırım ve suda araç çarpması olmaz.
  assert.equal(M.carpismaVarMi({ tur: 'kaldirim', engeller: [] }, 0, 0), false);
  // Sabit engel hareketi engeller, sınır dışı da kapalıdır.
  const kaldirim = { tur: 'kaldirim', engeller: [{ sutun: 2, tip: 'cop' }] };
  assert.equal(M.hareketSerbest(kaldirim, 2), false);
  assert.equal(M.hareketSerbest(kaldirim, 1), true);
  assert.equal(M.hareketSerbest(kaldirim, M.SINIR + 1), false);
  assert.equal(M.hareketSerbest(null, 0), false);
});

test('su: tekne üstünde kalınır, boşlukta düşülür; yuvalar hücreye oturur', () => {
  const su = { tur: 'su', yon: -1, hiz: 1, dongu: M.DUNYA, nesneler: [{ tip: 'vapur', uzunluk: 4, x0: 0 }, { tip: 'sandal', uzunluk: 2, x0: 6 }] };
  assert.equal(M.tekneBul(su, 1.9, 0), 0);
  assert.equal(M.tekneBul(su, 3, 0), -1);
  assert.equal(M.tekneBul(su, 6, 0), 1);
  assert.equal(M.tekneBul(su, 4, 1), 1); // sandal 1 sn sonra 5'te
  assert.deepEqual([-2, -0.6, 0.2, 1.4, 9].map((o) => M.yuvaOfseti(4, o)), [-1.5, -0.5, 0.5, 1.5, 1.5]);
  assert.deepEqual([-1, 0.2, 0.9].map((o) => M.yuvaOfseti(2, o)), [-0.5, 0.5, 0.5]);
});

test('tramvay uyarısı: alana girmeden önce kalan süre azalır, içindeyken 0', () => {
  const ray = { tur: 'ray', yon: 1, hiz: 10, dongu: 80, periyot: 8, nesneler: [{ tip: 'tramvay', uzunluk: 7, x0: -20 }] };
  // Ön uç -16.5'te, alan -4.5'ten başlıyor: 12 hücre / 10 = 1.2 sn.
  assert.ok(Math.abs(M.tramvayaKalan(ray, 0) - 1.2) < 1e-9);
  assert.equal(M.tramvayaKalan(ray, 2), 0);
  assert.ok(M.tramvayaKalan(ray, 4) > 3);
  assert.equal(M.hucreDoluMu(ray, 0, 2), true);
});

test('zorluk mesafeyle artar, başta düşük kalır', () => {
  assert.equal(M.zorluk(0), 0);
  assert.ok(M.zorluk(50) < M.zorluk(150));
  assert.ok(M.zorluk(1000) < 1 && M.zorluk(1000) > 0.95);
  // Uzakta araçlar ortalama daha hızlıdır.
  const u = M.ureticiOlustur(8);
  const ort = (a, b) => {
    const h = [];
    for (let i = a; i < b; i++) { const s = u.seritAl(i); if (s.tur === 'yol') h.push(s.hiz); }
    return h.reduce((x, y) => x + y, 0) / h.length;
  };
  assert.ok(ort(5, 60) < ort(400, 500));
});

test('koca martı beklemeyi cezalandırır', () => {
  assert.equal(M.kovalayiciDurumu(0, 10).yakala, false);
  assert.equal(M.kovalayiciDurumu(0, 10).uyari, false);
  assert.equal(M.kovalayiciDurumu(M.kovalayiciEsigi(10) - 1, 10).uyari, true);
  assert.equal(M.kovalayiciDurumu(M.kovalayiciEsigi(10), 10).yakala, true);
  assert.ok(M.kovalayiciEsigi(500) < M.kovalayiciEsigi(5));
  assert.ok(M.kovalayiciEsigi(5000) >= 6);
});

test('skor, rekor ve simit cüzdanı', () => {
  assert.equal(M.skorHesapla(M.BASLANGIC_SATIRI), 0);
  assert.equal(M.skorHesapla(M.BASLANGIC_SATIRI + 17), 17);
  let k = M.yeniKayit();
  let s = M.turuIsle(k, 12, 3);
  assert.equal(s.yeniRekor, true);
  assert.equal(s.kayit.enIyi, 12);
  assert.equal(s.kayit.simit, 3);
  assert.equal(k.enIyi, 0, 'eski kayıt değişmemeli');
  s = M.turuIsle(s.kayit, 5, 2);
  assert.equal(s.yeniRekor, false);
  assert.equal(s.kayit.enIyi, 12);
  assert.equal(s.kayit.simit, 5);
});

test('karakter açma ve seçme simit harcar, yetmezse reddedilir', () => {
  let k = Object.assign(M.yeniKayit(), { simit: 30 });
  let s = M.karakterAc(k, 'marti');
  assert.match(s.hata, /20 simit/);
  assert.equal(s.kayit, k);
  s = M.karakterAc(k, 'kedi');
  assert.equal(s.hata, null);
  assert.equal(s.kayit.simit, 5);
  assert.deepEqual(s.kayit.acik, ['simitci', 'kedi']);
  assert.equal(s.kayit.secili, 'kedi');
  // Açık karakter tekrar açılınca para düşmez, yalnızca seçilir.
  const s2 = M.karakterAc(M.karakterSec(s.kayit, 'simitci'), 'kedi');
  assert.equal(s2.kayit.simit, 5);
  assert.equal(s2.kayit.secili, 'kedi');
  // Kilitli karakter seçilemez.
  assert.equal(M.karakterSec(s.kayit, 'hamal').secili, 'kedi');
  assert.match(M.karakterAc(k, 'ejderha').hata, /yok/);
});

test('depodan gelen kayıt sayfa yenilenince korunur, bozuk veri temizlenir', () => {
  const kayit = M.karakterAc(Object.assign(M.yeniKayit(), { enIyi: 40, simit: 120 }), 'hamal').kayit;
  kayit.ses = false;
  const geri = M.kayitDuzelt(JSON.parse(JSON.stringify(kayit)));
  assert.deepEqual(geri, kayit);
  assert.deepEqual(M.kayitDuzelt(null), M.yeniKayit());
  assert.deepEqual(M.kayitDuzelt('bozuk'), M.yeniKayit());
  const temiz = M.kayitDuzelt({ enIyi: -3, simit: 'çok', acik: ['ejderha', 'kedi'], secili: 'marti', ses: 'evet' });
  assert.deepEqual(temiz, { enIyi: 0, simit: 0, acik: ['simitci', 'kedi'], secili: 'simitci', ses: true });
});
