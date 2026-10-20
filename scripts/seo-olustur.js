#!/usr/bin/env node
// SEO çıktılarını games.json ve site.json'dan üretir:
// - index.html ve her oyun sayfasındaki <!-- SEO:BASLA --> ... <!-- SEO:BITIS --> bloğu
//   (title, description, canonical, Open Graph, Twitter kartı, JSON-LD)
// - sitemap.xml ve robots.txt
'use strict';
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const BASLA = '<!-- SEO:BASLA -->';
const BITIS = '<!-- SEO:BITIS -->';

function oku(dosya) {
  return JSON.parse(fs.readFileSync(path.join(KOK, dosya), 'utf8'));
}

function kacis(metin) {
  return String(metin)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// JSON-LD </script> ile erken kapanmasın diye "<" kaçırılır.
function jsonLd(nesne) {
  return '<script type="application/ld+json">' + JSON.stringify(nesne).replace(/</g, '\\u003c') + '</script>';
}

function blok(girinti, satirlar) {
  return [BASLA].concat(satirlar, [BITIS]).map((s) => girinti + s).join('\n');
}

function ortakEtiketler(site, { baslik, aciklama, adres, tur }) {
  const gorsel = site.url + site.paylasimGorseli;
  return [
    `<title>${kacis(baslik)}</title>`,
    `<meta name="description" content="${kacis(aciklama)}">`,
    `<link rel="canonical" href="${adres}">`,
    `<meta property="og:type" content="${tur}">`,
    `<meta property="og:site_name" content="${kacis(site.ad)}">`,
    `<meta property="og:locale" content="tr_TR">`,
    `<meta property="og:title" content="${kacis(baslik)}">`,
    `<meta property="og:description" content="${kacis(aciklama)}">`,
    `<meta property="og:url" content="${adres}">`,
    `<meta property="og:image" content="${gorsel}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${kacis(baslik)}">`,
    `<meta name="twitter:description" content="${kacis(aciklama)}">`,
    `<meta name="twitter:image" content="${gorsel}">`
  ];
}

function oyunMetasi(site, oyun) {
  return {
    baslik: `${oyun.ad} Oyna – Ücretsiz, İndirmeden | ${site.ad}`,
    aciklama: `${oyun.aciklama} Ücretsiz, girişsiz ve internetsiz oynanır.`,
    adres: `${site.url}games/${oyun.slug}/`
  };
}

function anaSayfaBlogu(site, oyunlar) {
  const meta = { baslik: `${site.ad} – Ücretsiz, Girişsiz Tarayıcı Oyunları`, aciklama: site.aciklama, adres: site.url, tur: 'website' };
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.ad,
    url: site.url,
    inLanguage: 'tr',
    description: site.aciklama,
    hasPart: oyunlar.map((oyun) => ({ '@type': 'VideoGame', name: oyun.ad, url: oyunMetasi(site, oyun).adres }))
  };
  return ortakEtiketler(site, meta).concat(jsonLd(ld));
}

function oyunBlogu(site, oyun) {
  const meta = Object.assign(oyunMetasi(site, oyun), { tur: 'website' });
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: oyun.ad,
    description: oyun.aciklama,
    url: meta.adres,
    image: site.url + site.paylasimGorseli,
    genre: oyun.kategori,
    inLanguage: 'tr',
    datePublished: oyun.eklenme,
    gamePlatform: 'Web tarayıcısı',
    applicationCategory: 'Game',
    operatingSystem: 'Tüm işletim sistemleri',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
    isPartOf: { '@type': 'WebSite', name: site.ad, url: site.url }
  };
  return ortakEtiketler(site, meta).concat(jsonLd(ld));
}

function bloguYerlestir(html, satirlar, dosya) {
  const bas = html.indexOf(BASLA);
  const son = html.indexOf(BITIS);
  if (bas === -1 || son === -1) throw new Error(`${dosya}: ${BASLA} / ${BITIS} işaretleri bulunamadı`);
  const satirBasi = html.lastIndexOf('\n', bas) + 1;
  const girinti = html.slice(satirBasi, bas);
  return html.slice(0, satirBasi) + blok(girinti, satirlar) + html.slice(son + BITIS.length);
}

function sitemap(site, oyunlar) {
  const enYeni = oyunlar.reduce((en, o) => (o.eklenme > en ? o.eklenme : en), '');
  const kayitlar = [{ loc: site.url, lastmod: enYeni }].concat(
    oyunlar.map((oyun) => ({ loc: oyunMetasi(site, oyun).adres, lastmod: oyun.eklenme }))
  );
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    kayitlar.map((k) => `  <url>\n    <loc>${k.loc}</loc>\n` + (k.lastmod ? `    <lastmod>${k.lastmod}</lastmod>\n` : '') + '  </url>\n').join('') +
    '</urlset>\n';
}

function robots(site) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site.url}sitemap.xml\n`;
}

// Üretilecek tüm dosyaları { göreli yol: içerik } olarak döndürür.
function ciktilar() {
  const site = oku('site.json');
  const oyunlar = oku('games.json');
  const sonuc = {};
  const anaYol = 'index.html';
  sonuc[anaYol] = bloguYerlestir(fs.readFileSync(path.join(KOK, anaYol), 'utf8'), anaSayfaBlogu(site, oyunlar), anaYol);
  for (const oyun of oyunlar) {
    const yol = `games/${oyun.slug}/index.html`;
    sonuc[yol] = bloguYerlestir(fs.readFileSync(path.join(KOK, yol), 'utf8'), oyunBlogu(site, oyun), yol);
  }
  sonuc['sitemap.xml'] = sitemap(site, oyunlar);
  sonuc['robots.txt'] = robots(site);
  return sonuc;
}

module.exports = { ciktilar, oyunMetasi, BASLA, BITIS };

if (require.main === module) {
  for (const [yol, icerik] of Object.entries(ciktilar())) fs.writeFileSync(path.join(KOK, yol), icerik);
  console.log('SEO çıktıları güncellendi');
}
