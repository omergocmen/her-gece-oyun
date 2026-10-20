#!/usr/bin/env node
// Kayıp Minareler bölüm inceleyici: her bölümü çözer, etkileşimsiz çözülemediğini denetler ve
// izometrik ekran hücrelerini metin olarak çizer. Kullanım: node scripts/minare-incele.js [bolumNo] [-c]
'use strict';
const M = require('../games/kayip-minareler/mantik.js');
const B = require('../games/kayip-minareler/bolumler.json');

function ciz(s) {
  const d = M.dunya(s), kr = M.karolar(s, d);
  const hucreler = new Map();
  d.forEach((b) => {
    const k = (b.x - b.y) + ',' + (b.z - b.y);
    const o = hucreler.get(k);
    if (!o || b.x + b.y + b.z > o.x + o.y + o.z) hucreler.set(k, b);
  });
  let pmin = 99, pmax = -99, qmin = 99, qmax = -99;
  hucreler.forEach((_, k) => { const [p, q] = k.split(',').map(Number); pmin = Math.min(pmin, p); pmax = Math.max(pmax, p); qmin = Math.min(qmin, q); qmax = Math.max(qmax, q); });
  const er = new Set(M.erisilen(s).map((v) => M.hucre(v)));
  const satirlar = [];
  for (let q = qmin; q <= qmax; q++) {
    let sat = String(q).padStart(3) + ' ';
    for (let p = pmin; p <= pmax; p++) {
      const k = p + ',' + q, b = hucreler.get(k);
      let c = '  .';
      if (b) {
        const t = kr.get(k);
        const isaret = M.esit([b.x, b.y, b.z], s.konum) ? 'B' : M.esit([b.x, b.y, b.z], s.b.hedef) ? 'H' : b.grup ? b.grup[0] : t ? (er.has(k) ? '*' : 'o') : '#';
        c = String(b.y).padStart(2) + isaret;
      }
      sat += c;
    }
    satirlar.push(sat);
  }
  console.log('     p=' + pmin + '..' + pmax + '  (sayı = y, * erişilen, o erişilmeyen karo, # yürünmez)');
  console.log(satirlar.join('\n'));
}

const secim = process.argv[2] && !process.argv[2].startsWith('-') ? [Number(process.argv[2])] : B.map((b) => b.no);
for (const b of B.filter((x) => secim.includes(x.no))) {
  const s = M.kur(b);
  console.log(`\n== Bölüm ${b.no} · ${b.ad}`);
  if (process.argv.includes('-c')) ciz(s);
  const h = M.coz(b);
  console.log('çözüm:', h ? h.length + ' hamle: ' + h.map((a) => a.tur === 'yuru' ? '→' + a.k.join(',') : a.id + '=' + a.v).join(' ') : 'YOK');
  const kilitsiz = JSON.parse(JSON.stringify(b));
  (kilitsiz.gruplar || []).forEach((g) => { g.surekli = false; });
  kilitsiz.plakalar = [];
  console.log('etkileşimsiz:', M.coz(kilitsiz) ? 'ÇÖZÜLÜYOR (kötü)' : 'çözülmüyor');
}
