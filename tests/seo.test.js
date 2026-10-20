'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ciktilar, benzerOyunlar, benzerBlogu, benzerYerlestir, BASLA, BITIS, BENZER_BASLA, BENZER_BITIS } = require('../scripts/seo-olustur.js');
const Paylasim = require('../scripts/paylasim-olustur.js');

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

// ---------- Oyun başına paylaşım görseli (#33) ----------

test('her oyunun 1200×630 paylaşım görseli vardır ve güncel (değilse: npm run paylasim)', () => {
  oyunlar.forEach((oyun, i) => {
    const yol = Paylasim.gorselYolu(oyun);
    assert.ok(fs.existsSync(path.join(KOK, yol)), `${yol} yok: npm run paylasim çalıştırıp dosyayı ekleyin`);
    const png = fs.readFileSync(path.join(KOK, yol));
    const bilgi = Paylasim.pngBilgisi(png);
    assert.deepEqual([bilgi.en, bilgi.boy], [Paylasim.EN, Paylasim.BOY], `${yol}: boyut 1200×630 değil`);
    assert.ok(png.length < 200 * 1024, `${yol}: ${Math.round(png.length / 1024)} KB, çok büyük`);
    assert.equal(bilgi.ozet, Paylasim.kaynakOzeti(oyun, i + 1), `${yol}: kapak ya da oyun bilgisi değişmiş, npm run paylasim`);
  });
});

test('oyun sayfalarında og:image, twitter:image ve JSON-LD image oyunun kendi görselidir', () => {
  for (const oyun of oyunlar) {
    const html = oku(`games/${oyun.slug}/index.html`);
    const beklenen = site.url + Paylasim.gorselYolu(oyun);
    assert.equal(tekEslesme(html, /<meta property="og:image" content="([^"]+)">/, 'og:image'), beklenen, `${oyun.slug}: og:image`);
    assert.equal(tekEslesme(html, /<meta name="twitter:image" content="([^"]+)">/, 'twitter:image'), beklenen, `${oyun.slug}: twitter:image`);
    const ld = JSON.parse(tekEslesme(html, /<script type="application\/ld\+json">([^<]+)<\/script>/, 'JSON-LD'));
    assert.equal(ld.image, beklenen, `${oyun.slug}: JSON-LD image`);
    assert.ok(oku('sitemap.xml').includes(`<image:loc>${beklenen}</image:loc>`), `${oyun.slug}: sitemap'te görsel yok`);
  }
});

test('paylaşım görselleri çevrimdışı önbelleğe girmez', () => {
  const manifest = oku('precache-manifest.js');
  assert.ok(!/paylasim\.png/.test(manifest), 'precache-manifest.js paylaşım görseli içeriyor');
  for (const oyun of oyunlar) assert.ok(!oyun.dosyalar.some((d) => d.endsWith('paylasim.png')), `${oyun.slug}: dosyalar paylaşım görseli içeriyor`);
});

// ---------- Benzer oyunlar (#33) ----------

function benzerBaglantilar(html) {
  const bas = html.indexOf(BENZER_BASLA);
  const son = html.indexOf(BENZER_BITIS);
  assert.ok(bas !== -1 && son > bas, 'Benzer oyunlar bloğu yok');
  return [...html.slice(bas, son).matchAll(/href="\.\.\/([a-z0-9-]+)\/"/g)].map((m) => m[1]);
}

test('her oyun sayfasında 2-3 farklı oyuna statik "Benzer oyunlar" bağlantısı vardır, kendisine yoktur', () => {
  const sluglar = new Set(oyunlar.map((o) => o.slug));
  for (const oyun of oyunlar) {
    const html = oku(`games/${oyun.slug}/index.html`);
    assert.match(html, /<h2 id="benzer-baslik">Benzer oyunlar<\/h2>/, `${oyun.slug}: başlık yok`);
    const baglantilar = benzerBaglantilar(html);
    assert.ok(baglantilar.length >= 2 && baglantilar.length <= 3, `${oyun.slug}: ${baglantilar.length} bağlantı`);
    assert.equal(new Set(baglantilar).size, baglantilar.length, `${oyun.slug}: aynı oyun iki kez`);
    assert.ok(!baglantilar.includes(oyun.slug), `${oyun.slug}: kendine bağlantı veriyor`);
    for (const s of baglantilar) {
      assert.ok(sluglar.has(s), `${oyun.slug}: ${s} games.json'da yok`);
      assert.ok(html.includes(`src="../${s}/kapak.svg"`), `${oyun.slug}: ${s} kapağı yok`);
    }
    // Blok </main> içinde, "Nasıl oynanır?" bölümünden sonradır.
    assert.ok(html.indexOf('Nasıl oynanır?') < html.indexOf(BENZER_BASLA) && html.indexOf(BENZER_BITIS) < html.indexOf('</main>'), `${oyun.slug}: blok yerinde değil`);
  }
});

test('benzer oyun seçimi aynı kategoriyi, sonra aynı boyutu öne alır; tek kalan oyunu da doldurur', () => {
  const liste = [
    { slug: 'a', kategori: 'Bulmaca', boyut: '2D' },
    { slug: 'b', kategori: 'Aksiyon', boyut: '3D' },
    { slug: 'c', kategori: 'Bulmaca', boyut: '3D' },
    { slug: 'd', kategori: 'Kelime', boyut: '2D' },
    { slug: 'e', kategori: 'Spor', boyut: '3D' }
  ];
  assert.deepEqual(benzerOyunlar(liste, liste[0]).map((o) => o.slug), ['c', 'd', 'e']);
  assert.deepEqual(benzerOyunlar(liste, liste[1]).map((o) => o.slug), ['c', 'e', 'a']);
  for (const oyun of liste) {
    const secim = benzerOyunlar(liste, oyun);
    assert.equal(secim.length, 3);
    assert.ok(!secim.includes(oyun));
  }
  // Kategorisi ve boyutu kimseyle uyuşmayan oyun da en az 2 bağlantı alır.
  const az = [{ slug: 'x', kategori: 'K', boyut: '2D' }, { slug: 'y', kategori: 'L', boyut: '3D' }, { slug: 'z', kategori: 'M', boyut: '3D' }];
  assert.equal(benzerOyunlar(az, az[0]).length, 2);
});

test('yeni oyun sayfasına Benzer oyunlar bloğu </main> önüne eklenir ve ikinci derlemede değişmez', () => {
  const html = '<body>\n  <main class="container oyun-sayfasi">\n    <h2>Nasıl oynanır?</h2>\n    <p>Metin</p>\n  </main>\n</body>\n';
  const satirlar = benzerBlogu(oyunlar, oyunlar[0]);
  const bir = benzerYerlestir(html, satirlar, 'deneme');
  const iki = benzerYerlestir(bir, satirlar, 'deneme');
  assert.equal(iki, bir);
  assert.ok(bir.indexOf(BENZER_BITIS) < bir.indexOf('</main>'));
  assert.ok(benzerBaglantilar(bir).length >= 2);
});
