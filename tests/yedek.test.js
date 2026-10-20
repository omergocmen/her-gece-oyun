'use strict';
// İlerleme yedeği: yalnızca hgo: kayıtları dışa aktarılır, geçersiz dosya reddedilir, hgo: dışı anahtarlara dokunulmaz.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Yedek = require('../assets/js/yedek.js');

const KOK = path.join(__dirname, '..');
const kayit = { 'hgo:gunluk': '{"tarih":"2026-10-20"}', 'hgo:ozet:tavla': '"Seri 3"', 'baska:anahtar': '1' };

test('olustur: yalnızca hgo: anahtarları, sürüm ve tarih ile', () => {
  const y = Yedek.olustur(kayit, new Date('2026-10-20T10:00:00Z'));
  assert.equal(y.surum, 1);
  assert.deepEqual(Object.keys(y.veri).sort(), ['hgo:gunluk', 'hgo:ozet:tavla']);
  assert.equal(y.tarih, '2026-10-20T10:00:00.000Z');
});

test('gidiş dönüş: dışa aktarılan yedek aynen doğrulanır', () => {
  const s = Yedek.dogrula(JSON.stringify(Yedek.olustur(kayit)));
  assert.equal(s.tamam, true);
  assert.equal(s.sayi, 2);
  assert.equal(s.veri['hgo:ozet:tavla'], '"Seri 3"');
});

test('dogrula: bozuk, boş, başka siteye ait ve yanlış sürümlü dosyalar reddedilir', () => {
  const kotu = ['', '   ', '{bozuk', '[]', 'null', '{"kaynak":"baska","surum":1,"veri":{}}',
    JSON.stringify({ kaynak: 'her-gece-oyun', surum: 99, veri: {} }),
    JSON.stringify({ kaynak: 'her-gece-oyun', surum: 1, veri: [] }),
    JSON.stringify({ kaynak: 'her-gece-oyun', surum: 1, veri: {} }),
    JSON.stringify({ kaynak: 'her-gece-oyun', surum: 1, veri: { 'hgo:x': '{bozuk' } })];
  kotu.forEach((m) => { const s = Yedek.dogrula(m); assert.equal(s.tamam, false, m); assert.ok(s.hata); });
  assert.equal(Yedek.dogrula(undefined).tamam, false);
});

test('dogrula: hgo: dışı anahtarlar yüklenecek veriden atılır', () => {
  const s = Yedek.dogrula(JSON.stringify({ kaynak: 'her-gece-oyun', surum: 1, veri: { 'hgo:a': '1', 'x': '2', 'hgo:b': 3 } }));
  assert.equal(s.tamam, true);
  assert.deepEqual(Object.keys(s.veri), ['hgo:a']);
});

test('dosyaAdi: yerel tarihle YYYY-AA-GG', () => {
  assert.equal(Yedek.dosyaAdi(new Date(2026, 0, 5, 12)), 'her-gece-oyun-yedek-2026-01-05.json');
});

test('ana sayfa yedek düğmelerini ve yedek.js\'yi yükler, önbelleğe alınır', () => {
  const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  ['yedek-indir', 'yedek-yukle', 'yedek-dosya', 'yedek-mesaj'].forEach((id) => assert.ok(html.includes('id="' + id + '"'), id));
  assert.ok(html.includes('assets/js/yedek.js'));
  assert.ok(fs.readFileSync(path.join(KOK, 'precache-manifest.js'), 'utf8').includes('assets/js/yedek.js'));
});
