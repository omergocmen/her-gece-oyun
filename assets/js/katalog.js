// Oyun kataloğu yardımcıları: tarayıcıda window.Katalog, Node testlerinde module.exports.
//
// games.json yeni oyunları sona ekler. Aynı gün birden fazla oyun eklenebildiği için tarih
// tek başına yetmez: eşit tarihlerde dosyada sonra gelen oyun daha yeni sayılır.
(function (kok) {
  // Son kaç gün içinde eklenen oyun kartında "Yeni" damgası taşır.
  var YENI_GUN = 7;

  function sirala(oyunlar) {
    return oyunlar
      .map(function (oyun, i) { return { oyun: oyun, i: i }; })
      .sort(function (a, b) {
        if (a.oyun.eklenme !== b.oyun.eklenme) return a.oyun.eklenme < b.oyun.eklenme ? 1 : -1;
        return b.i - a.i;
      })
      .map(function (k) { return k.oyun; });
  }

  // Numara oyunun kalıcı kimliğidir: games.json'daki sırası (ilk oyun No. 001). Yeni oyun
  // sona eklendiği için mevcut oyunların numarası değişmez. slug → numara
  function numaralar(oyunlar) {
    var m = {};
    oyunlar.forEach(function (oyun, i) { m[oyun.slug] = i + 1; });
    return m;
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

  var Katalog = { YENI_GUN: YENI_GUN, sirala: sirala, numaralar: numaralar, oyunAdresi: oyunAdresi, gunBasi: gunBasi, yeniMi: yeniMi };
  if (typeof module !== 'undefined' && module.exports) module.exports = Katalog;
  else kok.Katalog = Katalog;
})(this);
