#!/usr/bin/env node
// precache-manifest.js dosyasını üretir: site kabuğu + games.json'daki tüm oyun dosyaları.
// Sürüm, bu dosyaların içerik özetidir; herhangi biri değişince service worker yeni önbellek kurar.
// Her dosyanın kendi özeti de yazılır: service worker yalnızca özeti değişen dosyaları ağdan indirir,
// değişmeyenleri (three.js, fontlar...) eski önbellekten kopyalar.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KOK = path.join(__dirname, '..');
const KABUK = [
  './',
  'index.html',
  'games.json',
  'manifest.webmanifest',
  'assets/css/style.css',
  'assets/fonts/bricolage-latin.woff2',
  'assets/fonts/bricolage-latin-ext.woff2',
  'assets/js/katalog.js',
  'assets/js/depo.js',
  'assets/js/main.js',
  'assets/js/yedek.js',
  'assets/js/kur.js',
  'assets/js/sw-kayit.js',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

function diskYolu(url) {
  const yol = url === './' ? 'index.html' : url.endsWith('/') ? url + 'index.html' : url;
  return path.join(KOK, yol);
}

// sw.js aynı özeti indirdiği gövdeden crypto.subtle ile hesaplar (SHA-256, ilk 12 onaltılık hane).
function dosyaOzeti(icerik) {
  return crypto.createHash('sha256').update(icerik).digest('hex').slice(0, 12);
}

function manifestUret() {
  const oyunlar = JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8'));
  const dosyalar = KABUK.slice();
  for (const oyun of oyunlar) {
    for (const dosya of oyun.dosyalar) if (!dosyalar.includes(dosya)) dosyalar.push(dosya);
  }
  const ozet = crypto.createHash('sha256');
  const ozetler = {};
  for (const dosya of dosyalar) {
    const icerik = fs.readFileSync(diskYolu(dosya));
    ozet.update(dosya);
    ozet.update(icerik);
    ozetler[dosya] = dosyaOzeti(icerik);
  }
  const surum = ozet.digest('hex').slice(0, 12);
  return '// Bu dosya otomatik üretilir: npm run precache\n' +
    'self.PRECACHE = ' + JSON.stringify({ surum, dosyalar, ozetler }, null, 2) + ';\n';
}

module.exports = { manifestUret, dosyaOzeti, diskYolu, KOK };

if (require.main === module) {
  fs.writeFileSync(path.join(KOK, 'precache-manifest.js'), manifestUret());
  console.log('precache-manifest.js güncellendi');
}
