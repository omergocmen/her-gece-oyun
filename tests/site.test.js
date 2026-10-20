'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { manifestUret, diskYolu, KOK } = require('../scripts/precache-olustur.js');
const Katalog = require('../assets/js/katalog.js');

const oyunlar = JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8'));

function dosyalariTopla(klasor, uzantilar, sonuc = []) {
  for (const ad of fs.readdirSync(klasor)) {
    if (ad === 'node_modules' || ad.startsWith('.')) continue;
    const tam = path.join(klasor, ad);
    if (fs.statSync(tam).isDirectory()) dosyalariTopla(tam, uzantilar, sonuc);
    else if (uzantilar.includes(path.extname(ad))) sonuc.push(tam);
  }
  return sonuc;
}

test('games.json her oyun için gerekli alanları içerir', () => {
  const sluglar = new Set();
  for (const oyun of oyunlar) {
    for (const alan of ['slug', 'ad', 'aciklama', 'kategori', 'boyut', 'eklenme', 'gorsel', 'dosyalar']) {
      assert.ok(oyun[alan], `${oyun.slug || '?'}: "${alan}" eksik`);
    }
    assert.match(oyun.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${oyun.slug}: slug küçük harf ve tire olmalı`);
    assert.match(oyun.eklenme, /^\d{4}-\d{2}-\d{2}$/, `${oyun.slug}: eklenme YYYY-AA-GG olmalı`);
    assert.ok(['2D', '3D'].includes(oyun.boyut), `${oyun.slug}: boyut "2D" ya da "3D" olmalı`);
    // three.js yükleyen oyun 3D'dir; kartlardaki rozet ve "3D" süzgeci bu alana güvenir.
    const ucBoyutlu = oyun.dosyalar.some((d) => d.startsWith('assets/vendor/three/'));
    assert.equal(oyun.boyut === '3D', ucBoyutlu, `${oyun.slug}: boyut "${oyun.boyut}" ama three.js ${ucBoyutlu ? 'kullanıyor' : 'kullanmıyor'}`);
    assert.ok(!sluglar.has(oyun.slug), `${oyun.slug}: slug tekrar ediyor`);
    sluglar.add(oyun.slug);
    assert.ok(oyun.dosyalar.includes(`games/${oyun.slug}/`), `${oyun.slug}: oyun sayfası dosyalar listesinde yok`);
    assert.ok(oyun.dosyalar.includes(oyun.gorsel), `${oyun.slug}: görsel dosyalar listesinde yok`);
    for (const dosya of oyun.dosyalar) {
      assert.ok(fs.existsSync(diskYolu(dosya)), `${oyun.slug}: ${dosya} bulunamadı`);
    }
  }
});

test('precache-manifest.js güncel (değilse: npm run precache)', () => {
  const mevcut = fs.readFileSync(path.join(KOK, 'precache-manifest.js'), 'utf8');
  assert.equal(mevcut, manifestUret());
});

test('hiçbir sayfa harici kaynak yüklemez', () => {
  const desen = /(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|(?:fetch|importScripts|import)\s*\(\s*["'](?:https?:)?\/\/|@import\s+["']?(?:https?:)?\/\//i;
  for (const dosya of dosyalariTopla(KOK, ['.html', '.css', '.js'])) {
    if (dosya.includes(`${path.sep}tests${path.sep}`)) continue;
    // SEO bloğundaki canonical ve paylaşım adresleri kaynak yüklemez, kontrol dışıdır.
    const icerik = fs.readFileSync(dosya, 'utf8').replace(/<!-- SEO:BASLA -->[\s\S]*?<!-- SEO:BITIS -->/g, '');
    assert.ok(!desen.test(icerik), `${path.relative(KOK, dosya)} harici bir kaynağa bağlanıyor`);
  }
});

test('her oyun sayfası Türkçe başlık, açıklama ve service worker kaydı içerir', () => {
  for (const oyun of oyunlar) {
    const html = fs.readFileSync(diskYolu(`games/${oyun.slug}/`), 'utf8');
    assert.match(html, /<html lang="tr">/, `${oyun.slug}: lang="tr" yok`);
    assert.match(html, /<title>[^<]+<\/title>/, `${oyun.slug}: title yok`);
    assert.match(html, /<meta name="description" content="[^"]+">/, `${oyun.slug}: description yok`);
    assert.match(html, /sw-kayit\.js/, `${oyun.slug}: service worker kaydı yok`);
  }
});

test('katalog en yeni oyunu başa alır', () => {
  const sirali = Katalog.sirala([
    { slug: 'eski', eklenme: '2026-10-01' },
    { slug: 'yeni', eklenme: '2026-10-20' },
    { slug: 'orta', eklenme: '2026-10-10' }
  ]);
  assert.deepEqual(sirali.map((o) => o.slug), ['yeni', 'orta', 'eski']);
  assert.equal(Katalog.oyunAdresi({ slug: 'yeni' }), 'games/yeni/');
});

test('oyun kartı son 7 günde eklenen oyunu "Yeni" sayar', () => {
  const bugun = new Date(2026, 9, 20, 23, 30);
  assert.equal(Katalog.yeniMi({ eklenme: '2026-10-20' }, bugun), true);
  assert.equal(Katalog.yeniMi({ eklenme: '2026-10-14' }, bugun), true);
  assert.equal(Katalog.yeniMi({ eklenme: '2026-10-13' }, bugun), false);
  assert.equal(Katalog.yeniMi({ eklenme: '2026-09-30' }, bugun), false);
  assert.equal(Katalog.yeniMi({ eklenme: '2026-10-21' }, bugun), true);
});

test('ana sayfa kartları depo.js özetini okuyabilir ve her oyun özet yazar', () => {
  const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  assert.ok(html.indexOf('assets/js/depo.js') < html.indexOf('assets/js/main.js'), 'index.html depo.js\'yi main.js\'den önce yüklemeli');
  for (const oyun of oyunlar) {
    const kodlar = oyun.dosyalar.filter((d) => d.endsWith('.js') && d.startsWith(`games/${oyun.slug}/`))
      .map((d) => fs.readFileSync(diskYolu(d), 'utf8')).join('\n');
    assert.ok(kodlar.includes(`Depo.ozetYaz('${oyun.slug}'`), `${oyun.slug}: Depo.ozetYaz ile kart özeti yazmıyor`);
  }
});

test('precache her dosyanın içerik özetini taşır (service worker yalnızca değişenleri indirir)', () => {
  const metin = manifestUret();
  const m = JSON.parse(metin.slice(metin.indexOf('{'), metin.lastIndexOf('}') + 1));
  const { dosyaOzeti } = require('../scripts/precache-olustur.js');
  assert.deepEqual(Object.keys(m.ozetler), m.dosyalar);
  for (const url of m.dosyalar) assert.equal(m.ozetler[url], dosyaOzeti(fs.readFileSync(diskYolu(url))), url);
  const sw = fs.readFileSync(path.join(KOK, 'sw.js'), 'utf8');
  assert.ok(!/addEventListener\('install'[\s\S]*?skipWaiting[\s\S]*?addEventListener\('message'/.test(sw), 'install aşaması zorla skipWaiting yapmamalı');
});
