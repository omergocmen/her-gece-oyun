#!/usr/bin/env node
// Dama "Günün Bulmacası" havuzunu üretir: beyaz oynar ve 2 hamlede kazanır (rakip hamlesiz ya da taşsız kalır).
//   node scripts/dama-bulmaca-uret.js [adet=180] [tohum=20261020]
// Konumlar rastgele kurulur, kendi motorumuzla doğrulanır: tek hamlede kazanç yok, tam bir
// ilk hamle zorla kazandırır. Çıktı games/dama/bulmaca.js (harici veri kullanılmaz).
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../games/dama/motor.js');

const adet = Number(process.argv[2]) || 180;
const tohum = Number(process.argv[3]) || 20261020;
const rnd = D.rng(tohum);
const sec = (a) => a[Math.floor(rnd() * a.length)];

function adayKonum() {
  const t = new Int8Array(64);
  const bos = () => { for (;;) { const k = Math.floor(rnd() * 64); if (!t[k]) return k; } };
  const bn = 2 + Math.floor(rnd() * 3), sn = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < bn; i++) {
    const dama = rnd() < 0.45;
    let k = bos();
    if (!dama) { const r = 1 + Math.floor(rnd() * 6); k = r * 8 + Math.floor(rnd() * 8); if (t[k]) { i--; continue; } }
    t[k] = dama ? 2 : 1;
  }
  for (let i = 0; i < sn; i++) {
    const dama = rnd() < 0.3;
    let k = bos();
    if (!dama) { const r = 1 + Math.floor(rnd() * 6); k = r * 8 + Math.floor(rnd() * 8); if (t[k]) { i--; continue; } }
    t[k] = dama ? 4 : 3;
  }
  return { t, sira: 0, sayac: 0 };
}

const bulunan = [], gorulen = new Set();
let deneme = 0;
while (bulunan.length < adet && deneme < 6e6) {
  deneme++;
  const p = adayKonum();
  const anahtar = D.diziye(p);
  if (gorulen.has(anahtar)) continue;
  const l = D.hamleler(p);
  if (!l.length) continue;
  const s = D.say(p);
  if (!(s.st + s.sd)) continue;
  if (D.birdeKazanir(p)) continue;
  const c = D.ikideKazandiranlar(p);
  if (c.length !== 1) continue;
  // ilk hamle sade bir yürüyüş ya da yeme olabilir; çok kolay konumları ele: çözüm tek yeme zorunluluğundan ibaretse atla
  if (l.length === 1) continue;
  gorulen.add(anahtar);
  bulunan.push({ t: anahtar, n: 2 });
}
if (bulunan.length < adet) console.error('Yalnızca ' + bulunan.length + ' bulmaca bulundu (' + deneme + ' deneme).');
const cikti = '// Dama Günün Bulmacası havuzu: scripts/dama-bulmaca-uret.js ile üretildi, kendi motorumuzla doğrulandı.\n' +
  '// t: 64 karakter (a1\'den h8\'e satır satır; 0 boş, 1 beyaz taş, 2 beyaz dama, 3 siyah taş, 4 siyah dama), beyaz oynar; n: kazanmak için hamle sayısı.\n' +
  '(function (kok) {\n  var B = [\n' + bulunan.map((b) => '    ' + JSON.stringify(b)).join(',\n') + '\n  ];\n' +
  "  if (typeof module !== 'undefined' && module.exports) module.exports = B;\n  else kok.DamaBulmacalar = B;\n})(typeof self !== 'undefined' ? self : this);\n";
fs.writeFileSync(path.join(__dirname, '..', 'games', 'dama', 'bulmaca.js'), cikti);
console.log(bulunan.length + ' bulmaca, ' + deneme + ' deneme');
