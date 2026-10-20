#!/usr/bin/env node
// 3D oyunların göreli sahne maliyetini ölçer (Playwright + SwiftShader, gerçek telefon DEĞİLDİR):
//   python3 -m http.server 8123 &   # depo kökünden
//   node scripts/kalite-olc.js [adres=http://localhost:8123/] [--dusuk] [--sure=4000]
// Her 3D oyunu 390×844 @3x'te açar, boşta kare sayar ve şunları raporlar: kare/sn, tuval boyutu,
// piksel oranı, kare başına çizim çağrısı (GL düzeyinde sayılır; oyun kodundan bağımsızdır) ve
// konsol hataları. --dusuk, "Düşük grafik" tercihini açarak ölçer. Mutlak değerler anlamsızdır;
// aynı ortamda oyunlar ya da önce/sonra arasındaki fark anlamlıdır.
'use strict';
const fs = require('fs');
const path = require('path');

let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const arg = process.argv.slice(2);
const adres = (arg.find((a) => /^https?:/.test(a)) || 'http://localhost:8123/').replace(/\/?$/, '/');
const dusuk = arg.includes('--dusuk');
const sure = Number((arg.find((a) => a.startsWith('--sure=')) || '--sure=4000').split('=')[1]);
const KOK = path.join(__dirname, '..');
const oyunlar = JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8')).filter((o) => o.boyut === '3D');

// Sayfa betiklerinden önce çalışır: çizim çağrılarını sayar, rAF karelerini ayırır.
const SAYAC = `
  window.__cizim = { toplam: 0, kare: 0 };
  for (const ad of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const P = window[ad] && window[ad].prototype;
    if (!P) continue;
    for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      const o = P[f];
      if (o) P[f] = function () { window.__cizim.toplam++; return o.apply(this, arguments); };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => raf((t) => { window.__cizim.kare++; fn(t); });
`;

(async () => {
  const tarayici = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const sonuc = [];
  for (const oyun of oyunlar) {
    const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    if (dusuk) await baglam.addInitScript(() => { try { localStorage.setItem('hgo:kalite-dusuk', 'true'); } catch (e) {} });
    await baglam.addInitScript(SAYAC);
    const sayfa = await baglam.newPage();
    const hatalar = [];
    sayfa.on('pageerror', (e) => hatalar.push(e.message));
    sayfa.on('console', (m) => { if (m.type() === 'error') hatalar.push(m.text()); });
    await sayfa.goto(adres + 'games/' + oyun.slug + '/');
    await sayfa.waitForSelector('canvas', { timeout: 20000 });
    await sayfa.waitForTimeout(2500); // yükleme ve ilk uyarlama penceresi
    const bas = await sayfa.evaluate(() => ({ ...window.__cizim, t: performance.now() }));
    await sayfa.waitForTimeout(sure);
    const son = await sayfa.evaluate(() => ({ ...window.__cizim, t: performance.now() }));
    const bilgi = await sayfa.evaluate(() => {
      const c = document.querySelector('canvas');
      return { en: c.width, boy: c.height, dugme: !!document.getElementById('kalite-dugme') };
    });
    const kare = son.kare - bas.kare;
    sonuc.push({
      oyun: oyun.slug,
      fps: Math.round((kare / ((son.t - bas.t) / 1000)) * 10) / 10,
      tuval: bilgi.en + '×' + bilgi.boy,
      cizim: kare ? Math.round((son.toplam - bas.toplam) / kare) : 0,
      dugme: bilgi.dugme,
      hata: hatalar.length
    });
    if (hatalar.length) console.error(oyun.slug + ' hataları:', hatalar.slice(0, 3));
    await baglam.close();
  }
  await tarayici.close();
  console.log('Mod: ' + (dusuk ? 'Düşük grafik' : 'Normal') + ' · ' + adres);
  console.table(sonuc);
  const BUTCE = 150; // kare başına çizim çağrısı üst sınırı
  const asan = sonuc.filter((s) => s.cizim > BUTCE);
  if (asan.length) console.error('Çizim çağrısı bütçesi (' + BUTCE + ') aşıldı: ' + asan.map((s) => s.oyun + '=' + s.cizim).join(', '));
  if (sonuc.some((s) => s.hata) || asan.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
