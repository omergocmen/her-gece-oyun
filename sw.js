// Önbellek listesi, sürümü ve dosya özetleri scripts/precache-olustur.js tarafından üretilir.
importScripts('precache-manifest.js');

var ONBELLEK = 'hgo-' + self.PRECACHE.surum;

function onaltilik(tampon) {
  return Array.prototype.map.call(new Uint8Array(tampon), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
// precache-olustur.js'deki dosyaOzeti ile aynı: SHA-256'nın ilk 12 onaltılık hanesi.
function ozetAl(tampon) {
  return crypto.subtle.digest('SHA-256', tampon).then(function (h) { return onaltilik(h).slice(0, 12); });
}
function yanitYap(tampon, kaynak) {
  return new Response(tampon, { status: 200, headers: { 'Content-Type': kaynak.headers.get('Content-Type') || '' } });
}

// Dosya eski önbelleklerden birinde aynı özetle duruyorsa onu döndürür, yoksa null.
function eskidenBul(eskiler, url, beklenen) {
  var i = 0;
  function sonraki() {
    if (i >= eskiler.length) return Promise.resolve(null);
    return eskiler[i++].match(url).then(function (kayitli) {
      if (!kayitli) return sonraki();
      return kayitli.arrayBuffer().then(function (tampon) {
        return ozetAl(tampon).then(function (ozet) { return ozet === beklenen ? yanitYap(tampon, kayitli) : sonraki(); });
      });
    });
  }
  return sonraki();
}

// Yeni sürüm kurulurken yalnızca yeni ya da içeriği değişen dosyalar ağdan indirilir.
self.addEventListener('install', function (olay) {
  var ozetler = self.PRECACHE.ozetler || {};
  olay.waitUntil(
    caches.keys().then(function (anahtarlar) {
      var eskiAdlar = anahtarlar.filter(function (a) { return a.indexOf('hgo-') === 0 && a !== ONBELLEK; }).reverse();
      return Promise.all([caches.open(ONBELLEK)].concat(eskiAdlar.map(function (a) { return caches.open(a); })));
    }).then(function (acik) {
      var yeni = acik[0], eskiler = acik.slice(1);
      return Promise.all(self.PRECACHE.dosyalar.map(function (url) {
        return eskidenBul(eskiler, url, ozetler[url]).then(function (bulunan) {
          if (bulunan) return yeni.put(url, bulunan);
          return fetch(new Request(url, { cache: 'reload' })).then(function (yanit) {
            if (!yanit.ok) throw new Error(url + ' indirilemedi: ' + yanit.status);
            return yanit.arrayBuffer().then(function (tampon) { return yeni.put(url, yanitYap(tampon, yanit)); });
          });
        });
      }));
    })
  );
});

// Açık sekme eski sürümle çalışmaya devam eder; sayfadaki "Yenile" düğmesi yeni sürüme geçirir.
self.addEventListener('message', function (olay) {
  if (olay.data === 'yeni-surume-gec') self.skipWaiting();
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

// Önce bu sürümün önbelleği, yoksa ağ; ağdan gelen aynı kökenli yanıtlar önbelleğe eklenir.
// Yalnızca kendi önbelleğine bakar ki sayfa iki sürümün dosyalarını karıştırmasın.
self.addEventListener('fetch', function (olay) {
  var istek = olay.request;
  if (istek.method !== 'GET' || new URL(istek.url).origin !== self.location.origin) return;
  olay.respondWith(
    caches.open(ONBELLEK).then(function (onbellek) {
      return onbellek.match(istek, { ignoreSearch: true }).then(function (kayitli) {
        if (kayitli) return kayitli;
        return fetch(istek).then(function (yanit) {
          if (yanit.ok) onbellek.put(istek, yanit.clone());
          return yanit;
        }).catch(function () {
          if (istek.mode === 'navigate') return onbellek.match('./');
          return Response.error();
        });
      });
    })
  );
});
