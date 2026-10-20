#!/usr/bin/env node
// Service worker güncellemesini gerçek tarayıcıda dener (CI'da çalışmaz; Playwright gerekir):
//   node scripts/sw-guncelleme-incele.js
// Siteyi geçici bir klasöre kopyalar, ilk ziyarette önbelleği kurar, sonra bir oyun dosyasını
// değiştirip manifesti günceller ve ikinci ziyarette ağdan yalnızca değişen dosyaların indiğini,
// "Yenile" bildiriminin çıktığını ve güncellemeden sonra uçak modunda oyunların açıldığını doğrular.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { dosyaOzeti, KOK } = require('./precache-olustur.js');

let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node-tools/node_modules/playwright'); }

const TUR = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };

function kopyala(kaynak, hedef) {
  fs.mkdirSync(hedef, { recursive: true });
  for (const ad of fs.readdirSync(kaynak)) {
    if (ad === '.git' || ad === 'node_modules') continue;
    const k = path.join(kaynak, ad), h = path.join(hedef, ad);
    if (fs.statSync(k).isDirectory()) kopyala(k, h); else fs.copyFileSync(k, h);
  }
}

function manifestOku(kok) {
  const metin = fs.readFileSync(path.join(kok, 'precache-manifest.js'), 'utf8');
  return JSON.parse(metin.slice(metin.indexOf('{'), metin.lastIndexOf('}') + 1));
}
function manifestYaz(kok, m) {
  fs.writeFileSync(path.join(kok, 'precache-manifest.js'), '// Bu dosya otomatik üretilir: npm run precache\nself.PRECACHE = ' + JSON.stringify(m, null, 2) + ';\n');
}

(async () => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'hgo-sw-'));
  kopyala(KOK, kok);
  const istekler = [];
  const sunucu = http.createServer((istek, yanit) => {
    let url = decodeURIComponent(istek.url.split('?')[0]);
    istekler.push(url);
    let dosya = path.join(kok, url);
    if (url.endsWith('/')) dosya = path.join(dosya, 'index.html');
    if (!fs.existsSync(dosya)) { yanit.writeHead(404); return yanit.end(); }
    yanit.writeHead(200, { 'Content-Type': TUR[path.extname(dosya)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    yanit.end(fs.readFileSync(dosya));
  });
  await new Promise((r) => sunucu.listen(0, r));
  const adres = 'http://localhost:' + sunucu.address().port + '/';

  const tarayici = await playwright.chromium.launch();
  const baglam = await tarayici.newContext();
  const sayfa = await baglam.newPage();
  const hatalar = [];
  sayfa.on('pageerror', (e) => hatalar.push(e.message));

  // 1) İlk ziyaret: her şey bir kez iner.
  await sayfa.goto(adres);
  await sayfa.evaluate(() => navigator.serviceWorker.ready);
  await sayfa.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const ilk = new Set(istekler);
  const m = manifestOku(kok);
  for (const url of m.dosyalar) assert.ok(ilk.has('/' + (url === './' ? '' : url)), 'ilk kurulumda inmedi: ' + url);
  console.log('İlk ziyaret: ' + istekler.length + ' istek');

  // 2) Yeni gece: bir oyun dosyası ve games.json değişir.
  const degisen = m.dosyalar.find((u) => /^games\/[^/]+\/oyun\.js$/.test(u));
  fs.appendFileSync(path.join(kok, degisen), '\n// yeni-surum-isareti\n');
  fs.appendFileSync(path.join(kok, 'games.json'), '\n');
  for (const url of [degisen, 'games.json']) m.ozetler[url] = dosyaOzeti(fs.readFileSync(path.join(kok, url)));
  m.surum = 'deneme' + Date.now().toString(36);
  manifestYaz(kok, m);

  istekler.length = 0;
  await sayfa.reload();
  await sayfa.evaluate(() => navigator.serviceWorker.getRegistration().then((k) => k.update()));
  await sayfa.waitForSelector('#yeni-surum', { timeout: 15000 });
  const ikinci = istekler.filter((u) => u !== '/sw.js' && u !== '/precache-manifest.js');
  console.log('Güncellemede ağdan inenler (sw.js ve manifest hariç):', ikinci);
  const beklenen = new Set(['/' + degisen, '/games.json']);
  for (const u of ikinci) assert.ok(beklenen.has(u), 'gereksiz indirildi: ' + u);
  for (const u of beklenen) assert.ok(ikinci.includes(u), 'değişen dosya inmedi: ' + u);
  assert.ok(!istekler.some((u) => u.includes('three') || u.includes('fonts')), 'three.js ya da font yeniden indi');

  // 3) Bildirim çıktı, sayfa hâlâ eski sürümle çalışıyor; "Yenile" yeni sürüme geçirir.
  const eskiIcerik = await sayfa.evaluate((u) => fetch(u).then((y) => y.text()), degisen);
  assert.ok(!eskiIcerik.includes('yeni-surum-isareti'), 'yenilemeden önce eski sürüm sunulmalı');
  await Promise.all([sayfa.waitForNavigation(), sayfa.click('#yeni-surum button')]);
  const yeniIcerik = await sayfa.evaluate((u) => fetch(u).then((y) => y.text()), degisen);
  assert.ok(yeniIcerik.includes('yeni-surum-isareti'), 'yenilemeden sonra yeni sürüm sunulmalı');
  const anahtarlar = await sayfa.evaluate(() => caches.keys());
  assert.deepEqual(anahtarlar.filter((a) => a.startsWith('hgo-')), ['hgo-' + m.surum], 'eski önbellek silinmeli');

  // 4) Uçak modu: bütün oyun sayfaları ve dosyaları önbellekten gelir.
  await baglam.setOffline(true);
  const oyunlar = JSON.parse(fs.readFileSync(path.join(kok, 'games.json'), 'utf8'));
  for (const oyun of oyunlar) {
    await sayfa.goto(adres + 'games/' + oyun.slug + '/');
    for (const d of oyun.dosyalar) {
      const tamam = await sayfa.evaluate((u) => fetch('/' + u).then((y) => y.ok, () => false), d);
      assert.ok(tamam, 'uçak modunda açılmadı: ' + d);
    }
  }
  console.log('Uçak modunda ' + oyunlar.length + ' oyun açıldı');
  assert.deepEqual(hatalar, [], 'sayfa hatası: ' + hatalar.join(' | '));

  await tarayici.close();
  sunucu.close();
  fs.rmSync(kok, { recursive: true, force: true });
  console.log('Tamam');
})().catch((e) => { console.error(e); process.exit(1); });
