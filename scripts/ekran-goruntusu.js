#!/usr/bin/env node
// Tasarım denetimi için ana sayfa ve tüm oyun sayfalarının mobil + masaüstü ekran görüntülerini alır.
// Kullanım: python3 -m http.server 8123 & node scripts/ekran-goruntusu.js <klasor> [adres]
'use strict';
const fs = require('fs');
const path = require('path');

function playwright() {
  try { return require('playwright'); } catch (e) { return require('/opt/node-tools/node_modules/playwright'); }
}

const [, , klasor = 'ekran', adres = 'http://localhost:8123'] = process.argv;
const oyunlar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'games.json'), 'utf8'));
const sayfalar = [['ana', '']].concat(oyunlar.map((o) => [o.slug, `games/${o.slug}/`]));
const ekranlar = [['mobil', 390, 844, 2], ['masa', 1280, 860, 1]];

(async () => {
  fs.mkdirSync(klasor, { recursive: true });
  const tarayici = await playwright().chromium.launch();
  for (const [ad, en, boy, olcek] of ekranlar) {
    const baglam = await tarayici.newContext({ viewport: { width: en, height: boy }, deviceScaleFactor: olcek, serviceWorkers: 'block' });
    const sayfa = await baglam.newPage();
    for (const [isim, yol] of sayfalar) {
      await sayfa.goto(`${adres}/${yol}`);
      await sayfa.evaluate(() => document.fonts.ready);
      await sayfa.waitForTimeout(700);
      const dosya = path.join(klasor, `${isim}-${ad}.png`);
      await sayfa.screenshot({ path: dosya, fullPage: true });
      console.log(dosya);
    }
    await baglam.close();
  }
  await tarayici.close();
})();
