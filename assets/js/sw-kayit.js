(function () {
  if (!('serviceWorker' in navigator)) return;

  // Yeni sürüm kurulup beklemeye geçince küçük bir bildirim gösterilir. Kullanıcı "Yenile"ye
  // basınca bekleyen service worker devreye girer ve sayfa bir kez yenilenir; basmazsa
  // sekme eski sürümle bozulmadan çalışmaya devam eder.
  var yenileniyor = false;

  function bildirimGoster(bekleyen) {
    if (document.getElementById('yeni-surum')) return;
    var kutu = document.createElement('div');
    kutu.id = 'yeni-surum';
    kutu.setAttribute('role', 'status');
    kutu.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;' +
      'display:flex;align-items:center;gap:12px;max-width:calc(100% - 32px);padding:8px 8px 8px 16px;' +
      'background:#26211c;color:#f3ead8;border:1px solid #3b332b;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.45);' +
      'font:600 .875rem/1.2 "Bricolage Grotesque",system-ui,sans-serif';
    var metin = document.createElement('span');
    metin.textContent = 'Yeni oyun geldi';
    var dugme = document.createElement('button');
    dugme.type = 'button';
    dugme.textContent = 'Yenile';
    dugme.style.cssText = 'border:0;border-radius:999px;padding:8px 16px;background:#ffb23f;color:#1d1307;font:inherit;font-weight:700;cursor:pointer';
    dugme.addEventListener('click', function () {
      yenileniyor = true;
      dugme.disabled = true;
      bekleyen.postMessage('yeni-surume-gec');
    });
    var kapat = document.createElement('button');
    kapat.type = 'button';
    kapat.textContent = '×';
    kapat.setAttribute('aria-label', 'Bildirimi kapat');
    kapat.style.cssText = 'border:0;background:none;color:#b4a78f;font:inherit;font-size:1.25rem;padding:4px 8px;cursor:pointer';
    kapat.addEventListener('click', function () { kutu.remove(); });
    kutu.append(metin, dugme, kapat);
    document.body.append(kutu);
  }

  function izle(kayit) {
    // İlk ziyarette denetleyen yoktur; o zaman güncelleme değil ilk kurulumdur, bildirim gerekmez.
    if (kayit.waiting && navigator.serviceWorker.controller) bildirimGoster(kayit.waiting);
    kayit.addEventListener('updatefound', function () {
      var yeni = kayit.installing;
      if (!yeni) return;
      yeni.addEventListener('statechange', function () {
        if (yeni.state === 'installed' && navigator.serviceWorker.controller) bildirimGoster(yeni);
      });
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!yenileniyor) return;
    location.reload();
  });

  window.addEventListener('load', function () {
    var kok = document.querySelector('meta[name="site-kok"]');
    navigator.serviceWorker.register((kok ? kok.content : '') + 'sw.js').then(izle).catch(function () {});
  });
})();
