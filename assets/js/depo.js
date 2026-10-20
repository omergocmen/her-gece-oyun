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
    }
  };
  kok.Depo = Depo;
})(this);
