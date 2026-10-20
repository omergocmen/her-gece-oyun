'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../games/smac/mantik.js');

const O = S.BASLANGIC;

// İdeal hıza karşılık gelen kaydırma girdisi (yardımsız ham atış için).
function girdiIcin(hiz, az) {
  const guc = (hiz - S.VMIN) / (S.VMAX - S.VMIN);
  return S.kaydirmaGirdisi(guc, az);
}
function at(pota, girdi, yardim, t0) {
  const atis = S.atisHesapla(girdi, O, pota, { yardim, t: t0 || 0 });
  assert.ok(atis, 'atış hesaplanamadı');
  return S.tamamla(S.atisBaslat(atis, O, pota, t0 || 0));
}
const potaSabit = (x, z) => ({ x, z, kayma: null, indeks: 0 });

test('aynı girdi aynı sonucu verir ve kare süresinden bağımsızdır (20/30/60/144 fps)', () => {
  const pota = potaSabit(0.3, -5.5);
  const atis = S.atisHesapla(S.kaydirmaGirdisi(0.5, 0.02), O, pota, { yardim: 'normal' });
  const sonuclar = [1 / 30, 1 / 60, 1 / 144, 1 / 20].map((kare) => {
    const s = S.atisBaslat(atis, O, pota, 0);
    let b = 0;
    for (let i = 0; i < 4000 && !s.bitti; i++) b = S.ilerlet(s, b, kare);
    return [s.sonuc, s.adim, +s.x.toFixed(9), +s.y.toFixed(9), +s.z.toFixed(9)];
  });
  for (const r of sonuclar) assert.deepEqual(r, sonuclar[0]);
  const ikinci = at(pota, S.kaydirmaGirdisi(0.5, 0.02), 'normal');
  assert.equal(ikinci.sonuc, sonuclar[0][0]);
});

test('ideal atış her uzaklıkta ve yanda temiz sayı olur (yardımsız)', () => {
  for (let d = 4.4; d <= 8.2; d += 0.4) {
    for (const x of [-1.5, -0.7, 0, 0.6, 1.4]) {
      const pota = potaSabit(x, -d);
      const ideal = S.idealAtis(O, x, -d);
      const s = at(pota, girdiIcin(ideal.hiz, ideal.az), 'yok');
      assert.equal(s.sonuc, 'sayi', `d=${d} x=${x}`);
      assert.ok(s.temiz, `temiz olmadı d=${d} x=${x}`);
    }
  }
});

test('çok zayıf atış hava topu, çok güçlü atış sayı olmaz', () => {
  const pota = potaSabit(0, -5.5);
  const zayif = at(pota, S.kaydirmaGirdisi(0.05, 0), 'yok');
  assert.equal(zayif.sonuc, 'hava');
  assert.equal(zayif.tabela + zayif.rim, 0);
  const guclu = at(pota, S.kaydirmaGirdisi(1, 0), 'yok');
  assert.notEqual(guclu.sonuc, 'sayi');
});

test('tabela: top ön yüzden geri döner (vz yön değiştirir, z tabelanın önünde kalır)', () => {
  const pota = potaSabit(0, -5);
  const zf = pota.z - S.TABELA_ARKA;
  const s = S.atisBaslat({ vel: { x: 0, y: 0, z: -9 } }, { x: 0, y: S.HY + 0.3, z: zf + 2 }, pota, 0);
  let carpti = false;
  for (let i = 0; i < 600 && !carpti; i++) {
    S.adim(s);
    if (s.tabela) carpti = true;
    assert.ok(s.z - S.R >= zf - 1e-9, 'top tabelanın içinden geçti');
  }
  assert.ok(carpti);
  assert.ok(s.vz > 0, 'tabela sonrası top geri gelmeli');
  assert.ok(s.olaylar.some((o) => o.tur === 'tabela'));
});

test('çember kenarı: yukarıdan gelen top halkaya düşünce sekip yukarı çıkar, sayı olmaz', () => {
  const pota = potaSabit(0, -5);
  const s = S.atisBaslat({ vel: { x: 0, y: 0, z: 0 } }, { x: S.RR + 0.1, y: S.HY + 1.0, z: pota.z }, pota, 0);
  let enYuksekSonra = -1, sekti = false;
  for (let i = 0; i < 400; i++) {
    S.adim(s);
    if (s.rim && !sekti) sekti = true;
    if (sekti) enYuksekSonra = Math.max(enYuksekSonra, s.vy);
  }
  assert.ok(sekti, 'çembere değmedi');
  assert.ok(enYuksekSonra > 0.3, 'çember topu yukarı sektirmeli: ' + enYuksekSonra);
  assert.ok(s.olaylar.some((o) => o.tur === 'rim'));
});

test('çemberin içinden aşağı inen top sayıdır; aşağıdan yukarı çıkan ya da dışından inen sayılmaz', () => {
  const pota = potaSabit(0, -5);
  const icten = S.atisBaslat({ vel: { x: 0, y: 0, z: 0 } }, { x: 0.05, y: S.HY + 0.8, z: pota.z }, pota, 0);
  S.tamamla(icten);
  assert.equal(icten.sonuc, 'sayi');
  assert.ok(icten.temiz);
  const disaridan = S.atisBaslat({ vel: { x: 0, y: 0, z: 0 } }, { x: S.RR + 0.5, y: S.HY + 0.8, z: pota.z }, pota, 0);
  S.tamamla(disaridan);
  assert.notEqual(disaridan.sonuc, 'sayi');
  const alttan = S.atisBaslat({ vel: { x: 0, y: 7, z: 0 } }, { x: 0, y: S.HY - 1.5, z: pota.z }, pota, 0);
  for (let i = 0; i < 80; i++) S.adim(alttan);
  assert.equal(alttan.sayi, false, 'aşağıdan yukarı geçiş sayı olmamalı');
});

test('tünelleme: çok hızlı toplar çemberin ve tabelanın içinden geçemez', () => {
  const rnd = S.rng(7);
  const pota = potaSabit(0.2, -5.2);
  const zf = pota.z - S.TABELA_ARKA;
  for (let n = 0; n < 400; n++) {
    const hiz = 8 + rnd() * 9; // en hızlı gerçek atıştan (11.5) fazla
    const yon = (rnd() - 0.5) * 0.5;
    const bas = { x: 0.2 + (rnd() - 0.5) * 1.4, y: S.HY + (rnd() - 0.5) * 1.2, z: pota.z + 1.5 + rnd() };
    const s = S.atisBaslat({ vel: { x: hiz * Math.sin(yon) * 0.4, y: (rnd() - 0.5) * 6, z: -hiz } }, bas, pota, 0);
    for (let i = 0; i < 360 && !s.bitti; i++) {
      const oz = s.z, oy = s.y;
      S.adim(s);
      const ex = s.x - pota.x, ez = s.z - pota.z;
      const rho = Math.hypot(ex, ez) || 1e-9;
      const px = pota.x + (ex / rho) * S.RR, pz = pota.z + (ez / rho) * S.RR;
      const dist = Math.hypot(s.x - px, s.y - S.HY, s.z - pz);
      assert.ok(dist >= S.R + S.TUP - 1e-6, `çemberin içine girdi (n=${n}, i=${i}, d=${dist})`);
      // Tabelanın ön yüzünü dikdörtgenin içinde geçmek yasak (üstünden ya da yanından aşmak serbest)
      const icerde = (y) => Math.abs(s.x - pota.x) < S.TABELA_YARI_EN && y > S.TABELA_ALT && y < S.TABELA_UST;
      if (oz - S.R >= zf && s.z - S.R < zf) assert.ok(!(icerde(oy) && icerde(s.y)), `tabelanın içinden geçti (n=${n}, i=${i})`);
    }
  }
});

test('yardım: ham hata yardımla küçülür, çok büyük hata olduğu gibi kalır', () => {
  const pota = potaSabit(0, -5.5);
  const ideal = S.idealAtis(O, 0, -5.5);
  const sapma = (yardim, carpan) => {
    const a = S.atisHesapla(girdiIcin(ideal.hiz * carpan, 0), O, pota, { yardim });
    return Math.abs(a.hiz - ideal.hiz);
  };
  const yok = sapma('yok', 1.08), normal = sapma('normal', 1.08), kolay = sapma('kolay', 1.08);
  assert.ok(kolay < normal && normal < yok);
  assert.ok(Math.abs(sapma('kolay', 1.4) - sapma('yok', 1.4)) < 1e-9);
  const a = S.atisHesapla(S.kaydirmaGirdisi(0.5, 0.2), O, pota, { yardim: 'kolay' });
  assert.ok(Math.abs(a.az - a.ideal.az) < Math.abs(a.ham.az - a.ideal.az));
});

test('yavaş ya da yan kaydırma atış sayılmaz; hız güçle artar', () => {
  const pota = potaSabit(0, -5);
  assert.equal(S.atisHesapla({ vx: 0, yukari: 0.3 }, O, pota), null);
  assert.equal(S.atisHesapla({ vx: 3, yukari: 0.5 }, O, pota), null);
  assert.equal(S.atisHesapla({ vx: 0, yukari: -2 }, O, pota), null);
  const z = S.atisHesapla(S.kaydirmaGirdisi(0.1, 0), O, pota, { yardim: 'yok' });
  const g = S.atisHesapla(S.kaydirmaGirdisi(0.9, 0), O, pota, { yardim: 'yok' });
  assert.ok(g.hiz > z.hiz);
  assert.ok(z.hiz >= S.VMIN - 1e-9 && g.hiz <= S.VMAX + 1e-9);
});

test('önizleme noktaları: 6 nokta, yayın başından çember yüksekliğine kadar', () => {
  const pota = potaSabit(0, -5.5);
  const ideal = S.idealAtis(O, 0, -5.5);
  const a = S.atisHesapla(girdiIcin(ideal.hiz, 0), O, pota, { yardim: 'yok' });
  const n = S.yorunge(a, O, 6);
  assert.equal(n.length, 6);
  assert.ok(Math.abs(n[5].y - S.HY) < 1e-6);
  assert.ok(Math.abs(n[5].z - (-5.5)) < 0.05);
  assert.ok(n[0].z < O.z);
});

test('günlük pota dizisi aynı gün aynı, başka gün farklıdır; temel konumlar sınırlı', () => {
  const t1 = S.gunTohumu('2026-10-20'), t2 = S.gunTohumu('2026-10-21');
  const dizi = (t) => Array.from({ length: 30 }, (_, i) => S.potaKonum(t, i, 0));
  assert.deepEqual(dizi(t1), dizi(t1));
  assert.notDeepEqual(dizi(t1), dizi(t2));
  for (const p of dizi(t1).concat(dizi(t2))) {
    assert.ok(p.z <= -4.4 && p.z >= -7.9, 'uzaklık aralığı: ' + p.z);
    assert.ok(Math.abs(p.x) <= 1.2, 'yan: ' + p.x);
  }
  assert.equal(S.gunAnahtari(new Date(2026, 9, 5)), '2026-10-05');
});

test('seri 3+ potayı kaydırır, 6+ uzaklaştırır; kayma 1 sn gecikmeyle başlar ve sınırda kalır', () => {
  const t = 12345;
  const p0 = S.potaKonum(t, 4, 0), p2 = S.potaKonum(t, 4, 2), p3 = S.potaKonum(t, 4, 3), p9 = S.potaKonum(t, 4, 9);
  assert.equal(p0.kayma, null);
  assert.equal(p2.kayma, null);
  assert.ok(p3.kayma && p9.kayma);
  assert.equal(p3.z, p0.z);
  assert.ok(p9.z < p0.z, 'seri 6+ pota uzaklaşmalı');
  assert.equal(S.potaX(p3, 0.5), p3.x);
  assert.equal(S.potaX(p3, 1.0), p3.x);
  for (let s = 3; s < 30; s++) {
    const p = S.potaKonum(t, 4, s);
    for (let tt = 0; tt < 20; tt += 0.1) assert.ok(Math.abs(S.potaX(p, tt)) <= 1.95, 'pota sahadan taştı');
  }
});

test('hareketli potada atış varış anındaki konuma nişan alır ve sayı olur', () => {
  const pota = S.potaKonum(99, 5, 5);
  assert.ok(pota.kayma);
  let sayi = 0;
  for (const t0 of [1.0, 1.7, 2.4, 3.1, 4.0]) {
    // Oyuncu potanın varış anındaki konumuna doğru atar (önden kestirir)
    let ideal = S.idealAtis(O, S.potaX(pota, t0), pota.z);
    ideal = S.idealAtis(O, S.potaX(pota, t0 + ideal.ucus), pota.z);
    const a = S.atisHesapla(girdiIcin(ideal.hiz, ideal.az), O, pota, { yardim: 'normal', t: t0 });
    const s = S.tamamla(S.atisBaslat(a, O, pota, t0));
    if (s.sonuc === 'sayi') sayi++;
  }
  assert.ok(sayi >= 4, 'hareketli potada önden kestirilen atışlarla çoğunlukla sayı olmalı: ' + sayi);
});

test('çarpan ve seri: 3 sayıda "Smaç", ıskada seri sıfırlanır, çarpan 5\'te kalır', () => {
  assert.deepEqual([0, 2, 3, 5, 6, 9, 12, 40].map(S.carpan), [1, 1, 2, 2, 3, 4, 5, 5]);
  const tur = S.yeniTur('sure', 1);
  const sonuclar = [];
  for (let i = 0; i < 3; i++) sonuclar.push(S.atisKaydet(tur, { sonuc: 'sayi', temiz: true }));
  assert.deepEqual(sonuclar.map((t) => t.tur), ['sayi', 'sayi', 'smac']);
  assert.deepEqual(sonuclar.map((t) => t.puan), [3, 3, 3 + 2]);
  assert.equal(tur.puan, 11);
  assert.equal(tur.seri, 3);
  const kenar = S.atisKaydet(tur, { sonuc: 'sayi', temiz: false }); // çarpan x2, temiz değil
  assert.equal(kenar.puan, 2 * 2);
  assert.equal(S.atisKaydet(tur, { sonuc: 'hava' }).tur, 'hava');
  assert.equal(tur.seri, 0);
  assert.equal(tur.enSeri, 4);
  assert.equal(S.atisKaydet(tur, { sonuc: 'iska' }).tur, 'iska');
});

test('modlar: 60 sn süre biter, sonsuz 3 ıskada, günlük 10 atışta biter', () => {
  const sure = S.yeniTur('sure', 1);
  S.sureDus(sure, 59.5);
  assert.equal(sure.bitti, false);
  S.sureDus(sure, 1);
  assert.equal(sure.kalan, 0);
  assert.equal(sure.bitti, true);
  const sonsuz = S.yeniTur('sonsuz', 1);
  for (let i = 0; i < 2; i++) S.atisKaydet(sonsuz, { sonuc: 'hava' });
  assert.equal(sonsuz.bitti, false);
  S.atisKaydet(sonsuz, { sonuc: 'sayi', temiz: true });
  S.atisKaydet(sonsuz, { sonuc: 'iska' });
  assert.equal(sonsuz.bitti, true);
  const gunluk = S.yeniTur('gunluk', S.gunTohumu('2026-10-20'));
  for (let i = 0; i < 9; i++) S.atisKaydet(gunluk, { sonuc: 'sayi', temiz: true });
  assert.equal(gunluk.bitti, false);
  S.atisKaydet(gunluk, { sonuc: 'hava' });
  assert.equal(gunluk.bitti, true);
  assert.equal(S.yeniTur('bilinmeyen', 1).mod, 'sure');
});

test('bot: günlük turu kusursuz botla 10/10, küçük hatalarla çoğunlukla sayı', () => {
  const oyna = (hata, tohumRng) => {
    const tur = S.yeniTur('gunluk', S.gunTohumu('2026-10-20'));
    const r = S.rng(tohumRng);
    const t = 1.5;
    while (!tur.bitti) {
      const pota = S.sonrakiPota(tur);
      const ideal = S.idealAtis(O, S.potaX(pota, t), pota.z);
      const g = girdiIcin(ideal.hiz * (1 + (r() - 0.5) * hata), ideal.az + (r() - 0.5) * hata);
      const a = S.atisHesapla(g, O, pota, { yardim: 'normal', t });
      const s = S.tamamla(S.atisBaslat(a, O, pota, t));
      S.atisKaydet(tur, { sonuc: s.sonuc, temiz: s.temiz });
    }
    return tur;
  };
  const kusursuz = oyna(0, 1);
  assert.equal(kusursuz.sayi, 10);
  assert.equal(kusursuz.smac, 3);
  const orta = oyna(0.04, 2);
  assert.ok(orta.sayi >= 6, 'küçük hatalarla çoğu atış sayı olmalı: ' + orta.sayi);
  const sacma = oyna(0.9, 3);
  assert.ok(sacma.sayi < 10, 'çok hatalı bot kusursuz oynamamalı');
});

test('oyun dosyaları: three.js yalnızca ortak kopyadan, harici adres yok, dosyalar games.json\'da', () => {
  const kok = path.join(__dirname, '..');
  const oyun = JSON.parse(fs.readFileSync(path.join(kok, 'games.json'), 'utf8')).find((o) => o.slug === 'smac');
  assert.ok(oyun, 'games.json kaydı yok');
  assert.equal(oyun.boyut, '3D');
  assert.equal(oyun.gunluk, true);
  assert.ok(oyun.dosyalar.includes('assets/vendor/three/three.module.min.js'));
  for (const d of oyun.dosyalar) assert.ok(fs.existsSync(path.join(kok, d)), 'eksik: ' + d);
  const js = fs.readFileSync(path.join(kok, 'games/smac/oyun.js'), 'utf8');
  assert.match(js, /from 'three'/);
  const html = fs.readFileSync(path.join(kok, 'games/smac/index.html'), 'utf8');
  assert.match(html, /assets\/vendor\/three\/three\.module\.min\.js/);
  for (const dosya of ['oyun.js', 'mantik.js', 'stil.css']) {
    const m = fs.readFileSync(path.join(kok, 'games/smac', dosya), 'utf8');
    assert.doesNotMatch(m, /https?:\/\//, dosya + ' harici adres içeriyor');
  }
  const toplam = oyun.dosyalar.filter((d) => d.startsWith('games/smac/') && !d.endsWith('/'))
    .reduce((t, d) => t + fs.statSync(path.join(kok, d)).size, 0);
  assert.ok(toplam < 1.5 * 1024 * 1024, 'oyunun kendi dosyaları 1,5 MB üstünde: ' + toplam);
});
