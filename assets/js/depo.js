// localStorage sarmalayıcısı: gizli sekmede ya da depolama kapalıyken sessizce çalışmaya devam eder.
(function (kok) {
  var ONEK = 'hgo:';
  var Depo = {
    oku: function (anahtar, varsayilan) {
      try {
        var deger = kok.localStorage.getItem(ONEK + anahtar);
        return deger === null ? varsayilan : JSON.parse(deger);
      } catch (e) {
        return varsayilan;
      }
    },
    yaz: function (anahtar, deger) {
      try {
        kok.localStorage.setItem(ONEK + anahtar, JSON.stringify(deger));
      } catch (e) { /* depolama yoksa ilerleme kaydedilmez */ }
    },
    // Ana sayfadaki oyun kartının özet satırı ("En iyi 1240", "Seri 4"): hgo:ozet:<slug>.
    // Oyun yalnızca yazar, ana sayfa yalnızca okur; boş metin yazılmaz ki kart boş satır çizmesin.
    ozetYaz: function (slug, metin) {
      if (metin) Depo.yaz('ozet:' + slug, String(metin));
    },
    ozetOku: function (slug) {
      var metin = Depo.oku('ozet:' + slug, null);
      return typeof metin === 'string' && metin ? metin : null;
    },
    // "Kaldığın yerden" şeridi için son açılan oyunlar (hgo:son-oynanan), en yeni başta, tekrar etmez.
    oynandi: function (slug) {
      var liste = Depo.sonOynananlar().filter(function (s) { return s !== slug; });
      liste.unshift(slug);
      Depo.yaz('son-oynanan', liste.slice(0, SON_SINIR));
    },
    sonOynananlar: function () {
      var liste = Depo.oku('son-oynanan', []);
      return Array.isArray(liste) ? liste.filter(function (s) { return typeof s === 'string'; }) : [];
    }
  };
  var SON_SINIR = 12;
  kok.Depo = Depo;

  // Her oyun sayfası depo.js'yi yükler; sayfa /games/<slug>/ altındaysa kendini son oynananlara ekler.
  // Böylece yeni oyun eklenince oyun koduna ayrıca satır yazmak gerekmez.
  var yol = /\/games\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(?:index\.html)?$/.exec((kok.location && kok.location.pathname) || '');
  if (yol) Depo.oynandi(yol[1]);
})(this);
