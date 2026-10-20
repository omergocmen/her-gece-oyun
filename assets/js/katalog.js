// Oyun kataloğu yardımcıları: tarayıcıda window.Katalog, Node testlerinde module.exports.
//
// games.json yeni oyunları sona ekler. Aynı gün birden fazla oyun eklenebildiği için tarih
// tek başına yetmez: eşit tarihlerde dosyada sonra gelen oyun daha yeni sayılır.
(function (kok) {
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

  var Katalog = { sirala: sirala, numaralar: numaralar, oyunAdresi: oyunAdresi };
  if (typeof module !== 'undefined' && module.exports) module.exports = Katalog;
  else kok.Katalog = Katalog;
})(this);
