#!/usr/bin/env node
// precache-manifest.js dosyasını üretir: site kabuğu + games.json'daki tüm oyun dosyaları.
// Sürüm, bu dosyaların içerik özetidir; herhangi biri değişince service worker yeni önbellek kurar.
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
  'assets/js/sw-kayit.js',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

function diskYolu(url) {
  const yol = url === './' ? 'index.html' : url.endsWith('/') ? url + 'index.html' : url;
  return path.join(KOK, yol);
}

function manifestUret() {
  const oyunlar = JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8'));
  const dosyalar = KABUK.slice();
  for (const oyun of oyunlar) {
    for (const dosya of oyun.dosyalar) if (!dosyalar.includes(dosya)) dosyalar.push(dosya);
  }
  const ozet = crypto.createHash('sha256');
  for (const dosya of dosyalar) {
    ozet.update(dosya);
    ozet.update(fs.readFileSync(diskYolu(dosya)));
  }
  const surum = ozet.digest('hex').slice(0, 12);
  return '// Bu dosya otomatik üretilir: npm run precache\n' +
    'self.PRECACHE = ' + JSON.stringify({ surum, dosyalar }, null, 2) + ';\n';
}

module.exports = { manifestUret, diskYolu, KOK };

if (require.main === module) {
  fs.writeFileSync(path.join(KOK, 'precache-manifest.js'), manifestUret());
  console.log('precache-manifest.js güncellendi');
}
