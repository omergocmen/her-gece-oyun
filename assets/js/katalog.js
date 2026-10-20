// Oyun kataloğu yardımcıları: tarayıcıda window.Katalog, Node testlerinde module.exports.
(function (kok) {
  // Son kaç gün içinde eklenen oyun kartında "Yeni" damgası taşır.
  var YENI_GUN = 7;

  function sirala(oyunlar) {
    return oyunlar.slice().sort(function (a, b) {
      return a.eklenme < b.eklenme ? 1 : a.eklenme > b.eklenme ? -1 : 0;
    });
  }

  function oyunAdresi(oyun) {
    return 'games/' + oyun.slug + '/';
  }

  // YYYY-AA-GG tarihini yerel gece yarısına çevirir; saat dilimi kayması olmasın diye Date.parse kullanılmaz.
  function gunBasi(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  // Oyun bugünden en fazla YENI_GUN gün önce eklendiyse yenidir (gelecek tarihli kayıt da yeni sayılır).
  function yeniMi(oyun, bugun) {
    var b = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
    return Math.round((b - gunBasi(oyun.eklenme)) / 864e5) < YENI_GUN;
  }

  var Katalog = { YENI_GUN: YENI_GUN, sirala: sirala, oyunAdresi: oyunAdresi, gunBasi: gunBasi, yeniMi: yeniMi };
  if (typeof module !== 'undefined' && module.exports) module.exports = Katalog;
  else kok.Katalog = Katalog;
})(this);
