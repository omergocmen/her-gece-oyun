#!/usr/bin/env node
// Tavla yapay zekâ seviyelerini birbirine karşı tohumlu oyunlarla ölçer.
// Kullanım: node scripts/tavla-simulasyon.js [seviyeA] [seviyeB] [oyunSayisi]
// Örnek: node scripts/tavla-simulasyon.js zor kolay 100
'use strict';
const M = require('../games/tavla/mantik.js');

const [, , a = 'zor', b = 'kolay', adet = '100'] = process.argv;
const n = Number(adet);
const galibiyet = [0, 0];
const puan = [0, 0];
const mars = [0, 0];
const basla = Date.now();
for (let i = 0; i < n; i++) {
  // Renkler dönüşümlü: tek tohumlarda seviyeler yer değiştirir, böylece başlama avantajı dengelenir.
  const ters = i % 2 === 1;
  const sonuc = M.oyunSimule(ters ? [b, a] : [a, b], 1000 + i);
  const kazananA = (sonuc.kazanan === 0) !== ters ? 0 : 1;
  galibiyet[kazananA]++;
  puan[kazananA] += sonuc.puan;
  if (sonuc.mars) mars[kazananA]++;
}
const sure = (Date.now() - basla) / 1000;
console.log(`${n} oyun: ${a} ${galibiyet[0]} – ${galibiyet[1]} ${b}`);
console.log(`Puan: ${a} ${puan[0]} – ${puan[1]} ${b} · mars: ${mars[0]} – ${mars[1]}`);
console.log(`${a} kazanma oranı: %${Math.round((100 * galibiyet[0]) / n)} · süre ${sure.toFixed(1)} sn`);
