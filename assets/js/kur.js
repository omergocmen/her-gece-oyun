// "Uygulama gibi kur" paneli (yalnızca ana sayfa): Chromium'da beforeinstallprompt ile kurulum penceresini açar,
// iOS Safari'de "Paylaş → Ana Ekrana Ekle" ipucunu gösterir. Karar mantığı saf fonksiyondur ve Node'da test edilir.
(function (kok) {
  var KAPAT_ANAHTAR = 'kur-kapat';
  var BEKLEME_MS = 7 * 24 * 60 * 60 * 1000;

  // Safari dışı iOS tarayıcıları (Chrome, Firefox, Edge) "Ana Ekrana Ekle"yi aynı yerden sunmaz; yalnızca Safari'de ipucu çıkar.
  function iosSafariMi(ua, platform, dokunmaNoktasi) {
    ua = ua || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && dokunmaNoktasi > 1);
    return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  }

  // Dönüş: 'gizli' | 'kur' | 'ios'. Standalone, yakın zamanda kapatılmış ya da kurulum yolu olmayan tarayıcıda gizli.
  function karar(d) {
    if (d.standalone) return 'gizli';
    if (d.kapatildi != null && d.simdi - d.kapatildi < BEKLEME_MS && d.simdi >= d.kapatildi) return 'gizli';
    if (d.istem) return 'kur';
    if (d.iosSafari) return 'ios';
    return 'gizli';
  }

  var Kur = { KAPAT_ANAHTAR: KAPAT_ANAHTAR, BEKLEME_MS: BEKLEME_MS, iosSafariMi: iosSafariMi, karar: karar };
  kok.Kur = Kur;
  if (typeof module !== 'undefined' && module.exports) module.exports = Kur;

  var doc = kok.document;
  if (!doc || !doc.getElementById) return;
  var panel = doc.getElementById('kur');
  if (!panel) return;
  var dugme = doc.getElementById('kur-dugme');
  var kapat = doc.getElementById('kur-kapat');
  var ipucu = doc.getElementById('kur-ios');
  var baslik = doc.getElementById('kur-baslik');
  var istem = null;

  function standaloneMi() {
    try { if (kok.matchMedia && kok.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) { /* eski tarayıcı */ }
    return !!(kok.navigator && kok.navigator.standalone);
  }
  function kapatilmaZamani() {
    try { var v = kok.localStorage.getItem('hgo:' + KAPAT_ANAHTAR); return v === null ? null : Number(JSON.parse(v)) || null; } catch (e) { return null; }
  }
  function goster(durum) {
    if (durum === 'gizli') { panel.hidden = true; panel.classList.remove('gorunur'); return; }
    dugme.hidden = durum !== 'kur';
    ipucu.hidden = durum !== 'ios';
    baslik.textContent = 'Uygulama gibi kur';
    panel.hidden = false;
    // hidden kalktıktan sonraki karede sınıf eklenir ki fade 200 ms çalışsın.
    kok.requestAnimationFrame(function () { panel.classList.add('gorunur'); });
  }
  function guncelle() {
    var n = kok.navigator || {};
    goster(karar({
      standalone: standaloneMi(), kapatildi: kapatilmaZamani(), simdi: Date.now(), istem: !!istem,
      iosSafari: iosSafariMi(n.userAgent, n.platform, n.maxTouchPoints)
    }));
  }

  kok.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); istem = e; guncelle(); });
  kok.addEventListener('appinstalled', function () {
    istem = null;
    baslik.textContent = 'Kuruldu';
    dugme.hidden = true; ipucu.hidden = true;
    setTimeout(function () { goster('gizli'); }, 1500);
  });
  dugme.addEventListener('click', function () {
    if (!istem) return;
    dugme.disabled = true;
    istem.prompt();
    istem.userChoice.then(function () { istem = null; dugme.disabled = false; guncelle(); },
      function () { dugme.disabled = false; });
  });
  kapat.addEventListener('click', function () {
    try { kok.localStorage.setItem('hgo:' + KAPAT_ANAHTAR, JSON.stringify(Date.now())); } catch (e) { /* tercih saklanamaz */ }
    goster('gizli');
  });
  guncelle();
})(this);
