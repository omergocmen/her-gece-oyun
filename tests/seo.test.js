'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ciktilar, BASLA, BITIS } = require('../scripts/seo-olustur.js');

const KOK = path.join(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(KOK, 'site.json'), 'utf8'));
const oyunlar = JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8'));
const uretilen = ciktilar();
const sayfalar = ['index.html'].concat(oyunlar.map((o) => `games/${o.slug}/index.html`));

function oku(yol) { return fs.readFileSync(path.join(KOK, yol), 'utf8'); }
function tekEslesme(html, desen, ne) {
  const m = html.match(desen);
  assert.ok(m, `${ne} bulunamadı`);
  return m[1];
}

test('site.json adresi https ve / ile biter', () => {
  assert.match(site.url, /^https:\/\/.+\/$/);
  assert.ok(fs.existsSync(path.join(KOK, site.paylasimGorseli)), 'paylaşım görseli yok');
});

test('SEO çıktıları güncel (değilse: npm run build)', () => {
  for (const [yol, icerik] of Object.entries(uretilen)) {
    assert.equal(oku(yol), icerik, `${yol} güncel değil`);
  }
});

test('her sayfanın title, description ve canonical değeri benzersizdir ve statik HTML\'dedir', () => {
  const gorulen = { title: new Set(), description: new Set(), canonical: new Set() };
  for (const yol of sayfalar) {
    const html = oku(yol);
    assert.ok(html.includes(BASLA) && html.includes(BITIS), `${yol}: SEO bloğu yok`);
    const degerler = {
      title: tekEslesme(html, /<title>([^<]+)<\/title>/, `${yol} title`),
      description: tekEslesme(html, /<meta name="description" content="([^"]+)">/, `${yol} description`),
      canonical: tekEslesme(html, /<link rel="canonical" href="([^"]+)">/, `${yol} canonical`)
    };
    for (const [alan, deger] of Object.entries(degerler)) {
      assert.ok(!gorulen[alan].has(deger), `${yol}: ${alan} başka bir sayfayla aynı`);
      gorulen[alan].add(deger);
    }
    assert.ok(degerler.canonical.startsWith(site.url), `${yol}: canonical site adresiyle başlamıyor`);
    for (const etiket of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card']) {
      assert.ok(html.includes(`"${etiket}"`), `${yol}: ${etiket} yok`);
    }
  }
});

test('JSON-LD geçerli ve gerekli alanları içerir', () => {
  for (const yol of sayfalar) {
    const ham = tekEslesme(oku(yol), /<script type="application\/ld\+json">([^<]+)<\/script>/, `${yol} JSON-LD`);
    const ld = JSON.parse(ham);
    assert.equal(ld['@context'], 'https://schema.org');
    if (yol === 'index.html') {
      assert.equal(ld['@type'], 'WebSite');
      assert.equal(ld.hasPart.length, oyunlar.length);
    } else {
      assert.equal(ld['@type'], 'VideoGame');
      for (const alan of ['name', 'description', 'url', 'genre', 'image']) assert.ok(ld[alan], `${yol}: ${alan} yok`);
      assert.equal(ld.isAccessibleForFree, true);
      assert.equal(ld.offers.price, '0');
    }
  }
});

test('her oyun sayfasında "Nasıl oynanır?" bölümü ve en az bir paragraf vardır', () => {
  for (const oyun of oyunlar) {
    const html = oku(`games/${oyun.slug}/index.html`);
    assert.match(html, /<h2>Nasıl oynanır\?<\/h2>\s*<p>[^<]{40,}/, `${oyun.slug}: "Nasıl oynanır?" metni yok ya da çok kısa`);
  }
});

test('sitemap tüm oyunları içerir, robots.txt sitemap\'i gösterir', () => {
  const xml = oku('sitemap.xml');
  assert.ok(xml.includes(`<loc>${site.url}</loc>`));
  for (const oyun of oyunlar) assert.ok(xml.includes(`<loc>${site.url}games/${oyun.slug}/</loc>`), `${oyun.slug} sitemap'te yok`);
  assert.ok(oku('robots.txt').includes(`Sitemap: ${site.url}sitemap.xml`));
});
