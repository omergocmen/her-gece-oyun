'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const M = require('../games/satranc/motor.js');
const BULMACALAR = require('../games/satranc/bulmaca.js');

const KOK = path.join(__dirname, '..');
const yolu = (d) => path.join(KOK, 'games/satranc', d);

function perft(fen, derinlik) { return M.perft(M.fenOku(fen), derinlik); }
function oyna(oyun, ...hamleler) { for (const h of hamleler) { const m = M.hamleBul(oyun.konum, h); assert.ok(m, `yasal değil: ${h}`); oyun.yap(m); } return oyun; }

test('perft: başlangıç pozisyonu derinlik 1-4', () => {
  assert.equal(perft(M.BASLANGIC, 1), 20);
  assert.equal(perft(M.BASLANGIC, 2), 400);
  assert.equal(perft(M.BASLANGIC, 3), 8902);
  assert.equal(perft(M.BASLANGIC, 4), 197281);
});

test('perft: bilinen zor pozisyonlar (Kiwipete, rok/terfi/geçerken alma uçları)', () => {
  assert.equal(perft('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3), 97862);
  assert.equal(perft('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4), 43238);
  assert.equal(perft('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3), 9467);
  assert.equal(perft('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3), 62379);
  assert.equal(perft('r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', 3), 89890);
});

test('FEN yaz/oku gidiş dönüş ve hatalı FEN reddi', () => {
  const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  assert.equal(M.fenYaz(M.fenOku(fen)), fen);
  assert.throws(() => M.fenOku('abc'));
  assert.throws(() => M.fenOku('8/8/8/8/8/8/8/8 w - - 0 1'), /şah/);
});

test('rok: iki yana yapılır; şah tehdit altındayken, geçtiği ya da vardığı kare tehdit altındayken yapılamaz', () => {
  const rok = (fen) => M.yasal(M.fenOku(fen)).map(M.hamleYaz).filter((h) => h === 'e1g1' || h === 'e1c1');
  assert.deepEqual(rok('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1').sort(), ['e1c1', 'e1g1']);
  assert.deepEqual(rok('4k3/8/8/8/8/8/8/R3K2R w - - 0 1'), [], 'hak yoksa rok yok');
  assert.deepEqual(rok('4k3/8/8/8/8/5r2/8/R3K2R w KQ - 0 1'), ['e1c1'], 'f1 tehdit altında: kısa rok yok');
  assert.deepEqual(rok('4k3/8/8/8/8/6r1/8/R3K2R w KQ - 0 1'), ['e1c1'], 'g1 tehdit altında: kısa rok yok');
  assert.deepEqual(rok('4k3/8/8/8/8/4r3/8/R3K2R w KQ - 0 1'), [], 'şah şahta: rok yok');
  assert.deepEqual(rok('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1').sort(), ['e1c1', 'e1g1'], 'b1 tehdidi uzun rokı engellemez');
  assert.deepEqual(rok('4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1'), ['e1g1'], 'arada taş varsa uzun rok yok');
  const o = new M.Oyun('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  oyna(o, 'e1g1');
  assert.equal(M.fenYaz(o.konum).split(' ')[0], '4k3/8/8/8/8/8/8/R4RK1');
  assert.ok(o.sanlar[0] === 'O-O');
  o.geriAl();
  assert.equal(M.fenYaz(o.konum), '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
});

test('geçerken alma yalnızca hemen sonraki hamlede yapılır', () => {
  const o = new M.Oyun('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1');
  oyna(o, 'e2e4');
  assert.ok(M.hamleBul(o.konum, 'd4e3'), 'geçerken alma mümkün');
  oyna(o, 'd4e3');
  assert.equal(M.fenYaz(o.konum).split(' ')[0], '4k3/8/8/8/8/4p3/8/4K3', 'alınan piyon tahtadan kalktı');
  assert.equal(o.sanlar[1], 'dxe3');
  o.geriAl();
  assert.equal(M.fenYaz(o.konum).split(' ')[0], '4k3/8/8/8/3pP3/8/8/4K3', 'geri alınca piyon geri gelir');
  const g = new M.Oyun('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1');
  oyna(g, 'e2e4', 'e8e7', 'e1d1', 'e7e8');
  assert.equal(M.hamleBul(g.konum, 'd4e3'), 0, 'bir hamle gecikince hak düşer');
});

test('terfi: dört taş da seçilir, alarak terfi ve notasyon', () => {
  const o = new M.Oyun('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const ms = M.yasal(o.konum).filter((m) => M.hamleDen(m) === M.kareKodu('a7'));
  const terfiler = ms.filter((m) => M.hamleHedef(m) === M.kareKodu('a8')).map(M.hamleYaz).sort();
  assert.deepEqual(terfiler, ['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r']);
  assert.ok(M.hamleBul(o.konum, 'a7b8q'), 'alarak terfi');
  assert.equal(M.san(o.konum, M.hamleBul(o.konum, 'a7a8q'), 'tr'), 'a8=V');
  assert.equal(M.san(o.konum, M.hamleBul(o.konum, 'a7b8n'), 'tr'), 'axb8=A');
  oyna(o, 'a7a8q');
  assert.equal(M.fenYaz(o.konum).split(' ')[0], 'Qn2k3/8/8/8/8/8/8/4K3');
  o.geriAl();
  assert.equal(M.fenYaz(o.konum).split(' ')[0], '1n2k3/P7/8/8/8/8/8/4K3');
});

test('mat, pat, üç tekrar, elli hamle ve yetersiz materyal', () => {
  const kor = new M.Oyun();
  oyna(kor, 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  assert.deepEqual([kor.durum().sonuc, kor.durum().kazanan], ['mat', M.SIYAH]);
  assert.equal(kor.sanlar[3], 'Vh4#');
  const pat = new M.Oyun('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.deepEqual([pat.durum().sonuc, pat.durum().kazanan], ['pat', null]);
  const tekrar = new M.Oyun();
  oyna(tekrar, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1');
  assert.equal(tekrar.durum().bitti, false, 'iki tekrar henüz beraberlik değil');
  oyna(tekrar, 'f6g8');
  assert.equal(tekrar.durum().sonuc, 'uc-tekrar');
  assert.equal(new M.Oyun('4k3/8/8/8/8/8/8/R3K3 w - - 100 80').durum().sonuc, 'elli-hamle');
  assert.equal(new M.Oyun('4k3/8/8/8/8/8/8/R3K3 w - - 99 80').durum().bitti, false);
  for (const fen of ['4k3/8/8/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/8/8/8/3BK3 w - - 0 1', '4k3/8/8/8/8/8/8/3NK3 w - - 0 1', '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1']) {
    assert.equal(new M.Oyun(fen).durum().sonuc, 'yetersiz', fen);
  }
  for (const fen of ['4k3/8/8/8/8/8/P7/4K3 w - - 0 1', '4k3/8/8/8/8/8/8/2BBK3 w - - 0 1', '4kb2/8/8/8/8/8/8/3BK3 w - - 0 1', '4k3/8/8/8/8/8/8/2NNK3 w - - 0 1']) {
    assert.equal(new M.Oyun(fen).durum().bitti, false, fen);
  }
});

test('Türkçe notasyon: Ş V K F A, ayrım, yeme, şah ve mat işareti; PGN İngilizce harf kullanır', () => {
  const o = new M.Oyun();
  oyna(o, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6');
  assert.deepEqual(o.sanlar, ['e4', 'e5', 'Af3', 'Ac6', 'Fb5', 'a6', 'Fxc6', 'dxc6']);
  const ayri = new M.Oyun('4k3/8/8/8/8/8/4K3/R6R w - - 0 1');
  assert.equal(M.san(ayri.konum, M.hamleBul(ayri.konum, 'a1d1'), 'tr'), 'Kad1');
  const ayri2 = new M.Oyun('4k3/8/8/8/8/2N3N1/8/4K3 w - - 0 1');
  assert.equal(M.san(ayri2.konum, M.hamleBul(ayri2.konum, 'c3e4'), 'tr'), 'Ace4');
  const sah = new M.Oyun('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  assert.equal(M.san(sah.konum, M.hamleBul(sah.konum, 'h1h8'), 'tr'), 'Kh8+');
  const kurt = new M.Oyun();
  oyna(kurt, 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6');
  const pgn = kurt.pgn({ tarih: '2026.10.20', beyaz: 'Sen', siyah: 'Bilgisayar' });
  assert.match(pgn, /\[White "Sen"\]/);
  assert.match(pgn, /1\. e4 e5 2\. Nf3 Nc6 3\. Bc4 Nf6 \*/);
  assert.ok(!/[ŞVFA]/.test(pgn.split('\n\n')[1]), 'PGN hamleleri Türkçe harf içermez');
  const mat = new M.Oyun();
  oyna(mat, 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  assert.match(mat.pgn(), /0-1\n$/);
});

test('açılış adları ve kitap', () => {
  assert.equal(M.acilisAdi(['e2e4', 'c7c5']), 'Sicilya Savunması');
  assert.equal(M.acilisAdi(['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4']), 'Sicilya, Açık Varyant');
  assert.equal(M.acilisAdi(['e2e4']), 'Kral Piyonu Açılışı');
  assert.equal(M.acilisAdi(['a2a3']), null);
  const m = M.kitapHamlesi(['e2e4', 'c7c5'], () => 0);
  assert.ok(m === 'g1f3' || m === null || /^[a-h][1-8][a-h][1-8]$/.test(m));
});

test('tehdit altındaki taşlar: korumasız ya da değerli taşı daha ucuz taş tutuyorsa işaretlenir', () => {
  const ad = (fen, renk) => M.tehditler(M.fenOku(fen), renk).map(M.kareAdi);
  assert.deepEqual(ad('4k3/8/8/4n3/3P4/8/8/4K3 b - - 0 1', M.SIYAH), ['e5'], 'korumasız at piyonla tutuluyor');
  assert.deepEqual(ad('4k3/8/3p4/4r3/3P4/8/8/4K3 b - - 0 1', M.SIYAH), ['e5'], 'korumalı ama değerli kale piyonla tutuluyor');
  assert.deepEqual(ad('4k3/8/3p4/4p3/3P4/8/8/4K3 b - - 0 1', M.SIYAH), [], 'korumalı piyon piyonla tutuluyor: tehdit değil');
  assert.deepEqual(ad('4k3/8/8/4n3/8/8/B7/4K3 b - - 0 1', M.SIYAH), [], 'tutulmayan taş');
  assert.deepEqual(ad('4k3/8/8/8/8/8/8/4K3 w - - 0 1', M.BEYAZ), [], 'şah işaretlenmez');
});

test('arama: tek hamlede matı bulur, seviye 5 en çok 2 saniyede cevap verir, her seviye yasal hamle üretir', () => {
  const mat1 = new M.Oyun('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  assert.equal(M.bilgisayarHamlesi(mat1, 5), 'h5f7');
  const orta = new M.Oyun('r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7');
  for (let seviye = 1; seviye <= 5; seviye++) {
    const t0 = Date.now();
    const uci = M.bilgisayarHamlesi(orta, seviye);
    const gecen = Date.now() - t0;
    assert.ok(M.hamleBul(orta.konum, uci), `seviye ${seviye}: yasal hamle`);
    assert.ok(gecen < 2000, `seviye ${seviye}: ${gecen} ms`);
  }
});

test('bilgisayar kendi kendine bir oyunu hatasız oynar ve tekrar/materyal kurallarıyla biter ya da sürer', () => {
  const o = new M.Oyun();
  for (let i = 0; i < 60 && !o.durum().bitti; i++) oyna(o, M.bilgisayarHamlesi(o, 3, Math.random));
  const fen = M.fenYaz(o.konum);
  while (o.hamleler.length) o.geriAl();
  assert.equal(M.fenYaz(o.konum), M.BASLANGIC, 'tüm hamleler geri alınınca başlangıç: ' + fen);
});

test('Günün Bulmacası havuzu: yeterli sayıda, benzersiz, tek çözümlü ve motorla doğrulanmış', () => {
  assert.ok(BULMACALAR.length >= 150, `havuz küçük: ${BULMACALAR.length}`);
  assert.equal(new Set(BULMACALAR.map((b) => b.fen.split(' ').slice(0, 4).join(' '))).size, BULMACALAR.length, 'aynı konum iki kez var');
  assert.ok(BULMACALAR.some((b) => b.n === 1) && BULMACALAR.some((b) => b.n === 2));
  // Her kaydı doğrulamak yavaştır; ilk, son ve aralıklı örnekleri tam doğrular, geri kalanı yalnızca çözüm hamlesini sınar.
  BULMACALAR.forEach((b, i) => {
    const o = new M.Oyun(b.fen);
    assert.ok(b.n === 1 || b.n === 2, `${i}: n`);
    const m = M.hamleBul(o.konum, b.cozum);
    assert.ok(m, `${i}: çözüm yasal değil`);
    if (i % 5 === 0 || i === BULMACALAR.length - 1) {
      const kazananlar = M.matHamleleri(o.konum, b.n);
      assert.deepEqual(kazananlar.map(M.hamleYaz), [b.cozum], `${i}: ${b.fen} tek çözümlü olmalı`);
      if (b.n === 2) assert.equal(M.matHamleleri(o.konum, 1).length, 0, `${i}: 1 hamlede mat olmamalı`);
    }
  });
});

test('Günün Bulmacası seçimi: aynı gün aynı bulmaca, ardışık günler farklı, havuzu dolaşır', () => {
  const n = BULMACALAR.length;
  assert.equal(M.bulmacaSirasi('2026-10-20', n), M.bulmacaSirasi('2026-10-20', n));
  assert.notEqual(M.bulmacaSirasi('2026-10-20', n), M.bulmacaSirasi('2026-10-21', n));
  const gorulen = new Set();
  for (let g = 0; g < n; g++) gorulen.add(M.bulmacaSirasi(new Date(Date.UTC(2026, 9, 20 + g)).toISOString().slice(0, 10), n));
  assert.equal(gorulen.size, n, 'bir tur içinde hiçbir bulmaca tekrar etmez');
  assert.equal(M.bulmacaSirasi('bozuk', n), 0);
  assert.equal(M.bulmacaSirasi('2026-10-20', 0), 0);
});

test('bulmaca doğrulama: mat-in-2 ilk hamlesi seçilince rakip cevap verir ve ikinci hamlede mat bulunur', () => {
  const b = BULMACALAR.find((x) => x.n === 2);
  const o = new M.Oyun(b.fen);
  oyna(o, b.cozum);
  const cevap = M.savunmaHamlesi(o.konum);
  assert.ok(M.yasal(o.konum).includes(cevap));
  o.yap(cevap);
  const mat = M.matHamleleri(o.konum, 1);
  assert.ok(mat.length >= 1);
  o.yap(mat[0]);
  assert.equal(o.durum().sonuc, 'mat');
});

test('isci.js: gelen isteği yasal bir hamleyle yanıtlar', () => {
  const gelenler = [];
  const self = { postMessage: (v) => gelenler.push(v) };
  const baglam = vm.createContext({ self, importScripts: () => { vm.runInContext(fs.readFileSync(yolu('motor.js'), 'utf8'), baglam); }, Math });
  vm.runInContext(fs.readFileSync(yolu('isci.js'), 'utf8'), baglam);
  self.onmessage({ data: { no: 7, baslangic: M.BASLANGIC, hamleler: ['e2e4'], seviye: 2 } });
  assert.equal(gelenler.length, 1);
  assert.equal(gelenler[0].no, 7);
  const o = new M.Oyun(); oyna(o, 'e2e4');
  assert.ok(M.hamleBul(o.konum, gelenler[0].hamle), 'yasal cevap');
});

test('sayfa: script sırası, SVG taş sembolleri, nasıl oynanır metni, kayıt ve günlük çağrıları', () => {
  const html = fs.readFileSync(yolu('index.html'), 'utf8');
  const sira = ['depo.js', 'motor.js', 'bulmaca.js', 'oyun.js'].map((d) => html.indexOf(d + '"'));
  assert.ok(sira.every((x) => x > 0) && sira.every((x, i) => !i || x > sira[i - 1]), 'depo → motor → bulmaca → oyun sırası');
  for (let t = 1; t <= 6; t++) assert.ok(html.includes(`<symbol id="t-${t}"`), `t-${t} sembolü`);
  assert.ok(html.includes('<h2>Nasıl oynanır?</h2>'));
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(fs.readFileSync(yolu('oyun.js'), 'utf8') + fs.readFileSync(yolu('motor.js'), 'utf8')), 'dış bağlantı yok');
  const kod = fs.readFileSync(yolu('oyun.js'), 'utf8');
  assert.ok(kod.includes("Depo.ozetYaz('satranc'") && kod.includes("Gunluk.kaydet('satranc'"));
  const css = fs.readFileSync(yolu('stil.css'), 'utf8');
  const renkler = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const izinli = new Set(['#5a3b24', '#e9dcc2', '#b8741a']);
  for (const r of renkler) assert.ok(izinli.has(r.toLowerCase()), `stil.css tasarım dışı renk: ${r}`);
});
