// Önbellek listesi ve sürümü scripts/precache-olustur.js tarafından üretilir.
importScripts('precache-manifest.js');

var ONBELLEK = 'hgo-' + self.PRECACHE.surum;

self.addEventListener('install', function (olay) {
  olay.waitUntil(
    caches.open(ONBELLEK)
      .then(function (onbellek) { return onbellek.addAll(self.PRECACHE.dosyalar.map(function (url) { return new Request(url, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (olay) {
  olay.waitUntil(
    caches.keys()
      .then(function (anahtarlar) {
        return Promise.all(anahtarlar
          .filter(function (anahtar) { return anahtar.indexOf('hgo-') === 0 && anahtar !== ONBELLEK; })
          .map(function (anahtar) { return caches.delete(anahtar); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Önce önbellek, yoksa ağ; ağdan gelen aynı kökenli yanıtlar önbelleğe eklenir.
self.addEventListener('fetch', function (olay) {
  var istek = olay.request;
  if (istek.method !== 'GET' || new URL(istek.url).origin !== self.location.origin) return;
  olay.respondWith(
    caches.match(istek, { ignoreSearch: true }).then(function (kayitli) {
      if (kayitli) return kayitli;
      return fetch(istek).then(function (yanit) {
        if (yanit.ok) {
          var kopya = yanit.clone();
          caches.open(ONBELLEK).then(function (onbellek) { onbellek.put(istek, kopya); });
        }
        return yanit;
      }).catch(function () {
        if (istek.mode === 'navigate') return caches.match('./');
        return Response.error();
      });
    })
  );
});
