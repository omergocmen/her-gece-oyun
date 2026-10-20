#!/usr/bin/env node
// SEO çıktılarını games.json ve site.json'dan üretir:
// - index.html ve her oyun sayfasındaki <!-- SEO:BASLA --> ... <!-- SEO:BITIS --> bloğu
//   (title, description, canonical, Open Graph, Twitter kartı, JSON-LD)
// - her oyun sayfasının sonundaki <!-- BENZER:BASLA --> ... <!-- BENZER:BITIS --> bloğu
//   ("Benzer oyunlar": aynı kategori ya da boyuttan 3 oyuna statik bağlantı; JS gerektirmez)
// - sitemap.xml ve robots.txt
// Oyunun paylaşım görseli (games/<slug>/paylasim.png, npm run paylasim) varsa og:image, twitter:image,
// JSON-LD image ve sitemap'te o kullanılır; yoksa site.json'daki genel görsele düşülür.
'use strict';
const fs = require('fs');
const path = require('path');

const { gorselYolu: paylasimYolu } = require('./paylasim-olustur.js');

const KOK = path.join(__dirname, '..');
const BASLA = '<!-- SEO:BASLA -->';
const BITIS = '<!-- SEO:BITIS -->';
const BENZER_BASLA = '<!-- BENZER:BASLA -->';
const BENZER_BITIS = '<!-- BENZER:BITIS -->';
const BENZER_SAYISI = 3;

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

function blok(girinti, satirlar, bas = BASLA, son = BITIS) {
  return [bas].concat(satirlar, [son]).map((s) => (s ? girinti + s : s)).join('\n');
}

// Oyunun kendi paylaşım görseli varsa onun, yoksa sitenin genel görselinin tam adresi.
function paylasimGorseli(site, oyun) {
  const yol = oyun ? paylasimYolu(oyun) : null;
  return site.url + (yol && fs.existsSync(path.join(KOK, yol)) ? yol : site.paylasimGorseli);
}

function ortakEtiketler(site, { baslik, aciklama, adres, tur, gorsel }) {
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
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
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
    adres: `${site.url}games/${oyun.slug}/`,
    gorsel: paylasimGorseli(site, oyun)
  };
}

function anaSayfaBlogu(site, oyunlar) {
  const meta = { baslik: `${site.ad} – Ücretsiz, Girişsiz Tarayıcı Oyunları`, aciklama: site.aciklama, adres: site.url, tur: 'website', gorsel: paylasimGorseli(site) };
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
    image: meta.gorsel,
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

function bloguYerlestir(html, satirlar, dosya, BAS = BASLA, SON = BITIS) {
  const bas = html.indexOf(BAS);
  const son = html.indexOf(SON);
  if (bas === -1 || son === -1) throw new Error(`${dosya}: ${BAS} / ${SON} işaretleri bulunamadı`);
  const satirBasi = html.lastIndexOf('\n', bas) + 1;
  const girinti = html.slice(satirBasi, bas);
  return html.slice(0, satirBasi) + blok(girinti, satirlar, BAS, SON) + html.slice(son + SON.length);
}

// ---------- Benzer oyunlar ----------
// Puan: aynı kategori 2, aynı boyut (2D/3D) 1. Eşitlikte games.json'da yakın olan (dairesel uzaklık) önce gelir;
// böylece bağlantılar en yeni oyunlarda toplanmaz, her oyun birkaç sayfadan bağlantı alır. Benzer oyun
// sayısı yetmezse kalan yerler yine en yakın oyunlarla doldurulur (en az 2, en fazla 3; kendisi hiçbir zaman).
function benzerOyunlar(oyunlar, oyun) {
  const i = oyunlar.indexOf(oyun);
  const n = oyunlar.length;
  return oyunlar
    .map((o, j) => ({
      o, j,
      puan: (o.kategori === oyun.kategori ? 2 : 0) + (o.boyut === oyun.boyut ? 1 : 0),
      uzaklik: Math.min((j - i + n) % n, (i - j + n) % n)
    }))
    .filter((k) => k.o.slug !== oyun.slug)
    .sort((a, b) => b.puan - a.puan || a.uzaklik - b.uzaklik || b.j - a.j)
    .slice(0, BENZER_SAYISI)
    .map((k) => k.o);
}

// Ana sayfadaki oyun kartının (DESIGN.md → game-card) statik hali; oyun sayfası games/<slug>/ altında olduğu için
// bağlantılar ../<slug>/ biçimindedir.
function benzerKarti(oyun, n) {
  const ad = kacis(oyun.ad);
  const gorsel = kacis(oyun.gorsel.replace(/^games\//, '../'));
  const no = 'No. ' + String(n).padStart(3, '0');
  return [
    `  <li><a class="oyun-karti" href="../${oyun.slug}/" aria-label="${ad}, ${kacis(oyun.kategori)}, ${oyun.boyut}, ${no}">`,
    `    <div class="kapak"><img src="${gorsel}" alt="" width="320" height="180" loading="lazy" decoding="async">` +
      `<span class="damga-kart" aria-hidden="true">${no}</span>` +
      `<span class="damga-kart boyut${oyun.boyut === '3D' ? ' uc-boyut' : ''}" aria-hidden="true">${oyun.boyut}</span></div>`,
    `    <div class="metin"><span class="kategori">${kacis(oyun.kategori)}</span><h3>${ad}</h3><p class="aciklama">${kacis(oyun.aciklama)}</p></div>`,
    '  </a></li>'
  ];
}

function benzerBlogu(oyunlar, oyun) {
  const benzerler = benzerOyunlar(oyunlar, oyun);
  if (!benzerler.length) return [];
  return [
    '<section class="benzer" aria-labelledby="benzer-baslik">',
    '  <h2 id="benzer-baslik">Benzer oyunlar</h2>',
    '  <ul class="benzer-izgara">'
  ].concat(
    ...benzerler.map((b) => benzerKarti(b, oyunlar.indexOf(b) + 1).map((s) => '  ' + s)),
    ['  </ul>', '</section>']
  );
}

// İşaretler yoksa (yeni oyun) blok </main>'in hemen önüne eklenir; varsa yeniden yazılır.
function benzerYerlestir(html, satirlar, dosya) {
  if (!html.includes(BENZER_BASLA)) {
    const son = html.lastIndexOf('</main>');
    if (son === -1) throw new Error(`${dosya}: </main> bulunamadı, Benzer oyunlar bloğu eklenemedi`);
    const satirBasi = html.lastIndexOf('\n', son) + 1;
    const girinti = html.slice(satirBasi, son) + '  ';
    html = html.slice(0, satirBasi) + '\n' + girinti + BENZER_BASLA + '\n' + girinti + BENZER_BITIS + '\n' + html.slice(satirBasi);
  }
  return bloguYerlestir(html, satirlar, dosya, BENZER_BASLA, BENZER_BITIS);
}

function sitemap(site, oyunlar) {
  const enYeni = oyunlar.reduce((en, o) => (o.eklenme > en ? o.eklenme : en), '');
  const kayitlar = [{ loc: site.url, lastmod: enYeni }].concat(
    oyunlar.map((oyun) => ({ loc: oyunMetasi(site, oyun).adres, lastmod: oyun.eklenme, gorsel: oyunMetasi(site, oyun).gorsel }))
  );
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    kayitlar.map((k) => `  <url>\n    <loc>${k.loc}</loc>\n` + (k.lastmod ? `    <lastmod>${k.lastmod}</lastmod>\n` : '') +
      (k.gorsel ? `    <image:image>\n      <image:loc>${k.gorsel}</image:loc>\n    </image:image>\n` : '') + '  </url>\n').join('') +
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
    const html = bloguYerlestir(fs.readFileSync(path.join(KOK, yol), 'utf8'), oyunBlogu(site, oyun), yol);
    sonuc[yol] = benzerYerlestir(html, benzerBlogu(oyunlar, oyun), yol);
  }
  sonuc['sitemap.xml'] = sitemap(site, oyunlar);
  sonuc['robots.txt'] = robots(site);
  return sonuc;
}

module.exports = { ciktilar, oyunMetasi, benzerOyunlar, benzerBlogu, benzerYerlestir, BASLA, BITIS, BENZER_BASLA, BENZER_BITIS };

if (require.main === module) {
  for (const [yol, icerik] of Object.entries(ciktilar())) fs.writeFileSync(path.join(KOK, yol), icerik);
  console.log('SEO çıktıları güncellendi');
}
