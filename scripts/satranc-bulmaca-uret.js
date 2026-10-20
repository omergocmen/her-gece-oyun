#!/usr/bin/env node
// Satranç "Günün Bulmacası" havuzunu üretir: games/satranc/bulmaca.js
//   node scripts/satranc-bulmaca-uret.js [mat1=70] [mat2=130] [tohum=1]
// Kendi motorumuzla yarı rastgele oyunlar oynatır; sıradaki tarafın TEK çözümlü, 1 ya da 2 hamlede
// zorunlu mat bulduğu konumları toplar. Dış veri (Lichess vb.) kullanılmaz; her konum motor tarafından
// doğrulanır ve tests/satranc.test.js tekrar doğrular. Aynı tohum aynı havuzu üretir.
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('../games/satranc/motor.js');

const hedef1 = Number(process.argv[2]) || 70;
const hedef2 = Number(process.argv[3]) || 130;
let tohum = Number(process.argv[4]) || 1;
function rnd() {
  tohum = (tohum + 0x6d2b79f5) | 0;
  let t = Math.imul(tohum ^ (tohum >>> 15), 1 | tohum);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function tasSayisi(p) { let s = 0; for (let k = 0; k < 128; k++) { if (k & 0x88) { k += 7; continue; } if (p.t[k]) s++; } return s; }

const bulunan = { 1: [], 2: [] };
const gorulen = new Set();
let oyunSayisi = 0;
const bas = Date.now();

function incele(oyun) {
  const p = oyun.konum;
  if (tasSayisi(p) < 7 || p.n < 14) return;
  const anahtar = M.fenYaz(p, true);
  if (gorulen.has(anahtar)) return;
  gorulen.add(anahtar);
  const m1 = M.matHamleleri(p, 1);
  if (m1.length === 1 && bulunan[1].length < hedef1) {
    // Çok bariz olmasın: yasal hamle sayısı yeterince fazla olsun.
    if (oyun.yasal().length >= 18) bulunan[1].push({ fen: M.fenYaz(p), n: 1, cozum: M.hamleYaz(m1[0]) });
    return;
  }
  if (m1.length === 0 && bulunan[2].length < hedef2) {
    const m2 = M.matHamleleri(p, 2);
    if (m2.length === 1) {
      const ilk = m2[0];
      // İlk hamle şah çekmiyorsa (sessiz) ya da vezir fedası ise daha güzel; ama hepsini kabul et.
      bulunan[2].push({ fen: M.fenYaz(p), n: 2, cozum: M.hamleYaz(ilk) });
    }
  }
}

while ((bulunan[1].length < hedef1 || bulunan[2].length < hedef2) && Date.now() - bas < 55 * 60 * 1000) {
  const oyun = new M.Oyun();
  oyunSayisi++;
  const gurultu = [1, 2, 3][Math.floor(rnd() * 3)];
  for (let ply = 0; ply < 120; ply++) {
    const d = oyun.durum();
    if (d.bitti) break;
    if (ply >= 8) incele(oyun);
    const ms = oyun.yasal();
    let m;
    if (ply < 6 || rnd() < 0.12) m = ms[Math.floor(rnd() * ms.length)];
    else m = M.hamleBul(oyun.konum, M.bilgisayarHamlesi(oyun, gurultu + 1, rnd));
    oyun.yap(m);
  }
  if (oyunSayisi % 20 === 0) console.error(`oyun ${oyunSayisi}: mat1=${bulunan[1].length} mat2=${bulunan[2].length} (${Math.round((Date.now() - bas) / 1000)}sn)`);
}

const hepsi = bulunan[1].concat(bulunan[2]);
// Karıştır (sabit tohumla) ki 1 ve 2 hamlelik bulmacalar sırayla karışık gelsin.
for (let i = hepsi.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [hepsi[i], hepsi[j]] = [hepsi[j], hepsi[i]]; }
const cikti = '// Günün Bulmacası havuzu. scripts/satranc-bulmaca-uret.js ile üretildi; elle düzenlemeyin.\n' +
  '// Her kayıt: fen (sıradaki taraf çözer), n (kaç hamlede mat), cozum (tek doğru ilk hamle).\n' +
  '(function (kok) {\n  var BULMACALAR = [\n' +
  hepsi.map((b) => '    ' + JSON.stringify(b)).join(',\n') +
  '\n  ];\n  if (typeof module !== \'undefined\' && module.exports) module.exports = BULMACALAR;\n  else kok.SatrancBulmacalar = BULMACALAR;\n})(typeof self !== \'undefined\' ? self : this);\n';
fs.writeFileSync(path.join(__dirname, '../games/satranc/bulmaca.js'), cikti);
console.error(`Yazıldı: ${hepsi.length} bulmaca (${bulunan[1].length} × 1 hamle, ${bulunan[2].length} × 2 hamle), ${oyunSayisi} oyun, ${Math.round((Date.now() - bas) / 1000)} sn`);
