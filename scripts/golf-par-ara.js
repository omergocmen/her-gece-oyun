#!/usr/bin/env node
// Mini Golf Türkiye: her delik için par'ı (ya da daha azını) tutturan bir vuruş dizisi arar ve
// games/mini-golf/kayit.json dosyasına yazar. Testler bu kaydı oynatarak her deliğin par'da
// bitirilebildiğini doğrular. Parkur değişince yeniden çalıştırın: node scripts/golf-par-ara.js [delikNo]
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('../games/mini-golf/fizik.js');
const P = require('../games/mini-golf/parkur.js');

const KAYIT = path.join(__dirname, '..', 'games', 'mini-golf', 'kayit.json');

// Hücre ızgarasında delikten uzaklık (engelleri ve suyu dolaşarak): aramanın sezgisi.
function uzaklikHaritasi(D) {
  const H = F.HUCRE;
  const engelli = (i, j) => {
    const x = (i + 0.5) * H, z = (j + 0.5) * H;
    if (D.su.some((r) => F.icinde(r, x, z))) return true;
    if (D.kutular.some((k) => F.icinde([k.r[0] - 0.02, k.r[1] - 0.02, k.r[2] + 0.02, k.r[3] + 0.02], x, z))) return true;
    return D.daireler.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.15);
  };
  const harita = new Map();
  const bi = Math.floor(D.delik[0] / H), bj = Math.floor(D.delik[1] / H);
  const kuyruk = [[bi, bj, 0]];
  harita.set(bi + ',' + bj, 0);
  while (kuyruk.length) {
    kuyruk.sort((a, b) => a[2] - b[2]);
    const [i, j, d] = kuyruk.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj, k = ni + ',' + nj;
      if (!D.hucreler[k] || engelli(ni, nj)) continue;
      if (di && dj && (!D.hucreler[ni + ',' + j] || !D.hucreler[i + ',' + nj])) continue;
      const nd = d + Math.hypot(di, dj) * H;
      if (!harita.has(k) || harita.get(k) > nd) { harita.set(k, nd); kuyruk.push([ni, nj, nd]); }
    }
  }
  return (x, z) => {
    const v = harita.get(Math.floor(x / H) + ',' + Math.floor(z / H));
    return v == null ? 99 : v + Math.hypot(x - ((Math.floor(x / H) + 0.5) * H), z - ((Math.floor(z / H) + 0.5) * H)) * 0.2;
  };
}

function ara(delik) {
  const D = F.derle(delik);
  const uzak = uzaklikHaritasi(D);
  const hareketli = D.kapilar.length || D.vapurlar.length;
  const acilar = hareketli ? 120 : 180;
  const gucler = [];
  for (let g = 0.08; g <= 1.001; g += 0.04) gucler.push(+g.toFixed(2));
  const beklemeler = hareketli ? [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] : [0];
  let isin = [{ s: F.yeniDurum(D, 0), yol: [], ceza: 0 }];
  for (let derinlik = 1; derinlik <= delik.par; derinlik++) {
    const adaylar = [];
    for (const dugum of isin) {
      for (const bekle of beklemeler) {
        const bas = F.kopya(dugum.s);
        for (let i = 0; i < bekle; i++) F.adim(D, bas);
        for (let a = 0; a < acilar; a++) {
          const aci = +((a / acilar) * Math.PI * 2).toFixed(6);
          for (const g of gucler) {
            const s = F.simuleEt(D, F.kopya(bas), aci, g);
            const cezalar = s.olaylar.filter((o) => o.tur === 'ceza').length;
            const yol = dugum.yol.concat([{ t: bas.t, a: aci, g }]);
            if (s.dustu && derinlik + dugum.ceza + cezalar <= delik.par) return yol;
            if (s.hareket || cezalar) continue;
            adaylar.push({ s, yol, ceza: dugum.ceza, puan: uzak(s.x, s.z) });
          }
        }
      }
    }
    adaylar.sort((x, y) => x.puan - y.puan);
    // Birbirine çok yakın durakları tekilleştir.
    const secilen = [];
    for (const c of adaylar) {
      if (secilen.every((d) => Math.hypot(d.s.x - c.s.x, d.s.z - c.s.z) > 0.6)) secilen.push(c);
      if (secilen.length >= 6) break;
    }
    isin = secilen;
    console.log(`  delik ${delik.no} derinlik ${derinlik}: en iyi uzaklık ${isin[0] ? isin[0].puan.toFixed(2) : '-'}`);
  }
  return null;
}

const kayit = fs.existsSync(KAYIT) ? JSON.parse(fs.readFileSync(KAYIT, 'utf8')) : {};
const secim = process.argv[2] ? [Number(process.argv[2])] : P.DELIKLER.map((d) => d.no);
for (const delik of P.DELIKLER.filter((d) => secim.includes(d.no))) {
  const bas = Date.now();
  const yol = ara(delik);
  console.log(`Delik ${delik.no} (${delik.ad}, par ${delik.par}): ${yol ? yol.length + ' vuruş' : 'BULUNAMADI'} · ${((Date.now() - bas) / 1000).toFixed(1)} sn`);
  if (yol) kayit[delik.no] = yol;
}
fs.writeFileSync(KAYIT, JSON.stringify(kayit, null, 1) + '\n');
