#!/usr/bin/env node
// Her oyun için sosyal paylaşım görseli üretir: games/<slug>/paylasim.png (1200×630).
// Görsel kapak.svg + oyun adı + kategori + site adından oluşur, zemin DESIGN.md "Gece Baskısı" paletidir.
//
// Playwright depo bağımlılığı değildir; Vercel/Netlify derlemesinde tarayıcı yoktur. Bu yüzden PNG'ler
// yerelde üretilip depoya eklenir. seo-olustur.js görsel varsa onu, yoksa site.json'daki genel görseli
// kullanır; tests/seo.test.js eksik ya da güncel olmayan görselde başarısız olur.
//
// Her PNG'ye kaynaklarının özeti (oyun adı, kategori, boyut, numara, kapak.svg, şablon sürümü) bir tEXt
// parçası olarak yazılır. Böylece kapak ya da ad değişince görselin eskidiği test edilebilir.
//
// Kullanım:
//   npm run paylasim                 # eksik ya da eskimiş görselleri üretir
//   npm run paylasim -- --hepsi      # tümünü yeniden üretir
//   PLAYWRIGHT_YOLU=/yol/node_modules/playwright npm run paylasim
// npm run build bu betiği --tarayici-yoksa-gec ile çağırır: görseller güncelse tarayıcı hiç açılmaz;
// eskimiş görsel varsa Playwright bulunursa üretir, bulunmazsa uyarıp derlemeyi sürdürür (testler yakalar).
// Görseller precache listesine girmez (yalnızca sosyal ağlar indirir), games.json "dosyalar"a eklenmez.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KOK = path.join(__dirname, '..');
const EN = 1200;
const BOY = 630;
const SABLON_SURUMU = '1';
const OZET_ANAHTARI = 'hgo-kaynak';

function oyunlariOku() {
  return JSON.parse(fs.readFileSync(path.join(KOK, 'games.json'), 'utf8'));
}

function gorselYolu(oyun) {
  return `games/${oyun.slug}/paylasim.png`;
}

function numara(n) {
  return 'No. ' + String(n).padStart(3, '0');
}

// Görselin içeriğini belirleyen her şeyin özeti; değişirse görsel yeniden üretilmelidir.
function kaynakOzeti(oyun, n) {
  const ozet = crypto.createHash('sha256');
  ozet.update(JSON.stringify([SABLON_SURUMU, oyun.ad, oyun.kategori, oyun.boyut, n]));
  ozet.update(fs.readFileSync(path.join(KOK, oyun.gorsel)));
  return ozet.digest('hex').slice(0, 16);
}

// ---------- PNG tEXt parçası ----------
const CRC_TABLOSU = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(tampon) {
  let c = 0xffffffff;
  for (const b of tampon) c = CRC_TABLOSU[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function parcalar(png) {
  const sonuc = [];
  for (let i = 8; i < png.length;) {
    const uzunluk = png.readUInt32BE(i);
    sonuc.push({ tur: png.toString('latin1', i + 4, i + 8), veri: png.subarray(i + 8, i + 8 + uzunluk), bas: i, son: i + 12 + uzunluk });
    i += 12 + uzunluk;
  }
  return sonuc;
}

function pngBilgisi(png) {
  const p = parcalar(png);
  const ihdr = p.find((x) => x.tur === 'IHDR');
  let ozet = null;
  for (const x of p) {
    if (x.tur !== 'tEXt') continue;
    const sifir = x.veri.indexOf(0);
    if (x.veri.toString('latin1', 0, sifir) === OZET_ANAHTARI) ozet = x.veri.toString('latin1', sifir + 1);
  }
  return { en: ihdr.veri.readUInt32BE(0), boy: ihdr.veri.readUInt32BE(4), ozet };
}

function ozetYaz(png, ozet) {
  const ihdr = parcalar(png).find((x) => x.tur === 'IHDR');
  const veri = Buffer.from(`${OZET_ANAHTARI}\0${ozet}`, 'latin1');
  const parca = Buffer.alloc(12 + veri.length);
  parca.writeUInt32BE(veri.length, 0);
  parca.write('tEXt', 4, 'latin1');
  veri.copy(parca, 8);
  parca.writeUInt32BE(crc32(parca.subarray(4, 8 + veri.length)), 8 + veri.length);
  return Buffer.concat([png.subarray(0, ihdr.son), parca, png.subarray(ihdr.son)]);
}

// Görsel yoksa ya da kaynakları değiştiyse true.
function eskiMi(oyun, n) {
  const dosya = path.join(KOK, gorselYolu(oyun));
  if (!fs.existsSync(dosya)) return true;
  return pngBilgisi(fs.readFileSync(dosya)).ozet !== kaynakOzeti(oyun, n);
}

// ---------- Şablon ----------
function kacis(metin) {
  return String(metin).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function veriAdresi(dosya, tur) {
  return `data:${tur};base64,` + fs.readFileSync(path.join(KOK, dosya)).toString('base64');
}

function sablon(oyun, n) {
  const fontlar = ['assets/fonts/bricolage-latin.woff2', 'assets/fonts/bricolage-latin-ext.woff2']
    .map((f) => `url(${veriAdresi(f, 'font/woff2')}) format("woff2")`).join(', ');
  const site = JSON.parse(fs.readFileSync(path.join(KOK, 'site.json'), 'utf8'));
  const kelimeler = site.ad.split(' ');
  const sonKelime = kelimeler.pop();
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
@font-face { font-family: B; font-weight: 200 800; font-stretch: 75% 100%; src: ${fontlar}; }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${EN}px; height: ${BOY}px; overflow: hidden; }
body {
  position: relative; background: #110f0d; color: #f3ead8; font-family: B, system-ui, sans-serif;
  display: grid; grid-template-columns: 1fr 600px; align-items: center; gap: 40px; padding: 0 64px 0 72px;
}
body::before { content: ""; position: absolute; inset: 28px; border: 4px double #3b332b; border-radius: 16px; pointer-events: none; }
.yildiz { position: absolute; border-radius: 50%; background: #f3ead8; }
.metin { position: relative; display: flex; flex-direction: column; min-width: 0; }
.logo { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 800; font-stretch: 80%; text-transform: uppercase; letter-spacing: -.01em; }
.logo::before { content: ""; width: 26px; height: 26px; border-radius: 50%; box-shadow: inset -8px 2px 0 0 #ffb23f; transform: rotate(-12deg); }
.logo em { font-style: normal; color: #ffb23f; }
.ust { margin-top: 56px; font-size: 20px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #ffb23f; font-variant-numeric: tabular-nums; }
h1 { margin: 14px 0 0; font-size: ${oyun.ad.length > 14 ? 76 : 92}px; font-weight: 800; font-stretch: 78%; line-height: .95; letter-spacing: -.02em; text-transform: uppercase; overflow-wrap: anywhere; }
.alt { margin-top: 28px; font-size: 22px; font-weight: 600; color: #b4a78f; }
.vitrin { position: relative; border-radius: 12px; overflow: hidden; border: 1px solid #3b332b; transform: rotate(1.5deg);
  box-shadow: 0 40px 80px -30px rgba(255, 178, 63, .45), 0 3px 0 #3b332b; }
.vitrin img { display: block; width: 600px; height: 337.5px; }
.damga { position: absolute; top: 16px; right: 16px; padding: 8px 14px; border-radius: 999px; background: rgba(17, 15, 13, .75); color: ${oyun.boyut === '3D' ? '#ffb23f' : '#f3ead8'};
  font-size: 18px; font-weight: 700; letter-spacing: .14em; }
</style></head><body>
<span class="yildiz" style="left:120px;top:70px;width:3px;height:3px"></span>
<span class="yildiz" style="left:640px;top:96px;width:2px;height:2px;opacity:.7"></span>
<span class="yildiz" style="left:1090px;top:560px;width:3px;height:3px;background:#ffb23f"></span>
<span class="yildiz" style="left:560px;top:540px;width:2px;height:2px;opacity:.6"></span>
<div class="metin">
  <div class="logo"><span>${kacis(kelimeler.join(' '))} <em>${kacis(sonKelime)}</em></span></div>
  <div class="ust">${kacis(numara(n))} · ${kacis(oyun.kategori)}</div>
  <h1>${kacis(oyun.ad)}</h1>
  <div class="alt">Ücretsiz · Girişsiz · İnternetsiz</div>
</div>
<div class="vitrin"><img src="${veriAdresi(oyun.gorsel, 'image/svg+xml')}" alt=""><span class="damga">${kacis(oyun.boyut)}</span></div>
</body></html>`;
}

// ---------- Playwright ----------
function playwrightYukle(yoksaGec) {
  const adaylar = [process.env.PLAYWRIGHT_YOLU, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const aday of adaylar) {
    try { return require(aday); } catch (e) { /* sıradaki aday */ }
  }
  if (yoksaGec) return null;
  console.error(
    'Playwright bulunamadı. Paylaşım görselleri tarayıcıyla çizilir; Playwright depo bağımlılığı değildir.\n' +
    'Depo dışında bir klasöre kurup yolunu verin, ör.:\n' +
    '  npm i --prefix /tmp/pw playwright && npx --prefix /tmp/pw playwright install chromium\n' +
    '  PLAYWRIGHT_YOLU=/tmp/pw/node_modules/playwright npm run paylasim'
  );
  process.exit(1);
}

async function uret({ hepsi, yoksaGec }) {
  const oyunlar = oyunlariOku();
  const hedefler = oyunlar.map((oyun, i) => ({ oyun, n: i + 1 })).filter(({ oyun, n }) => hepsi || eskiMi(oyun, n));
  if (!hedefler.length) { console.log('Paylaşım görselleri güncel'); return; }
  const pw = playwrightYukle(yoksaGec);
  if (!pw) {
    console.warn(`Uyarı: ${hedefler.map(({ oyun }) => gorselYolu(oyun)).join(', ')} eksik ya da eski, ` +
      'Playwright bulunamadığı için üretilmedi. Playwright kurulu bir makinede npm run paylasim çalıştırıp görselleri ekleyin.');
    return;
  }
  const { chromium } = pw;
  const tarayici = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const sayfa = await tarayici.newPage({ viewport: { width: EN, height: BOY }, deviceScaleFactor: 1 });
    for (const { oyun, n } of hedefler) {
      await sayfa.setContent(sablon(oyun, n), { waitUntil: 'load' });
      await sayfa.evaluate(() => document.fonts.ready);
      const png = await sayfa.screenshot({ type: 'png', clip: { x: 0, y: 0, width: EN, height: BOY } });
      fs.writeFileSync(path.join(KOK, gorselYolu(oyun)), ozetYaz(png, kaynakOzeti(oyun, n)));
      console.log(`${gorselYolu(oyun)} (${Math.round(png.length / 1024)} KB)`);
    }
  } finally {
    await tarayici.close();
  }
}

module.exports = { EN, BOY, gorselYolu, kaynakOzeti, pngBilgisi, eskiMi };

if (require.main === module) {
  uret({ hepsi: process.argv.includes('--hepsi'), yoksaGec: process.argv.includes('--tarayici-yoksa-gec') }).catch((e) => { console.error(e); process.exit(1); });
}
