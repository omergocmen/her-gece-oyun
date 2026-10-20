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
    }
  };
  kok.Depo = Depo;
})(this);
