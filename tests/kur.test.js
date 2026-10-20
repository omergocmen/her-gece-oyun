'use strict';
// "Uygulama gibi kur" paneli: karar mantığı (standalone, kapatma bekleme süresi, iOS Safari) ve ana sayfa bağlantıları.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Kur = require('../assets/js/kur.js');

const KOK = path.join(__dirname, '..');
const SIMDI = 1.8e12;
const temel = { standalone: false, kapatildi: null, simdi: SIMDI, istem: false, iosSafari: false };
const k = (o) => Kur.karar(Object.assign({}, temel, o));

test('karar: kurulum istemi varsa "kur", iOS Safari\'de "ios", başka tarayıcıda gizli', () => {
  assert.equal(k({ istem: true }), 'kur');
  assert.equal(k({ iosSafari: true }), 'ios');
  assert.equal(k({}), 'gizli');
});

test('karar: standalone modda hiçbir durumda görünmez', () => {
  assert.equal(k({ standalone: true, istem: true }), 'gizli');
  assert.equal(k({ standalone: true, iosSafari: true }), 'gizli');
});

test('karar: kapatma 7 gün saklanır, sonra yeniden sorulur', () => {
  const gun = 24 * 60 * 60 * 1000;
  assert.equal(k({ istem: true, kapatildi: SIMDI - 6 * gun }), 'gizli');
  assert.equal(k({ istem: true, kapatildi: SIMDI - 8 * gun }), 'kur');
  assert.equal(k({ iosSafari: true, kapatildi: SIMDI - 1000 }), 'gizli');
  assert.equal(k({ istem: true, kapatildi: SIMDI + 1000 }), 'kur', 'gelecekteki (bozuk) zaman damgası kalıcı gizleme yapmaz');
});

test('iosSafariMi: Safari evet; iOS Chrome/Firefox, Android ve masaüstü hayır; iPadOS masaüstü kipi evet', () => {
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  assert.equal(Kur.iosSafariMi(safari, 'iPhone', 5), true);
  assert.equal(Kur.iosSafariMi(safari.replace('Version/17.0', 'CriOS/120'), 'iPhone', 5), false);
  assert.equal(Kur.iosSafariMi(safari.replace('Version/17.0', 'FxiOS/120'), 'iPhone', 5), false);
  assert.equal(Kur.iosSafariMi('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36', 'Linux armv8l', 5), false);
  assert.equal(Kur.iosSafariMi('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', 'MacIntel', 0), false);
  assert.equal(Kur.iosSafariMi('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', 'MacIntel', 5), true);
});

test('ana sayfa paneli başta gizli yükler, kur.js önbelleğe alınır', () => {
  const html = fs.readFileSync(path.join(KOK, 'index.html'), 'utf8');
  assert.match(html, /<section id="kur"[^>]*\bhidden>/);
  ['kur-dugme', 'kur-kapat', 'kur-ios', 'kur-baslik'].forEach((id) => assert.ok(html.includes('id="' + id + '"'), id));
  assert.ok(html.includes('assets/js/kur.js'));
  assert.ok(fs.readFileSync(path.join(KOK, 'precache-manifest.js'), 'utf8').includes('assets/js/kur.js'));
  assert.ok(!fs.readdirSync(path.join(KOK, 'games')).some((d) => fs.existsSync(path.join(KOK, 'games', d, 'index.html')) &&
    fs.readFileSync(path.join(KOK, 'games', d, 'index.html'), 'utf8').includes('assets/js/kur.js')), 'oyun sayfalarında panel yok');
});
